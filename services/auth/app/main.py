from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.messaging.events import EventPublisher, get_rabbitmq_connection
from shared.redis_client.session_store import SessionStore, get_redis
from services.auth.app.schemas import (
    AccountActionRequest,
    LoginRequest,
    MFAVerifyRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from services.auth.app.deps import get_auth_service, set_publisher
from services.auth.app.service import AuthService
from services.auth.app.oidc_routes import router as oidc_router
from services.auth.app.audit_routes import router as audit_router

publisher: EventPublisher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global publisher
    try:
        conn = await get_rabbitmq_connection()
        publisher = EventPublisher(conn)
        await publisher.setup()
        set_publisher(publisher)
    except Exception:
        publisher = None
    yield


app = FastAPI(title="ViXa Auth Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(oidc_router)
app.include_router(audit_router)


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "auth"}


@app.post("/register", response_model=UserResponse)
async def register(req: RegisterRequest, request: Request, svc: AuthService = Depends(get_auth_service)):
    try:
        return await svc.register(req, client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, svc: AuthService = Depends(get_auth_service)):
    try:
        return await svc.login(req, client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/mfa/verify", response_model=TokenResponse)
async def verify_mfa(req: MFAVerifyRequest, request: Request, svc: AuthService = Depends(get_auth_service)):
    try:
        return await svc.verify_mfa(req, client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, request: Request, svc: AuthService = Depends(get_auth_service)):
    try:
        return await svc.refresh(req.refresh_token, client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, svc: AuthService = Depends(get_auth_service)):
    try:
        return await svc.get_user(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/users/{user_id}/suspend", response_model=UserResponse)
async def suspend(user_id: str, req: AccountActionRequest, svc: AuthService = Depends(get_auth_service)):
    return await svc.suspend_account(user_id, req.reason)


@app.post("/users/{user_id}/close", response_model=UserResponse)
async def close_account(user_id: str, req: AccountActionRequest, svc: AuthService = Depends(get_auth_service)):
    return await svc.close_account(user_id, req.reason)


@app.post("/users/{user_id}/mfa/enable", response_model=UserResponse)
async def enable_mfa(user_id: str, svc: AuthService = Depends(get_auth_service)):
    return await svc.enable_mfa(user_id)


@app.post("/users/{user_id}/activate", response_model=UserResponse)
async def activate_account(user_id: str, svc: AuthService = Depends(get_auth_service)):
    try:
        return await svc.activate_account(user_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
