import keytar from "keytar";
import Storage from "./storage.base";

class KeytarStorage {
  constructor(keytar) {
    this._keytar = keytar;
  }

  async getItem(namespace, key) {
    return this._keytar.getPassword(namespace, key);
  }

  async setItem(namespace, key, value) {
    return this._keytar.setPassword(namespace, key, value);
  }
}

class NodeStorage extends Storage {
  constructor(namespace) {
    super(namespace, new KeytarStorage(keytar));
  }
}

export default NodeStorage;
