#!/usr/bin/env bash
# Start all ViXa services locally (no Docker)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.local.example .env
  echo "Created .env from .env.local.example"
fi

# Load env
set -a
source .env
set +a

# Python venv
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r shared/requirements.txt
fi
source .venv/bin/activate
export PYTHONPATH="$ROOT"

PIDS_DIR="$ROOT/.pids"
mkdir -p "$PIDS_DIR"
LOGS_DIR="$ROOT/.logs"
mkdir -p "$LOGS_DIR"

start_service() {
  local name="$1"
  local module="$2"
  local port="$3"
  echo "Starting $name on :$port..."
  uvicorn "$module" --host 0.0.0.0 --port "$port" \
    > "$LOGS_DIR/$name.log" 2>&1 &
  echo $! > "$PIDS_DIR/$name.pid"
}

# Ensure infra is running
brew services start postgresql@16 2>/dev/null || true
brew services start redis 2>/dev/null || true
brew services start rabbitmq 2>/dev/null || true

start_service auth-service       services.auth.app.main:app       8001
start_service onboarding-service services.onboarding.app.main:app 8002
start_service org-site-service   services.org-site.app.main:app   8003
start_service verification-svc   services.verification.app.main:app 8004
start_service payments-service   services.payments.app.main:app     8005
start_service licensing-service  services.licensing.app.main:app    8006
start_service acl-service        services.acl.app.main:app        8007
start_service gateway            gateway.app.main:app             8000

if command -v node >/dev/null 2>&1; then
  echo "Starting observability-node on :8008..."
  (cd "$ROOT/services/observability-node" && npm install --omit=dev 2>/dev/null; node index.js) \
    > "$LOGS_DIR/observability-node.log" 2>&1 &
  echo $! > "$PIDS_DIR/observability-node.pid"
fi

sleep 2
python workers/licence-provisioner/main.py > "$LOGS_DIR/licence-provisioner.log" 2>&1 &
echo $! > "$PIDS_DIR/licence-provisioner.pid"
python workers/notification/main.py > "$LOGS_DIR/notification.log" 2>&1 &
echo $! > "$PIDS_DIR/notification.pid"

echo ""
echo "Backend running:"
echo "  Gateway:  http://localhost:8000"
echo "  Logs:     $LOGS_DIR/"
echo ""
echo "Start frontend (separate terminal):"
echo "  cd frontend && npm install && npm run dev"
echo ""
echo "Stop all: ./scripts/stop-local.sh"
