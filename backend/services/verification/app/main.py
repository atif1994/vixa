from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.redis_client.session_store import SessionStore, get_redis
from services.verification.app.service import (
    OTPResponse,
    SendOTPRequest,
    VerificationService,
    VerifyOTPRequest,
)

app = FastAPI(title="ViXa Verification Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def get_service(db=Depends(get_db)) -> VerificationService:
    redis = await get_redis()
    return VerificationService(db, SessionStore(redis), AuditLogger(db))


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "verification"}


@app.post("/otp/send", response_model=OTPResponse)
async def send_otp(req: SendOTPRequest, svc: VerificationService = Depends(get_service)):
    try:
        return await svc.send_otp(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/otp/verify")
async def verify_otp(req: VerifyOTPRequest, svc: VerificationService = Depends(get_service)):
    try:
        return await svc.verify_otp(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
