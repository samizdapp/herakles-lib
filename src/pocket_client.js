import { encode, decode } from "lob-enc";
import { WSClient } from "pocket-sockets";
import {
  Messaging,
  once,
  init,
  genKeyPair,
  HandshakeAsClient,
} from "pocket-messaging";
import localforage from "localforage";

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

const getWSAddress = async () => {
  const {address} = (await localforage.getItem('mdns')) || {}
  if (address) return address;

  try {
    return window.location.hostname
  } catch(e){
    return self.location.hostname
  }
}

const getHost = () => {
  try {
    return window.location.host
  } catch(e){
    return self.location.host
  }
}

class ClientManager {
  constructor({ host, port }) {
    this._host = getHost();
    this._port = port;
    this._addresses = new Set();
    this._clients = new Map();
    this._job = Promise.resolve();

    this.ORIGIN = `${this._host}:${this._port}`;
  }

  addAddress(address) {
    this._addresses.add(address);
  }

  async init() {
    await init();
    this.keyPairClient = await genKeyPair();
  }

  async createClient(address) {
    return new Promise((resolve, reject) => {
      const [host, port] = address.split(":");
      console.log("create client", host, port);
      let client;
      const _client = new WSClient({
        host,
        port,
      });

      _client.onConnect(async () => {
        console.log("onConnect");

        client = new Messaging(_client);

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

        const hs = await HandshakeAsClient(
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
        client.alive = async () => {
          console.log("send keepalive");
          if (client._alive && Date.now() - client._alive < 5000){
            return true;
          }
          const timeout = new Promise((r) =>
            setTimeout(() => r("timeout"), 1000)
          );
          const sendres = client.send(
            "ping",
            Buffer.from("deadbeef", "hex"),
            5000,
            true
          );

          console.log("sent ping", sendres);
          if (!(sendres && sendres.eventEmitter)) {
            return false;
          }

          const { eventEmitter } = sendres;

          console.log("await response");
          const res = await Promise.race([
            timeout,
            once(eventEmitter, "reply"),
          ]);
          if (res === "timeout") {
            console.log("timeout");
            return false;
          }

          console.log("is alive");
          client._alive = Date.now()
          return true;
        };
        resolve(client);
      });

      _client.onError((e) => {
        if (client) {
          client.close();
        }
        console.warn(`error connecting ${address}`);
        reject(e);
      });

      _client.onClose(() => {
        if (client) {
          console.log("client closed");
          if (client.onClose) client.onClose();
          client.close();
          this._gettingClient = false;
          // this.getClient();
        }
        // alert(`closed ${address}`);
      });

      try {
        _client.connect();
      } catch (e){
        reject(e)
      }
    });
  }

  async raceNewClients() {
    return Promise.race(
      (await this.getAddresses()).map((address) =>
        this.createClient(address).catch((e) => {
          console.debug("failed to get client for ".address);
          console.debug(e);
          return new Promise((r) => setTimeout(() => r(null), 5000));
        })
      )
    );
  }

  async getClient() {
    while (this._getClientLock) {
      await new Promise((r) => setTimeout(r, 100));
    }
    this._getClientLock = true;

    while (!this._client || !(await this._client.alive())) {
      this._client = await this.raceNewClients();
    }

    this._getClientLock = false;
    return this._client;
  }

  // async getClient() {
  //   if (!this._gettingClient) {
  //     this._gettingClient = true;
  //     this._client =
  //       this._client ||
  //       (await this.createClient(`${this._host}:${this._port}`));
  //   }
  //   while (!this._client) {
  //     await new Promise((r) => setTimeout(r, 50));
  //   }

  //   return this._client;
  // }

  async getAddresses() {
    const lanwan = Array.from(this._addresses);
    return lanwan.concat([`${await getWSAddress()}:${this._port}`])
    // const domain = [`${this._host}:${this._port}`]
    // return lanwan.length ? lanwan.concat : domain;
  }

  async connect(address, attempt) {
    if (this.isConnected(address)) return;
  }
}

async function normalizeBody(body) {
  try {
    if (!body) return undefined;
    if (typeof body === "string") return Buffer.from(body);
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof ArrayBuffer) {
      if (body.byteLength > 0) return Buffer.from(new Uint8Array(body));
      return undefined;
    }
    if (body.arrayBuffer) {
      return Buffer.from(new Uint8Array(await body.arrayBuffer()));
    }
    if (body.toString() === "[object ReadableStream]") {
      const reader = body.getReader();
      const chunks = [];
      let _done = false;
      do {
        const { done, value } = await reader.read();
        _done = done;
        chunks.push(Buffer.from(new Uint8Array(value)));
      } while (!_done);
      return Buffer.concat(chunks);
    }

    throw new Error(`don't know how to handle body`);
  } catch (e) {
    return Buffer.from(
      `${e.message} ${typeof body} ${body.toString()} ${JSON.stringify(body)}`
    );
  }
}

export default class PocketClient {
  constructor(
    { id = 50, host = "localhost", port = 3000, namespace = "client" },
    onAddress = () => {}
  ) {
    this._host = `${host}:${port}`;
    this._port = port;
    this._clientManager = new ClientManager({ host, port });
    this.onAddress = onAddress;
    this._job = Promise.resolve();
    this._lastAddress = host;
    this._pending = new Set();
    this.subdomain = 'pleroma' //TODO make configurable
  }

