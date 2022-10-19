import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { createFromProtobuf, exportToProtobuf, createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { TCP } from '@libp2p/tcp'
import { LevelDatastore } from 'datastore-level'
import { readFile, writeFile } from 'fs/promises'
import NATApi from 'nat-api'
import localip from 'local-ip'
import { decode, encode } from "lob-enc";
import fetch from "cross-fetch";
import { pipe } from 'it-pipe'
import chokidar from 'chokidar'
import { Bootstrap } from '@libp2p/bootstrap'
import { KadDHT } from '@libp2p/kad-dht'
import { Socket } from 'net'

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
const ID_PATH = process.env.ID_PATH || './store/id'
const PUBLIC_PATH = process.env.PUBLIC_PATH || './store'
const BOOTSTRAP_PATH = `${PUBLIC_PATH}/libp2p.bootstrap`
const RELAY_CACHE_PATH = `${PUBLIC_PATH}/libp2p.relays`
const PRIVATE_PORT = 9000

const getLocalIPS = async () => {
  const res = await Promise.all(['eth0', 'wlan0', 'en0'].map(iface => new Promise(resolve => localip(iface, (err, ip) => resolve(err ? null : ip)))))
  return res.filter(i => i)
}

const getLocalMultiaddr = async (idstr) => {
  const [localIP] = await getLocalIPS()
  return `/ip4/${localIP}/tcp/${PRIVATE_PORT}/ws/p2p/${idstr}`
}

const mapPort = async (nat, privatePort) => {
  let success = false, publicPort = privatePort - 1;
  let error = null;

  do {
    publicPort++
    error = await new Promise((resolve) => nat.map({
      privatePort,
      publicPort,
      protocol: 'TCP'
    }, (err) => resolve(err)))
  } while (error && publicPort - privatePort < 10)

  if (error) {
    console.warn('unable to open port', error)
  }

  success = !error;

  return { success, publicPort }
}

const getIP = async (nat) => new Promise((resolve, reject) => {
  nat.externalIp(function (err, ip) {
    if (err) return reject(err)
    resolve(ip)
  })
})

const YGGDRASIL_PEERS = '/yggdrasil/peers'

const getRelayAddrs = async (peerId) => {
  const yg_peers = (await readFile(YGGDRASIL_PEERS))
    .toString()
    .split('\n')

  const addrs = []

  for (const host_str of yg_peers) {
    console.log('host_str', host_str)
    const [ip_part, host] = host_str.split(' ');
    if (!host) continue;

    const p1 = host.slice(0, host.length - 1)
    const p2 = host.slice(host.length - 1)
    const multiaddraw = await fetch(`https://yggdrasil.${p1}.${p2}.yg/libp2p.relay`).then(r => r.text()).catch(e => {
      console.log('relay failure, ignoring')
      return ''
    })

    const multiaddr = multiaddraw.trim()
    if (multiaddr && !multiaddr.includes(peerId.toString())) {
      // console.log('got new relay addr', multiaddr)
      addrs.push(multiaddr)
    }
  }

  console.log('relay addrs', addrs)
  return addrs;
}

async function* makeWatcher(file_path) {
  let ok = true;
  while (ok) {
    ok = await new Promise(async (resolve, reject) => {
      const chok = chokidar.watch(file_path)

      chok.on('change', async () => {
        await chok.unwatch()
        resolve(true)
      })
      chok.on('error', reject)
    }).catch(async e => {
      console.warn('error, waiting 10 seconds', e)
      await new Promise(r => setTimeout(r, 10000))
      return true;
    })

    yield ok;
  }
}

async function pollDial(node, addr) {
  let conn = null
  do {
    conn = await node.dial(addr).catch(e => new Promise(r => setTimeout(r, 10000)))
  } while (!conn)
  return conn;
}

async function waitTillClosed(conn) {
  while (conn.stat.status !== "CLOSED") {
    await new Promise(r => setTimeout(r, 10000))
  }
}

async function keepalive(node, addr) {
  while (true) {
    await waitTillClosed(await pollDial(node, addr))
  }
}

async function cachePublicMultiaddr(ma) {
  const cache = await readFile(RELAY_CACHE_PATH).then(s => new Set(s.toString().trim().split(','))).catch(() => new Set())
  cache.add(ma)
  await writeFile(RELAY_CACHE_PATH, Array.from(cache).join(','))
}

async function dialRelays(node) {
  const seen = new Set()
  const watcher = makeWatcher(YGGDRASIL_PEERS)
  do {
    const relays = (await getRelayAddrs(node.peerId))
      .filter(str => {
        const _seen = seen.has(str);
        seen.add(str);
        return !_seen;
      })
    for (const relay of relays) {
      console.log('keepalive relay', relay)
      keepalive(node, relay)
      await cachePublicMultiaddr(`${relay}/p2p-circuit/p2p/${node.peerId.toString()}`)
    }
  } while (await watcher.next())
}

export default async function main() {
  const nat = new NATApi()
  console.log('starting', ID_PATH, PUBLIC_PATH)

  const peerId = await readFile(ID_PATH).then(createFromProtobuf).catch(async e => {
    const _id = await createEd25519PeerId()
    await writeFile(ID_PATH, exportToProtobuf(_id))
    return _id;
  })

  await writeFile('/yggdrasil/libp2p.id', peerId.toString())

  const bootstrap = await getLocalMultiaddr(peerId.toString())
  await writeFile(BOOTSTRAP_PATH, bootstrap)

  const datastore = new LevelDatastore('./libp2p')
  await datastore.open() // level database must be ready before node boot

  const privatePort = PRIVATE_PORT
  const { success, publicPort } = await mapPort(nat, privatePort)
  const publicIP = await getIP(nat).catch(() => null)


  const relay_peers = await getRelayAddrs(peerId)
  const peerDiscovery = relay_peers.length ? [
    new Bootstrap({
      list: relay_peers
    })
  ] : undefined

  console.log("peerDiscovery", peerDiscovery)


  const announce = success && publicIP ? [`/ip4/${publicIP}/tcp/${publicPort}/ws`] : undefined

  if (announce) {
    const ma = `${announce[0]}/p2p/${peerId.toString()}`
    await writeFile('/yggdrasil/libp2p.relay', ma)
    await cachePublicMultiaddr(ma)
  }
  const listen = ['/ip4/0.0.0.0/tcp/9000/ws', '/ip4/0.0.0.0/tcp/9001']
  const node = await createLibp2p({
    peerId,
    // datastore,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/9000/ws', '/ip4/0.0.0.0/tcp/9001']//,
      // announce: announce
    },
    transports: [
      new WebSockets()
    ],
    streamMuxers: [
      new Mplex()
    ],
    connectionEncryption: [
      new Noise()
    ],
    // dht: new KadDHT(),

    peerDiscovery,
    relay: {
      enabled: true,
      hop: {
        enabled: true
      },
      advertise: {
        enabled: true,
      }
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
  })

  node.peerStore.addEventListener('change:multiaddrs', (evt) => {
    // Updated self multiaddrs?
    if (evt.detail.peerId.equals(node.peerId)) {
      console.log(`Advertising with a relay address of`)
      node.getMultiaddrs().forEach(m => console.log(m.toString()))
      console.log(evt.detail)
    }
  })

  node.handle('/samizdapp-relay', ({ stream }) => {
    console.log('got relay stream')
    pipe(
      function () {
        return (async function* () {
          const seen = new Set()
          const watcher = makeWatcher(YGGDRASIL_PEERS)
          do {
            const relays = (await getRelayAddrs(peerId)).map(str => `${str}/p2p-circuit/p2p/${node.peerId.toString()}`)
              .filter(str => {
                const _seen = seen.has(str);
                seen.add(str);
                return !_seen;
              }).concat([announce ? `${announce[0]}/p2p/${peerId.toString()}` : undefined]).reverse()
            for (const relay of relays) {
              console.log('sending relay', relay)
              if (relay) {
                yield Buffer.from(relay)
              }
            }
          } while (await watcher.next())
        })()
      },
      stream
    )
  })

  node.handle('/samizdapp-socket', async ({ stream }) => {
    const source = intostream(stream.source)
    const sink = intostream(stream.sink)
    const socket = new Socket()
    await new Promise((resolve, reject) => {
      socket.on('error', reject)
      socket.connect(8888, 'localhost', resolve)
    })

    source.pipe(socket).pipe(sink)
  })

  node.handle('/samizdapp-proxy', ({ stream }) => {
    // console.log('got proxy stream')
    pipe(
      stream.source,
      async function (source) {
        const chunks = []
        for await (const val of source) {
          // console.log('stream val', val)
          const buf = Buffer.from(val.subarray())
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

                url = reqObj.startsWith("http") ? reqObj : `http://localhost${reqObj}`;
                if (
                  reqInit.method &&
                  reqInit.method !== "HEAD" &&
                  reqInit.method !== "GET"
                ) {
                  reqInit.body = body;
                }
                init = reqInit
              } else if (typeof reqObj !== 'string') {
                reqInit = reqObj;
                url = reqObj.url
                if (
                  reqObj.method &&
                  reqObj.method !== "HEAD" &&
                  reqObj.method !== "GET"
                ) {
                  reqObj.body = body;
                }
                init = reqObj
              }

              console.log('do fetch', url)//, init, init.body ? init.body : '')
              fres = await fetch(url, init).catch(error => {
                console.log('proxy downstream error', error)
                resolve([encode({ error }, Buffer.from(error?.toString ? error.toString() : 'unknown error')), Buffer.from([0x00])])
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
              const _chunks = []
              for (; i <= Math.floor(forward.length / CHUNK_SIZE); i++) {
                _chunks.push(forward.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
              }
              // console.log("i max", i, Math.ceil(forward.length / CHUNK_SIZE));
              _chunks.push(Buffer.from([0x00]))
              resolve(_chunks)
            })
          } else {
            chunks.push(buf)
          }

        }
      },
      stream.sink
    )
  }, {
    maxInboundStreams: 100
  })


  node.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log(`Connected to ${connection.remotePeer.toString()}`)
    // console.log(connection)
  })


  console.log('libp2p has started')


  console.log(`Node started with id ${node.peerId.toString()}`)
  console.log('Listening on:')
  //  node.getMultiaddrs()
  node.components.getAddressManager().getAddresses().forEach((ma) => console.log(ma.toString()))

  await node.start()

  dialRelays(node)
}

main()