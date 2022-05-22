const keytar = require("keytar");
const DKeyRatchet = require("2key-ratchet");
const { CryptoKey, Crypto, Secret } = require("@peculiar/webcrypto");
const { traverse } = require("object-traversal");
const jsonDiff = require("json-diff");

// we override these functions so that we can store cipher keys across restarts

// static importHMAC(raw) {
//     return getEngine().crypto.subtle
//         .importKey("raw", raw, { name: HMAC_NAME, hash: { name: HASH_NAME } }, false, ["sign", "verify"]);
// }
// static importAES(raw) {
//     return getEngine().crypto.subtle.importKey("raw", raw, AES_ALGORITHM, false, ["encrypt", "decrypt"]);
// }

// copy/pasted from definition in 2Key-ratched
const AES_ALGORITHM = { name: "AES-CBC", length: 256 };
const HASH_NAME = "SHA-256";
const HMAC_NAME = "HMAC";

DKeyRatchet.Secret.importHMAC = (raw) => {
  return DKeyRatchet.getEngine().crypto.subtle.importKey(
    "raw",
    raw,
    { name: HMAC_NAME, hash: { name: HASH_NAME } },
    true,
    ["sign", "verify"]
  );
};

DKeyRatchet.Secret.importAES = (raw) => {
  return DKeyRatchet.getEngine().crypto.subtle.importKey(
    "raw",
    raw,
    AES_ALGORITHM,
    true,
    ["encrypt", "decrypt"]
  );
};

module.exports = {
  encodeCipher,
  decodeCipher,
  getBody,
  encodeIdentity,
  decodeIdentity,
  encodeRemote,
};

const crypto = new Crypto();

async function encodeCipher(cipher, twice = true) {
  const json = await cipher.toJSON();
  json.options = cipher.options;
  json.id = cipher.id;

  await exportKeys(json);
  const b64 = JSONToB64(json);
  if (twice) {
    const { cipher: newCiph } = await decodeCipher(
      cipher.identity,
      cipher.remoteIdentity,
      b64
    );
    const b642 = await encodeCipher(newCiph, false);

    console.log("compare encoded ciphers ^^^", b64 === b642);

    const rawOrig = JSON.parse(JSON.stringify(cipher));
    const rawExported = JSON.parse(JSON.stringify(newCiph));
    console.log("diff?", jsonDiff.diffString(rawOrig, rawExported));
  }
  return b64;
}

async function decodeCipher(identity, remote, b64) {
  const json = b64ToJSON(b64);
  await importKeys(json);
  const cipher = await DKeyRatchet.AsymmetricRatchet.fromJSON(
    identity,
    remote,
    json
  );
  cipher.options = json.options;
  cipher.id = json.id;
  return { cipher };
}

async function encodeIdentity(identity) {
  const json = await identity.toJSON();
  // console.log("2JSON", json);
  json.id = identity.id;
  await exportKeys(json);
  const b64 = JSONToB64(json);
  return b64;
}

async function decodeIdentity(b64, remote = false) {
  const json = b64ToJSON(b64);
  if (remote) {
    // console.log("decoding remote", json);
  }
  await importKeys(json);
  const identity = remote
    ? await DKeyRatchet.RemoteIdentity.fromJSON(json)
    : await DKeyRatchet.Identity.fromJSON(json);
  identity.id = json.id;
  return identity;
}

const getFormatFromAlg = ({ name }) =>
  ["ECDH", "ECDSA"].includes(name) ? "jwk" : "raw";

async function exportKeys(json) {
  const proms = [];
  function inPlace({ parent, key, value, meta }) {
    if (value instanceof CryptoKey) {
      proms.push(
        (async function exportKey() {
          const format = getFormatFromAlg(value.algorithm);
          // console.log("key", value.algorithm, format);
          const exported = await crypto.subtle
            .exportKey(format, value)
            .catch((e) => {
              console.log("caught export error", e);
              console.log("key", value.algorithm, format, value, meta);
              process.exit(1);
            });

          const string =
            format === "raw"
              ? Buffer.from(exported).toString("base64")
              : Buffer.from(JSON.stringify(exported)).toString("base64");
          // console.log("exported", parent[key]);
          parent[key] = JSON.parse(JSON.stringify(value));
          parent[key].exported = string;
          // console.log("exported.pos", parent[key]);
        })()
      );
    } else if (key === "serialized" || key === "signature") {
      proms.push(
        (async function reserialize() {
          const str = Buffer.from(value).toString("base64");
          console.log("stringified buffer", str);
          parent[key] = str;
        })()
      );
    } else if (key === "keys") {
      proms.push(
        (async function reserializeArray() {
          return Promise.all(
            parent[key].map((a) => Buffer.from(a).toString("base64"))
          ).then((newArray) => (parent[key] = newArray));
        })()
      );
    }
  }
  traverse(json, inPlace);
  return Promise.all(proms);
}

async function importKeys(json) {
  const proms = [];
  function inPlace({ parent, key, value, meta }) {
    if (value.exported) {
      proms.push(
        (async function importKey() {
          const format = getFormatFromAlg(value.algorithm);
          // console.log("importing", format);
          const buf = Buffer.from(value.exported, "base64");
          const toImport = format === "raw" ? buf : JSON.parse(buf.toString());
          // console.log("key", toImport, format);
          const imported = await crypto.subtle
            .importKey(
              format,
              toImport,
              value.algorithm,
              value.extractable,
              value.usages
            )
            .catch((e) => {
              console.log("caught import error", e);
              console.log("key", value.algorithm, format);
              process.exit(1);
            });
          // console.log("parent.key", parent[key]);
          parent[key] = imported;
          // console.log("parent.key.pos", parent[key]);
        })()
      );
    } else if (key === "serialized" || key === "signature") {
      proms.push(
        (async function reserialize() {
          console.log("SERIALIZE");
          const buf = Buffer.from(value, "base64");
          console.log("BUFFER", buf);
          parent[key] = buf;
        })()
      );
    } else if (key === "keys") {
      proms.push(
        (async function reserializeArray() {
          return Promise.all(
            parent[key].map((a) => Buffer.from(a, "base64"))
          ).then((newArray) => (parent[key] = newArray));
        })()
      );
    }
  }
  traverse(json, inPlace);
  return Promise.all(proms);
}

async function getBody(r) {
  const buffers = [];

  for await (const chunk of r) {
    buffers.push(chunk);
  }

  return Buffer.concat(buffers);
}

function b64ToJSON(b64) {
  const string = Buffer.from(b64, "base64").toString("ascii");
  const json = JSON.parse(string);
  return json;
}

function JSONToB64(json) {
  const string = JSON.stringify(json);
  const b64 = Buffer.from(string).toString("base64");
  return b64;
}

async function encodeRemote(identity) {
  const proto = await DKeyRatchet.IdentityProtocol.fill(identity);
  await proto.sign(identity.signingKey.privateKey);
  const remote = await DKeyRatchet.RemoteIdentity.fill(proto);
  console.log("self as remote", remote);
  const encoded = await encodeIdentity(remote);
  console.log("encoded", encoded);
  const body = Buffer.from(encoded, "base64");
  return body;
}
