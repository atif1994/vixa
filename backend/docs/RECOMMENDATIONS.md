# ViXa CIAM — Architecture Recommendations

Written guidance for production hardening (MVP implements the core path).

## API versioning strategy

- **Current:** `/api/v1/` prefix on all REST endpoints.
- **Policy:** Non-breaking additions (new optional fields, new endpoints) stay on v1. Breaking changes require v2.
- **Deprecation:** `Sunset` and `Deprecation` HTTP headers on v1 routes before removal.
- **OpenAPI:** Generated at `/api/docs` from NestJS decorators — keep DTOs as source of truth.

## Authentication & session strategy

| Approach | MVP | Production recommendation |
|----------|-----|---------------------------|
| Access token | Short-lived JWT (15 min) with entitlement claims | Same; consider RS256 with JWKS |
| Refresh token | Rotating, stored in DB + Redis | httpOnly cookie on web (frontend BFF); mobile uses secure storage |
| MFA | Email OTP mock | Step-up MFA on risk signals (new device, geo, velocity) |
| SSO/OIDC federation | **Deferred** | Add external IdP federation layer in AuthModule |

**Trade-off:** JWT entitlements are fast at the gateway but can be stale until refresh. For high-security product gates, combine JWT claims with a live entitlement check on sensitive routes.

## Rate limiting

- **Implementation:** `@nestjs/throttler` global guard (100 req/min default, 20/min on auth routes).
- **Production:** Add Redis-backed throttler storage for multi-instance consistency.
- **Thresholds (starting point):** Login 20/min/IP; OTP send 5/min/target; onboarding start 3/hour/IP.

## Data modelling — identity vs system of record

| Store | Owns | Never |
|-------|------|-------|
| CIAM (Postgres `users`, sessions) | Credentials, MFA flags, digital identity ID | Customer master profile, licences |
| Ost Infinity (mock tables / real API) | Customer, org, site, licence master data | Passwords, refresh tokens |
| ACL sync records | Idempotency keys, mapping local ↔ Ost IDs | Business logic |

All writes to Ost Infinity **must** go through `AclService` with `X-Idempotency-Key`.

## Error handling conventions

- **Format:** RFC 7807 `application/problem+json` via `ProblemDetailsFilter`.
- **Codes:** 400 validation, 401 auth, 403 entitlement, 404 not found, 409 conflict (duplicate idempotency), 429 rate limit, 502 upstream (Stripe/Ost Infinity).
- **Correlation:** `X-Correlation-Id` header propagated through saga steps and audit log.

## Event backbone

- **MVP:** BullMQ on Redis with retry (3 attempts, exponential backoff) and `dead_letter_events` table.
- **Production:** Replace with Kafka or RabbitMQ for durable fan-out; keep the same event envelope in `events/constants.ts`.

## Frontend state management

- **Auth:** httpOnly cookies via Next.js Route Handlers (`/api/auth/*`) — tokens never in `localStorage`.
- **Server data:** React Server Components + `api-server.ts` for SSR pages (products, account).
- **Client mutations:** Route Handlers + optional React Query/SWR for optimistic UI on onboarding forms.
- **Rule:** Browser never calls Ost Infinity or internal service URLs — only the gateway `/api/v1/*`.

## Out of MVP scope (explicitly deferred)

- Domain verification (TXT/CNAME) and domain-verified feature unlock
- SSO/OIDC federation with external IdPs
- Multiple payment providers (Stripe only for MVP)
- Advanced admin console (security policy, departments)
- Fine-grained RBAC beyond admin/standard roles
- Multi-region data residency
- Dead-letter queue replay UI
- Update payment preferences post-onboarding
- €1 hold automatic refund after 3 days (stub documented in PaymentsService)
