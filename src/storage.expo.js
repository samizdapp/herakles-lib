import Storage, { LocalStorageService } from "./storage.base";
import AsyncStorage from "@react-native-async-storage/async-storage";

class ExpoStorageService extends LocalStorageService {
  constructor() {
    super(AsyncStorage);
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

export { ExpoStorageService };

export default ExpoStorage;
