---
phase: 16-trend-clarity-and-chart-polish
plan: 03
subsystem: ui
tags: [react, recharts, typescript, vitest, charts, accessibility]

# Dependency graph
requires:
  - phase: 16-trend-clarity-and-chart-polish (plan 01)
    provides: "rollingAverage() count-based rolling average helper in frontend/src/lib/chartData.ts"
provides:
  - "CombinedTimeline renders bold 4px rolling-average trend lines for systolic/diastolic/pulse once 7+ readings are visible"
  - "Raw lines dim (strokeWidth 2, strokeOpacity 0.85) only when a trend line exists to support them"
  - "End-label pill moves from raw line to trend line via the same hasTrend gate, never both at once"
  - "Visible 18px caption states trend status and the exact reading count when under 7 readings"
affects: [17-analytical-views-bp-heatmap-and-event-correlation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasTrend = points.length >= 7 as a single gate driving trend-Line mounting, raw-line dimming, and end-label pill placement — keeps pre-Phase-16 <7-point behavior byte-for-byte unchanged"
    - "trendPoints: TrendPoint[] = points.map(...) — a strict superset of TimePoint merged with rollingAverage() output, replacing points as the LineChart data source so bands/axes/markers/tooltip (which never read the new keys) are unaffected"

key-files:
  created: []
  modified:
    - frontend/src/components/charts/CombinedTimeline.tsx
    - frontend/src/components/charts/CombinedTimeline.test.tsx

key-decisions:
  - "Reused the exact min-h-0 flex-1 idiom from AmPmComparison.tsx for the caption + fixed-height-parent/flexible-chart-body layout, rather than inventing a new pattern"
  - "TimePoint imported via a separate `import type` line (not merged into the existing value-import list) per tsconfig's verbatimModuleSyntax, matching ChartTooltip.tsx's established convention"

patterns-established:
  - "Single boolean gate (hasTrend) drives three independent visual concerns (line mounting, dimming, label placement) instead of three separate conditionals, keeping the <7-point path a true no-op"

requirements-completed: [D-02, D-03, D-04, D-05]

# Metrics
duration: ~42min
completed: 2026-09-18
---

# Phase 16 Plan 03: Trend Lines, Conditional Dimming & Caption Summary

**Bold rolling-average trend lines (systolic/diastolic/pulse) now render over dimmed raw data on CombinedTimeline once 7+ readings are visible, with a live caption explaining the trend state and zero regression to the pre-existing dual-axis/band/marker/tooltip test suite.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-09-18T07:32:34Z
- **Completed:** 2026-09-18T08:14:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `CombinedTimeline.tsx` merges three `rollingAverage()` calls (systolic/diastolic/pulse) onto a `trendPoints` superset of the existing render data, replacing `points` as the `LineChart` source with zero effect on bands, axes, markers, or the click tooltip
- Raw lines dim to `strokeWidth={2}`/`strokeOpacity={0.85}` and the pulse line keeps its `strokeDasharray="9 5"`, but only when `hasTrend` (`points.length >= 7`) is true — under 7 readings the chart renders byte-for-byte as it did pre-Phase-16
- The end-label pill moves from the raw line to its corresponding trend line via the same `hasTrend` gate, so exactly 3 pills ever exist regardless of whether 3 or 6 `<Line>` elements are mounted
- A new 18px caption states either the trend-line explanation or the exact reading count blocking it (`"you have 4 here"`), wrapped in the `flex-col`/`min-h-0 flex-1` layout idiom already used in `AmPmComparison.tsx`
- `CombinedTimeline.test.tsx` gained a `TREND_READINGS` (8-point) fixture and 6 new assertions covering the 6-line render, the dim/bold attribute split, the dashed pulse trend line, the no-duplicate-pill invariant, and both caption variants — every one of the 19 pre-existing assertions (all on the original 4-point `READINGS` fixture) is untouched and still passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Trend lines, conditional dimming, and caption in CombinedTimeline.tsx** - `56ef44f` (feat)
2. **Task 2: CombinedTimeline.test.tsx — trend-line coverage, zero regressions** - `8b656f4` (test)

**Plan metadata:** committed by orchestrator after wave completion (worktree mode — STATE.md/ROADMAP.md updates deferred)

## Files Created/Modified
- `frontend/src/components/charts/CombinedTimeline.tsx` - Added `rollingAverage`/`TimePoint` imports, `TrendPoint` type, `hasTrend` gate, `trendPoints` merge, three bold trend `<Line>` elements, conditional raw-line dimming, conditional end-label pill placement, caption paragraph, and the flex-col/min-h-0 layout wrap
- `frontend/src/components/charts/CombinedTimeline.test.tsx` - Added `TREND_READINGS` fixture and a new `describe("CombinedTimeline trend lines (Phase 16, D-01–D-05)")` block with 6 tests

## Decisions Made
- None beyond what the plan specified — plan's `<action>` blocks were followed literally for import ordering, layout idiom reuse, and gate placement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree had no `node_modules` (fresh worktree, per the known STATE.md corollary about worktree-isolated frontend work). Ran `npm install` against the existing `package-lock.json` before `tsc`/`vitest` would run — no new packages added, `package-lock.json` unchanged.
- The first full-suite `npx vitest run` (run concurrently with earlier `npm install`/`tsc` resource use on this sandboxed machine) produced 2 worker-startup timeouts (`speech.test.ts`, `responsive.test.ts` — neither touched by this plan) plus one 5000ms test timeout on the new `CombinedTimeline` "never duplicates the end-label pill" test, with a 1635s total run duration (should be ~10s). A clean rerun of `npx vitest run` with no concurrent load completed in 8.66s with **547/547 tests passing**, confirming the earlier failures were transient resource contention, not real regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CombinedTimeline's trend-line rendering, dimming, and caption behavior (D-02–D-05) is complete and fully test-covered; ready for Phase 17 (Analytical Views) to build on the same `rollingAverage`/`chartData.ts` foundation if needed.
- No blockers.

---
*Phase: 16-trend-clarity-and-chart-polish*
*Completed: 2026-09-18*
