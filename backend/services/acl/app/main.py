from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from shared.database.session import get_db
from services.acl.app.service import ACLService, SyncRequest, SyncResponse

app = FastAPI(title="ViXa Anti-Corruption Layer", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def get_acl(db=Depends(get_db)) -> ACLService:
    return ACLService(db)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "acl"}


@app.post("/mock/ost-infinity/sync", response_model=SyncResponse)
async def ost_infinity_sync(
    req: SyncRequest,
    x_idempotency_key: str = Header(...),
    x_api_key: str = Header(...),
    acl: ACLService = Depends(get_acl),
):
    return await acl.sync_entity(req, x_idempotency_key)


@app.get("/mock/ost-infinity/entities/{remote_id}")
async def get_entity(remote_id: str, acl: ACLService = Depends(get_acl)):
    entity = await acl.get_remote_entity(remote_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@app.get("/sync-records")
async def list_records(entity_type: str | None = None, acl: ACLService = Depends(get_acl)):
    return await acl.list_sync_records(entity_type)
