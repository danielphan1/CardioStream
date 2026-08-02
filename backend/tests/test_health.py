"""Tests for the ungated /health probe (deploy diagnostic).

``agent_configured`` reflects whether the running process read a non-empty
ANTHROPIC_API_KEY at boot (config caches settings) — a BOOLEAN only, never the
key (SEC-02). It lets us diagnose the keyless-agent "assistant isn't connected"
degradation on Railway without shell access.
"""

from types import SimpleNamespace


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
