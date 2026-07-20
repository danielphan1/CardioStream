"""Unit tests for the agent wire schemas + prompt/copy (API-04, D-12, D-13, D-14).

Covers (03-01-PLAN Task 1 + Task 3 contract):
  - all five AgentOutput result variants round-trip through Pydantic
  - case-drift normalization: mixed-case tokens (top-level + nested date_range)
    lowercase, but the free-text ``question`` is left untouched (Pitfall 2)
  - Claude-facing models are constraint-free: LastNDays(n=1000) parses
  - API-facing bounds enforced: text length, empty text
  - CustomRange serializes with the JSON key ``from``
  - BP_TOKEN_TO_LABEL values equal the app.deps BPCategory Literal args
  - build_messages one-turn assembly (D-12) + fixed copy structure (D-11) [Task 3]
"""

from typing import get_args

import pytest
from pydantic import ValidationError

from app.agent.schemas import (
    AMPM_TOKEN_TO_LABEL,
    BP_TOKEN_TO_LABEL,
    AgentOutput,
    AgentRequest,
    ClarifyContext,
    Clarification,
    CustomRange,
    DashboardCommand,
    DataQuestion,
    MedicalRefusal,
    Unintelligible,
)
from app.deps import BPCategory


# --------------------------------------------------------------------------- #
# The five result variants round-trip
# --------------------------------------------------------------------------- #


def test_command_variant_parses():
    out = AgentOutput.model_validate(
        {"result": {"action": "command", "chart": "pulse_trend", "am_pm": "am"}}
    )
    assert isinstance(out.result, DashboardCommand)
    assert out.result.chart == "pulse_trend"
    assert out.result.am_pm == "am"
    assert out.result.reset is False


def test_data_question_variant_parses():
    out = AgentOutput.model_validate({"result": {"action": "data_question", "chart": "bp_timeline"}})
    assert isinstance(out.result, DataQuestion)
    assert out.result.chart == "bp_timeline"


def test_clarify_variant_parses():
    out = AgentOutput.model_validate(
        {"result": {"action": "clarify", "question": "Which chart did you mean?"}}
    )
    assert isinstance(out.result, Clarification)
    assert out.result.question == "Which chart did you mean?"


def test_refuse_medical_variant_parses():
    out = AgentOutput.model_validate(
        {"result": {"action": "refuse_medical", "chart": "bp_timeline"}}
    )
    assert isinstance(out.result, MedicalRefusal)
    assert out.result.chart == "bp_timeline"


def test_unclear_variant_parses():
    out = AgentOutput.model_validate({"result": {"action": "unclear"}})
    assert isinstance(out.result, Unintelligible)


def test_command_with_nested_date_ranges_parse():
    for dr in (
        {"kind": "preset", "preset": "30d"},
        {"kind": "last_n_days", "n": 14},
        {"kind": "month_range", "start_month": "february", "end_month": "april"},
        {"kind": "absolute", "from_date": "2025-03-01", "to_date": "2025-04-15"},
    ):
        out = AgentOutput.model_validate({"result": {"action": "command", "date_range": dr}})
        assert isinstance(out.result, DashboardCommand)
        assert out.result.date_range is not None


# --------------------------------------------------------------------------- #
# Case-drift normalization (Pitfall 2)
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "raw, expected_category",
    [
        ({"action": "command", "bp_category": "Stage_1"}, "stage_1"),
        ({"action": "command", "bp_category": "HYPERTENSIVE_CRISIS"}, "hypertensive_crisis"),
        ({"action": "command", "bp_category": "Normal"}, "normal"),
    ],
)
def test_bp_category_case_drift_normalizes(raw, expected_category):
    out = AgentOutput.model_validate({"result": raw})
    assert out.result.bp_category == expected_category


def test_am_pm_case_drift_normalizes():
    out = AgentOutput.model_validate({"result": {"action": "Command", "am_pm": "AM"}})
    assert isinstance(out.result, DashboardCommand)
    assert out.result.am_pm == "am"


def test_nested_date_range_case_drift_normalizes():
    out = AgentOutput.model_validate(
        {
            "result": {
                "action": "command",
                "date_range": {
                    "kind": "Month_Range",
                    "start_month": "February",
                    "end_month": "April",
                },
            }
        }
    )
    assert out.result.date_range.kind == "month_range"
    assert out.result.date_range.start_month == "february"
    assert out.result.date_range.end_month == "april"


def test_chart_token_case_drift_normalizes():
    out = AgentOutput.model_validate({"result": {"action": "command", "chart": "Pulse_Trend"}})
    assert out.result.chart == "pulse_trend"


def test_clarify_question_is_not_lowercased():
    q = "Did you mean Blood Pressure or Pulse?"
    out = AgentOutput.model_validate({"result": {"action": "clarify", "question": q}})
    assert out.result.question == q  # preserved verbatim


# --------------------------------------------------------------------------- #
# Claude-facing models are constraint-free
# --------------------------------------------------------------------------- #


def test_last_n_days_has_no_bounds():
    out = AgentOutput.model_validate(
        {"result": {"action": "command", "date_range": {"kind": "last_n_days", "n": 1000}}}
    )
    assert out.result.date_range.n == 1000


# --------------------------------------------------------------------------- #
# API-facing bounds ARE enforced
# --------------------------------------------------------------------------- #


def test_agent_request_rejects_overlong_text():
    with pytest.raises(ValidationError):
        AgentRequest(text="x" * 501)


def test_agent_request_rejects_empty_text():
    with pytest.raises(ValidationError):
        AgentRequest(text="")


def test_agent_request_accepts_context():
    req = AgentRequest(
        text="mornings",
        context=ClarifyContext(original_text="show me the mornings one", question="Which chart?"),
    )
    assert req.context is not None


def test_custom_range_serializes_with_from_key():
    cr = CustomRange(from_="2025-03-01", to="2025-04-15")
    dumped = cr.model_dump(by_alias=True)
    assert dumped == {"from": "2025-03-01", "to": "2025-04-15"}


def test_custom_range_accepts_from_alias_on_input():
    cr = CustomRange.model_validate({"from": "2025-03-01", "to": "2025-04-15"})
    assert cr.from_ == "2025-03-01"


# --------------------------------------------------------------------------- #
# Token maps stay in lockstep with the canonical labels
# --------------------------------------------------------------------------- #


def test_bp_token_map_values_match_deps_bpcategory():
    canonical = set(get_args(BPCategory))
    mapped = set(BP_TOKEN_TO_LABEL.values()) - {"all"}
    assert mapped == canonical


def test_ampm_token_map():
    assert AMPM_TOKEN_TO_LABEL == {"all": "all", "am": "AM", "pm": "PM"}
