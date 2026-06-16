import pytest
from httpx import ASGITransport, AsyncClient

from services.auth.app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "auth"


@pytest.mark.asyncio
async def test_register_validation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/register", json={
            "email": "invalid",
            "password": "short",
            "first_name": "Test",
            "last_name": "User",
        })
        assert resp.status_code == 422
