---
phase: 16-trend-clarity-and-chart-polish
plan: 01
subsystem: ui
tags: [recharts, vitest, typescript, wcag-contrast, chart-data]

# Dependency graph
requires: []
provides:
  - "rollingAverage() exported from frontend/src/lib/chartData.ts — count-based 7-reading rolling average over systolic/diastolic/pulse"
  - "12-assertion WCAG 1.4.11 contrast regression block locking the 0.85 dimmed-raw-line opacity Plan 16-03 will apply"
affects: [16-03-combined-timeline-trend-lines]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Count-based (not calendar-day) rolling window over TimePoint[], generic over which vitals key it averages"
    - "Contrast regression tests store precomputed hex literals (not computed at test time) so a future token/opacity edit fails the test instead of silently drifting"

key-files:
  created: []
  modified:
    - frontend/src/lib/chartData.ts
    - frontend/src/lib/chartData.test.ts
    - frontend/src/tests/contrast.test.ts

key-decisions:
  - "rollingAverage reuses the file's existing round1() helper rather than a new rounding utility, per the plan's explicit instruction"

patterns-established:
  - "Rolling-window derived values follow groupAmPm's 'no data -> undefined, never fabricate' convention"

requirements-completed: [D-01, D-02, D-03, D-04]

# Metrics
duration: 7min
completed: 2026-09-18
---

# Phase 16 Plan 01: Rolling Average Foundation + Contrast Regression Summary

**`rollingAverage()` count-based 7-reading window over systolic/diastolic/pulse, unit-tested for partial/exact/sliding-window and gap-indifference; 12-assertion WCAG 1.4.11 regression locking the 0.85 dimmed-raw-line opacity Plan 16-03 will apply**

## Performance

- **Duration:** ~7 min (plus one-time worktree dependency install, not part of task time)
- **Started:** 2026-09-18T00:22:26-07:00
- **Completed:** 2026-09-18T00:28:50-07:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `rollingAverage(points, key, window=7)` exported from `chartData.ts`, count-based (not calendar-day), `undefined` until a full window exists — 6 new unit tests covering partial-window (D-02), exact-window rounding, sliding-window, gap-indifference (D-01), empty-input, and per-key correctness (D-03)
- 12 new WCAG 1.4.11 contrast assertions (3 vitals series x 2 backgrounds x 2 themes) proving the 0.85 dimmed-raw-line opacity Plan 16-03 will apply still clears the 3:1 non-text floor

## Task Commits

Each task was committed atomically:

1. **Task 1: rollingAverage() pure function + unit tests** (TDD) — RED `f440fe7`, GREEN `32b885b`
2. **Task 2: Contrast regression for the 0.85 dimmed-raw-line opacity** — `f8c30fa` (test)

_Task 1 followed the full RED/GREEN cycle (no REFACTOR commit — the first working implementation matched the plan's exact spec, nothing to clean up). Task 2 is test-only, no implementation commit needed (only test-file additions of precomputed hex literals + assertions)._

## Files Created/Modified
- `frontend/src/lib/chartData.ts` - added `export function rollingAverage(points, key, window=7)` directly below `groupAmPm`, reusing the existing `round1()` helper
- `frontend/src/lib/chartData.test.ts` - added `rollingAverage` to the named-import block; added `describe("rollingAverage", ...)` with 6 `it` cases (A-F from the plan's `<behavior>`)
- `frontend/src/tests/contrast.test.ts` - added 6 `LIGHT` + 6 `DARK` dimmed-line hex tokens, a `DIMMED_LINE_PAIRS` tuple array, and two new `describe` blocks (light/dark) with `it.each` over the 12 pairs

## Decisions Made
None beyond what the plan specified — implementation followed the plan's exact function signature, algorithm, and hex literals as written.

## Deviations from Plan

None - plan executed exactly as written. One environment-setup step not itself a deviation: this worktree had no `node_modules` (git worktrees don't share gitignored working-tree state with the main checkout), so `npm ci` was run in `frontend/` before any test could execute — a one-time setup cost, not a plan or code change.

## Issues Encountered

**Worktree missing `node_modules`.** Same class of issue STATE.md's Blockers/Concerns section flagged for the backend `.venv` in a prior quick task (260913-fdm) — git worktrees get a fresh, un-populated working directory for anything gitignored. Resolved by running `npm ci` in `frontend/` (189 packages, lockfile-exact) before the first test run. No code or plan impact; noting here so future worktree-isolated frontend work expects the same first-run cost.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `rollingAverage` is exported, fully unit-tested, and ready for Plan 16-03 (wave 2) to import into `CombinedTimeline.tsx` for all three vitals series
- The 0.85 dimming opacity Plan 16-03 will apply to raw lines is pre-verified against the 3:1 WCAG 1.4.11 floor in both themes and both chart backgrounds — Plan 16-03 can apply that exact opacity value without a separate contrast check
- No blockers for wave 2

---
*Phase: 16-trend-clarity-and-chart-polish*
*Completed: 2026-09-18*

## Self-Check: PASSED
