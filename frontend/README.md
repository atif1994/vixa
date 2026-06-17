# ViXa CIAM — Frontend (Next.js)

React/TypeScript web client for ViXa Platform onboarding, login, products, and account management.

## Run

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

Requires the backend gateway running at http://localhost:8000 (see `../backend/README.md`).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home |
| `/register` | Simple registration |
| `/onboarding` | Full 5-step onboarding saga |
| `/login` | Login + MFA |
| `/products` | Products & Services (entitlement tiles) |
| `/observability` | Service health + audit log dashboard |
| `/account` | MFA, suspend, close account |

## Environment

Set in `.env.local` (optional — defaults work for local dev):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=mock_recaptcha_site_key
```
