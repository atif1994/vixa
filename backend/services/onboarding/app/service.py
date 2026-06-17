import uuid
from datetime import datetime, timezone
from enum import Enum

import httpx
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.audit.logger import AuditEventType, AuditLogger
from shared.config.settings import get_settings
from shared.messaging.events import EventPublisher, EventTopic
from services.onboarding.app.models import Saga

settings = get_settings()


def _service_urls() -> dict[str, str]:
    return {
        "auth": settings.auth_service_url,
        "verification": settings.verification_service_url,
        "org": settings.org_site_service_url,
        "payments": settings.payments_service_url,
        "licensing": settings.licensing_service_url,
    }


class OnboardingStep(str, Enum):
    REGISTRATION = "registration"
    ORG_CREATION = "org_creation"
    SITE_CREATION = "site_creation"
    EMAIL_VERIFICATION = "email_verification"
    MOBILE_VERIFICATION = "mobile_verification"
    CARD_VERIFICATION = "card_verification"
    SUBSCRIPTION = "subscription"
    ACTIVATION = "activation"
    COMPLETED = "completed"


class StartOnboardingRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str
    phone: str | None = None
    org_name: str
    country: str | None = None
    city: str | None = None
    address: str | None = None
    postcode: str | None = None
    telephone: str | None = None
    directors: list[str] | None = None
    site_name: str
    site_location: str | None = None
    site_managers: list[str] | None = None
    product_id: str
    payment_method_id: str = "pm_card_mock"


class OnboardingStatusResponse(BaseModel):
    saga_id: str
    correlation_id: str
    status: str
    current_step: str
    steps_completed: list
    user_id: str | None = None
    error_message: str | None = None


