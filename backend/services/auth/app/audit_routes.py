from fastapi import APIRouter, Depends, Query

from shared.audit.logger import AuditLogger
from shared.database.session import get_db

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def query_audit_logs(
    event_type: str | None = None,
    actor_id: str | None = None,
    limit: int = Query(default=50, le=200),
    db=Depends(get_db),
):
    audit = AuditLogger(db)
    entries = await audit.query(event_type=event_type, actor_id=actor_id, limit=limit)
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "actor_id": e.actor_id,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "checksum": e.checksum,
            "metadata": e.event_metadata,
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]
