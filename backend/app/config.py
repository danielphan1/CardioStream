"""Application settings.

DATABASE_URL comes from the environment (pydantic-settings matches the field
name case-insensitively), defaulting to a local SQLite dev database.
Naive local datetimes end-to-end — no timezone configuration anywhere (DATA-05).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
