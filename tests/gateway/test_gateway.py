import pytest
from httpx import ASGITransport, AsyncClient

from gateway.app.main import app


@pytest.mark.asyncio
async def test_gateway_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "gateway"


@pytest.mark.asyncio
async def test_gateway_requires_auth_for_protected_routes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/org/organisations?owner_user_id=test")
        assert resp.status_code == 401
