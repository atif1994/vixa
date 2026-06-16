from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://vixa:vixa_secret@localhost:5432/vixa_ciam"
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://vixa:vixa_secret@localhost:5672/"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    stripe_secret_key: str = "sk_test_mock"
    stripe_webhook_secret: str = "whsec_mock"
    stripe_hold_amount_cents: int = 100

    recaptcha_secret_key: str = "mock_recaptcha_secret"

    sms_provider: str = "mock"
    email_provider: str = "mock"
    email_from: str = "noreply@vixa.platform"

    ost_infinity_base_url: str = "http://localhost:8007/mock/ost-infinity"
    ost_infinity_api_key: str = "ost_dev_key"

    gateway_rate_limit: int = 100
    gateway_rate_window_seconds: int = 60

    auth_service_url: str = "http://localhost:8001"
    onboarding_service_url: str = "http://localhost:8002"
    org_site_service_url: str = "http://localhost:8003"
    verification_service_url: str = "http://localhost:8004"
    payments_service_url: str = "http://localhost:8005"
    licensing_service_url: str = "http://localhost:8006"
    acl_service_url: str = "http://localhost:8007"
    observability_service_url: str = "http://localhost:8008"


@lru_cache
def get_settings() -> Settings:
    return Settings()
