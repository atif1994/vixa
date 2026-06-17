#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/frontend"

if [[ ! -d node_modules ]]; then
  echo "Installing frontend dependencies..."
  npm install
fi

echo ""
echo "=== ViXa Next.js Frontend ==="
echo "  App: http://localhost:3000"
echo "  (Requires backend on http://localhost:8000)"
echo ""

npm run dev
