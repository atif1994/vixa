import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.licensing.app.models import Product
from services.licensing.app.service import LicensingService


@pytest.mark.asyncio
async def test_base_product_always_entitled():
    db = AsyncMock()
    audit = AsyncMock()
    svc = LicensingService(db, audit)

    base = Product(
        id=uuid.uuid4(),
        name="ViXa Platform",
        slug="vixa-platform",
        description="Base",
        price_cents=0,
        currency="EUR",
        is_base=True,
        active=True,
    )
    sub = Product(
        id=uuid.uuid4(),
        name="ViXa AI",
        slug="vixa-ai",
        description="AI",
        price_cents=7900,
        currency="EUR",
        is_base=False,
        active=True,
    )

    result_mock = MagicMock()
    result_mock.scalars.return_value.all.side_effect = [[base, sub], []]
    db.execute = AsyncMock(return_value=result_mock)

    products = await svc.list_products(user_id=str(uuid.uuid4()))
    assert len(products) == 2
    assert products[0].is_base is True
    assert products[0].entitled is True
    assert products[1].entitled is False


@pytest.mark.asyncio
async def test_entitlement_slugs_include_base():
    db = AsyncMock()
    audit = AsyncMock()
    svc = LicensingService(db, audit)

    base = Product(
        id=uuid.uuid4(),
        name="ViXa Platform",
        slug="vixa-platform",
        description=None,
        price_cents=0,
        currency="EUR",
        is_base=True,
        active=True,
    )

    products_result = MagicMock()
    products_result.scalars.return_value.all.return_value = [base]
    lic_result = MagicMock()
    lic_result.all.return_value = []

    db.execute = AsyncMock(side_effect=[products_result, lic_result])

    slugs = await svc.get_entitlement_slugs(str(uuid.uuid4()))
    assert slugs == ["vixa-platform"]
