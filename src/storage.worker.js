import localforage from "localforage";
import Storage, { LocalStorageService } from "./storage.base";

class WorkerStorage extends Storage {
  constructor(namespace) {
    super(namespace, new LocalStorageService(localforage));
  }
}

export default WorkerStorage;
