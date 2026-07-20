"""Application settings.

DATABASE_URL comes from the environment (pydantic-settings matches the field
name case-insensitively), defaulting to a local SQLite dev database.
Naive local datetimes end-to-end — no timezone configuration anywhere (DATA-05).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read backend/.env when present (must be gitignored — health data / key
    # custody, SEC-02); env vars still take precedence over the file.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite:///./dev.db"
    # Explicit CORS origins for the API (API-01/API-02) — Vite dev server by
    # default. Never a wildcard and never allow_credentials: the deployed site
    # uses Bearer tokens, per the locked CORS model (CLAUDE.md).
    cors_origins: list[str] = ["http://localhost:5173"]
    # Anthropic key lives ONLY here (env/.env), never in frontend or responses
    # (SEC-02). Empty default so the app + full test suite boot KEYLESS —
    # a required field would crash startup without the key (RESEARCH Pitfall 9);
    # the agent service degrades to a friendly "unavailable" reply when unset.
    anthropic_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