class OnboardingOrchestrator:
    """5-step architecture: identity/org → verify human → payment → (domain skipped) → activate."""

    STEPS = [
        OnboardingStep.REGISTRATION,
        OnboardingStep.ORG_CREATION,
        OnboardingStep.SITE_CREATION,
        OnboardingStep.EMAIL_VERIFICATION,
        OnboardingStep.MOBILE_VERIFICATION,
        OnboardingStep.CARD_VERIFICATION,
        OnboardingStep.SUBSCRIPTION,
        OnboardingStep.ACTIVATION,
        OnboardingStep.COMPLETED,
    ]

    def __init__(self, db: AsyncSession, audit: AuditLogger, publisher: EventPublisher | None = None):
        self.db = db
        self.audit = audit
        self.publisher = publisher

    async def start(self, req: StartOnboardingRequest) -> OnboardingStatusResponse:
        correlation_id = uuid.uuid4()
        saga = Saga(
            correlation_id=correlation_id,
            user_id=uuid.UUID(int=0),
            status="in_progress",
            current_step=OnboardingStep.REGISTRATION.value,
            payload=req.model_dump(),
        )
        self.db.add(saga)
        await self.db.flush()

        await self.audit.log(
            AuditEventType.ONBOARDING_STARTED,
            resource_type="saga",
            resource_id=str(saga.id),
            metadata={"correlation_id": str(correlation_id)},
        )

        try:
            await self._execute_saga(saga, req)
        except Exception as e:
            await self._compensate(saga, str(e))
            saga.status = "failed"
            saga.error_message = str(e)
            saga.updated_at = datetime.now(timezone.utc)

        return self._to_response(saga)

    async def _execute_saga(self, saga: Saga, req: StartOnboardingRequest) -> None:
        urls = _service_urls()
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1a: Registration + digital identity (ACL sync in auth register)
            resp = await client.post(
                f"{urls['auth']}/register",
                json={
                    "email": req.email,
                    "password": req.password,
                    "first_name": req.first_name,
                    "last_name": req.last_name,
                    "phone": req.phone,
                },
            )
            resp.raise_for_status()
            user = resp.json()
            saga.user_id = uuid.UUID(user["id"])
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.REGISTRATION.value]
            saga.current_step = OnboardingStep.ORG_CREATION.value
            await self.db.flush()

            # Step 1b: Organisation profile
            org_resp = await client.post(
                f"{urls['org']}/organisations",
                json={
                    "name": req.org_name,
                    "owner_user_id": user["id"],
                    "country": req.country,
                    "city": req.city,
                    "address": req.address,
                    "postcode": req.postcode,
                    "telephone": req.telephone,
                    "directors": req.directors,
                },
            )
            org_resp.raise_for_status()
            org = org_resp.json()
            saga.payload = {**(saga.payload or {}), "org_id": org["id"]}
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.ORG_CREATION.value]
            saga.current_step = OnboardingStep.SITE_CREATION.value

            # Step 1c: Site profile
            site_resp = await client.post(
                f"{urls['org']}/organisations/{org['id']}/sites",
                json={
                    "name": req.site_name,
                    "location": req.site_location,
                    "managers": req.site_managers,
                },
            )
            site_resp.raise_for_status()
            site = site_resp.json()
            saga.payload = {**(saga.payload or {}), "site_id": site["id"]}
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.SITE_CREATION.value]
            saga.current_step = OnboardingStep.EMAIL_VERIFICATION.value

            # Step 2a: Email OTP
            otp_resp = await client.post(
                f"{urls['verification']}/otp/send",
                json={"channel": "email", "target": req.email, "user_id": user["id"]},
            )
            otp_resp.raise_for_status()
            otp_data = otp_resp.json()
            code = otp_data.get("dev_code", "000000")
            await client.post(
                f"{urls['verification']}/otp/verify",
                json={"channel": "email", "target": req.email, "code": code, "user_id": user["id"]},
            )
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.EMAIL_VERIFICATION.value]

            # Step 2b: Mobile OTP (if phone provided)
            if req.phone:
                sms_resp = await client.post(
                    f"{urls['verification']}/otp/send",
                    json={"channel": "sms", "target": req.phone, "user_id": user["id"]},
                )
                sms_resp.raise_for_status()
                sms_data = sms_resp.json()
                sms_code = sms_data.get("dev_code", "000000")
                await client.post(
                    f"{urls['verification']}/otp/verify",
                    json={"channel": "sms", "target": req.phone, "code": sms_code, "user_id": user["id"]},
                )
                saga.steps_completed = [*saga.steps_completed, OnboardingStep.MOBILE_VERIFICATION.value]

            saga.current_step = OnboardingStep.CARD_VERIFICATION.value

            # Step 3: Card verification (€1 hold)
            pay_resp = await client.post(
                f"{urls['payments']}/verify-card",
                json={"user_id": user["id"], "payment_method_id": req.payment_method_id},
            )
            pay_resp.raise_for_status()
            payment = pay_resp.json()
            await client.post(f"{urls['payments']}/confirm/{payment['transaction_id']}")
            saga.payload = {**(saga.payload or {}), "transaction_id": payment["transaction_id"]}
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.CARD_VERIFICATION.value]
            saga.current_step = OnboardingStep.SUBSCRIPTION.value

            # Step 5a: Subscribe (licence provisioned async via event)
            sub_resp = await client.post(
                f"{urls['payments']}/subscribe",
                json={
                    "user_id": user["id"],
                    "product_id": req.product_id,
                    "payment_method_id": req.payment_method_id,
                },
            )
            sub_resp.raise_for_status()
            subscription = sub_resp.json()
            saga.payload = {**(saga.payload or {}), "subscription_id": subscription["subscription_id"]}
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.SUBSCRIPTION.value]
            saga.current_step = OnboardingStep.ACTIVATION.value

            # Step 5b: Activate account
            await client.post(f"{urls['auth']}/users/{user['id']}/activate")
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.ACTIVATION.value]
            saga.steps_completed = [*saga.steps_completed, OnboardingStep.COMPLETED.value]
            saga.current_step = OnboardingStep.COMPLETED.value
            saga.status = "completed"
            saga.updated_at = datetime.now(timezone.utc)

            await self.audit.log(
                AuditEventType.ONBOARDING_COMPLETED,
                actor_id=user["id"],
                resource_type="saga",
                resource_id=str(saga.id),
            )

            if self.publisher:
                await self.publisher.publish(
                    EventTopic.ONBOARDING_STEP,
                    {"saga_id": str(saga.id), "status": "completed", "user_id": user["id"]},
                    correlation_id=str(saga.correlation_id),
                )

    async def _compensate(self, saga: Saga, error: str) -> None:
        urls = _service_urls()
        payload = saga.payload or {}
        user_id = str(saga.user_id) if saga.user_id and saga.user_id.int != 0 else None

        async with httpx.AsyncClient(timeout=15.0) as client:
            for step in reversed(list(saga.steps_completed)):
                try:
                    if step == OnboardingStep.SUBSCRIPTION.value and payload.get("subscription_id") and user_id:
                        await client.post(
                            f"{urls['licensing']}/licences/revoke",
                            json={"user_id": user_id, "product_id": payload.get("product_id")},
                        )
                        await client.post(
                            f"{urls['payments']}/subscriptions/{payload['subscription_id']}/cancel",
                        )
                    elif step == OnboardingStep.CARD_VERIFICATION.value and payload.get("transaction_id"):
                        await client.post(
                            f"{urls['payments']}/transactions/{payload['transaction_id']}/cancel",
                        )
                    elif step == OnboardingStep.SITE_CREATION.value and payload.get("site_id"):
                        await client.delete(f"{urls['org']}/sites/{payload['site_id']}")
                    elif step == OnboardingStep.ORG_CREATION.value and payload.get("org_id"):
                        await client.delete(f"{urls['org']}/organisations/{payload['org_id']}")
                    elif step == OnboardingStep.REGISTRATION.value and user_id:
                        await client.post(
                            f"{urls['auth']}/users/{user_id}/suspend",
                            json={"reason": f"Onboarding compensation: {error}"},
                        )
                except Exception:
                    pass
                saga.compensation_log = [
                    *saga.compensation_log,
                    {"step": step, "action": "compensated", "error": error},
                ]

        await self.audit.log(
            AuditEventType.ONBOARDING_FAILED,
            actor_id=str(saga.user_id) if saga.user_id else None,
            resource_type="saga",
            resource_id=str(saga.id),
            metadata={"error": error},
        )

    async def get_status(self, saga_id: str) -> OnboardingStatusResponse:
        result = await self.db.execute(select(Saga).where(Saga.id == uuid.UUID(saga_id)))
        saga = result.scalar_one_or_none()
        if not saga:
            raise ValueError("Saga not found")
        return self._to_response(saga)

    def _to_response(self, saga: Saga) -> OnboardingStatusResponse:
        return OnboardingStatusResponse(
            saga_id=str(saga.id),
            correlation_id=str(saga.correlation_id),
            status=saga.status,
            current_step=saga.current_step,
            steps_completed=saga.steps_completed or [],
            user_id=str(saga.user_id) if saga.user_id and saga.user_id.int != 0 else None,
            error_message=saga.error_message,
        )
