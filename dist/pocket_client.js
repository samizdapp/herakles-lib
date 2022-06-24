'use strict';

var lobEnc = require('lob-enc');
var pocketSockets = require('pocket-sockets');
var pocketMessaging = require('pocket-messaging');
var fetch$1 = require('cross-fetch');
var getExternalIpCB = require('external-ip');
var nodeLocalstorage = require('node-localstorage');
require('cross-fetch/polyfill');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch$1);
var getExternalIpCB__default = /*#__PURE__*/_interopDefaultLegacy(getExternalIpCB);

const CHUNK_SIZE$1 = 65535;

const ipGetter = getExternalIpCB__default["default"]();

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

const getExternalIp = async () =>
  new Promise((resolve, reject) => {
    ipGetter((err, ip) => {
      if (err) return reject(err);
      resolve(ip);
    });
  });

class PocketProxy {
  constructor({ host = "0.0.0.0", port = 4000, lan = "127.0.0.1" }) {
    this._lan = lan;
    this._pending = new Map();
    this._server = new pocketSockets.WSServer({
      host,
      port,
    });

    this._server.onConnection(async (client) => {
      const dis = `${Math.random()}`;

      console.log("init handshake", this.keyPairServer, dis);
      const hsfn = (buf) => {
        console.log("proxy buf", buf.toString());
        if (buf.toString() === "handshake") {
          client.offData(hsfn);
          client.send(
            Buffer.from(
              JSON.stringify({
                skey: this.keyPairServer.publicKey.toString("base64"),
                dis,
              })
            )
          );
        }
      };
      client.onData(hsfn);

      console.log("sent key and dis");
      const hs = await pocketMessaging.HandshakeAsServer(
        client,
        this.keyPairServer.secretKey,
        this.keyPairServer.publicKey,
        Buffer.from(dis)
      ).catch((e) => {
        console.log(e);
        process.exit(1);
      });

      console.log("finish server handshake");

      console.log("hs res", hs);

      let messaging = new pocketMessaging.Messaging(client);

      await messaging.setEncrypted(
        hs.serverToClientKey,
        hs.serverNonce,
        hs.clientToServerKey,
        hs.clientNonce,
        hs.peerLongtermPk
      );

      const eventEmitter = messaging.getEventEmitter();

      eventEmitter.on("route", (event) => {
        console.log("got route event?", event);
        this.handleEvent(messaging, event).catch((e) => {
          console.log(e);
        });
      });

      messaging.open();
    });

    this._server.listen();
  }

  async init() {
    await pocketMessaging.init();
    this.keyPairServer = await pocketMessaging.genKeyPair();
  }

  async handleEvent(messaging, event) {
    console.log("handle event", event.data.length, event.data.byteLength);
    const target = event.target;
    const chunks = this._pending.get(target) || [];
    var copy = Buffer.alloc(event.data.length);
    event.data.copy(copy);
    chunks.push(copy);
    this._pending.set(target, chunks);

    if (!event.expectingReply) {
      console.log("waiting for null chunk");
      // messaging.send(event.fromMsgId, Buffer.from(""));
      return;
    }

    console.log("hadling request");
    this._pending.delete(target);
    const lan = this._lan;

    const wan = await getExternalIp();
    console.log("lanwan", this._lan, wan);

    let {
      json: { reqObj, reqInit },
      body,
    } = lobEnc.decode(Buffer.concat(chunks));
    if (typeof reqObj === "string" && !reqObj.startsWith("http")) {
      reqObj = `http://daemon_caddy${reqObj}`;
    }
    console.log("url?", event, reqObj, reqInit);
    reqInit = reqInit || {};
    if (
      reqInit.method &&
      reqInit.method !== "HEAD" &&
      reqInit.method !== "GET"
    ) {
      reqInit.body = body;
    }
    const fres = await fetch__default["default"](reqObj, reqInit);
    const resb = await fres.arrayBuffer();
    const res = getResponseJSON(fres);
    const forward = lobEnc.encode({ res, lan, wan }, Buffer.from(resb));
    console.log("got forward", res, forward.length);
    let i = 0;
    for (; i < Math.floor(forward.length / CHUNK_SIZE$1); i++) {
      messaging.send(
        event.fromMsgId,
        forward.slice(i * CHUNK_SIZE$1, (i + 1) * CHUNK_SIZE$1)
      );
    }
    console.log("i max", i, Math.ceil(forward.length / CHUNK_SIZE$1));
    messaging.send(event.fromMsgId, forward.slice(i * CHUNK_SIZE$1));
    messaging.send(event.fromMsgId, Buffer.from(""));
  }
}

const CHUNK_SIZE = 65535;

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function randomRoute() {
  let r = "";
  for (let i = 0; i < 4; i++) {
    r += String.fromCharCode(getRandomArbitrary(97, 122));
  }
  return r;
}

class ClientManager {
  constructor({ host, port }) {
    this._host = host;
    this._port = port;
    this._addresses = new Set();
    this._clients = new Map();
    this._job = Promise.resolve();
  }

  addAddress(address) {
    this._addresses.add(address);
  }

