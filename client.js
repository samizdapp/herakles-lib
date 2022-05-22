const { request } = require("http");
const keytar = require("keytar");
const DKeyRatchet = require("2key-ratchet");
const lob = require("lob-enc");
const {
  getBody,
  encodeCipher,
  decodeCipher,
  decodeIdentity,
  encodeRemote,
} = require("./util");
const { Crypto } = require("@peculiar/webcrypto");
const { getIdentity, saveCipher, watchCipher } = require("./server");

const { Convert } = require("pvtsutils");
const {
  AsymmetricRatchet,
  MessageSignedProtocol,
  Identity,
  setEngine,
  PreKeyBundleProtocol,
} = DKeyRatchet;

async function getStoredSession(idstr, identity) {
  console.log("get stored", idstr);
  const currentSession = await keytar.getPassword(
    "client_session_index",
    idstr
  );
  if (!currentSession) return null; //throw new Error("couldnt get from index");

  const currentCipherEncoded = await keytar.getPassword(
    "client_session",
    currentSession
  );
  if (!currentCipherEncoded) return null; //throw new Error("couldnt get encoded");

  const remoteEncoded = await keytar.getPassword(
    "client_remote",
    currentSession
  );

  if (!remoteEncoded) return null;

  const remote = await decodeIdentity(remoteEncoded, true);
  console.log("b64 cipher?", currentCipherEncoded);
  const { cipher } = await decodeCipher(
    identity,
    remote,
    currentCipherEncoded
  ).catch((e) => {
    console.log(e);
    return null;
  });

  if (!cipher) throw new Error("couldnt decode");

  console.log("decoded cipher", cipher);

  await watchCipher("client_session", currentSession, cipher);

  return cipher;
}

async function getSession(identity) {
  const idstr = `${identity.id}`;
  const stored = await getStoredSession(idstr, identity);
  return stored || getNewSession(idstr);
}

async function getNewSession(idstr) {
  return new Promise((resolve, reject) => {
    const req = request("http://localhost:3000", async (res) => {
      // console.log("err",err,res)
      try {
        const sessionID = res.headers["x-ratchet-session"];
        const data = await getBody(res);
        const protocol = await PreKeyBundleProtocol.importProto(data);
        const identity = await getIdentity(idstr);
        const cipher = await AsymmetricRatchet.create(identity, protocol, {
          exportableKeys: true,
        });
        await watchCipher("client_session", sessionID, cipher);
        await keytar.setPassword("client_session_index", idstr, sessionID);

        const json = { remote_request: true };
        const body = await encodeRemote(identity);

        const packet = lob.encode(json, body);
        const sendProto = await cipher.encrypt(packet);
        const buf = await sendProto.exportProto();

        console.log("client encrypted", Convert.ToHex(buf));
        const r = request(
          "http://localhost:3000",
          {
            method: "POST",
            headers: {
              "X-Ratchet-Session": sessionID,
            },
          },
          async (res) => {
            try {
              const data = await getBody(res);

              const message = await MessageSignedProtocol.importProto(data);
              const payload = await cipher.decrypt(message);
              const { json, body } = lob.decode(Buffer.from(payload));

              console.log("data", json, body.toString("base64"));
              const remote = await decodeIdentity(
                body.toString("base64"),
                true
              );

              await keytar.setPassword(
                "client_remote",
                sessionID,
                body.toString("base64")
              );
              console.log("got remote", remote);

              console.log(JSON.stringify(json, null, 2));
              console.log(body.toString("utf-8"));
            } catch (e) {
              console.error("failed to validate first message response");
              reject(e);
            }

            resolve(cipher);
          }
        );

        r.write(Buffer.from(buf), () => {
          r.end();
        });
      } catch (e) {
        reject(e);
      }
    });

    req.on("error", reject);

    req.end();
  });
}

async function makeRequest(url, cipher, id) {
  const json = {
    method: "GET",
    url,
  };

  const payload = lob.encode(json);
  const sendProto = await cipher.encrypt(payload);
  const buf = await sendProto.exportProto();
  const currentSession = await keytar.getPassword(
    "client_session_index",
    `${id}`
  );

  return new Promise((r) => {
    const req = request(
      "http://localhost:3000",
      {
        method: "POST",
        headers: {
          "X-Ratchet-Session": currentSession,
        },
      },
      async (res) => {
        const data = await getBody(res);
        const message = await MessageSignedProtocol.importProto(data);
        const payload = await cipher.decrypt(message);
        const { json, body } = lob.decode(Buffer.from(payload));
        console.log(json, await body.toString("utf-8"));
        r();
      }
    );

    req.write(Buffer.from(buf), () => req.end());
  });
}

async function main() {
  const id = process.argv[2] ? Number.parseInt(process.argv[2]) : 10;
  console.log("id?", id);
  const crypto = new Crypto();

  DKeyRatchet.setEngine("@peculiar/webcrypto", crypto);
  const identity = await getIdentity(id);
  const cipher = await getSession(identity);
  console.log("got session correctly", cipher);
  // return;
  const res = await makeRequest("http://localhost", cipher, id);
}

main();
