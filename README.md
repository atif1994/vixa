# ViXa Platform CIAM

Customer Identity & Access Management system for the Ost Infinity ecosystem.

## Architecture

```
Clients (Next.js + Flutter) → Edge (Gateway) → CIAM Core → Domain Services → Event Backbone → ACL → Ost Infinity
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8000 | JWT validation, rate limiting, routing |
| Auth Service | 8001 | Registration, login, JWT, MFA |
| Onboarding Orchestrator | 8002 | 5-step saga with compensating actions |
| Org & Site Service | 8003 | Organisation and site management |
| Verification Service | 8004 | Email/SMS OTP |
| Payments Service | 8005 | Stripe card verification & subscriptions |
| Licensing & RBAC | 8006 | Products, licences, entitlements |
| Anti-Corruption Layer | 8007 | Ost Infinity integration |
| Observability | 8008 | Service health + audit log dashboard API |

## Quick Start (Local — macOS / Homebrew)

### First-time setup

```bash
./scripts/setup-local.sh
cp .env.local.example .env
python3 -m venv .venv && source .venv/bin/activate
pip install -r shared/requirements.txt
cd frontend && npm install && cd ..
```

### Run backend

```bash
./scripts/stop-local.sh && ./scripts/start-local.sh
```

### Run frontend (separate terminal)

```bash
cd frontend && npm run dev
```

- Frontend: http://localhost:3000  
- API Gateway: http://localhost:8000  
- Observability UI: http://localhost:3000/observability  

### Mobile app

```bash
cd mobile && flutter pub get && flutter run
```

### Stop all services

```bash
./scripts/stop-local.sh
```

## Docker (optional)

```bash
cp .env.local.example .env
docker compose up -d
```

## Tests

```bash
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
cd mobile && flutter test
```

## MVP Features

- User registration + digital identity
- Organisation and site creation (extended profile fields)
- reCAPTCHA, email OTP, mobile OTP verification
- Login with JWT + rotating refresh token + MFA
- Stripe card verification (€1 hold, mock + real paths)
- 5 canonical products (ViXa Platform base + 4 subscriptions)
- Product subscription, licence assignment, entitlement gating
- JWT entitlement claims
- Account suspend / close
- Event-driven licence provisioning
- Immutable audit logging + observability dashboard

## Environment

Copy `.env.local.example` to `.env`. Never commit `.env` — it is gitignored.
