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


def test_toggle_guide_maps_to_applied_filters_and_marks_reachable(monkeypatch) -> None:
    parsed_output = AgentOutput(result={"action": "toggle_guide", "state": "open"})
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": parsed_output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("open the guide", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.guideOpen == "open"
    assert service._last_outcome is True


# ── Phase 14: show_only dispatch and its local guards ──────────────────────


def _stub(monkeypatch, result: dict) -> None:
    """Point service._get_client at a client that returns exactly this result."""
    parsed_output = AgentOutput(result=result)
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": parsed_output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())


def test_show_only_maps_to_applied_filters(monkeypatch) -> None:
    """The client's own sentence: 'only see the blood pressures and pulses'."""
    _stub(monkeypatch, {
        "action": "show_only", "datasets": ["blood_pressure", "pulse"],
    })

    reply = service.interpret("only see the blood pressures and pulses", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.showOnly == ["blood_pressure", "pulse"]
    assert reply.message == "Now showing blood pressure and pulse only."


def test_show_only_events_only_is_a_legal_selection(monkeypatch) -> None:
    """'just the hospital stays' leaves no vitals on — the events-only view,
    which is a first-class state, not an error."""
    _stub(monkeypatch, {"action": "show_only", "datasets": ["incidents"]})

    reply = service.interpret("just the hospital stays", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.showOnly == ["incidents"]


def test_show_only_with_empty_list_degrades_to_unclear(monkeypatch) -> None:
    """Structured outputs cannot express minItems, so an empty list has to be
    caught here — applying it would blank the dashboard, which is never what
    'only ...' means."""
    _stub(monkeypatch, {"action": "show_only", "datasets": []})

    reply = service.interpret("only", None, None, None)

    assert reply.kind == "unclear"
    assert reply.message == UNCLEAR_MESSAGE


def test_show_only_deduplicates_repeated_tokens(monkeypatch) -> None:
    _stub(monkeypatch, {"action": "show_only", "datasets": ["pulse", "pulse"]})

    reply = service.interpret("only pulse and pulse", None, None, None)

    assert reply.filters.showOnly == ["pulse"]


def test_toggle_dataset_accepts_the_two_vitals(monkeypatch) -> None:
    """blood_pressure and pulse joined DatasetToken in Phase 14."""
    _stub(monkeypatch, {
        "action": "toggle_dataset", "dataset": "blood_pressure", "state": "off",
    })

    reply = service.interpret("turn off the blood pressure", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.overlayDataset == "blood_pressure"
    assert reply.filters.overlayState == "off"


def test_command_carries_datasets_and_filters_together(monkeypatch) -> None:
    """The project's canonical utterance. If DashboardCommand could not carry
    datasets, one half of this sentence would be silently dropped."""
    _stub(monkeypatch, {
        "action": "command",
        "datasets": ["blood_pressure"],
        "date_range": {"kind": "preset", "preset": "30d"},
        "bp_category": ["stage_1", "stage_2"],
    })

    reply = service.interpret(
        "show me my blood pressure for the last 30 days, mornings only", None, None, None
    )

    assert reply.kind == "applied"
    assert reply.filters.datasetsOn == ["blood_pressure"]
    assert reply.filters.datePreset == "30d"
    assert reply.filters.bpCategory == ["Stage 1", "Stage 2"]
