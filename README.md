# ViXa Platform CIAM

Customer Identity & Access Management for the Ost Infinity ecosystem.

## Repository layout

```
vixa/
├── backend/          # FastAPI microservices, gateway, workers, tests
├── frontend/         # Next.js web app
├── mobile/           # Flutter iOS/Android app
├── docs/             # Architecture & structure docs
├── docker-compose.yml
└── README.md
```

## Quick start

### 1. Backend

```bash
cd backend
./scripts/setup-local.sh          # first time only
cp .env.local.example .env
python3 -m venv .venv && source .venv/bin/activate
pip install -r shared/requirements.txt
./scripts/start-local.sh
```

Or from repo root:

```bash
./scripts/start-local.sh
```

Gateway: http://localhost:8000

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Web app: http://localhost:3000

### 3. Mobile (optional)

```bash
cd mobile
flutter pub get
flutter run
```

## Docker

```bash
cp backend/.env.local.example backend/.env
docker compose up -d
```

## Tests

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v

cd ../mobile && flutter test
```

## Documentation

- [Backend README](backend/README.md) — services, ports, module map
- [Frontend README](frontend/README.md) — pages and env vars
- [Architecture structure](docs/STRUCTURE.md)

## MVP features

- Identity-first onboarding saga (register → org → verify → pay → activate)
- JWT + refresh tokens + MFA + entitlement claims
- 5 canonical products (ViXa Platform base + 4 subscriptions)
- Event-driven licence provisioning
- Immutable audit log + observability dashboard
