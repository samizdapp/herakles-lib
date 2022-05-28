import DKeyRatchet from "2key-ratchet";
import { traverse } from "object-traversal";
import { v4 as uuidv4 } from "uuid";
import jsonDiff from "json-diff";

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

let CryptoKey;
const getFormatFromAlg = ({ name }) =>
  ["ECDH", "ECDSA"].includes(name) ? "jwk" : "raw";

class Ratchet {
  static useCrypto(Crypto, _CryptoKey) {
    DKeyRatchet.setEngine("@peculiar/webcrypto", new Crypto());
    CryptoKey = _CryptoKey;
  }

  constructor(
    Storage,
    {
      id = 1,
      signedPreKeyAmount = 1,
      preKeyAmount = 0,
      exportableKeys = true,
    } = {}
  ) {
    this._identityStore = new Storage(`${id}:identity`);
    this._cipherStore = new Storage(`${id}:cipher`);
    this._identity = null;
    this._ciphers = new Map();
    this._remotes = new Map();
    this._options = {
      id,
      signedPreKeyAmount,
      preKeyAmount,
      exportableKeys,
    };
  }

  get id() {
    return this._identity.id;
  }

  async importBundle(bundle) {
    const decoded = await DKeyRatchet.PreKeyBundleProtocol.importProto(bundle);
    const cipher = await DKeyRatchet.AsymmetricRatchet.create(
      this._identity,
      decoded,
      {
        exportableKeys: true,
      }
    );

    return cipher;
  }

  async importMessage(proto) {
    const decoded = await DKeyRatchet.PreKeyMessageProtocol.importProto(proto);
    const cipher = await DKeyRatchet.AsymmetricRatchet.create(
      this._identity,
      decoded,
      {
        exportableKeys: true,
      }
    );

    return cipher;
  }

  async getIdentity() {
    if (this._identity) return this._identity;

    this._identity = await this._getSelfIdentityFromStorage();
    if (this._identity) return this._identity;

    this._identity = await this._createIdentity();
    await this._storeIdentity();
    return this._identity;
  }

  async persistCipher(id, cipher) {
    cipher.on("update", () => this._saveCipher(id, cipher));
    return this._saveCipher(id, cipher);
  }

  async getCipher(cipherID, message) {
    // console.log("GETCipher", cipherID);
    if (this._ciphers.has(cipherID)) return this._ciphers.get(cipherID);

    let cipher = await this._getStoredCipher(cipherID);
    if (!cipher) {
      // process.exit(1);
      cipher = await this._createCipher(message);
    }
    console.log("got or made cipher?", cipher.currentStep);

    await this.persistCipher(cipherID, cipher);
    this._ciphers.set(cipherID, cipher);

    return cipher;
  }

  async _createCipher(message) {
    // console.log("CREATE", message);
    return DKeyRatchet.AsymmetricRatchet.create(
      await this.getIdentity(),
      message,
      {
        exportableKeys: true,
      }
    );
  }

  async getBundle() {
    if (this._bundle) return this._bundle;

    this._bundle = await this._createBundle();
    return this._bundle.exportProto();
  }

  async unpackBuffer(buffer) {
    // console.log("unpack buffer", buffer);
    const message = await DKeyRatchet.MessageSignedProtocol.importProto(buffer)
      .catch((error) => DKeyRatchet.PreKeyMessageProtocol.importProto(buffer))
      .catch((error) => DKeyRatchet.PreKeyBundleProtocol.importProto(buffer));

    // console.log("message", message);
    const id = message.identity?.signingKey?.id || message.senderKey?.id;
    // console.log("message id", id);
    return { message, id };
  }

  async consumeBuffer(buffer) {
    const { message, id } = await this.unpackBuffer(buffer);
    await this.getCipher(id, message);
    return id;
  }

  async encrypt(recipientID, payload) {
    const cipher = await this.getCipher(recipientID);

    // console.log("GOT CIPHER", recipientID);

    const proto = await cipher.encrypt(payload);

    await new Promise((r) =>
      setImmediate(() => {
        this._cipherStore._service._job.then(() => r());
      })
    );
    // console.log("ENCRYPTED");

    return proto.exportProto();
  }

  async getIDFromMessage(buffer) {
    const { message, id } = await this.unpackBuffer(buffer);
    return id;
  }

  async decrypt(buffer) {
    const { message, id } = await this.unpackBuffer(buffer);
    // console.log("unpacked", message, id);
    const cipher = await this.getCipher(id, message);
    // console.log("decrypt got cipher", !!cipher, message.signedMessage);
    const res = cipher.decrypt(message.signedMessage || message);
    await new Promise((r) =>
      setImmediate(() => {
        this._cipherStore._service._job.then(() => r());
      })
    );
    return res;
  }

  async getCipherFromMessage(signID, message) {
    let cipher;

    cipher = this._ciphers.get(signID);
    if (cipher) return cipher;

    cipher = await this.getCipherFromStorage(signID);

    if (cipher) return cipher;

    cipher = await DKeyRatchet.AsymmetricRatchet.create(
      await this.getIdentity(),
      message,
      {
        exportableKeys: true,
      }
    );

    await this.persistCipher(signID, cipher);

    this._ciphers.set(signID, cipher);

    return cipher;
  }

  async remoteIdentity() {
    if (this._remote) return this._remote;
    const proto = await DKeyRatchet.IdentityProtocol.fill(this._identity);
    await proto.sign(this._identity.signingKey.privateKey);
    const remote = await DKeyRatchet.RemoteIdentity.fill(proto);
    this._remote = remote;
    return remote;
  }

