const PocketProxy = require("./dist/pocket_proxy");
const fs = require("fs");

async function main() {
  const [wan, lan] = JSON.parse(
    fs.readFileSync("./upnp/addresses").toString("utf-8").trim()
  );
  const p = new PocketProxy({ lan, wan, port: 8004 });
  await p.init();

  // p.listen();
}

main();
