---
phase: 16-trend-clarity-and-chart-polish
reviewed: 2026-09-18T09:30:38Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - frontend/src/lib/chartData.ts
  - frontend/src/lib/chartData.test.ts
  - frontend/src/tests/contrast.test.ts
  - frontend/src/components/charts/CategoryBars.tsx
  - frontend/src/components/charts/AmPmComparison.tsx
  - frontend/src/components/charts/CombinedTimeline.tsx
  - frontend/src/components/charts/CombinedTimeline.test.tsx
findings:
  critical: 0
  warning: 5
  info: 1
  total: 6
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-09-18T09:30:38Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This is a re-review after the 16-04 gap-closure plan. Verified the prior
CR-01 finding against the current code by hand: `categoryBarRightMargin()`
computes `margin.right` as `max(estimateChipWidth(label, fontSize) for all
rows) + 16px`, and since every bar's rendered `x + width` is bounded above
by the plot's right edge (`containerWidth - margin.right`, because the
`XAxis` domain is `[0, "dataMax"]` and no bar's value can exceed
`dataMax`), the algebra holds for every row, not just the longest-labeled
one: `label_width + 8 <= margin.right` is guaranteed for all six bars.
**CR-01 is genuinely resolved** — the static 160/300px guess is gone and
the label clipping bug it caused cannot recur from the same value set.

Re-assessing the three carried-forward warnings against current code (not
just accepting the prior review's word for it):
- **WR-01** (StrictMode double-fire in `makeEndLabel`) — confirmed still
  present; confirmed `<StrictMode>` is actually enabled in `main.tsx`;
  confirmed via `recharts` source that `LabelList`'s `content` function is
  invoked through `createElement`, i.e. as a real reconciled component, so
  it is subject to React 18's dev-only double-invoke.
- **WR-02** (contrast.test.ts fixture decoupling) — confirmed still
  present; spot-verified the current hardcoded "Dimmed" hex values against
  a manual 0.85-alpha blend of the real `--line-*` and `--color-deck/mist`
  tokens and they are numerically correct *today*, which is exactly what
  makes the decoupling dangerous — the test can't tell a stale value from
  a fresh one.
- **WR-03** (duplicate `END_LABEL_HEIGHT`) — confirmed still present,
  unchanged.

Reviewing the fix itself (not just re-confirming it closed CR-01) surfaced
two new, related risks the fix introduces or inherits, plus one
pre-existing dead-code item in a file in scope. Details below.

## Warnings

### WR-01: `makeEndLabel` mutates a captured array during render (StrictMode double-invoke risk)

**File:** `frontend/src/components/charts/CombinedTimeline.tsx:163-200` (push at line 172), array created at line 249
**Issue:** `endLabelYs` is a plain array created fresh per `CombinedTimeline` render and closed over by every `makeEndLabel(...)` call. The returned `EndLabel` component pushes into it as a side effect *during render*. `recharts`' `LabelList`/`Label` implementation renders a function `content` prop via `createElement(content, propsForContent)` (`node_modules/recharts/es6/component/Label.js:285`), so `EndLabel` is a real reconciled component, not a plain function call — it is therefore subject to React 18 `<StrictMode>`'s dev-only double-invocation of component render bodies. `main.tsx` does wrap the app in `<StrictMode>`. Within one double-invoked pass, the *same* series' `EndLabel` pushes twice into the shared array; `resolveLabelY` sees its own first push as a "placed" collision on the second call and bumps itself down unnecessarily, and every later series then collides against that phantom duplicate too. This only fires in `npm run dev` (StrictMode's extra render pass is stripped entirely from production builds), so Chris never sees it, but it will make local visual QA of label placement unreliable and confusing for anyone testing this component in dev mode.
**Fix:** Use a ref instead of a plain closed-over array (`useRef<number[]>([]).current`, reset once per render via a `useMemo`/render-start assignment), or compute all three labels' positions in one pass before rendering (e.g. a `useMemo` that maps `[systolic, diastolic, pulse]` end-Ys through `resolveLabelY` up front) rather than mutating shared state from inside each label's own render function.

