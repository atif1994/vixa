import pytest
from shared.audit.logger import AuditEventType, AuditLogger, compute_checksum


def test_audit_checksum_deterministic():
    c1 = compute_checksum("user.login", "user-1", {"ip": "127.0.0.1"})
    c2 = compute_checksum("user.login", "user-1", {"ip": "127.0.0.1"})
    assert c1 == c2
    assert len(c1) == 64


def test_audit_checksum_differs_for_different_events():
    c1 = compute_checksum("user.login", "user-1", None)
    c2 = compute_checksum("user.logout", "user-1", None)
    assert c1 != c2


def test_audit_event_types():
    assert AuditEventType.USER_REGISTERED.value == "user.registered"
    assert AuditEventType.PAYMENT_CONFIRMED.value == "payment.confirmed"
    assert AuditEventType.LICENCE_ASSIGNED.value == "licence.assigned"
