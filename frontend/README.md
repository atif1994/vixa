# ViXa CIAM — Frontend (Next.js 14)

React/TypeScript web client for ViXa Platform onboarding, login, products, and account management.

## Run

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

Requires the backend API gateway at `http://localhost:8000` (see `../backend/README.md`).

## Architecture

- **Gateway only** — all backend calls go through `NEXT_PUBLIC_API_URL/api/v1/*`; never call Ost Infinity or internal services directly.
- **Cookie auth** — access/refresh tokens stored in httpOnly cookies via Next.js Route Handlers (`/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`). Tokens are never stored in localStorage.
- **`lib/api-server.ts`** — server-side fetch with cookies (SSR pages).
- **`lib/api-client.ts`** — client components call Route Handlers or the BFF proxy at `/api/bff/*`.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home |
| `/register` | Simple registration |
| `/onboarding` | Full onboarding saga with org profile |
| `/login` | Login + MFA |
| `/products` | Products & Services (base = Included, subscriptions = upsell/entitled) |
| `/observability` | Service health + audit log dashboard |
| `/account` | MFA, suspend, close account |

## Environment

Set in `.env.local` (optional — defaults work for local dev):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=mock_recaptcha_site_key
```
