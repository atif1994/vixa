import pytest
from httpx import ASGITransport, AsyncClient

from gateway.app.middleware.jwt_auth import is_public_path


def test_onboarding_paths_are_public():
    assert is_public_path("/api/onboarding/start")
    assert is_public_path("/api/onboarding/status/abc-123")
    assert not is_public_path("/api/org/organisations")


@pytest.mark.asyncio
async def test_onboarding_health():
    from services.onboarding.app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "onboarding"
