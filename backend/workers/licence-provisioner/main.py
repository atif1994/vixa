import asyncio
import json
import logging

import httpx
from aio_pika.abc import AbstractIncomingMessage

from shared.messaging.events import EventConsumer, EventTopic, get_rabbitmq_connection

import os

from shared.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
LICENSING_URL = os.getenv("LICENSING_SERVICE_URL", settings.licensing_service_url)


async def handle_licence_request(message: AbstractIncomingMessage) -> None:
    async with message.process():
        try:
            payload = json.loads(message.body.decode())
            logger.info("Processing licence request: %s", payload)

            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{LICENSING_URL}/licences",
                    json={
                        "user_id": payload["user_id"],
                        "product_id": payload["product_id"],
                        "subscription_id": payload.get("subscription_id"),
                    },
                )
                resp.raise_for_status()
                licence = resp.json()
                logger.info("Licence provisioned: %s", licence["id"])
        except Exception as e:
            logger.error("Licence provisioning failed: %s", e)
            raise


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    connection = await get_rabbitmq_connection()
    consumer = EventConsumer(
        connection,
        "vixa.licence-provisioner",
        [EventTopic.LICENCE_REQUESTED.value, EventTopic.PAYMENT_CONFIRMED.value],
    )
    queue = await consumer.setup()
    await queue.consume(handle_licence_request)
    logger.info("Licence provisioner worker started")
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
