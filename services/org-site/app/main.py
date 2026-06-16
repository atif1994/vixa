from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.messaging.events import EventPublisher, get_rabbitmq_connection
from services.org-site.app.service import (
    CreateOrgRequest,
    CreateSiteRequest,
    OrgResponse,
    OrgSiteService,
    SiteResponse,
)

publisher: EventPublisher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global publisher
    try:
        conn = await get_rabbitmq_connection()
        publisher = EventPublisher(conn)
        await publisher.setup()
    except Exception:
        publisher = None
    yield


app = FastAPI(title="ViXa Org & Site Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


async def get_service(db=Depends(get_db)) -> OrgSiteService:
    return OrgSiteService(db, AuditLogger(db), publisher)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "org-site"}


@app.post("/organisations", response_model=OrgResponse)
async def create_org(req: CreateOrgRequest, svc: OrgSiteService = Depends(get_service)):
    return await svc.create_organisation(req)


@app.get("/organisations", response_model=list[OrgResponse])
async def list_orgs(owner_user_id: str, svc: OrgSiteService = Depends(get_service)):
    return await svc.list_organisations(owner_user_id)


@app.post("/organisations/{org_id}/sites", response_model=SiteResponse)
async def create_site(org_id: str, req: CreateSiteRequest, svc: OrgSiteService = Depends(get_service)):
    try:
        return await svc.create_site(org_id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/organisations/{org_id}")
async def delete_org(org_id: str, svc: OrgSiteService = Depends(get_service)):
    if not await svc.delete_organisation(org_id):
        raise HTTPException(status_code=404, detail="Organisation not found")
    return {"deleted": True}


@app.delete("/sites/{site_id}")
async def delete_site(site_id: str, svc: OrgSiteService = Depends(get_service)):
    if not await svc.delete_site(site_id):
        raise HTTPException(status_code=404, detail="Site not found")
    return {"deleted": True}