  async init() {
    await pocketMessaging.init();
    this.keyPairClient = await pocketMessaging.genKeyPair();
  }

  async createClient(address) {
    return new Promise((resolve, reject) => {
      console.log("create Client", address, this._port);
      let client;
      const _client = new pocketSockets.WSClient({
        host: address,
        port: this._port,
      });

      _client.onConnect(async () => {
        console.log("onConnect");

        client = new pocketMessaging.Messaging(_client);

        const { skey, dis } = await new Promise((resolve, reject) => {
          const hsfn = (buf) => {
            console.log("got client data", buf.toString());
            try {
              _client.offData(hsfn);
              resolve(JSON.parse(buf.toString()));
            } catch (e) {
              console.warn(e);
            }
          };
          _client.onData(hsfn);
          _client.onError(reject);
          _client.sendString("handshake");
        });

        console.log("client hs start");

        const hs = await pocketMessaging.HandshakeAsClient(
          _client,
          this.keyPairClient.secretKey,
          this.keyPairClient.publicKey,
          Buffer.from(skey, "base64"),
          Buffer.from(dis)
        );

        // alert("client hs finished");
        client.setEncrypted(
          hs.clientToServerKey,
          hs.clientNonce,
          hs.serverToClientKey,
          hs.serverNonce,
          hs.peerLongtermPk
        );
        client.open();

        client.address = address;
        // alert(`resolve ${address}`);
        resolve(client);
      });
      _client.onError((e) => {
        if (client) {
          client.close();
        }
        alert(`error ${address}`);
        reject(e);
      });
      _client.onClose(() => {
        if (client) {
          client.close();
          this._client = null;
          this._gettingClient = false;
          this.getClient();
        }
        // alert(`closed ${address}`);
      });

      _client.connect();
    });
  }

  async getClient() {
    if (!this._gettingClient) {
      this._gettingClient = true;
      this._client = this._client || (await this.createClient(this._host));
    }
    while (!this._client) {
      await new Promise((r) => setTimeout(r, 50));
    }

    return this._client;
  }

  getAddresses() {
    return Array.from(this._addresses).concat([this._host]);
  }

  async connect(address, attempt) {
    if (this.isConnected(address)) return;
  }
}

async function normalizeBody(body) {
  if (!body) return undefined;
  if (typeof body === "string") return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body.arrayBuffer)
    return Buffer.from(new Uint8Array(await body.arrayBuffer()));
  throw new Error(`don't know how to handle body`);
}

class PocketClient {
  constructor(
    { id = 50, host = "localhost", port = 3000, namespace = "client" },
    onAddress = () => {}
  ) {
    this._host = host;
    this._port = port;
    this._clientManager = new ClientManager({ host, port });
    this.onAddress = onAddress;
    this._job = Promise.resolve();
    this._lastAddress = host;
    this._pending = new Set();
  }

  async init() {
    this._clientManager.init();
  }

  async patchFetch() {
    this._fetch = global.fetch;
    global.fetch = this.pocketFetch.bind(this);
  }

  handleAddresses({ lan, wan }) {
    this._clientManager.addAddress(lan);
    this._clientManager.addAddress(wan);
    setTimeout(() => this.onAddress({ lan, wan }), 0);
  }

  patchFetchArgs(reqObj, reqInit) {
    if (typeof reqObj === "string" && reqObj.startsWith("http")) {
      const url = new URL(reqObj);
      reqInit.headers = reqInit.headers || {};
      reqInit.headers["X-Intercepted-Subdomain"] = url.hostname;
      url.host = "daemon_caddy";
      url.protocol = "http:";
      url.port = "80";
      reqObj = url.toString();
    }

    return { reqObj, reqInit };
  }

  abort() {
    Array.from(this._pending).forEach((e) => {
      e.emit("abort", new Error("aborted"));
      this._pending.delete(e);
    });
  }

