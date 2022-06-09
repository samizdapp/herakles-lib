import Storage, { LocalStorageService } from "./storage.base";
import { LocalStorage } from "node-localstorage";

class KeytarStorage {
  constructor(keytar) {
    this._keytar = keytar;
    this._job = Promise.resolve();
  }

  async getItem(namespace, key) {
    const prom = (this._job = this._job.then(() =>
      this._keytar.getPassword(namespace, key)
    ));
    return prom;
  }

  async setItem(namespace, key, value) {
    const prom = (this._job = this._job.then(() =>
      this._keytar.setPassword(namespace, key, value)
    ));
    return prom;
  }
}

class NodeStorage extends Storage {
  constructor(namespace) {
    const localStorage = new LocalStorage("./scratch");
    super(namespace, new LocalStorageService(localStorage));
  }
}

export default NodeStorage;
