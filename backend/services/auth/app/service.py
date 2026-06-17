import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.audit.logger import AuditEventType, AuditLogger
from shared.config.settings import get_settings
from shared.messaging.events import EventPublisher, EventTopic
from shared.redis_client.session_store import SessionStore
from services.auth.app.models import RefreshToken, User
from services.licensing.app.models import Licence, Product
from services.auth.app.schemas import (
    LoginRequest,
    MFAVerifyRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from services.auth.app.security import (
    create_access_token,
    create_refresh_token,
    generate_digital_identity_id,
    generate_otp,
    hash_password,
    verify_password,
)

settings = get_settings()


async def verify_recaptcha(token: str | None) -> bool:
    if not token:
        return settings.recaptcha_secret_key.startswith("mock")
    if settings.recaptcha_secret_key.startswith("mock"):
        return True
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": settings.recaptcha_secret_key, "response": token},
        )
        data = resp.json()
        return data.get("success", False)


class AuthService:
    def __init__(
        self,
        db: AsyncSession,
        session_store: SessionStore,
        audit: AuditLogger,
        publisher: EventPublisher | None = None,
    ):
        self.db = db
        self.session_store = session_store
        self.audit = audit
        self.publisher = publisher

    async def register(self, req: RegisterRequest, ip: str | None = None) -> UserResponse:
        if not await verify_recaptcha(req.recaptcha_token):
            raise ValueError("reCAPTCHA verification failed")

        existing = await self.db.execute(select(User).where(User.email == req.email))
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            digital_identity_id=generate_digital_identity_id(),
            status="pending_verification",
        )
        self.db.add(user)
        await self.db.flush()

        await self._sync_customer_to_ost(user)

        await self.audit.log(
            AuditEventType.USER_REGISTERED,
            actor_id=str(user.id),
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip,
            metadata={"email": user.email},
        )

        if self.publisher:
            await self.publisher.publish(
                EventTopic.USER_REGISTERED,
                {"user_id": str(user.id), "email": user.email},
            )

        return UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            digital_identity_id=str(user.digital_identity_id),
            status=user.status,
            mfa_enabled=user.mfa_enabled,
            email_verified=user.email_verified,
            phone_verified=user.phone_verified,
        )

    async def login(self, req: LoginRequest, ip: str | None = None) -> TokenResponse:
        if not await verify_recaptcha(req.recaptcha_token):
            raise ValueError("reCAPTCHA verification failed")

        result = await self.db.execute(select(User).where(User.email == req.email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(req.password, user.password_hash):
            await self.audit.log(AuditEventType.USER_LOGIN_FAILED, ip_address=ip, metadata={"email": req.email})
            raise ValueError("Invalid credentials")

        if user.status == "suspended":
            raise ValueError("Account suspended")
        if user.status == "closed":
            raise ValueError("Account closed")

        if user.mfa_enabled:
            mfa_session_id = str(uuid.uuid4())
            otp = generate_otp()
            await self.session_store.store_mfa_pending(
                mfa_session_id,
                {"user_id": str(user.id), "otp": otp, "email": user.email},
            )
            await self.session_store.store_otp("email", user.email, otp)
            await self.audit.log(
                AuditEventType.MFA_CHALLENGE,
                actor_id=str(user.id),
                ip_address=ip,
            )
            return TokenResponse(
                access_token="",
                refresh_token="",
                expires_in=0,
                mfa_required=True,
                mfa_session_id=mfa_session_id,
            )

        return await self._issue_tokens(user, ip)

    async def verify_mfa(self, req: MFAVerifyRequest, ip: str | None = None) -> TokenResponse:
        pending = await self.session_store.get_mfa_pending(req.mfa_session_id)
        if not pending:
            raise ValueError("MFA session expired")

        if pending.get("otp") != req.code:
            raise ValueError("Invalid MFA code")

        await self.session_store.clear_mfa_pending(req.mfa_session_id)
        result = await self.db.execute(select(User).where(User.id == uuid.UUID(pending["user_id"])))
        user = result.scalar_one()
        await self.audit.log(AuditEventType.MFA_VERIFIED, actor_id=str(user.id), ip_address=ip)
        return await self._issue_tokens(user, ip)

    async def _get_entitlement_slugs(self, user_id: str) -> list[str]:
        result = await self.db.execute(select(Product).where(Product.active == True))
        products = result.scalars().all()
        lic_result = await self.db.execute(
            select(Licence.product_id).where(
                Licence.user_id == uuid.UUID(user_id),
                Licence.status == "active",
            )
        )
        licensed = {row[0] for row in lic_result.all()}
        return [p.slug for p in products if p.is_base or p.id in licensed]

    async def _sync_customer_to_ost(self, user: User) -> None:
        idempotency_key = f"customer:{user.id}"
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{settings.ost_infinity_base_url}/sync",
                    json={
                        "entity_type": "customer",
                        "local_id": str(user.id),
                        "payload": {
                            "email": user.email,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "digital_identity_id": str(user.digital_identity_id),
                        },
                    },
                    headers={
                        "X-Idempotency-Key": idempotency_key,
                        "X-API-Key": settings.ost_infinity_api_key,
                    },
                    timeout=10.0,
                )
        except Exception:
            pass

    async def activate_account(self, user_id: str) -> UserResponse:
        result = await self.db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one()
        user.status = "active"
        user.updated_at = datetime.now(timezone.utc)
        await self.audit.log(
            AuditEventType.USER_REGISTERED,
            actor_id=user_id,
            resource_type="user",
            resource_id=user_id,
            metadata={"action": "activated"},
        )
        return await self.get_user(user_id)

    async def _issue_tokens(self, user: User, ip: str | None) -> TokenResponse:
        entitlements = await self._get_entitlement_slugs(str(user.id))
        access = create_access_token(
            str(user.id),
            user.email,
            {"entitlements": entitlements},
        )
        refresh, token_hash, expires = create_refresh_token(str(user.id))

        rt = RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires)
        self.db.add(rt)
        ttl = int((expires - datetime.now(timezone.utc)).total_seconds())
        await self.session_store.store_refresh_token(token_hash, str(user.id), ttl)

        await self.audit.log(AuditEventType.USER_LOGIN, actor_id=str(user.id), ip_address=ip)

        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            expires_in=settings.jwt_access_expire_minutes * 60,
        )

    async def refresh(self, refresh_token: str, ip: str | None = None) -> TokenResponse:
        from services.auth.app.security import decode_token
        import hashlib

        try:
            payload = decode_token(refresh_token)
        except Exception:
            raise ValueError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")

        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        stored_user = await self.session_store.get_refresh_token_user(token_hash)
        if not stored_user:
            raise ValueError("Refresh token revoked or expired")

        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash, RefreshToken.revoked == False)
        )
        rt = result.scalar_one_or_none()
        if not rt:
            raise ValueError("Refresh token not found")

        rt.revoked = True
        await self.session_store.revoke_refresh_token(token_hash)

        result = await self.db.execute(select(User).where(User.id == uuid.UUID(stored_user)))
        user = result.scalar_one()

        await self.audit.log(AuditEventType.TOKEN_REFRESH, actor_id=str(user.id), ip_address=ip)
        return await self._issue_tokens(user, ip)

    async def get_user(self, user_id: str) -> UserResponse:
        result = await self.db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")
        return UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            digital_identity_id=str(user.digital_identity_id) if user.digital_identity_id else None,
            status=user.status,
            mfa_enabled=user.mfa_enabled,
            email_verified=user.email_verified,
            phone_verified=user.phone_verified,
        )

    async def suspend_account(self, user_id: str, reason: str | None = None) -> UserResponse:
        result = await self.db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one()
        user.status = "suspended"
        user.updated_at = datetime.now(timezone.utc)
        await self.audit.log(
            AuditEventType.ACCOUNT_SUSPENDED,
            actor_id=user_id,
            metadata={"reason": reason},
        )
        if self.publisher:
            await self.publisher.publish(EventTopic.ACCOUNT_SUSPENDED, {"user_id": user_id})
        return await self.get_user(user_id)

    async def close_account(self, user_id: str, reason: str | None = None) -> UserResponse:
        result = await self.db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one()
        user.status = "closed"
        user.updated_at = datetime.now(timezone.utc)
        await self.audit.log(
            AuditEventType.ACCOUNT_CLOSED,
            actor_id=user_id,
            metadata={"reason": reason},
        )
        if self.publisher:
            await self.publisher.publish(EventTopic.ACCOUNT_CLOSED, {"user_id": user_id})
        return await self.get_user(user_id)

    async def enable_mfa(self, user_id: str) -> UserResponse:
        result = await self.db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one()
        user.mfa_enabled = True
        return await self.get_user(user_id)
