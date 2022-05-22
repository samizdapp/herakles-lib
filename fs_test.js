// tslint:disable: no-console

const { Crypto } = require("@peculiar/webcrypto");
const { Convert } = require("pvtsutils");
const DKeyRatchet = require("2key-ratchet");
const { getServerIdentity, getIdentity } = require("./server");
const {
  encodeCipher,
  decodeCipher,
  decodeIdentity,
  encodeIdentity,
} = require("./util");
const jsonDiff = require("json-diff");

async function main() {
  const crypto = new Crypto();
  DKeyRatchet.setEngine("@peculiar/webcrypto", crypto);

  // Create Alice's identity
  const AliceID = await getServerIdentity(1);

  // Create PreKeyBundle
  const AlicePreKeyBundle = new DKeyRatchet.PreKeyBundleProtocol();
  await AlicePreKeyBundle.identity.fill(AliceID);
  AlicePreKeyBundle.registrationId = AliceID.id;
  // Add info about signed PreKey
  const preKey = AliceID.signedPreKeys[0];
  AlicePreKeyBundle.preKeySigned.id = 0;
  AlicePreKeyBundle.preKeySigned.key = preKey.publicKey;
  await AlicePreKeyBundle.preKeySigned.sign(AliceID.signingKey.privateKey);
  // Convert proto to bytes
  const AlicePreKeyBundleProto = await AlicePreKeyBundle.exportProto();
  console.log("Alice's bundle: ", Convert.ToHex(AlicePreKeyBundleProto));

  // Create Bob's identity
  const BobID = await getIdentity(2);

  // Parse Alice's bundle
  const bundle = await DKeyRatchet.PreKeyBundleProtocol.importProto(
    AlicePreKeyBundleProto
  );
  // Create Bob's cipher
  const BobCipher = await DKeyRatchet.AsymmetricRatchet.create(BobID, bundle, {
    exportableKeys: true,
  });
  // Encrypt message for Alice
  const BobMessageProto = await BobCipher.encrypt(
    Convert.FromUtf8String("Hello Alice!!!")
  );
  // convert message to bytes array
  const BobMessage = await BobMessageProto.exportProto();
  console.log("Bob's encrypted message:", Convert.ToHex(BobMessage));

  // Decrypt message by Alice
  // Note: First message from Bob must be PreKeyMessage
  // parse Bob's message
  const proto = await DKeyRatchet.PreKeyMessageProtocol.importProto(BobMessage);
  // Creat Alice's cipher for Bob's message
  const AliceCipher = await DKeyRatchet.AsymmetricRatchet.create(
    AliceID,
    proto,
    {
      exportableKeys: true,
    }
  );

  // Decrypt message
  const bytes = await AliceCipher.decrypt(proto.signedMessage);
  console.log("Bob's decrypted message:", Convert.ToUtf8String(bytes));

  const t = await AliceCipher.encrypt(Convert.FromString("hello bob"));
  const tp = await t.exportProto();
  const tpt = await DKeyRatchet.MessageSignedProtocol.importProto(tp);
  console.log("TPT", tpt);

  const d = await BobCipher.decrypt(tpt);
  // const dm = await d.
  console.log("sent back", Convert.ToString(d));

  const acE = await encodeCipher(AliceCipher, false);
  const aI = await decodeIdentity(await encodeIdentity(AliceID), false);
  const aR = await decodeIdentity(
    await encodeIdentity(AliceCipher.remoteIdentity),
    true
  );
  const bcE = await encodeCipher(BobCipher, false);
  const bI = await decodeIdentity(await encodeIdentity(BobID), false);
  const bR = await decodeIdentity(
    await encodeIdentity(BobCipher.remoteIdentity),
    true
  );

  const { cipher: ac } = await decodeCipher(aI, aR, acE);
  const { cipher: bc } = await decodeCipher(bI, bR, bcE);

  // console.log("alice diff", jsonDiff.diffString(AliceCipher, ac));
  // console.log("bob diff", jsonDiff.diffString(BobCipher, bc));

  const postenc = await bc.encrypt(
    Convert.FromUtf8String("Hello AGAIN Alice!!!")
  );

  const m = await postenc.exportProto();
  // console.log("exported m", m);

  const mp = await DKeyRatchet.MessageSignedProtocol.importProto(m);
  console.log("GOT MP", mp);
  const b = await ac.decrypt(mp);
  console.log("Bob's decrypted message:", Convert.ToUtf8String(b));
}

main().catch((e) => console.error(e));
