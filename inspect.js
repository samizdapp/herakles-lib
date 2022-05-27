const keytar = require("keytar");

const stores = ["1:identity", "1:cipher", "2:identity", "2:cipher"];

async function main() {
  const res = [];
  for (const store of stores) {
    const s = await inspectStore(store);
    s.push(store);
    res.push(s);
  }
  return res;
}

async function inspectStore(name) {
  const res = await keytar.findCredentials(name);
  console.log("-----RESULTS: ", name);
  for (const { account } of res) {
    console.log(account);
  }
  return res.map(({ account }) => account);
}

module.exports = { stores, inspectStore, main };

if (require.main === module) {
  main();
}
