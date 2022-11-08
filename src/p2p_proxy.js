import { Noise } from "@chainsafe/libp2p-noise";
import { Bootstrap } from "@libp2p/bootstrap";
import { Mplex } from "@libp2p/mplex";
import {
  createEd25519PeerId,
  createFromProtobuf,
  exportToProtobuf,
} from "@libp2p/peer-id-factory";
import { WebSockets } from "@libp2p/websockets";
import chokidar from "chokidar";
import fetch from "cross-fetch";
import { LevelDatastore } from "datastore-level";
import { readFile, writeFile, rm } from "fs/promises";
import { pipe } from "it-pipe";
import { createLibp2p } from "libp2p";
import { decode, encode } from "lob-enc";
import localip from "local-ip";
import NATApi from "nat-api";
import { Socket } from "net";
import { mapPort } from "./upnp.js";
import { webcrypto } from "crypto";
import WebSocket from "ws";
import { KEEP_ALIVE } from "@libp2p/interface-peer-store/tags";

const CHUNK_SIZE = 1024 * 64;

const getHeadersJSON = (h) => {
  const ret = {};
  for (const pair of h.entries()) {
    ret[pair[0]] = pair[1];
  }
  return ret;
};

const getResponseJSON = (r) => ({
  ok: r.ok,
  headers: getHeadersJSON(r.headers),
  redirected: r.redirected,
  status: r.status,
  statusText: r.statusText,
  type: r.type,
  url: r.url,
});
const ID_PATH = process.env.ID_PATH || "./store/id";
const PUBLIC_PATH = process.env.PUBLIC_PATH || "./store";
const BOOTSTRAP_PATH = `${PUBLIC_PATH}/libp2p.bootstrap`;
const RELAY_CACHE_PATH = `${PUBLIC_PATH}/libp2p.relays`;
const PRIVATE_PORT = 9000;

const getLocalIPS = async () => {
  const res = await Promise.all(
    ["eth0", "wlan0", "en0"].map(
      (iface) =>
        new Promise((resolve) =>
          localip(iface, (err, ip) => resolve(err ? null : ip))
        )
    )
  );
  return res.filter((i) => i);
};

const getLocalMultiaddr = async (idstr) => {
  const [localIP] = await getLocalIPS();
  return `/ip4/${localIP}/tcp/${PRIVATE_PORT}/ws/p2p/${idstr}`;
};

const getIP = async (nat) =>
  new Promise((resolve, reject) => {
    nat.externalIp(function (err, ip) {
      if (err) return reject(err);
      resolve(ip);
    });
  });

const YGGDRASIL_PEERS = "/yggdrasil/peers";

const getRelayAddrs = async (peerId) => {
  const yg_peers = (
    await readFile(YGGDRASIL_PEERS).catch((e) => Buffer.from(""))
  )
    .toString()
    .split("\n");

  const proms = [];

  for (const host_str of yg_peers) {
    const [ip_part, host] = host_str.split(" ");
    if (!host) continue;

    const p1 = host.slice(0, host.length - 1);
    const p2 = host.slice(host.length - 1);
    const fetchaddr = `https://yggdrasil.${p1}.${p2}.yg/libp2p.relay`;
    // console.log("try relay", fetchaddr);
    proms.push(
      fetch(fetchaddr)
        .then((r) => r.text())
        .catch((e) => {
          return "";
        })
        .then((raw) => raw.trim())
    );
  }

  const addrs = (await Promise.all(proms)).filter(
    (multiaddr) => multiaddr && !multiaddr.includes(peerId.toString())
  );

  console.log("relay addrs", addrs);
  return addrs;
};

const delay = async (ms) => new Promise((r) => setTimeout(r, ms));

const makeWatchProm = async (file_path, cb) => {
  const chok = chokidar.watch(file_path);

  const abort = async () => {
    try {
      await chok.unwatch();
    } catch (e) {
      console.log("unwatch error", e);
    }
  };
  const prom = new Promise(async (resolve, reject) => {
    chok.on("change", async () => {
      await cb();
      await chok.unwatch();
      resolve(true);
    });
    chok.on("error", async () => {
      await delay(10000);
      resolve(true);
    });
  });

  return { abort, prom };
};

