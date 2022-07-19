#!/bin/sh

./watch_hosts.sh & jobs
export NODE_TLS_REJECT_UNAUTHORIZED=0
node proxy_server.js