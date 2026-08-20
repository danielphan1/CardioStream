"""Interpretation pipeline: text -> guarded Claude call -> server-composed reply.

This is the API-04/VOICE-07 core. Two invariants are load-bearing and enforced
by the structure below:

  1. GUARD ORDER (RESEARCH Pitfall 5): no key -> unavailable; then breaker-open
     -> unavailable (no network call); then catch ``APIError`` (-> unavailable,
     records a breaker failure) and ``ValidationError`` (-> unclear, breaker
     untouched) separately around ``messages.parse``; then reject
     ``stop_reason in ("refusal", "max_tokens")`` (-> unclear, records a breaker
     success); only THEN touch ``parsed_output`` (which may still be None).
     Every one of these branches collapses to a friendly 200 reply — the
     service NEVER raises for any model-side outcome, and the route never
     returns a raw error or 500.

  2. MODEL TEXT NEVER PASSES THROUGH (API-04): the only Claude-authored string
     that reaches the frontend is ``Clarification.question`` — a short,
     display-only string the client renders as an escaped text node. Every
     other reply field (messages, filters, refusal copy) is server-composed
     from fixed templates in ``copy.py``; the model's five result variants are
     re-mapped here, never echoed.

The Anthropic client is constructed lazily and cached in a module global so the
app + full test suite boot KEYLESS (RESEARCH Pitfall 9): an empty
``anthropic_api_key`` yields ``None`` and an immediate "unavailable" reply, with
no network call and no import-time key requirement (SEC-02: the key is read from
Settings only and is never logged or placed in any response field).
"""

import logging
from collections.abc import Callable
from datetime import date, datetime, timedelta

from anthropic import Anthropic, APIError
from pydantic import ValidationError

from app.agent.copy import (
    DATA_QUESTION_MESSAGE,
    UNAVAILABLE_MESSAGE,
    UNCLEAR_MESSAGE,
    medical_refusal,
)
from app.agent.prompt import SYSTEM_PROMPT, build_messages
from app.agent.resolver import InvalidRange, ResolvedDates, resolve_date_range
from app.agent.schemas import (
    AMPM_TOKEN_TO_LABEL,
    BP_TOKEN_TO_LABEL,
    AgentOutput,
    AgentReply,
    AppliedFilters,
    Clarification,
    ClarifyContext,
    CustomRange,
    DashboardCommand,
    DataQuestion,
    MedicalRefusal,
    Unintelligible,
)

logger = logging.getLogger(__name__)

# Model + call parameters are LOCKED (CLAUDE.md): haiku is fastest/cheapest and
# sufficient for a closed 4-chart vocabulary; temperature=0 = deterministic
# classification; max_tokens caps cost/DoS (a short structured reply never needs
# more). Never widen these without re-reading the cost/latency rationale.
_MODEL = "claude-haiku-4-5"
_MAX_TOKENS = 1024

# Lazy module-level singleton — see module docstring (Pitfall 9).
_client: Anthropic | None = None

# Passive circuit breaker state (D-01..D-04) — fed ONLY by real call_claude()
# outcomes, never by an active probe. `None` = untested this boot (no signal
# yet); `True`/`False` = the outcome of the most recent real call. Deliberately
# unlocked, no mutex of any kind (RESEARCH Pitfall 2 anti-pattern) — this
# project already accepts the identical unlocked-race tradeoff on the
# `_client` singleton above.
_last_outcome: bool | None = None
_last_outcome_at: datetime | None = None
_BREAKER_COOLDOWN = timedelta(seconds=60)


def _record_outcome(ok: bool) -> None:
    """Record the outcome of a real call_claude() attempt (D-01)."""
    global _last_outcome, _last_outcome_at
    _last_outcome, _last_outcome_at = ok, datetime.now()


def agent_reachable() -> bool | None:
    """Return the raw last-observed call outcome — no cooldown logic, no side effects.

    ``/health`` imports and calls this directly. Tri-state: ``None`` (untested
    this boot), ``True`` (last real call succeeded), ``False`` (last real call
    failed).
    """
    return _last_outcome


def _breaker_open() -> bool:
    """Return ``True`` while the breaker is open (D-02/D-03): last outcome was a
    failure, within the cooldown window."""
    return (
        _last_outcome is False
        and _last_outcome_at is not None
        and datetime.now() - _last_outcome_at < _BREAKER_COOLDOWN
    )


def _get_client() -> Anthropic | None:
    """Return a cached ``Anthropic`` client, or ``None`` when no key is set.

    Empty ``anthropic_api_key`` (keyless dev/test/boot) -> ``None`` so callers
    degrade to the "unavailable" reply without ever touching the network.
    """
    global _client
    key = get_settings_key()
    if not key:
        return None  # Pitfall 9: keyless dev/test/boot stays bootable
    if _client is None:
        # timeout/max_retries cap hung + retried calls (T-03-13 cost/DoS);
        # kwarg names verified against anthropic 0.117.0 (RESEARCH A4).
        _client = Anthropic(api_key=key, timeout=15.0, max_retries=1)
    return _client


def get_settings_key() -> str:
    """Read the Anthropic key from Settings only (SEC-02). Never logged."""
    from app.config import get_settings

    return get_settings().anthropic_api_key


