import { encode, decode } from "lob-enc";
import Ratchet from "./ratchet";

export default class RatchetClient {
  constructor({ id = 50, host = "localhost", namespace = "client" }, Storage) {
    this._ratchet = new Ratchet(Storage, { id });
    this._host = host;
    this._storage = new Storage(namespace);
    if (global.fetch) {
      this._fetch = global.fetch;
    }
    this._fetchJob = Promise.resolve();
  }

  async getServerID() {
    if (this._serverID) return this._serverID;

    this._serverID = await this._getServerIDFromStorage();
    if (this._serverID) return this._serverID;

    this._serverID = await this._getServerIDFromServer();
    return this._serverID;
  }

  async getServerPaths() {
    if (this._paths) return this._paths;

    this._paths = await this._getServerPathsFromStorage();
    if (this._paths) return this._paths;

    this._paths = await this._getServerIDFromServer();
  }

  async _getServerIDFromStorage() {
    return this._storage.getItem(`serverID`);
  }

  async _getServerPathsFromStorage() {
    return this._storage.getItem("serverPaths");
  }

  async _encryptRequest(options) {
    const packet = encode(options);
    const serverID = await this.getServerID();
    const buffer = await this._racket.encrypt(serverID, packet);
    return buffer;
  }

  async _getServerPathsFromServer() {
    return [];
    const body = await this._encryptRequest({
      url: `http://${this._host}`,
      self: true,
      method: "GET",
    });
    const res = await fetch(`http://${this._host}`, { method: "POST", body });
    const buffer = await res.arrayBuffer();

    const packet = await this._ratchet.decrypt(buffer);
    const response = decode(packet);
    const paths = (this._paths = await JSON.parse(
      response.body.toString("utf-8")
    ));
    await this._storage.setItem("serverPaths", paths);
    return paths;
  }

  async _getServerIDFromServer() {
    console.log("_getServerIDFromServer()", this._host);
    const res = await this._fetch(`http://${this._host}`);
    const buffer = await res.arrayBuffer();

    return this._ratchet.consumeBuffer(buffer);
  }

  async encryptFetch(reqObj, reqInit = {}) {
    const serverID = await this.getServerID();
    const packet = encode({ reqObj, reqInit }, reqObj.body || reqInit.body);
    const buffer = await this._ratchet.encrypt(serverID, packet);
    return Buffer.from(buffer);
  }

  async decryptFetchResponse(buffer) {
    const packet = await this._ratchet.decrypt(buffer);
    const response = decode(Buffer.from(packet));
    return response;
  }

  async _monkeyFetch(reqObj, reqInit) {
    const body = await this.encryptFetch(reqObj, reqInit);

    const res = await fetch({
      method: "POST",
      url: `http://${this._host}`,
      body,
    });

    const buffer = await res.arrayBuffer();

    const response = await this.decryptFetchResponse(Buffer.from(buffer));
    return response;
  }

  async patchFetch() {
    global.fetch = async (reqObj, reqInit) => {
      console.log("patched fetch", reqObj, reqInit);
      const body = await this.encryptFetch(reqObj, reqInit);
      const config = {
        method: "POST",
        body,
      };
      const outer = await this._fetch(`http://${this._host}`, config);
      const outerb = await outer.arrayBuffer();
      const innerb = await this.decryptFetchResponse(Buffer.from(outerb));
      const resp = decode(Buffer.from(innerb));
      console.log("decrypted response", resp);
      return new Response(resp.body, resp.json);
    };
  }

  async patchFetchBrowser() {
    this._fetch = window.fetch.bind(window);
    window.fetch = async (reqObj, reqInit) => {
      console.log("patched fetch", reqObj, reqInit);
      this._fetchJob = this._fetchJob.then(async () => {
        const body = await this.encryptFetch(reqObj, reqInit);
        const config = {
          method: "POST",
          body,
        };
        const outer = await this._fetch(`http://${this._host}`, config);
        const outerb = await outer.arrayBuffer();
        const innerb = await this.decryptFetchResponse(Buffer.from(outerb));
        const resp = decode(Buffer.from(innerb));
        console.log("decrypted response", resp);
        return new Response(resp.body, resp.json);
      });

      return this._fetchJob;
    };
  }
}
