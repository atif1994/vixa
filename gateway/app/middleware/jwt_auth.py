import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from shared.config.settings import get_settings
from services.auth.app.security import verify_access_token

settings = get_settings()

PUBLIC_PATHS = {
    "/health",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/mfa/verify",
    "/api/auth/refresh",
    "/api/auth/oauth/token",
    "/api/auth/.well-known/openid-configuration",
    "/api/verification/otp/send",
    "/api/verification/otp/verify",
    "/api/payments/webhooks/stripe",
    "/api/onboarding/start",
    "/api/licensing/products",
}

PUBLIC_PREFIXES = (
    "/api/onboarding/status/",
    "/api/observability",
)


def is_public_path(path: str) -> bool:
    if path in PUBLIC_PATHS:
        return True
    return any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        if is_public_path(path) or request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid authorization header"})

        token = auth_header.split(" ", 1)[1]
        payload = verify_access_token(token)
        if not payload:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        request.state.user_id = payload.get("sub")
        request.state.user_email = payload.get("email")
        return await call_next(request)
