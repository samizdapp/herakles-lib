#!/bin/sh

./watch_hosts.sh & jobs
export NODE_TLS_REJECT_UNAUTHORIZED=0
node src/p2p_proxy.js