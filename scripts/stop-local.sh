#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .local/app.pid ]; then
  task_pid=$(cat .local/app.pid)
  if ps -p "$task_pid" -o command= | rg -q 'next-server|scripts/serve-local.mjs'; then kill "$task_pid"; fi
  rm -f .local/app.pid
fi
