import { decode, encode } from "lob-enc";
import { WSServer, WSClient, Client } from "pocket-sockets";
import { Messaging, once } from "pocket-messaging";
import fetch from "cross-fetch";

export default class PocketProxy {
  constructor(host = "0.0.0.0", port = 3000) {
    this._server = new WSServer({
      host,
      port,
    });

    this._server.onConnection(async (client) => {
      let messaging = new Messaging(client);
      messaging.open();

      const eventEmitter = messaging.getEventEmitter();
      while (true) {
        const event = await once(eventEmitter, "route");
        let {
          json: { reqObj, reqInit },
          body,
        } = decode(event.data);
        if (typeof reqObj === "string" && !reqObj.startsWith("http:")) {
          reqObj = `http://daemon_caddy${reqObj}`;
        }
        console.log("url?", reqObj, reqInit);

        const fres = await fetch(reqObj, reqInit);
        const resb = await fres.arrayBuffer();
        const forward = encode(fres, Buffer.from(resb));
        console.log("got forward", forward);
        const eventEmitterSend = messaging.send(event.fromMsgId, forward);
      }
    });

    this._server.listen();
  }
}
