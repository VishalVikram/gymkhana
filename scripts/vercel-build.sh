#!/usr/bin/env bash
# Vercel build: generate Prisma client, apply migrations, build Next.js.
# Neon (Vercel Storage) injects DATABASE_URL + DATABASE_URL_UNPOOLED;
# Prisma's directUrl reads DIRECT_DATABASE_URL, so fall back to the unpooled URL.
set -euo pipefail

export DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}}"

npx prisma generate

if [ -n "${DATABASE_URL:-}" ] && [ "${VERCEL_ENV:-}" = "production" ]; then
  npx prisma migrate deploy
else
  echo "Skipping prisma migrate deploy (no DATABASE_URL or not production)"
fi

npx next build
