from fastapi import Depends, Request

from shared.audit.logger import AuditLogger
from shared.database.session import get_db
from shared.messaging.events import EventPublisher, get_rabbitmq_connection
from shared.redis_client.session_store import SessionStore, get_redis
from services.auth.app.service import AuthService

_publisher: EventPublisher | None = None


def set_publisher(publisher: EventPublisher | None) -> None:
    global _publisher
    _publisher = publisher


async def get_publisher() -> EventPublisher | None:
    return _publisher


async def get_auth_service(request: Request, db=Depends(get_db)) -> AuthService:
    redis = await get_redis()
    store = SessionStore(redis)
    audit = AuditLogger(db)
    publisher = await get_publisher()
    return AuthService(db, store, audit, publisher)
