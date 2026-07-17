---
phase: 02-read-api-dashboard
plan: 06
subsystem: frontend-dashboard
tags: [react, typescript, tailwind, rtl, vitest, tdd]
requires:
  - phase: 02-read-api-dashboard
    plan: 03
    provides: "api/types.ts (StatsSummary/Reading), lib/palette.ts, lib/dates.ts, store/filters.ts"
provides:
  - "StatsStrip component rendering GET /stats/summary verbatim (DASH-08, D-21/D-22)"
  - "ReadingsTable with newest-first ordering, Show 20 more paging, category chips (DASH-09, D-23/D-24)"
  - "EmptyState guided zero-result surface with showAllData escape (D-11)"
affects:
  - "02-07 (App wiring — imports StatsStrip/ReadingsTable/EmptyState)"
tech-stack:
  added: []
  patterns:
    - "Presentational components receive typed API data as props; fetching stays at App level"
    - "Category colors exclusively via palette.ts CSS vars (categoryColor + CHIP_TEXT)"
    - "TDD RED/GREEN for table behavior (fireEvent + RTL, vitest globals)"
key-files:
  created:
    - frontend/src/components/StatsStrip.tsx
    - frontend/src/components/EmptyState.tsx
    - frontend/src/components/ReadingsTable.tsx
    - frontend/src/components/ReadingsTable.test.tsx
  modified: []
decisions:
  - "Null VitalStats renders em dash for avg AND min/max ('min — · max —') — never 0, never blank (D-22)"
  - "latest_reading is documented in StatsStrip as a non-tile payload field (preset anchor / EmptyState copy), keeping the strip to the UI-SPEC Layout item 3 tile list"
  - "EmptyState omits the newest-reading sentence entirely when latestReading is null (defensive — anchor not yet loaded)"
  - "Table Date column uses long form ('June 3, 2025') matching UI-SPEC date style; Time via toLocaleTimeString"
metrics:
  duration: 3min
  tasks: 2
  files: 4
  completed: 2026-07-17
---

# Phase 2 Plan 06: Stats Strip, Readings Table, Empty State Summary

Stats strip renders /stats/summary verbatim with em-dash null handling, readings table pages newest-first 20-at-a-time with clinical-color chips, and the D-11 guided empty state offers the single Show-all-data escape — table behavior locked by 6 RTL tests.

## What Was Built

- **StatsStrip** (`frontend/src/components/StatsStrip.tsx`): responsive grid of sky-surface tiles — Systolic/Diastolic/Pulse vital tiles (20px/700 caption, 32px/700 avg, 18px "min · max" line), reading-count tile, and a category percent row iterating `stats.categories` in payload (clinical) order with `categoryColor` swatch dots. Null `VitalStats` (count 0) renders "—" for all three values. `isLoading` renders skeleton tiles with `aria-busy="true"`. Zero client-side arithmetic — every number comes from the `stats` prop (anti-pattern guard honored: no `reduce(`, no averaging).
- **EmptyState** (`frontend/src/components/EmptyState.tsx`): exact UI-SPEC copy — heading "No readings match these filters" (24px/700), 18px body assembling "There are no {AM|PM }readings in {presetLabel}{ in {category}}. The newest reading is from {fmtLongDate(latestReading)}.", accent `min-h-12` "Show all data" button calling `useFilters(s => s.showAllData)`. Sailboat icon `aria-hidden` above the heading (D-16). The range is never auto-widened.
- **ReadingsTable** (`frontend/src/components/ReadingsTable.tsx`): semantic table with sr-only caption "Readings", six `scope="col"` headers (Date, Time, AM/PM, Blood pressure, Pulse, Category), newest-first via ISO string sort, `visible` slice state (20, +20 per click) reset by `useEffect` on readings identity change. BP cell "128 / 74", display-only chip with `categoryColor`/`CHIP_TEXT`, notes as a `colSpan={6}` plain-text row only when non-null/non-empty (T-02-08). Full-width accent "Show 20 more" button replaced by "Showing all {n} readings" when exhausted. No MAP/pulse-pressure/pulse-category columns (D-24).

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | StatsStrip + EmptyState | 1600d97 | feat |
| 2 (RED) | Failing ReadingsTable behavior tests | 340e101 | test |
| 2 (GREEN) | ReadingsTable implementation | ee36c6d | feat |

## TDD Gate Compliance

RED gate: `test(02-06)` commit 340e101 — 6 tests failed on missing module (confirmed before implementation). GREEN gate: `feat(02-06)` commit ee36c6d — 6/6 pass. No refactor commit needed (implementation was clean on first pass).

## Verification

- `npm test -- --run` — 5 files, 31 tests, all pass (includes the 6 new table behavior tests: 20→40→45 slicing + button removal + "Showing all 45 readings", newest-first ordering, chip palette colors, 6-column header contract with derived-field exclusion, notes-only-when-present, reset-on-prop-change)
- `npm run build` — tsc + vite exit 0
- Grep gates: StatsStrip has `aria-busy` (1) and `categoryColor`; no `reduce(`/aggregate math. EmptyState has "Show all data", `showAllData`, `fmtLongDate`. ReadingsTable has "Show 20 more", `scope="col"`, `categoryColor`; no `dangerouslySetInnerHTML`; no derived-field columns.

## Deviations from Plan

None - plan executed exactly as written. (One cosmetic self-adjustment: a code comment in ReadingsTable.tsx was reworded so the D-24 exclusion grep gate matches only real code, not documentation prose — folded into the GREEN commit.)

## Known Stubs

None — all three components are fully wired to typed props; data fetching intentionally lands in plan 02-07 per the interface contract (not a stub — declared architecture).

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface. T-02-08 (notes XSS) mitigated via React text node rendering, asserted by the no-`dangerouslySetInnerHTML` gate; T-02-11 honored (components render typed data only, never error objects); T-02-SC honored (zero new packages — `npm ci` from committed lockfile only).

## Next Phase Readiness

Plan 02-07 can now compose the full dashboard: StatsStrip/ReadingsTable/EmptyState props match the interface contract exactly (`{ stats, isLoading }`, `{ readings }`, `{ latestReading, amPm, bpCategory, presetLabel }`).

## Self-Check: PASSED

All 4 created files exist on disk; commits 1600d97, 340e101, ee36c6d present in git log.
