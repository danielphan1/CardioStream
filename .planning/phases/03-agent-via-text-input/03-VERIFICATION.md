---
phase: 03-agent-via-text-input
verified: 2026-07-20T19:45:00Z
status: human_needed
score: 5/5 must-haves verified (code + deterministic tests); live behavioral eval pending
overrides_applied: 0
human_verification:
  - test: "Run the live fixture suite against real Claude: `cd backend && ANTHROPIC_API_KEY=<key> .venv/bin/python -m pytest -m live tests/test_agent_fixtures.py -v`"
    expected: "≥30 of 35 utterances (charts, presets, AM/PM combos, categories, symbolic dates, 4 garbled transcripts, 4 medical refusals, data questions, clarify follow-up, gibberish, relative-adjustment rejection) return the expected kind/filter fields — proves real Claude interpretation accuracy behind the validated pipeline (SC1, SC4, SC5)"
    why_human: "Requires a real ANTHROPIC_API_KEY and a paid external API call; grep/deterministic tests can only prove the pipeline is wired, not that the model classifies natural language correctly. Suite is @pytest.mark.live + skipif-no-key, default-excluded — intentionally deferred per plan 03-03."
  - test: "End-to-end UI: start backend with a real key + `npm run dev`, type 'show my blood pressure for the last 30 days, mornings only' into the command bar and press Enter"
    expected: "Chart switches to BP timeline, date preset becomes last 30 days, AM/PM filter becomes mornings, the affected FilterBar groups pulse, and the bar shows 'Showing blood pressure, last 30 days, mornings' in the aria-live region (SC1, SC2)"
    why_human: "Full browser round-trip with a live Claude call and visual chart/filter state — not observable via static analysis or keyless tests."
  - test: "In the running UI, type a medical-interpretation request ('is my blood pressure dangerous?') and an ambiguous phrase ('show me that one')"
    expected: "Medical request returns the fixed care-team refusal copy (no diagnosis/alarm) while still switching to the BP chart; ambiguous phrase returns a short clarification question — neither produces a raw error or 500 (SC3, SC5, VOICE-09)"
    why_human: "Depends on real Claude classifying the utterance as refuse_medical / clarify; the server-side handling of each variant is code-verified, but the classification itself needs the live model."
---

# Phase 3: Agent via Text Input — Verification Report

**Phase Goal:** Natural-language commands typed into the dashboard reliably control it — the full Claude pipeline works before voice adds complexity. (Claude-powered `/agent` endpoint with validated JSON commands, driven by the text input box — the text→agent→dashboard loop.)
**Verified:** 2026-07-20T19:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All five roadmap Success Criteria are verified at the code + deterministic-test level: the pipeline, schema, resolver, route, and CommandBar surface exist, are substantive, are wired end-to-end, and real data (DB anchors, store state) flows through them. The full backend suite (181 passed / 7 skipped / 35 live-deselected) and frontend suite (66 passed) are green, and the production build (`tsc -b` + `vite build`) is green. What remains is behavioral confirmation of real Claude interpretation, which requires a live ANTHROPIC_API_KEY — routed to human verification below (not a gap; intentionally deferred per plan 03-03).

### Observable Truths

| # | Truth (roadmap SC) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Typing a NL command switches charts and applies filters via `/agent` | ✓ VERIFIED (pipeline); live round-trip → human | Full wiring present: `postAgent`→`useAgent`→`CommandBar.onApplied`→`applyAgentFilters(useFilters.getState())`→store, DB anchors queried in `agent.py`, `interpret()` maps `DashboardCommand`→`AppliedFilters`. Route deterministically tested with fake interpreter (applied reply echoes activeChart/datePreset/amPm). Real-Claude interpretation accuracy → human item. |
| 2 | Every applied command produces a large-text confirmation | ✓ VERIFIED | `composeConfirmation` (agent.ts) is deterministic from post-apply store state; canonical `bp_timeline+30d+AM` → `"Showing blood pressure, last 30 days, mornings"` asserted in `agent.test.ts`; rendered in `aria-live="polite"` `<p>` at `text-[18px]` (CommandBar.tsx:193-205). |
| 3 | Unrecognized/ambiguous input → clear non-technical message, never silent/raw/500 | ✓ VERIFIED | Triple never-500 backstop (`call_claude`→None, `interpret` broad except, route broad except); raising-interpreter route test → 200 unclear; keyless `interpret(...)` returns friendly `UNAVAILABLE_MESSAGE` (spot-checked). Frontend maps 429/network to fixed copy, never `error.message` (CommandBar.onError). |
| 4 | Claude output Pydantic-validated, closed enums, symbolic dates resolved server-side; raw output never executed (fixture suite ~30 utterances incl. garbled) | ✓ VERIFIED (schema/resolver + suite exists); live eval → human | `AgentOutput` is a closed constraint-free Literal union (`grep ge=/le=/discriminator` → 0); recursive lowercase normalizer; `resolve_date_range` never reads the wall clock (source-hygiene verified: `date.today`/`datetime.now` absent) and anchors to DB min/max; parity `n_day_range(L,30)=(2025-05-15,2025-06-13)` confirmed. 35-entry fixture suite exists, live-marked, collects 35 under `-m live`, 0 in default run. Live behavioral pass → human item. |
| 5 | Agent refuses medical advice; Anthropic key backend-only | ✓ VERIFIED (handling + key custody); live classification → human | `MedicalRefusal`→`kind="refuse"` + fixed `medical_refusal()` template (spot-checked, no model prose). SEC-02: key read only via `get_settings().anthropic_api_key`; `grep -rin anthropic frontend/src` → 0; no key in any response model or log line. Real Claude classifying medical utterances → human item. |

