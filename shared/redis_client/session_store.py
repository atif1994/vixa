import json
from typing import Any

import redis.asyncio as redis

from shared.config.settings import get_settings

_settings = get_settings()
_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(_settings.redis_url, decode_responses=True)
    return _pool


class SessionStore:
    """Redis-backed session and refresh token store."""

    PREFIX = "vixa:session:"
    REFRESH_PREFIX = "vixa:refresh:"
    OTP_PREFIX = "vixa:otp:"
    MFA_PREFIX = "vixa:mfa:"

    def __init__(self, client: redis.Redis):
        self.client = client

    async def set_session(self, session_id: str, data: dict[str, Any], ttl_seconds: int) -> None:
        await self.client.setex(f"{self.PREFIX}{session_id}", ttl_seconds, json.dumps(data))

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        raw = await self.client.get(f"{self.PREFIX}{session_id}")
        return json.loads(raw) if raw else None

    async def delete_session(self, session_id: str) -> None:
        await self.client.delete(f"{self.PREFIX}{session_id}")

    async def store_refresh_token(self, token_id: str, user_id: str, ttl_seconds: int) -> None:
        await self.client.setex(f"{self.REFRESH_PREFIX}{token_id}", ttl_seconds, user_id)

    async def get_refresh_token_user(self, token_id: str) -> str | None:
        return await self.client.get(f"{self.REFRESH_PREFIX}{token_id}")

    async def revoke_refresh_token(self, token_id: str) -> None:
        await self.client.delete(f"{self.REFRESH_PREFIX}{token_id}")

    async def store_otp(self, channel: str, target: str, code: str, ttl_seconds: int = 600) -> None:
        key = f"{self.OTP_PREFIX}{channel}:{target}"
        await self.client.setex(key, ttl_seconds, code)

    async def verify_otp(self, channel: str, target: str, code: str) -> bool:
        key = f"{self.OTP_PREFIX}{channel}:{target}"
        stored = await self.client.get(key)
        if stored and stored == code:
            await self.client.delete(key)
            return True
        return False

    async def store_mfa_pending(self, user_id: str, data: dict[str, Any], ttl_seconds: int = 300) -> None:
        await self.client.setex(f"{self.MFA_PREFIX}{user_id}", ttl_seconds, json.dumps(data))

    async def get_mfa_pending(self, user_id: str) -> dict[str, Any] | None:
        raw = await self.client.get(f"{self.MFA_PREFIX}{user_id}")
        return json.loads(raw) if raw else None

    async def clear_mfa_pending(self, user_id: str) -> None:
        await self.client.delete(f"{self.MFA_PREFIX}{user_id}")