  async _getSelfIdentityFromStorage() {
    const raw = await this._identityStore.getItem("self");
    if (!raw) return null;
    const { b64 } = raw;

    return this._decodeSelfIdentity(b64);
  }

  async _decodeSelfIdentity(b64) {
    const json = b64ToJSON(b64);
    await this._importKeys(json);
    const identity = await DKeyRatchet.Identity.fromJSON(json);
    identity.id = json.id;
    return identity;
  }

  async _storeIdentity() {
    const b64 = await this._encodeIdentity();
    await this._identityStore.setItem("self", { b64 });
  }

  async _decodeRemoteIdentity(b64) {
    const json = b64ToJSON(b64);
    await this._importKeys(json);
    const identity = await DKeyRatchet.RemoteIdentity.fromJSON(json);
    identity.id = json.id;
    return identity;
  }

  async _encodeIdentity(identity) {
    identity = identity ? identity : this._identity;
    const json = await identity.toJSON();
    json.id = identity.id;
    await this._exportKeys(json);
    const b64 = JSONToB64(json);
    return b64;
  }

  async _createIdentity() {
    return DKeyRatchet.Identity.create(
      this._options.id,
      this._options.signedPreKeyAmount,
      this._options.preKeyAmount,
      this._options.exportableKeys
    );
  }

  async _createBundle() {
    const identity = await this.getIdentity();

    const bundle = new DKeyRatchet.PreKeyBundleProtocol();
    bundle.registrationId = identity.id;
    await bundle.identity.fill(identity);
    const preKey = identity.signedPreKeys[0];
    bundle.preKeySigned.id = 0;
    bundle.preKeySigned.key = preKey.publicKey;
    await bundle.preKeySigned.sign(identity.signingKey.privateKey);
    return bundle;
  }

  async _getStoredCipher(cipherID) {
    // console.log("_getStoredCipher", cipherID);
    const raw = await this._cipherStore.getItem(cipherID);
    if (!raw) return null;

    const { b64 } = raw;
    const identity = await this.getIdentity();
    const remote = await this.getRemote(cipherID);
    // console.log("decoding cipher", !!identity, !!remote, !!b64);
    return this._decodeCipher(identity, remote, b64);
  }

  async _saveCipher(cipherID, cipher, invoke = Date.now()) {
    const b64 = await this._encodeCipher(cipher);
    console.log("saveCipher", invoke, cipher.steps);

    await this._cipherStore.setItem(cipherID, { b64 });
    await this._storeRemote(cipherID, cipher);
  }

  async _storeRemote(id, { remoteIdentity }) {
    // console.log("SET STORED", id);
    const b64 = await this._encodeIdentity(remoteIdentity);
    await this._identityStore.setItem(id, { b64 });
  }

  async getRemote(signID) {
    if (this._remotes.has(signID)) return this._remotes.get(signID);

    const remote = await this._getStoredRemote(signID);
    // console.log("REMOTE?", remote);
    if (!remote) return null;

    this._remotes.set(signID, remote);
    return remote;
  }

  async _getStoredRemote(cipherID) {
    // console.log("GET STORED", cipherID);
    const raw = await this._identityStore.getItem(cipherID);
    if (!raw) return null;
    const { b64 } = raw;

    const json = b64ToJSON(b64);
    await this._importKeys(json);

    const remote = await DKeyRatchet.RemoteIdentity.fromJSON(json);
    remote.id = json.id;
    return remote;
  }
  async _exportKeys(json) {
    const proms = [];
    const inPlace = ({ parent, key, value, meta }) => {
      if (value instanceof CryptoKey) {
        proms.push(
          (async function exportKey() {
            const format = getFormatFromAlg(value.algorithm);
            // console.log("key", value.algorithm, format);
            const engine = DKeyRatchet.getEngine();
            // console.log("engine", engine);
            const exported = await engine.crypto.subtle
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
            // console.log("stringified buffer", str);
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
    };
    traverse(json, inPlace);
    return Promise.all(proms);
  }

  async _importKeys(json) {
    const proms = [];
    const inPlace = ({ parent, key, value, meta }) => {
      if (value.exported) {
        proms.push(
          (async function importKey() {
            const format = getFormatFromAlg(value.algorithm);
            // console.log("importing", format);
            const buf = Buffer.from(value.exported, "base64");
            const toImport =
              format === "raw" ? buf : JSON.parse(buf.toString());
            // console.log("key", toImport, format);
            const engine = await DKeyRatchet.getEngine();
            const imported = await engine.crypto.subtle
              .importKey(
                format,
                toImport,
                value.algorithm,
                value.extractable,
                value.usages
              )
              .catch((e) => {
                // console.log("caught import error", e);
                // console.log("key", value.algorithm, format);
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
            // console.log("SERIALIZE");
            const buf = Buffer.from(value, "base64");
            // console.log("BUFFER", buf);
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
    };
    traverse(json, inPlace);
    return Promise.all(proms);
  }

  async _encodeCipher(cipher, twice = true) {
    const json = await cipher.toJSON();
    json.options = cipher.options;
    json.id = cipher.id;

    await this._exportKeys(json);
    console.log("ENCODE", cipher, json);
    const b64 = JSONToB64(json);
    return b64;
  }

  async _decodeCipher(identity, remote, b64) {
    // console.log("b64", b64);
    const json = b64ToJSON(b64);
    await this._importKeys(json);
    const cipher = await DKeyRatchet.AsymmetricRatchet.fromJSON(
      identity,
      remote,
      json
    );
    cipher.options = json.options;
    cipher.id = json.id;
    return cipher;
  }
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

export default Ratchet;
