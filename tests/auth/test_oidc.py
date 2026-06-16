import pytest
from httpx import ASGITransport, AsyncClient

from services.auth.app.main import app


@pytest.mark.asyncio
async def test_openid_configuration():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/.well-known/openid-configuration")
        assert resp.status_code == 200
        data = resp.json()
        assert "issuer" in data
        assert "token_endpoint" in data
        assert "password" in data["grant_types_supported"]


@pytest.mark.asyncio
async def test_oauth_token_password_grant_invalid():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/oauth/token", json={
            "grant_type": "password",
            "username": "nobody@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
