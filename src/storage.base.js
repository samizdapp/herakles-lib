class Storage {
  constructor(namespace, service) {
    this._service = service;
    this._namespace = namespace;
  }

  async getItem(key) {
    console.log("getIREM, key", this._service, key, this._namespace);
    const str = await this._service.getItem(this._namespace, key);
    return JSON.parse(str);
  }

  async setItem(key, value) {
    return this._service.setItem(this._namespace, key, JSON.stringify(value));
  }
}

class LocalStorageService {
  constructor(service) {
    this.localStorage = service;
  }

  async setItem(namespace, key, value) {
    return this._setItem(namespace, key, value);
  }

  async getItem(namespace, key) {
    return this._getItem(namespace, key);
  }

  async _setItem(namespace, key, value) {
    return this.localStorage.setItem(`${namespace}:${key}`, value);
  }

  async _getItem(namespace, key) {
    return this.localStorage.getItem(`${namespace}:${key}`);
  }
}

class WebviewStorageService extends LocalStorageService {
  constructor(service) {
    this.localStorage = service;
  }
}

export { LocalStorageService, WebviewStorageService };

export default Storage;
