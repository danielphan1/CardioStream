---
phase: 03-agent-via-text-input
plan: 02
subsystem: api
tags: [agent, zustand, tanstack-query, typescript, fetch, vitest]

# Dependency graph
requires:
  - phase: 02-dashboard
    provides: filter store (store/filters.ts), lib/dates.ts formatters, api/client.ts getJson discipline, api/types.ts mirrors
  - phase: 03-agent-via-text-input (plan 03-01)
    provides: backend /agent contract (schemas.py AgentReply/AppliedFilters JSON shape)
provides:
  - postJson/postAgent typed POST client with three-branch ApiError discipline
  - AgentRequest/AgentReply/AppliedFilters/ClarifyContext TS wire mirrors
  - applyAgentFilters store-mutation handler (D-13 carry-over, reset-first ordering)
  - composeConfirmation deterministic full-state echo (VOICE-06/D-07)
  - useAgentPulse D-08 signal store (touched filter groups per apply)
  - useAgent TanStack v5 mutation hook
affects: [03-04 CommandBar, phase-04 voice input]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Store mutation from outside the React tree via useFilters.getState() (agent-response handler)"
    - "Deterministic confirmation composed from post-apply store state, never from model text"
    - "Signal store (useAgentPulse) separate from the command schema store to keep filters pure"
    - "postJson mirrors getJson's three-branch ApiError discipline byte-for-byte"

key-files:
  created:
    - frontend/src/lib/agent.ts
    - frontend/src/lib/agent.test.ts
    - frontend/src/hooks/useAgent.ts
  modified:
    - frontend/src/api/client.ts
    - frontend/src/api/types.ts

key-decisions:
  - "reset marks all four pulse groups even though showAllData does not touch activeChart (plan-specified D-08 producer semantics)"
  - "composeConfirmation formats custom-range dates via parseDateOnly, not new Date(str), to avoid the UTC-midnight off-by-one (Pitfall 7)"
  - "useAgent uses useMutation with no query cache — agent replies are imperative actions, not cacheable server state"

patterns-established:
  - "Present-value delta application uses `!= null` (not truthiness) so 'all' survives as a valid value"
  - "Canonical labels/tokens pass straight through the frontend — the backend does all token translation"

requirements-completed: [VOICE-06, VOICE-08, SEC-02]

# Metrics
duration: 4min
completed: 2026-07-20
---

# Phase 3 Plan 02: Frontend Agent Foundation Summary

**Typed POST client, backend-contract TS mirrors, and the proven store-mutation + confirmation-composition primitives that make the CommandBar (03-04) and Phase 4 voice pure consumers.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-20T11:10:00-0700
- **Completed:** 2026-07-20T11:13:45-0700
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `postJson`/`postAgent` extend the API client with the same three-branch `ApiError` discipline as `getJson` — the identical call path Phase 4 voice will drive (VOICE-08).
- `applyAgentFilters` mutates the zustand filter store from outside the React tree with D-13 carry-over: reset-first, then present-value deltas only, so unmentioned filters survive.
- `composeConfirmation` emits the VOICE-06/D-07 canonical echo exactly — `"Showing blood pressure, last 30 days, mornings"` — deterministically from post-apply store state, never from model text.
- `useAgentPulse` records the D-08 producer signal (which filter groups changed) for FilterBar's highlight; kept separate from the filter store so it stays the pure command schema.
- 10 unit tests exercise the real zustand store (no mock); full frontend suite green at 57 tests, `tsc --noEmit` clean, SEC-02 grep clear.

## Task Commits

Each task was committed atomically:

1. **Task 1: postJson client + AgentReply type mirrors** - `7a95fe5` (feat)
2. **Task 2: applyAgentFilters + composeConfirmation + pulse signal + useAgent hook** - `df4f207` (feat)

**Plan metadata:** committed separately with this SUMMARY (docs).

## Files Created/Modified
- `frontend/src/api/client.ts` - Added `postJson<TBody,TRes>` (mirrors getJson's ApiError branches) and `postAgent`.
- `frontend/src/api/types.ts` - Added `ClarifyContext`, `AgentRequest`, `AppliedFilters`, `AgentReply` mirrors of the backend 03-01 wire contract; reuses existing `ChartId`/`BPCategory`.
- `frontend/src/lib/agent.ts` - `applyAgentFilters`, `composeConfirmation`, `useAgentPulse` signal store, `PulseField` type.
- `frontend/src/lib/agent.test.ts` - 10 unit tests: D-13 carry-over, reset ordering, custom-range passthrough, pulse marking, confirmation exact strings.
- `frontend/src/hooks/useAgent.ts` - `useAgent()` TanStack v5 mutation over `postAgent`.

## Decisions Made
- Custom-range confirmation dates format via `parseDateOnly` + `toLocaleDateString` (not `new Date(str)`) to dodge the UTC-midnight off-by-one (Pitfall 7). No `new Date(` call exists in `agent.ts` outside a warning comment.
- `reset` marks all four pulse groups per the plan's D-08 producer semantics, even though the store's `showAllData` leaves `activeChart` untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `composeConfirmation` `latestReading` parameter renamed to `_latestReading`**
- **Found during:** Task 2
- **Issue:** The plan's signature includes a `latestReading` parameter, but the locked confirmation template never anchors day presets to a date, so the parameter is unused. `tsconfig` has `noUnusedParameters: true`, which fails `tsc` on an unused named parameter.
- **Fix:** Kept the parameter (call-site parity: tests and callers pass `(state, null)`) but named it `_latestReading` — the TS-idiomatic intentionally-unused convention that satisfies `noUnusedParameters`.
- **Files modified:** frontend/src/lib/agent.ts
- **Verification:** `tsc --noEmit` exits 0; tests call `composeConfirmation(state, null)` successfully.
- **Committed in:** `df4f207` (part of task commit)

**2. [Rule 3 - Blocking] Worktree missing node_modules — symlinked from main checkout**
- **Found during:** Task 1 verification
- **Issue:** This git worktree had no `frontend/node_modules`, so `tsc`/`vitest` could not run (npx pulled an unrelated `tsc` package).
- **Fix:** Symlinked the main repo's `frontend/node_modules` into the worktree. `node_modules` is gitignored, so nothing was committed; this is an environment setup, not a source change.
- **Files modified:** none tracked (symlink is gitignored)
- **Verification:** `./node_modules/.bin/tsc` and `vitest` run correctly afterward.
- **Committed in:** n/a (not a repo change)

---

**Total deviations:** 2 (both Rule 3 blocking-issue resolutions)
**Impact on plan:** No scope change. One is a TS-compilation necessity (unused-param), one is environment setup. All acceptance criteria met as written.

## Issues Encountered
None beyond the two blocking issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03-04 (CommandBar) can consume `useAgent`, `applyAgentFilters`, `composeConfirmation`, and `useAgentPulse` directly — all proven backend-free.
- Phase 4 voice reuses `postAgent` and the same primitives unchanged (VOICE-08).
- No blockers.

## Self-Check: PASSED
- All 5 files verified present on disk.
- Both task commits verified in git log (`7a95fe5`, `df4f207`).
- `tsc --noEmit` exit 0; full suite 57 passed; `grep -ri anthropic frontend/src` empty (SEC-02).

---
*Phase: 03-agent-via-text-input*
*Completed: 2026-07-20*
