import Ratchet from "../src/ratchet";
import Storage from "../src/storage.node";
import { Crypto, CryptoKey } from "@peculiar/webcrypto";
import DKeyRatchet from "2key-ratchet";
Ratchet.useCrypto(Crypto, CryptoKey);

async function main() {
  const alice = new Ratchet(Storage, { id: 2 });
  const bob = new Ratchet(Storage, { id: 1 });

  const a = await alice.getIdentity();
  const b = await bob.getIdentity();

  // console.log(a, b);
  const aliceBundle = await alice.getBundle();

  const id = await bob.consumeBuffer(aliceBundle);

  console.log("exit?", id);
  // process.exit();
  const b2a = await bob.encrypt(id, Buffer.from("hey alice"));
  // Create Bob's cipher
  console.log("got bob cipher", b2a);
  // process.exit(0);
  const bobID = await alice.getIDFromMessage(b2a);
  const aFromB = await alice.decrypt(b2a);

  console.log("decrypted", Buffer.from(aFromB).toString());
  console.log("BOB id", bobID);
  bob._ciphers.delete(id);
  alice._ciphers.delete(bobID);
  let a2b = await alice.encrypt(bobID, Buffer.from("hello bob"));

  let a22b = await bob.decrypt(a2b);
  console.log("bob decrypted", Buffer.from(a22b).toString());

  a2b = await alice.encrypt(bobID, Buffer.from("hello bob 2"));

  a22b = await bob.decrypt(a2b);
  console.log("bob decrypted", Buffer.from(a22b).toString());

  a2b = await alice.encrypt(bobID, Buffer.from("hello bob 3"));

  a22b = await bob.decrypt(a2b);
  console.log("bob decrypted", Buffer.from(a22b).toString());

  return;
  // const BobCipher = cipher;
  // // Encrypt message for Alice
  // const BobMessageProto = await BobCipher.encrypt(Buffer.from("Hello Alice!!"));
  // // convert message to bytes array
  // const BobMessage = await BobMessageProto.exportProto();

  // const BobMessage = await bob.console.log(
  //   "Bob's encrypted message:",
  //   BobMessage.toString()
  // );
  // const AliceCipher = await alice.importMessage(BobMessage);

  // // Decrypt message by Alice
  // // Note: First message from Bob must be PreKeyMessage
  // // parse Bob's message
  // const proto = await DKeyRatchet.PreKeyMessageProtocol.importProto(BobMessage);

  // // Decrypt message
  // const bytes = await AliceCipher.decrypt(proto.signedMessage);
  // console.log("Bob's decrypted message:", Buffer.from(bytes).toString());

  // // const BobCipher = await bob.importBundle(await aliceBundle.exportProto());
  // // console.log("BOBCIP", BobCipher);

  // // const BobMessageProto = await BobCipher.encrypt(
  // //   Buffer.from("Hello Alice!!!")
  // // );

  // // // convert message to bytes array
  // // const BobMessage = await BobMessageProto.exportProto();

  // // console.log("proto", BobMessageProto);
  // // const bytes = await AliceCipher.decrypt(BobMessageProto.signedMessage);

  // // console.log("bytes", bytes.toString());
}

main().catch((e) => console.error(e));
