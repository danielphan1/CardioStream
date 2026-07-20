"""Live eval suite (SC4) — the real Claude interpretation over ~35 utterances.

This suite hits the REAL Anthropic API, so it is double-gated:
  - ``@pytest.mark.live`` (registered in pyproject; default runs exclude it via
    ``addopts = "-m 'not live'"`` — CI stays deterministic and free)
  - ``skipif`` on a missing ``ANTHROPIC_API_KEY`` so a stray ``-m live`` run
    without a key skips cleanly rather than erroring.

Run it at the 03-05 phase gate:
    python -m pytest -m live tests/test_agent_fixtures.py -v
Cost is roughly $0.01–0.05 per full run on claude-haiku-4-5.

Assertion discipline: assert INTENT and structured FILTER FIELDS only — never
message wording. The safety/confirmation copy is server-composed and may evolve
(and clarification questions are model-authored free text); pinning exact
strings here would make the eval brittle for zero coverage gain. ``kind_in``
entries allow the legitimately-either cases (a confident guess vs. a clarify).
"""

import json
import os
from datetime import date
from pathlib import Path

import pytest

from app.agent.schemas import ClarifyContext
from app.agent.service import interpret

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(
        not os.environ.get("ANTHROPIC_API_KEY"), reason="needs a real ANTHROPIC_API_KEY"
    ),
]

# Anchors match the seeded dataset window (Feb 22 – Jun 13, 2025) so symbolic
# date expectations in the fixtures resolve deterministically (API-05).
_EARLIEST = date(2025, 2, 22)
_LATEST = date(2025, 6, 13)

_FIXTURES = json.loads(
    (Path(__file__).parent / "fixtures" / "agent_utterances.json").read_text()
)


def _load_context(raw: dict | None) -> ClarifyContext | None:
    return ClarifyContext(**raw) if raw else None


@pytest.mark.parametrize("entry", _FIXTURES, ids=[e["id"] for e in _FIXTURES])
def test_utterance_intent(entry: dict) -> None:
    expect = entry["expect"]
    reply = interpret(
        entry["utterance"], _load_context(entry.get("context")), _EARLIEST, _LATEST
    )

    # Kind: exact or one-of.
    if "kind" in expect:
        assert reply.kind == expect["kind"], f"{entry['id']}: kind {reply.kind}"
    if "kind_in" in expect:
        assert reply.kind in expect["kind_in"], f"{entry['id']}: kind {reply.kind}"

    f = reply.filters

    if "chart" in expect:
        assert f is not None and f.activeChart == expect["chart"], f"{entry['id']}: chart"
    if "datePreset" in expect:
        assert f is not None and f.datePreset == expect["datePreset"], f"{entry['id']}: preset"
    if "customRange" in expect:
        assert f is not None and f.customRange is not None, f"{entry['id']}: customRange missing"
        assert f.customRange.from_ == expect["customRange"]["from"], f"{entry['id']}: from"
        assert f.customRange.to == expect["customRange"]["to"], f"{entry['id']}: to"
    if "amPm" in expect:
        assert f is not None and f.amPm == expect["amPm"], f"{entry['id']}: amPm"
    if "bpCategory" in expect:
        assert f is not None and f.bpCategory == expect["bpCategory"], f"{entry['id']}: bpCategory"
    if "reset" in expect:
        assert f is not None and f.reset == expect["reset"], f"{entry['id']}: reset"
    if expect.get("has_message"):
        assert reply.message.strip() != "", f"{entry['id']}: expected a non-empty message"
