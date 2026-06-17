from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.messaging.events import EventPublisher, get_rabbitmq_connection
from services.payments.app.service import (
    CardVerifyRequest,
    PaymentResponse,
    PaymentsService,
    SubscribeRequest,
    SubscriptionResponse,
)

publisher: EventPublisher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global publisher
    try:
        conn = await get_rabbitmq_connection()
        publisher = EventPublisher(conn)
        await publisher.setup()
    except Exception:
        publisher = None
    yield


app = FastAPI(title="ViXa Payments Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def get_service(db=Depends(get_db)) -> PaymentsService:
    return PaymentsService(db, AuditLogger(db), publisher)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "payments"}


@app.post("/verify-card", response_model=PaymentResponse)
async def verify_card(req: CardVerifyRequest, svc: PaymentsService = Depends(get_service)):
    return await svc.verify_card(req)


@app.post("/confirm/{transaction_id}", response_model=PaymentResponse)
async def confirm_payment(transaction_id: str, svc: PaymentsService = Depends(get_service)):
    try:
        return await svc.confirm_payment(transaction_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(req: SubscribeRequest, svc: PaymentsService = Depends(get_service)):
    return await svc.subscribe(req)


@app.post("/transactions/{transaction_id}/cancel", response_model=PaymentResponse)
async def cancel_transaction(transaction_id: str, svc: PaymentsService = Depends(get_service)):
    try:
        return await svc.cancel_transaction(transaction_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/subscriptions/{subscription_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(subscription_id: str, svc: PaymentsService = Depends(get_service)):
    try:
        return await svc.cancel_subscription(subscription_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request, svc: PaymentsService = Depends(get_service)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        return await svc.handle_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