### WR-02: `contrast.test.ts` dimmed-line fixtures are hand-computed, not derived from source

**File:** `frontend/src/tests/contrast.test.ts:20-25,40-45,56-63`
**Issue:** `lineSystolicDimmedVsDeck` etc. are hardcoded hex literals meant to represent `--line-systolic` (etc.) at 0.85 opacity over `--color-deck`/`--color-mist`. Nothing in the test computes this blend from the real `--line-*`/`--color-deck`/`--color-mist` tokens in `index.css` or from the `0.85` literal in `CombinedTimeline.tsx:367,385,407`. Verified the current six values are numerically correct today (manual alpha-blend check matches to the byte), but that's precisely the risk: if either the base line color, the background token, or the `0.85` opacity constant changes, this "regression guard" silently goes stale and keeps passing/failing on the old math instead of the new rendered color — the opposite of what a regression test is for.
**Fix:** Derive the six dimmed values in the test itself from the existing `LIGHT`/`DARK` base tokens and a shared `DIMMED_OPACITY = 0.85` constant (simple sRGB alpha blend: `round(fg*a + bg*(1-a))` per channel), rather than hand-computing and pasting in the results. That also lets the same constant be imported by (or asserted equal to) the `0.85` used in `CombinedTimeline.tsx`, closing the loop between the two files.

### WR-03: `END_LABEL_HEIGHT` is defined twice and must be kept in sync by hand

**File:** `frontend/src/lib/chartData.ts:207` vs `frontend/src/components/charts/CombinedTimeline.tsx:147`
**Issue:** `chartData.ts` hardcodes `const END_LABEL_HEIGHT = 20;` for `resolveLabelY`'s collision math, while `CombinedTimeline.tsx` derives its own `const END_LABEL_HEIGHT = CHIP_FONT_SIZE + CHIP_PAD_Y * 2;` (also 20) for actual chip sizing. They currently agree only because both were hand-updated to 20; nothing enforces it. If `CHIP_FONT_SIZE` or `CHIP_PAD_Y` changes in `CombinedTimeline.tsx` (e.g. a font-size tweak), `resolveLabelY`'s collision threshold in `chartData.ts` silently goes out of sync with the actual pill height it's supposed to protect, and pills could start visually overlapping again with no test failure (the `chartData.test.ts` tests for `resolveLabelY` hardcode `GAP = 20` independently too, so they wouldn't catch the drift either).
**Fix:** Pass the height into `resolveLabelY(y, placed, height)` as a parameter, with `CombinedTimeline.tsx` supplying its own `END_LABEL_HEIGHT` and `chartData.ts` only providing a default for callers/tests that don't care about the exact value. That removes the second hardcoded copy without re-triggering the oxlint `only-export-components` issue the current comment says motivated keeping the constant in `chartData.ts`.

### WR-04: `categoryBarRightMargin` has no ceiling — can consume the whole container on narrow viewports

**File:** `frontend/src/lib/chartData.ts:192-201`, `frontend/src/components/charts/CategoryBars.tsx:49-52`
**Issue:** The CR-01 fix correctly sizes `margin.right` to the longest label, but does not bound it against `containerWidth`. `estimateChipWidth`/`categoryBarRightMargin` grow with the numeric count and percent digits in the label text (`"Stage 2 — 300 readings (40%)"`), so as Chris's dataset accumulates — the app already targets a single user tracking since early 2025 with no upper bound on readings-per-category — the required margin grows without limit while the container does not. Concretely: on a 375px-wide phone card (`narrow` breakpoint, `labelFontSize=16`), a row like `"Stage 2 — 300 readings (40%)"` computes to `margin.right ≈ 294px`, and `"Hypertensive Crisis — 50 readings (7%)"` computes to `≈ 393px` — both larger than the entire available card width, leaving the bar plot area zero-width or negative. `CategoryBars` has no `min-width` on its wrapping div and `ChartDeck.tsx` applies none either, so there is nothing preventing this. This doesn't crash, but it silently defeats the very fix CR-01 shipped: labels stop clipping only by squeezing the bars themselves out of existence.
**Fix:** Clamp `rightMargin` (e.g. `Math.min(rightMargin, containerWidth * 0.6)`) and, once clamped, either shrink the label font further, truncate the label (e.g. drop the parenthetical percent below some width), or let the label wrap/ellipsize — pick one, but bound the margin so it can never exceed a safe fraction of the measured container width.

