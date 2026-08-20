---
phase: 06-agent-availability-liveness-detection
plan: 03
subsystem: ui
tags: [react, zustand, vitest, voice, command-bar, liveness]

# Dependency graph
requires:
  - phase: 06-agent-availability-liveness-detection (Plan 02)
    provides: "frontend/src/store/agentStatus.ts — the shared useAgentStatus zustand store with reportOutcome(kind)/syncFromHealth(reachable, configured), and the byte-for-byte AgentReply.kind extension to include \"unavailable\" in frontend/src/api/types.ts"
provides:
  - "CommandBar.tsx onSuccess switch's 5th case (\"unavailable\") — mirrors \"unclear\"'s text-preservation treatment"
  - "useVoiceCommand.ts handleSuccess switch's 5th case (\"unavailable\") — grouped with \"clarify\"/\"unclear\", returns to listening"
  - "Reactive D-07 wiring: both consumers call useAgentStatus.getState().reportOutcome(reply.kind) on every real /agent reply, instant-clearing/instant-setting the shared unavailable flag ahead of the next /health poll"
  - "Regression tests pinning both switch's exhaustiveness so a future 6th AgentReply.kind can't silently no-op again (closes RESEARCH Pitfall 1)"
affects: [agent-availability-liveness-detection, command-bar, voice-command]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reportOutcome(reply.kind) called unconditionally at the top of every /agent reply handler (before per-kind branching) — the store's own kind===\"unavailable\" comparison decides clear vs. set, so no per-case duplication is needed at call sites"
    - "Voice's stale-drop guard (D-05) now also gates the new store write: reportOutcome is placed AFTER the existing capturedSeq !== seqRef.current early-return, never before"

key-files:
  created: []
  modified:
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/CommandBar.test.tsx
    - frontend/src/hooks/useVoiceCommand.ts
    - frontend/src/hooks/useVoiceCommand.test.ts

key-decisions:
  - "The 'unavailable' case in CommandBar mirrors 'unclear' (keeps typed text for retry), NOT 'refuse' (which clears text) — caregiver should not lose their command while the assistant is down"
  - "In useVoiceCommand, 'unavailable' joins the existing grouped 'clarify'/'unclear' case body — voice does not do multi-turn recovery for any of these three kinds"
  - "reportOutcome placement differs by consumer's existing invariants: CommandBar calls it unconditionally at the top of onSuccess (no stale-drop concept there); useVoiceCommand calls it immediately after the capturedSeq stale-drop guard, preserving the 'stale drop BEFORE any store touch' invariant (T-06-07)"

requirements-completed: [LIVE-01]

# Metrics
duration: 7min
completed: 2026-08-20
---

# Phase 6 Plan 3: CommandBar + useVoiceCommand unavailable case + reactive reportOutcome Summary

**Both `/agent` reply consumers (CommandBar's `onSuccess`, `useVoiceCommand`'s `handleSuccess`) now handle all 5 `AgentReply.kind` values and reactively report every real reply into the shared `agentStatus` store, closing the D-07 instant-clear/instant-set gap ahead of the next `/health` poll.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-20T18:24:00Z
- **Completed:** 2026-08-20T18:30:43Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Closed the RESEARCH Pitfall 1 switch-exhaustiveness gap: neither `CommandBar.tsx`'s `onSuccess` nor `useVoiceCommand.ts`'s `handleSuccess` can silently no-op on `kind="unavailable"` anymore — both are 5-case complete, and 4 new regression tests pin this so a future 6th kind can't repeat the gap silently.
- Delivered D-07 end to end: the moment either consumer receives ANY real `/agent` reply, it reports that outcome to `store/agentStatus.ts` — instant-clear on any reachable kind, instant-set on `"unavailable"` — so the `AgentStatusBanner` (Plan 02) reacts within the same render instead of waiting up to ~60s for the next `/health` poll tick.
- Preserved the existing D-05 stale-drop discipline in voice: the new `reportOutcome` store write in `useVoiceCommand` sits AFTER the `capturedSeq !== seqRef.current` guard, verified by a dedicated regression test (a late, stale `"unavailable"` reply cannot flip the store back to `true` after a newer reply already cleared it) — T-06-07 mitigation confirmed.

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: CommandBar's 5th switch case + reactive reportOutcome (D-07, LIVE-01)**
   - `f61ffc8` (test) — add failing tests for the unavailable case + reportOutcome
   - `18ddbc6` (feat) — implement the case + unconditional reportOutcome call
2. **Task 2: useVoiceCommand's 5th switch case + reactive reportOutcome (D-07, LIVE-01)**
   - `1e6e2ed` (test) — add failing tests, including the D-05/T-06-07 stale-drop guard test
   - `faed7e8` (feat) — implement the grouped case + post-guard reportOutcome call

_No refactor commits needed — both implementations were minimal, idiomatic extensions of existing patterns._

