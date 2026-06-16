import uuid

import pytest

from services.acl.app.service import ACLService, SyncRequest


class MockScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class MockSession:
    def __init__(self):
        self.records: dict = {}

    async def execute(self, stmt):
        return MockScalarResult(None)

    def add(self, record):
        self.records[record.idempotency_key] = record

    async def flush(self):
        pass


@pytest.mark.asyncio
async def test_acl_idempotent_sync_unit():
    session = MockSession()
    acl = ACLService(session)

    req = SyncRequest(
        entity_type="organisation",
        local_id="550e8400-e29b-41d4-a716-446655440000",
        payload={"name": "Test Org"},
    )
    key = "org:test-123"

    resp1 = await acl.sync_entity(req, key)
    assert resp1.status == "synced"
    assert not resp1.idempotent
    assert resp1.remote_id.startswith("ost-organisation-")

    session.records[key].status = "synced"

    async def execute_with_record(stmt):
        return MockScalarResult(session.records.get(key))

    session.execute = execute_with_record

    resp2 = await acl.sync_entity(req, key)
    assert resp2.idempotent
    assert resp2.remote_id == resp1.remote_id
