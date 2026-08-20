---
phase: 06-agent-availability-liveness-detection
verified: 2026-08-20T20:00:00Z
status: human_needed
score: 4/4 roadmap success criteria verified (14/14 plan-level must-have truths verified)
overrides_applied: 0
human_verification:
  - test: "Load the dashboard with the backend's API key unset (or force `_last_outcome=False` on the backend, e.g. by monkeypatching or triggering a real APIError) and observe the AgentStatusBanner"
    expected: "Banner appears with the BotOff icon, regular-weight 18px body text, a single ~200ms fade-in — no pulsing/blinking, no red or `--cat-*` clinical color anywhere. Reads as calm/non-alarming, not a warning/siren."
    why_human: "\"Calm, non-alarming\" is a subjective visual/motion judgment. 06-UI-SPEC.md locks the markup/tokens and DOM tests confirm the markup and text render correctly, but a DOM assertion cannot verify visual weight, color perception, or that the fade-in reads as calm rather than jarring. This is the one Manual-Only Verification row documented in 06-VALIDATION.md, and 06-02-SUMMARY.md explicitly records it as \"not performed in this autonomous execution wave... deferred to the phase's end-of-phase human verification pass.\""
---

# Phase 6: Agent Availability (Liveness Detection) Verification Report

**Phase Goal:** Chris and caregivers always know — before speaking — whether the voice assistant will actually respond, replacing today's silent mislabeling of real outages as "didn't catch that."
**Verified:** 2026-08-20T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When the backend can't reach Claude (missing key, or every call failing), the UI shows a calm "assistant temporarily unavailable" message distinct from "didn't catch that," always paired with "manual controls still work." | ✓ VERIFIED | Backend: `interpret()` in `backend/app/agent/service.py:220-227` routes no-key and `not reachable` (breaker-open/`APIError`) to `AgentReply(kind="unavailable", message=UNAVAILABLE_MESSAGE)`. `UNAVAILABLE_MESSAGE` ("The assistant isn't connected right now. The buttons below still work — use them to change the view.") is a distinct string from `UNCLEAR_MESSAGE` ("Sorry, I didn't catch that...") in `backend/app/agent/copy.py:20-30`. Frontend: `AgentStatusBanner.tsx` renders `AGENT_UNAVAILABLE_BANNER_COPY` ("Assistant unavailable right now — the buttons below still work.") and `CommandBar.tsx`/`useVoiceCommand.ts` both handle `case "unavailable"` distinctly from `case "unclear"`. 29 backend + 54 frontend tests covering this pass (`pytest tests/test_agent_service.py tests/test_health.py tests/test_agent_route.py` → 29 passed; `vitest run` on the 5 relevant files → 54 passed). |
| 2 | The dashboard checks assistant availability automatically when the page loads, so Chris knows before speaking whether the assistant will respond. | ✓ VERIFIED (see anti-pattern WR-03/WR-04 caveat below) | `frontend/src/hooks/useHealth.ts` wraps `useQuery({queryKey: ["health"], queryFn: getHealth, refetchInterval: 60_000, staleTime: 0})` — TanStack Query fetches on mount by default, giving a page-load check with no custom code. `AgentStatusBanner` is mounted in `Dashboard()` (`frontend/src/App.tsx:119-120`), immediately after `<CommandBar>`, and consumes `useHealth()` directly. Confirmed NOT mounted in `UploadView()` (verified by reading lines 143-150). **Caveat:** an unresolved code-review warning (WR-03 in `06-REVIEW.md`) notes `api/client.ts`'s `fetch()` calls carry no timeout/`AbortSignal`, so a *hung* (not erroring) `/health` request would never flip `isError` and the banner would never appear — this is a real, currently-untested gap in the fail-safe design, though it does not contradict the literal success-criterion wording ("checks... when the page loads" — the check does fire on load; its robustness against a hang is the open question). See Anti-Patterns section. |
| 3 | Liveness checks never spend Claude API tokens and never share `/agent`'s rate limiter — checking status is free and never blocks real commands. | ✓ VERIFIED | `backend/app/main.py`'s `@app.get("/health")` carries no `@limiter.limit` decorator (confirmed by direct read of `app/main.py:42-66`); `backend/app/routers/agent.py:47` shows `@limiter.limit("20/minute")` applied only to `POST /agent`. `agent_reachable()` (`backend/app/agent/service.py:89-96`) is a pure read of a module global — no network call, no Claude invocation. `test_health_agent_reachable_never_rate_limited` fires 25 consecutive `/health` requests and asserts all return 200 (verified passing in the live test run). |
| 4 | A caregiver can tell "assistant is down" apart from "assistant didn't understand that" from the message text alone. | ✓ VERIFIED | `UNAVAILABLE_MESSAGE` vs `UNCLEAR_MESSAGE` (backend, `copy.py`) and `AGENT_UNAVAILABLE_BANNER_COPY` (frontend, `lib/copy.ts`) are three independently-worded, semantically distinct strings — none share text, none are generic. Confirmed by direct read; no shared substring beyond common words like "the"/"assistant". |

