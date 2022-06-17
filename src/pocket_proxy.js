import { decode, encode } from "lob-enc";
import { WSServer, WSClient, Client } from "pocket-sockets";
import { Messaging, once } from "pocket-messaging";
import fetch from "cross-fetch";
import getExternalIpCB from "external-ip";
import getLocalIp from "my-local-ip-is";

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
        // if (event.target === "address") {
        const wan = await getExternalIp();
        console.log("lanwan", lan, wan);
        // }

        let {
          json: { reqObj, reqInit },
          body,
        } = decode(event.data);
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
        console.log("got forward", res);
        const eventEmitterSend = messaging.send(event.fromMsgId, forward);
      }
    });

    this._server.listen();
  }
}
