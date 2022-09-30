import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { createFromProtobuf, exportToProtobuf, createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { TCP } from '@libp2p/tcp'
import { LevelDatastore } from 'datastore-level'
import { readFile, writeFile } from 'fs/promises'
import NATApi from 'nat-api'
import localip from 'local-ip'
import { decode, encode } from "lob-enc";
import fetch from "cross-fetch";
import { pipe } from 'it-pipe'

const CHUNK_SIZE = 1024 * 8;

const getHeadersJSON = (h) => {
  const ret = {};
  for (const pair of h.entries()) {
    ret[pair[0]] = pair[1];
  }
  return ret;
};

const getResponseJSON = (r) => ({
  ok: r.ok,
  headers: getHeadersJSON(r.headers),
  redirected: r.redirected,
  status: r.status,
  statusText: r.statusText,
  type: r.type,
  url: r.url,
});
const ID_PATH = process.env.ID_PATH || './store/id'
const PUBLIC_PATH = process.env.PUBLIC_PATH || './store/libp2p.bootstrap'
const PRIVATE_PORT = 9000

const getLocalIPS = async () => {
  const res = await Promise.all(['eth0', 'wlan0', 'en0'].map(iface => new Promise(resolve => localip(iface, (err, ip) => resolve(err ? null : ip)))))
  return res.filter(i => i)
}

const getLocalMultiaddr = async (idstr) => {
  const [localIP] = await getLocalIPS()
  return `/ip4/${localIP}/tcp/${PRIVATE_PORT}/ws/p2p/${idstr}`
}

const mapPort = async (nat, privatePort) => {
  let success = false, publicPort = privatePort - 1;

  do {
    publicPort++
    success = await new Promise((resolve) => nat.map({
      privatePort,
      publicPort,
      protocol: 'TCP'
    }, (err) => err ? resolve(false) : resolve(true)))
  } while (!success && publicPort - privatePort < 10)

  return { success, publicPort }
}

const getIP = async (nat) => new Promise((resolve, reject) => {
  nat.externalIp(function (err, ip) {
    if (err) return reject(err)
    resolve(ip)
  })
})

export default async function main() {
  const nat = new NATApi()
  console.log('starting', ID_PATH, PUBLIC_PATH)

  const peerId = await readFile(ID_PATH).then(createFromProtobuf).catch(async e => {
    const _id = await createEd25519PeerId()
    await writeFile(ID_PATH, exportToProtobuf(_id))
    return _id;
  })

  const bootstrap = await getLocalMultiaddr(peerId.toString())
  await writeFile(PUBLIC_PATH, bootstrap)

  const datastore = new LevelDatastore('./libp2p')
  await datastore.open() // level database must be ready before node boot

  const privatePort = PRIVATE_PORT
  const { success, publicPort } = await mapPort(nat, privatePort)
  const publicIP = await getIP(nat).catch(() => null)

  const announce = success && publicIP ? [`/ip4/${publicIP}/tcp/${publicPort}/ws`] : undefined
  const listen = ['/ip4/0.0.0.0/tcp/9000/ws', '/ip4/0.0.0.0/tcp/9001']
  const node = await createLibp2p({
    peerId,
    datastore,
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/9000/ws', '/ip4/0.0.0.0/tcp/9001'],
      announce: announce
    },
    transports: [
      new WebSockets(),
      new TCP()
    ],
    streamMuxers: [
      new Mplex()
    ],
    connectionEncryption: [
      new Noise()
    ],
    relay: {                   // Circuit Relay options (this config is part of libp2p core configurations)
      enabled: true,           // Allows you to dial and accept relayed connections. Does not make you a relay.
      hop: {
        enabled: true,         // Allows you to be a relay for other peers
        active: true           // You will attempt to dial destination peers if you are not connected to them
      },
      advertise: {
        bootDelay: 15 * 60 * 1000, // Delay before HOP relay service is advertised on the network
        enabled: true,          // Allows you to disable the advertise of the Hop service
        ttl: 30 * 60 * 1000     // Delay Between HOP relay service advertisements on the network
      }
    },
    peerStore: {
      persistence: true,
      threshold: 5
    },
    keychain: {
      pass: 'notsafepassword123456789',
      datastore,
    }
  })

  console.log(node.libp2p)

  node.handle('/samizdapp-proxy', ({ stream }) => {
    // console.log('got proxy stream')
    pipe(
      stream.source,
      async function (source) {
        const chunks = []
        for await (const val of source) {
          // console.log('stream val', val)
          const buf = Buffer.from(val.subarray())
          // console.log('chunk', buf.length, buf.toString('hex'))
          if (buf.length === 1 && buf[0] === 0x00) {
            return new Promise(async (resolve, reject) => {
              let {
                json: { reqObj, reqInit },
                body,
              } = decode(Buffer.concat(chunks));

              // console.log("url?", event, reqObj, reqInit);
              let fres, url, init;
              // console.log("set body", body ? body.toString() : "");
              if (typeof reqObj === "string") {

                url = reqObj.startsWith("http") ? reqObj : `http://localhost${reqObj}`;
                if (
                  reqInit.method &&
                  reqInit.method !== "HEAD" &&
                  reqInit.method !== "GET"
                ) {
                  reqInit.body = body;
                }
                init = reqInit
              } else if (typeof reqObj !== 'string') {
                reqInit = reqObj;
                url = reqObj.url
                if (
                  reqObj.method &&
                  reqObj.method !== "HEAD" &&
                  reqObj.method !== "GET"
                ) {
                  reqObj.body = body;
                }
                init = reqObj
              }

              console.log('do fetch', url)//, init, init.body ? init.body : '')
              fres = await fetch(url, init).catch(error => {
                console.log('proxy downstream error', error)
                resolve([encode({ error }, Buffer.from(error?.toString ? error.toString() : 'unknown error')), Buffer.from([0x00])])
                return null;
              });
              if (!fres) {
                return;
              }
              const resb = await fres.arrayBuffer();
              const res = getResponseJSON(fres);
              const forward = encode({ res }, Buffer.from(resb));
              // console.log("got forward", res, forward.length);
              let i = 0;
              const _chunks = []
              for (; i <= Math.floor(forward.length / CHUNK_SIZE); i++) {
                _chunks.push(forward.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
              }
              // console.log("i max", i, Math.ceil(forward.length / CHUNK_SIZE));
              _chunks.push(Buffer.from([0x00]))
              resolve(_chunks)
            })
          } else {
            chunks.push(buf)
          }

        }
        console.log('got all values?')
      },
      stream.sink
    )
  }, {
    maxInboundStreams: 100
  })

  await node.start()
  node.addEventListener('peer:discovery', ({ detail: peer }) => {
    console.log('Discovered', peer) // Log discovered peer
  })

  node.addEventListener('peer:connect', (connection) => {
    console.log('Connected to %s', connection.remotePeer.toString()) // Log connected peer
  })
  node.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log(`Connected to ${connection.remotePeer.toString()}`)
    console.log(connection)
  })


  console.log('libp2p has started')


  console.log(`Node started with id ${node.peerId.toString()}`)
  console.log('Listening on:')
  //  node.getMultiaddrs()
  node.components.getAddressManager().getAddresses().forEach((ma) => console.log(ma.toString()))
  // node.ping()
  // stop libp2p
  // await node.stop()
  // console.log('libp2p has stopped')
}

main()