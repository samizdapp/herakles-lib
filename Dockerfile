FROM node:16-bullseye

RUN mkdir -p /proxy/dist
WORKDIR /proxy

COPY ./package.json ./package.json
RUN npm install

COPY ./dist/pocket_proxy.js ./dist/pocket_proxy.js
COPY ./proxy_server.js ./proxy_server.js
COPY ./watch_hosts.sh ./watch_hosts.sh
COPY ./start.sh ./start.sh

RUN apt-get update
RUN apt-get install inotify-tools -y

CMD [ "sh", "./start.sh" ]