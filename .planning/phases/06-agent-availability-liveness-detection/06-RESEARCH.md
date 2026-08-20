# Phase 6: Agent Availability (Liveness Detection) - Research

**Researched:** 2026-08-20
**Domain:** Backend circuit-breaker state + FastAPI contract extension + React polling/reactive-store integration, inside an already-shipped single-user health dashboard
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Liveness signal design (backend)**
- **D-01:** Passive-only circuit breaker, fed exclusively by real `/agent` traffic outcomes — no active probe (no `count_tokens()` call) in this phase. Rationale locked in by the user: `count_tokens()` is exempt from Anthropic's billing gate, so it would report "reachable" during Chris's actual known failure mode (the $0-credit billing error) — an active probe would give false confidence for exactly the case that matters. This also satisfies LIVE-04's "never spend tokens" mandate by construction, not just by discipline.
- **D-02:** While the circuit is open (cooldown window active), `/agent` skips the real Claude network call entirely and replies "unavailable" immediately — it does not attempt-and-fail every single command during a known outage. Recovery is checked by letting the next real call through once cooldown expires (standard circuit-breaker pattern).
- **D-03:** Cooldown window ≈ 60 seconds. Chosen to line up with the frontend poll interval (D-05) and to balance "don't hammer a broken/billing-blocked service" against "a caregiver who retries right after a real fix shouldn't wait long."
- **D-04:** One failed real `/agent` call is sufficient to flip the circuit to "unavailable" — no streak/counter of consecutive failures required. Simpler state (a single `_last_outcome`, no counter), matches the standard circuit-breaker pattern from research, and self-corrects quickly since the next real call after the ~60s cooldown re-tests and can immediately flip it back. Accepted tradeoff: a single transient blip can trigger one cooldown window of "unavailable" — judged an acceptable, self-correcting cost for a low-traffic single-user site.
- **D-06 (copy):** The "no API key configured" case (known instantly, zero traffic needed — already surfaced via `/health`'s existing `agent_configured` field) and the "configured but every real call failing" case (only known after a real failure) surface as the **exact same** "assistant unavailable" message and the same reply `kind`. No copy branching between them — this mirrors LIVE-05's explicit deferral of that finer distinction to v2/whenever the paid API is active.

**Check cadence & recovery (frontend)**
- **D-05:** Check liveness at page load (LIVE-03, required) AND poll `/health` on a recurring basis afterward (~60s interval, matching D-03's cooldown) while the tab stays open — not a one-shot check. So a caregiver who leaves the dashboard open finds out if the assistant recovers (or newly degrades) without needing to speak/type a command first.
- **D-07:** The "unavailable" indicator clears **instantly** the moment any real `/agent` command succeeds (reactive, from that command's own success) — it does not wait for the next scheduled poll. Reuses the signal the caregiver/Chris just personally experienced (a command that worked).
- **D-08:** The `/health` poll pauses while the tab is hidden and resumes on return, mirroring the existing `useVoiceCommand` visibilitychange convention (T-04-05) already established in this codebase — consistent pattern, and avoids polling a tab nobody is looking at.
- **Mechanical note (not asked, follows from D-01/D-02/D-05):** because the signal is passive-only and `/agent` skips real calls during cooldown, the `/health` poll during an active cooldown will keep reading the same cached "unavailable" state — actual recovery detection only happens once cooldown expires and the next real command is attempted. This is expected and correct, not a bug to fix.

**Unavailable-state presentation (frontend UI)**
- **D-09:** The "assistant unavailable" indicator is a **separate, persistent UI element** near the CommandBar/mic — NOT folded into CommandBar's existing transient message line (which gets overwritten by typing, a new voice transcript, or the next command's result). This was flagged explicitly by Pitfalls research as the anti-pattern to avoid ("looks identical to a generic loading/error state... give it its own distinct, persistent UI treatment"). Detailed visual design (exact placement, styling, copy) is deferred to the UI-SPEC pass (`gsd-ui-phase`, flagged "UI hint: yes" in ROADMAP.md) — this decision locks the *architectural* choice (separate persistent element, not reusing the transient line), not the pixels.
- **D-10:** One shared indicator, visually and textually identical for both the voice path and the text path — no voice-specific extra treatment in this phase. Simpler, avoids a second copy source to keep in sync, and TTS (which would give "spoken-adjacent" treatment real meaning) doesn't land until Phase 10.
- **D-11:** The indicator has **no dismiss control** — it stays visible for exactly as long as the assistant is actually unreachable, then disappears on its own (via D-07's instant-clear-on-success or the next poll). It is calm/non-blocking by construction (REQUIREMENTS.md already bans alarming banners/sirens/modals for this), so there is nothing intrusive to dismiss, and a dismiss control would add stateful UI surface for a low-drama case.
- **Locked constraint carried from REQUIREMENTS.md/PROJECT.md (not re-discussed, already decided):** the indicator must never be an alarming "OFFLINE" banner, siren icon, or modal interrupt — calm, neutral, non-color-only messaging (word/icon, not color alone), always paired with "manual controls still work" (LIVE-02).

### Claude's Discretion
- Exact cooldown/poll interval fine-tuning around the ~60s anchor (D-03/D-05) — the user endorsed "~60 seconds" as a target, not a hard-coded exact value; small variation (e.g. 45–90s) is fine if it simplifies implementation.
- Exact shape of the new `AgentReply.kind` value (e.g. `"unavailable"`) and the corresponding `/health` field name — schema-level naming is Claude's call during planning, informed by the existing `kind: Literal["applied","clarify","refuse","unclear"]` pattern in `backend/app/agent/schemas.py`.
- Exact visual design (placement, color tokens, icon, copy wording) of the persistent unavailable indicator — architecturally locked (D-09/D-10/D-11), pixel-level design deferred to the UI-SPEC phase per ROADMAP.md's "UI hint: yes" flag on Phase 6. (Now resolved by `06-UI-SPEC.md` — see Canonical References.)
- Whether the circuit-breaker module state lives directly in `agent/service.py` (mirroring the existing lazy-singleton `_client` pattern) or a small sibling module — implementation-location detail, not a product decision.

### Deferred Ideas (OUT OF SCOPE)
- Active `count_tokens()` liveness probe — considered and explicitly rejected for this phase (D-01). Revisit only if a future failure mode emerges that passive-only traffic-based detection can't catch (unlikely to be worth it while the known failure mode is billing, which `count_tokens()` doesn't even detect).
- Distinguishing "not configured" from "temporarily failing" in user-facing copy — already tracked in REQUIREMENTS.md as LIVE-05, v2, deferred until the paid API is active and transient failures are actually observable in production.

**Canonical References (from CONTEXT.md, downstream agents MUST read these):** `.planning/PROJECT.md`; `.planning/REQUIREMENTS.md` §Agent Liveness (LIVE-01..05); `.planning/ROADMAP.md` §Phase 6; `.planning/STATE.md`; `.planning/research/SUMMARY.md` §"Phase 1: Agent Availability Made Visible"; `.planning/research/ARCHITECTURE.md` Pattern 1 + Anti-Pattern 1; `.planning/research/PITFALLS.md` Pitfall 8; `.planning/research/STACK.md` §"Deep Dive 4"; `06-UI-SPEC.md` (component `AgentStatusBanner.tsx`, locked).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | Backend distinguishes "assistant unavailable" from "didn't understand you" — `AgentReply` gets a distinct kind routed from both the no-API-key case and the `call_claude()` exception path (network/timeout/schema-parse failures), replacing today's mislabeling of real outages as generic "unclear" | Architecture Patterns 1–2 (exact guard-order diff, `call_claude()` except-clause split, `interpret()`'s two changed branches); Code Examples (backend test patterns); Pitfall 1 (frontend consumption gap) |
| LIVE-02 | Frontend shows a calm, non-alarming "assistant temporarily unavailable" state distinct from the "didn't catch that" state, always paired with "manual controls still work" | Already fully specified by `06-UI-SPEC.md` (locked markup/copy); this document's Pitfall 1 clarifies the THREE distinct fixed-copy strings in play and where each renders |
| LIVE-03 | Dashboard checks liveness proactively when the page loads, not only reactively after a failed command | Architecture Pattern 3 (`useHealth()` TanStack Query hook, `refetchOnMount` default behavior fetches immediately on Dashboard mount) |
| LIVE-04 | Liveness checks never share `/agent`'s rate limiter and never spend API tokens on their own | Confirmed by construction: `/health` already carries no `@limiter.limit` decorator (Security Domain, "Known Threat Patterns" row); D-01's passive-only design means no `/health` call ever touches the Anthropic API |
</phase_requirements>


## Summary

This phase has almost no open *product* questions left — `06-CONTEXT.md`'s D-01 through D-11 already locked the circuit-breaker shape, cooldown timing, poll cadence, and UI presentation rules, and `06-UI-SPEC.md` already locked the exact JSX/markup for the one new component. What remains is entirely implementation-level: how to wire a module-level circuit breaker into `agent/service.py`'s existing guard-order structure without breaking its documented invariants, how the new `AgentReply.kind` value threads through two frontend switch statements that have **no compiler-enforced exhaustiveness**, how the new `/health` poll should actually be implemented given what `@tanstack/react-query` already does by default, and how the test suite should simulate a failing Claude call without hitting the network. All of this is answered below by reading the actual source files (`agent/service.py`, `routers/agent.py`, `main.py`, `agent/schemas.py`, `agent/copy.py`, `api/types.ts`, `useVoiceCommand.ts`, `CommandBar.tsx`, `client.ts`, `test_health.py`, `test_agent_route.py`, `conftest.py`) rather than inferred from the milestone-level research files, which scoped the *feature* correctly but didn't (and weren't asked to) resolve these exact code-shape questions.

