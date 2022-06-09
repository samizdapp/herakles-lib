import { encode, decode } from "lob-enc";
import { WSClient } from "pocket-sockets";
import { Messaging, once } from "pocket-messaging";

export default class PocketClient {
  constructor(
    { id = 50, host = "localhost", port = 3000, namespace = "client" },
    Storage
  ) {
    this._host = host;
    this._port = port;
  }

  async init() {
    this._patched = false;
    this._client = new WSClient({
      host: this._host,
      port: this._port,
    });
    this._client.connect();

    this._client.onConnect(() => {
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

  async pocketFetch(reqObj, reqInit = {}) {
    console.log("patched fetch", reqObj, reqInit);
    await this.init();

    const packet = encode({ reqObj, reqInit }, reqObj.body || reqInit.body);

    let eventEmitter = this._messaging.send("ping", packet, 10000, true);

    if (eventEmitter) {
      eventEmitter = eventEmitter.eventEmitter;
      const reply = await once(eventEmitter, "reply");
      const resp = decode(reply.data);
      return new Response(resp.body, resp.json);
    } else {
      return Promise.reject("got no eventEmitter");
    }
  }

  async patchFetchBrowser() {
    this._fetch = window.fetch.bind(window);
    window.fetch = this.pocketFetch.bind(this);
  }
}