### WR-05: `estimateChipWidth`'s calibration is documented for bold chip text, silently reused for regular-weight labels

**File:** `frontend/src/lib/chartData.ts:161-177` (doc comment + `CHIP_CHAR_WIDTH_FACTOR`), `frontend/src/components/charts/CategoryBars.tsx:51-52,74-83`
**Issue:** `CHIP_CHAR_WIDTH_FACTOR`'s doc comment explicitly says it's calibrated "for the bold 14px Inter band-label chip text" used by `CombinedTimeline.tsx`'s `makeBandLabelChip`/`makeEndLabel` (both render `fontWeight={600}`). `categoryBarRightMargin` (the CR-01 fix) reuses the exact same function/constant to estimate the width of `CategoryBars.tsx`'s D-10 labels, which render with **no `fontWeight`** (default/normal weight) at 16-18px (`barLabel`, line 74-83). Regular-weight glyphs are narrower than bold glyphs at the same font-size, so today this happens to be safe (the estimate over-provisions space rather than under-provisioning it) — but that safety margin is incidental, not verified anywhere, and nothing ties the two use sites together. If `CHIP_CHAR_WIDTH_FACTOR` is ever retuned for its documented purpose (e.g. tightened because `CombinedTimeline`'s bold chips look too wide), that same change silently shrinks `CategoryBars`' margin too, for a lighter-weight font where the estimate is already closer to reality — reopening the exact CR-01 clipping bug this phase just closed, with no test anywhere that would catch the regression (the `categoryBarRightMargin` tests in `chartData.test.ts:237-269` only check the function's *internal* arithmetic against itself, not against `CategoryBars`' actual rendered font weight).
**Fix:** At minimum, add a comment on `categoryBarRightMargin` (or on `CHIP_CHAR_WIDTH_FACTOR`) flagging that it is shared across a bold 14px context and a regular 16-18px context, so a future retune checks both. Better: give `CategoryBars` its own width-estimation constant calibrated for its actual (unbolded) font weight, decoupling the two call sites entirely.

## Info

### IN-01: `AmPmComparison`'s `withLabels` parameter is always `true`; the file's own "Mini" mode doesn't exist

**File:** `frontend/src/components/charts/AmPmComparison.tsx:95-104` (`amBar`/`pmBar`), call sites at lines 129-130 and 156-157
**Issue:** `amBar`/`pmBar` take a `withLabels: boolean` parameter, but all four call sites pass `true` — the `false` branch is dead code. This traces back to the component's own header comment (line 17): `"Mini: single simplified BP chart only (no labels/axes/second panel)."` No `mini` prop exists on `AmPmComparisonProps`, and the component's only caller (`ChartDeck.tsx:122`) never passes one — this "Mini" mode is pre-existing (predates Phase 16, traced back to commit `cdaa4a0`) but is still present in this file today and was not addressed by the gap-closure plan. The doc comment describes a feature that isn't implemented, and the dead parameter is a leftover of that unfinished feature.
**Fix:** Either wire up the promised `mini` mode (accept a `mini?: boolean` prop, gate the second panel/axes/labels on it, use it to drive `withLabels`) or delete the "Mini" doc-comment line and collapse `amBar`/`pmBar` to drop the now-pointless `withLabels` parameter.

---

_Reviewed: 2026-09-18T09:30:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
