#!/bin/sh
if [ -f "/etc/yg_hosts" ]
then
cp /etc/yg_hosts /etc/hosts
fi

while inotifywait -e close_write /etc/yg_hosts; 
do 
echo "copy yg_hosts"
cp /etc/yg_hosts /etc/hosts
done