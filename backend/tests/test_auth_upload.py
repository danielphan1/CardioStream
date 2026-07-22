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
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.routers.agent import limiter


@pytest.fixture(autouse=True)
def _reset_limiter():
    """Clear the 5/minute /auth budget before each test (copied from the
    agent-route suite) so rate-limit state never bleeds across tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def real_gate_client(session):
    """A TestClient that exercises the REAL ``verify_token`` dependency.

    Only ``get_db`` is overridden (so DB-backed routes hit the in-memory
    session); ``verify_token`` is intentionally NOT overridden here, unlike the
    conftest ``client`` fixture — this module must prove the gate actually
    enforces (401 without a token, 200 with a valid one).
    """
    from app.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


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


# --- Task 2: verify_token enforcement -----------------------------------------


def test_requires_token_missing_header_401(real_gate_client) -> None:
    """A gated route with no Authorization header returns 401 (not 403)."""
    resp = real_gate_client.get("/readings")
    assert resp.status_code == 401


def test_requires_token_malformed_header_401(real_gate_client) -> None:
    """An Authorization header without the ``Bearer `` prefix returns 401."""
    resp = real_gate_client.get("/readings", headers={"Authorization": "Basic abc"})
    assert resp.status_code == 401


def test_requires_token_tampered_token_401(real_gate_client) -> None:
    """A garbage/tampered token fails the signature check → 401 (itsdangerous BadData)."""
    resp = real_gate_client.get("/readings", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_valid_token_unlocks_gated_route(real_gate_client) -> None:
    """A token from the shared serializer unlocks a gated route (200)."""
    get_settings.cache_clear()
    from app.auth import _serializer

    token = _serializer().dumps("authorized")
    resp = real_gate_client.get("/readings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    get_settings.cache_clear()


# --- Task 3: /auth route (ungated, rate-limited, end-to-end) -------------------


@pytest.fixture
def auth_password(monkeypatch):
    """Set a known SITE_PASSWORD for the /auth tests and clear the settings cache.

    Mirrors the existing env-override discipline: cache_clear() before and after
    so the module-level get_settings() lru_cache reflects the patched env.
    """
    monkeypatch.setenv("SITE_PASSWORD", "correct-horse")
    get_settings.cache_clear()
    yield "correct-horse"
    get_settings.cache_clear()


def test_auth_correct_password_issues_token_unlocks_gated(real_gate_client, auth_password) -> None:
    """Correct password → 200 with a token that then unlocks GET /readings (200)."""
    resp = real_gate_client.post("/auth", json={"password": auth_password})
    assert resp.status_code == 200
    token = resp.json()["token"]
    assert token

    gated = real_gate_client.get("/readings", headers={"Authorization": f"Bearer {token}"})
    assert gated.status_code == 200


def test_auth_wrong_password_401(real_gate_client, auth_password) -> None:
    """A wrong password returns 401 (constant-time compare mismatch)."""
    resp = real_gate_client.post("/auth", json={"password": "wrong"})
    assert resp.status_code == 401


def test_auth_is_ungated(real_gate_client, auth_password) -> None:
    """/auth is reachable WITHOUT a Bearer token (it issues the token)."""
    resp = real_gate_client.post("/auth", json={"password": auth_password})
    assert resp.status_code == 200


def test_auth_rate_limit_sixth_request_429(real_gate_client, auth_password) -> None:
    """The 6th /auth request within a minute is rate-limited → 429 (Pitfall 5)."""
    for _ in range(5):
        real_gate_client.post("/auth", json={"password": "wrong"})
    sixth = real_gate_client.post("/auth", json={"password": "wrong"})
    assert sixth.status_code == 429
