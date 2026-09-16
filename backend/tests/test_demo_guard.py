"""Guard coverage for the 4 mutating routes on a guest-demo deployment (D-03).

Exercises the REAL ``verify_token`` + ``reject_if_demo`` dependency chain via a
locally-defined ``real_gate_client`` (mirrors ``test_auth_upload.py``'s fixture
of the same name — pytest fixtures aren't shared across files without a
``conftest.py`` entry). Coverage:

  - all 4 write routes (POST /upload, /labs, /incidents, /procedures) -> 403
    on a demo deployment, regardless of a valid token
  - the 4 matching GET routes stay 200, completely unaffected
  - POST /agent stays 200 under demo mode (D-03: read/view-only, never gated)
  - the auth-ordering invariant: NO token at all -> 401, not 403, even in
    demo mode (RESEARCH Assumption A1)
  - SITE_USERNAME unset (today's real deployment) -> all 4 write routes behave
    exactly as before (200), the guard is inert dead code
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings


@pytest.fixture
def real_gate_client(session):
    """A TestClient exercising the REAL verify_token (only get_db overridden)."""
    from app.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def demo_mode(monkeypatch):
    """Flip SITE_USERNAME on for the duration of a test (demo deployment)."""
    monkeypatch.setenv("SITE_USERNAME", "guest-chris")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def valid_token():
    """A Bearer token signed by the shared serializer (unlocks verify_token)."""
    get_settings.cache_clear()
    from app.auth import _serializer

    token = _serializer().dumps("authorized")
    yield token
    get_settings.cache_clear()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --- 403 on every write route under demo mode ---------------------------------

_WRITE_ROUTES = ["/labs", "/incidents", "/procedures"]


@pytest.mark.parametrize("path", _WRITE_ROUTES)
def test_write_route_403_under_demo_mode(real_gate_client, demo_mode, valid_token, path) -> None:
    """A validly-authenticated caller gets 403 on a demo deployment, not 500."""
    resp = real_gate_client.post(path, json={}, headers=_auth(valid_token))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Guest accounts can't make changes to this demo."


def test_upload_403_under_demo_mode(real_gate_client, demo_mode, valid_token) -> None:
    """POST /upload also 403s under demo mode, same opaque message as the rest."""
    resp = real_gate_client.post(
        "/upload",
        files={"file": ("x.xlsx", b"not-a-real-xlsx", "application/octet-stream")},
        headers=_auth(valid_token),
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Guest accounts can't make changes to this demo."


# --- GET routes stay unaffected -------------------------------------------------


def test_get_routes_unaffected_under_demo_mode(real_gate_client, demo_mode, valid_token) -> None:
    """GET /readings, /labs, /incidents, /procedures all still 200 under demo mode."""
    for path in ["/readings", "/labs", "/incidents", "/procedures"]:
        resp = real_gate_client.get(path, headers=_auth(valid_token))
        assert resp.status_code == 200, path


# --- /agent stays fully available -----------------------------------------------


def test_agent_endpoint_returns_200_under_demo_mode(real_gate_client, demo_mode, valid_token) -> None:
    """POST /agent stays 200 (never 403) under demo mode — read/view-only by design."""
    from app.agent.schemas import AgentReply
    from app.main import app
    from app.routers.agent import get_interpreter

    fake = lambda text, context, earliest, latest: AgentReply(kind="unclear", message="test")
    app.dependency_overrides[get_interpreter] = lambda: fake

    resp = real_gate_client.post(
        "/agent", json={"text": "show me blood pressure"}, headers=_auth(valid_token)
    )
    assert resp.status_code == 200


# --- auth ordering: no token -> 401, never 403 -----------------------------------


def test_missing_token_still_401_on_demo(real_gate_client, demo_mode) -> None:
    """No Authorization header at all -> 401, not 403, even on a demo deployment.

    Pins that verify_token fires BEFORE reject_if_demo in FastAPI's dependency
    resolution order (RESEARCH Assumption A1) rather than trusting it silently.
    """
    resp = real_gate_client.post("/labs", json={})
    assert resp.status_code == 401


# --- inert when SITE_USERNAME is unset (today's real deployment) ----------------


def test_write_routes_unaffected_when_demo_mode_off(real_gate_client, valid_token) -> None:
    """SITE_USERNAME unset -> the guard is inert; write routes behave as before."""
    resp = real_gate_client.post(
        "/labs",
        json={"date": "2025-03-01", "test_name": "A1C"},
        headers=_auth(valid_token),
    )
    assert resp.status_code == 200