## Files Created/Modified
- `frontend/src/components/CommandBar.tsx` — `onSuccess` now calls `useAgentStatus.getState().reportOutcome(reply.kind)` before the switch, and gained a `case "unavailable"` mirroring `"unclear"`'s text-preserving treatment
- `frontend/src/components/CommandBar.test.tsx` — 2 new tests: unavailable reply renders + reports `unavailable: true` while keeping typed text; any other reply kind clears `unavailable: false`; store reset added to `beforeEach`
- `frontend/src/hooks/useVoiceCommand.ts` — `handleSuccess` calls `useAgentStatus.getState().reportOutcome(reply.kind)` immediately after the stale-drop guard, and `"unavailable"` joins the `"clarify"`/`"unclear"` grouped case
- `frontend/src/hooks/useVoiceCommand.test.ts` — 2 new tests: unavailable reply surfaces message + returns to listening + reports `unavailable: true`; a late, stale `"unavailable"` reply does NOT flip the store back after a newer reply already cleared it; store reset added to `beforeEach`

## Decisions Made
- `"unavailable"` in CommandBar mirrors `"unclear"` (keep text), not `"refuse"` (clear text) — matches the plan's explicit behavior spec so the caregiver never loses a typed command while the assistant is down.
- In `useVoiceCommand`, `"unavailable"` was added to the existing `case "clarify": case "unclear":` fallthrough rather than a standalone case, since the body (`setMessage(reply.message)`) and the uniform post-switch `setVoiceState("listening")` already produce the exact behavior the plan specifies — no duplication introduced.
- The stale-drop-guard regression test was rewritten during RED to start from `useAgentStatus.setState({ unavailable: true })` rather than `false`, because the original design (start false, assert stays false) passed trivially before any implementation existed — a violation of the TDD fail-fast rule. Starting from `true` makes the newest reply's clear a genuine, testable assertion, and the stale reply's non-effect a genuine second assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing frontend dependencies from lockfile**
- **Found during:** Task 1, before first test run
- **Issue:** The worktree's `frontend/node_modules` was absent (git-ignored, not carried into the worktree checkout), so `vitest`/`vite`/`@vitejs/plugin-react` failed to resolve and every test run errored at config-load time before any test executed.
- **Fix:** Ran `npm ci` in `frontend/` — installs exactly what `package-lock.json` already pins, no new packages added, no name substitutions. This is a lockfile sync, not a new-package install, so it does not fall under the package-manager-install exclusion in Rule 3 (that exclusion targets adding *new* dependency names, which risks slopsquatting).
- **Files modified:** none tracked (node_modules is git-ignored)
- **Verification:** `npx vitest run` subsequently loaded and ran the suite correctly
- **Committed in:** N/A (node_modules is git-ignored, nothing to commit)

**2. [TDD fail-fast rule] Rewrote a stale-drop regression test that passed trivially in RED**
- **Found during:** Task 2 RED phase
- **Issue:** The stale-drop guard test as originally planned/written (start `unavailable: false`, resolve newest as `"applied"`, assert still `false`, resolve stale as `"unavailable"`, assert still `false`) passed with ZERO implementation present, because `reportOutcome` didn't exist yet — nothing was writing to the store at all, so the flag trivially stayed at its initial value.
- **Fix:** Changed the test to seed `useAgentStatus.setState({ unavailable: true })` before the exchange, so clearing the flag on the newest reply is a real, currently-failing assertion, and the stale reply's non-effect afterward is a second real assertion — both required implementation to satisfy.
- **Files modified:** `frontend/src/hooks/useVoiceCommand.test.ts`
- **Verification:** Confirmed the rewritten test failed pre-implementation (`AssertionError: expected true to be false`) and passed post-implementation
- **Committed in:** `1e6e2ed` (RED commit, test already in its fixed form) / `faed7e8` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking-fix, 1 TDD process correction)
**Impact on plan:** No scope creep. Both were necessary to execute the plan as specified — the dependency install unblocked all verification, and the test rewrite ensures the regression test actually protects the stale-drop invariant instead of passing by coincidence.

## Issues Encountered
None beyond the two items documented above under Deviations.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- LIVE-01's frontend consumption half is complete: both `/agent` reply consumers handle all 5 `AgentReply.kind` values, and D-07's reactive clear/set is wired end to end on both the text and voice paths.
- Full frontend suite (`npx vitest run`) passes at 195/195 with zero regressions; `npx tsc --noEmit` reports no new type errors.
- No blockers for subsequent Phase 6 plans or later phases. The residual risk flagged in the plan's threat model (a hypothetical future 6th `AgentReply.kind` falling through silently) remains unmitigated by design — RESEARCH Open Question 3's `assertNever` helper was explicitly out of this plan's scope, noted here for visibility, not as a blocker.

---
*Phase: 06-agent-availability-liveness-detection*
*Completed: 2026-08-20*
