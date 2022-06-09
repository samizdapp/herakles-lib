import RatchetProxy from "../src/proxy";
import Storage from "../src/storage.node";
import Client from "../src/client";
import "cross-fetch/polyfill";
import fetchIntercept from "fetch-intercept";
// import { fetchInterceptor } from "es-fetch-interceptor";

async function main() {
  const client = new Client(
    {
      id: 100,
      host: "localhost:3000",
      namespace: "client_test",
    },
    Storage
  );
  const p = new RatchetProxy(53);
  p.listen();

  console.log("PATCH FETCH", fetchIntercept);
  client.patchFetch(fetchIntercept, fetch);

  const res = await fetch("http://localhost/setup/chrome").catch((e) => {
    console.log(e);
  });
  const body = await res.text();

  console.log("got body", body.toString("utf-8"));
}

main();
