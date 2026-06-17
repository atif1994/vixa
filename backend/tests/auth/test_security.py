import pytest
from services.auth.app.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_access_token,
    verify_password,
    generate_otp,
)


def test_hash_and_verify_password():
    hashed = hash_password("SecurePass123!")
    assert verify_password("SecurePass123!", hashed)
    assert not verify_password("WrongPassword", hashed)


def test_create_and_verify_access_token():
    token = create_access_token("user-123", "test@example.com", {"entitlements": ["vixa-platform"]})
    payload = verify_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["email"] == "test@example.com"
    assert payload["type"] == "access"
    assert payload["entitlements"] == ["vixa-platform"]


def test_create_refresh_token():
    token, token_hash, expires = create_refresh_token("user-123")
    assert token
    assert len(token_hash) == 64
    assert expires


def test_generate_otp():
    otp = generate_otp()
    assert len(otp) == 6
    assert otp.isdigit()


def test_invalid_token_returns_none():
    assert verify_access_token("invalid.token.here") is None
