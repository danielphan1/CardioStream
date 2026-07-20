---
phase: 03-agent-via-text-input
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/app/agent/__init__.py
  - backend/app/agent/copy.py
  - backend/app/agent/prompt.py
  - backend/app/agent/resolver.py
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/app/routers/agent.py
  - backend/pyproject.toml
  - backend/tests/test_agent_fixtures.py
  - backend/tests/test_agent_resolver.py
  - backend/tests/test_agent_route.py
  - backend/tests/test_agent_schemas.py
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/components/CommandBar.test.tsx
  - frontend/src/components/CommandBar.tsx
  - frontend/src/components/FilterBar.tsx
  - frontend/src/hooks/useAgent.ts
  - frontend/src/lib/agent.test.ts
  - frontend/src/lib/agent.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

I reviewed the `POST /agent` interpretation pipeline (schema → guarded Claude
call → server-composed reply), the symbolic date resolver, and the frontend
CommandBar/store integration with an adversarial stance, focusing on the four
security-sensitive contracts flagged by the orchestrator: key custody (SEC-02),
untrusted-model-output handling (API-04), guard-rail ordering / never-500
backstops (Pitfall 5, VOICE-07), and rate limiting + auth on the route.

The core security posture holds up under scrutiny:

- **Key custody (SEC-02):** The Anthropic key is read only via `get_settings()`
  (`config.py`), never interpolated into any response field, and the two
  `logger.warning` sites in `service.py` deliberately log no payload and no key.
  The key never crosses to the frontend.
- **Untrusted output (API-04):** Structured outputs + Pydantic `Literal` tokens
  constrain the model; the only model-authored string reaching the client is
  `Clarification.question`, rendered as an escaped React text node
  (`<span>{message}</span>`, no `dangerouslySetInnerHTML`). The store trust
  boundary in `applyAgentFilters` only ever receives server-validated
  `AppliedFilters` (closed `Literal` unions; date strings pass through
  `_parse_iso`), so no model string can be executed or injected into query
  params.
- **Guard order / never-500:** `call_claude` catches `(APIError, ValidationError)`
  around `messages.parse`, then rejects `stop_reason in ("refusal","max_tokens")`,
  then returns `parsed_output` (possibly `None`) — matching the documented order.
  Three layers of backstop (`call_claude` → None, `interpret` broad `except`,
  route broad `except`) collapse every model-side outcome to a friendly 200.
- **Rate limit + CORS:** `@router.post` sits above `@limiter.limit`, `request:
  Request` is present, and the 429 path is exercised by tests.

No BLOCKER-severity defects were found. The findings below are correctness edges
and quality issues that degrade robustness at the margins.

## Structural Findings (fallow)

No structural pre-pass payload was provided with this review.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `last_n_days` has no upper clamp — large `n` throws `OverflowError` that bypasses the intended `InvalidRange`→unclear path

**File:** `backend/app/agent/resolver.py:111-124` (with `schemas.py:62-66`)
**Issue:** `LastNDays.n` is documented as "UNBOUNDED here — clamped in service
(Pitfall 3)" (`schemas.py:63`), but the resolver applies no upper clamp. It only
rejects `n < 1` and folds windows that cover all data into `"all"`. The
"covers-everything" fast path is unreachable for pathological `n` because
`n_day_range(latest, n)` computes `latest - timedelta(days=n-1)` *first*
(`resolver.py:120`), before the `start <= earliest` guard. For a sufficiently
large `n` (roughly `>= 740000`, well within an `int`) that subtraction pushes the
date below `date.min` and raises `OverflowError`. `_apply_command` only catches
`InvalidRange` (`service.py:143`), so the `OverflowError` escapes to
`interpret`'s broad `except Exception` backstop and the user gets the generic
"didn't catch that" instead of the intended honest `"all"` confirmation. The
docstring's claim of service-layer clamping is therefore inaccurate.
**Fix:** Clamp/guard `n` before arithmetic, so any window at least as large as the
data span resolves to `"all"` without computing an out-of-range date:
```python
def _resolve_last_n_days(dr, earliest, latest):
    if dr.n < 1:
        raise InvalidRange(f"last_n_days needs n >= 1, got {dr.n}")
    if dr.n in _PRESET_DAYS:
        return _preset(_PRESET_DAYS[dr.n])
    if latest is None:
        return _preset("all")
    # Any window spanning the whole dataset (or absurdly large) → honest "all",
    # and never touch date arithmetic that could overflow.
    span = (latest - earliest).days + 1 if earliest is not None else None
    if span is not None and dr.n >= span:
        return _preset("all")
    if dr.n > 100_000:  # defensive cap — no realistic command needs more
        return _preset("all")
    start, end = n_day_range(latest, dr.n)
    return _custom(start, end)
```

