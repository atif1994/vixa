# ViXa CIAM — Backend (FastAPI)

Async microservices backend for the ViXa Platform CIAM system.

## Run

```bash
cd backend
pip install -r shared/requirements.txt
cp .env.local.example .env
./scripts/start-local.sh
```

Gateway: http://localhost:8000  
OpenAPI (per service): http://localhost:8001/docs (auth), etc.

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -q
```

## Module map

| Path | Role |
|------|------|
| `gateway/app/main.py` | API gateway — JWT, rate limiting, routing (tier 2) |
| `gateway/app/middleware/rate_limit.py` | Per-endpoint token-bucket limiter |
| `services/auth/` | Auth service — identity, JWT, MFA, OIDC (tier 3) |
| `services/onboarding/` | Onboarding saga with compensation (tier 3) |
| `services/org-site/` | Organisation & site profiles (tier 4) |
| `services/verification/` | Email/SMS OTP verification (tier 4) |
| `services/payments/` | Stripe card hold & subscriptions (tier 4) |
| `services/licensing/` | Products, licences, entitlements (tier 4) |
| `services/acl/` | Anti-corruption layer → Ost Infinity (tier 6) |
| `services/observability-node/` | Health aggregation + audit viewer API |
| `shared/messaging/events.py` | RabbitMQ event backbone (tier 5) |
| `workers/` | Async workers — licence provisioner, notifications |
| `shared/audit/logger.py` | Immutable audit log (tier 8) |
| `infrastructure/postgres/` | PostgreSQL schema + migrations |

## Services & ports

| Service | Port |
|---------|------|
| Gateway | 8000 |
| Auth | 8001 |
| Onboarding | 8002 |
| Org & Site | 8003 |
| Verification | 8004 |
| Payments | 8005 |
| Licensing | 8006 |
| ACL | 8007 |
| Observability | 8008 |

## First-time setup

```bash
./scripts/setup-local.sh   # PostgreSQL, Redis, RabbitMQ (macOS Homebrew)
cp .env.local.example .env
```

Stop all: `./scripts/stop-local.sh`
