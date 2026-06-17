# ViXa Platform CIAM

Customer Identity & Access Management for the Ost Infinity ecosystem.

**Stack:** NestJS (TypeScript) backend · Next.js (TypeScript) frontend

## Repository layout

```
vixa/
├── backend/     # NestJS monolith — all architecture layers as modules
└── frontend/    # Next.js web client (SSR + httpOnly cookie auth)
```

## Quick start

### One-time setup

```bash
cd /Users/mac/Desktop/task/vixa-platform
./setup-backend.sh
```

### Run (two terminals)

**Terminal 1 — Backend:**
```bash
cd /Users/mac/Desktop/task/vixa-platform
./start-backend.sh
```

**Terminal 2 — Frontend:**
```bash
cd /Users/mac/Desktop/task/vixa-platform
./start-frontend.sh
```

> **Important:** `backend/` is next to `frontend/`, not inside it.  
> From `frontend/`, use `cd ../backend` — not `cd backend`.

### Manual commands (if you prefer)

```bash
# Backend
cd /Users/mac/Desktop/task/vixa-platform/backend
cp .env.example .env
npm install
npx prisma db push && npx ts-node prisma/seed.ts
npm run start:dev

# Frontend (separate terminal)
cd /Users/mac/Desktop/task/vixa-platform/frontend
npm run dev
```

### Old commands — do NOT use anymore

These were removed when we switched from Python to NestJS:

```bash
./scripts/start-local.sh   # REMOVED
./scripts/stop-local.sh    # REMOVED
pip install -r shared/requirements.txt  # REMOVED
```

### Docker Compose

```bash
docker compose up --build
```

## Architecture layers (all represented)

| Layer | Location | MVP notes |
|-------|----------|-----------|
| Clients | `frontend/` | SSR, tokens in httpOnly cookies |
| Edge & security | `backend/src/edge/` | CDN/WAF stub, reCAPTCHA mock |
| Gateway | `backend/src/main.ts` + guards | JWT, rate limit, entitlement gate |
| CIAM core | `backend/src/ciam/` | Auth, MFA, onboarding saga |
| Domain services | `backend/src/domains/` | Org, verification, payments, licensing |
| Event backbone | `backend/src/events/` | BullMQ (prod: Kafka/RabbitMQ) |
| Anti-corruption layer | `backend/src/acl/` | Idempotent Ost Infinity sync |
| Ost Infinity (SoR) | `backend/src/ost-infinity/` | Mock module for MVP |
| Platform | `backend/src/platform/` | Prisma/Postgres, Redis, vault, audit |

## Tests

```bash
cd backend
npm run test:e2e
```

Covers: register → verify → pay → subscribe → entitled access.

## Deferred (not forgotten)

Documented in code comments and `backend/docs/RECOMMENDATIONS.md`:

- Domain verification + domain-verified unlock
- SSO/OIDC federation with external IdPs
- Multiple payment providers
- Advanced admin / security policy
- Department/structure mapping
- Fine-grained RBAC beyond admin/standard
- Multi-region / data residency
- DLQ replay UI
- Update payment preferences post-onboarding

## GitHub

https://github.com/atif1994/vixa
