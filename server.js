const { createServer, request } = require("http");
const keytar = require("keytar");
const DKeyRatchet = require("2key-ratchet");
const lob = require("lob-enc");
const {
  encodeCipher,
  decodeCipher,
  getBody,
  encodeIdentity,
  decodeIdentity,
} = require("./util.js");
const { Crypto } = require("@peculiar/webcrypto");
const SERVER_SESSION = "server_session";
module.exports = { getIdentity, saveCipher, watchCipher, getServerIdentity };

const { AsymmetricRatchet, RemoteIdentity } = DKeyRatchet;

const cipherMap = new Map();
let serverIdentity, serverBundle;

async function main() {
  createServer(async (req, res) => {
    const session = req.headers["x-ratchet-session"];
    if (!session) {
      // console.log("no session, starting");
      // throw new Error("no new sessions");
      return startSession(req, res);
    }

    //console.log("got payload");
    const payload = await getPayload(session, req);

    const {
      json: { remote_request, url, method, headers },
      body,
    } = lob.decode(Buffer.from(payload));

    if (remote_request) {
      return respondRemoteRequest(session, body, req, res);
    }

    const urlObject = new URL(url);

    urlObject.host = "localhost";

    //console.log("forwarding", urlObject, method, headers, body);

    const pReq = request(
      urlObject.href,
      {
        method: method,
        headers,
        port: 80,
        ...urlObject,
      },
      async (pRes) => {
        //console.log("got proxy response");
        const headers = pRes.headers;
        const body = await getBody(pRes);

        const { statusCode, statusMessage } = pRes;

        const json = { statusCode, statusMessage, headers };

        const payload = lob.encode(json, body);
        //console.log("payload", session);
        const message = await getMessage(session, req, payload);
        // //console.log('message', message)
        res.writeHead(200);
        res.end(message);
      }
    );

    if (body.length > 0) {
      pReq.write(body, (err) => {
        pReq.end();
      });
    } else {
      pReq.end();
    }
  }).listen(process.env.LISTEN_PORT || 3000, () => {
    const crypto = new Crypto({});
    DKeyRatchet.setEngine("@peculiar/webcrypto", crypto);
  });
}

async function startSession(_req, res) {
  const id = 1;
  const identity = await getServerIdentity(id);
  const bundle = await getBundle(id, identity);
  const buf = await bundle.exportProto();

  const sessions = await keytar.findCredentials(SERVER_SESSION);
  const sessionID = `${sessions.length + 1}`;
  await keytar.setPassword(SERVER_SESSION, sessionID, "init");

  res.writeHead(200, "created", {
    [`X-Ratchet-Session`]: sessionID,
  });
  res.end(Buffer.from(buf));
}

async function getPayload(sessionID, req) {
  const { cipher, ...rest } = await getCipher(sessionID, req);
  console.log("GOT CIPHER IN PAYLOAD", rest.message);
  const message =
    rest.message ||
    (await DKeyRatchet.MessageSignedProtocol.importProto(await getBody(req)));
  //console.log("message", cipher);
  const payload = await cipher.decrypt(message);
  await saveCipher(SERVER_SESSION, sessionID, cipher);
  //console.log("decrypted payload", payload);
  return payload;
}

async function respondRemoteRequest(session, encodedClient, req, res) {
  const identity = await getServerIdentity();
  await keytar.setPassword(
    "server_remote",
    session,
    encodedClient.toString("base64")
  );
  // //console.log("server ident?", identity);
  const proto = await DKeyRatchet.IdentityProtocol.fill(identity);
  await proto.sign(identity.signingKey.privateKey);
  const remote = await RemoteIdentity.fill(proto);
  //console.log("self as remote", remote);
  const encoded = await encodeIdentity(remote);
  //console.log("encoded", encoded);
  const body = Buffer.from(encoded, "base64");
  const json = { respond_remote: true };
  const payload = lob.encode(json, body);
  const message = await getMessage(session, req, payload);
  res.writeHead(200);
  res.end(message);
}

async function getMessage(sessionID, req, payload) {
  const { cipher } = await getCipher(sessionID, req);
  const protocol = await cipher.encrypt(payload);
  await saveCipher(SERVER_SESSION, sessionID, cipher);
  const message = await protocol.exportProto();
  return Buffer.from(message);
}

async function getBundle(id, identity) {
  if (serverBundle) return serverBundle;

  const preKey = identity.signedPreKeys[0];
  bundle = new DKeyRatchet.PreKeyBundleProtocol();
  bundle.registrationId = id;
  //console.log("ident?", identity);
  await bundle.identity.fill(identity);
  bundle.preKeySigned.id = 0;
  bundle.preKeySigned.key = preKey.publicKey;
  await bundle.preKeySigned.sign(identity.signingKey.privateKey);
  serverBundle = bundle;

  return bundle;
}

async function getCipher(sessionID, req) {
  //console.log("try from cipher map");
  if (cipherMap.has(sessionID)) return { cipher: cipherMap.get(sessionID) };

  const encodedCipher = await keytar.getPassword(SERVER_SESSION, sessionID);
  const identity = await getServerIdentity();
  const remoteEncoded = await keytar.getPassword("server_remote", sessionID);
  //console.log("remoteEncoded", remoteEncoded);

  const { cipher, message } =
    encodedCipher === "init"
      ? await getCipherInit(req)
      : await decodeCipher(
          identity,
          await decodeIdentity(remoteEncoded, true),
          encodedCipher
        );

  //console.log("got cipher", cipher);
  watchCipher(SERVER_SESSION, sessionID, cipher);

  cipherMap.set(sessionID, cipher);

  return { cipher, message };
}

async function getCipherInit(req) {
  const data = await getBody(req);
  const identity = await getServerIdentity();
  const preKeyMessage = await DKeyRatchet.PreKeyMessageProtocol.importProto(
    data
  );
  const message = preKeyMessage.signedMessage;
  const cipher = await AsymmetricRatchet.create(identity, preKeyMessage, {
    exportableKeys: true,
  });
  return { cipher, message };
}

async function getServerIdentity(id) {
  if (serverIdentity) return serverIdentity;
  const identity = await getIdentity(id);
  serverIdentity = identity;
  return identity;
}

async function getIdentity(id) {
  const idstr = `${id}`;
  const stored = await keytar.getPassword("identity", idstr);
  if (stored) {
    return decodeIdentity(stored);
  }

  const identity = await DKeyRatchet.Identity.create(id, 1, 0, true);
  const encoded = await encodeIdentity(identity);
  await keytar.setPassword("identity", idstr, encoded);
  return identity;
}

let saveChain = Promise.resolve();
function saveCipher(service, sessionID, cipher) {
  saveChain = saveChain.then(() => _saveCipher(service, sessionID, cipher));
}

async function _saveCipher(service, sessionID, cipher) {
  console.log("save cipher", service, sessionID);
  const encodedCipher = await encodeCipher(cipher);
  await keytar.setPassword(service, sessionID, encodedCipher);
}

async function watchCipher(service = "server_session", sessionID, cipher) {
  cipher.on("update", async () => {
    await saveCipher(service, sessionID, cipher);
  });
  await saveCipher(service, sessionID, cipher);
}

if (require.main === module) {
  main();
}
