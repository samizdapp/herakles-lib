import PocketProxy from "../src/pocket_proxy";
import PocketClient from "../src/pocket_client";
import Storage from "../src/storage.node";
import "cross-fetch/polyfill";

async function main() {
  const p = new PocketProxy(53);
  const client = new PocketClient(
    {
      id: 100,
      host: "localhost",
      port: 3001,
      namespace: "client_test",
    },
    Storage
  );

  await client.init();

  const res = await fetch("http://localhost/setup/chrome").catch((e) => {
    console.log(e);
  });
  const body = await res.text();

  console.log("got body", body.toString("utf-8"));
}

main();
