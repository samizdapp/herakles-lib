import RatchetProxy from "../src/proxy";
import Ratchet from "../src/ratchet";
import Storage from "../src/storage.node";
import { encode, decode } from "lob-enc";
import fetch from "node-fetch";

async function main() {
  const clientRatchet = new Ratchet(Storage, { id: 19 });
  const p = new RatchetProxy(20);

  p.listen();

  return;
  let res = await fetch("http://localhost:3000", {
    method: "GET",
  });
  let buffer = await res.arrayBuffer();

  const proxyID = await clientRatchet.consumeBuffer(buffer);

  console.log(proxyID);
  // process.exit(0);
  const request = encode({
    method: "GET",
    url: "/setup/chrome",
  });

  buffer = await clientRatchet.encrypt(proxyID, request);

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
