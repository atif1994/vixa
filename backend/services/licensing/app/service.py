import uuid

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.audit.logger import AuditEventType, AuditLogger
from shared.messaging.events import EventPublisher, EventTopic
from services.licensing.app.models import Licence, Product


class ProductResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    price_cents: int
    currency: str
    entitled: bool = False
    is_base: bool = False

    model_config = {"from_attributes": True}


class LicenceResponse(BaseModel):
    id: str
    user_id: str
    product_id: str
    status: str
    ost_infinity_licence_id: str | None = None

    model_config = {"from_attributes": True}


class AssignLicenceRequest(BaseModel):
    user_id: str
    product_id: str
    organisation_id: str | None = None
    subscription_id: str | None = None


class LicensingService:
    BASE_SLUG = "vixa-platform"

    def __init__(self, db: AsyncSession, audit: AuditLogger, publisher: EventPublisher | None = None):
        self.db = db
        self.audit = audit
        self.publisher = publisher

    async def _licensed_product_ids(self, user_id: str) -> set[uuid.UUID]:
        result = await self.db.execute(
            select(Licence.product_id).where(
                Licence.user_id == uuid.UUID(user_id),
                Licence.status == "active",
            )
        )
        return {row[0] for row in result.all()}

    async def get_entitlement_slugs(self, user_id: str) -> list[str]:
        result = await self.db.execute(select(Product).where(Product.active == True))
        products = result.scalars().all()
        licensed = await self._licensed_product_ids(user_id)
        return [p.slug for p in products if p.is_base or p.id in licensed]

    async def list_products(self, user_id: str | None = None) -> list[ProductResponse]:
        result = await self.db.execute(select(Product).where(Product.active == True).order_by(Product.is_base.desc()))
        products = result.scalars().all()

        licensed: set[uuid.UUID] = set()
        if user_id:
            licensed = await self._licensed_product_ids(user_id)

        return [
            ProductResponse(
                id=str(p.id),
                name=p.name,
                slug=p.slug,
                description=p.description,
                price_cents=p.price_cents,
                currency=p.currency,
                is_base=p.is_base,
                entitled=p.is_base or p.id in licensed,
            )
            for p in products
        ]

    async def list_entitled_products(self, user_id: str) -> list[ProductResponse]:
        products = await self.list_products(user_id)
        return [p for p in products if p.entitled]

    async def assign_licence(self, req: AssignLicenceRequest) -> LicenceResponse:
        result = await self.db.execute(select(Product).where(Product.id == uuid.UUID(req.product_id)))
        product = result.scalar_one_or_none()
        if not product:
            raise ValueError("Product not found")
        if product.is_base:
            raise ValueError("Base product is included for all customers")

        licence = Licence(
            user_id=uuid.UUID(req.user_id),
            organisation_id=uuid.UUID(req.organisation_id) if req.organisation_id else None,
            product_id=product.id,
            status="active",
            ost_infinity_licence_id=f"ost-lic-{uuid.uuid4().hex[:12]}",
        )
        self.db.add(licence)
        await self.db.flush()

        await self.audit.log(
            AuditEventType.LICENCE_ASSIGNED,
            actor_id=req.user_id,
            resource_type="licence",
            resource_id=str(licence.id),
            metadata={"product_id": req.product_id},
        )

        if self.publisher:
            await self.publisher.publish(
                EventTopic.LICENCE_PROVISIONED,
                {"user_id": req.user_id, "licence_id": str(licence.id), "product_id": req.product_id},
            )

        return LicenceResponse(
            id=str(licence.id),
            user_id=str(licence.user_id),
            product_id=str(licence.product_id),
            status=licence.status,
            ost_infinity_licence_id=licence.ost_infinity_licence_id,
        )

    async def get_user_licences(self, user_id: str) -> list[LicenceResponse]:
        result = await self.db.execute(select(Licence).where(Licence.user_id == uuid.UUID(user_id)))
        return [
            LicenceResponse(
                id=str(l.id),
                user_id=str(l.user_id),
                product_id=str(l.product_id),
                status=l.status,
                ost_infinity_licence_id=l.ost_infinity_licence_id,
            )
            for l in result.scalars().all()
        ]

    async def check_entitlement(self, user_id: str, feature_key: str) -> dict:
        from services.licensing.app.models import Entitlement

        result = await self.db.execute(
            select(Licence, Entitlement, Product)
            .join(Entitlement, Entitlement.product_id == Licence.product_id)
            .join(Product, Product.id == Licence.product_id)
            .where(
                Licence.user_id == uuid.UUID(user_id),
                Licence.status == "active",
                Entitlement.feature_key == feature_key,
            )
        )
        row = result.first()
        if not row and feature_key == "ciam_core":
            base = await self.db.execute(select(Product).where(Product.slug == self.BASE_SLUG))
            if base.scalar_one_or_none():
                return {"entitled": True, "feature_key": feature_key, "source": "base_product"}
        return {"entitled": row is not None, "feature_key": feature_key}

    async def revoke_user_licences(self, user_id: str, product_id: str | None = None) -> int:
        stmt = select(Licence).where(Licence.user_id == uuid.UUID(user_id), Licence.status == "active")
        if product_id:
            stmt = stmt.where(Licence.product_id == uuid.UUID(product_id))
        result = await self.db.execute(stmt)
        count = 0
        for lic in result.scalars().all():
            lic.status = "revoked"
            count += 1
        return count
