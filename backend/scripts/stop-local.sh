#!/usr/bin/env bash
# Stop locally running ViXa services
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDS_DIR="$ROOT/.pids"

if [[ -d "$PIDS_DIR" ]]; then
  for pidfile in "$PIDS_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    pid=$(cat "$pidfile")
    name=$(basename "$pidfile" .pid)
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped $name (pid $pid)"
    fi
    rm -f "$pidfile"
  done
fi

# Kill any stale listeners on ViXa ports (e.g. if pid files were lost)
for port in 8000 8001 8002 8003 8004 8005 8006 8007 8008; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Stopping stale process on :$port (pid $pids)"
    kill $pids 2>/dev/null || true
  fi
done

echo "Done."
