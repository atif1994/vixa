import uuid
from datetime import datetime, timezone

import stripe
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.audit.logger import AuditEventType, AuditLogger
from shared.config.settings import get_settings
from shared.messaging.events import EventPublisher, EventTopic
from services.payments.app.models import Customer, PaymentMethod, Subscription, Transaction

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


class CardVerifyRequest(BaseModel):
    user_id: str
    payment_method_id: str


class SubscribeRequest(BaseModel):
    user_id: str
    product_id: str
    payment_method_id: str


class PaymentResponse(BaseModel):
    transaction_id: str
    status: str
    client_secret: str | None = None
    redirect_url: str | None = None


class SubscriptionResponse(BaseModel):
    subscription_id: str
    status: str
    product_id: str


class PaymentsService:
    def __init__(self, db: AsyncSession, audit: AuditLogger, publisher: EventPublisher | None = None):
        self.db = db
        self.audit = audit
        self.publisher = publisher

    async def _get_or_create_customer(self, user_id: str) -> Customer:
        result = await self.db.execute(select(Customer).where(Customer.user_id == uuid.UUID(user_id)))
        customer = result.scalar_one_or_none()
        if customer:
            return customer

        if settings.stripe_secret_key.startswith("sk_test_mock"):
            stripe_customer_id = f"cus_mock_{user_id[:8]}"
        else:
            sc = stripe.Customer.create(metadata={"user_id": user_id})
            stripe_customer_id = sc.id

        customer = Customer(user_id=uuid.UUID(user_id), stripe_customer_id=stripe_customer_id)
        self.db.add(customer)
        await self.db.flush()
        return customer

    async def verify_card(self, req: CardVerifyRequest) -> PaymentResponse:
        customer = await self._get_or_create_customer(req.user_id)
        amount = settings.stripe_hold_amount_cents

        if settings.stripe_secret_key.startswith("sk_test_mock"):
            intent_id = f"pi_mock_{uuid.uuid4().hex[:12]}"
            client_secret = f"{intent_id}_secret_mock"
            status = "requires_confirmation"
        else:
            stripe.PaymentMethod.attach(req.payment_method_id, customer=customer.stripe_customer_id)
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency="eur",
                customer=customer.stripe_customer_id,
                payment_method=req.payment_method_id,
                capture_method="manual",
                confirm=True,
                return_url="http://localhost:3000/onboarding/payment-callback",
            )
            intent_id = intent.id
            client_secret = intent.client_secret
            status = intent.status

        txn = Transaction(
            customer_id=customer.id,
            stripe_payment_intent_id=intent_id,
            amount_cents=amount,
            status=status,
            type="card_verification",
        )
        self.db.add(txn)
        await self.db.flush()

        pm = PaymentMethod(
            customer_id=customer.id,
            stripe_payment_method_id=req.payment_method_id,
            card_last4="4242",
            card_brand="visa",
        )
        self.db.add(pm)

        await self.audit.log(
            AuditEventType.PAYMENT_INITIATED,
            actor_id=req.user_id,
            resource_type="transaction",
            resource_id=str(txn.id),
            metadata={"amount_cents": amount, "type": "card_verification"},
        )

        redirect_url = None
        if status == "requires_action":
            redirect_url = "http://localhost:3000/onboarding/payment-callback?3ds=true"

        return PaymentResponse(
            transaction_id=str(txn.id),
            status=status,
            client_secret=client_secret,
            redirect_url=redirect_url,
        )

    async def confirm_payment(self, transaction_id: str) -> PaymentResponse:
        result = await self.db.execute(select(Transaction).where(Transaction.id == uuid.UUID(transaction_id)))
        txn = result.scalar_one_or_none()
        if not txn:
            raise ValueError("Transaction not found")

        txn.status = "succeeded"
        txn.updated_at = datetime.now(timezone.utc)

        result = await self.db.execute(select(Customer).where(Customer.id == txn.customer_id))
        customer = result.scalar_one()

        result = await self.db.execute(
            select(PaymentMethod).where(PaymentMethod.customer_id == customer.id)
        )
        pm = result.scalars().first()
        if pm:
            pm.verified = True

        await self.audit.log(
            AuditEventType.PAYMENT_CONFIRMED,
            actor_id=str(customer.user_id),
            resource_type="transaction",
            resource_id=str(txn.id),
        )

        if self.publisher:
            await self.publisher.publish(
                EventTopic.PAYMENT_CONFIRMED,
                {"user_id": str(customer.user_id), "transaction_id": str(txn.id)},
            )

        return PaymentResponse(transaction_id=str(txn.id), status="succeeded")

    async def subscribe(self, req: SubscribeRequest) -> SubscriptionResponse:
        customer = await self._get_or_create_customer(req.user_id)

        if settings.stripe_secret_key.startswith("sk_test_mock"):
            sub_id = f"sub_mock_{uuid.uuid4().hex[:12]}"
            status = "active"
        else:
            sub = stripe.Subscription.create(
                customer=customer.stripe_customer_id,
                items=[{"price_data": {"currency": "eur", "product": req.product_id, "unit_amount": 2900, "recurring": {"interval": "month"}}}],
                default_payment_method=req.payment_method_id,
            )
            sub_id = sub.id
            status = sub.status

        subscription = Subscription(
            customer_id=customer.id,
            product_id=uuid.UUID(req.product_id),
            stripe_subscription_id=sub_id,
            status=status,
        )
        self.db.add(subscription)
        await self.db.flush()

        if self.publisher:
            await self.publisher.publish(
                EventTopic.LICENCE_REQUESTED,
                {
                    "user_id": req.user_id,
                    "product_id": req.product_id,
                    "subscription_id": str(subscription.id),
                },
            )

        return SubscriptionResponse(
            subscription_id=str(subscription.id),
            status=status,
            product_id=req.product_id,
        )

    async def cancel_transaction(self, transaction_id: str) -> PaymentResponse:
        result = await self.db.execute(select(Transaction).where(Transaction.id == uuid.UUID(transaction_id)))
        txn = result.scalar_one_or_none()
        if not txn:
            raise ValueError("Transaction not found")
        txn.status = "cancelled"
        txn.updated_at = datetime.now(timezone.utc)
        return PaymentResponse(transaction_id=str(txn.id), status="cancelled")

    async def cancel_subscription(self, subscription_id: str) -> SubscriptionResponse:
        result = await self.db.execute(select(Subscription).where(Subscription.id == uuid.UUID(subscription_id)))
        sub = result.scalar_one_or_none()
        if not sub:
            raise ValueError("Subscription not found")
        sub.status = "cancelled"
        sub.updated_at = datetime.now(timezone.utc)
        return SubscriptionResponse(
            subscription_id=str(sub.id),
            status="cancelled",
            product_id=str(sub.product_id),
        )

    async def handle_webhook(self, payload: bytes, sig_header: str) -> dict:
        if settings.stripe_webhook_secret.startswith("whsec_mock"):
            return {"received": True, "mode": "mock"}

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
        except Exception as e:
            raise ValueError(f"Webhook verification failed: {e}")

        if event["type"] == "payment_intent.succeeded":
            intent = event["data"]["object"]
            result = await self.db.execute(
                select(Transaction).where(Transaction.stripe_payment_intent_id == intent["id"])
            )
            txn = result.scalar_one_or_none()
            if txn:
                await self.confirm_payment(str(txn.id))

        return {"received": True, "type": event["type"]}
