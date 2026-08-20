"""Tests for the ungated /health probe (deploy diagnostic).

``agent_configured`` reflects whether the running process read a non-empty
ANTHROPIC_API_KEY at boot (config caches settings) — a BOOLEAN only, never the
key (SEC-02). It lets us diagnose the keyless-agent "assistant isn't connected"
degradation on Railway without shell access.

``agent_reachable`` (LIVE-01/LIVE-04) is the passive circuit breaker's raw
tri-state read, fed only by real ``/agent`` traffic — never a reason string,
and never rate-limited alongside ``/agent``'s 20/minute budget.
"""

from types import SimpleNamespace

import app.agent.service as service


def test_health_ok_and_keyless_in_test_env(client) -> None:
    """The test env boots keyless -> agent_configured is False (200, ungated)."""
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["agent_configured"] is False


def test_health_reports_configured_when_key_present(client, monkeypatch) -> None:
    """A non-empty key -> agent_configured True, mirroring the agent's gate."""
    import app.main as main

    monkeypatch.setattr(
        main, "get_settings", lambda: SimpleNamespace(anthropic_api_key="sk-ant-test")
    )
    assert client.get("/health").json()["agent_configured"] is True


def test_health_never_leaks_the_key(client, monkeypatch) -> None:
    """SEC-02: the key value must never appear in the response body."""
    import app.main as main

    secret = "sk-ant-super-secret-value-must-not-leak"
    monkeypatch.setattr(
        main, "get_settings", lambda: SimpleNamespace(anthropic_api_key=secret)
    )
    resp = client.get("/health")
    assert secret not in resp.text


def test_health_reports_agent_reachable_none_when_untested(client, monkeypatch) -> None:
    """Untested-this-boot state (`_last_outcome=None`) -> `agent_reachable: null`."""
    monkeypatch.setattr(service, "_last_outcome", None)
    assert client.get("/health").json()["agent_reachable"] is None


def test_health_reports_agent_reachable_true_after_success(client, monkeypatch) -> None:
    """A real successful /agent call recorded -> `agent_reachable: true`."""
    monkeypatch.setattr(service, "_last_outcome", True)
    assert client.get("/health").json()["agent_reachable"] is True


def test_health_reports_agent_reachable_false_after_failure(client, monkeypatch) -> None:
    """A real failed /agent call recorded -> `agent_reachable: false`."""
    monkeypatch.setattr(service, "_last_outcome", False)
    assert client.get("/health").json()["agent_reachable"] is False


def test_health_agent_reachable_never_rate_limited(client) -> None:
    """LIVE-04 regression guard: /health shares no budget with /agent's 20/minute cap."""
    for _ in range(25):
        resp = client.get("/health")
        assert resp.status_code == 200