The single highest-leverage finding: `call_claude()` today collapses **every** non-success outcome (`APIError`, `ValidationError`, `refusal`/`max_tokens` stop-reason) into one `None` return, and `interpret()` currently can't tell them apart. Phase 6 needs `interpret()` to route `APIError`/breaker-open outcomes to the new `kind="unavailable"`, while `ValidationError`/refusal outcomes stay on the existing `kind="unclear"` path — because the latter is a *model behavior* signal (Claude responded, the schema/refusal logic just didn't produce a command), not a *reachability* signal, and folding it into "unavailable" would flip the breaker on for 60 seconds' worth of a schema hiccup that had nothing to do with the service being down. This distinction is **not spelled out** in `06-CONTEXT.md` or any of the four milestone research files — it only becomes visible when you read `call_claude()`'s actual except clause — so it's the load-bearing implementation decision of this phase and is worked through in detail below (see Architecture Patterns, Pattern 1).

The second highest-leverage finding: `@tanstack/react-query` (already installed, 5.101.2) already implements D-08's "pause polling while hidden, resume on foreground" requirement natively — verified by reading the installed `focusManager.ts`/`queryObserver.ts` source directly, not docs. A plain `useQuery({ refetchInterval: 60_000 })` on `/health` gets this behavior for free; hand-rolling a `visibilitychange` listener mirroring `useVoiceCommand.ts` (as `06-CONTEXT.md`'s D-08 wording might suggest verbatim) would be redundant and inconsistent with this codebase's own convention that TanStack Query owns server-state polling (`useReadings.ts`/`useStats.ts` are the pattern to mirror for `useHealth.ts`, not `useVoiceCommand.ts`, which exists to manage a fundamentally different problem — a stateful `SpeechRecognition` session, not a periodic fetch).

**Primary recommendation:** Extend `/health` with `agent_reachable: bool | None` (mirrors the `_last_outcome: bool | None` shape from `ARCHITECTURE.md`'s already-locked design); add `kind: "unavailable"` to `AgentReply`; split `call_claude()`'s single except clause into `except APIError` (records breaker failure) vs. `except ValidationError` (does not); implement `useHealth()` as a plain TanStack Query hook with `refetchInterval: 60_000`, not a bespoke visibility-listener hook; and unify the D-05 (poll) and D-07 (reactive) signals into one `store/agentStatus.ts` boolean written by both sources (last-write-wins), rather than reading them as two independently-OR'd stores as `ARCHITECTURE.md`'s rough sketch proposed — the two-store OR design has a latent staleness bug this research identifies below.

## Architectural Responsibility Map

This is a Vite React SPA with no server-side rendering — "Frontend Server (SSR)" is not a tier in this project; all frontend work below is Browser/Client tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Circuit-breaker outcome recording (pass/fail of real `/agent` traffic) | API/Backend (`agent/service.py`) | — | Only the backend observes real Claude call outcomes; must be colocated with `call_claude()`, which already owns the client/network boundary |
| `/health` liveness read | API/Backend (`main.py`) | — | Cheap, cache-only read of module state; no new I/O, ungated like today |
| `AgentReply.kind` contract (`"unavailable"`) | API/Backend (`agent/schemas.py`, `agent/service.py`) | Browser/Client (consumption) | Backend is the single source of truth for what "unavailable" means (D-06); frontend only renders it |
| Proactive load-time + recurring poll | Browser/Client (`hooks/useHealth.ts`) | — | Pure client-side scheduling concern; TanStack Query's existing focus/visibility machinery already covers D-08 |
| Reactive instant-clear-on-success (D-07) | Browser/Client (`CommandBar.tsx`, `useVoiceCommand.ts` → `store/agentStatus.ts`) | — | Only the component that just received a live `/agent` reply knows "this succeeded right now" faster than the next poll tick |
| Persistent unavailable indicator (`AgentStatusBanner.tsx`) | Browser/Client | — | Presentational only; already fully specified by `06-UI-SPEC.md` |

## Standard Stack

### Core

No new libraries. Every technology below is already installed and pinned per `CLAUDE.md`; this phase only extends existing modules.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `anthropic` | 0.117.* (pinned, `pyproject.toml`) | Source of `APIError`/`ValidationError` exception types `call_claude()` already catches | Already the exact exception hierarchy this phase's breaker logic branches on — no new import beyond what `agent/service.py` already has |
| `fastapi` | 0.139.* | `/health` route extension | No new route needed — `main.py`'s existing `@app.get("/health")` handler gets one new response field |
| `@tanstack/react-query` | 5.101.2 (pinned, `package.json`) | `useHealth()` polling hook | `refetchInterval` + default `refetchIntervalInBackground: false` + default `refetchOnWindowFocus: true` — [VERIFIED: installed source, `frontend/node_modules/@tanstack/query-core/src/focusManager.ts` + `queryObserver.ts`] gives D-08's pause/resume-on-visibility behavior with zero custom code |
| `zustand` | 5.0.14 | `store/agentStatus.ts` (new sibling store) | Matches the existing one-store-per-concern convention (`store/theme.ts`, `store/view.ts`) already used for small persisted/transient UI flags |
| `lucide-react` | 1.24.0 | `BotOff` icon | [VERIFIED: `frontend/node_modules/lucide-react/dist/esm/icons/bot-off.mjs` exists in the installed package] — `06-UI-SPEC.md`'s icon choice is confirmed installed, no version bump |

### Supporting

None — this phase adds zero new dependencies to either `pyproject.toml` or `package.json`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `useQuery({ refetchInterval })` for `useHealth()` | A hand-rolled `visibilitychange`/`focus` listener mirroring `useVoiceCommand.ts`'s effect (lines 243–267) | The hand-rolled version is more code, duplicates behavior TanStack Query's `FocusManager` already provides (verified below), and `useHealth.ts` is a data-fetch hook, not a stateful-session hook — it belongs next to `useReadings.ts`/`useStats.ts`, not `useVoiceCommand.ts`. Only reach for the manual pattern if a future need arises for behavior TanStack Query's focus manager doesn't cover (none identified here). |
| Two independent signals OR'd together (`agentStatus.down \|\| health.agentReachable === false`, per `ARCHITECTURE.md`'s original sketch) | One store field written by both the reactive success/failure handler and the poll's `onSuccess`, last-write-wins | The OR design can latch `true` forever in one tab if the reactive flag is set by a failed command and nothing ever un-sets it except another personally-issued success — a returning-to-true `/health` poll result should be able to clear it too. See Pitfall "OR-of-two-stores can latch stale `unavailable=true`" below. |

