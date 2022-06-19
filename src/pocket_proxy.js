import { decode, encode } from "lob-enc";
import { WSServer, WSClient, Client } from "pocket-sockets";
import {
  HandshakeAsServer,
  Messaging,
  init,
  genKeyPair,
  once,
} from "pocket-messaging";
import fetch from "cross-fetch";
import getExternalIpCB from "external-ip";

const CHUNK_SIZE = 65535;

const ipGetter = getExternalIpCB();

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

export default class PocketProxy {
  constructor({ host = "0.0.0.0", port = 3000, lan = "127.0.0.1" }) {
    this._lan = lan;
    this._pending = new Map();
    this._server = new WSServer({
      host,
      port,
    });

    this._server.onConnection(async (client) => {
      let messaging = new Messaging(client);

      messaging.open();

      const eventEmitter = messaging.getEventEmitter();
      const evt = await once(eventEmitter, "route");
      // if (evt.target !== "handshake") {
      //   throw new Error("expected handshake");
      // }

      // const dis = `${Math.random()}`;

      // console.log("init handshake", this.keyPairServer, dis);
      // messaging.send(evt.fromMsgId, this.keyPairServer.publicKey);
      // messaging.send(evt.fromMsgId, Buffer.from(dis));

      // console.log("sent key and dis");
      // const hs = await HandshakeAsServer(
      //   client,
      //   this.keyPairServer.secretKey,
      //   this.keyPairServer.publicKey,
      //   Buffer.from(dis)
      // ).catch((e) => {
      //   console.log(e);
      //   process.exit(1);
      // });

      // console.log("finish server handshake");

      // console.log("hs res", hs);

      // messaging.setEncrypted(
      //   hs.clientToServerKey,
      //   hs.clientNonce,
      //   hs.serverToClientKey,
      //   hs.serverNonce,
      //   hs.peerLongtermPk
      // );

      eventEmitter.on("route", (event) => {
        console.log("got route event?", event);
        this.handleEvent(messaging, event).catch((e) => {
          console.log(e);
        });
      });
    });

    this._server.listen();
  }

  async init() {
    await init();
    this.keyPairServer = await genKeyPair();
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
    } = decode(Buffer.concat(chunks));
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
    const fres = await fetch(reqObj, reqInit);
    const resb = await fres.arrayBuffer();
    const res = getResponseJSON(fres);
    const forward = encode({ res, lan, wan }, Buffer.from(resb));
    console.log("got forward", res, forward.length);
    let i = 0;
    for (; i < Math.floor(forward.length / CHUNK_SIZE); i++) {
      messaging.send(
        event.fromMsgId,
        forward.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    console.log("i max", i, Math.ceil(forward.length / CHUNK_SIZE));
    messaging.send(event.fromMsgId, forward.slice(i * CHUNK_SIZE));
    messaging.send(event.fromMsgId, Buffer.from(""));
  }
}
