const keytar = require("keytar");
const { main: inspect } = require("./inspect");

async function main() {
  const res = await inspect();
  console.log("res", res);
  for (const creds of res) {
    const store = creds.pop();
    console.log("creds", creds);
    for (const account of creds) {
      console.log("account", account);
      await keytar.deletePassword(store, account);
    }
  }
}

main();
