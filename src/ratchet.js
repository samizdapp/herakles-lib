import DKeyRatchet from "2key-ratchet";
import { traverse } from "object-traversal";
import { v4 as uuidv4 } from "uuid";

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
      preKeyAmount = 1,
      exportableKeys = true,
    } = {}
  ) {
    this._identityStore = new Storage(`${id}:identity`);
    this._sessiontStore = new Storage(`${id}:cipher`);
    this._identity = null;
    this._sessions = new Map();
    this._remotes = new Map();
    this._options = {
      id,
      signedPreKeyAmount,
      preKeyAmount,
      exportableKeys,
    };
  }

  async getIdentity() {
    if (this._identity) return this._identity;

    this._identity = await this._getSelfIdentityFromStorage();
    if (this._identity) return this._identity;

    this._identity = await this._createIdentity();
    await this._storeIdentity();
    return this._identity;
  }

  async getSession(sessionID = uuidv4()) {
    if (this._sessions.has(sessionID)) return this._sessions.get(sessionID);

    let cipher = await this._getStoredSession(sessionID);
    if (!cipher) {
      cipher = await this._createSession(sessionID);
    }

    cipher.on("update", () => this._saveSession(sessionID, cipher));
    this._sessions.set(sessionID, cipher);

    return { sessionID, cipher };
  }

  async getBundle() {
    if (this._bundle) return this._bundle;

    this._bundle = await this._createBundle();
    return this._bundle;
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
    await this.exportKeys(json);
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
    const preKey = identity.signedPreKeys[0];
    const bundle = new DKeyRatchet.PreKeyBundleProtocol();
    bundle.registrationId = identity.id;
    await bundle.identity.fill(identity);
    bundle.preKeySigned.id = 0;
    bundle.preKeySigned.key = preKey.publicKey;
    await bundle.preKeySigned.sign(identity.signingKey.privateKey);
    return bundle;
  }

  async _getStoredSession(sessionID) {
    const raw = await this._sessionStore.getItem(sessionID);
    if (!raw) return null;

    const { b64 } = raw;
    const identity = await this.getIdentity();
    const remote = await this.getRemote(sessionID);
    return decodeCipher(identity, remote, b64);
  }

  async _saveSession(sessionID, cipher) {
    const b64 = await encodeCipher(cipher);
    await this._sessions.setItem(sessionID, { b64 });
  }

  async getRemote(sessionID) {
    if (this._remotes.has(sessionID)) return this._remotes.get(sessionID);

    const remote = await this._getStoredRemote(sessionID);
    if (!remote) return null;

    this._remotes.set(sessionID, remote);
    return remote;
  }

  async _getStoredRemote(sessionID) {
    const raw = await this._identityStore.get(sessionID);
    if (!raw) return null;
    const { b64 } = raw;

    const json = b64ToJSON(b64);
    await this._importKeys(json);

    const remote = await DKeyRatchet.RemoteIdentity.fromJSON(json);
    return remote;
  }
  async exportKeys(json) {
    const proms = [];
    const inPlace = ({ parent, key, value, meta }) => {
      if (value instanceof CryptoKey) {
        proms.push(
          (async function exportKey() {
            const format = getFormatFromAlg(value.algorithm);
            // console.log("key", value.algorithm, format);
            const engine = DKeyRatchet.getEngine();
            console.log("engine", engine);
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
    };
    traverse(json, inPlace);
    return Promise.all(proms);
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

async function encodeCipher(cipher, twice = true) {
  const json = await cipher.toJSON();
  json.options = cipher.options;
  json.id = cipher.id;

  await this.exportKeys(json);
  const b64 = JSONToB64(json);
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

export default Ratchet;
