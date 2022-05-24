import Ratchet from "../src/ratchet";
import Storage from "../src/storage.node";
import { Crypto, CryptoKey } from "@peculiar/webcrypto";

Ratchet.useCrypto(Crypto, CryptoKey);

async function main() {
  const alice = new Ratchet(Storage, { id: 0 });
  const bob = new Ratchet(Storage, { id: 1 });

  const a = await alice.getIdentity();
  const b = await bob.getIdentity();

  console.log(a, b);
}

main().catch((e) => console.error(e));
