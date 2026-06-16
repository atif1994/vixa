import json
import logging
from enum import Enum
from typing import Any

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message

from shared.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EventTopic(str, Enum):
    USER_REGISTERED = "vixa.user.registered"
    USER_VERIFIED = "vixa.user.verified"
    ORG_CREATED = "vixa.org.created"
    PAYMENT_CONFIRMED = "vixa.payment.confirmed"
    PAYMENT_FAILED = "vixa.payment.failed"
    LICENCE_REQUESTED = "vixa.licence.requested"
    LICENCE_PROVISIONED = "vixa.licence.provisioned"
    ACCOUNT_SUSPENDED = "vixa.account.suspended"
    ACCOUNT_CLOSED = "vixa.account.closed"
    NOTIFICATION_SEND = "vixa.notification.send"
    ONBOARDING_STEP = "vixa.onboarding.step"
    DLQ = "vixa.dlq"


EXCHANGE_NAME = "vixa.events"


class EventPublisher:
    def __init__(self, connection: aio_pika.RobustConnection):
        self.connection = connection
        self._channel: aio_pika.Channel | None = None
        self._exchange: aio_pika.Exchange | None = None

    async def setup(self) -> None:
        self._channel = await self.connection.channel()
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME, ExchangeType.TOPIC, durable=True
        )
        dlq = await self._channel.declare_queue("vixa.dlq", durable=True)
        await dlq.bind(self._exchange, routing_key=EventTopic.DLQ.value)

    async def publish(self, topic: EventTopic, payload: dict[str, Any], correlation_id: str | None = None) -> None:
        if not self._exchange:
            await self.setup()
        message = Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
            correlation_id=correlation_id,
        )
        await self._exchange.publish(message, routing_key=topic.value)
        logger.info("Published event %s correlation_id=%s", topic.value, correlation_id)


class EventConsumer:
    def __init__(self, connection: aio_pika.RobustConnection, queue_name: str, routing_keys: list[str]):
        self.connection = connection
        self.queue_name = queue_name
        self.routing_keys = routing_keys

    async def setup(self) -> aio_pika.Queue:
        channel = await self.connection.channel()
        await channel.set_qos(prefetch_count=10)
        exchange = await channel.declare_exchange(EXCHANGE_NAME, ExchangeType.TOPIC, durable=True)
        queue = await channel.declare_queue(self.queue_name, durable=True)
        for key in self.routing_keys:
            await queue.bind(exchange, routing_key=key)
        return queue


async def get_rabbitmq_connection() -> aio_pika.RobustConnection:
    return await aio_pika.connect_robust(settings.rabbitmq_url)
