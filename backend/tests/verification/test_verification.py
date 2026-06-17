import pytest

from services.verification.app.service import VerificationService, VerifyOTPRequest, SendOTPRequest


class MockAudit:
    async def log(self, *args, **kwargs):
        pass


class MockRedis:
    def __init__(self):
        self.store = {}

    async def store_otp(self, channel, target, code, ttl_seconds=600):
        self.store[f"{channel}:{target}"] = code

    async def verify_otp(self, channel, target, code):
        key = f"{channel}:{target}"
        if self.store.get(key) == code:
            del self.store[key]
            return True
        return False


class MockUser:
    def __init__(self):
        self.email_verified = False
        self.phone_verified = False
        self.phone = None
        self.status = "pending_verification"
        self.updated_at = None


class MockSession:
    def __init__(self, user):
        self.user = user

    def add(self, obj):
        pass

    async def execute(self, stmt):
        class Result:
            def scalar_one_or_none(self):
                return self._user

        r = Result()
        r._user = self.user
        return r


@pytest.mark.asyncio
async def test_otp_verify_updates_email_verified():
    user = MockUser()
    svc = VerificationService(MockSession(user), MockRedis(), MockAudit())
    send_result = await svc.send_otp(SendOTPRequest(channel="email", target="test@example.com", user_id="550e8400-e29b-41d4-a716-446655440000"))
    code = send_result.dev_code
    assert code
    result = await svc.verify_otp(VerifyOTPRequest(
        channel="email", target="test@example.com", code=code,
        user_id="550e8400-e29b-41d4-a716-446655440000",
    ))
    assert result["verified"] is True
    assert user.email_verified is True
    assert user.status == "active"