**Score:** 5/5 truths verified at code/deterministic level; 3 carry a live-behavioral component routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `backend/app/agent/schemas.py` | Closed union + API models + token maps | ✓ VERIFIED | 226 lines; two model families; `BP_TOKEN_TO_LABEL`/`AMPM_TOKEN_TO_LABEL`; constraint-free (grep 0). Imported by service, resolver, route. |
| `backend/app/agent/service.py` | interpret() guard-rail pipeline | ✓ VERIFIED | `interpret`/`call_claude`/`_get_client` present; guard order (APIError/ValidationError→stop_reason→parsed_output); `temperature=0`, model `claude-haiku-4-5`; never-500 backstop. Wired to route via `get_interpreter`. |
| `backend/app/agent/resolver.py` | Symbolic date resolver (API-05) | ✓ VERIFIED | `resolve_date_range`+`n_day_range`; wall-clock-free; parity confirmed. Called by service. |
| `backend/app/routers/agent.py` | Rate-limited authed POST /agent | ✓ VERIFIED | `@router.post` above `@limiter.limit("20/minute")`; `request: Request` present; DB anchors queried; route-level never-500. |
| `backend/app/main.py` | CORS POST, limiter, router include, verify_token | ✓ VERIFIED | `allow_methods=["GET","POST"]`, `Content-Type` header, `app.state.limiter`, `RateLimitExceeded` handler, `agent.router` behind `verify_token`. |
| `backend/app/agent/copy.py` | Fixed safety copy (VOICE-09) | ✓ VERIFIED | UNCLEAR/UNAVAILABLE/MEDICAL_REFUSAL_* /DATA_QUESTION templates + CHART_PHRASES; `medical_refusal()` used by service. |
| `frontend/src/lib/agent.ts` | applyAgentFilters + composeConfirmation + useAgentPulse | ✓ VERIFIED | Store mutation via `useFilters.getState()`; deterministic echo; pulse signal. Consumed by CommandBar + FilterBar. |
| `frontend/src/api/client.ts` | postJson/postAgent | ✓ VERIFIED | Three-branch ApiError discipline; `postAgent("/agent")`. |
| `frontend/src/hooks/useAgent.ts` | useMutation over postAgent | ✓ VERIFIED | TanStack v5 mutation. |
| `frontend/src/components/CommandBar.tsx` | Text input surface + state machine | ✓ VERIFIED | 208 lines; idle/working/confirmed/clarify/error; aria-live; ≥48px Send + Enter; no dangerouslySetInnerHTML. |
| `frontend/src/App.tsx` | CommandBar mounted | ✓ VERIFIED | `<CommandBar latestReading={latestReading} />` rendered between Header and `<main>`. |
| `frontend/src/components/FilterBar.tsx` | D-08 pulse | ✓ VERIFIED | `useAgentPulse` subscription, `motion-safe:animate-pulse` + `ring-2` fallback, `setTimeout` self-clear. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `routers/agent.py` | `agent/service.py` | `get_interpreter` dependency | ✓ WIRED | `get_interpreter()` returns `interpret`; injected via `Depends`. |
| `agent/service.py` | `agent/resolver.py` | `resolve_date_range` on `date_range` | ✓ WIRED | Called in `_apply_command`; `InvalidRange`→unclear. |
| `main.py` | `routers/agent.py` | `include_router` + `verify_token` + limiter | ✓ WIRED | Router included behind `verify_token`; `limiter` shared to `app.state`. |
| `lib/agent.ts` | `store/filters.ts` | `useFilters.getState()` outside React tree | ✓ WIRED | Reset-first then present-value deltas (D-13 carry-over). |
| `client.ts` | `/agent` | `postAgent` fetch POST | ✓ WIRED | `postJson<AgentRequest,AgentReply>("/agent", body)`. |
| `CommandBar.tsx` | `lib/agent.ts` | `applyAgentFilters` + `composeConfirmation` | ✓ WIRED | Both called in `onApplied`. |
| `FilterBar.tsx` | `lib/agent.ts` | `useAgentPulse` subscription | ✓ WIRED | seq-keyed effect. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| CommandBar confirmation | `message` | `composeConfirmation(useFilters.getState(), latestReading)` after `applyAgentFilters` | Yes — post-apply store state | ✓ FLOWING |
| /agent date resolution | `earliest`/`latest` | `db.scalar(select(func.max/min(Reading.datetime_)))` in route | Yes — real DB anchors (not hardcoded/today) | ✓ FLOWING |
| FilterBar pulse | `pulsing` | `useAgentPulse` marked by `applyAgentFilters` | Yes — touched-field set per apply | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Keyless interpret never raises, friendly reply | `interpret('show my blood pressure...', ...)` | kind=unclear, UNAVAILABLE_MESSAGE | ✓ PASS |
| Resolver parity + wall-clock-free | `n_day_range(2025-06-13,30)` / source scan | (2025-05-15, 2025-06-13); no date.today/now | ✓ PASS |
| Medical refusal fixed template | `medical_refusal('bp_timeline')` | care-team redirect copy, no model prose | ✓ PASS |
| Backend suite keyless | `pytest -q` (no key) | 181 passed, 7 skipped, 35 deselected | ✓ PASS |
| Live suite gating | `pytest -m live --collect-only` | 35 collected; 0 in default run | ✓ PASS |
| Frontend suite | `vitest run` | 66 passed | ✓ PASS |
| Production build | `npm run build` (`tsc -b`+`vite build`) | green | ✓ PASS |
| Real Claude interpretation accuracy | live fixture suite / UI | not run (no key) | ? SKIP → human |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared for this phase. The phase's own verification vehicle is the pytest suites (run above) and the live fixture suite (routed to human). N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| API-04 | 03-01, 03-03 | `/agent` returns Pydantic-validated JSON command; raw output never executed | ✓ SATISFIED | Closed `AgentOutput` union, service re-maps to `AgentReply`; only `Clarification.question` passes through as escaped text. |
| API-05 | 03-01, 03-03 | Symbolic date ranges resolved server-side in local time | ✓ SATISFIED | `resolver.py` wall-clock-free, DB-anchored; parity confirmed. |
| VOICE-06 | 03-02, 03-04 | Large-text confirmation of what changed | ✓ SATISFIED | `composeConfirmation` + aria-live 18px region; canonical string asserted. |
| VOICE-07 | 03-03, 03-04 | Clear non-technical error/clarification, never silent | ✓ SATISFIED | Never-500 backstops; fixed 429/offline/unclear copy. |
| VOICE-08 | 03-02, 03-04 | Text input drives the same `/agent` endpoint voice will use | ✓ SATISFIED | `postAgent`/`useAgent`/CommandBar path; Phase 4 reuses unchanged. |
| VOICE-09 | 03-01, 03-03 | Agent refuses medical advice/diagnosis/alarm | ✓ SATISFIED (server handling); live classification → human | Fixed `medical_refusal()` templates; `MedicalRefusal`→refuse mapping. |
| SEC-02 | 03-01, 03-02, 03-03 | Anthropic key backend-only; all Claude calls via backend | ✓ SATISFIED | Key via `get_settings()` only; frontend grep 0; keyless boot. |

