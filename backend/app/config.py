"""PM Extension Service Configuration."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Service
    APP_NAME: str = "PM Extension Service"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database (extension schema, same PostgreSQL instance as Plane)
    DATABASE_URL: str = "postgresql+asyncpg://plane:plane@plane-db:5432/plane"

    # Plane API
    PLANE_BASE_URL: str = "http://api:8000"
    PLANE_API_TOKEN: str = ""
    PLANE_WEB_URL: str = "http://localhost:9394"
    PLANE_WORKSPACE_SLUG: str = "sharetek"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:9394",
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # Scheduler
    SYNC_INTERVAL_MINUTES: int = 5

    model_config = {"env_prefix": "PM_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