async function* makeWatcher(file_path, id = webcrypto.randomUUID()) {
  let timeout = 1000,
    aborted = false;

  const resetTimeout = () => {
    console.log("reset timeout");
    timeout = 1000;
  };

  const abort = () => {
    aborted = true;
  };

  while (!aborted) {
    console.log("watcher loop", id, new Date());
    const { prom, abort } = await makeWatchProm(file_path, resetTimeout);

    const ok = await Promise.race([prom, delay(timeout)]).then(() => true);
    await abort();
    timeout *= 2;
    timeout = Math.min(timeout, 1000 * 60 * 5);
    yield abort;
  }
}

async function pollDial(node, addr) {
  console.log("dial", addr);
  let conn = null;
  do {
    conn = await node
      .dial(addr)
      .catch((e) => new Promise((r) => setTimeout(r, 10000)));
  } while (!conn);
  await node.peerStore.tagPeer(conn.remotePeer, KEEP_ALIVE).catch((e) => {
    // throws an error if already tagged, ignore
    // console.warn(e);
  });
  return conn;
}

async function connectionIsOpen(conn, node) {
  const latency = await node.ping(conn.remotePeer).catch((e) => {
    // console.warn(e);
    return null;
  });
  const conns = node.connectionManager.getConnections();
  const isOpen =
    latency &&
    conns.map(({ id }) => id).includes(conn.id) &&
    conn.stat.status === "OPEN";
  // console.log("check connection open", conn.id, isOpen);

  return isOpen;
}

