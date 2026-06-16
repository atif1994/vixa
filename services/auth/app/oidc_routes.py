from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from shared.config.settings import get_settings
from services.auth.app.oidc import OAuthTokenRequest, OAuthTokenResponse
from services.auth.app.schemas import LoginRequest, RefreshRequest
from services.auth.app.deps import get_auth_service
from services.auth.app.service import AuthService

settings = get_settings()
router = APIRouter()


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/.well-known/openid-configuration")
async def openid_configuration(request: Request):
    base = str(request.base_url).rstrip("/")
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "userinfo_endpoint": f"{base}/oauth/userinfo",
        "jwks_uri": f"{base}/oauth/jwks",
        "response_types_supported": ["code", "token", "id_token"],
        "grant_types_supported": ["password", "refresh_token", "authorization_code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": [settings.jwt_algorithm],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
    }


@router.get("/oauth/jwks")
async def jwks():
    return {"keys": []}


@router.post("/oauth/token", response_model=OAuthTokenResponse)
async def oauth_token(req: OAuthTokenRequest, request: Request, svc: AuthService = Depends(get_auth_service)):
    if req.grant_type == "password":
        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="username and password required")
        try:
            tokens = await svc.login(LoginRequest(email=req.username, password=req.password), client_ip(request))
        except ValueError as e:
            raise HTTPException(status_code=401, detail=str(e))
        if tokens.mfa_required:
            raise HTTPException(status_code=401, detail="MFA required — use /mfa/verify")
        return OAuthTokenResponse(
            access_token=tokens.access_token,
            expires_in=tokens.expires_in,
            refresh_token=tokens.refresh_token,
            id_token=tokens.access_token,
            scope=req.scope,
        )

    if req.grant_type == "refresh_token":
        if not req.refresh_token:
            raise HTTPException(status_code=400, detail="refresh_token required")
        try:
            tokens = await svc.refresh(req.refresh_token, client_ip(request))
        except ValueError as e:
            raise HTTPException(status_code=401, detail=str(e))
        return OAuthTokenResponse(
            access_token=tokens.access_token,
            expires_in=tokens.expires_in,
            refresh_token=tokens.refresh_token,
            id_token=tokens.access_token,
            scope=req.scope,
        )

    raise HTTPException(status_code=400, detail=f"Unsupported grant_type: {req.grant_type}")


@router.get("/oauth/userinfo")
async def userinfo(request: Request, svc: AuthService = Depends(get_auth_service)):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    from services.auth.app.security import verify_access_token

    payload = verify_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await svc.get_user(payload["sub"])
    return {
        "sub": user.id,
        "email": user.email,
        "given_name": user.first_name,
        "family_name": user.last_name,
        "email_verified": user.email_verified,
    }


@router.get("/oauth/authorize")
async def oauth_authorize():
    return JSONResponse(
        status_code=501,
        content={"detail": "Authorization code flow — redirect to frontend login for MVP"},
    )
