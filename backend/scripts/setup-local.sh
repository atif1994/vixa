#!/usr/bin/env bash
# Install infrastructure dependencies for local development (no Docker)
set -euo pipefail

echo "==> Installing PostgreSQL, Redis, and RabbitMQ via Homebrew..."
brew install postgresql@16 redis rabbitmq

echo "==> Starting services..."
brew services start postgresql@16
brew services start redis
brew services start rabbitmq

echo "==> Waiting for PostgreSQL..."
sleep 3

PG_BIN="$(brew --prefix postgresql@16)/bin"
export PATH="$PG_BIN:$PATH"

echo "==> Creating database and user..."
psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='vixa'" | grep -q 1 || \
  psql postgres -c "CREATE USER vixa WITH PASSWORD 'vixa_secret' CREATEDB;"
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='vixa_ciam'" | grep -q 1 || \
  psql postgres -c "CREATE DATABASE vixa_ciam OWNER vixa;"

echo "==> Running schema init..."
psql -U vixa -d vixa_ciam -f infrastructure/postgres/init.sql

echo ""
echo "Setup complete. Next:"
echo "  cp .env.local.example .env"
echo "  ./scripts/start-local.sh"
