from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.messaging.events import EventPublisher, get_rabbitmq_connection
from services.licensing.app.service import (
    AssignLicenceRequest,
    LicenceResponse,
    LicensingService,
    ProductResponse,
)

publisher: EventPublisher | None = None


class RevokeLicenceRequest(BaseModel):
    user_id: str
    product_id: str | None = None


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


app = FastAPI(title="ViXa Licensing Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def get_service(db=Depends(get_db)) -> LicensingService:
    return LicensingService(db, AuditLogger(db), publisher)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "licensing"}


@app.get("/products", response_model=list[ProductResponse])
async def list_products(user_id: str | None = None, svc: LicensingService = Depends(get_service)):
    return await svc.list_products(user_id)


@app.get("/products/entitled", response_model=list[ProductResponse])
async def entitled_products(user_id: str, svc: LicensingService = Depends(get_service)):
    return await svc.list_entitled_products(user_id)


@app.post("/licences", response_model=LicenceResponse)
async def assign_licence(req: AssignLicenceRequest, svc: LicensingService = Depends(get_service)):
    try:
        return await svc.assign_licence(req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/licences/{user_id}", response_model=list[LicenceResponse])
async def user_licences(user_id: str, svc: LicensingService = Depends(get_service)):
    return await svc.get_user_licences(user_id)


@app.get("/entitlements/check")
async def check_entitlement(user_id: str, feature_key: str, svc: LicensingService = Depends(get_service)):
    return await svc.check_entitlement(user_id, feature_key)


@app.post("/licences/revoke")
async def revoke_licences(req: RevokeLicenceRequest, svc: LicensingService = Depends(get_service)):
    count = await svc.revoke_user_licences(req.user_id, req.product_id)
    return {"revoked": count}