**Installation:**
```bash
# Nothing to install — every package used by this phase is already
# present in backend/pyproject.toml and frontend/package.json.
```

**Version verification:**
```bash
# Confirmed by reading installed sources directly (higher confidence than
# `pip show`/`npm view` alone, since these are behavioral claims, not just
# version-string claims):
grep -n "APIError\|ValidationError" backend/app/agent/service.py   # existing exception types, unchanged
sed -n '1,90p' frontend/node_modules/@tanstack/query-core/src/focusManager.ts
sed -n '380,412p' frontend/node_modules/@tanstack/query-core/src/queryObserver.ts
ls frontend/node_modules/lucide-react/dist/esm/icons/ | grep bot-off
```
No package versions change. `anthropic==0.117.*`, `fastapi==0.139.*`, `@tanstack/react-query@5.101.2`, `zustand@5.0.14`, `lucide-react@^1.24.0` all already meet or exceed every floor `CLAUDE.md` documents.

## Package Legitimacy Audit

**Not applicable this phase.** Zero new packages are installed in either `backend/pyproject.toml` or `frontend/package.json` — every technology used (anthropic SDK, FastAPI, TanStack Query, zustand, lucide-react) is already installed and already in production use elsewhere in this codebase. The slopcheck/registry-verification gate is skipped per its own "Required whenever this phase installs external packages" condition, which does not apply here.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Browser (React SPA) ───────────────────────────┐
│                                                                             │
│  Dashboard mount                                                           │
│    │                                                                       │
│    ├──► useHealth() ─────────► GET /health (poll, ~60s, TanStack Query    │
│    │        │                   refetchInterval; pauses hidden, refetches  │
│    │        │                   on focus — see Pattern 3)                  │
│    │        └──► store/agentStatus.ts.syncFromHealth(reachable)           │
│    │                                                                       │
│    ├──► CommandBar.onSuccess(reply) ──┐                                   │
│    ├──► useVoiceCommand.handleSuccess(reply) ─┤                           │
│    │                                   └──► store/agentStatus.ts          │
│    │                                          .reportOutcome(reply.kind)   │
│    │                                          (D-07 instant clear/set)     │
│    │                                                                       │
│    └──► AgentStatusBanner reads store/agentStatus.ts.unavailable          │
│           └──► renders persistent card OR null (06-UI-SPEC.md, locked)    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
                          │ GET /health (ungated, no rate limit)
                          │ POST /agent (Bearer-gated, 20/min limiter)
┌────────────────────────▼──────────────── FastAPI (single process) ────────┐
│                                                                             │
│  GET /health  ──────────────────────────► agent_configured (existing)     │
│                                            agent_reachable (NEW, reads     │
│                                            module cache, zero I/O)         │
│                                                                             │
│  POST /agent ──► interpret() ──► _get_client() is None? ──► kind=         │
│                        │                                    "unavailable" │
│                        │                                                  │
│                        └──► call_claude() ──► _breaker_open()? ──► skip   │
│                                    │            network, kind="unavailable"│
│                                    │                                      │
│                                    ├──► client.messages.parse()           │
│                                    │       │                              │
│                                    │       ├─ except APIError:            │
│                                    │       │    _record_outcome(False)    │
│                                    │       │    ──► kind="unavailable"    │
│                                    │       │                              │
│                                    │       ├─ except ValidationError:     │
│                                    │       │    (breaker untouched)       │
│                                    │       │    ──► kind="unclear"        │
│                                    │       │      (existing path,         │
│                                    │       │       unchanged)             │
│                                    │       │                              │
│                                    │       └─ success:                    │
│                                    │            _record_outcome(True)     │
│                                    │            ──► normal reply kinds    │
│                                    │                                      │
│  _last_outcome / _last_outcome_at  (module-level globals, agent/service.py,│
│  same lazy-singleton convention as the existing `_client` cache)          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (delta only — matches `06-UI-SPEC.md` + `ARCHITECTURE.md`, confirmed against the real tree)

```
backend/app/
├── main.py                 # EXTENDED — /health adds agent_reachable
├── agent/
│   ├── schemas.py           # EXTENDED — AgentReply.kind adds "unavailable"
│   ├── service.py            # EXTENDED — circuit breaker state + guard order
│   └── copy.py                 # UNCHANGED — UNAVAILABLE_MESSAGE reused verbatim

frontend/src/
├── store/
│   └── agentStatus.ts        # NEW — sibling store (theme.ts/view.ts convention)
├── hooks/
│   └── useHealth.ts           # NEW — TanStack Query hook (useReadings.ts convention)
├── api/
│   ├── client.ts               # EXTENDED — getHealth() wrapper (getReadings pattern)
│   └── types.ts                 # EXTENDED — AgentReply.kind adds "unavailable";
│                                #   new HealthStatus type
├── components/
│   ├── AgentStatusBanner.tsx    # NEW — fully specified in 06-UI-SPEC.md
│   ├── CommandBar.tsx            # EXTENDED — onSuccess switch adds a 5th case
│   └── ...
├── hooks/
│   └── useVoiceCommand.ts        # EXTENDED — handleSuccess switch adds a 5th case
└── App.tsx                        # EXTENDED — mount <AgentStatusBanner /> in
                                    #   Dashboard() only, per 06-UI-SPEC.md's exact JSX
```

### Pattern 1: Split `call_claude()`'s except clause so `interpret()` can distinguish "unreachable" from "genuinely unclear"

**What:** Today, `backend/app/agent/service.py::call_claude()` has one `except (APIError, ValidationError): return None` branch (lines 114–119), and `interpret()` maps ANY `None` from `call_claude()` to `kind="unclear"`. This must become two branches with different consequences, because they mean different things:

