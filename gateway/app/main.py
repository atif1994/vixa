import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from gateway.app.middleware.jwt_auth import JWTAuthMiddleware
from gateway.app.middleware.rate_limit import RateLimitMiddleware
from shared.config.settings import get_settings

settings = get_settings()

SERVICE_ROUTES = {
    "/api/auth": settings.auth_service_url,
    "/api/onboarding": settings.onboarding_service_url,
    "/api/org": settings.org_site_service_url,
    "/api/verification": settings.verification_service_url,
    "/api/payments": settings.payments_service_url,
    "/api/licensing": settings.licensing_service_url,
    "/api/acl": settings.acl_service_url,
    "/api/observability": settings.observability_service_url,
}

app = FastAPI(title="ViXa API Gateway", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(RateLimitMiddleware)
app.add_middleware(JWTAuthMiddleware)


def resolve_upstream(path: str) -> tuple[str, str] | None:
    for prefix, base_url in SERVICE_ROUTES.items():
        if path.startswith(prefix):
            remainder = path[len(prefix):]
            return base_url, remainder or ""
    return None


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "gateway"}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(request: Request, path: str):
    full_path = f"/api/{path}"
    resolved = resolve_upstream(full_path)
    if not resolved:
        return JSONResponse(status_code=404, content={"detail": "Service not found"})

    base_url, remainder = resolved
    target_url = f"{base_url}{remainder}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    body = await request.body()

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
        except httpx.RequestError as e:
            return JSONResponse(status_code=502, content={"detail": f"Upstream error: {e}"})

    excluded = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    response_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}
    return Response(content=resp.content, status_code=resp.status_code, headers=response_headers)
