"""Deterministic tests for POST /agent (API-04/API-05/VOICE-07, T-03-13/T-03-14).

Contract covered — all via a dependency-injected FAKE interpreter (no network,
no SDK mocking, RESEARCH Pattern 3):
  - applied / clarify / refuse / unclear replies round-trip through the route
    and response_model with the exact fields the frontend consumes
  - customRange serializes with the wire alias "from" (FastAPI by_alias default)
  - never-500: an interpreter that raises -> 200 kind "unclear" (VOICE-07)
  - request validation: missing text -> 422; >500 chars -> 422 (API-level,
    distinct from model-path failures)
  - anchor wiring: the route queries unfiltered min/max reading dates and passes
    them to the interpreter (API-05, Pitfall 4)
  - slowapi: the 21st request in a minute -> 429 (Pitfall 6 / A3 compat evidence)
  - CORS preflight for POST -> 200 with POST in allow-methods (Pitfall 1)
"""

from datetime import datetime

import pytest

from app.agent.copy import medical_refusal
from app.agent.schemas import AgentReply, AppliedFilters, ClarifyContext, CustomRange
from app.main import app
from app.models import Reading
from app.routers.agent import get_interpreter, limiter


@pytest.fixture(autouse=True)
def _reset_limiter():
    """Clear the 20/minute budget before each test so it never bleeds across tests."""
    limiter.reset()
    yield
    limiter.reset()


def _override(fake) -> None:
    """Install a fake interpreter; conftest's client fixture clears overrides."""
    app.dependency_overrides[get_interpreter] = lambda: fake


def _reading(dt: datetime) -> Reading:
    """Minimal valid Reading at ``dt`` (only the datetime anchor matters here)."""
    return Reading(
        datetime_=dt,
        systolic=118,
        diastolic=76,
        pulse=55,
        am_pm="AM" if dt.hour < 12 else "PM",
        bp_category="Normal",
        pulse_category="Bradycardia",
        map_value=90.0,
        pulse_pressure=42,
    )


def test_applied_reply_echoes_filters(client) -> None:
    def fake(text, context, earliest, latest):
        return AgentReply(
            kind="applied",
            filters=AppliedFilters(activeChart="pulse_trend", datePreset="30d", amPm="AM"),
            message="",
        )

    _override(fake)
    res = client.post("/agent", json={"text": "show my pulse mornings last 30 days"})
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "applied"
    assert body["filters"]["activeChart"] == "pulse_trend"
    assert body["filters"]["datePreset"] == "30d"
    assert body["filters"]["amPm"] == "AM"


def test_custom_range_serializes_with_from_alias(client) -> None:
    def fake(text, context, earliest, latest):
        return AgentReply(
            kind="applied",
            filters=AppliedFilters(
                activeChart="bp_timeline",
                customRange=CustomRange(from_="2025-02-01", to="2025-04-30"),
            ),
        )

    _override(fake)
    res = client.post("/agent", json={"text": "february through april"})
    assert res.status_code == 200
    cr = res.json()["filters"]["customRange"]
    assert cr["from"] == "2025-02-01"  # wire alias, not "from_"
    assert cr["to"] == "2025-04-30"


def test_clarify_reply_round_trips_context(client) -> None:
    def fake(text, context, earliest, latest):
        return AgentReply(
            kind="clarify",
            message="Which chart did you mean?",
            context=ClarifyContext(
                original_text="show me that one", question="Which chart did you mean?"
            ),
        )

    _override(fake)
    res = client.post("/agent", json={"text": "show me that one"})
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "clarify"
    assert body["message"] == "Which chart did you mean?"
    assert body["context"]["original_text"] == "show me that one"
    assert body["context"]["question"] == "Which chart did you mean?"


def test_refuse_reply_uses_fixed_copy(client) -> None:
    expected = medical_refusal("bp_timeline")

    def fake(text, context, earliest, latest):
        return AgentReply(
            kind="refuse",
            filters=AppliedFilters(activeChart="bp_timeline"),
            message=expected,
        )

    _override(fake)
    res = client.post("/agent", json={"text": "is my blood pressure dangerous?"})
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "refuse"
    assert body["message"] == expected
    assert "care team" in body["message"]


def test_unclear_reply_contains_example_command(client) -> None:
    from app.agent.copy import UNCLEAR_MESSAGE

    def fake(text, context, earliest, latest):
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)

    _override(fake)
    res = client.post("/agent", json={"text": "asdf qwerty"})
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "unclear"
    assert "show my pulse" in body["message"]  # embedded example teaches vocabulary


def test_interpreter_raising_returns_200_unclear(client) -> None:
    """VOICE-07: any interpreter failure collapses to a friendly 200, never 500."""

    def fake(text, context, earliest, latest):
        raise RuntimeError("boom")

    _override(fake)
    res = client.post("/agent", json={"text": "show my pulse"})
    assert res.status_code == 200
    assert res.json()["kind"] == "unclear"


@pytest.mark.parametrize(
    "payload",
    [
        {},  # missing text
        {"text": ""},  # empty text (min_length=1)
        {"text": "x" * 501},  # over max_length=500
    ],
)
def test_request_validation_returns_422(client, payload: dict) -> None:
    # Even installed, a fake interpreter must never be reached on a 422.
    _override(lambda *a: AgentReply(kind="applied"))
    res = client.post("/agent", json=payload)
    assert res.status_code == 422


def test_anchors_are_unfiltered_min_max_reading_dates(client, session) -> None:
    session.add_all(
        [
            _reading(datetime(2025, 2, 22, 8, 5)),
            _reading(datetime(2025, 4, 1, 21, 0)),
            _reading(datetime(2025, 6, 13, 9, 30)),
        ]
    )
    session.commit()

    seen: dict = {}

    def fake(text, context, earliest, latest):
        seen["earliest"] = earliest
        seen["latest"] = latest
        return AgentReply(kind="applied")

    _override(fake)
    res = client.post("/agent", json={"text": "last 30 days"})
    assert res.status_code == 200
    from datetime import date

    assert seen["earliest"] == date(2025, 2, 22)
    assert seen["latest"] == date(2025, 6, 13)


def test_rate_limit_fires_on_21st_request(client) -> None:
    """A3 compat evidence: slowapi 20/minute -> 20 OK, 21st -> 429."""
    _override(lambda *a: AgentReply(kind="applied"))
    for _ in range(20):
        assert client.post("/agent", json={"text": "show my pulse"}).status_code == 200
    assert client.post("/agent", json={"text": "show my pulse"}).status_code == 429


def test_cors_preflight_allows_post(client) -> None:
    """Pitfall 1 regression guard: the POST /agent preflight must succeed."""
    res = client.options(
        "/agent",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert res.status_code == 200
    assert "POST" in res.headers.get("access-control-allow-methods", "")
