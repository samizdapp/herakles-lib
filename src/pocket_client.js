import { encode, decode } from "lob-enc";
import { WSClient } from "pocket-sockets";
import {
  Messaging,
  once,
  init,
  genKeyPair,
  HandshakeAsClient,
} from "pocket-messaging";

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
    await init();
    this.keyPairClient = await genKeyPair();
  }

  async createClient(address) {
    return new Promise((resolve, reject) => {
      console.log("create Client", address, this._port);
      let client;
      const _client = new WSClient({
        host: address,
        port: this._port,
      });

      _client.onConnect(async () => {
        console.log("onConnect");

        client = new Messaging(_client);

        // const { eventEmitter } = client.send(
        //   "handshake",
        //   Buffer.from(""),
        //   0,
        //   true
        // );
        // const serverkey = await once(eventEmitter, "reply");
        // const dis = await once(eventEmitter, "reply");
        // alert(
        //   "got replies? " +
        //     serverkey.data.toString() +
        //     " " +
        //     dis.data.toString()
        // );

        // const hs = await HandshakeAsClient(
        //   _client,
        //   this.keyPairClient.secretKey,
        //   this.keyPairClient.publicKey,
        //   serverkey.data,
        //   dis.data,
        //   Buffer.from("hello")
        // );
        // alert("client hs finished");
        // client.setEncrypted(
        //   hs.clientToServerKey,
        //   hs.clientNonce,
        //   hs.serverToClientKey,
        //   hs.serverNonce,
        //   hs.peerLongtermPk
        // );
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
        }
        // alert(`closed ${address}`);
      });

      _client.connect();
    });
  }

  async getClientFromAddress(address, attempt = 0) {
    let client = this._clients.get(address);
    if (client && !client.isClosed) {
      return client;
    }

    client = await this.createClient(address);
    this._clients.set(address, client);
    return client;
  }

  getAddresses() {
    return Array.from(this._addresses).concat([this._host]);
  }

  async getClient() {
    const addresses = this.getAddresses();

    this._job = this._job.then(() =>
      Promise.race(
        addresses.map((a) =>
          this.getClientFromAddress(a).catch(
            (e) => new Promise((r) => setTimeout(r, 100000))
          )
        )
      )
    );

    return this._job;
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

export default class PocketClient {
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
    const packet = encode({ reqObj, reqInit }, pbody);
    // alert("get client");
    console.log("encodedPacket");
    // alert(`fetching ${reqObj}`);
    const client = await this._clientManager.getClient();
    // alert(`fetching from ${client.address}`);
    console.log("pocketfetch3", client);
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
    console.log("uuid?", uuid);
    // let eventEmitter = client.send(uuid, packet, xhr.timeout || 60000, true);
    console.log("pocketFetch4", eventEmitter, eventEmitter.msgId);

    if (eventEmitter) {
      eventEmitter = eventEmitter.eventEmitter;
      const chunks = [];
      let clen = 0;
      do {
        const chunk = await once(eventEmitter, "reply");
        console.log("chunk", uuid, chunk);
        chunks.push(Buffer.from(chunk.data));
        clen = chunk.data.length;
      } while (clen > 0);
      console.log("concat reply", chunks);
      const reply = Buffer.concat(chunks);
      this._lastAddress = client.address;
      const resp = decode(reply);
      const { lan, wan } = resp.json;
      this.handleAddresses({ lan, wan });
      console.log("resp.json", resp.body, resp.json.res);
      resp.json.res.headers = new Headers(resp.json.res.headers);
      // alert("complete");
      return new Response(resp.body, resp.json.res);
    } else {
      return Promise.reject("got no eventEmitter");
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
    const self = this;
    const _send = XMLHttpRequest.prototype.send;
    const _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._method = method;
      this._url = url;
      return _open.bind(this)(method, url);
    };
    XMLHttpRequest.prototype.send = async function (body) {
      console.log("xhr.send", this);
      const url = this._url;
      const method = this._method;
      const init = { method };
      if (body) init.body = body;
      const res = await fetch(url, init, this).catch((e) => {
        console.log("fetch error", e);
      });
      console.log("got res", res);
      const text = await res.text();

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
    };
  }
}
