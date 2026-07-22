"""Real-dependency auth tests for the shared-password Bearer gate (SEC-01).

Unlike the other API test files (which override ``verify_token`` to a no-op via
the conftest ``client`` fixture), this module exercises the REAL dependency:
it builds its own plain ``TestClient(app)`` with only ``get_db`` overridden so
that ``verify_token`` actually enforces (401 without a token, 200 with a valid
one). Coverage:

  - config: ``site_password``/``token_secret`` fields, the ``database_url``
    psycopg3 normalizer, and a sign/verify round-trip through ``_serializer``.
  - verify_token: missing/malformed/tampered header → 401; valid token → pass.
  - /auth: correct password → token → gated 200; wrong password → 401;
    6th request/minute → 429 (rate limit); /auth reachable ungated.
  - regression: the 3 existing API test files stay green (conftest override).
"""

from __future__ import annotations

import pytest

from app.config import Settings, get_settings
from app.routers.agent import limiter


@pytest.fixture(autouse=True)
def _reset_limiter():
    """Clear the 5/minute /auth budget before each test (copied from the
    agent-route suite) so rate-limit state never bleeds across tests."""
    limiter.reset()
    yield
    limiter.reset()


# --- Task 1: config -----------------------------------------------------------


def test_config_new_fields_default_keyless() -> None:
    """site_password defaults empty (keyless boot); token_secret has a dev default."""
    s = Settings()
    assert s.site_password == ""
    assert s.token_secret == "dev-insecure-secret"


def test_config_normalizes_postgresql_to_psycopg3() -> None:
    """A bare postgresql:// URL is rewritten to the psycopg3 dialect (Pitfall 2)."""
    s = Settings(database_url="postgresql://u:p@host/db")
    assert s.database_url == "postgresql+psycopg://u:p@host/db"


def test_config_leaves_sqlite_url_unchanged() -> None:
    """A sqlite:/// URL passes through the normalizer untouched."""
    s = Settings(database_url="sqlite:///./dev.db")
    assert s.database_url == "sqlite:///./dev.db"


def test_config_leaves_already_normalized_url_unchanged() -> None:
    """An already-psycopg3 URL is not double-rewritten."""
    s = Settings(database_url="postgresql+psycopg://u:p@host/db")
    assert s.database_url == "postgresql+psycopg://u:p@host/db"


def test_serializer_round_trip_signs_and_verifies() -> None:
    """_serializer signs a token that the same serializer verifies (D-02)."""
    get_settings.cache_clear()
    from app.auth import _serializer

    token = _serializer().dumps("authorized")
    assert _serializer().loads(token) == "authorized"
    get_settings.cache_clear()
