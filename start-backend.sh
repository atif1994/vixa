#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created backend/.env"
fi

if [[ ! -d node_modules ]]; then
  echo "Installing backend dependencies..."
  npm install
fi

echo ""
echo "=== ViXa NestJS Backend ==="
echo "  API:      http://localhost:8000"
echo "  Swagger:  http://localhost:8000/api/docs"
echo ""
echo "First time? Run setup once:"
echo "  npx prisma db push && npx ts-node prisma/seed.ts"
echo ""

npm run start:dev
