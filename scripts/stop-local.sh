#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .local/app.pid ]; then
  task_pid=$(cat .local/app.pid)
  if ps -p "$task_pid" -o command= | rg -q 'next-server'; then kill "$task_pid"; fi
  rm -f .local/app.pid
fi
if pg_ctl -D .local/postgres status >/dev/null 2>&1; then pg_ctl -D .local/postgres -m fast stop; fi
