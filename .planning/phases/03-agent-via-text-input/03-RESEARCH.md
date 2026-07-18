# Phase 3: Agent via Text Input - Research

**Researched:** 2026-07-18
**Domain:** LLM intent parsing (Anthropic structured outputs) + FastAPI POST endpoint + React command bar
**Confidence:** HIGH (API surface verified against official docs 2026-07-18; codebase grounding read directly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Command box placement & feel**
- **D-01:** Command bar under header — full-width bar between header and filter bar; the primary control gets top billing. Phase 4 adds mic button + live transcript to this same bar.
- **D-02:** Rotating example placeholder cycling real commands ("show my pulse", "last 30 days, mornings only"), ≥18px high-contrast — the box teaches its own vocabulary.
- **D-03:** During the Claude round-trip, submitted text stays visible with a clear "Working…" state (spinner + bar highlight); clears when applied. The same in-flight state serves voice in Phase 4.
- **D-04:** Submission via big ≥48px labeled Send button + Enter key.

**Confirmation display**
- **D-05:** Confirmation appears in the command bar itself — the "Working…" state resolves into the confirmation text right where the command was entered. One place to look; Phase 4's transcript shares the spot.
- **D-06:** Confirmation persists until the next command — the bar always shows current dashboard state. No fade timers.
- **D-07:** Full state echo, not delta: "Showing blood pressure, last 30 days, mornings" — Chris never has to remember earlier commands to know what's applied (VOICE-06's own example format).
- **D-08:** Affected filter controls pulse briefly when the agent changes them (respecting `prefers-reduced-motion`) — reinforces that agent commands and manual controls are one system.

**Ambiguity & refusal behavior**
- **D-09:** Confident-guess hybrid — apply the command when one reading is clearly most likely; ask a short clarifying question only when genuinely ambiguous. The full-state confirmation (D-07) makes wrong guesses instantly visible and cheap to correct.
- **D-10:** Medical interpretation requests ("is my blood pressure dangerous?") get a redirect that still does something useful: "I can't interpret readings, but here's your blood pressure" + switch to the relevant chart. Gentle, non-alarming, points to the care team (VOICE-09).
- **D-11:** Completely unintelligible input → friendly "didn't catch that" message in the command bar plus 2–3 example commands to try. Every failure teaches; never a raw error or 500 (VOICE-07).
- **D-12:** One-turn memory for clarifications — the original command + the clarification question are sent along with the follow-up answer, so "mornings" completes "show me the mornings one". Only one turn is remembered; no long-lived conversation state.

**Command vocabulary breadth**
- **D-13:** Partial commands carry existing filters over — "show my pulse" switches the chart and keeps last-30-days/AM if active. Commands compose like the manual controls; "show all data" is the explicit reset (matches `showAllData()` in the filter store).
- **D-14:** Absolute commands only in v1 — no relative adjustments ("go back further", "zoom out"). Keeps the closed enums simple and the ~30-utterance fixture suite deterministic.
- **D-15:** Symbolic custom date ranges are in scope — "February through April", "since June" map to symbolic fields (month names / from-to) resolved server-side in local time per API-05. Claude never computes absolute dates. Parity with the existing DateRangePicker.
- **D-16:** Data questions ("what's my average BP?") are treated as dashboard commands: ensure the relevant view is showing and confirm "Your averages are in the stats bar below." No free-text data answers — everything stays inside the validated-command pipeline.

### Claude's Discretion
- Exact confidence heuristic for D-09's guess-vs-ask boundary (prompt design + fixture-suite tuning).
- Exact wording of confirmations, clarifications, and refusal messages — must stay non-technical, non-alarming, large-text friendly.
- Placeholder rotation content and timing (D-02).
- How the one-turn memory (D-12) is carried (client resends context vs. server-side) — planner decides; keep it stateless server-side if practical.

### Deferred Ideas (OUT OF SCOPE)
- Relative date-range adjustments ("go back further", "zoom out") — needs current-state-aware agent calls; revisit after real voice usage in Phase 4+.
- Conversational data Q&A with spoken values ("your average is 118 over 76") — free-text answers need their own accuracy testing; post-MVP alongside SpeechSynthesis replies.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-04 | `POST /agent` accepts a transcript/text command, calls Claude, returns Pydantic-validated JSON dashboard command; raw model output never executed or passed through unvalidated | Structured-outputs GA pattern verified (Code Example 1); double validation: SDK validates `parsed_output` against the Pydantic schema, then server business-validates before responding; response to frontend is a *server-composed* model, never raw Claude text passed through untouched (except display-only clarification question strings, rendered as escaped text) |
| API-05 | Agent date ranges are symbolic (last_n_days etc.) and resolved server-side in local time — Claude never computes absolute dates | Symbolic `DateRange` union design (Code Example 2); server resolver mirrors `frontend/src/lib/dates.ts resolveFilters` — anchored to latest reading, naive local dates, inclusive end (Pitfall 4) |
| VOICE-06 | Every applied command produces a large-text confirmation of what changed | D-05/D-07: confirmation composed **deterministically on the frontend** from post-apply store state (reusing `presetLabel`/`fmtLongDate`) — never Claude-authored, so it is always accurate and testable (Code Example 5); `aria-live="polite"` region in the CommandBar |
| VOICE-07 | Unrecognized/ambiguous commands produce clear non-technical clarification — never silent failure, raw error, or 500 | Discriminated response kinds (`applied` / `clarify` / `refuse` / `unclear`); endpoint returns 200 with friendly copy for every model/validation/API failure path (Pitfall 5, Code Example 3); frontend maps 429/network errors to friendly copy too |
| VOICE-08 | Text input box drives the same agent endpoint voice will use | CommandBar POSTs `{text, context}` — Phase 4 feeds transcripts into the identical mutation; nothing in the endpoint is text-vs-voice specific; prompt tells Claude input may be a garbled speech transcript |
| VOICE-09 | Agent describes what the dashboard shows; never medical advice/diagnosis/alarm interpretation | `refuse` response kind with **fixed server-side copy templates** (D-10 redirect + chart switch); system prompt boundary rules; fixture suite includes medical-question utterances asserting `refuse` |
| SEC-02 | Anthropic API key lives in backend env vars only; all Claude calls via backend | `anthropic_api_key` added to `pydantic-settings` `Settings`; `Anthropic` client constructed backend-only; frontend only ever calls `POST /agent`; key absent from all frontend code and responses |
</phase_requirements>

