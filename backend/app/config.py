"""Application settings.

DATABASE_URL comes from the environment (pydantic-settings matches the field
name case-insensitively), defaulting to a local SQLite dev database.
Naive local datetimes end-to-end — no timezone configuration anywhere (DATA-05).
"""

from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The public, insecure signing secret used for keyless local/test boot. Single
# source of truth so the field default and the guard below cannot drift apart —
# if they drifted, the guard would silently stop guarding.
DEV_TOKEN_SECRET = "dev-insecure-secret"


class Settings(BaseSettings):
    # Read backend/.env when present (must be gitignored — health data / key
    # custody, SEC-02); env vars still take precedence over the file.
    #
    # hide_input_in_errors: pydantic otherwise echoes a repr of the whole input
    # dict into every ValidationError — which for THIS model means the real
    # SITE_PASSWORD / ANTHROPIC_API_KEY landing in boot logs the moment any
    # validation fails (e.g. the TOKEN_SECRET guard below). Secrets never go to
    # logs (SEC-02); the guard's own message carries the fix instructions.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", hide_input_in_errors=True
    )

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
    # Guest-demo-deployment companion to site_password (Phase 19). Empty default
    # keeps Chris's real deployment's behavior byte-for-byte unchanged (D-10) —
    # /auth's username requirement stays off, reject_if_demo's write-guard stays
    # off, /health.demo stays false. A non-empty value is the SINGLE source of
    # truth driving all three; never introduce a second, independently-set flag
    # for "is this the demo deployment" (19-CONTEXT.md anti-drift warning).
    site_username: str = ""
    # itsdangerous signing secret for the Bearer token. The dev default keeps
    # tests deterministic; prod MUST override via TOKEN_SECRET (never shipped
    # to the client — SEC-01, threat T-05-02). Enforced by the boot-time guard
    # below: keeping this default alongside a real SITE_PASSWORD is refused.
    token_secret: str = DEV_TOKEN_SECRET

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

    @model_validator(mode="after")
    def _reject_dev_token_secret_in_deployment(self) -> "Settings":
        """Refuse to BOOT when a configured deployment kept the dev signing secret.

        ``DEV_TOKEN_SECRET`` is public — it is committed right above. A deploy
        running on it can have its Bearer tokens FORGED by anyone, which makes
        the shared-password gate decorative (threat T-GCV-03). A non-empty
        ``site_password`` is the signal that this is a real deployment rather
        than a keyless local/test boot, so only that pairing is rejected;
        keyless boot (no password at all) keeps the dev default and still works.
        Failing loudly at construction beats failing open on every request.
        """
        if self.site_password and self.token_secret == DEV_TOKEN_SECRET:
            raise ValueError(
                "TOKEN_SECRET is still the insecure dev default while SITE_PASSWORD is set. "
                "Anyone can forge a Bearer token for this deployment. Generate a real secret "
                'with: python -c "import secrets;print(secrets.token_urlsafe(32))" '
                "and set it as TOKEN_SECRET (Railway variables in prod, backend/.env locally)."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
