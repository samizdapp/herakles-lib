const PocketProxy = require("./dist/pocket_proxy");
const fs = require("fs");

async function main() {
  const lan = JSON.parse(
    fs.readFileSync("./upnp/addresses").toString("utf-8").trim()
  ).pop();
  const p = new PocketProxy({ lan });
  await p.init();

  // p.listen();
}

main();