  async pocketFetch(reqObj, reqInit = {}, xhr = {}) {
    // if (reqObj.indexOf(".wasm") > 0) {
    //   return this._fetch(reqObj, reqInit);
    // }
    // alert("alert " + reqObj);
    // this._job = this._job.then(async () => {
    console.log("pocketFetch", xhr, reqObj, reqInit);
    const patched = this.patchFetchArgs(reqObj, reqInit);
    reqObj = patched.reqObj;
    reqInit = patched.reqInit;
    console.log("pocketFetch2", reqObj, reqInit);
    const body = reqObj.body || reqInit.body;
    delete reqObj.body;
    delete reqInit.body;
    const pbody = await normalizeBody(body);
    const packet = lobEnc.encode({ reqObj, reqInit }, pbody);
    // alert("get client");
    console.log("encodedPacket");
    // alert(`fetching ${reqObj}`);
    const client = await this._clientManager.getClient();
    // alert(`fetching from ${client.address}`);
    console.log("pocketfetch3", client);
    const uuid = randomRoute(); //Math.random().toString(36).slice(2).slice(0, 6); // short lived id, don't need hard unique constraints
    let i = 0;
    for (; i < Math.floor(packet.length / CHUNK_SIZE); i++) {
      client.send(
        uuid,
        packet.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }

    // alert(uuid);
    // alert("last chunk " + i);
    let eventEmitter = client.send(
      uuid,
      packet.slice(i * CHUNK_SIZE),
      xhr.timeout || 60000,
      true
    );
    // await once(eventEmitter.eventEmitter, "reply");
    // alert("chunk reply");
    console.log("uuid?", uuid);
    // let eventEmitter = client.send(uuid, packet, xhr.timeout || 60000, true);
    console.log("pocketFetch4", eventEmitter, eventEmitter.msgId);

    if (eventEmitter) {
      return new Promise(async (resolve, reject) => {
        eventEmitter = eventEmitter.eventEmitter;
        eventEmitter.on("error", reject);
        eventEmitter.on("abort", () => {
          // alert("abort");
          resolve(new Response(undefined, { ok: false }));
        });
        this._pending.add(eventEmitter);
        const chunks = [];
        let clen = 0;
        do {
          const chunk = await pocketMessaging.once(eventEmitter, "reply");
          console.log("chunk", uuid, chunk);
          chunks.push(Buffer.from(chunk.data));
          clen = chunk.data.length;
        } while (clen > 0);
        console.log("concat reply", chunks);
        const reply = Buffer.concat(chunks);
        this._lastAddress = client.address;
        const resp = lobEnc.decode(reply);
        const { lan, wan } = resp.json;
        this.handleAddresses({ lan, wan });
        console.log("resp.json", resp.body, resp.json.res);
        resp.json.res.headers = new Headers(resp.json.res.headers);
        // alert("complete");
        this._pending.delete(eventEmitter);
        resolve(new Response(resp.body, resp.json.res));
      });
    } else {
      return new Response(undefined, { ok: false });
    }
    // });

    // return this._job;
  }

  async patchFetchBrowser() {
    this._fetch = window.fetch.bind(window);
    window.fetch = this.pocketFetch.bind(this);

    this.patchXHR();
  }

  patchXHR() {
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._method = method;
      this._url = url;
      return _open.bind(this)(method, url);
    };
    XMLHttpRequest.prototype.send = async function (body) {
      try {
        console.log("xhr.send", this);
        const url = this._url;
        const method = this._method;
        const init = { method };
        if (body) init.body = body;
        const res = await fetch(url, init, this);
        console.log("got res", res);
        const text = await res.text();
        // console.log("");
        Object.defineProperties(this, {
          status: {
            get: () => res.status,
          },
          statusText: {
            get: () => res.statusText,
          },
          response: {
            get: () => text,
          },
          responseText: {
            get: () => text,
          },
          readyState: {
            get: () => XMLHttpRequest.DONE,
          },
          getResponseHeader: {
            value: (key) => res.headers.get(key),
          },
          getAllResponseHeaders: {
            value: () => {
              let res = [];
              for (const pair of res.headers.entries) {
                res.push(`${pair[0]}: ${pair[1]}`);
              }
              return res.join("\r\n");
            },
          },
        });
        console.log(
          "xhr got res",
          method,
          url,
          this.responseText,
          this.readyState
        );
        this.dispatchEvent(new Event("load"));
        this.dispatchEvent(new Event("loadend"));
        this.dispatchEvent(new Event("readystatechange"));
      } catch (e) {
        console.log("xhr error", e);
        this.dispatchEvent(new Event("error", e));
      }
    };
  }
}

class Storage {
  constructor(namespace, service) {
    this._service = service;
    this._namespace = namespace;
  }

  async getItem(key) {
    const str = await this._service.getItem(this._namespace, key);
    return JSON.parse(str);
  }

  async setItem(key, value) {
    return this._service.setItem(this._namespace, key, JSON.stringify(value));
  }
}

class LocalStorageService {
  constructor(service) {
    this.localStorage = service;
    this._job = Promise.resolve();
  }

  async setItem(namespace, key, value) {
    const prom = (this._job = this._job.then(() =>
      this._setItem(namespace, key, value)
    ));
    return prom;
  }

  async getItem(namespace, key) {
    const prom = (this._job = this._job.then(() =>
      this._getItem(namespace, key)
    ));
    return prom;
  }

  async _setItem(namespace, key, value) {
    return this.localStorage.setItem(`${namespace}:${key}`, value);
  }

  async _getItem(namespace, key) {
    return this.localStorage.getItem(`${namespace}:${key}`);
  }
}

class NodeStorage extends Storage {
  constructor(namespace) {
    const localStorage = new nodeLocalstorage.LocalStorage("./scratch");
    super(namespace, new LocalStorageService(localStorage));
  }
}

async function main() {
  new PocketProxy(53);
  const client = new PocketClient(
    {
      id: 100,
      host: "localhost",
      port: 3001,
      namespace: "client_test",
    },
    NodeStorage
  );

  await client.init();

  const res = await fetch("http://localhost/setup/chrome").catch((e) => {
    console.log(e);
  });
  const body = await res.text();

  console.log("got body", body.toString("utf-8"));
}

main();