**Score:** 4/4 roadmap success criteria verified

### Supplementary: Plan-Level Must-Have Truths (14 total, all VERIFIED)

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 06-01 | No-key → `kind="unavailable"` | ✓ VERIFIED | `service.py` `interpret()` L220-223 |
| 06-01 | Breaker-open (post-APIError, within 60s) skips network call, replies `unavailable` | ✓ VERIFIED | `service.py` `call_claude()` L146-147, `_breaker_open()` L99-106; `test_agent_service.py` (9 tests) pass |
| 06-01 | `ValidationError` never flips breaker, stays `unclear` | ✓ VERIFIED | `service.py` `call_claude()` L163-167 (no `_record_outcome` call in this branch) |
| 06-01 | `/health.agent_reachable` is bool\|null, never rate-limited | ✓ VERIFIED | `main.py` L42-66; 25-request regression test passes |
| 06-02 | Page-load liveness check before any command | ✓ VERIFIED | `useHealth()` default `refetchOnMount` |
| 06-02 | No banner while reachable | ✓ VERIFIED | `showBanner = unavailable \|\| health.isError`; tested |
| 06-02 | Persistent card near CommandBar while unreachable | ✓ VERIFIED | Mounted directly after `<CommandBar>` in `Dashboard()` |
| 06-02 | Fresh boot (`agent_reachable=null`) shows no banner | ✓ VERIFIED | `syncFromHealth(null, true)` → `unavailable: false`; tested |
| 06-02 | No dismiss control, self-clears | ✓ VERIFIED | `grep -c "button" AgentStatusBanner.tsx` = 0; `showBanner` recomputes each render |
| 06-02 | Identical banner regardless of voice/text trigger path (D-10) | ✓ VERIFIED | `AgentStatusBanner` takes no props, reads only shared store |
| 06-03 | Typed `unavailable` reply shows message, never no-ops | ✓ VERIFIED | `CommandBar.tsx` L152-159 `case "unavailable"` |
| 06-03 | Voice `unavailable` reply shows message, returns to listening | ✓ VERIFIED | `useVoiceCommand.ts` L147-154 grouped case + uniform `setVoiceState("listening")` |
| 06-03 | Any successful reply instantly clears store flag (D-07) | ✓ VERIFIED | `reportOutcome(reply.kind)` called unconditionally before both switches |
| 06-03 | `unavailable` reply instantly sets store flag (D-07) | ✓ VERIFIED | Same call site; store's own `kind === "unavailable"` comparison |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/agent/service.py` | Circuit breaker state machine, tuple-returning `call_claude()`, split `interpret()` guard | ✓ VERIFIED | All functions present (`_record_outcome`, `agent_reachable`, `_breaker_open`), `call_claude()` returns `tuple[AgentOutput \| None, bool]`, `interpret()` routes correctly. No `threading.Lock` (0 matches). |
| `backend/app/agent/schemas.py` | `AgentReply.kind` extended with `"unavailable"` | ✓ VERIFIED | `Literal["applied", "clarify", "refuse", "unclear", "unavailable"]` at line 204 |
| `backend/app/main.py` | `/health` extended with `agent_reachable` | ✓ VERIFIED | Import + response key present; no `@limiter.limit` |
| `backend/tests/test_agent_service.py` | New circuit breaker test file | ✓ VERIFIED | 9 tests, all pass |
| `frontend/src/store/agentStatus.ts` | Shared `unavailable` store, `reportOutcome`/`syncFromHealth` | ✓ VERIFIED | Both functions present, matches spec behavior |
| `frontend/src/hooks/useHealth.ts` | TanStack Query poll, `refetchInterval` ~60s, no hand-rolled listener | ✓ VERIFIED | `refetchInterval: 60_000`; 0 `addEventListener` matches |
| `frontend/src/components/AgentStatusBanner.tsx` | The one new visible surface, UI-SPEC-exact markup | ✓ VERIFIED | `role="status"`, `aria-live="polite"`, `BotOff` icon, fixed copy, 0 `button` elements |
| `frontend/src/lib/copy.ts` | Single-sourced banner copy constant | ✓ VERIFIED | `AGENT_UNAVAILABLE_BANNER_COPY` exported, matches UI-SPEC locked string |
| `frontend/src/api/types.ts` | `AgentReply.kind` + `HealthStatus` type | ✓ VERIFIED | Both present |
| `frontend/src/components/CommandBar.tsx` | 5th switch case + `reportOutcome` call | ✓ VERIFIED | Present, correctly ordered before switch |
| `frontend/src/hooks/useVoiceCommand.ts` | 5th switch case + `reportOutcome` call | ✓ VERIFIED | Present, correctly ordered after stale-drop guard |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `backend/app/main.py health()` | `backend/app/agent/service.py agent_reachable()` | `from app.agent.service import agent_reachable` | ✓ WIRED | Import present, called in response dict |
| `backend/app/agent/service.py interpret()` | `backend/app/agent/service.py call_claude()` | tuple unpack | ✓ WIRED | `output, reachable = call_claude(text, context)` |
| `frontend/src/components/AgentStatusBanner.tsx` | `frontend/src/hooks/useHealth.ts` | `useHealth()` | ✓ WIRED | Called, `health.data`/`health.isError` consumed |
| `frontend/src/components/AgentStatusBanner.tsx` | `frontend/src/store/agentStatus.ts` | `useAgentStatus` | ✓ WIRED | Both `unavailable` read and `syncFromHealth` write present |
| `frontend/src/App.tsx` | `frontend/src/components/AgentStatusBanner.tsx` | `<AgentStatusBanner />` in `Dashboard()` | ✓ WIRED | Exactly one occurrence, correct location, absent from `UploadView()` |
| `frontend/src/components/CommandBar.tsx onSuccess()` | `frontend/src/store/agentStatus.ts` | `useAgentStatus.getState().reportOutcome(reply.kind)` | ✓ WIRED | Present, unconditional, before switch |
| `frontend/src/hooks/useVoiceCommand.ts handleSuccess()` | `frontend/src/store/agentStatus.ts` | `useAgentStatus.getState().reportOutcome(reply.kind)` | ✓ WIRED | Present, after stale-drop guard, before switch |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `AgentStatusBanner.tsx` | `health.data` / `health.isError` | `useHealth()` → `getHealth()` → `GET /health` → `agent_reachable()` (reads live module state, not a static value) | Yes | ✓ FLOWING |
| `AgentStatusBanner.tsx` | `unavailable` (store) | `useAgentStatus((s) => s.unavailable)` ← written by `reportOutcome`/`syncFromHealth`, both invoked from real call sites (not stubs) | Yes | ✓ FLOWING |
| `/health` response | `agent_reachable` field | `agent_reachable()` returns live `_last_outcome` global, mutated only by real `call_claude()` outcomes | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend full suite green | `cd backend && .venv/bin/python -m pytest -q` | `216 passed, 7 skipped, 35 deselected` | ✓ PASS |
| Backend liveness-specific suite green | `.venv/bin/python -m pytest tests/test_agent_service.py tests/test_health.py tests/test_agent_route.py -q` | `29 passed` | ✓ PASS |
| Frontend full suite green | `cd frontend && npx vitest run` | `17 files, 195 tests passed` | ✓ PASS |
| Frontend liveness-specific suite green | `npx vitest run src/store/agentStatus.test.ts src/hooks/useHealth.test.ts src/components/AgentStatusBanner.test.tsx src/components/CommandBar.test.tsx src/hooks/useVoiceCommand.test.ts` | `54 tests passed` | ✓ PASS |
| No new TypeScript errors | `npx tsc --noEmit` | no output (clean) | ✓ PASS |
| `/health` has no rate-limit decorator | `grep -n limiter backend/app/routers/agent.py` vs `backend/app/main.py` | limiter only on `agent.py` router, not `/health` | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and none are declared in the phase's PLAN/SUMMARY files. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| LIVE-01 | 06-01, 06-02, 06-03 | Backend distinguishes "assistant unavailable" from "didn't understand you" | ✓ SATISFIED | `AgentReply.kind` 5-value union on both backend and frontend, wired through `interpret()`, `CommandBar`, `useVoiceCommand` |
| LIVE-02 | 06-02 | Frontend shows calm, non-alarming "unavailable" state, paired with "manual controls still work" | ✓ SATISFIED (markup/copy); visual "calm" judgment → human_needed | `AgentStatusBanner.tsx` markup + copy verified; see Human Verification section for the subjective visual check |
| LIVE-03 | 06-02 | Dashboard checks liveness proactively on page load | ✓ SATISFIED | `useHealth()` default fetch-on-mount; see WR-03/WR-04 caveat |
| LIVE-04 | 06-01 | Liveness checks never share `/agent`'s rate limiter, never spend tokens | ✓ SATISFIED | No `@limiter.limit` on `/health`; `agent_reachable()` is a pure state read |

