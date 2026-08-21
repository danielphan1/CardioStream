"""Agent wire schemas — two families (API-04, D-13, D-14).

Two model families with deliberately different rules:

  1. Claude-facing (``AgentOutput`` and its union members): the schema passed to
     ``messages.parse(output_format=...)``. Structured-outputs-SAFE ONLY — closed
     lowercase snake_case ``Literal`` tokens, no numeric ge/le bounds, no
     min-length, and no Pydantic discriminated unions. Constrained sampling then
     makes it impossible for Claude to emit anything outside the vocabulary
     (API-04). Ranges are clamped in the service layer AFTER parse, never here
     (RESEARCH Pitfall 3: a stripped constraint still fails SDK validation, so a
     soft clamp would become a hard parse error). Enum capitalization is not
     guaranteed by structured outputs — drift hits "the first letter of a word
     following a space" — so tokens are lowercase and a ``mode="before"``
     normalizer lowercases every incoming string EXCEPT the free-text
     ``question`` (RESEARCH Pitfall 2, belt-and-suspenders inside SDK validation).

  2. API-facing (``AgentRequest``, ``AgentReply``, ``AppliedFilters``,
     ``ClarifyContext``, ``CustomRange``): ordinary Pydantic v2, constraints are
     fine. These bound the HTTP surface (``max_length`` on text — DoS/cost) and
     shape the store-facing reply.

Token → canonical-label maps (``BP_TOKEN_TO_LABEL``, ``AMPM_TOKEN_TO_LABEL``) are
the SINGLE translation point from wire tokens to the canonical labels the read
API uses (verbatim from ``app.deps`` BPCategory / "AM"/"PM"). Chart tokens equal
the frontend ``ChartId`` verbatim and pass through unmapped.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# --------------------------------------------------------------------------- #
# Claude-facing token vocabularies (lowercase snake_case — Pitfall 2)
# --------------------------------------------------------------------------- #

# MUST equal the frontend ChartId union verbatim (charts pass through unmapped).
ChartToken = Literal["bp_timeline", "pulse_trend", "bp_categories", "am_pm_comparison"]

BPCategoryToken = Literal[
    "all", "hypotension", "normal", "elevated", "stage_1", "stage_2", "hypertensive_crisis"
]

MonthToken = Literal[
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]

DatasetToken = Literal["labs", "incidents", "procedures"]


# --------------------------------------------------------------------------- #
# Claude-facing DateRange union — constraint-free, Literal-tagged (Pitfall 3)
# --------------------------------------------------------------------------- #


class PresetRange(BaseModel):
    """A named preset window ("last 30 days")."""

    kind: Literal["preset"]
    preset: Literal["7d", "30d", "90d", "all"]


class LastNDays(BaseModel):
    """Trailing N-day window; ``n`` is UNBOUNDED here — clamped in service (Pitfall 3)."""

    kind: Literal["last_n_days"]
    n: int


class MonthRange(BaseModel):
    """Symbolic month range; ``end_month`` None → "since <month>" through latest (D-15)."""

    kind: Literal["month_range"]
    start_month: MonthToken
    end_month: MonthToken | None = None
    year: int | None = None  # None → infer from anchor year (resolver, A5)


class AbsoluteRange(BaseModel):
    """DateRangePicker parity — literal from/to "YYYY-MM-DD" strings (D-15)."""

    kind: Literal["absolute"]
    from_date: str | None = None
    to_date: str | None = None


DateRange = PresetRange | LastNDays | MonthRange | AbsoluteRange


# --------------------------------------------------------------------------- #
# Claude-facing result union — one required Literal tag per member
# --------------------------------------------------------------------------- #


class DashboardCommand(BaseModel):
    """A view/filter command. Unmentioned fields stay None → carry over (D-13)."""

    action: Literal["command"]
    chart: ChartToken | None = None
    date_range: DateRange | None = None
    am_pm: Literal["all", "am", "pm"] | None = None
    bp_category: BPCategoryToken | None = None
    reset: bool = False  # "show all data"/"start over" → showAllData()


class DataQuestion(BaseModel):
    """"What's my average BP?" → ensure the view is up, point at the stats bar (D-16)."""

    action: Literal["data_question"]
    chart: ChartToken | None = None


class Clarification(BaseModel):
    """Genuinely-ambiguous branch — one short non-technical question (D-09)."""

    action: Literal["clarify"]
    question: str


class MedicalRefusal(BaseModel):
    """Medical-interpretation request — server templates the copy, not the model (D-10)."""

    action: Literal["refuse_medical"]
    chart: ChartToken | None = None


class Unintelligible(BaseModel):
    """Pure gibberish / unsupported relative adjustment → didn't-catch copy (D-11, D-14)."""

    action: Literal["unclear"]


