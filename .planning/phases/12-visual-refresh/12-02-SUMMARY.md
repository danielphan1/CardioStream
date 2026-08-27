---
phase: 12-visual-refresh
plan: 02
subsystem: ui
tags: [tailwind, design-tokens, accessibility, vitest]

# Dependency graph
requires: ["12-01"]
provides:
  - "StatsStrip (VitalTile/SkeletonTile/Readings tile) on rounded-xl + shadow-[var(--shadow-elevation)], text-control/text-h1 tokens"
  - "ChartTooltip dialog on rounded-xl + shadow-[var(--shadow-elevation)], replacing the codebase's one static shadow-lg"
  - "EmptyState card + CTA button and ReadingsTable panel + CTA button on rounded-xl + shadow-[var(--shadow-elevation)] / text-control / text-h2"
  - "App.tsx's ChartSkeleton, error-retry panel, and Readings heading brought to the same rounded-xl/shadow-elevation/text-h2/text-control standard, plus gap-6 -> gap-8 skeleton spacing"
affects: ["12-03", "12-04", "12-05", "12-06", "12-07", "12-08"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Card/panel surfaces: rounded-lg -> rounded-xl + shadow-[var(--shadow-elevation)] (theme-aware depth cue from 12-01)"
    - "CTA buttons get the radius-only bump (rounded-xl) with no shadow — buttons are not cards"
    - "Ad-hoc pixel type classes (text-xl/text-[2rem]/text-2xl) renamed to named tokens (text-control/text-h1/text-h2) at unchanged rendered sizes"
    - "Category/status chips and Close-style secondary buttons are explicitly exempted from the card treatment — verified via grep, not eyeballing"

key-files:
  created: []
  modified:
    - frontend/src/components/StatsStrip.tsx
    - frontend/src/components/charts/ChartTooltip.tsx
    - frontend/src/components/EmptyState.tsx
    - frontend/src/components/ReadingsTable.tsx
    - frontend/src/App.tsx

key-decisions:
  - "Task 3 (App.tsx) executed as planned to close a plan-checker-flagged gap: App.tsx sits between StatsStrip and ReadingsTable in the normal dashboard view but was never named in any Phase 12 plan's files_modified — this plan absorbed it since it already owns the adjacent dashboard hero surfaces."
  - "App.tsx's ChartSkeleton gap-6 -> gap-8 bump applied exactly as specified, mirroring Plan 12-03's identical bump on the live ChartDeck section this skeleton previews — kept in sync intentionally, not coincidentally."

requirements-completed: [VISUAL-01, VISUAL-02]

# Metrics
duration: ~15min
completed: 2026-08-27
---

# Phase 12 Plan 02: Data-Surface & Feedback Component Depth/Type-Scale Summary

**Applied the D-05 depth treatment (rounded-lg → rounded-xl + shadow-[var(--shadow-elevation)]) and D-06 named type-scale tokens (text-control/text-h1/text-h2) to StatsStrip, ChartTooltip, EmptyState, ReadingsTable, and App.tsx's error-retry/skeleton/heading chrome — zero rendered-size or accessibility-floor change, 329/329 tests green.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-27T00:58:48Z
- **Tasks:** 3 of 3 auto tasks completed
- **Files modified:** 5

## Accomplishments
- `StatsStrip.tsx`'s `VitalTile`, `SkeletonTile`, and the inline Readings tile all moved from `rounded-lg` to `rounded-xl` + `shadow-[var(--shadow-elevation)]`; label/value text renamed from ad-hoc `text-xl`/`text-[2rem]` to the named `text-control`/`text-h1` tokens at unchanged rendered sizes. The category-chip `<li>` and its exact classes were left untouched, as scoped.
- `ChartTooltip.tsx`'s dialog div moved off the codebase's one remaining static `shadow-lg` onto the same theme-aware `shadow-[var(--shadow-elevation)]` mechanism as every other card, with `rounded-lg` → `rounded-xl`. The inline `style` color block and the Close button's `rounded-lg` were left untouched, as scoped.
- `EmptyState.tsx`'s outer card moved to `rounded-xl` + `shadow-[var(--shadow-elevation)]`, its heading renamed `text-2xl` → `text-h2`, and its "Show all data" CTA button given the radius-only bump (`rounded-xl`, no shadow) plus `text-control`.
- `ReadingsTable.tsx`'s panel moved to `rounded-xl` + `shadow-[var(--shadow-elevation)]`; its "Show 20 more" CTA button given the same radius-only bump and `text-control` rename. Table `<th>`/`<td>` cells, the category chip, and both files' `min-h-12` floors were left untouched.
- `App.tsx`'s `ChartSkeleton` (hero placeholder + 3 mini placeholders) moved to `rounded-xl` + `shadow-[var(--shadow-elevation)]`, mirroring `StatsStrip`'s own `SkeletonTile` treatment, and its section-level gaps bumped `gap-6` → `gap-8` (mirrors Plan 12-03's identical bump on the live `ChartDeck` section this skeleton previews). The error-retry panel got the same card treatment as `EmptyState`, its heading and the sitewide "Readings" section heading renamed `text-2xl` → `text-h2`, and its "Try again" button given the radius-only bump + `text-control`. This closes a plan-checker-flagged gap: App.tsx was never named in any Phase 12 plan's `files_modified` despite sitting directly between `StatsStrip` and `ReadingsTable` in the steady-state dashboard view.
- All acceptance-criteria grep checks passed exactly as specified in the plan for all three tasks (tile/panel counts, token-rename counts, old-class-removal counts, `min-h-12` preservation counts) before each commit.
- Full frontend suite green after every task: 329/329 tests, 29/29 files, zero regressions (RTL tests query by role/text/label, none assert on className, so the class-only changes did not affect any test).

## Task Commits

Each task was committed atomically:

1. **Task 1: StatsStrip.tsx + ChartTooltip.tsx — depth and type-scale** - `dfd85e7` (feat)
2. **Task 2: EmptyState.tsx + ReadingsTable.tsx — depth and type-scale** - `f55bcd0` (feat)
3. **Task 3: App.tsx — depth, type-scale, and section spacing (gap closure)** - `34b6398` (feat)

## Files Created/Modified
- `frontend/src/components/StatsStrip.tsx` - `VitalTile`/`SkeletonTile`/Readings tile on `rounded-xl` + `shadow-[var(--shadow-elevation)]`; label/value on `text-control`/`text-h1`; category chip untouched
- `frontend/src/components/charts/ChartTooltip.tsx` - Dialog div on `rounded-xl` + `shadow-[var(--shadow-elevation)]`, replacing the last static `shadow-lg`; Close button and inline style block untouched
- `frontend/src/components/EmptyState.tsx` - Card on `rounded-xl` + `shadow-[var(--shadow-elevation)]`; heading on `text-h2`; CTA button radius-only bump + `text-control`
- `frontend/src/components/ReadingsTable.tsx` - Panel on `rounded-xl` + `shadow-[var(--shadow-elevation)]`; CTA button radius-only bump + `text-control`; table cells/chip/floors untouched
- `frontend/src/App.tsx` - `ChartSkeleton` placeholders on `rounded-xl` + `shadow-[var(--shadow-elevation)]` at `gap-8` section spacing; error-retry panel on the same card treatment with `text-h2`/`text-control`; "Readings" heading on `text-h2`; pre-existing `<main>` `gap-8` and `min-h-12` floor untouched

## Decisions Made
- Verified every acceptance-criteria grep check from the plan (tile counts, token-rename counts, old-class-removal counts, `min-h-12`/chip preservation counts) before committing each task, rather than relying on visual inspection alone — matches the discipline Plan 12-01 established for its own D-04 token-locking verification.
- Executed Task 3 (App.tsx) exactly as scoped in the plan: only the `ChartSkeleton`, error-retry section, and "Readings" heading markup that `App.tsx` owns directly were touched; `Header`/`CommandBar`/`FilterBar`/`OverlayToggle`/`StatsStrip`/`OverlayEventsList`/`ChartDeck` (each covered by other Wave-2 plans) were left untouched, and the pre-existing `gap-8` on `<main>` (unrelated to this phase) was left as-is.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria in all three tasks passed on the first attempt with no fix-up edits required.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required, no new dependencies added.

## Next Phase Readiness

`StatsStrip.tsx`, `ChartTooltip.tsx`, `EmptyState.tsx`, `ReadingsTable.tsx`, and `App.tsx` are all now on the D-05/D-06 depth and type-scale standard established by Plan 12-01's tokens. No blockers for the remaining Wave 2 plans (12-03 through 12-07), which have zero file overlap with this plan's five files. The full 329-test frontend suite is green.

---
*Phase: 12-visual-refresh*
*Completed: 2026-08-27*
