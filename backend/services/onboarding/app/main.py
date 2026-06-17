from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.messaging.events import EventPublisher, get_rabbitmq_connection
from services.onboarding.app.service import (
    OnboardingOrchestrator,
    OnboardingStatusResponse,
    StartOnboardingRequest,
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


app = FastAPI(title="ViXa Onboarding Orchestrator", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def get_orchestrator(db=Depends(get_db)) -> OnboardingOrchestrator:
    return OnboardingOrchestrator(db, AuditLogger(db), publisher)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "onboarding"}


@app.post("/start", response_model=OnboardingStatusResponse)
async def start_onboarding(req: StartOnboardingRequest, orch: OnboardingOrchestrator = Depends(get_orchestrator)):
    return await orch.start(req)


@app.get("/status/{saga_id}", response_model=OnboardingStatusResponse)
async def get_status(saga_id: str, orch: OnboardingOrchestrator = Depends(get_orchestrator)):
    try:
        return await orch.get_status(saga_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