## Summary

The core technical risk of this phase — the Anthropic structured-outputs API surface — is resolved: **structured outputs are GA, no beta header required**. `client.messages.parse(..., output_format=PydanticModel)` works in the current Python SDK (0.117.0 on PyPI, verified 2026-07-18) and `claude-haiku-4-5` is explicitly listed as supported. One update since CLAUDE.md's stack research: the API-level parameter is now `output_config.format`, but the SDK's `messages.parse()` still accepts `output_format` as a convenience parameter and translates it internally — the CLAUDE.md pattern stands as written. Access the result via `response.parsed_output`; check `stop_reason == "refusal"` (and `"max_tokens"`) before touching it.

The architecture splits cleanly along the existing seams: Claude (backend) does *interpretation only* — text in, tagged symbolic command out. The backend does validation, symbolic date resolution (mirroring `resolveFilters` in `frontend/src/lib/dates.ts`, anchored to the latest reading, never today), and fixed-template copy for refusals and didn't-catch messages. The frontend applies validated filter deltas to the zustand store (callable from outside the React tree — the reason zustand was chosen) and composes the full-state confirmation deterministically. Claude-generated free text reaches the UI only as the short clarification question string, rendered as escaped text.

Two schema-design findings materially shape the plan: (1) structured outputs **do not guarantee enum capitalization** — drift typically hits "the first letter of a word following a space", which is exactly the shape of the project's BP labels ("Hypertensive Crisis") — so the Claude-facing schema must use lowercase snake_case tokens mapped server-side to canonical labels; (2) numeric `minimum`/`maximum` and Pydantic discriminated unions (`Field(discriminator=...)`) are not supported — use constraint-free Claude-facing models with plain `Literal`-tagged `anyOf` unions, and validate ranges in the service layer after parse.

**Primary recommendation:** Build `POST /agent` as a thin pipeline — `slowapi` rate limit → request Pydantic model → `messages.parse(output_format=AgentOutput)` on `claude-haiku-4-5` → stop_reason/validation guard → server-side symbolic date resolution → store-shaped `AgentReply` — with every failure path collapsing to a friendly 200 `unclear` response, and test it with dependency-injected fake interpreters plus a live-marked ~30-utterance fixture suite.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Natural-language interpretation | Backend (Claude via `/agent`) | — | SEC-02: API key backend-only; model output is untrusted input |
| Output schema validation | Backend (Pydantic) | — | API-04; SDK validates parse, service layer re-validates business rules |
| Symbolic date resolution | Backend (resolver module) | — | API-05 locked: "resolved server-side in local time"; must mirror frontend `resolveFilters` anchor semantics |
| Refusal / didn't-catch copy | Backend (fixed templates) | — | VOICE-09/D-10/D-11: safety copy must be deterministic, non-alarming — never model-generated |
| Clarification question text | Backend (Claude-generated string) | Frontend (renders as escaped text) | Genuine ambiguity varies; short string, display-only, React auto-escapes |
| Filter application | Frontend (zustand store actions) | — | D-13: store is the sole mutation surface; agent handler calls actions from outside the React tree |
| Confirmation composition (full-state echo) | Frontend (deterministic template) | — | D-07: only the frontend knows post-merge full state; deterministic = always accurate, unit-testable |
| Working/confirmed/error UI states | Frontend (CommandBar) | — | D-03/D-05/D-06; TanStack `useMutation` drives states |
| Rate limiting | Backend (slowapi) | Frontend (maps 429 → friendly copy) | Claude API cost control; CLAUDE.md names slowapi |
| Auth | Backend (`verify_token` router dependency) | — | Attach now (design), enforcement flips in Phase 5 |
| API key custody | Backend (`pydantic-settings` env) | — | SEC-02 |

## Standard Stack

### Core (new this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| anthropic | 0.117.0 (pin `==0.117.*`) | Claude API SDK; `messages.parse()` structured outputs | [VERIFIED: PyPI 2026-07-18 — 0.117.0 latest; slopcheck OK] GA structured outputs, no beta header [CITED: platform.claude.com/docs/en/build-with-claude/structured-outputs]; CLAUDE.md locks `claude-haiku-4-5` |
| slowapi | 0.1.10 | Rate limiting on `/agent` | [VERIFIED: PyPI 2026-07-18 — 0.1.10 latest; slopcheck OK] CLAUDE.md names it; standard starlette-compatible limiter |

Everything else this phase needs is already installed: fastapi 0.139.*, pydantic 2.13.*, pydantic-settings 2.14.*, httpx 0.28.*, pytest 9.* (backend); @tanstack/react-query 5.101.x, zustand 5.0.x, vitest 4.x (frontend). No new frontend packages are required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `messages.parse(output_format=...)` | Raw `messages.create` + `output_config={"format": ...}` + manual `json.loads` | parse() gives typed `parsed_output` + automatic schema transformation/validation for free; use raw form only if the SDK helper misbehaves |
| slowapi | Hand-rolled in-memory counter dependency | slowapi is ~zero-config and battle-tested; hand-rolling saves a dep but re-solves solved problems |
| `claude-haiku-4-5` | `claude-sonnet-5` | Locked by CLAUDE.md: haiku is fastest/cheapest and sufficient for a closed 4-chart vocabulary; escalate only if fixture suite shows accuracy failure |

**Installation:**
```bash
# backend/pyproject.toml dependencies — add:
#   "anthropic==0.117.*",
#   "slowapi==0.1.*",
cd backend && pip install -e ".[dev]"
```

