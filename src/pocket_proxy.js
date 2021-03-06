import { decode, encode } from "lob-enc";
import { WSServer } from "pocket-sockets";
import {
  HandshakeAsServer,
  Messaging,
  init,
  genKeyPair,
} from "pocket-messaging";
import fetch from "cross-fetch";

const CHUNK_SIZE = 65535;

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

export default class PocketProxy {
  constructor({ host = "0.0.0.0", port = 4000, lan = "127.0.0.1", wan }) {
    this._lan = lan;
    this._wan = wan;
    this._pending = new Map();
    this._server = new WSServer({
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
      const hs = await HandshakeAsServer(
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

      let messaging = new Messaging(client);

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
    await init();
    this.keyPairServer = await genKeyPair();
  }

  async handleEvent(messaging, event) {
    console.log("handle event", event.data.length, event.data.byteLength);
    const target = event.target;
    if (target === "ping") {
      console.log("got ping");
      return messaging.send(event.fromMsgId, Buffer.from("pong"));
    }
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
    const wan = this._wan;

    console.log("lanwan", this._lan, this._wan);

    let {
      json: { reqObj, reqInit },
      body,
    } = decode(Buffer.concat(chunks));

    console.log("url?", event, reqObj, reqInit);
    reqInit = reqObj;
    if (
      reqInit.method &&
      reqInit.method !== "HEAD" &&
      reqInit.method !== "GET"
    ) {
      console.log("set body", body ? body.toString() : "");
      reqObj.body = body;
    }
    const fres = await fetch(reqObj.url, reqObj);
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
