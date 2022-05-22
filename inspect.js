const keytar = require("keytar");

const stores = [
  "server_session",
  "client_session",
  "client_session_index",
  "client_remote",
  "server_remote",
];

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