  async init() {
    await this._clientManager.init();
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

  patchFetchArgs(_reqObj, _reqInit) {
    if (typeof _reqObj === "string") {
      let reqObj;
      let reqInit = _reqInit || {};
      if (_reqObj.startsWith('http')){
        const url = new URL(_reqObj);
        if (url.host === getHost()) {
          console.log("subdomain", _reqInit);
          url.host = "localhost";
          url.protocol = "http:";
          url.port = "80";
        }
        reqObj = url.toString()
      } else {
        reqObj = `http://localhost${reqObj}`
      }
      reqInit.headers = reqInit.headers || {};
      if (reqInit.headers.entries){
        for (var pair of reqInit.headers.entries()) {
          reqInit.headers[pair[0]] = pair[1];
          console.log(pair[0] + ": " + pair[1]);
        }
      }

      reqInit.headers["X-Intercepted-Subdomain"] = this.subdomain;
      return {reqObj, reqInit}
    }
    // if (typeof _reqObj === "string" && _reqObj.startsWith("http")) {
    // console.log("patch");
    const url = new URL(_reqObj.url.startsWith('http') ? _reqObj.url : `http://localhost${_reqObj.url}`);
    _reqInit.headers = _reqObj.headers || {};
    if (url.pathname !== '/manifest.json') {
      _reqInit.headers["X-Intercepted-Subdomain"] = this.subdomain;
    }

    for (var pair of _reqObj.headers.entries()) {
      _reqInit.headers[pair[0]] = pair[1];
      // console.log(pair[0] + ": " + pair[1]);
    }

    if (url.host === getHost()) {
      // console.log("subdomain", _reqInit);
      url.host = "localhost";
      url.protocol = "http:";
      url.port = "80";
    }

    // }

    const reqObj = {
      bodyUsed: _reqObj.bodyUsed,
      cache: _reqObj.cache,
      credentials: _reqObj.credentials,
      destination: _reqObj.destination,
      headers: _reqObj.headers,
      integrity: _reqObj.integrity,
      isHistoryNavigation: _reqObj.isHistoryNavigation,
      keepalive: _reqObj.keepalive,
      method: _reqObj.method,
      mode: _reqObj.mode,
      redirect: _reqObj.redirect,
      referrer: _reqObj.referrer,
      referrerPolicy: _reqObj.referrerPolicy,
      url: url.toString(),
    };

    const reqInit = _reqInit;

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
    // console.log("pocketFetch", xhr, reqObj, reqInit);
    const patched = this.patchFetchArgs(reqObj, reqInit);
    const body = reqObj.body ? reqObj.body 
               : reqInit.body ? reqInit.body 
               : reqObj.arrayBuffer ?  (await reqObj.arrayBuffer()) 
               : null;

    reqObj = patched.reqObj;
    reqInit = patched.reqInit;
    // console.log("pocketFetch2", reqObj, reqInit, body);
    delete reqObj.body;
    delete reqInit.body;
    const pbody = await normalizeBody(body);
    const packet = encode({ reqObj, reqInit }, pbody);
    // alert("get client");
    console.log("encodedPacket");
    // alert(`fetching ${reqObj}`);
    const client = await this._clientManager.getClient();
    // alert(`fetching from ${client.address}`);
    // console.log("pocketfetch3", client);
    const uuid = randomRoute(); //Math.random().toString(36).slice(2).slice(0, 6); // short lived id, don't need hard unique constraints
    let i = 0;
    for (; i < Math.floor(packet.length / CHUNK_SIZE); i++) {
      const { eventEmitter } = client.send(
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
    // console.log("uuid?", uuid);
    // let eventEmitter = client.send(uuid, packet, xhr.timeout || 60000, true);
    // console.log("pocketFetch4", eventEmitter, eventEmitter.msgId);

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
          const chunk = await once(eventEmitter, "reply");
          const buf = Buffer.from(chunk.data);
          // console.log("chunk", uuid, chunk);
          chunks.push(Buffer.from(chunk.data));
          clen = chunk.data.length;
        } while (clen > 0);
        // console.log("concat reply", chunks);
        const reply = Buffer.concat(chunks);
        this._lastAddress = client.address;
        const resp = decode(reply);
        const { lan, wan, error } = resp.json;
        this._pending.delete(eventEmitter);

        if (error){
          return reject(new Error(resp.body.toString()))
        }
        this.handleAddresses({ lan, wan });
        // console.log("resp.json", resp.body, resp.json.res);
        resp.json.res.headers = new Headers(resp.json.res.headers);
        // alert("complete");
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
    this._host = `${window.location.hostname}:${this._port}`;
    this._hostname = window.location.hostname;
    window.fetch = this.pocketFetch.bind(this);

    this.patchXHR();
  }

  async patchFetchWorker() {
    this._fetch = self.fetch.bind(self);
    this._host = `${getHost()}:${this._port}`;
    this._hostname = getHost()
    self.fetch = this.pocketFetch.bind(this);
  }

  patchXHR() {
    const self = this;
    const _send = XMLHttpRequest.prototype.send;
    const _open = XMLHttpRequest.prototype.open;
    const _setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (!this._headers){
        Object.defineProperties(this, {
          _headers: {
            value: {},
            writable: true
          }
        })
      }

      this._headers[name] = value;
      return _setRequestHeader.bind(this)(name, value)
    }
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
        const init = { method, headers: this._headers || {} };
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
              let _res = [];
              console.log('res.headers', res.headers)
              for (const pair of res.headers.entries()) {
                _res.push(`${pair[0]}: ${pair[1]}`);
              }
              return _res.join("\r\n");
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
