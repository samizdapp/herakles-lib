import Client from "./pocket_client";
window.setImmediate = (fn) => setTimeout(fn, 0);

async function patchFetch(host, port) {
  if (window._patch_fetch_client) {
    window._patch_fetch_client.abort();
  }
  window._patch_fetch_client = new Client({ host, port }, ({ lan, wan }) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lan, wan }));
    }
  });
  await window._patch_fetch_client.init();
  window._patch_fetch_client.patchFetchBrowser();
}

patchFetch(window.location.hostname, 4000);
