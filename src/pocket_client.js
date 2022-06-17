import { encode, decode } from "lob-enc";
import { WSClient } from "pocket-sockets";
import { Messaging, once } from "pocket-messaging";

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
    // if (client) {
    //   return client;
    // }

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

  async pocketFetch(reqObj, reqInit = {}) {
    if (reqObj.indexOf(".wasm") > 0) {
      return this._fetch(reqObj, reqInit);
    }
    // alert("alert " + reqObj);
    // this._job = this._job.then(async () => {
    console.log("pocketFetch", reqObj, reqInit);
    const patched = this.patchFetchArgs(reqObj, reqInit);
    reqObj = patched.reqObj;
    reqInit = patched.reqInit;
    console.log("pocketFetch2", reqObj, reqInit);
    const body = reqObj.body || reqInit.body;
    delete reqObj.body;
    delete reqInit.body;
    const pbody = body ? Buffer.from(body) : undefined;
    const packet = encode({ reqObj, reqInit }, pbody);
    // alert("get client");
    console.log("encodedPacket");
    // alert(`fetching ${reqObj}`);
    const client = await this._clientManager.getClient();
    // alert(`fetching from ${client.address}`);
    console.log("pocketfetch3", client);
    let eventEmitter = client.send("ping", packet, 10000, true);
    console.log("pocketFetch4", eventEmitter);

    if (eventEmitter) {
      eventEmitter = eventEmitter.eventEmitter;
      let reply;
      reply = await once(eventEmitter, "reply");
      this._lastAddress = client.address;
      const resp = decode(reply.data);
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
    // XMLHttpRequest.prototype.open = function (method, _url) {
    //   const url = new URL(_url);
    //   url.hostname = self._lastAddress;
    //   url.port = 3001;
    //   url.protocol = "http:";
    //   _open.bind(this)(method, url.toString());
    // };
    XMLHttpRequest.prototype.send = async function (body) {
      const parts = this.id.split(" ");
      const url = parts.pop();
      if (url.indexOf(".wasm") > 0) {
        return _send.bind(this)(body);
      }
      const method = parts.pop();
      const init = { method };
      if (body) init.body = body;
      const res = await fetch(url, init).catch((e) => {
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
