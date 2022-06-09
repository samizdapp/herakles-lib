import Storage, { LocalStorageService } from "./storage.base";

const STORAGE_REQUEST = "STORAGE_REQUEST";
const STORAGE_RESPONSE = "STORAGE_RESPONSE";
class WebStorageService extends LocalStorageService {
  constructor() {
    super(window.localStorage);
    this.jobs = new Map();

    console.log("constructor", window);
    window.onmessage = ({ data }) => {
      alert("onmessage + " + data);
      const json = JSON.parse(data);
      switch (json.type) {
        case STORAGE_RESPONSE:
          const promise = this.jobs.get(json.request);
          this.jobs.delete(json.request);
          promise.resolve(json.value);
          break;
        default:
          console.debug("ignoring postmessage");
      }
    };
  }

  async setItem(namespace, key, value) {
    await this.replicate(namespace, key, value);
    return super.setItem(namespace, key, value);
  }

  async getItem(namespace, key, value) {
    let result = await super.getItem(namespace, key, value);
    if (result) return result;

    result = await this.request(namespace, key, value);
    return result;
  }

  async doJob({ type, action, request, value }) {
    while (this.jobs.has(request)) {
      await this.jobs.get(request).promise;
    }

    console.log("DO JOB?");
    alert("do job?");

    let resolve, reject;

    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.jobs.set(request, { resolve, reject, promise });

    window.ReactNativeWebView.postMessage(
      JSON.stringify({ request, action, type, value })
    );

    return promise;
  }

  async request(namespace, key) {
    if (!window?.ReactNativeWebView?.postMessage) return null;

    const type = STORAGE_REQUEST;
    const action = "GET";
    const request = `${namespace}:${key}`;

    return this.doJob({ type, action, request });
  }

  async replicate(namespace, key, value) {
    if (!window?.ReactNativeWebView?.postMessage) return;

    const type = STORAGE_REQUEST;
    const action = "SET";
    const request = `${namespace}:${key}`;
    return this.doJob({ type, action, request, value });
  }
}

class WebStorage extends Storage {
  constructor(namespace) {
    super(namespace, new WebStorageService());
    console.log("webstorage constructor");
  }
}

export default WebStorage;
