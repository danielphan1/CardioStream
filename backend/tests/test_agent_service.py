"""Circuit breaker unit tests for ``app.agent.service`` (LIVE-01, D-01..D-04, D-06).

Covers the passive circuit breaker fed only by real ``/agent`` traffic outcomes:
``_record_outcome``, ``agent_reachable``, ``_breaker_open``, ``call_claude``'s
tuple return, and ``interpret()``'s unavailable/unclear branch split. No
``threading.Lock()`` (RESEARCH Pitfall 2 anti-pattern) — matches the existing
unlocked-race tradeoff already accepted on the ``_client`` singleton.

Convention: monkeypatch module attributes directly (``service._get_client``,
``service._last_outcome``, ``service._last_outcome_at``) — no
``unittest.mock.patch``, mirroring ``test_agent_route.py``'s dependency-override
discipline.
"""

from datetime import datetime, timedelta

import httpx
import pytest

import app.agent.service as service
from app.agent.copy import UNAVAILABLE_MESSAGE, UNCLEAR_MESSAGE
from app.agent.schemas import AgentOutput


def _api_error() -> service.APIError:
    """Construct a real ``APIError`` the way the installed SDK requires it.

    ``APIError.__init__`` needs ``message``, a real ``httpx.Request``, and a
    keyword-only ``body`` (verified against the installed ``anthropic`` 0.117
    SDK's ``_exceptions.py``) — a bare ``APIError("x")`` raises ``TypeError``.
    """
    return service.APIError(
        "simulated failure",
        httpx.Request("POST", "https://api.anthropic.com/v1/messages"),
        body=None,
    )


def _make_fake_client(parse_fn):
    """Build a fresh ``_FakeClient`` subclass whose ``parse`` delegates to ``parse_fn``."""

    calls: list = []

    class FakeClient:
        class messages:
            @staticmethod
            def parse(**kwargs):
                calls.append(kwargs)
                return parse_fn(**kwargs)

    FakeClient.calls = calls
    return FakeClient


@pytest.fixture(autouse=True)
def _reset_breaker(monkeypatch):
    """Every test starts from the untested-this-boot state (`_last_outcome=None`)."""
    monkeypatch.setattr(service, "_last_outcome", None)
    monkeypatch.setattr(service, "_last_outcome_at", None)
    yield


def test_api_error_records_false_and_interpret_returns_unavailable(monkeypatch) -> None:
    fake = _make_fake_client(lambda **kwargs: (_ for _ in ()).throw(_api_error()))
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("show my pulse", None, None, None)

    assert reply.kind == "unavailable"
    assert reply.message == UNAVAILABLE_MESSAGE
    assert service._last_outcome is False
    assert service._last_outcome_at is not None


def test_validation_error_does_not_touch_breaker_and_stays_unclear(monkeypatch) -> None:
    def _raise_validation_error(**kwargs):
        AgentOutput.model_validate({})  # missing required "result" -> ValidationError

    fake = _make_fake_client(_raise_validation_error)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("asdf qwerty", None, None, None)

    assert reply.kind == "unclear"
    assert reply.message == UNCLEAR_MESSAGE
    assert service._last_outcome is None
    assert service._last_outcome_at is None


def test_breaker_open_skips_network_call_and_returns_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(service, "_last_outcome", False)
    monkeypatch.setattr(service, "_last_outcome_at", datetime.now())

    fake = _make_fake_client(lambda **kwargs: pytest.fail("network call must be skipped"))
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("show my pulse", None, None, None)

    assert reply.kind == "unavailable"
    assert reply.message == UNAVAILABLE_MESSAGE
    assert fake.calls == []


def test_breaker_open_returns_false_after_cooldown_expires(monkeypatch) -> None:
    monkeypatch.setattr(service, "_last_outcome", False)
    monkeypatch.setattr(
        service,
        "_last_outcome_at",
        datetime.now() - service._BREAKER_COOLDOWN - timedelta(seconds=1),
    )

    assert service._breaker_open() is False


def test_successful_call_sets_last_outcome_true(monkeypatch) -> None:
    output = AgentOutput(result={"action": "unclear"})
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("show my pulse", None, None, None)

    assert service._last_outcome is True
    assert reply.kind == "unclear"  # Unintelligible result maps to unclear


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_refusal_and_max_tokens_set_last_outcome_true_and_stay_unclear(
    monkeypatch, stop_reason
) -> None:
    fake_msg = type("FakeMsg", (), {"stop_reason": stop_reason, "parsed_output": None})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("show my pulse", None, None, None)

    assert service._last_outcome is True
    assert reply.kind == "unclear"
    assert reply.message == UNCLEAR_MESSAGE


def test_no_api_key_returns_unavailable_with_zero_calls_and_no_breaker_write(monkeypatch) -> None:
    monkeypatch.setattr(service, "_get_client", lambda: None)

    reply = service.interpret("show my pulse", None, None, None)

    assert reply.kind == "unavailable"
    assert reply.message == UNAVAILABLE_MESSAGE
    assert service._last_outcome is None
    assert service._last_outcome_at is None


def test_agent_reachable_returns_raw_last_outcome_with_no_cooldown_logic(monkeypatch) -> None:
    assert service.agent_reachable() is None

    monkeypatch.setattr(service, "_last_outcome", True)
    assert service.agent_reachable() is True

    monkeypatch.setattr(service, "_last_outcome", False)
    assert service.agent_reachable() is False


def test_toggle_dataset_maps_to_applied_filters_and_marks_reachable(monkeypatch) -> None:
    parsed_output = AgentOutput(
        result={"action": "toggle_dataset", "dataset": "incidents", "state": "off"}
    )
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": parsed_output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("hide incidents", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.overlayDataset == "incidents"
    assert reply.filters.overlayState == "off"
    assert service._last_outcome is True


def test_toggle_speech_maps_to_applied_filters_and_marks_reachable(monkeypatch) -> None:
    parsed_output = AgentOutput(result={"action": "toggle_speech", "state": "off"})
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": parsed_output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("mute the voice replies", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.speechEnabled == "off"
    assert service._last_outcome is True
