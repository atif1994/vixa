#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"

cp -n .env.example .env 2>/dev/null || true
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts

echo ""
echo "Backend setup complete. Start with:"
echo "  ./start-backend.sh"
