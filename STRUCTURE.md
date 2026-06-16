# ViXa Platform — Project Structure

```
vixa-platform/
├── frontend/                    # Next.js React TypeScript client
├── mobile/                      # Flutter iOS/Android client
│   ├── app/
│   │   ├── register/            # User registration
│   │   ├── login/               # Login + MFA
│   │   ├── products/            # Products & Services (entitlement gating)
│   │   ├── onboarding/          # Full onboarding saga + payment callback
│   │   └── account/             # MFA enable, suspend, close account
│   ├── components/              # Shared UI (reCAPTCHA badge, etc.)
│   └── lib/api.ts               # API client with token refresh
├── gateway/                     # API Gateway (JWT + rate limiting)
│   └── app/middleware/
├── services/
│   ├── auth/                    # Auth + OAuth2/OIDC + audit query
│   ├── onboarding/              # Saga orchestrator with compensation
│   ├── org-site/                # Organisation & Site
│   ├── verification/            # Email/SMS OTP
│   ├── payments/                # Stripe + webhooks
│   ├── licensing/               # Licences, RBAC, entitlements
│   ├── acl/                     # Anti-corruption layer (Ost Infinity)
│   └── observability-node/      # Node.js health aggregation + audit viewer
├── workers/
│   ├── licence-provisioner/     # Event-driven licence provisioning
│   └── notification/            # Notification worker
├── shared/                      # Config, DB, Redis, audit, RabbitMQ
├── infrastructure/postgres/       # Schema init + seed data
├── scripts/                       # Local dev without Docker
├── tests/                         # pytest suite
├── docker-compose.yml
└── README.md
```
