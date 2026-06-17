import pytest
from httpx import ASGITransport, AsyncClient

from services.payments.app.main import app
from services.payments.app.service import CardVerifyRequest, PaymentsService


class MockAudit:
    async def log(self, *args, **kwargs):
        pass


class MockSession:
    async def execute(self, stmt):
        class Result:
            def scalar_one_or_none(self):
                return None

        return Result()

    def add(self, obj):
        pass

    async def flush(self):
        pass


@pytest.mark.asyncio
async def test_payments_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["service"] == "payments"


@pytest.mark.asyncio
async def test_verify_card_mock_unit():
    svc = PaymentsService(MockSession(), MockAudit())
    result = await svc.verify_card(
        CardVerifyRequest(
            user_id="550e8400-e29b-41d4-a716-446655440000",
            payment_method_id="pm_card_mock",
        )
    )
    assert result.transaction_id
    assert result.status in ("requires_confirmation", "requires_action", "succeeded")
    assert result.client_secret is not None
