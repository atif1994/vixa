import re
import uuid
from typing import Any

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.audit.logger import AuditEventType, AuditLogger
from shared.config.settings import get_settings
from shared.messaging.events import EventPublisher, EventTopic
from services.org-site.app.models import Organisation, Site

settings = get_settings()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:128]


class CreateOrgRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    owner_user_id: str
    country: str | None = None
    city: str | None = None
    address: str | None = None
    postcode: str | None = None
    telephone: str | None = None
    directors: list[str] | None = None


class CreateSiteRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    domain: str | None = None
    location: str | None = None
    managers: list[str] | None = None


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    owner_user_id: str
    status: str
    country: str | None = None
    city: str | None = None
    ost_infinity_org_id: str | None = None

    model_config = {"from_attributes": True}


class SiteResponse(BaseModel):
    id: str
    organisation_id: str
    name: str
    slug: str
    domain: str | None
    location: str | None = None
    status: str
    ost_infinity_site_id: str | None = None

    model_config = {"from_attributes": True}


class OrgSiteService:
    def __init__(self, db: AsyncSession, audit: AuditLogger, publisher: EventPublisher | None = None):
        self.db = db
        self.audit = audit
        self.publisher = publisher

    async def create_organisation(self, req: CreateOrgRequest) -> OrgResponse:
        slug = slugify(req.name)
        org = Organisation(
            name=req.name,
            slug=slug,
            owner_user_id=uuid.UUID(req.owner_user_id),
            country=req.country,
            city=req.city,
            address=req.address,
            postcode=req.postcode,
            telephone=req.telephone,
            directors=req.directors,
        )
        self.db.add(org)
        await self.db.flush()

        await self._sync_to_ost_infinity("organisation", str(org.id), {
            "name": org.name,
            "slug": org.slug,
            "owner_user_id": req.owner_user_id,
            "country": req.country,
            "city": req.city,
            "address": req.address,
            "postcode": req.postcode,
            "telephone": req.telephone,
            "directors": req.directors,
        })
        org.ost_infinity_org_id = f"ost-org-{str(org.id)[:8]}"

        await self.audit.log(
            AuditEventType.ORG_CREATED,
            actor_id=req.owner_user_id,
            resource_type="organisation",
            resource_id=str(org.id),
        )

        if self.publisher:
            await self.publisher.publish(EventTopic.ORG_CREATED, {"org_id": str(org.id), "owner_user_id": req.owner_user_id})

        return OrgResponse(
            id=str(org.id),
            name=org.name,
            slug=org.slug,
            owner_user_id=str(org.owner_user_id),
            status=org.status,
            country=org.country,
            city=org.city,
            ost_infinity_org_id=org.ost_infinity_org_id,
        )

    async def create_site(self, org_id: str, req: CreateSiteRequest) -> SiteResponse:
        result = await self.db.execute(select(Organisation).where(Organisation.id == uuid.UUID(org_id)))
        org = result.scalar_one_or_none()
        if not org:
            raise ValueError("Organisation not found")

        site = Site(
            organisation_id=org.id,
            name=req.name,
            slug=slugify(req.name),
            domain=req.domain,
            location=req.location,
            managers=req.managers,
        )
        self.db.add(site)
        await self.db.flush()

        await self._sync_to_ost_infinity("site", str(site.id), {
            "name": site.name,
            "organisation_id": org_id,
            "domain": req.domain,
            "location": req.location,
            "managers": req.managers,
        })
        site.ost_infinity_site_id = f"ost-site-{str(site.id)[:8]}"

        await self.audit.log(
            AuditEventType.SITE_CREATED,
            resource_type="site",
            resource_id=str(site.id),
            metadata={"org_id": org_id},
        )

        return SiteResponse(
            id=str(site.id),
            organisation_id=str(site.organisation_id),
            name=site.name,
            slug=site.slug,
            domain=site.domain,
            location=site.location,
            status=site.status,
            ost_infinity_site_id=site.ost_infinity_site_id,
        )

    async def delete_organisation(self, org_id: str) -> bool:
        result = await self.db.execute(select(Organisation).where(Organisation.id == uuid.UUID(org_id)))
        org = result.scalar_one_or_none()
        if not org:
            return False
        org.status = "deleted"
        return True

    async def delete_site(self, site_id: str) -> bool:
        result = await self.db.execute(select(Site).where(Site.id == uuid.UUID(site_id)))
        site = result.scalar_one_or_none()
        if not site:
            return False
        site.status = "deleted"
        return True

    async def list_organisations(self, owner_user_id: str) -> list[OrgResponse]:
        result = await self.db.execute(
            select(Organisation).where(Organisation.owner_user_id == uuid.UUID(owner_user_id), Organisation.status == "active")
        )
        return [
            OrgResponse(
                id=str(o.id),
                name=o.name,
                slug=o.slug,
                owner_user_id=str(o.owner_user_id),
                status=o.status,
                country=o.country,
                city=o.city,
                ost_infinity_org_id=o.ost_infinity_org_id,
            )
            for o in result.scalars().all()
        ]

    async def _sync_to_ost_infinity(self, entity_type: str, local_id: str, payload: dict[str, Any]) -> None:
        idempotency_key = f"{entity_type}:{local_id}"
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{settings.ost_infinity_base_url}/sync",
                    json={"entity_type": entity_type, "local_id": local_id, "payload": payload},
                    headers={"X-Idempotency-Key": idempotency_key, "X-API-Key": settings.ost_infinity_api_key},
                    timeout=10.0,
                )
        except Exception:
            pass
