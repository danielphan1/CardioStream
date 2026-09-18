---
phase: 16-trend-clarity-and-chart-polish
plan: 04
subsystem: frontend/charts
tags: [recharts, layout-geometry, gap-closure, regression-test]
dependency-graph:
  requires: [frontend/src/lib/chartData.ts (estimateChipWidth, CategoryBarRow)]
  provides: [categoryBarRightMargin() pure function]
  affects: [frontend/src/components/charts/CategoryBars.tsx]
tech-stack:
  added: []
  patterns: ["derive layout geometry from actual data, not a static guess — same pattern estimateChipWidth already established for CombinedTimeline's band-label chips"]
key-files:
  created: []
  modified:
    - frontend/src/lib/chartData.ts
    - frontend/src/lib/chartData.test.ts
    - frontend/src/components/charts/CategoryBars.tsx
decisions: []
metrics:
  duration: ~15min
  completed: 2026-09-18
---

# Phase 16 Plan 04: CategoryBars margin-clipping gap closure Summary

Replaced `CategoryBars.tsx`'s static `margin.right` guess (160px narrow / 300px wide — roughly half of what the longest real D-10 label needs) with `categoryBarRightMargin(rows, fontSize)`, a new pure function in `chartData.ts` that derives the margin from the actual rendered label set via the existing `estimateChipWidth()` helper.

## What Was Built

**Task 1 — `categoryBarRightMargin()` + regression tests** (commit `79050bb`)

- Added `CATEGORY_LABEL_MARGIN_PADDING = 16` (covers `CategoryBars.tsx`'s own 8px label offset plus a small buffer) and `export function categoryBarRightMargin(rows: CategoryBarRow[], fontSize: number): number` to `chartData.ts`, placed directly after `estimateChipWidth`.
- Body: `rows.length === 0` returns `0` (mirrors `estimateChipWidth`'s own degenerate case); otherwise `Math.max(...rows.map((r) => estimateChipWidth(r.label, fontSize))) + CATEGORY_LABEL_MARGIN_PADDING`.
- Added a `describe("categoryBarRightMargin", ...)` block to `chartData.test.ts` with the exact 37-char "Hypertensive Crisis — 6 readings (5%)" fixture from `16-REVIEW.md`'s CR-01, plus a shorter row to prove the function picks the max across rows. Four cases: exact value at 16px (383 = 367 + 16), exact value at 18px (429 = 413 + 16), an invariant check (`>=` the longest label's own `estimateChipWidth`, survives future padding retuning), and the empty-rows degenerate case (`0`).

**Task 2 — Wire `CategoryBars.tsx` to the derived margin** (commit `059da86`)

- Added `categoryBarRightMargin` to the `chartData` import.
- Deduplicated the previously-duplicated `narrow ? 16 : 18` ternary into one `const labelFontSize = narrow ? 16 : 18;`, used both by the `barLabel` glyph's `fontSize` and by `categoryBarRightMargin(rows, labelFontSize)`.
- `BarChart`'s `margin.right` now reads `rightMargin` (the computed value) instead of `narrow ? 160 : 300`.
- Updated the stale doc comment describing the old static-margin approach to explain the new derived-margin approach and cite CR-01/16-VERIFICATION.md.

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 551/551 tests pass (39 files), including the 4 new `categoryBarRightMargin` cases; zero regressions
- `npm run lint` (oxlint) — clean
- All plan acceptance-criteria greps confirmed: `export function categoryBarRightMargin` (1), `CATEGORY_LABEL_MARGIN_PADDING` (2), `describe("categoryBarRightMargin"` (1), `right: narrow ? 160 : 300` (0, fully removed), `categoryBarRightMargin(rows, labelFontSize)` (1), `labelFontSize` (3)

**Deferred to human/live verification (documented, not blocking):** Task 2's `<verify><human-check>` calls for opening the dashboard's BP Categories chart in a real browser at ~320-414px and >=480px viewports to visually confirm the longest label no longer clips. jsdom's `ResizeObserver` stub never fires in this environment (`containerWidth` stays 0), so the `narrow` branch and the derived-margin value can only be exercised with real text layout in a live browser — no browser-automation tooling (Playwright, MCP browser) was available in this worktree to perform that check. The underlying margin math is locked by Task 1's exact-value regression tests, which is the strongest verification available at the code level; the live-viewport spot-check should be picked up in the phase's human-verify pass.

## Deviations from Plan

None — plan executed exactly as written. `npm install` was run in the worktree to restore the frontend's existing `node_modules` (missing because worktrees don't carry gitignored install artifacts) — not a new package install, no `package.json` change.

## Self-Check: PASSED

- FOUND: frontend/src/lib/chartData.ts (categoryBarRightMargin export confirmed via grep)
- FOUND: frontend/src/lib/chartData.test.ts (categoryBarRightMargin describe block confirmed via grep)
- FOUND: frontend/src/components/charts/CategoryBars.tsx (categoryBarRightMargin wiring confirmed via grep)
- FOUND: commit 79050bb (Task 1)
- FOUND: commit 059da86 (Task 2)