**Version verification:** `pip index versions anthropic` → 0.117.0; `pip index versions slowapi` → 0.1.10 (both run 2026-07-18).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| anthropic | PyPI | ~3.5 yrs (0.2.x era 2023) | very high (official vendor SDK) | github.com/anthropics/anthropic-sdk-python | [OK] | Approved |
| slowapi | PyPI | ~5+ yrs (0.1.0 onward) | widely used | github.com/laurentS/slowapi | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 scanned both packages on PyPI: `2 OK`. (The tool's subsequent auto-install step failed in the sandbox — irrelevant; the legitimacy scan completed.)

## Architecture Patterns

### System Architecture Diagram

```
 [User types command]                                        FRONTEND
        │
        ▼
 CommandBar (idle→working)
        │  POST /agent {text, context?}          Bearer header (stub Phase 3)
        ▼
────────────────────────────────────────────────────────────  BACKEND
 slowapi rate limit ──429──► (frontend maps to friendly copy)
        │
        ▼
 AgentRequest (Pydantic: text ≤ ~500 chars, optional one-turn context)
        │
        ▼
 build_messages(text, context)          ← D-12: [orig, clarify-Q, answer]
        │
        ▼
 client.messages.parse(model=claude-haiku-4-5,
                       output_format=AgentOutput)
        │
        ├─ stop_reason "refusal"/"max_tokens" ─┐
        ├─ APIError / timeout / ValidationError ─┤
        │                                        ▼
        │                          AgentReply kind="unclear"
        │                          (fixed friendly copy + examples, 200)
        ▼
 AgentOutput.result (tagged union)
        ├─ command ──► resolve_date_range(anchor=latest reading, local naive)
        │                    │
        │                    ▼
        │             AgentReply kind="applied" {filters: store-shaped delta}
        ├─ clarify ──► AgentReply kind="clarify" {question, context echo}
        ├─ refuse_medical ─► AgentReply kind="refuse" {fixed copy, chart}
        ├─ data_question ──► AgentReply kind="applied" {chart, stats-bar copy}
        └─ unclear ──► AgentReply kind="unclear" {fixed copy + examples}
────────────────────────────────────────────────────────────  FRONTEND
        ▼
 useAgentMutation onSuccess
        ├─ kind applied → applyAgentFilters(delta)  → zustand store actions
        │                     │                        (outside React tree)
        │                     ▼
        │            composeConfirmation(getState(), latestReading)
        │                     │                    ← D-07 full-state echo
        │                     ▼
        │            CommandBar shows confirmation (persists, aria-live)
        │            FilterBar pulses touched controls (D-08, motion-safe)
        └─ other kinds → CommandBar shows message (clarify keeps context
                          for next submit — D-12 client-side memory)
```

### Recommended Project Structure

```
backend/app/
├── routers/
│   └── agent.py          # POST /agent route: rate limit + auth-router include + orchestration
├── agent/
│   ├── __init__.py
│   ├── schemas.py        # Claude-facing AgentOutput union + AgentRequest/AgentReply API models
│   ├── prompt.py         # SYSTEM_PROMPT + build_messages(text, context)
│   ├── resolver.py       # symbolic DateRange → store-shaped preset/customRange (API-05)
│   ├── copy.py           # fixed templates: refusal, didn't-catch + examples (D-10/D-11)
│   └── service.py        # interpret(text, context) -> AgentReply; client wrapper, error guard
backend/tests/
├── test_agent_route.py   # route behavior with fake interpreter (dependency override)
├── test_agent_resolver.py# date resolution parity cases
├── test_agent_schemas.py # union parsing, lowercase-normalization validators
├── test_agent_fixtures.py# ~30-utterance LIVE eval (marked, skips without key)
└── fixtures/agent_utterances.json

frontend/src/
├── components/CommandBar.tsx      # D-01..D-08 UI; owns clarify-context local state
├── hooks/useAgent.ts              # useMutation → postAgent
├── lib/agent.ts                   # applyAgentFilters(delta), composeConfirmation(state, anchor)
└── api/client.ts                  # + postJson / postAgent; api/types.ts + AgentReply mirror
```

### Pattern 1: Claude-facing schema — constraint-free, lowercase tokens, Literal-tagged union
**What:** The model Claude fills (`AgentOutput`) uses only structured-outputs-safe features: closed string `Literal`s/enums in lowercase snake_case (no spaces), no `ge`/`le`/`min_length`, no `Field(discriminator=...)`, plain unions where each member carries a required `Literal` tag field.
**When to use:** Everything passed as `output_format`. The API-facing models (`AgentRequest`, `AgentReply`) are ordinary Pydantic and may use any constraint.
**Why:** Official docs: numeric min/max and string length constraints unsupported (SDK strips them and appends to descriptions, then validates responses against the *original* schema — so a violated stripped constraint raises at parse time instead of failing gracefully); enum capitalization is not guaranteed, drifting "typically in the first letter of a word following a space"; discriminated unions "not directly supported" but `anyOf` is. [CITED: platform.claude.com/docs/en/build-with-claude/structured-outputs]

### Pattern 2: All failure paths collapse to a friendly 200
**What:** `interpret()` catches `anthropic.APIError` (incl. timeouts), Pydantic `ValidationError`, `stop_reason in ("refusal", "max_tokens")`, and missing `parsed_output`, returning `AgentReply(kind="unclear", message=<didn't-catch copy + examples>)`. The route itself never raises for model-side problems. The only non-200s the frontend can see are slowapi's 429 (mapped client-side to friendly copy) and, from Phase 5, 401.
**Why:** VOICE-07 / success criterion 3: "never a silent failure, raw error, or 500."

### Pattern 3: Dependency-injected interpreter (mirrors `get_db`)
**What:** The route depends on `get_interpreter` returning the `interpret` callable; `backend/tests/conftest.py`-style `app.dependency_overrides[get_interpreter]` swaps in fakes returning canned `AgentReply`/`AgentOutput` objects.
**Why:** Matches the established `get_db` override pattern (RESEARCH Pitfall 10 lineage); makes route tests deterministic and free of network/SDK mocking gymnastics.

### Pattern 4: Store mutation from outside the React tree + deterministic confirmation
**What:** `applyAgentFilters(delta)` calls `useFilters.getState().setActiveChart(...)` etc. (zustand's documented non-hook access); then `composeConfirmation(useFilters.getState(), latestReading)` renders the D-07 full-state echo from the *post-merge* store, reusing `presetLabel`/`fmtLongDate`.
**Why:** This is why zustand was chosen (CLAUDE.md); deterministic confirmation means VOICE-06 is unit-testable and can never mis-state what was applied.

### Anti-Patterns to Avoid
- **Claude-authored confirmations:** the model doesn't know post-merge state (D-13 carry-over) and can phrase alarmingly; compose on the frontend from the store.
- **Prompt-engineering "return only JSON" + `json.loads`:** structured outputs are GA; this is explicitly banned in CLAUDE.md.
- **Passing user text into the system prompt:** keep user/transcript text strictly in `user` role messages; system prompt is static (prompt-injection hygiene — injection can then at worst flip filters, never escape the schema).
- **Storing agent replies in TanStack Query cache:** this is a mutation, not server state; reply handling lives in `onSuccess`.
- **`datetime.now()` anywhere in the resolver:** presets anchor to the latest reading (dashboard would be empty forever with today-anchoring — data ends 2025-06-13).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema-conforming model output | JSON prompt tricks, regex extraction, retry-until-valid loops | `messages.parse(output_format=Model)` | Constrained sampling makes non-conforming JSON impossible (except refusal/max_tokens, which you guard) |
| Rate limiting | Custom counter middleware | slowapi `@limiter.limit("N/minute")` | Solved problem; correct 429 semantics; keyed by remote address |
| NL date phrase parsing ("since June") | `dateparser`/`dateutil` fuzzy parsing on the raw text | Claude emits symbolic tokens; server resolves with stdlib `datetime` + `calendar.monthrange` | API-05 locks the split: Claude classifies, server computes; a second NL parser would fork interpretation |
| HTTP retries/timeouts to Anthropic | Custom retry loop | SDK built-in `max_retries` / `timeout` constructor args | SDK retries idempotent failures with backoff already |
| Transcript display safety | HTML sanitizer for model text | React's default text escaping; render strings as text nodes only | Model strings never touch `dangerouslySetInnerHTML`; nothing to sanitize |

**Key insight:** the entire "agent" is a classifier with a closed vocabulary. Every place you might add cleverness (date math in the model, free-text answers, retry-parse loops) is a place the pipeline stops being deterministic and testable.

## Common Pitfalls

### Pitfall 1: CORS is currently GET-only — the POST /agent preflight will fail
**What goes wrong:** `backend/app/main.py` sets `allow_methods=["GET"]` and `allow_headers=["Authorization"]`. A JSON POST from the Vite origin triggers a preflight requesting `POST` + `Content-Type` — the browser blocks it; the frontend sees `ApiError(0)`, which looks like the backend is down.
**How to avoid:** Update the CORS middleware to `allow_methods=["GET", "POST"]`, `allow_headers=["Authorization", "Content-Type"]` as part of the agent-route plan.
**Warning signs:** Command bar always shows the network-failure message while `curl` works.

### Pitfall 2: Enum capitalization drift breaks parse on space-containing labels
**What goes wrong:** Docs guarantee no exact capitalization of enum/const values — drift "typically in the first letter of a word following a space". The canonical BP labels ("Stage 1", "Hypertensive Crisis") are the worst case; SDK validation against the original schema then raises. [CITED: structured-outputs docs]
**How to avoid:** Claude-facing tokens are lowercase snake_case (`"hypertensive_crisis"`, `"stage_1"`, `"am"`, `"pm"`); a server-side map converts to canonical labels for `AgentReply`. Belt-and-suspenders: `@field_validator(..., mode="before")` lowercasing incoming strings (runs inside SDK validation too, since parse constructs the Pydantic model).
**Warning signs:** Intermittent `ValidationError` from parse only on category commands.

### Pitfall 3: Constraints in the Claude-facing schema turn soft errors into hard parse failures
**What goes wrong:** `Field(ge=1, le=365)` on `last_n_days.n` gets stripped from the wire schema but is still enforced when the SDK validates the response — Claude returning `n=1000` raises instead of letting you clamp gracefully.
**How to avoid:** Claude-facing models are constraint-free; the service layer validates/clamps after parse (e.g., `n < 1` or absurd → `unclear` reply; large `n` → treat as "all").
**Warning signs:** Fixture utterances like "last 500 days" produce `unclear` when a clamp was expected.

### Pitfall 4: Server date resolution drifts from frontend `resolveFilters`
**What goes wrong:** The frontend anchors N-day presets to the **latest reading** (inclusive: anchor−(N−1)..anchor) and treats `end_date` as inclusive. A server resolver anchored to `date.today()` or exclusive-end produces different ranges for "last 30 days" via agent vs. clicking the 30-days button — visibly inconsistent dashboards.
**How to avoid:** Resolver takes `anchor: date` = max unfiltered `Reading.datetime_` (queried in the route via `get_db`); mirror `resolveFilters` arithmetic exactly; emit `datePreset` tokens for n∈{7,30,90} and "all", `customRange {from,to}` "YYYY-MM-DD" strings otherwise. Naive local dates throughout — DATA-05 means no tz math exists anywhere.
**Warning signs:** `test_agent_resolver.py` parity cases (port the frontend `dates.test.ts` expectations) fail.

### Pitfall 5: Trusting `parsed_output` without checking `stop_reason`
**What goes wrong:** Refusals return HTTP 200 with `stop_reason: "refusal"` and output that "may not match your schema"; `max_tokens` truncation likewise. Accessing `.parsed_output` first crashes or passes garbage. [CITED: structured-outputs docs]
**How to avoid:** Guard order in `service.interpret`: check `stop_reason`, then `parsed_output is None`, then business validation — all failure branches → `unclear` reply. Note: safety-refusal (`stop_reason`) ≠ the D-10 medical refusal (a *successful* parse of the `refuse_medical` variant).
**Warning signs:** 500s on hostile/garbled fixture inputs.

### Pitfall 6: slowapi decorator order and missing `request: Request`
**What goes wrong:** slowapi silently does nothing without a `request: Request` parameter in the endpoint signature, and the route decorator must sit **above** `@limiter.limit(...)`. [CITED: slowapi.readthedocs.io]
**How to avoid:** Follow Code Example 3 exactly; add a test that hammers the endpoint past the limit and asserts 429.
**Warning signs:** Rate-limit test never sees 429.

### Pitfall 7: `new Date("YYYY-MM-DD")` on server-resolved customRange
**What goes wrong:** Known project pitfall — date-only strings parse as UTC midnight, off-by-one in negative-offset timezones. The agent reply carries `customRange` as "YYYY-MM-DD"; any display/derivation must use the existing `parseDateOnly`.
**How to avoid:** `applyAgentFilters` passes strings straight to `setCustomRange(from, to)` (store stores strings); confirmation formatting uses `parseDateOnly` + `fmtLongDate`.

### Pitfall 8: Placeholder-only labeling and silent confirmations (accessibility)
**What goes wrong:** A rotating placeholder (D-02) is not an accessible name, and confirmations that only change visually are invisible to screen readers.
**How to avoid:** Visible `<label>` or `aria-label` on the input; confirmation/message area is an `aria-live="polite"` region; Send button ≥48px with a text label (D-04); pulse animation gated behind Tailwind `motion-safe:` (D-08).

### Pitfall 9: Startup failure when `ANTHROPIC_API_KEY` is unset
**What goes wrong:** A required `anthropic_api_key: str` field in `Settings` makes the whole app (and the existing test suite) crash without the key.
**How to avoid:** `anthropic_api_key: str = ""` default; construct the `Anthropic` client lazily in the service; empty key → immediate friendly `unclear`-style "agent unavailable" reply. Tests and non-agent dev keep working keyless.

### Pitfall 10: First-request grammar-compilation latency read as a hang
**What goes wrong:** The first parse per schema compiles a grammar (extra latency; cached 24h from last use; cache invalidated by schema structure changes). [CITED: structured-outputs docs] With D-03's "Working…" state this is survivable, but a dev may chase a phantom perf bug.
**How to avoid:** Document it; optionally warm at startup with one trivial parse (defer decision — see Open Questions).

## Code Examples

### 1. Structured-outputs call with full guard rails (backend/app/agent/service.py)
```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
# (GA — no beta header; output_format accepted by messages.parse as convenience param)
from anthropic import Anthropic, APIError
from pydantic import ValidationError

from app.agent.copy import UNCLEAR_REPLY  # fixed D-11 copy + examples
from app.agent.prompt import SYSTEM_PROMPT, build_messages
from app.agent.schemas import AgentOutput
from app.config import get_settings

_client: Anthropic | None = None

def _get_client() -> Anthropic | None:
    global _client
    key = get_settings().anthropic_api_key
    if not key:
        return None  # Pitfall 9: keyless dev/test stays bootable
    if _client is None:
        _client = Anthropic(api_key=key, timeout=15.0, max_retries=1)
    return _client

def call_claude(text: str, context: ClarifyContext | None) -> AgentOutput | None:
    """Returns parsed output, or None for every non-schema outcome (→ unclear reply)."""
    client = _get_client()
    if client is None:
        return None
    try:
        msg = client.messages.parse(
            model="claude-haiku-4-5",
            max_tokens=1024,
            temperature=0,          # deterministic classification [ASSUMED — see A1]
            system=SYSTEM_PROMPT,   # static; user text NEVER goes here
            messages=build_messages(text, context),
            output_format=AgentOutput,
        )
    except (APIError, ValidationError):
        return None
    if msg.stop_reason in ("refusal", "max_tokens"):  # Pitfall 5
        return None
    return msg.parsed_output
```

### 2. Claude-facing schema — tagged union, lowercase tokens, no constraints (backend/app/agent/schemas.py)
```python
# Structured-outputs-safe: no ge/le/min_length, no Field(discriminator=...),
# lowercase snake tokens (Pitfall 2), plain anyOf via `|` with required Literal tags.
from typing import Literal
from pydantic import BaseModel, field_validator

ChartToken = Literal["bp_timeline", "pulse_trend", "bp_categories", "am_pm_comparison"]
BPCategoryToken = Literal[
    "all", "hypotension", "normal", "elevated", "stage_1", "stage_2", "hypertensive_crisis"
]
MonthToken = Literal[
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]

class PresetRange(BaseModel):
    kind: Literal["preset"]
    preset: Literal["7d", "30d", "90d", "all"]

class LastNDays(BaseModel):
    kind: Literal["last_n_days"]
    n: int  # NO ge/le here — clamp in service layer (Pitfall 3)

class MonthRange(BaseModel):
    kind: Literal["month_range"]
    start_month: MonthToken
    end_month: MonthToken | None = None   # None → "since <month>": through latest reading
    year: int | None = None               # None → infer from anchor year (resolver)

class AbsoluteRange(BaseModel):
    kind: Literal["absolute"]             # DateRangePicker parity (D-15 from/to)
    from_date: str | None = None          # "YYYY-MM-DD"; format "date" is supported
    to_date: str | None = None

DateRange = PresetRange | LastNDays | MonthRange | AbsoluteRange

class DashboardCommand(BaseModel):
    action: Literal["command"]
    chart: ChartToken | None = None       # None = unchanged (D-13 carry-over)
    date_range: DateRange | None = None
    am_pm: Literal["all", "am", "pm"] | None = None
    bp_category: BPCategoryToken | None = None
    reset: bool = False                   # "show all data" → showAllData()

class DataQuestion(BaseModel):
    action: Literal["data_question"]      # D-16: point at the stats bar
    chart: ChartToken | None = None

class Clarification(BaseModel):
    action: Literal["clarify"]            # D-09 genuinely-ambiguous branch
    question: str                         # short, non-technical (prompt-constrained)

class MedicalRefusal(BaseModel):
    action: Literal["refuse_medical"]     # D-10: server templates the copy
    chart: ChartToken | None = None       # relevant data to show anyway

class Unintelligible(BaseModel):
    action: Literal["unclear"]            # D-11

class AgentOutput(BaseModel):
    result: DashboardCommand | DataQuestion | Clarification | MedicalRefusal | Unintelligible

    @field_validator("result", mode="before")
    @classmethod
    def _lower_tokens(cls, v):            # Pitfall 2 belt-and-suspenders
        if isinstance(v, dict):
            return {k: s.lower() if isinstance(s, str) and k != "question" else s
                    for k, s in v.items()}
        return v
```
API-facing models (ordinary Pydantic, constraints fine): `AgentRequest {text: str (max_length≈500), context: ClarifyContext | None}`, `ClarifyContext {original_text: str, question: str}`, `AgentReply {kind: Literal["applied","clarify","refuse","unclear"], filters: AppliedFilters | None, message: str, context: ClarifyContext | None}` where `AppliedFilters` mirrors the store shape: `{activeChart?, datePreset?, customRange?, amPm? ("AM"/"PM"/"all"), bpCategory? (canonical labels), reset?}`.

### 3. Route with slowapi + auth-router include (backend/app/routers/agent.py, app/main.py)
```python
# Source: https://slowapi.readthedocs.io — decorator BELOW route decorator,
# endpoint MUST declare `request: Request` (Pitfall 6).
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/agent", response_model=AgentReply)
@limiter.limit("20/minute")
def agent(request: Request, body: AgentRequest,
          db: Annotated[Session, Depends(get_db)],
          interpret: Annotated[Interpreter, Depends(get_interpreter)]) -> AgentReply:
    anchor = db.scalar(select(func.max(Reading.datetime_)))   # resolver anchor (Pitfall 4)
    return interpret(body.text, body.context, anchor)

# app/main.py additions:
#   app.state.limiter = limiter
#   app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
#   app.add_middleware(CORSMiddleware, allow_origins=..., 
#                      allow_methods=["GET", "POST"],                  # Pitfall 1
#                      allow_headers=["Authorization", "Content-Type"])
#   app.include_router(agent.router, dependencies=[Depends(verify_token)])  # auth now, enforced Phase 5
```

### 4. Deterministic route tests via dependency override (backend/tests/test_agent_route.py)
```python
# Mirrors conftest.py's get_db override pattern — no SDK/network mocking needed.
def test_applied_command(client):
    from app.routers.agent import get_interpreter
    from app.main import app

    def fake_interpret(text, context, anchor):
        return AgentReply(kind="applied",
                          filters=AppliedFilters(activeChart="pulse_trend"),
                          message="", context=None)

    app.dependency_overrides[get_interpreter] = lambda: fake_interpret
    res = client.post("/agent", json={"text": "show my pulse"})
    assert res.status_code == 200
    assert res.json()["kind"] == "applied"
```
The live fixture suite is separate: `tests/fixtures/agent_utterances.json` entries `{"utterance": "...", "context": null, "expect": {"kind": "applied", "chart": "bp_timeline", "datePreset": "30d", "amPm": "AM"}}` (~30 entries incl. garbled transcripts like "sho me blod preshure last thurty days" and medical questions). `test_agent_fixtures.py` is `@pytest.mark.live` + `skipif(not os.environ.get("ANTHROPIC_API_KEY"))`, calls the real `interpret`, and asserts intent/fields (not message wording). Register the marker in `pyproject.toml` `[tool.pytest.ini_options] markers`, and default-exclude with `addopts = "-m 'not live'"` so CI stays deterministic and free.

### 5. Frontend: mutation + outside-tree store application + deterministic confirmation
```typescript
// hooks/useAgent.ts — TanStack Query v5 mutation (established v5 project patterns)
export function useAgent() {
  return useMutation({ mutationFn: postAgent }); // postAgent = new postJson in api/client.ts
}

// lib/agent.ts — zustand outside-React access (documented zustand v5 pattern)
export function applyAgentFilters(f: AppliedFilters) {
  const s = useFilters.getState();
  if (f.reset) { s.showAllData(); }
  if (f.activeChart) s.setActiveChart(f.activeChart);
  if (f.datePreset && f.datePreset !== "custom") s.setDatePreset(f.datePreset);
  if (f.customRange?.from && f.customRange?.to)
    s.setCustomRange(f.customRange.from, f.customRange.to);   // strings straight through (Pitfall 7)
  if (f.amPm) s.setAmPm(f.amPm);
  if (f.bpCategory) s.setBpCategory(f.bpCategory);
}

// D-07 full-state echo — composed AFTER apply, from the store, reusing presetLabel:
// "Showing {chartLabel}, {presetLabel|customRange dates}{, mornings|, afternoons}{, {category} only}"
export function composeConfirmation(state: FilterState, latestReading: string | null): string { ... }
```
CommandBar state machine (local `useState`): `idle | working | confirmed(msg) | clarify(msg, context) | error(msg)`; `clarify` stores the reply's `context` and resends it with the next submit (D-12, client-carried — keeps the server stateless per CONTEXT discretion note); confirmation persists until next submit (D-06); input clears only on `applied` (D-03).

### 6. One-turn memory message assembly (backend/app/agent/prompt.py)
```python
def build_messages(text: str, context: ClarifyContext | None) -> list[dict]:
    if context is None:
        return [{"role": "user", "content": text}]
    return [  # D-12: original + clarification question + follow-up answer
        {"role": "user", "content": context.original_text},
        {"role": "assistant", "content": context.question},
        {"role": "user", "content": text},
    ]
```
System prompt content (discretion, but shape is settled): role = "interpreter for a fixed health-dashboard command vocabulary"; input "may be a speech transcript with recognition errors — infer the intended command when one reading is clearly most likely" (D-09 + garbled-transcript handling); enumerate chart/filter vocabulary with example phrasings ("mornings" → am, "pulse"/"heart rate" → pulse_trend); rules: never compute dates (emit symbolic ranges), medical interpretation → `refuse_medical` with the most relevant chart, data questions → `data_question`, genuinely ambiguous → one short non-technical `clarify` question, gibberish → `unclear`; partial commands set only mentioned fields (D-13); "show all data"/"start over" → `reset: true`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Beta header `structured-outputs-2025-11-13` + `output_format` API param | GA, no header; API param is `output_config.format`; SDK `messages.parse()` still accepts `output_format` and translates internally | GA landed post-Nov-2025 beta; SDK migrated around v0.77 changelog entries; verified current 2026-07-18 | CLAUDE.md's pattern works as written; no beta plumbing needed; the `output_format` convenience param is in a "transition period" — pinning `anthropic==0.117.*` insulates the phase |
| Forced tool-use JSON trick | `messages.parse` structured outputs | Structured outputs GA on all current models | Banned path per CLAUDE.md "What NOT to Use" |
| TanStack Query v4 idioms (`onSuccess` on queries, `keepPreviousData` bool) | v5: `placeholderData: keepPreviousData`, mutation callbacks on `useMutation` | v5 (already in the codebase) | Follow existing `useStats.ts` idioms |

**Deprecated/outdated:** nothing else relevant; slowapi 0.1.10 is the long-stable latest (no 2026 release — see A3).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `temperature=0` is the right default for deterministic intent classification with structured outputs | Code Example 1 | Low — worst case slightly different tie-breaking; fixture suite would surface it; trivially tunable |
| A2 | Pydantic `Field(discriminator=...)` emits a `discriminator`/mapping construct that structured outputs may reject or mishandle ("discriminated unions: not directly supported" per docs); plain `Literal`-tagged `anyOf` is safe | Pattern 1, Code Example 2 | Low — the prescribed plain-union form is a strict subset of supported features; only cost is slightly less elegant Pydantic |
| A3 | slowapi 0.1.10 (last release ~2023) remains compatible with FastAPI 0.139 / current Starlette | Standard Stack, Pitfall 6 | Medium — if incompatible, fallback is a ~20-line in-process token-bucket dependency; verify with the 429 test in Wave 0/first plan |
| A4 | `Anthropic` client kwargs `timeout=` and `max_retries=` exist with these names in 0.117.0 | Code Example 1 | Low — long-standing SDK constructor args (training knowledge); a 2-line fix if renamed |
| A5 | Anchor-year inference for month ranges (year=None → anchor year; if the resolved range starts after the anchor, roll back one year) matches user intent | Resolver design | Low for current single-year dataset (Feb–Jun 2025); revisit when data spans years |
| A6 | slowapi's default `_rate_limit_exceeded_handler` 429 JSON body is acceptable because the frontend maps any non-200 to friendly copy (raw body never rendered) | Pattern 2, Pitfall 6 | Low — existing App.tsx precedent (T-02-11) already centralizes friendly error copy |

## Open Questions

1. **Warm the structured-outputs grammar cache at app startup?**
   - What we know: first parse per schema pays compile latency; cached 24h from last use [CITED: docs].
   - What's unclear: whether the compile latency on a schema this small is noticeable (likely sub-second to low seconds).
   - Recommendation: skip warming in Phase 3 (D-03's "Working…" state absorbs it); measure during fixture-suite runs; add a startup warm task in Phase 4 if voice latency demands it.
2. **Where does the ~30-utterance live suite run?**
   - What we know: it needs a real key and costs ~$0.01–0.05/run on haiku; CI default must stay deterministic.
   - Recommendation: `-m "not live"` in `addopts`; run manually (`pytest -m live`) at the phase verification gate — the success criterion says "verified against" the suite, so make one green live run part of phase verification evidence.
3. **`AppliedFilters` mapping when `last_n_days` n ∉ {7,30,90}** ("last 14 days")
   - What we know: store supports arbitrary ranges only via `customRange` (which sets `datePreset: "custom"`); presets exist for 7/30/90.
   - Recommendation: resolver emits preset tokens for exact 7/30/90 (and "all"), concrete `customRange` for everything else — confirmation then reads dates explicitly, which is honest. Lock in plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python venv (backend/.venv) | backend dev/tests | ✓ | 3.12.1 | — |
| Node | frontend dev/tests | ✓ | 24.14.0 | — |
| anthropic SDK | /agent | ✗ (not yet in pyproject) | 0.117.0 on PyPI | install step in plan |
| slowapi | rate limit | ✗ (not yet in pyproject) | 0.1.10 on PyPI | 20-line custom limiter (A3 fallback) |
| **ANTHROPIC_API_KEY** | live Claude calls + live fixture suite | ✗ — not in shell env; no `backend/.env` exists | — | none for live behavior; keyless dev degrades gracefully (Pitfall 9) |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` — the planner must include a human step: user provides the key via `backend/.env` (confirm `.env` is gitignored) or shell env before the live fixture suite / manual verification can run. All deterministic tests pass without it.

**Missing dependencies with fallback:**
- anthropic / slowapi — plain `pip install -e .` after pyproject edit; both slopcheck-approved.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 9.x, configured in `backend/pyproject.toml` (`testpaths=["tests"]`) |
| Framework (frontend) | vitest 4.x (`npm test`), jsdom + testing-library already configured |
| Quick run command | `cd backend && python -m pytest tests/test_agent_route.py -x` / `cd frontend && npx vitest run src/components/CommandBar.test.tsx` |
| Full suite command | `cd backend && python -m pytest` and `cd frontend && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-04 | /agent returns validated AgentReply; fake-interpreter route tests; never 500 on bad model output | unit/integration | `python -m pytest tests/test_agent_route.py -x` | ❌ Wave 0 |
| API-04 | Claude-facing union parses/normalizes tokens | unit | `python -m pytest tests/test_agent_schemas.py -x` | ❌ Wave 0 |
| API-05 | Symbolic ranges resolve anchored to latest reading, parity with frontend resolveFilters | unit | `python -m pytest tests/test_agent_resolver.py -x` | ❌ Wave 0 |
| VOICE-06 | composeConfirmation full-state echo strings | unit (vitest) | `npx vitest run src/lib/agent.test.ts` | ❌ Wave 0 |
| VOICE-07 | unclear/clarify paths render friendly copy; 429/network → friendly copy | unit (vitest + pytest) | CommandBar test + route error-path tests | ❌ Wave 0 |
| VOICE-08 | CommandBar submit → mutation → store application | unit (vitest, mocked mutation) | `npx vitest run src/components/CommandBar.test.tsx` | ❌ Wave 0 |
| VOICE-09 + SC4 | ~30-utterance live fixture suite incl. garbled + medical | live eval (marked) | `python -m pytest -m live tests/test_agent_fixtures.py` | ❌ Wave 0 |
| SEC-02 | key only via Settings; no key in any frontend file | unit + grep check | `grep -ri anthropic frontend/src` returns nothing | — |

### Sampling Rate
- **Per task commit:** relevant quick command above
- **Per wave merge:** both full suites (`python -m pytest` excludes live via addopts; `npx vitest run`)
- **Phase gate:** full suites green + one green **live** fixture-suite run with real key (success criterion 4 evidence) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_agent_schemas.py` — API-04 union/normalization
- [ ] `backend/tests/test_agent_resolver.py` — API-05 parity cases
- [ ] `backend/tests/test_agent_route.py` — API-04/VOICE-07 route behavior (uses existing `client` fixture + interpreter override)
- [ ] `backend/tests/fixtures/agent_utterances.json` + `test_agent_fixtures.py` — SC4 live suite; register `live` marker + `addopts = "-m 'not live'"` in pyproject
- [ ] `frontend/src/lib/agent.test.ts`, `frontend/src/components/CommandBar.test.tsx` — VOICE-06/07/08
- [ ] Framework installs: `anthropic==0.117.*`, `slowapi==0.1.*` in `backend/pyproject.toml`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | `verify_token` router dependency attached to agent router now; enforcement flips Phase 5 (accepted per roadmap) |
| V3 Session Management | no | stateless Bearer design (Phase 5) |
| V4 Access Control | no | single shared credential model by design |
| V5 Input Validation | yes | `AgentRequest` Pydantic (`max_length` on text bounds prompt cost); model output re-validated (SDK parse + service business rules); enum whitelists end-to-end |
| V6 Cryptography | no | none introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via command text / transcript | Tampering | User text confined to `user` role; static system prompt; output constrained to closed schema — worst case is a wrong filter, instantly visible via D-07 echo; model text never executed (API-04) |
| API key exfiltration | Information disclosure | SEC-02: key in backend env via pydantic-settings only; never in responses, logs, or frontend bundle; `backend/.env` must be gitignored (verify — DATA-08 precedent) |
| Cost abuse / DoS against paid Claude endpoint | Denial of service | slowapi `20/minute` per-IP + `max_length` on input + `max_tokens=1024`; timeout 15s caps hung calls |
| Raw error leakage (stack traces, SDK errors) | Information disclosure | Pattern 2: all failures → templated friendly copy; existing App.tsx T-02-11 precedent extends to CommandBar |
| Stored/reflected XSS via model-generated clarification text | Tampering | Rendered exclusively as React text nodes (auto-escaped); no `dangerouslySetInnerHTML` anywhere in the phase |
| Medical-harm output (alarm-style interpretation) | — (domain safety) | VOICE-09: refusal copy is fixed server template, never model prose; fixture suite asserts `refuse` on medical utterances |

## Project Constraints (from CLAUDE.md)

- Fixed stack — FastAPI/Pydantic v2/React/zustand/TanStack Query; Claude API via backend only (restated as load-bearing).
- Agent returns JSON only, Pydantic-validated; never execute raw model output.
- API keys in env vars, never frontend; all Claude calls through the backend.
- Accessibility non-negotiables: ≥48px targets, ≥18px text, high contrast, keyboard navigable, no hover-only/drag/precise pointing — applies to CommandBar and Send button.
- Model locked: `claude-haiku-4-5`; pattern locked: `client.messages.parse(output_format=Model)`; handle `refusal` stop_reason; compare enums case-insensitively; no numeric min/max in the wire schema (validate post-parse locally).
- Do NOT use: prompt-and-parse JSON tricks, frontend Anthropic calls, cookies for auth.
- slowapi named for `/agent` rate limiting; config via pydantic-settings (`ANTHROPIC_API_KEY` joins `DATABASE_URL`, `CORS_ORIGINS`).
- GSD workflow enforcement: file changes go through GSD commands.
- No project skills directories exist (verified — `.claude/skills/`, `.agents/skills/` absent).

## Sources

### Primary (HIGH confidence)
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs (fetched 2026-07-18) — GA status, `output_config.format` vs `output_format` convenience param, `parsed_output`, model support incl. claude-haiku-4-5, schema limitations (no min/max, additionalProperties false, discriminated unions not direct, supported string formats incl. `date`), refusal/max_tokens semantics, enum capitalization caveat, grammar cache 24h
- PyPI via `pip index versions` (2026-07-18) — anthropic 0.117.0, slowapi 0.1.10
- slopcheck 0.6.1 scan (2026-07-18) — anthropic [OK], slowapi [OK]
- Project codebase read directly (2026-07-18): `frontend/src/store/filters.ts`, `frontend/src/lib/dates.ts`, `frontend/src/hooks/useStats.ts`, `frontend/src/App.tsx`, `frontend/src/api/{client,types}.ts`, `frontend/src/components/FilterBar.tsx`, `backend/app/{main,auth,config,deps,schemas}.py`, `backend/app/routers/readings.py`, `backend/tests/conftest.py`, `backend/pyproject.toml`, `frontend/package.json`

### Secondary (MEDIUM confidence)
- https://slowapi.readthedocs.io (fetched 2026-07-18) — Limiter setup, decorator order, `request: Request` requirement, 429 handler
- https://raw.githubusercontent.com/anthropics/anthropic-sdk-python/main/CHANGELOG.md (fetched 2026-07-18) — structured outputs beta→formalized timeline; `output_config` migration; no breaking changes noted at 0.116/0.117 (summary tool output; exact version numbers of early entries treated as approximate)

### Tertiary (LOW confidence)
- Anthropic SDK constructor args `timeout`/`max_retries` (A4) and `temperature=0` default (A1) — training knowledge, flagged in Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both new packages registry-verified + slopcheck-approved; structured-outputs surface verified against official docs today
- Architecture: HIGH — grounded in locked CONTEXT decisions and direct reads of the existing store/router/test patterns
- Pitfalls: HIGH for docs-cited items (enum drift, constraints, stop_reason, CORS from code read); MEDIUM for slowapi/Starlette compatibility (A3)

**Research date:** 2026-07-18
**Valid until:** ~2026-08-17 (stable stack; anthropic SDK moves fast — re-verify `output_format` transition status if planning slips past that)
