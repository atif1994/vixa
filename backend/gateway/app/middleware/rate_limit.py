import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from shared.config.settings import get_settings
from shared.redis_client.session_store import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path == "/health":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", None)
        key = f"vixa:ratelimit:{user_id or client_ip}"

        try:
            redis = await get_redis()
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, settings.gateway_rate_window_seconds)

            if current > settings.gateway_rate_limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded"},
                    headers={"Retry-After": str(settings.gateway_rate_window_seconds)},
                )
        except Exception as exc:
            logger.warning("Rate limit check failed: %s", exc)
            return JSONResponse(status_code=503, content={"detail": "Rate limiting unavailable"})

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.gateway_rate_limit)
        return response
