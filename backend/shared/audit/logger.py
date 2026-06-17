import hashlib
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import DateTime, String, Text, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.database.base import Base


class AuditEventType(str, Enum):
    USER_REGISTERED = "user.registered"
    USER_LOGIN = "user.login"
    USER_LOGIN_FAILED = "user.login_failed"
    USER_LOGOUT = "user.logout"
    MFA_CHALLENGE = "mfa.challenge"
    MFA_VERIFIED = "mfa.verified"
    TOKEN_REFRESH = "token.refresh"
    TOKEN_REVOKED = "token.revoked"
    ORG_CREATED = "org.created"
    SITE_CREATED = "site.created"
    OTP_SENT = "otp.sent"
    OTP_VERIFIED = "otp.verified"
    PAYMENT_INITIATED = "payment.initiated"
    PAYMENT_CONFIRMED = "payment.confirmed"
    PAYMENT_FAILED = "payment.failed"
    LICENCE_ASSIGNED = "licence.assigned"
    ACCOUNT_SUSPENDED = "account.suspended"
    ACCOUNT_CLOSED = "account.closed"
    ONBOARDING_STARTED = "onboarding.started"
    ONBOARDING_COMPLETED = "onboarding.completed"
    ONBOARDING_FAILED = "onboarding.failed"


class AuditLog(Base):
    """Immutable audit log — append-only, no updates or deletes."""

    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "audit"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


def compute_checksum(event_type: str, actor_id: str | None, metadata: dict | None) -> str:
    payload = json.dumps(
        {"event_type": event_type, "actor_id": actor_id, "metadata": metadata or {}},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


class AuditLogger:
    def __init__(self, session):
        self.session = session

    async def log(
        self,
        event_type: AuditEventType | str,
        actor_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLog:
        event_str = event_type.value if isinstance(event_type, AuditEventType) else event_type
        checksum = compute_checksum(event_str, actor_id, metadata)
        entry = AuditLog(
            event_type=event_str,
            actor_id=actor_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            event_metadata=metadata,
            checksum=checksum,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def query(
        self,
        event_type: str | None = None,
        actor_id: str | None = None,
        limit: int = 100,
    ) -> list[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        if event_type:
            stmt = stmt.where(AuditLog.event_type == event_type)
        if actor_id:
            stmt = stmt.where(AuditLog.actor_id == actor_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
