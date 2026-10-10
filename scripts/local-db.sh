#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local/postgres .local/socket
if [ ! -f .local/postgres/PG_VERSION ]; then
  initdb -D .local/postgres -U norte --auth=trust --encoding=UTF8 --locale=C > .local/initdb.log
fi
if ! pg_ctl -D .local/postgres status >/dev/null 2>&1; then
  pg_ctl -D .local/postgres -l .local/postgres.log -o "-h 127.0.0.1 -p 55432 -k $(pwd)/.local/socket" start
fi
if ! psql 'postgresql://norte@127.0.0.1:55432/postgres' -tAc "SELECT 1 FROM pg_database WHERE datname='norte'" | rg -q 1; then
  createdb -h 127.0.0.1 -p 55432 -U norte norte
fi
if [ ! -f .env.local ]; then
  printf '%s\n' 'DATABASE_URL=postgresql://norte@127.0.0.1:55432/norte' > .env.local
fi
echo 'PostgreSQL ready on 127.0.0.1:55432 (database norte).'
