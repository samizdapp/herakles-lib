import { encode, decode } from "lob-enc";
import { WSClient } from "pocket-sockets";
import { Messaging, once } from "pocket-messaging";

class ClientManager {
  constructor({ host, port }) {
    this._host = host;
    this._port = port;
    this._addresses = new Set();
    this._clients = new Map();
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
        alert(`resolve ${address}`);
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
        alert(`closed ${address}`);
      });

      _client.connect();
    });
  }

  async getClientFromAddress(address, attempt = 0) {
    let client = this._clients.get(address);
    if (client && client.isOpened && !client.isClosed) {
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

    return Promise.race(
      addresses.map((a) =>
        this.getClientFromAddress(a).catch(
          (e) => new Promise((r) => setTimeout(r, 100000))
        )
      )
    );
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
  }

  async init() {
    this._patched = false;
    this._client = new WSClient({
      host: this._host,
      port: this._port,
    });
    this._client.connect();

    this._client.onConnect(async () => {
      this._messaging = new Messaging(this._client);
      this._messaging.open();
      this.patchFetch();
      this._patched = true;
    });
    this._client.onError(this.init.bind(this));
    this._client.onClose(this.init.bind(this));
    do {
      if (this._patched) return;
    } while (!(await new Promise((r) => setTimeout(r, 100))));
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

  async pocketFetch(reqObj, reqInit = {}) {
    const packet = encode({ reqObj, reqInit }, reqObj.body || reqInit.body);

    alert("get client");
    const client = await this._clientManager.getClient();
    alert(`fetching from ${client.address}`);
    let eventEmitter = client.send("ping", packet, 10000, true);

    if (eventEmitter) {
      eventEmitter = eventEmitter.eventEmitter;
      const reply = await once(eventEmitter, "reply");
      const resp = decode(reply.data);
      const { lan, wan } = resp.json;
      this.handleAddresses({ lan, wan });
      return new Response(resp.body, resp.json.res);
    } else {
      return Promise.reject("got no eventEmitter");
    }
  }

  async patchFetchBrowser() {
    this._fetch = window.fetch.bind(window);
    window.fetch = this.pocketFetch.bind(this);
  }
}