No orphaned requirements found — `.planning/REQUIREMENTS.md` maps exactly LIVE-01..04 to Phase 6, and all four are claimed across the three plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/api/client.ts` | 54, 82, 113 | No `AbortSignal`/timeout on any `fetch()` call (code-review finding WR-03, unresolved — confirmed still present by direct read of `06-REVIEW.md`'s HEAD-most commit `c5995b4` with no subsequent fix commit) | ⚠️ Warning | A hung (not erroring) `/health` request never resolves or rejects, so `useHealth()` stays `pending` forever and `isError` never becomes `true` — the `AgentStatusBanner`'s documented fail-safe ("a `/health` fetch failure itself renders the SAME banner") does not fire for this specific failure mode. Also affects `/agent`: a hung text-command request leaves `CommandBar` stuck in "Working…" indefinitely with no escape hatch for a user with limited hand mobility. Not covered by any existing test. |
| `frontend/src/hooks/useHealth.ts` | 12-19 | No `retry: false` override — inherits TanStack Query's default `retry: 3` with exponential backoff (WR-04, unresolved) | ⚠️ Warning | A real outage takes multiple round trips (~1s/2s/4s backoff) before `isError` flips, delaying the "assistant unavailable" signal by several seconds after the true outage begins. Masked in tests because every test `QueryClient` explicitly sets `retry: false`. |
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) | none found | Scanned all 12 phase-modified source files — zero matches. |

Neither WR-03 nor WR-04 blocks any of the four roadmap success criteria as literally worded (the page-load check does fire; the two failure modes affected are edge cases — a network hang, and detection latency — not the base "no key"/"breaker-open"/"APIError" paths this phase's tests exercise). They are included here because `06-REVIEW.md` (status: `issues_found`, dated after all three plans merged, with no subsequent remediation commit) flags them as directly undermining the robustness of "liveness detection" — the phase's own stated purpose — and they remain unresolved in the current codebase.

**This looks like it may be intentional deferral, but is not explicitly documented as such.** If accepted as out-of-scope for this phase, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "useHealth's fail-safe /health.isError fires for all network failure modes including hangs"
    reason: "Deferred — request-timeout infrastructure (AbortSignal on api/client.ts) is a cross-cutting concern beyond this phase's wire-contract scope; tracked via 06-REVIEW.md WR-03/WR-04"
    accepted_by: "{your name}"
    accepted_at: "{ISO timestamp}"
```

