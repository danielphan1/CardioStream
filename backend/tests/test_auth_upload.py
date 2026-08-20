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


# --- Plan 05-03: POST /upload (gated, idempotent, never-500) -------------------
# These reuse the real-verify_token `real_gate_client` (so the 401 gate is
# genuinely exercised) plus the `omron_xlsx` fixture from conftest. `valid_token`
# mints a token from the shared serializer; `_upload` posts a file the way a
# browser would (multipart field name "file" matches the route parameter).

_VALID_ROWS = [
    {"Date": "2025-03-01", "Time": "8:05 AM", "Systolic": 118, "Diastolic": 76, "Pulse": 64},
    {"Date": "2025-03-01", "Time": "9:30 PM", "Systolic": 132, "Diastolic": 84, "Pulse": 70},
]


@pytest.fixture
def valid_token() -> str:
    """A Bearer token signed by the shared serializer (unlocks gated routes)."""
    get_settings.cache_clear()
    from app.auth import _serializer

    token = _serializer().dumps("authorized")
    yield token
    get_settings.cache_clear()


def _upload(client, path, token, *, filename=None, content=None):
    """POST a file to /upload as multipart; returns the response."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    name = filename or path.name
    if content is not None:
        payload = content
    else:
        payload = path.read_bytes()
    return client.post(
        "/upload",
        files={"file": (name, payload, "application/octet-stream")},
        headers=headers,
    )


def test_upload_valid_xlsx_ingests(real_gate_client, valid_token, omron_xlsx) -> None:
    """A valid OMRON .xlsx with a token → 200 + IngestSummary with added > 0."""
    path = omron_xlsx(_VALID_ROWS)
    resp = _upload(real_gate_client, path, valid_token)
    assert resp.status_code == 200
    body = resp.json()
    # Locked IngestSummary shape (D-06) — verbatim, not wrapped.
    assert set(body) == {"added", "updated", "unchanged", "rejected", "total", "latest"}
    assert body["added"] == 2
    assert body["total"] == 2


def test_upload_reupload_is_idempotent_noop(real_gate_client, valid_token, omron_xlsx) -> None:
    """Re-uploading the same file → added=0, rows counted unchanged (D-08)."""
    path = omron_xlsx(_VALID_ROWS)
    first = _upload(real_gate_client, path, valid_token)
    assert first.status_code == 200
    assert first.json()["added"] == 2

    second = _upload(real_gate_client, path, valid_token)
    assert second.status_code == 200
    body = second.json()
    assert body["added"] == 0
    assert body["unchanged"] == 2
    assert body["total"] == 2


def test_upload_non_xlsx_filename_400(real_gate_client, valid_token, omron_xlsx) -> None:
    """A file whose name is not .xlsx → 400 'not-omron', nothing ingested."""
    path = omron_xlsx(_VALID_ROWS)
    resp = _upload(real_gate_client, path, valid_token, filename="omron_export.csv")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "not-omron"

    readings = real_gate_client.get(
        "/readings", headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert readings.json() == []


def test_upload_garbage_xlsx_400_never_500(real_gate_client, valid_token) -> None:
    """A .xlsx that is not a real OMRON export → 400, nothing ingested, never 500."""
    resp = _upload(
        real_gate_client,
        None,
        valid_token,
        filename="garbage.xlsx",
        content=b"this is not a real xlsx file, just bytes",
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "not-omron"

    readings = real_gate_client.get(
        "/readings", headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert readings.json() == []


def test_upload_without_token_401(real_gate_client, omron_xlsx) -> None:
    """POST /upload with no Bearer token → 401 (gated like every data route)."""
    path = omron_xlsx(_VALID_ROWS)
    resp = _upload(real_gate_client, path, token=None)
    assert resp.status_code == 401


# --- Plan 07-02: 401 gating for /labs, /incidents, /procedures (T-07-01) -------
# Each new resource gets a GET and a POST gating test using the same
# un-overridden real_gate_client fixture as the /readings and /upload gates
# above. POST bodies are deliberately `json={}` — this proves verify_token is
# evaluated BEFORE Pydantic body validation: a missing token 401s even though
# `{}` would otherwise fail body validation with a 422. If any of these
# observe 422 instead of 401, that is a gate-ordering regression.


def test_labs_get_without_token_401(real_gate_client) -> None:
    """GET /labs with no Bearer token → 401."""
    resp = real_gate_client.get("/labs")
    assert resp.status_code == 401


def test_labs_post_without_token_401(real_gate_client) -> None:
    """POST /labs with no Bearer token → 401, not 422 (gate runs before body validation)."""
    resp = real_gate_client.post("/labs", json={})
    assert resp.status_code == 401


def test_incidents_get_without_token_401(real_gate_client) -> None:
    """GET /incidents with no Bearer token → 401."""
    resp = real_gate_client.get("/incidents")
    assert resp.status_code == 401


def test_incidents_post_without_token_401(real_gate_client) -> None:
    """POST /incidents with no Bearer token → 401, not 422 (gate runs before body validation)."""
    resp = real_gate_client.post("/incidents", json={})
    assert resp.status_code == 401


def test_procedures_get_without_token_401(real_gate_client) -> None:
    """GET /procedures with no Bearer token → 401."""
    resp = real_gate_client.get("/procedures")
    assert resp.status_code == 401


def test_procedures_post_without_token_401(real_gate_client) -> None:
    """POST /procedures with no Bearer token → 401, not 422 (gate runs before body validation)."""
    resp = real_gate_client.post("/procedures", json={})
    assert resp.status_code == 401
