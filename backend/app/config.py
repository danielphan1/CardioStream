"""Application settings.

DATABASE_URL comes from the environment (pydantic-settings matches the field
name case-insensitively), defaulting to a local SQLite dev database.
Naive local datetimes end-to-end — no timezone configuration anywhere (DATA-05).
"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read backend/.env when present (must be gitignored — health data / key
    # custody, SEC-02); env vars still take precedence over the file.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite:///./dev.db"
    # Explicit CORS origins for the API (API-01/API-02) — Vite dev server by
    # default. Never a wildcard and never allow_credentials: the deployed site
    # uses Bearer tokens, per the locked CORS model (CLAUDE.md).
    #
    # NOTE (Railway/prod env parsing, RESEARCH Pitfall 3): pydantic-settings
    # JSON-parses a `list[str]` field from the environment. The prod
    # CORS_ORIGINS env var MUST therefore be a JSON array, e.g.
    #   CORS_ORIGINS=["https://<app>.vercel.app"]
    # A bare string (CORS_ORIGINS=https://<app>.vercel.app) raises a
    # JSON-decode SettingsError at boot. The code default below stays a Python
    # literal (only the env value is JSON-parsed).
    cors_origins: list[str] = ["http://localhost:5173"]
    # Anthropic key lives ONLY here (env/.env), never in frontend or responses
    # (SEC-02). Empty default so the app + full test suite boot KEYLESS —
    # a required field would crash startup without the key (RESEARCH Pitfall 9);
    # the agent service degrades to a friendly "unavailable" reply when unset.
    anthropic_api_key: str = ""
    # Shared-password gate (SEC-01). Empty default keeps local/test boot
    # KEYLESS, exactly like anthropic_api_key; prod sets SITE_PASSWORD via env.
    site_password: str = ""
    # itsdangerous signing secret for the Bearer token. The dev default keeps
    # tests deterministic; prod MUST override via TOKEN_SECRET (never shipped
    # to the client — SEC-01, threat T-05-02).
    token_secret: str = "dev-insecure-secret"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg3(cls, v: str) -> str:
        """Normalize a bare ``postgresql://`` URL to the psycopg3 dialect.

        Railway injects ``postgresql://...``, which SQLAlchemy maps to the
        psycopg2 dialect (not installed → ModuleNotFoundError at boot). One
        normalization point here covers both the app engine and Alembic, since
        both read ``get_settings().database_url`` (RESEARCH Pitfall 2). SQLite
        and already-normalized URLs pass through unchanged.
        """
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