### Human Verification Required

### 1. Banner reads as calm/non-alarming (visual judgment)

**Test:** Load the dashboard with the backend's API key unset (or force `_last_outcome=False` on the backend), and observe the `AgentStatusBanner`.
**Expected:** Banner appears with the `BotOff` icon, regular-weight 18px body text, and a single ~200ms fade-in — no pulsing/blinking, no red or `--cat-*` clinical color anywhere.
**Why human:** This is the one Manual-Only Verification row documented in `06-VALIDATION.md` ("Calm, non-alarming is a subjective visual judgment... can't be asserted by a DOM test alone"). `06-02-SUMMARY.md` explicitly records this check as "not performed in this autonomous execution wave... deferred to the phase's end-of-phase human verification pass." DOM/markup/color-token correctness is verified by code inspection (Tailwind classes match UI-SPEC), but perceived "calmness" cannot be.

### Gaps Summary

No must-have truths failed. All 4 roadmap success criteria and all 14 plan-level must-have truths are verified against the actual codebase (not just SUMMARY claims): every claimed function, switch case, store field, component, and wire-contract field was independently read and confirmed present and correctly wired; 245 total tests (216 backend + 195 frontend, with overlap in the liveness-specific subset counted once) pass with zero regressions; `tsc --noEmit` is clean; zero debt markers found in any of the 12 phase-modified files.

The phase is functionally complete and matches its plans. Two unresolved code-review warnings (WR-03: no fetch timeout, so a hung `/health`/`/agent` request defeats the fail-safe; WR-04: default 3x-retry backoff delays outage detection by several seconds) were surfaced by `06-REVIEW.md` after all three plans merged and were not remediated by any subsequent commit — these are edge-case robustness gaps in LIVE-03's fail-safe design, not failures of the plan's literal must-haves, and are presented here for a human decision on whether to fix now, accept via override, or track for a later phase. One item requires human visual/subjective judgment (the "calm, non-alarming" appearance) that cannot be verified programmatically — this is what drives the `human_needed` status.

---

*Verified: 2026-08-20T20:00:00Z*
*Verifier: Claude (gsd-verifier)*
