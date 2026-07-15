"""Application settings.

DATABASE_URL comes from the environment (pydantic-settings matches the field
name case-insensitively), defaulting to a local SQLite dev database.
Naive local datetimes end-to-end — no timezone configuration anywhere (DATA-05).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    # Explicit CORS origins for the API (API-01/API-02) — Vite dev server by
    # default. Never a wildcard and never allow_credentials: the deployed site
    # uses Bearer tokens, per the locked CORS model (CLAUDE.md).
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