- `APIError` (network failure, timeout, the project's real known $0-credit `billing_error` 400/402) — this IS a reachability signal. Record `_record_outcome(False)`, and this call's reply must be `kind="unavailable"`.
- `ValidationError` (the SDK's structured-output parse failed against the pinned schema — Claude responded, but the response didn't fit `AgentOutput`) — this is NOT a reachability signal. The service is up; something about this one call's model output was malformed. The breaker must stay untouched, and this call's reply stays `kind="unclear"` — exactly the existing behavior, unchanged.
- `stop_reason in ("refusal", "max_tokens")` — same category as `ValidationError`: the network round-trip succeeded (record `_record_outcome(True)`), the model just didn't produce a usable command. Stays `kind="unclear"`.

**When to use:** Any time a single "the operation failed" catch site needs to feed two different downstream decisions (a liveness signal AND a user-facing reply kind) that don't always agree.

**Why this matters here specifically:** Collapsing `ValidationError` into the same bucket as `APIError` would mean a single schema-drift hiccup (e.g., an enum-capitalization edge case the model's own docstring already flags as a known risk class) trips the SAME 60-second "assistant unavailable" cooldown as a real outage — needlessly hiding the manual-controls-still-work message behind a scarier banner for an event that had nothing to do with reachability, and (per D-02) makes the NEXT ~60 seconds of real `/agent` traffic skip the network entirely even though Claude was never actually down.

**Recommended shape** (illustrative — exact naming is Claude's discretion per `06-CONTEXT.md`):
```python
# backend/app/agent/service.py

_last_outcome: bool | None = None          # None = untested this boot
_last_outcome_at: datetime | None = None
_BREAKER_COOLDOWN = timedelta(seconds=60)  # D-03: ~60s, matches frontend poll


def _record_outcome(ok: bool) -> None:
    global _last_outcome, _last_outcome_at
    _last_outcome, _last_outcome_at = ok, datetime.now()


def agent_reachable() -> bool | None:
    """Cached, cost-free — read by /health. Raw last outcome, NOT gated by
    whether cooldown has since elapsed (06-CONTEXT.md's Mechanical note:
    staying 'unavailable' until the next real call re-probes is correct,
    not a bug)."""
    return _last_outcome


def _breaker_open() -> bool:
    return (
        _last_outcome is False
        and _last_outcome_at is not None
        and datetime.now() - _last_outcome_at < _BREAKER_COOLDOWN
    )


def call_claude(text: str, context: ClarifyContext | None) -> AgentOutput | None:
    client = _get_client()
    if client is None:
        return None  # interpret()'s existing "no key" branch handles this
    if _breaker_open():
        return None  # D-02: skip the network call; interpret() must still
                      # know this None came from the breaker, not a schema
                      # failure — see interpret() below
    try:
        msg = client.messages.parse(
            model=_MODEL, max_tokens=_MAX_TOKENS, temperature=0,
            system=SYSTEM_PROMPT, messages=build_messages(text, context),
            output_format=AgentOutput,
        )
    except APIError:
        _record_outcome(False)
        logger.warning("Claude call failed for /agent; degrading to unavailable reply")
        return None
    except ValidationError:
        # Schema drift, NOT a reachability signal — breaker untouched.
        logger.warning("Claude response failed schema validation; degrading to unclear reply")
        return None
    if msg.stop_reason in ("refusal", "max_tokens"):
        _record_outcome(True)  # the network call itself succeeded
        return None
    _record_outcome(True)
    return msg.parsed_output
```

**The remaining gap this leaves for `interpret()`:** after this split, `call_claude()` still returns a bare `AgentOutput | None` — `interpret()` cannot tell, from the return value alone, whether a `None` came from `_breaker_open()`/`APIError` (→ `kind="unavailable"`) or from `ValidationError`/refusal (→ `kind="unclear"`). Reading `agent_reachable()` (`_last_outcome`) *after* the call is NOT reliable on its own: if the LAST call (some earlier request) had failed and left `_last_outcome = False`, but THIS call's `None` came from a fresh `ValidationError` (which never touches `_last_outcome`), checking `_last_outcome` after the fact would incorrectly report "unavailable" for what was actually just a schema hiccup. **Recommendation:** have `call_claude()` return a small tuple/`NamedTuple` — `(output: AgentOutput | None, reachable: bool)` — where `reachable` reflects only what happened on *this specific call* (`False` only for the `_breaker_open()` and `APIError` branches; `True` for `ValidationError`, refusal, `max_tokens`, and success). `interpret()` then does:
```python
output, reachable = call_claude(text, context)
if not reachable:
    return AgentReply(kind="unavailable", message=UNAVAILABLE_MESSAGE)
if output is None:
    return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
```
This is a genuinely new return-shape decision this phase introduces — not present in any of the four milestone research files — and should be treated as a first-class design point in the plan, not an incidental detail.

### Pattern 2: `interpret()`'s existing guard order gets exactly one new branch, at the top

`interpret()`'s current first check (`if _get_client() is None: return AgentReply(kind="unclear", message=UNAVAILABLE_MESSAGE)`) changes its `kind` to `"unavailable"` — this is the "no key at all" case D-06 requires to collapse into the same message/kind as the "configured but failing" case. No new network call, no new logic — the ONLY change here is the literal string `"unclear"` → `"unavailable"` on this one line, plus the tuple-unpacking change described in Pattern 1 for the `call_claude()` result below it. This is deliberately the smallest possible diff to `interpret()`'s guard-order structure, which its own module docstring calls "load-bearing" — do not restructure anything else in this function.

### Pattern 3: `useHealth()` as a plain TanStack Query hook — not a `visibilitychange` listener

**What:** [VERIFIED: read directly from the installed `@tanstack/query-core` source, not docs] TanStack Query's `FocusManager` (`frontend/node_modules/@tanstack/query-core/src/focusManager.ts`) already attaches a `visibilitychange` listener and exposes `isFocused()` as `document.visibilityState !== 'hidden'`. `queryObserver.ts`'s `#updateRefetchInterval` (lines 404–411) only actually executes a scheduled `refetchInterval` tick `if (refetchIntervalInBackground || focusManager.isFocused())` — the default for `refetchIntervalInBackground` is falsy, so **ticks are silently skipped while the tab is hidden** (the interval timer itself keeps running, but no fetch fires). Separately, the default `refetchOnWindowFocus: true` (this project's `QueryClient` in `main.tsx` uses zero `defaultOptions` overrides, so all library defaults apply) triggers an **immediate** refetch when `focusManager`'s listener fires with the tab newly visible, because the default `staleTime` is `0`. Together, these two defaults reproduce D-08's exact requirement — pause while hidden, resume (immediately) on return — with zero custom visibility-handling code.

**When to use:** Any periodic server-state poll in a React app already using TanStack Query. Reach for a manual `visibilitychange` listener only for state that ISN'T a query result (e.g., `useVoiceCommand.ts`'s recognizer session, which has to actively `abort()`/`start()` a stateful browser API object — a fundamentally different problem than "should I refetch").

**Recommended shape:**
```ts
// frontend/src/hooks/useHealth.ts — mirrors useReadings.ts/useStats.ts exactly
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 60_000, // D-05 ~60s; refetchIntervalInBackground defaults
                              // false, so this naturally pauses while hidden
    staleTime: 0,             // default, but explicit here: refetchOnWindowFocus
                               // (default true) needs staleTime 0 to fire on
                               // every foreground return, matching D-08
  });
}
```
```ts
// frontend/src/api/client.ts — new wrapper, same shape as getReadings/getStatsSummary
export function getHealth(): Promise<HealthStatus> {
  return getJson<HealthStatus>("/health");
}
```
Note `getJson()` already attaches `Authorization` when a token exists (harmless — `/health` ignores it, stays ungated) and already throws `ApiError(0, ...)` on network failure. `AgentStatusBanner` should treat `useHealth()`'s own `isError` as "unavailable" too (06-UI-SPEC.md's own "Fail-safe default" rule: a `/health` fetch failure itself should render the SAME banner, not a different error state).

### Pattern 4: One store, two writers, last-write-wins — not two stores OR'd together

**What:** `ARCHITECTURE.md`'s original sketch proposed `store/agentStatus.ts` (reactive, per-command) and `useHealth()`'s poll result as two independent signals, combined in the component: `down = agentStatus.down || health.agentReachable === false`. This has a latent bug: once a failed command sets `agentStatus.down = true` in one tab, nothing in that design ever sets it back to `false` except ANOTHER successful command from that same tab — a `/health` poll that later confirms recovery has no way to clear the reactive half of the OR, so the banner can never self-clear via polling alone, only via D-07's reactive path. Given `06-CONTEXT.md`'s Mechanical Note already establishes that recovery genuinely can lag until the next real command anyway, this isn't catastrophic, but it's an avoidable inconsistency: the `/health` poll IS reading the exact same backend fact (`_last_outcome`) that a reactive command success also reflects, just via a different transport. There's no reason for two disagreeing local copies of one backend fact.

**Recommended shape:** one field, two entry points, both funnel into the SAME store, last-write-wins (both are always reporting the freshest thing THEY personally observed — no timestamp reconciliation needed):
```ts
// frontend/src/store/agentStatus.ts
import { create } from "zustand";
import type { AgentReply } from "../api/types";

interface AgentStatusState {
  unavailable: boolean;
  reportOutcome: (kind: AgentReply["kind"]) => void; // D-07, called from
                                                       // CommandBar/useVoiceCommand
  syncFromHealth: (reachable: boolean | null, configured: boolean) => void; // D-05/D-08
}

export const useAgentStatus = create<AgentStatusState>((set) => ({
  unavailable: false,
  reportOutcome: (kind) => set({ unavailable: kind === "unavailable" }),
  syncFromHealth: (reachable, configured) =>
    set({ unavailable: !configured || reachable === false }),
}));
```
`AgentStatusBanner.tsx` then just reads `useAgentStatus((s) => s.unavailable)` — no OR logic in the component at all, matching `06-UI-SPEC.md`'s "renders `null` while reachable, the card while unavailable" contract directly.

### Anti-Patterns to Avoid

- **Reading `agent_reachable()` (`_last_outcome`) after `call_claude()` returns `None` to infer why:** stale-read bug described in Pattern 1 — a prior failure and a fresh `ValidationError` are indistinguishable this way. Thread the "was this call a reachability failure" fact out of `call_claude()` explicitly instead.
- **Hand-rolling a `visibilitychange`/`focus` listener for `useHealth()`:** duplicates `@tanstack/query-core`'s existing, already-installed, already-verified `FocusManager` behavior for no benefit — see Pattern 3.
- **Adding a `threading.Lock()` around `_last_outcome`/`_last_outcome_at`:** unnecessary — see Common Pitfalls below for the full thread-safety reasoning; this project already accepts an equivalent unlocked race on the existing `_client` singleton, and the deploy target is a single uvicorn process (no `--workers N`), so cross-thread interleaving is the only theoretical race, and its worst case is self-correcting and cosmetic.
- **Letting `/health`'s new field ever return a raw error string/type (e.g. `"billing_error"`) instead of a plain boolean:** `/health` is the one intentionally ungated route in this app (`main.py`'s own docstring: "the ONE ungated route" — actually `/auth` — but `/health` is also ungated). Any string that reveals *why* the agent is failing is new information disclosure on an unauthenticated endpoint, and directly contradicts D-06's "no copy branching between the two causes" rule at the wire-contract level, not just the UI level.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Pause polling while hidden, resume on foreground" | A `document.addEventListener("visibilitychange", ...)` + `window.addEventListener("focus", ...)` pair inside `useHealth.ts` | `useQuery({ refetchInterval: 60_000 })` and TanStack Query's default `FocusManager` + `refetchOnWindowFocus` | [VERIFIED: installed source] Already does exactly this; a hand-rolled version is redundant code solving an already-solved problem, and diverges from this codebase's own convention that `hooks/useReadings.ts`/`useStats.ts` (TanStack Query) own server-state fetching |
| Distinguishing "unreachable" from "schema drift" after the fact | Re-deriving intent from `agent_reachable()`'s stale global state inside `interpret()` | Return the reachability fact directly out of `call_claude()` at the exact call site that observed it (Pattern 1) | The information only exists at the moment of the exception; reconstructing it later from a shared mutable global is strictly worse and introduces the stale-read bug described above |
| Circuit-breaker cooldown clock | A background scheduler/cron/interval task that periodically "checks" and resets breaker state | The existing `datetime.now() - _last_outcome_at < _BREAKER_COOLDOWN` computed-on-read pattern (`ARCHITECTURE.md`'s own example, verified consistent with `_get_client()`'s lazy-singleton style) | No background task needed — the cooldown is just arithmetic evaluated at read time, exactly like the existing `_get_client()` lazy cache |

**Key insight:** every piece of "liveness plumbing" this phase needs already has a directly analogous, already-shipped pattern somewhere in this exact codebase (`_get_client()`'s lazy singleton, `useReadings.ts`'s TanStack Query hook, `store/theme.ts`'s sibling-store shape, `test_health.py`'s `monkeypatch.setattr` convention). The work here is disciplined pattern-matching against this specific repository, not new-pattern invention.

## Common Pitfalls

### Pitfall 1: Adding `"unavailable"` to `AgentReply.kind` silently breaks nothing at compile time — but breaks the UI at runtime if a case is missed

**What goes wrong:** `CommandBar.tsx`'s `onSuccess(reply)` switch (lines 120–148) and `useVoiceCommand.ts`'s `handleSuccess(reply, capturedSeq)` switch (lines 125–149) are both `switch (reply.kind) { case "applied": ... case "clarify": ... case "refuse": ... case "unclear": ... }` with **no `default` branch and no TypeScript exhaustiveness assertion** (no `default: assertNever(reply.kind)` pattern anywhere in this codebase). Both functions have a `void` return type. TypeScript will **not** raise a compile error if a 5th case (`"unavailable"`) is added to the `AgentReply.kind` union in `api/types.ts` but not handled in one of these two switches — the reply silently falls through and does nothing.

**Why it happens:** `switch` statements over a union only get exhaustiveness checking from TypeScript when the missing-case path is made to produce a type error (e.g., assigning to a `never`-typed variable in an unreachable default, or a function with a non-void return type where every branch must return). Neither switch here does this.

**How to avoid:** Add the 5th case to **both** switches in the same change — `agent-parity.test.ts` does NOT cover `AgentReply.kind` (confirmed by reading it in full; it only enumerates `ChartId`/`BPCategory`/store actions), so there is no existing guardrail test that would catch a missed case. Recommend either (a) writing a new focused test asserting both call sites handle `kind: "unavailable"` (e.g., a `CommandBar.test.tsx` case mirroring the existing "renders an unclear reply verbatim" test at line 175, and an equivalent in `useVoiceCommand.test.ts`), or (b) introducing a shared `assertNever` helper in both switches as defense-in-depth so a *future* 6th kind can't repeat this gap silently.

**What CommandBar's own case should do:** mirror the existing `"unclear"`/`"refuse"` cases exactly — `setMessage(reply.message)` (backend sends `UNAVAILABLE_MESSAGE`, reused verbatim per `06-CONTEXT.md`'s code_context note), `setStatus("error")`, `setClarifyContext(null)`. This is CommandBar's own transient status line — a **separate, third** string from `06-UI-SPEC.md`'s new persistent banner copy ("Assistant unavailable right now — the buttons below still work.") and from `OFFLINE_COPY` (the existing fixed copy for a `fetch()`-level failure reaching `/agent` at all, e.g. a 5xx or network drop, not this phase's concern). This project already deliberately maintains three independently-worded "can't reach it" strings for three different failure moments — do not collapse or rename any of them; `06-UI-SPEC.md`'s own Copywriting Contract section documents this precedent explicitly.

**Warning signs:** A manual test that simulates a keyless/failing backend and expects the CommandBar's spinner or "Working…" state to clear, but it hangs — because the switch fell through without calling `setStatus(...)`.

### Pitfall 2: Module-level circuit-breaker globals and FastAPI's threadpool — a real but low-severity race, do not over-engineer a fix

**What goes wrong:** Per `CLAUDE.md`, this project uses a sync SQLAlchemy engine, and "FastAPI runs sync endpoints in a threadpool" — meaning `POST /agent` requests (and thus `_record_outcome()` calls) CAN execute concurrently on different worker threads within the ONE uvicorn process (the deploy command in `CLAUDE.md`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, has no `--workers N` flag — confirmed single-process). `_record_outcome`'s `_last_outcome, _last_outcome_at = ok, datetime.now()` is a two-target tuple assignment; CPython's GIL makes each individual bytecode STORE atomic, but does not guarantee the whole statement is atomic against a context switch between the two stores.

**Why it happens:** This is the same category of benign race the codebase ALREADY accepts in `_get_client()`'s lazy singleton (`if _client is None: _client = Anthropic(...)` — two threads racing here can both construct a throwaway extra `Anthropic` instance, with the last write winning; the code's own docstring treats this as acceptable, not a bug).