No orphaned requirements — all 7 phase IDs are claimed by plans and code-verified. (SEC-01 full auth enforcement and DEPL are explicitly Phase 5 per ROADMAP; `verify_token` is an accepted interim stub this phase.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| backend/app/agent/resolver.py | ~114-124 | `last_n_days` no upper clamp → `OverflowError` for pathological huge `n` | ℹ️ Info | Caught by never-500 backstop → generic unclear instead of honest "all". Review WR-01; edge case, no crash/500. |
| backend/app/agent/service.py | ~188-198 | Clarify question >500 chars → ValidationError downgrades to unclear; stored unstripped | ℹ️ Info | Degrades to unclear, never 500. Review WR-02; edge case. |
| backend/app/agent/resolver.py | ~137-146 | MonthRange explicit end can emit future `custom_to` | ℹ️ Info | Honesty gap only; no crash. Review WR-03; edge case. |

No debt markers (`TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`) found in phase files. The three items above are the code review's non-blocking warnings — resolver clamping / clarify-length edge cases — none of which break the phase goal, and all degrade to friendly replies rather than errors. The one deferred build-type issue (D1) was RESOLVED (commit 5a45802); `npm run build` is green.

### Human Verification Required

See frontmatter `human_verification` — three items, all requiring a live ANTHROPIC_API_KEY:

1. **Live fixture suite** (`pytest -m live tests/test_agent_fixtures.py`) — proves real Claude interpretation accuracy across 35 utterances incl. garbled transcripts, medical refusals, gibberish (SC1, SC4, SC5). Intentionally deferred per plan 03-03; suite exists and is wired.
2. **End-to-end UI command** — type the ROADMAP canonical command in the browser; confirm chart/filter/pulse/confirmation all update (SC1, SC2).
3. **Medical + ambiguous UI utterances** — confirm refusal copy + clarification behavior with real Claude (SC3, SC5, VOICE-09).

### Gaps Summary

No gaps. Every artifact exists, is substantive, is wired, and passes real data through; both deterministic test suites and the production build are green; all 7 requirement IDs are code-verified. The phase pipeline achieves the goal in code. The only outstanding verification is the live-model behavioral confirmation (real Claude round-trip), which is inherently un-automatable without a paid key and was deliberately deferred to the phase gate — surfaced here as human verification, not a gap, per the plan's live-marker discipline.

---

_Verified: 2026-07-20T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
