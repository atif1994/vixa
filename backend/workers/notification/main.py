import asyncio
import json
import logging

from aio_pika.abc import AbstractIncomingMessage

from shared.messaging.events import EventConsumer, EventTopic, get_rabbitmq_connection

logger = logging.getLogger(__name__)


async def handle_notification(message: AbstractIncomingMessage) -> None:
    async with message.process():
        payload = json.loads(message.body.decode())
        event_type = message.routing_key or "unknown"
        logger.info("[NOTIFICATION] Event=%s Payload=%s", event_type, payload)

        if "user.registered" in event_type:
            logger.info("Sending welcome email to %s", payload.get("email"))
        elif "payment.confirmed" in event_type:
            logger.info("Sending payment confirmation to user %s", payload.get("user_id"))
        elif "licence.provisioned" in event_type:
            logger.info("Sending licence activation notice to user %s", payload.get("user_id"))


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    connection = await get_rabbitmq_connection()
    consumer = EventConsumer(
        connection,
        "vixa.notifications",
        [
            EventTopic.USER_REGISTERED.value,
            EventTopic.PAYMENT_CONFIRMED.value,
            EventTopic.LICENCE_PROVISIONED.value,
            EventTopic.NOTIFICATION_SEND.value,
        ],
    )
    queue = await consumer.setup()
    await queue.consume(handle_notification)
    logger.info("Notification worker started")
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
