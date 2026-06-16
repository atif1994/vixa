import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.audit.logger import AuditEventType, AuditLogger
from shared.config.settings import get_settings
from shared.redis_client.session_store import SessionStore
from services.auth.app.models import User
from services.auth.app.security import generate_otp
from services.verification.app.models import OTPRecord

logger = logging.getLogger(__name__)
settings = get_settings()


class SendOTPRequest(BaseModel):
    channel: str  # email | sms
    target: str
    user_id: str | None = None


class VerifyOTPRequest(BaseModel):
    channel: str
    target: str
    code: str
    user_id: str | None = None


class OTPResponse(BaseModel):
    message: str
    expires_in: int = 600
    dev_code: str | None = None


class VerificationService:
    def __init__(self, db: AsyncSession, session_store: SessionStore, audit: AuditLogger):
        self.db = db
        self.session_store = session_store
        self.audit = audit

    def _hash_code(self, code: str) -> str:
        return hashlib.sha256(code.encode()).hexdigest()

    async def send_otp(self, req: SendOTPRequest) -> OTPResponse:
        code = generate_otp()
        expires = datetime.now(timezone.utc) + timedelta(minutes=10)

        record = OTPRecord(
            user_id=uuid.UUID(req.user_id) if req.user_id else None,
            channel=req.channel,
            target=req.target,
            code_hash=self._hash_code(code),
            expires_at=expires,
        )
        self.db.add(record)
        await self.session_store.store_otp(req.channel, req.target, code)

        if req.channel == "email":
            await self._send_email(req.target, code)
        elif req.channel == "sms":
            await self._send_sms(req.target, code)
        else:
            raise ValueError("Invalid channel")

        await self.audit.log(
            AuditEventType.OTP_SENT,
            actor_id=req.user_id,
            metadata={"channel": req.channel, "target": req.target},
        )

        dev_code = code if settings.email_provider == "mock" or settings.sms_provider == "mock" else None
        return OTPResponse(message=f"OTP sent via {req.channel}", dev_code=dev_code)

    async def verify_otp(self, req: VerifyOTPRequest) -> dict:
        valid = await self.session_store.verify_otp(req.channel, req.target, req.code)
        if not valid:
            raise ValueError("Invalid or expired OTP")

        if req.user_id:
            result = await self.db.execute(select(User).where(User.id == uuid.UUID(req.user_id)))
            user = result.scalar_one_or_none()
            if user:
                if req.channel == "email":
                    user.email_verified = True
                elif req.channel == "sms":
                    user.phone_verified = True
                if user.email_verified and (user.phone_verified or not user.phone):
                    user.status = "active"
                user.updated_at = datetime.now(timezone.utc)

        await self.audit.log(
            AuditEventType.OTP_VERIFIED,
            actor_id=req.user_id,
            metadata={"channel": req.channel, "target": req.target},
        )
        return {"verified": True, "channel": req.channel, "target": req.target}

    async def _send_email(self, email: str, code: str) -> None:
        if settings.email_provider == "mock":
            logger.info("[MOCK EMAIL] To: %s Code: %s", email, code)
            return
        logger.info("Sending email OTP to %s", email)

    async def _send_sms(self, phone: str, code: str) -> None:
        if settings.sms_provider == "mock":
            logger.info("[MOCK SMS] To: %s Code: %s", phone, code)
            return
        logger.info("Sending SMS OTP to %s", phone)
