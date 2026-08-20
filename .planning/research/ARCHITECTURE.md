# Architecture Research — v1.1 (Polish & Records)

**Domain:** Integration architecture for 4 features into an existing FastAPI + React (Zustand/TanStack Query) health dashboard
**Researched:** 2026-08-19
**Confidence:** HIGH (grounded directly in the existing codebase — every recommendation below cites the actual file/pattern it extends) / MEDIUM on iOS Safari SpeechSynthesis specifics (verified via current sources, but needs real-device testing like the project's existing Speech Recognition risk)

## Summary / Verdict

All four features are additive to the existing architecture — none require restructuring the FastAPI/Zustand/TanStack Query split. The two features with real design decisions are **multi-dataset overlay** (needs a new store, new endpoints, and a schema extension) and **agent-liveness** (needs a backend circuit-breaker, not a naive health-ping). Spoken replies and the site guide are small, mostly-frontend, low-risk additions once those two land.

**Recommended build order (dependency-driven, detailed in "Build Order" below):**
1. Agent-liveness detection (backend circuit breaker + `/health` extension + frontend banner)
2. Multi-dataset backend (Pydantic schemas + GET/POST routers for labs/incidents/procedures)
3. Multi-dataset frontend — manual-entry forms (parallel with 4)
4. Multi-dataset frontend — overlay store + fetch hooks + chart rendering (parallel with 3)
5. Multi-dataset voice/schema extension (backend `schemas.py`/`prompt.py`/`service.py` + frontend `AppliedFilters`/parity test)
6. Spoken replies (mostly independent, but reuses copy from 1 and 5)
7. Full site guide (independent, but best documents the finished UI last)

## System Overview — What's New

```
┌───────────────────────────────────────────────────────────────────────────┐
│ FastAPI (Bearer-gated except /health, /auth)                              │
│                                                                             │
│  /readings /stats/summary        /agent (circuit-breaker NEW)             │
│  /upload                         /health (EXTENDED: agent_reachable NEW)  │
│                                                                             │
│  NEW: /labs      GET (date range) + POST (create)                         │
│  NEW: /incidents GET (date range) + POST (create)                         │
│  NEW: /procedures GET (date range) + POST (create)                        │
│                                                                             │
│  agent/service.py: NEW module-level circuit breaker (_last_outcome,       │
│  cooldown) shared by /agent's real-time reply AND /health's cached read   │
│                                                                             │
│  agent/schemas.py: NEW DatasetToken Literal + DashboardCommand.overlays   │
│  agent/prompt.py:  NEW vocabulary for "hospital stays" / "labs" / etc.    │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────────────────────────────────────────────┐
│ React                                                                      │
│                                                                             │
│  store/filters.ts   UNCHANGED — stays the pure 4-chart command schema     │
│  store/view.ts       EXTENDED — View: "dashboard"|"upload"|"records"|"guide"│
│  NEW store/overlay.ts    — {labs, incidents, procedures} visibility set   │
│  NEW store/speech.ts     — mute toggle, localStorage-persisted (theme.ts  │
│                             pattern)                                      │
│  NEW store/agentStatus.ts — transient "down" flag from the last live      │
│                             /agent reply (reactive, faster than polling)  │
│                                                                             │
│  NEW hooks/useLabs.ts / useIncidents.ts / useProcedures.ts (useReadings   │
│      pattern) + useCreateLab/Incident/Procedure.ts (useAgent pattern)     │
│  NEW hooks/useHealth.ts — polls GET /health for agentConfigured/Reachable │
│                                                                             │
│  lib/agent.ts   EXTENDED — applyAgentFilters() reads f.overlays,          │
│                  composeConfirmation() grows an overlay clause            │
│  NEW lib/speech.ts — speak()/cancel(), mirrors lib/voice.ts's pure-       │
│      helper, feature-detection, fixed-copy conventions                   │
│  NEW lib/guideCommands.ts — client-side "help"/"guide" keyword shortcut, │
│      bypasses /agent entirely (works even when the agent is down)        │
│                                                                             │
│  NEW components/GuidePage.tsx, RecordEntryForm.tsx (or 3 forms)           │
│  NEW components/AgentStatusBanner.tsx                                     │
│  charts/BPTimeline.tsx, PulseTrend.tsx — EXTENDED with an overlayEvents   │
│      prop rendered as ReferenceDot/ReferenceLine event markers           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (new/changed only)

| Component | Responsibility | Notes |
|-----------|-----------------|-------|
| `backend/app/routers/labs.py`, `incidents.py`, `procedures.py` (NEW) | GET (date-range filtered) + POST (validated create) for each future table | Mirror `readings.py`'s thin-router-over-shared-dependency pattern; Bearer-gated at router-include level in `main.py`, same as every other router |
| `backend/app/agent/service.py` circuit breaker (NEW module state) | Tracks last real `/agent` call outcome; skips the network call during a cooldown window; feeds both `/agent`'s reply kind and `/health`'s cached field | Zero added Claude cost — reuses outcomes from real traffic, never self-pings Claude |
| `frontend/src/store/overlay.ts` (NEW) | Which of labs/incidents/procedures render as markers on the active time-series chart | Sibling to `store/filters.ts`, not a merge into it — keeps the VOICE-05/ACC-03 parity-tested surface separable |
| `frontend/src/store/agentStatus.ts` (NEW) | Reactive "assistant unavailable" flag set the instant a live reply comes back `kind: "down"` | Faster than waiting for the next `/health` poll; `/health` poll is the fallback for the "never issued a command yet" case |
| `frontend/src/lib/speech.ts` (NEW) | `speak(text)` / `cancelSpeech()` pure helpers | Mirrors `lib/voice.ts`: feature detection, no new confirmation text, fixed friendly copy only |
| `frontend/src/lib/guideCommands.ts` (NEW) | Client-side "help"/"guide" phrase match, short-circuits before `/agent` | Keeps the guide voice-reachable even when the (currently inert, $0-credit) agent is down |
| `charts/BPTimeline.tsx`, `PulseTrend.tsx` (EXTENDED) | Render incident/procedure/lab event markers as `ReferenceDot`/`ReferenceLine` on the existing numeric time x-axis | Only the two time-series charts; `bp_categories`/`am_pm_comparison` are not overlay targets (not time-series) |

## Recommended Project Structure (delta only)

```
backend/app/
├── routers/
│   ├── labs.py            # NEW — GET /labs, POST /labs
│   ├── incidents.py       # NEW — GET /incidents, POST /incidents
│   └── procedures.py      # NEW — GET /procedures, POST /procedures
├── schemas.py              # EXTENDED — LabResultOut/In, IncidentOut/In, ProcedureOut/In
├── deps.py                 # EXTENDED — small DateRangeFilters shared by the 3 new routers
├── agent/
│   ├── schemas.py           # EXTENDED — DatasetToken Literal, DashboardCommand.overlays,
│   │                        #   AppliedFilters.overlays (OverlayDelta), AgentReply.kind + "down"
│   ├── prompt.py             # EXTENDED — teach "labs"/"hospital stays"/"procedures" vocabulary
│   ├── service.py            # EXTENDED — circuit breaker (_last_outcome/_record_outcome/
│   │                        #   agent_reachable()), _apply_command maps cmd.overlays
│   └── copy.py                # EXTENDED — no new strings needed; UNAVAILABLE_MESSAGE now
│                              #   reachable via kind="down" instead of being mislabeled unclear
└── main.py                   # EXTENDED — /health returns agent_reachable; 3 new routers included
                              #   with the same dependencies=[Depends(verify_token)] pattern

frontend/src/
├── store/
│   ├── overlay.ts           # NEW
│   ├── speech.ts             # NEW (theme.ts pattern: localStorage + try/catch guards)
│   └── agentStatus.ts        # NEW
├── hooks/
│   ├── useLabs.ts / useIncidents.ts / useProcedures.ts   # NEW (useReadings.ts pattern)
│   ├── useCreateLab.ts / useCreateIncident.ts / useCreateProcedure.ts  # NEW (useAgent.ts pattern)
│   └── useHealth.ts          # NEW
├── lib/
│   ├── speech.ts             # NEW
│   ├── guideCommands.ts       # NEW
│   └── agent.ts               # EXTENDED — applyAgentFilters reads f.overlays;
│                              #   composeConfirmation() grows an overlay-summary clause
├── api/
│   └── types.ts               # EXTENDED — Lab/Incident/Procedure types, AppliedFilters.overlays,
│                              #   AgentReply.kind adds "down", HealthStatus type
└── components/
    ├── GuidePage.tsx           # NEW
    ├── RecordEntryForm.tsx (or LabEntryForm/IncidentEntryForm/ProcedureEntryForm)  # NEW
    └── AgentStatusBanner.tsx    # NEW
```

### Structure Rationale

- **One router file per resource, not one `records.py`.** The codebase already splits `readings.py`/`stats.py`/`upload.py`/`agent.py` one-per-file with matching one-per-file tests (`test_api_readings.py`, `test_api_stats.py`). Three small resources (`labs`, `incidents`, `procedures`) with different column shapes (`Date` vs `DateTime`) are clearer as three thin files than one router juggling three schemas.
- **`store/overlay.ts` as a sibling store, not a merge into `store/filters.ts`.** `store/filters.ts`'s docstring calls it "THE Phase 3 agent command schema," and `agent-parity.test.ts` asserts the store's *entire* mutating-action surface equals a fixed list (`STORE_ACTIONS`). Adding overlay toggles as new `useFilters` actions would force-edit that guardrail test for a conceptually different kind of state (dataset visibility, not chart/date/category selection). A sibling store — exactly how `store/view.ts` already sits next to `store/filters.ts` — keeps the diff additive and the parity test's existing assertions untouched; it gets its *own* new parity assertions instead.
- **`lib/speech.ts` and `lib/guideCommands.ts` as pure, DOM-light helpers.** Mirrors `lib/voice.ts`'s explicit design note: "pure, backend-free primitives; hooks/components consume them unchanged." Keeping these as testable pure functions (not buried in a component) matches the codebase's existing unit-test-first convention for every non-trivial browser-API interaction (`voice.test.ts`, `agent.test.ts`, `dates.test.ts`).

## Architectural Patterns

### Pattern 1: Circuit breaker for agent liveness (NOT a live health-ping)

**What:** Track the outcome of *real* `/agent` calls in a module-level cache (`app/agent/service.py`), and skip the actual Claude network call for a cooldown window after a failure. `/health` reads this cache; it never calls Claude itself.

**When to use:** Any time "is the third-party dependency up?" needs to be cheap to check from the frontend. A naive approach — have `/health` make its own test call to Claude — would (a) cost tokens/latency on every poll, (b) need its own rate limiting, and (c) still be wrong the instant *between* polls. The circuit breaker is populated for free by traffic that was going to happen anyway.

**Trade-offs:** The breaker can be briefly stale (up to the cooldown window) after Claude recovers — acceptable for a personal single-user dashboard where "recovers instantly after being down" isn't a hard requirement, and the next real command re-probes automatically once the cooldown elapses.

**Example (extends `agent/service.py`):**
```python
_last_outcome: bool | None = None          # None = untested this boot
_last_outcome_at: datetime | None = None
_BREAKER_COOLDOWN = timedelta(seconds=60)

def _record_outcome(ok: bool) -> None:
    global _last_outcome, _last_outcome_at
    _last_outcome, _last_outcome_at = ok, datetime.now()

def agent_reachable() -> bool | None:
    """Cached, cost-free — read by /health and by interpret()'s kind selection."""
    return _last_outcome

def _breaker_open() -> bool:
    return (
        _last_outcome is False
        and _last_outcome_at is not None
        and datetime.now() - _last_outcome_at < _BREAKER_COOLDOWN
    )
```
`call_claude()` checks `_breaker_open()` before `client.messages.parse(...)` and records `True`/`False` in its existing `try`/`except (APIError, ValidationError)` branches. `interpret()` distinguishes `kind="down"` (breaker open, or this call's exception branch just set `agent_reachable() is False`) from `kind="unclear"` (refusal/max_tokens/genuine `Unintelligible` — the model *did* respond).

### Pattern 2: Reuse the confirmation string for speech — don't author new copy

**What:** `lib/agent.ts::composeConfirmation()` already produces the exact sentence rendered in the CommandBar's `aria-live` region ("Showing blood pressure, last 30 days, mornings"). Spoken replies call `speechSynthesis.speak(new SpeechSynthesisUtterance(msg))` on that *same* string, at the *same* call sites (`CommandBar.onApplied`, `useVoiceCommand.handleSuccess`) — not a second, independently-maintained "spoken" template.

**When to use:** Any accessibility feature that adds an audio channel alongside an existing visual one. Two independently-authored strings for the same event *will* drift.

**Trade-offs:** `composeConfirmation()` must grow one clause for overlays before overlay commands sound complete — a soft dependency, not a blocker (ship speech first covering existing filters; extend both the visual and spoken text together when overlays land, since it's one function).

**Example:**
```ts
// lib/agent.ts — single new export, reused by both text and voice call sites
export function speakConfirmation(msg: string): void {
  if (!useSpeech.getState().enabled) return;
  speak(msg); // lib/speech.ts — cancels any in-flight utterance first
}
```

### Pattern 3: Client-side keyword shortcut for guide navigation — bypass `/agent` entirely

**What:** "Help" / "show me the guide" / "how do I..." are matched with a small regex in `lib/guideCommands.ts`, checked in `useVoiceCommand.handleResult` and `CommandBar.onSubmit` *before* the text is POSTed to `/agent`. On a match, call `useView.getState().go("guide")` directly — no network round-trip.

**When to use:** Navigation intents that must work *even when the paid-API-gated agent is down* (v1.1 explicitly ships without activating billing) and that don't need Claude's disambiguation (a fixed, short phrase list is unambiguous).

**Trade-offs:** Duplicates the wake-word-adjacent parsing style already established by `extractCommand()` in `lib/voice.ts`, rather than adding a sixth `AgentOutput.result` variant that would round-trip through a currently-inert ($0-credit) model. This is the one place in the milestone where *not* extending the Claude schema is the right call — extending it would make guide navigation depend on a service the milestone explicitly keeps unfunded.

### Pattern 4: Overlay markers, not a merged multi-axis chart

**What:** Labs/incidents/procedures render as point-in-time `ReferenceDot`/`ReferenceLine` markers on top of whichever time-series chart (`bp_timeline` or `pulse_trend`) is currently the hero — never as their own plotted y-values on the BP/pulse axis, and BP and pulse are never merged onto one chart.

**When to use:** This is the architecture this milestone's own example confirms: "hospital-stay markers plotted directly on the BP/pulse timeline" — markers *on* the existing timeline, not a new fused chart. `activeChart` (single-select hero) is unchanged; a new *separate* multi-select (`store/overlay.ts`) controls marker visibility.

**Trade-offs:** Labs have heterogeneous units (A1C vs. cholesterol vs. whatever future test) — plotting `result` as a y-value alongside BP mmHg is meaningless. Rendering labs as marker events (with the value in the tooltip/label, not on the axis) sidesteps a dual-axis redesign entirely, and keeps `BPTimeline.tsx`'s existing `D-05 fixed clinical y-domain [40,220]` decision untouched. Merging BP+pulse onto one chart (dual y-axis) was considered and rejected: it contradicts the existing fixed-domain decision, and Recharts dual-axis is a known readability/accessibility anti-pattern the project doesn't need to take on for a "visual only" overlay (cross-metric correlation is explicitly out of scope).

**Example (BPTimeline.tsx addition):**
```tsx
{overlayEvents?.filter(e => e.type === "incident").map(e => (
  <ReferenceLine key={e.id} x={e.ts} stroke="var(--cat-stage2)" strokeDasharray="4 4"
    label={{ value: "Hospital stay", position: "insideTopLeft", fontSize: 14 }} />
))}
```

### Pattern 5: Partial-update "delta" objects all the way down (extend the existing convention, don't invent a new one)

**What:** `DashboardCommand`'s existing rule — "unmentioned fields stay `None` → carry over" — extends naturally to overlays as a nested optional-per-field object, not a pair of add/remove token lists:
```python
class OverlayDelta(BaseModel):
    labs: bool | None = None
    incidents: bool | None = None
    procedures: bool | None = None

# on DashboardCommand:
overlays: OverlayDelta | None = None
```
**When to use:** Any time a new voice-mutable dimension is added to the command schema — match the existing per-field-optional convention rather than inventing show/hide list semantics that would be the only list-shaped field in the schema.
**Trade-offs:** None significant — this is the smallest diff that stays structured-outputs-safe (no `min_length`, no numeric bounds, same lowercase-token normalization already applied recursively by `AgentOutput._lower_tokens`).

## Data Flow

### Multi-dataset overlay (new)

```
Dashboard mount
  → useReadings(resolved) / useStats(resolved)          [unchanged]
  → useLabs(resolved) / useIncidents(resolved) / useProcedures(resolved)  [NEW — same
    date-range params only; am_pm/bp_category don't apply to these tables]
  → all fetched EAGERLY alongside readings/stats (single wiring point in App.tsx,
    "Data is wired ONCE here" — matches the existing docstring's own rule); row
    counts are a single patient's manual entries, negligible fetch cost
        ↓
Chart region (ChartDeck → active hero, e.g. BPTimeline)
  → reads useOverlay().visible.{labs,incidents,procedures}
  → filters the fetched incidents/procedures/labs to markers, passes as
    overlayEvents prop
  → BPTimeline/PulseTrend render ReferenceDot/ReferenceLine, positioned on the
    SAME numeric time x-axis already used for readings (toTimePoints helper)
```

### Manual entry (new)

```
Caregiver opens Records view (store/view.ts "records")
  → RecordEntryForm submits via useCreateLab/Incident/Procedure (useMutation,
    postJson pattern from api/client.ts — Bearer header attached automatically)
  → on success: queryClient.invalidateQueries(["labs"|"incidents"|"procedures"])
    → useLabs/useIncidents/useProcedures refetch → overlay markers update
      immediately without a page reload
```

### Voice/text overlay command (new)

```
"dashboard, show hospital stays on the chart"
  → wake-word gate (lib/voice.ts, unchanged) strips to "show hospital stays..."
  → NOT matched by guideCommands.ts (Pattern 3) → falls through to /agent as today
  → Claude (when funded) parses → DashboardCommand{overlays: {incidents: true}}
  → service.py _apply_command maps cmd.overlays → AppliedFilters.overlays
  → frontend applyAgentFilters() reads f.overlays → useOverlay.getState().setVisible(...)
  → composeConfirmation() appends an overlay clause → same string shown AND spoken
    (Pattern 2)
```

### Agent liveness (new)

```
App mount → useHealth() polls GET /health (cheap, no DB/Claude call) → banner
  shows "unavailable" if agentReachable === false

Any real /agent call fails → service.py circuit breaker records False AND this
  reply's kind = "down" → CommandBar/useVoiceCommand's onSuccess sets
  store/agentStatus.ts's flag immediately (no wait for the next /health poll)
  → AgentStatusBanner reacts on the SAME tick the failure is known

Next /agent call within the cooldown window → circuit breaker skips the network
  call entirely (Pattern 1) → instant "down" reply, no 15s timeout wait, no
  wasted Claude request
```

## Scaling Considerations

Single-user personal dashboard — scaling to "many users" is explicitly out of scope for this whole project. The only real constraint at any scale here is UX latency, not throughput:

| Concern | Now (single user, dozens of records/type) | If usage grows (hundreds of records/type) |
|---------|---------------------------------------------|---------------------------------------------|
| Eager-fetching labs/incidents/procedures on every dashboard mount | Fine — 3 cheap extra GETs, same pattern as readings/stats | Switch `useLabs`/etc. to `enabled: visible.labs` (TanStack Query lazy-fetch) so overlay data only loads once a type is toggled on |
| Overlay marker rendering density on a long date range | Fine — a handful of incidents/procedures per year | If dozens of markers cluster in one view, consider Recharts marker clustering/grouping rather than one `ReferenceLine` per event |
| `/health` polling frequency | 60s interval, negligible cost (in-memory dict read) | No change needed — this never touches the DB or Claude |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Live-pinging Claude from `/health`

**What people do:** Make `/health` issue a real (even minimal) `messages.parse()` call to "verify" the agent is reachable.
**Why it's wrong:** Costs tokens on every poll, adds latency to what should be a near-instant liveness check, and needs its own rate limiting to avoid becoming a second cost/DoS surface next to `/agent`'s existing 20/minute limiter.
**Instead:** Pattern 1 — cache the outcome of real `/agent` traffic; `/health` only reads the cache.

### Anti-Pattern 2: Folding overlay toggles into `store/filters.ts`

**What people do:** Add `labsVisible`/`incidentsVisible`/`proceduresVisible` fields directly onto the existing filter store because "it's all filter-ish state."
**Why it's wrong:** `store/filters.ts` is explicitly documented as *the* Phase 3 agent command schema, and `agent-parity.test.ts` asserts its entire action surface against a fixed list — every unrelated addition forces edits to a test whose entire purpose is catching *unintended* drift, defeating its value as a guardrail.
**Instead:** A sibling store (Pattern in Project Structure), exactly how `store/view.ts` already coexists with `store/filters.ts`.

### Anti-Pattern 3: Routing guide navigation through the (inert) Claude agent

**What people do:** Add `open_guide` as a new `AgentOutput.result` variant so "help" is "handled the same way as everything else."
**Why it's wrong:** The milestone explicitly does not activate the paid API — every command that requires a live model call is unverifiable in production right now (same caveat the codebase already carries for the whole `/agent` endpoint). Making the guide depend on it means the one feature most likely to be needed *during an agent outage* ("how do I use this without the assistant working?") is the one feature that breaks during that exact outage.
**Instead:** Pattern 3 — a client-side keyword shortcut, unconditionally available.

### Anti-Pattern 4: Plotting lab `result` values on the BP/pulse y-axis

**What people do:** Add a `Line` or `Scatter` series for lab results directly onto `BPTimeline`'s existing `[40, 220]` y-domain.
**Why it's wrong:** Lab units are heterogeneous and unrelated to mmHg; a value of "6.2" (A1C) or "180" (cholesterol) plotted on a blood-pressure axis is either invisible (out of domain) or misleading (coincidentally in-domain but meaningless there).
**Instead:** Pattern 4 — labs render as event markers (timestamp + label/value in the marker's tooltip), never as a plotted line sharing the reading axis.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Web SpeechSynthesis API (browser-native, NEW) | `window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))`, feature-detected like `lib/voice.ts` already does for `SpeechRecognition` | **iOS Safari specifics (verified 2026-08):** `speak()` must be called from within a user-gesture-connected handler on iOS — WebKit silently drops the utterance otherwise ([weboutloud.io](https://weboutloud.io/bulletin/speech_synthesis_in_safari/), [talkrapp.com](https://talkrapp.com/speechSynthesis.html)). Since the confirmation is spoken from an *async* `/agent` response handler (a promise callback, not the raw tap), this needs real-device verification — flag exactly like the existing "#1 device-test risk" for Speech Recognition in `STACK.md`. `getVoices()` is unreliable on Safari (returns nothing/late) — do not build voice-selection UI, accept the system default and set `utterance.lang` explicitly. Hold the `SpeechSynthesisUtterance` in a ref/variable for the duration of speech — Safari can garbage-collect it early and silently drop `onend`/`onerror` callbacks. |
| Claude API (existing, unchanged transport) | No new integration — only the *interpretation* of failures changes (Pattern 1) | No new endpoints, no new SDK calls beyond what `agent/service.py` already makes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `store/overlay.ts` ↔ chart components | Direct zustand hook read (`useOverlay((s) => s.visible)`) | Same pattern as `store/filters.ts` ↔ `ChartDeck`/`FilterBar` today |
| `store/agentStatus.ts` ↔ `useHealth()` poll | Two independent sources of the SAME logical fact ("is the agent reachable") — reactive (per-reply) and polled (per-mount/interval) | Reconcile by OR-ing them in `AgentStatusBanner` (`down = agentStatus.down || health.agentReachable === false`); do not try to make one authoritative over the other, they cover different timing gaps |
| `agent/schemas.py` (backend) ↔ `api/types.ts` (frontend) | Compile-time-adjacent, enforced at test-time by `agent-parity.test.ts` reading `schemas.py` off disk | Any new Claude-facing token (`DatasetToken`) MUST be added to this test's enumerated unions in the SAME change — this is the existing VOICE-05/ACC-03 guardrail, not a new mechanism |
| `lib/guideCommands.ts` ↔ `/agent` | Short-circuit BEFORE the network call, not a filter on the reply | Guide phrases never reach the backend at all — zero coupling to agent-liveness state |

## Build Order — Dependency Reasoning

1. **Agent-liveness (backend circuit breaker + `/health` + frontend banner).** Zero dependency on the other three features; smallest fully-testable slice (extends the existing `test_health.py`/`test_agent_route.py` scaffolding directly). Ship first because spoken replies (step 6) want to *speak* the "unavailable" copy, and the guide (step 7) should document the banner once it exists.
2. **Multi-dataset backend** (`labs.py`/`incidents.py`/`procedures.py` routers + schemas). Pure backend, no frontend dependency, mirrors `readings.py` exactly — lowest-risk slice of the biggest feature.
3. **Multi-dataset frontend — manual-entry forms.** Depends only on (2)'s POST endpoints. Independent of overlay rendering (3 and 4 can run in parallel).
4. **Multi-dataset frontend — overlay store + fetch hooks + chart markers.** Depends only on (2)'s GET endpoints; renders correctly against empty tables ("0 events") even before (3) exists.
5. **Multi-dataset voice/schema extension.** Depends on (4)'s `store/overlay.ts` existing — the parity test needs real store actions to assert against, and `service.py`'s `_apply_command` needs `AppliedFilters.overlays` to have somewhere to write. Ship click/tap overlay toggles (step 4) as the functional MVP; treat live-model accuracy for overlay voice commands as unverifiable-in-production, same existing caveat the whole agent already carries.
6. **Spoken replies.** Functionally independent of everything except reusing `composeConfirmation()` (already exists) — but sequence after (1) and (5) so the spoken copy covers "unavailable" and overlay confirmations without touching the same call sites twice.
7. **Full site guide.** No hard technical dependency on anything above (static content + `store/view.ts` extension + Pattern 3's client-side shortcut) — sequenced last purely so its content can document the finished overlay toggles, mute button, and status banner rather than needing a follow-up content edit.

## Sources

- Direct codebase inspection (HIGH confidence — all file paths cited above were read in full): `backend/app/models.py`, `backend/app/agent/schemas.py`, `backend/app/agent/service.py`, `backend/app/agent/prompt.py`, `backend/app/agent/copy.py`, `backend/app/routers/agent.py`, `backend/app/routers/readings.py`, `backend/app/routers/stats.py`, `backend/app/deps.py`, `backend/app/schemas.py`, `backend/app/main.py`, `backend/tests/test_health.py`, `frontend/src/store/filters.ts`, `frontend/src/store/view.ts`, `frontend/src/store/theme.ts`, `frontend/src/lib/agent.ts`, `frontend/src/lib/voice.ts`, `frontend/src/hooks/useVoiceCommand.ts`, `frontend/src/hooks/useAgent.ts`, `frontend/src/hooks/useReadings.ts`, `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/components/CommandBar.tsx`, `frontend/src/components/FilterBar.tsx`, `frontend/src/components/ChartDeck.tsx`, `frontend/src/components/charts/BPTimeline.tsx`, `frontend/src/components/UploadPage.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/agent-parity.test.ts`, `.planning/PROJECT.md`.
- Web SpeechSynthesis Safari/iOS behavior — [The State of Speech Synthesis in Safari (weboutloud.io)](https://weboutloud.io/bulletin/speech_synthesis_in_safari/), [Lessons Learned Using the javascript speechSynthesis API (talkrapp.com)](https://talkrapp.com/speechSynthesis.html), [MDN SpeechSynthesis.cancel()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/cancel) — MEDIUM confidence (community-sourced quirks, consistent across multiple independent sources, but not Apple's own documentation; flagged for real-device verification exactly like the project's existing Speech Recognition risk).

---
*Architecture research for: Health Visualizer v1.1 (Polish & Records) — spoken replies, multi-dataset overlay, site guide, agent-liveness*
*Researched: 2026-08-19*