**How to avoid:** Do NOT add a `threading.Lock()`. For a single-user personal app with realistically 1–2 concurrent requests ever, the worst case of this specific race is `_last_outcome`/`_last_outcome_at` briefly disagreeing by one request's worth — cosmetically, a slightly-off cooldown window that self-corrects on the very next real call, which is the exact same "self-correcting, low-traffic-acceptable" tradeoff `06-CONTEXT.md`'s D-04 already explicitly accepts for the single-failure-flips-the-breaker design. Introducing a lock here would be inconsistent with the project's own accepted-tradeoff precedent one function above it in the same file.

**Warning signs to explicitly rule out, not worry about:** if a future deploy config ever adds `--workers N>1` (multiple OS *processes*, not threads) or horizontal scaling, this in-memory module-global breaker DOES silently break (each process gets independent, disagreeing state, and a `/health` poll could land on a different process than the one that just recorded a failure). This is out of scope for this phase (current deploy is confirmed single-process) but worth one code comment noting the constraint, mirroring how `_get_client()`'s own docstring documents its own accepted tradeoff inline.

### Pitfall 3: `/health`'s extended response must stay a plain boolean/tri-state, never a differentiated reason string

**What goes wrong:** It's tempting, once `call_claude()` can distinguish `APIError` from `ValidationError` internally, to also expose *why* the agent is unreachable in `/health`'s JSON (e.g., `agent_status: "billing_error" | "network_error" | "ok"`) — useful for debugging, and `STACK.md`'s milestone-level research even proposed a similar `agent_status` enum shape as one option. **Do not do this in this phase.** D-06 explicitly locks "no copy branching between the two causes" at the *product* level, and `/health` is the one route in this app with no auth gate at all — any reason string it returns is legible to anyone who can reach the deployed URL, not just Chris/caregivers. Keep the wire shape to `agent_reachable: bool | None` only; LIVE-05 (v2, explicitly deferred per `REQUIREMENTS.md`) is where a differentiated signal belongs, and it will need its own security review when it lands.

