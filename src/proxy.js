import { decode, encode } from "lob-enc";
import { createServer, request } from "node:http";
import Ratchet from "./ratchet";
import Storage from "./storage.node";
import { Crypto, CryptoKey } from "@peculiar/webcrypto";
import fetch from "cross-fetch";

export default class RatchetProxy {
  constructor(id) {
    Ratchet.useCrypto(Crypto, CryptoKey);
    this._ratchet = new Ratchet(Storage, { id });
    this._server = createServer(this.listener.bind(this));
  }

  _isBundleRequest(req) {
    return req.method === "GET";
  }

  async _handleBundleRequest(res) {
    const bundle = await this._ratchet.getBundle();
    res.writeHead(200);
    return new Promise((resolve, reject) => {
      res.write(Buffer.from(bundle), (err) => {
        if (err) return reject(err);
        res.end();
        resolve();
      });
    });
  }

  async listener(req, res) {
    if (this._isBundleRequest(req)) {
      return this._handleBundleRequest(res);
    }
    // else if (this._isPathRequest(req)) {
    //   return this._handlePathRequest(res)
    // }
    const buffer = await this._getBody(req);
    const rd = await this._ratchet.getIDFromMessage(buffer);
    const packet = await this._ratchet.decrypt(buffer);
    let {
      json: { reqObj, reqInit },
      body,
    } = decode(Buffer.from(packet));
    if (typeof reqObj === "string" && !reqObj.startsWith("http:")) {
      reqObj = `http://daemon_caddy${reqObj}`;
    }
    console.log("url?", reqObj, reqInit);
    // reqObj.body = body;

    const fres = await fetch(reqObj, reqInit);
    const resb = await fres.arrayBuffer();
    const forward = encode(fres, Buffer.from(resb));
    const message = await this._ratchet.encrypt(rd, forward);
    res.writeHead(200);
    res.end(Buffer.from(message));
  }

  listen(port = 3000) {
    this._server.listen(port);
  }

  async _getBody(req) {
    const buffers = [];

    for await (const chunk of req) {
      buffers.push(chunk);
    }

    return Buffer.concat(buffers);
  }
}
