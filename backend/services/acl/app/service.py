import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.acl.app.models import SyncRecord


class SyncRequest(BaseModel):
    entity_type: str
    local_id: str
    payload: dict


class SyncResponse(BaseModel):
    sync_id: str
    remote_id: str
    status: str
    idempotent: bool = False


class ACLService:
    """Anti-corruption layer — idempotent contracts between CIAM and Ost Infinity."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._mock_store: dict[str, dict] = {}

    async def sync_entity(self, req: SyncRequest, idempotency_key: str) -> SyncResponse:
        existing = await self.db.execute(
            select(SyncRecord).where(SyncRecord.idempotency_key == idempotency_key)
        )
        record = existing.scalar_one_or_none()
        if record:
            return SyncResponse(
                sync_id=str(record.id),
                remote_id=record.remote_id or "",
                status=record.status,
                idempotent=True,
            )

        remote_id = f"ost-{req.entity_type}-{req.local_id[:8]}"
        record = SyncRecord(
            entity_type=req.entity_type,
            local_id=uuid.UUID(req.local_id),
            remote_id=remote_id,
            idempotency_key=idempotency_key,
            status="synced",
            request_payload=req.payload,
            response_payload={"remote_id": remote_id, "synced_at": datetime.now(timezone.utc).isoformat()},
        )
        self.db.add(record)
        await self.db.flush()

        self._mock_store[remote_id] = {"entity_type": req.entity_type, **req.payload}

        return SyncResponse(sync_id=str(record.id), remote_id=remote_id, status="synced")

    async def get_remote_entity(self, remote_id: str) -> dict | None:
        return self._mock_store.get(remote_id)

    async def list_sync_records(self, entity_type: str | None = None) -> list[dict]:
        stmt = select(SyncRecord).order_by(SyncRecord.created_at.desc()).limit(50)
        if entity_type:
            stmt = stmt.where(SyncRecord.entity_type == entity_type)
        result = await self.db.execute(stmt)
        return [
            {
                "id": str(r.id),
                "entity_type": r.entity_type,
                "local_id": str(r.local_id),
                "remote_id": r.remote_id,
                "status": r.status,
            }
            for r in result.scalars().all()
        ]