**Warning signs:** A `/health` response body containing anything beyond `status`, `agent_configured`, `agent_reachable` — any new field should be treated as a locked-decision violation, not a debugging nicety, until LIVE-05 is explicitly scoped.

### Pitfall 4: cold-boot `agent_reachable: None` — decide the default explicitly, don't let it fall out of code accidentally

**What goes wrong:** On a fresh backend boot (Railway redeploy, or first request ever), `_last_outcome` is `None` — untested this boot, by design (the passive-only architecture in D-01 has no way to know reachability before a real command is attempted; this is an accepted, documented tradeoff, not a gap to close here). `06-STATE.md`'s own Blockers/Concerns section records that the REAL production state today is "every `/agent` call 400s" due to $0 credits — so on a fresh deploy, `agent_configured=True` (key present) but `agent_reachable=None` (untested) describes a service that IS actually broken, but the passive signal can't know that yet.

**Decision needed (Claude's discretion, not locked in `06-CONTEXT.md`):** should the frontend treat `agent_reachable === null` as "available" (optimistic — no banner until a real failure is observed) or "unavailable" (pessimistic — show the banner until a real success is observed)? **Recommendation: optimistic default** (`unavailable = !agent_configured || reachable === false`, i.e., `null` does NOT trigger the banner) — this matches the passive-only philosophy's own accepted tradeoff ("Chris asks for something once, we find out for real, we tell the truth from then on"), avoids a false-positive banner appearing on every fresh deploy even in the (eventual, funded) working state, and D-07's instant-clear-or-set behavior means the very first real command self-corrects the display within one round-trip either way. This is presented as a recommendation, not a locked decision — flag it explicitly for the planner/executor to confirm rather than silently encoding it.

**Warning signs:** A demo where the banner flickers on for a few seconds after every deploy even when the agent works, or (the opposite failure mode) where the banner never appears on a genuinely broken fresh deploy until someone happens to try a voice/text command.

### Pitfall 5: `main.py` needs a new import — trivial, but easy to typo/forget

**What goes wrong:** `backend/app/main.py` today imports `get_settings` from `app.config` but has **no import from `app.agent.service`** at all. The extended `/health` handler needs `from app.agent.service import agent_reachable` (or equivalent) added to `main.py`'s import block. This is a one-line, easy-to-verify change, but is exactly the kind of "obvious once you see it, easy to skip in an outline" edit worth calling out explicitly so the plan's task list includes it as its own diff line, not folded silently into "extend /health."

## Code Examples

### Backend test pattern for simulating a failing Claude call (no network, no SDK mocking beyond the client boundary)

This project's existing convention (`test_health.py`'s `monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(...))`, and `test_agent_route.py`'s `app.dependency_overrides[get_interpreter] = lambda: fake`) is direct monkeypatching of module-level names/dependency overrides — no `unittest.mock.patch` on the `anthropic` package, no `freezegun`/`time-machine` dependency (neither is installed; not needed). Recommended pattern for the circuit breaker specifically:

```python
# Source: pattern synthesized from backend/tests/test_health.py (monkeypatch on
# module globals) + backend/tests/test_agent_route.py (dependency-override
# style fake). No new test dependency required.
from datetime import datetime, timedelta
import app.agent.service as service


def test_apierror_flips_breaker_to_unavailable(monkeypatch):
    class _FakeClient:
        class messages:
            @staticmethod
            def parse(**kwargs):
                raise service.APIError("simulated failure")  # same exception
                # type call_claude() already catches — no new mock surface

    monkeypatch.setattr(service, "_get_client", lambda: _FakeClient())
    monkeypatch.setattr(service, "_last_outcome", None)
    monkeypatch.setattr(service, "_last_outcome_at", None)

    reply = service.interpret("show my pulse", None, None, None)

    assert reply.kind == "unavailable"
    assert service.agent_reachable() is False


def test_breaker_open_skips_network_call_within_cooldown(monkeypatch):
    calls = []

    class _FakeClient:
        class messages:
            @staticmethod
            def parse(**kwargs):
                calls.append(1)
                raise AssertionError("should not be called while breaker is open")

    monkeypatch.setattr(service, "_get_client", lambda: _FakeClient())
    monkeypatch.setattr(service, "_last_outcome", False)
    monkeypatch.setattr(service, "_last_outcome_at", datetime.now())  # fresh failure

    reply = service.interpret("show my pulse", None, None, None)

    assert reply.kind == "unavailable"
    assert calls == []  # D-02: network call was skipped entirely


def test_cooldown_expiry_lets_the_next_real_call_through(monkeypatch):
    monkeypatch.setattr(service, "_last_outcome", False)
    monkeypatch.setattr(
        service, "_last_outcome_at", datetime.now() - timedelta(seconds=90)
    )  # older than the ~60s cooldown
    assert service._breaker_open() is False
```

### Frontend test pattern for `useHealth()` (mirrors `useVoiceCommand.test.ts`'s "mock only the boundary" discipline)

```ts
// Source: pattern from frontend/src/hooks/useVoiceCommand.test.ts (vi.mock
// only the api/client boundary function; real QueryClientProvider, real
// zustand store, reset in beforeEach).
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, getHealth: vi.fn() };
});
const mockGetHealth = getHealth as unknown as Mock;

it("syncs agentStatus from a successful /health poll", async () => {
  mockGetHealth.mockResolvedValue({ status: "ok", agent_configured: true, agent_reachable: false });
  const { result } = renderHook(() => useHealth(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  // assert useAgentStatus.getState().unavailable reflects the synced value
  // via whatever effect wires useHealth()'s result into the store
});
```

### `AgentStatusBanner.tsx` component test convention (mirrors `CommandBar.test.tsx`)

`06-UI-SPEC.md` already fully specifies the markup — the test should follow `CommandBar.test.tsx`'s exact convention (`describe("AgentStatusBanner", ...)`, `it("renders nothing while reachable")`, `it("renders the persistent card with role=status when unavailable")`, `it("never shows a dismiss control (D-11)")`), reading state from a real `store/agentStatus.ts` (reset in `beforeEach`, same as `useFilters.setState(...)` in every other component test) rather than mocking the store.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact `AgentReply.kind` string value `"unavailable"` and the `/health` field name `agent_reachable` are proposals, not locked names | Architecture Patterns, Standard Stack | Low — `06-CONTEXT.md` explicitly leaves this naming to Claude's discretion during planning; any consistent alternative naming works equally well as long as it's applied uniformly across `schemas.py`, `types.ts`, and both frontend switches |
| A2 | The cold-boot `agent_reachable === null` → optimistic-default (no banner) recommendation in Pitfall 4 | Common Pitfalls | Medium — if the planner instead wants a pessimistic default (show banner until first real success), that's a legitimate, defensible alternative; this should be confirmed as an explicit planning decision, not silently defaulted either way |
| A3 | `ValidationError` (schema-drift) should NOT flip the circuit breaker, only `APIError` should | Architecture Patterns, Pattern 1 | Medium — this is my synthesis from reading `call_claude()`'s existing guard-order comments (which already treat these as a distinct risk category from network failure), not an explicit `06-CONTEXT.md` decision; if wrong, a rare schema-drift event would incorrectly trigger a 60s "unavailable" cooldown, a self-correcting but user-visible false positive |
| A4 | `call_claude()` should return `(output, reachable)` rather than continuing to return a bare `AgentOutput \| None` with `interpret()` re-deriving reachability some other way | Architecture Patterns, Pattern 1 | Low — this is an implementation-shape recommendation with a clearly-stated alternative (reading `_last_outcome` post-call) explicitly identified as inferior; any equivalent mechanism that avoids the stale-read bug is acceptable |

**If this table is empty:** N/A — see entries above. All four are implementation-shape recommendations synthesized from reading the existing codebase, explicitly flagged as Claude's discretion per `06-CONTEXT.md`'s own "Claude's Discretion" section (schema/naming decisions, breaker module location) rather than claims about external facts needing verification.

## Open Questions (RESOLVED)

1. **Should `ValidationError` inside `call_claude()` ever flip the breaker?**
   - What we know: The existing code treats `APIError` and `ValidationError` identically today (one combined except clause); `06-CONTEXT.md`'s D-01/D-04 discuss the breaker only in terms of "real /agent traffic outcomes" without specifying whether a schema-parse failure counts as a traffic outcome.
   - What's unclear: Whether the planner/user considers a schema-drift event a legitimate "the model/service isn't behaving reliably" signal worth surfacing as "unavailable," or purely a code-quality bug that should never affect the user-facing liveness state.
   - Recommendation: Treat it as NOT a breaker signal (Pattern 1's recommendation) — but confirm this explicitly during planning since it's a real behavioral fork, not a naming detail.
   - **RESOLVED:** Plan 06-01 Task 1 implements this — `ValidationError` does not touch `_last_outcome`, matching the recommendation.

2. **Cold-boot `null` default (optimistic vs. pessimistic) — see Assumptions A2.**
   - Recommendation: optimistic default, confirm explicitly during planning.
   - **RESOLVED:** Plan 06-02 Task 1's `syncFromHealth(null, true)` → `unavailable: false` implements the optimistic default.

3. **Does the plan need an exhaustiveness-check helper (`assertNever`) as defense-in-depth for the two frontend switches, or is a targeted regression test (Pitfall 1) sufficient?**
   - What we know: neither switch currently has one; adding one is a small, contained change that would also protect against any *future* 6th kind.
   - Recommendation: at minimum, add the regression test described in Pitfall 1; the `assertNever` helper is a nice-to-have, not required for this phase's success criteria.
   - **RESOLVED:** Plan 06-03 adds the regression tests for both switches without an `assertNever` helper, matching the recommendation (helper explicitly deemed not required).

## Environment Availability

No new external dependency, tool, or service is introduced by this phase. The Anthropic API (already the app's core external dependency) and FastAPI/uvicorn (already the deploy target) are unchanged — this phase only changes how EXISTING failures of that existing dependency are classified and surfaced, not what's being depended on. Skipping the full Environment Availability table per its own skip condition ("phase has no external dependencies (code/config-only changes)" — this phase is exactly that: a code-level reclassification of existing failure modes, no new runtime dependency).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 9.* (`backend/pyproject.toml`), `TestClient` (httpx-backed) via `conftest.py`'s `client` fixture |
| Backend config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` (`testpaths = ["tests"]`, `addopts = "-m 'not live'"`) |
| Frontend framework | Vitest 4.1.10 (`frontend/package.json`), `@testing-library/react` |
| Frontend config file | `frontend/vite.config.ts` (Vitest config colocated with Vite config — no separate `vitest.config.ts` file exists) |
| Quick run command (backend) | `cd backend && python -m pytest tests/test_health.py tests/test_agent_route.py -x` |
| Quick run command (frontend) | `cd frontend && npx vitest run src/hooks/useHealth.test.ts src/components/AgentStatusBanner.test.tsx src/components/CommandBar.test.tsx src/hooks/useVoiceCommand.test.ts` |
| Full suite command (backend) | `cd backend && python -m pytest` (live-marked tests excluded by default `addopts`) |
| Full suite command (frontend) | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-01 | `AgentReply.kind` distinguishes "unavailable" from "unclear" for both the no-key case and the `call_claude()` exception path | unit (backend) | `pytest backend/tests/test_agent_route.py -k unavailable -x` | ❌ Wave 0 — new test cases in existing `test_agent_route.py`, plus new circuit-breaker-specific tests in a new `test_agent_service.py` or extended `test_agent_fixtures.py`-adjacent file |
| LIVE-02 | `AgentStatusBanner` shows the calm, non-alarming, "manual controls still work"-paired copy, distinct from CommandBar's transient line | component (frontend) | `npx vitest run src/components/AgentStatusBanner.test.tsx` | ❌ Wave 0 — new file, new component |
| LIVE-03 | Dashboard checks liveness on page load before any command is issued | hook (frontend) | `npx vitest run src/hooks/useHealth.test.ts` | ❌ Wave 0 — new file, new hook |
| LIVE-04 | Liveness checks never share `/agent`'s rate limiter, never spend tokens | integration (backend) | `pytest backend/tests/test_health.py -k reachable -x` (extend existing file; assert `/health` has no `@limiter.limit` decorator and no auth dependency, mirroring `test_agent_route.py`'s existing `test_rate_limit_fires_on_21st_request` pattern but asserting the ABSENCE of rate limiting on `/health`) | ❌ Wave 0 — new test cases in existing `test_health.py` |

### Sampling Rate

- **Per task commit:** the relevant single test file (backend or frontend) from the Quick run commands above
- **Per wave merge:** full backend `pytest` + full frontend `vitest run`
- **Phase gate:** both full suites green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_agent_route.py` (or a new `backend/tests/test_agent_service.py`) — circuit-breaker unit tests: APIError flips breaker, ValidationError does not, breaker-open skips the network call, cooldown expiry re-opens the path (Code Examples above)
- [ ] `backend/tests/test_health.py` — extend for `agent_reachable` field presence, tri-state values, and a regression test asserting `/health` carries no rate-limit decorator
- [ ] `frontend/src/hooks/useHealth.test.ts` — new file (poll behavior, mirrors `useVoiceCommand.test.ts`'s "mock only `getHealth`" convention)
- [ ] `frontend/src/store/agentStatus.test.ts` — new file, or fold into the hook/component tests (reportOutcome + syncFromHealth last-write-wins behavior)
- [ ] `frontend/src/components/AgentStatusBanner.test.tsx` — new file (renders null/card, `role="status"`, no dismiss control per D-11)
- [ ] Extend `frontend/src/components/CommandBar.test.tsx` and `frontend/src/hooks/useVoiceCommand.test.ts` with a `kind: "unavailable"` case each (Pitfall 1's regression coverage)
- [ ] No new framework install needed — pytest and Vitest are both already fully configured and exercising this exact module set

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | `/health` is intentionally, pre-existingly ungated (deploy diagnostic) — this phase does not change its auth posture, only its response body |
| V3 Session Management | No | No session/token surface touched by this phase |
| V4 Access Control | Marginal — see Pitfall 3 | `/health` staying ungated is an accepted existing pattern; the NEW constraint this phase adds is that the extended response must not leak differentiated failure-cause information to an unauthenticated caller (Pitfall 3) |
| V5 Input Validation | No | This phase adds no new user-controllable input surface — `/health` remains a parameterless GET; `AgentReply.kind`'s new value is server-emitted, not client-supplied |
| V6 Cryptography | No | Not touched |
| V7 Error Handling and Logging | Yes | The existing `logger.warning(...)` calls in `call_claude()`'s except clauses already avoid logging the payload/key (per the module docstring); the split into two except branches must preserve this — neither new branch should log request text or any part of the API key |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via an ungated diagnostic endpoint | Information Disclosure | Keep `/health`'s new field a plain `bool \| None`, never a reason-string enum (Pitfall 3) — this is the one genuinely new security-relevant surface this phase touches |
| Denial-of-service via a liveness-check route sharing `/agent`'s cost/rate budget | Denial of Service | Already structurally prevented: `/health` carries no `@limiter.limit` decorator (slowapi only rate-limits routes that explicitly opt in via the decorator — confirmed by reading `routers/agent.py`'s own comment: "slowapi silently no-ops without both [the decorator AND the `request: Request` param]"); `/health`'s exemption is by construction (decorator omission), not a config flag to set or an allowlist to maintain |
| Log/telemetry leakage of Claude call failure details | Information Disclosure | Preserve the existing `logger.warning("...")` fixed-message convention (no interpolated exception text, no request payload) across both new except branches |

## Sources

### Primary (HIGH confidence — direct repository inspection this session)
- `backend/app/agent/service.py` — full read; existing `_get_client()` lazy singleton, `call_claude()` guard order, `interpret()` branch structure
- `backend/app/routers/agent.py` — full read; slowapi wiring, decorator-based rate-limit opt-in mechanism (confirms LIVE-04's exemption-by-omission)
- `backend/app/main.py` — full read; existing `/health` handler, CORS/auth wiring
- `backend/app/agent/copy.py` — full read; existing `UNAVAILABLE_MESSAGE`/`UNCLEAR_MESSAGE` fixed-copy convention
- `backend/app/agent/schemas.py` — full read; `AgentReply.kind` closed-Literal shape, Claude-facing vs. API-facing model split
- `backend/app/config.py` — full read; `@lru_cache get_settings()`, confirms settings are cached per-process
- `backend/tests/conftest.py`, `test_health.py`, `test_agent_route.py`, `test_agent_fixtures.py` — full reads; established `monkeypatch`/`app.dependency_overrides` test conventions
- `frontend/src/api/types.ts`, `api/client.ts` — full reads; `AgentReply` shape, `getJson`/`postJson` conventions, `authHeaders()` behavior on ungated routes
- `frontend/src/hooks/useVoiceCommand.ts`, `useAgent.ts`, `useReadings.ts`, `useStats.ts` — full reads; visibilitychange effect pattern (T-04-05), TanStack Query hook conventions
- `frontend/src/components/CommandBar.tsx` — full read; `onSuccess` switch, fixed-copy constants (`OFFLINE_COPY`, `RATE_LIMIT_COPY`)
- `frontend/src/store/theme.ts`, `store/filters.ts` — full reads; sibling-store convention, one-concern-per-store discipline
- `frontend/src/App.tsx` — full read; Dashboard/UploadView mount structure, auth-gated data-hook wiring
- `frontend/src/hooks/useVoiceCommand.test.ts`, `components/CommandBar.test.tsx`, `lib/agent-parity.test.ts` — full/partial reads; confirmed `agent-parity.test.ts` does NOT cover `AgentReply.kind` (only `ChartId`/`BPCategory`/store actions)
- `frontend/node_modules/@tanstack/query-core/src/focusManager.ts`, `queryObserver.ts` (installed package source, v5.101.2 per `package.json`) — read directly; confirmed `visibilitychange`-based `FocusManager`, `refetchIntervalInBackground` default-false skip behavior, `refetchOnWindowFocus` default-true immediate-refetch-on-focus behavior
- `frontend/node_modules/lucide-react/dist/esm/icons/bot-off.mjs` — confirmed present, matches `06-UI-SPEC.md`'s icon choice
- `.planning/phases/06-agent-availability-liveness-detection/06-CONTEXT.md`, `06-UI-SPEC.md` — full reads, this session
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json` — full reads, this session
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md` — full reads, this session (milestone-level; scoped the feature correctly, but did not resolve the code-shape questions this document answers)

### Secondary (MEDIUM confidence)
None required for this phase — every claim above was verifiable directly against this repository's own source or the installed package source, with no external/community-sourced claims needed (unlike the TTS/overlay phases, which depend on iOS Safari behavior not verifiable locally).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every version/behavior claim verified against the actually-installed source in `node_modules`/`pyproject.toml`, not training-data assumption
- Architecture: HIGH — every pattern above is grounded in a specific, cited line range of an actual file read this session, not inferred from the milestone-level research
- Pitfalls: HIGH — Pitfalls 1, 3, 5 are directly observable in the current source (missing exhaustiveness, ungated route, missing import); Pitfall 2 (threading) is a reasoned-from-documented-deploy-config claim (single uvicorn process, no `--workers`, confirmed via `CLAUDE.md`'s own start command); Pitfall 4 (cold-boot default) is an explicit open design recommendation, flagged as such, not a verified fact

**Research date:** 2026-08-20
**Valid until:** No expiry driver identified — this phase touches only this project's own already-shipped, already-pinned code and already-installed package versions (no external API surface changes expected). Re-verify only if `anthropic`, `fastapi`, or `@tanstack/react-query` are upgraded before this phase executes.
