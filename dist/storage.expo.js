'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var AsyncStorage = require('@react-native-async-storage/async-storage');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var AsyncStorage__default = /*#__PURE__*/_interopDefaultLegacy(AsyncStorage);

class Storage {
  constructor(namespace, service) {
    this._service = service;
    this._namespace = namespace;
  }

  async getItem(key) {
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
    this._job = Promise.resolve();
  }

  async setItem(namespace, key, value) {
    const prom = (this._job = this._job.then(() =>
      this._setItem(namespace, key, value)
    ));
    return prom;
  }

  async getItem(namespace, key) {
    const prom = (this._job = this._job.then(() =>
      this._getItem(namespace, key)
    ));
    return prom;
  }

  async _setItem(namespace, key, value) {
    return this.localStorage.setItem(`${namespace}:${key}`, value);
  }

  async _getItem(namespace, key) {
    return this.localStorage.getItem(`${namespace}:${key}`);
  }
}

class ExpoStorageService extends LocalStorageService {
  constructor() {
    super(AsyncStorage__default["default"]);
  }
}

class ExpoStorage extends Storage {
  constructor(namespace) {
    super(namespace, new ExpoStorageService());
  }

  async doJob({ action, request, value }, postMessage) {
    if (action === "GET") {
      value = await this.getItem(request);
    } else {
      value = await this.setItem(request, value);
    }

    const res = { action, request, value };
    postMessage(JSON.stringify(res));
  }

  async onMessage(str, postMessage) {
    const { type, action, request, value } = JSON.parse(str);

    switch (type) {
      case "STORAGE_REQUEST":
        return this.doJob({ action, request, value }, postMessage);
      default:
        console.debug("ignoring message", type);
    }
  }
}

exports.ExpoStorageService = ExpoStorageService;
exports["default"] = ExpoStorage;