def call_claude(text: str, context: ClarifyContext | None) -> tuple[AgentOutput | None, bool]:
    """Parse the utterance into an ``AgentOutput``, or ``None`` for any non-schema outcome.

    Returns ``(output, reachable)``. ``output`` is ``None`` (never raises) for:
    no key, ``APIError``/timeout, breaker-open, ``ValidationError`` from the SDK
    parse, a ``refusal``/``max_tokens`` stop_reason, or a missing
    ``parsed_output``. ``reachable`` reflects ONLY this call's outcome, never a
    stale prior-call read (D-01..D-04). Guard order per RESEARCH Pitfall 5.
    """
    client = _get_client()
    if client is None:
        return None, True  # defensive fallback only — interpret()'s own earlier
        # guard already returns before call_claude() is reached in this case.
    if _breaker_open():
        return None, False  # D-02 — skip the network call while breaker is open
    try:
        msg = client.messages.parse(
            model=_MODEL,
            max_tokens=_MAX_TOKENS,
            temperature=0,  # deterministic classification (RESEARCH A1)
            system=SYSTEM_PROMPT,  # static; user text NEVER goes here (injection hygiene)
            messages=build_messages(text, context),
            output_format=AgentOutput,
        )
    except APIError:
        # Network/timeout/API problem — the real signal the breaker tracks.
        # Do not log the payload or the key — a fixed warning only.
        _record_outcome(False)
        logger.warning("Claude call failed for /agent; degrading to unavailable reply")
        return None, False
    except ValidationError:
        # Response failed schema validation (e.g. enum-capitalization drift).
        # The network round-trip succeeded — do NOT touch the breaker.
        logger.warning("Claude response failed schema validation; degrading to unclear reply")
        return None, True
    if msg.stop_reason in ("refusal", "max_tokens"):  # Pitfall 5
        _record_outcome(True)  # network round-trip succeeded
        return None, True
    _record_outcome(True)
    return msg.parsed_output, True


def _resolved_to_filters(resolved: ResolvedDates | None, filters: AppliedFilters) -> None:
    """Fold a ``ResolvedDates`` onto ``filters`` in place (preset XOR customRange)."""
    if resolved is None:
        return
    if resolved.date_preset is not None:
        filters.datePreset = resolved.date_preset  # type: ignore[assignment]
    elif resolved.custom_from is not None and resolved.custom_to is not None:
        filters.customRange = CustomRange(from_=resolved.custom_from, to=resolved.custom_to)


def _apply_command(
    cmd: DashboardCommand, earliest: date | None, latest: date | None
) -> AgentReply:
    """Map a ``DashboardCommand`` to an ``applied`` reply (or ``unclear`` on a bad range)."""
    filters = AppliedFilters(activeChart=cmd.chart, reset=cmd.reset)

    try:
        resolved = resolve_date_range(cmd.date_range, earliest, latest)
    except InvalidRange:
        # Unresolvable symbolic range (e.g. from > to, garbage) -> friendly nudge.
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
    _resolved_to_filters(resolved, filters)

    if cmd.am_pm is not None:
        filters.amPm = AMPM_TOKEN_TO_LABEL[cmd.am_pm]  # type: ignore[assignment]
    if cmd.bp_category is not None:
        filters.bpCategory = BP_TOKEN_TO_LABEL[cmd.bp_category]  # type: ignore[assignment]

    # message="" — the frontend composes the D-07 full-state echo from the
    # post-merge store; the server never authors the confirmation.
    return AgentReply(kind="applied", filters=filters, message="", context=None)


def interpret(
    text: str,
    context: ClarifyContext | None,
    earliest: date | None,
    latest: date | None,
) -> AgentReply:
    """Turn an utterance into a server-composed ``AgentReply``. Never raises.

    ``earliest``/``latest`` are the unfiltered min/max reading dates (queried in
    the route) — the resolver's anchors (API-05); Claude never computes dates.
    """
    try:
        if _get_client() is None:
            # Keyless / agent unreachable -> point at the still-working manual
            # controls (Pitfall 9). No network call happened.
            return AgentReply(kind="unavailable", message=UNAVAILABLE_MESSAGE)

        output, reachable = call_claude(text, context)
        if not reachable:
            return AgentReply(kind="unavailable", message=UNAVAILABLE_MESSAGE)
        if output is None:
            return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)

        result = output.result

        if isinstance(result, DashboardCommand):
            return _apply_command(result, earliest, latest)

        if isinstance(result, DataQuestion):
            filters = AppliedFilters(activeChart=result.chart) if result.chart else AppliedFilters()
            return AgentReply(kind="applied", filters=filters, message=DATA_QUESTION_MESSAGE)

        if isinstance(result, Clarification):
            question = result.question.strip()
            # Preserve the TRUE original across one repeated clarify while keeping
            # exactly one turn of memory (D-12): reuse the inbound context's
            # original_text when present, else this utterance.
            original = context.original_text if context is not None else text
            return AgentReply(
                kind="clarify",
                message=question,  # display-only, escaped client-side (API-04)
                context=ClarifyContext(original_text=original, question=result.question),
            )

        if isinstance(result, MedicalRefusal):
            filters = AppliedFilters(activeChart=result.chart) if result.chart else None
            # Fixed template copy — never model prose (D-10, VOICE-09).
            return AgentReply(kind="refuse", filters=filters, message=medical_refusal(result.chart))

        if isinstance(result, Unintelligible):
            return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)

        # Union is closed; this is an unreachable belt-and-suspenders branch.
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)  # pragma: no cover
    except Exception:  # noqa: BLE001 — absolute never-500 backstop (VOICE-07)
        logger.warning("Unexpected error interpreting /agent input; degrading to unclear reply")
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)


# The route depends on this callable (override-able like get_db, RESEARCH Pattern 3).
Interpreter = Callable[[str, ClarifyContext | None, date | None, date | None], AgentReply]