### WR-02: Clarify handling — question stored unstripped, and a >500-char model question raises `ValidationError` that silently downgrades a valid clarify to "unclear"

**File:** `backend/app/agent/service.py:188-198`
**Issue:** Two related defects in the `Clarification` branch:
1. `question = result.question.strip()` is used for the outgoing `message`, but
   the persisted `ClarifyContext(..., question=result.question)` uses the
   *unstripped* value. On the next turn `build_messages` replays this unstripped
   string as the assistant message — a minor inconsistency between what the user
   saw and what is fed back to the model.
2. `ClarifyContext.question` is bounded `max_length=500` (`schemas.py:169`). With
   `_MAX_TOKENS = 1024`, the model can emit a question longer than 500 chars.
   Constructing `ClarifyContext` then raises `ValidationError`, which is caught
   only by `interpret`'s broad `except Exception` and turned into
   `UNCLEAR_MESSAGE` — so a legitimate clarifying question becomes "didn't catch
   that." An empty/whitespace-only question is likewise not guarded: it produces
   an empty `message`, and since the CommandBar reply region is gated on
   `message !== ""`, the user gets a cleared box with no feedback at all.
**Fix:** Strip once, reuse for both fields, and defend the bound/empty case:
```python
if isinstance(result, Clarification):
    question = result.question.strip()
    if not question:
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
    question = question[:500]  # match ClarifyContext bound; never raise
    original = context.original_text if context is not None else text
    return AgentReply(
        kind="clarify",
        message=question,
        context=ClarifyContext(original_text=original, question=question),
    )
```

### WR-03: `MonthRange` with an explicit end month does not clamp to the data window, emitting future `custom_to` dates

**File:** `backend/app/agent/resolver.py:137-146`
**Issue:** For `"since <month>"` (no `end_month`) the resolver correctly clamps
`end = latest` (line 138). But when an explicit `end_month` is given and it
precedes the start month, `end_year = start.year + 1` (line 143) can place the
end in the future relative to `latest` — e.g. "April through February" with an
anchor of June 2025 resolves to `2025-04-01 .. 2026-02-28`, a `custom_to` months
past any reading. This never crashes (the read API just returns nothing past the
last reading) and the "November through February" test only exercises a case
where the end lands in the past, so the future-end path is untested. It is an
honesty gap: the confirmation/echo will claim a range extending into a period
with no data.
**Fix:** Clamp the computed `end` to `latest` for symbolic month ranges (dates
are anchored to the data, never the wall clock — consistent with the "since"
branch):
```python
end = date(end_year, end_num, monthrange(end_year, end_num)[1])
if end > latest:
    end = latest
```

## Info

### IN-01: Rate limiter keys on the immediate peer address, not `X-Forwarded-For`

**File:** `backend/app/routers/agent.py:36`
**Issue:** `Limiter(key_func=get_remote_address)` keys on the direct socket peer.
Behind the intended Railway/Render reverse proxy, every request presents the
proxy's IP, so the `20/minute` budget becomes a single global bucket rather than
per-client. For this single-user app the cost cap (SEC-02 intent) still holds —
the endpoint stays bounded — but a burst from one origin could transiently lock
out the legitimate user. Acceptable for the current single-user scope; revisit if
multi-client access is ever added.
**Fix:** When deployed behind a trusted proxy, derive the client IP from a
validated `X-Forwarded-For` (e.g. slowapi's `get_ipaddr` with `ProxyHeaders`
middleware / a trusted-hosts config) rather than the raw peer address.

### IN-02: Example-command copy is duplicated across backend and frontend

**File:** `frontend/src/components/CommandBar.tsx:38-43` and `backend/app/agent/copy.py:12-16`
**Issue:** `EXAMPLES` in the CommandBar and `EXAMPLE_COMMANDS` in `copy.py` both
hand-maintain the taught-vocabulary strings, and they already diverge (the
frontend list adds "show blood pressure"). Not a defect, but the two lists can
drift further and teach different vocabulary in the placeholder vs. the "didn't
catch that" copy.
**Fix:** Treat one side as the source of truth (the backend `copy.py` list is the
one embedded in `UNCLEAR_MESSAGE`) and keep the placeholder list intentionally in
sync, or document that they are deliberately independent.

### IN-03: Tautological assertion in a schema test

**File:** `backend/tests/test_agent_schemas.py:226`
**Issue:** `assert SYSTEM_PROMPT == SYSTEM_PROMPT` is always true and asserts
nothing — it cannot catch any regression. The line above (`isinstance(...) and
SYSTEM_PROMPT`) already covers "non-empty str constant."
**Fix:** Remove the tautology, or assert a real invariant (e.g. the prompt names
the symbolic-date rule: `assert "SYMBOLIC" in SYSTEM_PROMPT`).

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
