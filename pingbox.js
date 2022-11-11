#!/usr/bin/env node

import { createLibp2p } from "libp2p";
import { WebSockets } from "@libp2p/websockets";
import { Noise } from "@chainsafe/libp2p-noise";
import { Mplex } from "@libp2p/mplex";

const MULTI_ADDR = process.argv[2];

async function main() {
  const nodeAddr = MULTI_ADDR;

  if (!nodeAddr) {
    throw new Error("Node address is required.");
  }

  const node = await createLibp2p({
    transports: [new WebSockets()],
    connectionEncryption: [new Noise()],
    streamMuxers: [new Mplex()],
    connectionManager: {
      dialTimeout: 60000,
    },
  });

  await node.start();
  console.log(`Node started with id ${node.peerId.toString()}`);

  const conn = await node.dial(nodeAddr);

  console.log(`Connected to the node via ${conn.remoteAddr.toString()}`, conn);

  return 0;
}

await main();

process.exit(0);
