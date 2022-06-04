import RatchetProxy from "../src/proxy";
import Ratchet from "../src/ratchet";
import Storage from "../src/storage.node";
import { encode, decode } from "lob-enc";
import fetch from "node-fetch";

async function main() {
  const clientRatchet = new Ratchet(Storage, { id: 19 });
  const p = new RatchetProxy(20);

  p.listen();

  // let res = await fetch("http://localhost:3000", {
  //   method: "GET",
  // });
  // let buffer = await res.arrayBuffer();
  let res;
  const proxyID =
    "a9527eae0571b78db185f0c65919800b74055710e48ec328cf21f2b99bbbf73c";

  console.log(proxyID);
  // process.exit(0);
  const request = encode({
    method: "GET",
    url: "/setup/chrome",
  });

  let buffer = await clientRatchet.encrypt(proxyID, request);

  res = await fetch("http://localhost:3000", {
    method: "POST",
    body: buffer,
  });

  buffer = await res.arrayBuffer();
  const payload = await clientRatchet.decrypt(buffer);
  const { body } = decode(Buffer.from(payload));

  console.log("got proxy body", body.toString("utf-8"));
}

main();
