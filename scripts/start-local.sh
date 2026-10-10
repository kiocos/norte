#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then npm ci; fi
if [ "${1:-}" = "--production" ]; then
  npm run build
  exec npm run start
fi
exec npm run dev
