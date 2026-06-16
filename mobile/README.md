# ViXa Mobile (Flutter)

Flutter mobile client for the ViXa CIAM platform. Connects to the same API gateway as the Next.js web app.

## Features

- User registration with digital identity
- Login with JWT + MFA support
- Full onboarding saga (register → OTP → org → site → payment → subscribe)
- Products & Services with entitled filtering
- Account management (MFA, suspend, close)
- Secure token storage (`flutter_secure_storage`)
- Auto token refresh on 401

## Prerequisites

- Flutter SDK 3.9+
- ViXa backend running (`./scripts/start-local.sh`)

## Run

```bash
cd mobile
flutter pub get
flutter run
```

### API URL

| Platform | Default URL |
|----------|-------------|
| iOS Simulator | `http://127.0.0.1:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Physical device | Your Mac's LAN IP |

Custom URL:

```bash
flutter run --dart-define=API_URL=http://192.168.1.10:8000
```

## Project structure

```
mobile/lib/
├── config/app_config.dart      # API base URL
├── models/models.dart          # User, Product, TokenResponse
├── services/
│   ├── api_service.dart        # HTTP client + token refresh
│   └── auth_storage.dart       # Secure token storage
├── screens/
│   ├── home_screen.dart
│   ├── login_screen.dart
│   ├── register_screen.dart
│   ├── onboarding_screen.dart
│   ├── products_screen.dart
│   └── account_screen.dart
└── theme/app_theme.dart
```

## Tests

```bash
flutter test
```
