---
phase: 12-visual-refresh
plan: 03
subsystem: ui
tags: [react, tailwind, css-custom-properties, accessibility, design-tokens]

# Dependency graph
requires:
  - phase: 12-visual-refresh (plan 01)
    provides: "--shadow-elevation, --text-h2, --text-control CSS custom properties in frontend/src/index.css"
provides:
  - "OverlayEventsList.tsx, ChartDeck.tsx's mini chart-picker cards depth-treated with rounded-xl + shadow-elevation"
  - "FilterBar.tsx and OverlayToggle.tsx shared inactiveClass/activeClass toggle-button constants bumped to rounded-xl (OverlayToggle also gets shadow-elevation)"
  - "text-h2/text-control type-scale tokens formalized across all five files, replacing ad-hoc text-2xl/text-xl/text-[20px]"
  - "gap-6->gap-8 section-level spacing bump on ChartDeck's two section wrappers and AmPmComparison's hero two-panel layout (3 of the sitewide 5 gap-6 instances; the other 2 are App.tsx's ChartSkeleton, closed by Plan 12-02)"
affects: [12-visual-refresh remaining plans (12-04 through 12-07), any future dashboard control-surface work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radius/shadow/type-scale changes applied as pure Tailwind class-string edits to existing shared constants (inactiveClass/activeClass) rather than new components"

key-files:
  created: []
  modified:
    - frontend/src/components/OverlayEventsList.tsx
    - frontend/src/components/ChartDeck.tsx
    - frontend/src/components/charts/AmPmComparison.tsx
    - frontend/src/components/FilterBar.tsx
    - frontend/src/components/OverlayToggle.tsx

key-decisions:
  - "FilterBar's toggle buttons get radius-only treatment (no shadow) — UI-SPEC's elevation table names OverlayToggle's dataset buttons, not FilterBar's date/AM-PM pills, as the interactive-control shadow exception"
  - "D-07 pulse-ring mechanisms (pulseClass in both FilterBar.tsx and OverlayToggle.tsx) left byte-identical — verified via grep against the pre-task rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse string"

patterns-established: []

requirements-completed: [VISUAL-01, VISUAL-02]

# Metrics
duration: ~12min
completed: 2026-08-27
---

# Phase 12 Plan 03: Control-Surface Depth, Type-Scale & Spacing Summary

**Applied the D-05 depth treatment (rounded-xl + shadow-elevation) and D-06 type-scale tokens to the dashboard's five interactive control-surface components (OverlayEventsList, ChartDeck, AmPmComparison, FilterBar, OverlayToggle), plus the D-05 gap-6→gap-8 spacing bump on ChartDeck's two section wrappers and AmPmComparison's hero panel — zero change to aria-pressed/aria-label/min-h-12/pulse-animation behavior.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-27 (session start)
- **Completed:** 2026-08-27T00:58:09Z
- **Tasks:** 2/2 completed
- **Files modified:** 5

## Accomplishments
- OverlayEventsList's table panel and ChartDeck's mini chart-picker cards now show rounded-xl + shadow-elevation depth, matching StatsStrip/ReadingsTable's cited before/after example
- FilterBar's and OverlayToggle's shared toggle-button classes bumped from rounded-lg to rounded-xl at unchanged min-h-12 height; OverlayToggle additionally carries shadow-elevation as the one interactive-control shadow exception
- All five files' headings/labels formalized onto the named text-h2/text-control type-scale tokens (zero text-2xl/text-xl/text-[20px] remaining in the touched files)
- ChartDeck's two section-level gaps and AmPmComparison's hero panel gap bumped from gap-6 to gap-8 (3 of the exactly 5 sitewide gap-6 instances; the other 2 in App.tsx's ChartSkeleton were closed by Plan 12-02)
- Full frontend suite green: 329/329 tests passing after both tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: OverlayEventsList.tsx + ChartDeck.tsx + AmPmComparison.tsx — depth, type-scale, and section spacing** - `1cad4b8` (feat)
2. **Task 2: FilterBar.tsx + OverlayToggle.tsx — toggle-button radius/shadow and type-scale** - `99d58a4` (feat)

**Plan metadata:** commit pending (this SUMMARY.md commit)

## Files Created/Modified
- `frontend/src/components/OverlayEventsList.tsx` - h2 text-2xl→text-h2; table-wrapping section rounded-lg→rounded-xl + shadow-[var(--shadow-elevation)]; "Show 20 more" CTA rounded-lg→rounded-xl, text-xl→text-control
- `frontend/src/components/ChartDeck.tsx` - hero h2 text-2xl→text-h2; charts-section wrapper and mini-card grid gap-6→gap-8; mini-card button rounded-lg→rounded-xl + shadow-[var(--shadow-elevation)]; mini title span text-[20px]→text-control; FadeSwap transition untouched
- `frontend/src/components/charts/AmPmComparison.tsx` - hero two-panel wrapper gap-6→gap-8
- `frontend/src/components/FilterBar.tsx` - shared inactiveClass/activeClass rounded-lg→rounded-xl, text-[20px]→text-control (no shadow added); pulseClass and category-chip rounded-full untouched
- `frontend/src/components/OverlayToggle.tsx` - shared inactiveClass/activeClass rounded-lg→rounded-xl, text-[20px]→text-control, plus appended shadow-[var(--shadow-elevation)]; "Overlay:" label text-[20px]→text-control; pulseClass untouched

## Decisions Made
- FilterBar's toggle buttons get radius-only treatment (no shadow) — UI-SPEC's elevation table names OverlayToggle's dataset buttons specifically as "filter chips" for the shadow exception, not FilterBar's generic date/AM-PM pills
- D-07 pulse-ring mechanisms (pulseClass in both files) verified byte-identical to pre-task form via grep, preventing accidental scope creep into the phase's protected motion boundary

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps for both tasks passed on first attempt; no auto-fixes needed.

## Issues Encountered

None.

## Next Phase Readiness
- This plan's five files are now consistent with 12-01's token foundation and 12-02's data-surface depth treatment
- Remaining Wave 2 plans (12-04 through 12-07) share zero files with this plan and can proceed independently

---
*Phase: 12-visual-refresh*
*Completed: 2026-08-27*