async function waitTillClosed(conn, node) {
  while (await connectionIsOpen(conn, node)) {
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log("connection closed", conn.id);
}

async function keepalive(node, addr) {
  while (true) {
    const conn = await pollDial(node, addr);
    await waitTillClosed(conn, node);
  }
}

async function cachePublicMultiaddr(ma) {
  const cache = await readFile(RELAY_CACHE_PATH)
    .then((s) => new Set(s.toString().trim().split(",")))
    .catch(() => new Set());
  cache.add(ma);
  await writeFile(RELAY_CACHE_PATH, Array.from(cache).join(","));
}

function relayStreamFactory(node) {
  const relays = new Set();

  (async function () {
    const watcher = makeWatcher(YGGDRASIL_PEERS, "dial_relays");
    let done = false;
    do {
      (await getRelayAddrs(node.peerId)).filter((str) => {
        const _seen = relays.has(str);
        relays.add(str);
        return !_seen;
      });
      const res = await watcher.next();
      done = res.done;
    } while (!done);
  })();

  return async function* makeRelayStream() {
    const seen = new Set();
    while (true) {
      await new Promise((r) => setTimeout(r, 1000));
      for (const relay of Array.from(relays)) {
        if (!seen.has(relay)) {
          seen.add(relay);
          yield relay;
        }
      }
    }
  };
}

async function dialRelays(node, makeRelayStream) {
  const relayStream = makeRelayStream();
  let relay;
  while ((relay = (await relayStream.next()).value)) {
    keepalive(node, relay);
  }
}

async function monitorMemory() {
  while (true) {
    const used = process.memoryUsage();
    console.log("current memory usage:");
    for (let key in used) {
      console.log(
        `${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`
      );
    }
    await new Promise((r) => setTimeout(r, 60000));
  }
}

export default async function main() {
  const nat = new NATApi();
  console.log("starting", ID_PATH, PUBLIC_PATH);

  const peerId = await readFile(ID_PATH)
    .then(createFromProtobuf)
    .catch(async (e) => {
      const _id = await createEd25519PeerId();
      await writeFile(ID_PATH, exportToProtobuf(_id));
      return _id;
    });

  // await writeFile("/yggdrasil/libp2p.id", peerId.toString());

  const bootstrap = await getLocalMultiaddr(peerId.toString());
  await writeFile(BOOTSTRAP_PATH, bootstrap);

  const datastore = new LevelDatastore("./libp2p");
  await datastore.open(); // level database must be ready before node boot

  const privatePort = PRIVATE_PORT;
  const { success, publicPort } = await mapPort(privatePort);
  const publicIP = await getIP(nat).catch(() => null);

  const relay_peers = await getRelayAddrs(peerId);
  const peerDiscovery = relay_peers.length
    ? [
        new Bootstrap({
          list: relay_peers,
        }),
      ]
    : undefined;

  console.log("peerDiscovery", peerDiscovery);

  const announce =
    success && publicIP ? [`/ip4/${publicIP}/tcp/${publicPort}/ws`] : undefined;

  if (announce) {
    const ma = `${announce[0]}/p2p/${peerId.toString()}`;
    await writeFile("/yggdrasil/libp2p.relay", ma);
    await cachePublicMultiaddr(ma);
  } else {
    await rm("/yggdrasil/libp2p.relay").catch((e) => {
      //will throw error if no file, ignore
    });
  }
  const listen = ["/ip4/0.0.0.0/tcp/9000/ws", "/ip4/0.0.0.0/tcp/9001"];
  const node = await createLibp2p({
    peerId,
    // datastore,
    addresses: {
      listen: ["/ip4/0.0.0.0/tcp/9000/ws", "/ip4/0.0.0.0/tcp/9001"], //,
      // announce: announce
    },
    transports: [new WebSockets()],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
    // dht: new KadDHT(),

    peerDiscovery,
    relay: {
      enabled: true,
      hop: {
        enabled: true,
      },
      advertise: {
        enabled: true,
      },
    },
    // connectionManager: {
    //   autoDial: false, // Auto connect to discovered peers (limited by ConnectionManager minConnections)
    //   minConnections: 0,
    //   maxDialsPerPeer: 10
    //   // The `tag` property will be searched when creating the instance of your Peer Discovery service.
    //   // The associated object, will be passed to the service when it is instantiated.
    // },
    // peerStore: {
    //   // persistence: true,
    //   threshold: 5
    // },
    // keychain: {
    //   pass: 'notsafepassword123456789',
    //   datastore,
    // }
  });

  node.peerStore.addEventListener("change:multiaddrs", (evt) => {
    // Updated self multiaddrs?
    if (evt.detail.peerId.equals(node.peerId)) {
      console.log(`Advertising with a relay address of`);
      node.getMultiaddrs().forEach((m) => console.log(m.toString()));
      console.log(evt.detail);
    }
  });

  let makeRelayStream = null;

  node.handle("/samizdapp-relay", async ({ stream, connection }) => {
    while (!makeRelayStream) {
      await new Promise((r) => setTimeout(r, 1000));
    }

    let abort = false;
    pipe(function () {
      return (async function* () {
        const relayStream = makeRelayStream();
        if (announce) {
          yield Buffer.from(
            `${announce[0]}/p2p-circuit/p2p/${peerId.toString()}`
          );
        }
        let relay;
        while ((relay = (await relayStream.next()).value)) {
          yield Buffer.from(relay);
        }
      })();
    }, stream);

    // await waitTillClosed(connection, node);
    // while (!abort) {
    //   await new Promise((r) => setTimeout(r, 1000));
    // }
    // abort();
  });

  node.handle("/samizdapp-socket", async ({ stream }) => {
    const source = intostream(stream.source);
    const sink = intostream(stream.sink);
    const socket = new Socket();
    await new Promise((resolve, reject) => {
      socket.on("error", reject);
      socket.connect(8888, "localhost", resolve);
    });

    source.pipe(socket).pipe(sink);
  });

  const readNextLob = async (ws) =>
    new Promise(
      (r) =>
        (ws.onmessage = ({ data, ...json }) => {
          console.log("got ws message", data.toString(), json);
          r(encode(json, Buffer.from(data)));
        })
    );

  const writeNextLob = (ws, msg) => {
    ws.send(decode(Buffer.from(msg.subarray())).body);
  };

  async function* makeWebsocketReadStream(ws) {
    while (ws.readyState == 1) {
      yield readNextLob(ws);
    }
  }

  function makeWebSocketSink(ws) {
    return async (source) => {
      for await (const value of source) {
        await writeNextLob(ws, value);
      }
    };
  }

  const wsOpen = async (ws) => {
    return new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
  };

  node.handle("/samizdapp-websocket", async ({ stream }) => {
    console.log("got websocket stream", stream);
    const { value } = await stream.source.next();
    const {
      json: { type, url, protocols },
    } = decode(Buffer.from(value.subarray()));
    console.log("init", type, url, protocols);
    if (type !== "URL") {
      console.warn("first message expects URL");
      return stream.close();
    }
    const ws = new WebSocket(url, protocols);
    await wsOpen(ws)
      .then(() => {
        console.log("websocket open");
        const wsRead = makeWebsocketReadStream(ws);
        const wsWrite = makeWebSocketSink(ws);

        pipe(wsRead, stream.sink);

        pipe(stream.source, wsWrite);
      })
      .catch((e) => {
        console.log("websocket stream error", e);
      });
  });

  node.handle(
    "/samizdapp-proxy",
    ({ stream }) => {
      // console.log('got proxy stream')
      pipe(
        stream.source,
        async function (source) {
          const chunks = [];
          for await (const val of source) {
            // console.log('stream val', val)
            const buf = Buffer.from(val.subarray());
            // console.log('chunk', buf.length, buf.toString('hex'))
            if (buf.length === 1 && buf[0] === 0x00) {
              return new Promise(async (resolve, reject) => {
                let {
                  json: { reqObj, reqInit },
                  body,
                } = decode(Buffer.concat(chunks));

                // console.log("url?", event, reqObj, reqInit);
                let fres, url, init;
                // console.log("set body", body ? body.toString() : "");
                if (typeof reqObj === "string") {
                  url = reqObj.startsWith("http")
                    ? reqObj
                    : `http://localhost${reqObj}`;
                  if (
                    reqInit.method &&
                    reqInit.method !== "HEAD" &&
                    reqInit.method !== "GET"
                  ) {
                    reqInit.body = body;
                  }
                  init = reqInit;
                } else if (typeof reqObj !== "string") {
                  reqInit = reqObj;
                  url = reqObj.url;
                  if (
                    reqObj.method &&
                    reqObj.method !== "HEAD" &&
                    reqObj.method !== "GET"
                  ) {
                    reqObj.body = body;
                  }
                  init = reqObj;
                }

                console.log("do fetch", url); //, init, init.body ? init.body : '')
                fres = await fetch(url, init).catch((error) => {
                  console.log("proxy downstream error", error);
                  resolve([
                    encode(
                      { error },
                      Buffer.from(
                        error?.toString ? error.toString() : "unknown error"
                      )
                    ),
                    Buffer.from([0x00]),
                  ]);
                  return null;
                });
                if (!fres) {
                  return;
                }
                const resb = await fres.arrayBuffer();
                const res = getResponseJSON(fres);
                const forward = encode({ res }, Buffer.from(resb));
                // console.log("got forward", res, forward.length);
                let i = 0;
                const _chunks = [];
                for (; i <= Math.floor(forward.length / CHUNK_SIZE); i++) {
                  _chunks.push(
                    forward.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                  );
                }
                // console.log("i max", i, Math.ceil(forward.length / CHUNK_SIZE));
                _chunks.push(Buffer.from([0x00]));
                resolve(_chunks);
              });
            } else {
              chunks.push(buf);
            }
          }
        },
        stream.sink
      );
    },
    {
      maxInboundStreams: 100,
    }
  );

  node.connectionManager.addEventListener("peer:connect", (evt) => {
    const connection = evt.detail;
    console.log(`Connected to ${connection.remotePeer.toString()}`);
    // console.log(connection)
  });

  console.log("libp2p has started");

  console.log(`Node started with id ${node.peerId.toString()}`);
  console.log("Listening on:");
  //  node.getMultiaddrs()
  node.components
    .getAddressManager()
    .getAddresses()
    .forEach((ma) => console.log(ma.toString()));

  await node.start();

  makeRelayStream = relayStreamFactory(node);

  dialRelays(node, makeRelayStream);
  monitorMemory();
}

main();
