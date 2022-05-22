const _fetch = window.fetch;
const localforage = window.localStorage;
const broadcast = new BroadcastChannel("address-channel");

function getHostname(request) {
  const url = request.url || request;

  const { hostname } = url.startsWith("http:")
    ? new URL(url)
    : { hostname: window.location.hostname };
  return hostname;
}

function getURL(request) {
  const raw = request.url || request;
  const url = raw.startsWith("http")
    ? raw
    : `http://${window.location.hostname}${raw}`;
  // alert(url)
  return url;
}

async function getAddress(request) {
  const hostname = getHostname(request);
  const bootstrap = hostname.endsWith("localhost")
    ? ["192.168.42.1", "127.0.0.1"]
    : [hostname];
  let addresses = await localforage.getItem("addresses");
  addresses = addresses ? JSON.parse(addresses) : bootstrap;
  // let addresses = bootstrap;
  // alert(JSON.stringify(addresses))
  // do {
  broadcast.postMessage({
    type: "TRY_ADDRESSES",
    nonce: Date.now(),
    addresses,
  });
  const returned = await Promise.race(
    addresses.map((addr, i) => {
      return _fetch(`http://${addr}/api/addresses`, {
        referrerPolicy: "unsafe-url",
      })
        .then((r) => {
          broadcast.postMessage({
            type: "TRIED_ADDRESS",
            nonce: Date.now(),
            addr,
          });
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((json) => {
          // alert(JSON.stringify(json))
          return {
            ...json,
            index: i,
          };
        })
        .catch((e) => {
          broadcast.postMessage({
            type: "TRIED_ADDRESS_ERROR",
            nonce: Date.now(),
            addr,
            error: e.toString(),
          });
          return new Promise((r) => setTimeout(r, 1000));
        });
    })
  );
  if (!returned) {
    alert("none returned");
    return getAddress(request);
  }
  const preferred = addresses[returned?.index || 0];
  broadcast.postMessage({
    type: "PREFERRED_ADDRESS",
    nonce: Date.now(),
    addresses,
    preferred,
  });
  // alert(preferred)
  console.log(returned.addresses, bootstrap.concat([returned.addresses]));
  addresses = returned?.addresses
    ? bootstrap.concat(returned.addresses).map((s) => s.trim())
    : addresses;
  await localforage.setItem("addresses", JSON.stringify(addresses));
  return preferred === "localhost" ? "127.0.0.1" : preferred;
  // } while (true)
}

function shouldHandle(request) {
  // alert(request.url, request.url || request)
  const hostname = getHostname(request);

  return hostname.endsWith(window.location.hostname);
}

async function maybeRedirectFetch(request, options = {}) {
  if (!shouldHandle(request)) {
    return _fetch(request, options);
  }
  const address = await getAddress(request);
  const { hostname, pathname, searchParams } = new URL(getURL(request));
  const _headers = request.headers || options.headers || {};
  const mode = request.mode || options.mode;
  const method = request.method || options.method;
  const keepalive = request.keepalive || options.keepalive;
  const redirect = request.redirect || options.redirect;
  const referrer = request.referrer || options.referrer;
  const referrerPolicy = request.referrerPolicy || options.referrerPolicy;
  const body = request.body || options.body;

  const headerMap = new Map();
  const [subdomain] = hostname.split(".");

  _headers["x-intercepted-subdomain"] = subdomain;
  const headers = _headers;

  const args = {
    headers,
    mode: mode === "navigate" ? undefined : mode,
    method,
    keepalive,
    redirect,
    referrer,
    referrerPolicy,
    body,
    ...options,
  };

  const url = `http://${address}${pathname}${
    searchParams ? `?${searchParams}` : ""
  }`;
  // alert(url)
  return _fetch(url, args);
}

window.fetch = maybeRedirectFetch;
