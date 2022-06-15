import Client from "./pocket_client";
window.setImmediate = (fn) => setTimeout(fn, 0);

async function patchFetch(host, port) {
  const client = new Client({ host, port }, ({ lan, wan }) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lan, wan }));
    }
  });

  await client.init();

  client.patchFetchBrowser();
}

patchFetch(window.location.host, 3000);
