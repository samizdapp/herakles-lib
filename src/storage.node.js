import keytar from "keytar";
import Storage from "./storage.base";

class NodeStorage extends Storage {
  constructor(namespace) {
    super(namespace, keytar);
  }
}

export default NodeStorage;
