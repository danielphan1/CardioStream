---
phase: 16-trend-clarity-and-chart-polish
plan: 05
subsystem: frontend/charts
tags: [recharts, layout-geometry, gap-closure, regression-test, accessibility]
dependency-graph:
  requires: [frontend/src/lib/chartData.ts (categoryBarRightMargin, estimateChipWidth, CATEGORY_LABEL_MARGIN_PADDING — from Plan 04)]
  provides: [clampCategoryBarRightMargin() pure function, truncateLabelForWidth() pure function]
  affects: [frontend/src/components/charts/CategoryBars.tsx]
tech-stack:
  added: []
  patterns: ["bound a derived layout value against the real measured container before handing it to Recharts, rather than trusting the derived value alone — closes the round-2 gap left by Plan 04's categoryBarRightMargin(), which sized the margin correctly but never checked it against containerWidth"]
key-files:
  created: []
  modified:
    - frontend/src/lib/chartData.ts
    - frontend/src/lib/chartData.test.ts
    - frontend/src/components/charts/CategoryBars.tsx
decisions: []
metrics:
  duration: ~20min
  completed: 2026-09-18
---

# Phase 16 Plan 05: CategoryBars margin/containerWidth clamp (round-2 gap closure) Summary

Closed the one remaining BLOCKER from `16-VERIFICATION.md` round 2 (score 11/13): round 1's `categoryBarRightMargin()` correctly sized `margin.right` to the longest D-10 label but never bounded it against the container's actual measured width, so on a real 375px iPhone SE viewport (343px CategoryBars container after `App.tsx`'s `px-4` padding) the unclamped 383px margin exceeded the container, collapsing Recharts' plot area to zero and rendering every bar invisible. Added `clampCategoryBarRightMargin()` (bounds `margin.right` against `containerWidth`, reserving a 40px minimum plot width) and `truncateLabelForWidth()` (ellipsis-shrinks the label when the clamp fires) to `chartData.ts`, and wired both into `CategoryBars.tsx`.

## What Was Built

**Task 1 — `clampCategoryBarRightMargin()` + `truncateLabelForWidth()` pure functions + regression tests** (commit `7eeab4d`)

- Exported the previously-private `CATEGORY_LABEL_MARGIN_PADDING` constant so `CategoryBars.tsx` can compute the label's available pixel budget.
- Added private constants `CATEGORY_BAR_LEFT_MARGIN = 8` (mirrors `CategoryBars.tsx`'s hardcoded `margin.left`) and `MIN_CATEGORY_BAR_PLOT_WIDTH = 40` (`// ponytail:` tagged fixed floor, not measured — revisit if live QA shows a sliver at this width).
- Added `export function clampCategoryBarRightMargin(rightMargin, containerWidth)`: returns `rightMargin` unchanged when `containerWidth <= 0` (ResizeObserver hasn't fired yet); otherwise `Math.min(rightMargin, Math.max(containerWidth - CATEGORY_BAR_LEFT_MARGIN - MIN_CATEGORY_BAR_PLOT_WIDTH, 0))`. JSDoc cites Recharts' `selectChartOffsetInternal.js` zero-clamp formula by file/line.
- Added `export function truncateLabelForWidth(label, maxWidthPx, fontSize)`: returns `"…"` at `maxWidthPx <= 0`, the label unchanged when `estimateChipWidth()` already fits, otherwise slices to `Math.floor(maxWidthPx / (fontSize * CHIP_CHAR_WIDTH_FACTOR)) - 1` characters plus an appended ellipsis.
- Added both to `chartData.test.ts`'s named imports and two new `describe` blocks directly after `categoryBarRightMargin`'s: `clampCategoryBarRightMargin` (4 cases — the real 343px/383px-margin scenario asserting a `toBe(40)` non-zero plot width via Recharts' own offset formula, the wide-container no-op case, the `containerWidth === 0` pass-through, and the never-negative floor) and `truncateLabelForWidth` (3 cases — unchanged-when-fits, the exact truncated string at the 279px clamped-budget-minus-padding scenario, and the never-empty `0`px-budget case).

**Task 2 — Wire `CategoryBars.tsx` to clamp the margin and truncate the label** (commit `cb877a0`)

- Added `CATEGORY_LABEL_MARGIN_PADDING`, `clampCategoryBarRightMargin`, `truncateLabelForWidth` to the `chartData` import.
- Renamed `rightMargin` to `rawRightMargin` (round 1's unclamped `categoryBarRightMargin()` output), then derived `rightMargin = clampCategoryBarRightMargin(rawRightMargin, containerWidth)` and `labelMaxWidth = rightMargin - CATEGORY_LABEL_MARGIN_PADDING`.
- `barLabel`'s rendered text now reads `truncateLabelForWidth(row.label, labelMaxWidth, labelFontSize)` instead of the raw `row.label`.
- Extended the doc comment to describe the round-2 fix and cite `16-VERIFICATION.md`.

## Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 558/558 tests pass (39 files), including Task 1's 7 new cases (4 clamp + 3 truncate); round 1's 4 existing `categoryBarRightMargin` cases unchanged and still passing
- `npm run lint` (oxlint) — clean
- All plan acceptance-criteria greps confirmed: `export const CATEGORY_LABEL_MARGIN_PADDING` (1), `export function clampCategoryBarRightMargin` (1), `export function truncateLabelForWidth` (1), `describe("clampCategoryBarRightMargin"` (1), `describe("truncateLabelForWidth"` (1), old unclamped `const rightMargin = categoryBarRightMargin(rows, labelFontSize)` (0, fully replaced), `const rawRightMargin = ...` (1), `clampCategoryBarRightMargin(rawRightMargin, containerWidth)` (1), `truncateLabelForWidth(row.label, labelMaxWidth, labelFontSize)` (1)

**Deferred to human/live verification (documented, not blocking, same pattern as Plan 04):** Task 2's `<verify><human-check>` calls for opening the BP Categories chart in a real browser at ~320-414px and >=480px viewports to confirm bars stay visibly non-zero-width and the longest label either renders in full or truncates legibly with a trailing "…". jsdom's `ResizeObserver` stub never fires in this worktree (`containerWidth` stays 0 in every automated test), so the clamp and truncation logic can only be exercised with real text layout in a live browser — no browser-automation tooling was available here to perform that check. The underlying clamp/truncate math is locked by Task 1's exact-value regression tests recreating Recharts' own offset formula at the real 343px scenario, which is the strongest verification available at the code level; the live-viewport spot-check should be picked up in the phase's human-verify pass.

## Deviations from Plan

None — plan executed exactly as written. `npm ci` was run in the worktree to restore the frontend's `node_modules` (missing because worktrees don't carry gitignored install artifacts) — not a new package install, no `package.json`/`package-lock.json` change.

## Self-Check: PASSED

- FOUND: frontend/src/lib/chartData.ts (clampCategoryBarRightMargin/truncateLabelForWidth exports confirmed via grep)
- FOUND: frontend/src/lib/chartData.test.ts (clampCategoryBarRightMargin/truncateLabelForWidth describe blocks confirmed via grep)
- FOUND: frontend/src/components/charts/CategoryBars.tsx (clamp/truncate wiring confirmed via grep)
- FOUND: commit 7eeab4d (Task 1)
- FOUND: commit cb877a0 (Task 2)