class ToggleDataset(BaseModel):
    """Overlay data toggle — one dataset token + explicit on/off state (D-03/D-04):
    single-valued (never list-typed) and always explicit (never a flip/toggle)."""

    action: Literal["toggle_dataset"]
    dataset: DatasetToken
    state: Literal["on", "off"]


class AgentOutput(BaseModel):
    """The closed union Claude fills via structured outputs (API-04)."""

    result: (
        DashboardCommand
        | DataQuestion
        | Clarification
        | MedicalRefusal
        | Unintelligible
        | ToggleDataset
    )

    @field_validator("result", mode="before")
    @classmethod
    def _lower_tokens(cls, v: object) -> object:
        """Lowercase every string token (recursively) except free-text question (Pitfall 2)."""
        if isinstance(v, dict):
            return {
                key: _lower_value(key, val)
                for key, val in v.items()
            }
        return v


def _lower_value(key: str, val: object) -> object:
    """Lowercase string values (and one level of nested dict, e.g. date_range) except ``question``."""
    if key == "question":
        return val
    if isinstance(val, str):
        return val.lower()
    if isinstance(val, dict):
        return {k: _lower_value(k, sub) for k, sub in val.items()}
    return val


# --------------------------------------------------------------------------- #
# API-facing models — ordinary Pydantic, constraints allowed
# --------------------------------------------------------------------------- #


class ClarifyContext(BaseModel):
    """One-turn memory payload: the original command + the clarifying question (D-12)."""

    original_text: str = Field(max_length=500)
    question: str = Field(max_length=500)


class AgentRequest(BaseModel):
    """POST /agent body — text bounded to cap prompt cost/DoS (V5, T-03-04)."""

    text: str = Field(min_length=1, max_length=500)
    context: ClarifyContext | None = None


class CustomRange(BaseModel):
    """Concrete resolved date window; JSON key is literally ``from`` (a Python keyword)."""

    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from", serialization_alias="from")
    to: str


class AppliedFilters(BaseModel):
    """Store-shaped filter delta the frontend applies. Canonical labels, not tokens."""

    activeChart: ChartToken | None = None
    datePreset: Literal["7d", "30d", "90d", "all"] | None = None
    customRange: CustomRange | None = None
    amPm: Literal["all", "AM", "PM"] | None = None
    bpCategory: Literal[
        "all", "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
    ] | None = None
    overlayDataset: DatasetToken | None = None
    overlayState: Literal["on", "off"] | None = None
    reset: bool = False


class AgentReply(BaseModel):
    """The server-composed response to POST /agent — never raw Claude text (API-04)."""

    kind: Literal["applied", "clarify", "refuse", "unclear", "unavailable"]
    filters: AppliedFilters | None = None
    message: str = ""
    context: ClarifyContext | None = None


# --------------------------------------------------------------------------- #
# Token → canonical-label maps (single translation point)
# --------------------------------------------------------------------------- #

# Values verbatim from app.deps.BPCategory (spaces included, never snake_cased).
BP_TOKEN_TO_LABEL: dict[str, str] = {
    "all": "all",
    "hypotension": "Hypotension",
    "normal": "Normal",
    "elevated": "Elevated",
    "stage_1": "Stage 1",
    "stage_2": "Stage 2",
    "hypertensive_crisis": "Hypertensive Crisis",
}

AMPM_TOKEN_TO_LABEL: dict[str, str] = {"all": "all", "am": "AM", "pm": "PM"}
