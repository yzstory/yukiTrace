#!/bin/sh
set -e
echo "▶ prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy
echo "▶ starting next server"
exec node server.js
