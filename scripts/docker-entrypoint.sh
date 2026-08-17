#!/bin/sh
set -e

cd /app

if [ "$RUN_MIGRATIONS" != "false" ]; then
  echo "[ectrans] Ejecutando prisma migrate deploy..."
  node ./node_modules/prisma/build/index.js migrate deploy
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[ectrans] Ejecutando seed..."
  node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts
fi

exec "$@"
