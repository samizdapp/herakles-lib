import Storage from "./storage.expo";
import Client from "./client";
import Ratchet from "./ratchet";
import { CryptoKey, Crypto } from "@peculiar/webcrypto";

export async function patchFetch() {
  Ratchet.useCrypto(Crypto, CryptoKey);
  const client = new Client(
    {
      id: 100,
      host: "localhost:3000",
      namespace: "client_test",
    },
    Storage
  );
  client.patchFetch();
}

export async function onMessage(args, webview, host) {
  const client = new Client(
    {
      id: 100,
      host,
      namespace: "client_test",
    },
    Storage
  );

  const body = await client.encryptFetch(args[0], args[1]);
  const config = {
    method: "POST",
    body,
  };
  const outer = await fetch(`http://${host}`, config);
  const outerb = await outer.arrayBuffer();
  const innerb = await client.decryptFetchResponse(Buffer.from(outerb));
  const resp = decode(Buffer.from(innerb));
  console.log("decrypted response", resp);

  webview.injectJavaScript(
    `window.postMessage(\`${JSON.stringify({
      options: resp.json,
      body: Buffer.from(resp.body).toString("base64"),
    })}\`);true;`
  );
}
