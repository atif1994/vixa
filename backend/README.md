# ViXa CIAM — Backend (NestJS)

## Run

```bash
npm install
cp .env.example .env
npx prisma db push && npx ts-node prisma/seed.ts
npm run start:dev
```

OpenAPI: http://localhost:8000/api/docs

## Module map

| Module | Path | Architecture tier |
|--------|------|-------------------|
| Gateway / entry | `src/main.ts`, guards | Edge + API gateway |
| EdgeModule | `src/edge/` | CDN/WAF stub, reCAPTCHA |
| AuthModule | `src/ciam/auth/` | Identity, JWT, refresh, MFA hooks |
| MfaModule | `src/ciam/mfa/` | OTP in Redis (email/SMS mocked) |
| OrchestratorModule | `src/ciam/orchestrator/` | 5-step onboarding saga + compensation |
| OrgModule | `src/domains/org/` | Organisation & site profiles |
| VerificationModule | `src/domains/verification/` | Email/SMS OTP |
| PaymentsModule | `src/domains/payments/` | Stripe sandbox / mock €1 hold |
| LicensingModule | `src/domains/licensing/` | Products, licences, entitlements |
| EventsModule | `src/events/` | BullMQ event bus + DLQ table |
| AclModule | `src/acl/` | Anti-corruption layer (only Ost Infinity write path) |
| OstInfinityModule | `src/ost-infinity/` | Mock system of record |
| PlatformModule | `src/platform/` | Prisma, Redis, Vault, audit log |

## API versioning

All routes under `/api/v1/`. Future breaking changes ship as `/api/v2/` with deprecation headers on v1.

## Extracting microservices later

Each module is a NestJS `@Module` with its own controllers/services. To extract:

1. Move module to standalone app
2. Replace in-process calls with `@nestjs/microservices` transport (TCP/Kafka)
3. Keep ACL as the only Ost Infinity integration point

See `docs/RECOMMENDATIONS.md` for authentication, rate limiting, and data modelling notes.
