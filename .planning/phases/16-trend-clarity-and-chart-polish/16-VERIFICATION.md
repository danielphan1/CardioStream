---
phase: 16-trend-clarity-and-chart-polish
verified: 2026-09-18T10:15:00Z
status: gaps_found
score: 11/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/13
  gaps_closed:
    - "The narrowly-scoped CR-01 defect (static margin.right of 160px/300px covering only ~half of what the longest D-10 label needs) is genuinely fixed: categoryBarRightMargin(rows, fontSize) now derives margin.right from Math.max(estimateChipWidth(row.label, fontSize)) + 16px padding across the actual rendered label set, confirmed by exact-value regression tests (383px @16px, 429px @18px) and by independent re-derivation against the real 132-reading production dataset."
  gaps_remaining:
    - "The same observable truth ('CategoryBars' longest label renders in full, not clipped, on a narrow container') still fails — via a NEW mechanism the 16-04 fix introduced and 16-REVIEW.md's WR-04 under-characterized as a future/hypothetical concern. It is reproducible TODAY with the real production dataset at the exact 375px viewport the plan's own human-check task names."
  regressions: []
gaps:
  - truth: "On a narrow (<480px) chart container, CategoryBars' longest label renders in full, not clipped or truncated, and the bars themselves remain visible"
    status: failed
    reason: "categoryBarRightMargin() correctly sizes margin.right to cover the longest label's estimated width (this part of CR-01 IS fixed), but nothing bounds that margin against the container's actual available width. Traced Recharts' own shipped source (node_modules/recharts/es6/state/selectors/selectChartOffsetInternal.js): offsetWidth = Math.max(chartWidth - offset.left - offset.right, 0) — the plot area is HARD-CLAMPED to 0 the moment margin.left + margin.right >= containerWidth. When that clamp fires, selectXAxisRange collapses to a degenerate single-point range ([offset.left, offset.left], e.g. [8,8]), so every Bar renders at x=offset.left with width=0 (all six category bars become literally invisible, zero-width) and the D-10 label text starts at x=offset.left+8 with only (containerWidth - offset.left - 8) px of room before the SVG's default overflow:hidden clips it — far less than the label's own estimated width. Verified this is not hypothetical: queried the real backend/dev.db (132 readings), computed the real BP-category distribution, and the real longest current label is 'Hypertensive Crisis — 7 readings (5%)' (37 chars) — exactly the fixture chartData.test.ts now locks. categoryBarRightMargin(rows, 16) = 383 (confirmed by the passing test). App.tsx's <main> applies px-4 (16px/side) below the md breakpoint, so CategoryBars' measured containerWidth at a 375px viewport (iPhone SE — the exact device Task 2's own <human-check> instructs testers to use) is ~343px. margin.left(8) + margin.right(383) = 391 > 343 -> offsetWidth clamps to 0 -> collapse fires. The safe threshold is containerWidth > 391 (viewport > ~423px) — below essentially every common phone width (iPhone SE/6/7/8/12-mini 375, iPhone XR/11 414, most Android 360-412)."
    artifacts:
      - path: "frontend/src/lib/chartData.ts"
        issue: "categoryBarRightMargin() has no ceiling relative to the container width it will be used against — it only knows about the label set, never about containerWidth, so it can (and today does, at common phone widths with real data) request more margin than the container has room for."
      - path: "frontend/src/components/charts/CategoryBars.tsx"
        issue: "rightMargin = categoryBarRightMargin(rows, labelFontSize) is passed straight into <BarChart margin={{ right: rightMargin, ... }}> with no clamp against containerWidth, even though containerWidth is already available in this component (used for the narrow/labelFontSize branch one line above)."
    missing:
      - "Clamp rightMargin against containerWidth (e.g. Math.min(rightMargin, containerWidth * K) for some safe fraction K), and when clamped, shrink/truncate/ellipsize the label so it still fits in the reduced space instead of silently exceeding it — 16-REVIEW.md's WR-04 already proposes this exact fix, just under-scoped it as a future concern rather than a reproducible-today one."
      - "A regression test that exercises the interaction between categoryBarRightMargin's output and a realistic narrow containerWidth (e.g. assert margin.left + categoryBarRightMargin(rows, 16) < 375 - 32 for the real longest-label fixture), not just the margin function's arithmetic in isolation — the current 4 tests only check the function against itself, never against a container width."
      - "Live-browser confirmation at 320-414px (iPhone SE class) is now MORE urgent than before the 16-04 fix, since the previous static-160px version at least never made the plot area negative (160+8=168 threshold, essentially never hit) — the new version reopens a bar-collapse failure mode the old code didn't have, at exactly the viewport width this project's own plan names."
deferred: []
human_verification:
  - test: "Open the dashboard's BP Categories chart at a ~375px viewport width (browser devtools device toolbar, iPhone SE) against the real dataset."
    expected: "All six category bars render with visible, non-zero width, and the longest label ('Hypertensive Crisis — 7 readings (5%)' or whatever the current longest real label is) renders in full without clipping at the right edge."
    why_human: "jsdom's ResizeObserver stub never fires (containerWidth stays 0), so the narrow branch can only be exercised live. This verifier's static trace of Recharts' own selectChartOffsetInternal.js predicts the bars will collapse to zero width and the label will clip at this exact viewport with today's real data — a live screenshot would confirm or (less likely, if real glyph metrics diverge enough from the estimate) refute the precise clipping claim, though the zero-width-bar collapse itself follows from pure arithmetic (margin.left + margin.right vs containerWidth) independent of font metrics."
  - test: "Open the dashboard's AM/PM comparison chart at a ~375px viewport width."
    expected: "The two panels sit with a visibly tighter (16px) gap and neither panel's bar value labels are clipped at their edges."
    why_human: "Same jsdom/ResizeObserver limitation. No code changed here since the last verification; no defect found by static analysis (labels are short 2-3 char numbers centered on individual bars, not a long string reserved in a fixed side margin, so this component isn't exposed to the same Recharts offset-collapse mechanism found in CategoryBars). Still deferred to end-of-phase per human_verify_mode: end-of-phase — never executed in either verification pass."
---

# Phase 16: Trend Clarity and Chart Polish Verification Report

**Phase Goal:** Chris can see which *direction* his health is moving, not just where each reading landed. No new chart types — this improves what already exists.
**Verified:** 2026-09-18T10:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — after 16-04 gap-closure plan targeting the single BLOCKER from the prior VERIFICATION.md run (CR-01, CategoryBars margin too small).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `rollingAverage()` returns `undefined` for every index before a full 7-reading window exists (D-02) | ✓ VERIFIED (regression check) | Unchanged by 16-04; `chartData.ts:90-101`; `chartData.test.ts` Case A still passes; full suite re-run 551/551 green |
| 2 | `rollingAverage()` is count-based, indifferent to time gaps between readings (D-01) | ✓ VERIFIED (regression check) | Unchanged by 16-04; implementation still loops over array indices only |
| 3 | Same `rollingAverage()` correctly averages whichever key it's called with (D-03) | ✓ VERIFIED (regression check) | Unchanged; generic `key` param confirmed |
| 4 | The 0.85 raw-line dimming opacity clears the WCAG 1.4.11 3:1 floor, both themes, both backgrounds, all 3 series | ✓ VERIFIED (regression check) | `contrast.test.ts` untouched by 16-04, still 12/12 passing |
| 5 | On a narrow (<480px) container, CategoryBars' longest label renders in full, never clipped, and the bars remain visible | ✗ FAILED (new mechanism) | `categoryBarRightMargin()` correctly fixes the original CR-01 arithmetic (margin now covers the label estimate), but is unbounded against `containerWidth`. Traced Recharts' shipped `selectChartOffsetInternal.js`: plot width clamps to `Math.max(chartWidth - offset.left - offset.right, 0)`. With today's real production data (queried `backend/dev.db`, 132 readings, longest label "Hypertensive Crisis — 7 readings (5%)", margin.right=383px) and the real page padding (`App.tsx`'s `<main>` `px-4` = 16px/side), a 375px viewport (iPhone SE — the exact device named in 16-04's own `<human-check>`) yields `containerWidth≈343px`. `8 + 383 = 391 > 343` → plot area clamps to 0 → all six bars render zero-width (invisible) and the label starts at `x≈16` with only ~327px of room for a label that needs ~367px → clips. See gaps below. |
| 6 | On a narrow (<480px) container, AmPmComparison's panels reclaim space via smaller gap instead of clipping | ? UNCERTAIN (unchanged) | No code touched since last verification; still no live-browser confirmation executed |
| 7 | Neither readability fix uses `window.innerWidth` or a CSS media query — both use `useElementWidth` | ✓ VERIFIED (regression check) | `grep` for `window.innerWidth`/`@media`/`matchMedia` in both files still returns zero matches |
| 8 | When ≥7 readings plotted, each visible series draws a bold 4px trend line over a dimmed 2px/0.85-opacity raw line | ✓ VERIFIED (regression check) | `CombinedTimeline.tsx` untouched by 16-04; tests still pass |
| 9 | When <7 readings plotted, no trend line drawn, raw lines render exactly as before Phase 16 | ✓ VERIFIED (regression check) | `hasTrend` gate unchanged; 19 pre-existing assertions still pass |
| 10 | Pulse trend line keeps its dashed stroke pattern | ✓ VERIFIED (regression check) | `strokeDasharray="9 5"` unchanged |
| 11 | End-of-line label pill moves from raw line to trend line once a trend line exists, never both | ✓ VERIFIED (regression check) | Unchanged; test still passes |
| 12 | Clicking any point still opens the tooltip showing that reading's real values | ✓ VERIFIED (regression check) | Unchanged; `reading` object still carried through `trendPoints` |
| 13 | A visible 18px caption states trend status and the exact reading count when <7 | ✓ VERIFIED (regression check) | Unchanged; both caption-variant tests pass |

**Score:** 11/13 truths verified (1 failed — new mechanism, same underlying truth as before; 1 uncertain — see gaps and human verification below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/chartData.ts` | `rollingAverage()` exported pure function | ✓ VERIFIED (regression) | Unchanged content, still exact signature match |
| `frontend/src/lib/chartData.ts` | `categoryBarRightMargin(rows, fontSize)` — new for 16-04, derives margin from `estimateChipWidth()` over the label set | ✓ VERIFIED (exists, substantive, wired) | Lines 179-201: `CATEGORY_LABEL_MARGIN_PADDING = 16`, `export function categoryBarRightMargin(...)` returns `Math.max(...rows.map(r => estimateChipWidth(r.label, fontSize))) + CATEGORY_LABEL_MARGIN_PADDING`, `0` for empty rows — matches plan exactly |
| `frontend/src/lib/chartData.test.ts` | `describe("categoryBarRightMargin", ...)` regression block, 4 cases | ✓ VERIFIED | Lines 237-269; exact-value (383/429), invariant, and empty-degenerate cases all present and passing |
| `frontend/src/components/charts/CategoryBars.tsx` | `margin.right` sourced from `categoryBarRightMargin(rows, labelFontSize)` instead of static `narrow ? 160 : 300` | ⚠️ WIRED but still defective (new mechanism) | `grep -c "right: narrow ? 160 : 300"` = 0 (old guess fully removed, confirmed); `grep -c "categoryBarRightMargin(rows, labelFontSize)"` = 1 — wiring itself is correct and matches the plan's literal must-have, but the computed value is unbounded against `containerWidth` (see Truth 5 / gaps) |
| `frontend/src/tests/contrast.test.ts` | 12-value dimmed-line contrast regression block | ✓ VERIFIED (regression) | Untouched by 16-04, still passing |
| `frontend/src/components/charts/AmPmComparison.tsx` | Responsive gap (gap-8→gap-4) below 480px | ✓ VERIFIED (regression) | Untouched by 16-04 |
| `frontend/src/components/charts/CombinedTimeline.tsx` | Trend `<Line>` elements, conditional dimming, caption, flex-col layout | ✓ VERIFIED (regression) | Untouched by 16-04 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `CategoryBars.tsx` | `chartData.ts categoryBarRightMargin` | `const rightMargin = categoryBarRightMargin(rows, labelFontSize);` | ✓ WIRED | Line 52, confirmed by direct read |
| `chartData.ts categoryBarRightMargin` | `chartData.ts estimateChipWidth` | `Math.max(...rows.map((r) => estimateChipWidth(r.label, fontSize)))` | ✓ WIRED | Line 198, confirmed |
| `chartData.ts rollingAverage` | `CombinedTimeline.tsx` | `import { rollingAverage } ...` | ✓ WIRED (regression) | Unchanged from prior verification |
| `CategoryBars.tsx` | `useElementWidth.ts` | `const { ref, width: containerWidth } = useElementWidth<HTMLDivElement>()` | ✓ WIRED | Line 49, unchanged |
| `AmPmComparison.tsx` | `useElementWidth.ts` | same | ✓ WIRED (regression) | Unchanged |
| **Missing link:** `CategoryBars.tsx` `rightMargin` | `containerWidth` (same component, same scope) | *none* | ✗ NOT_WIRED | `rightMargin` and `containerWidth` are both in scope at line 49-52 of `CategoryBars.tsx` but `rightMargin` is never clamped against `containerWidth` before being passed to `<BarChart margin={{ right: rightMargin }}>` — this is the root cause of the Truth 5 gap |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CategoryBars.tsx` `rightMargin` | `categoryBarRightMargin(rows, labelFontSize)` | Real `rows` from `categoryBarData(stats)`, real backend `/stats/summary` | Yes | ✓ FLOWING, but ⚠️ HOLLOW GEOMETRY — the value flows correctly but is never checked against the `containerWidth` variable already in scope one line above it, so the geometry it produces is invalid at common real container widths (see Truth 5) |
| `CombinedTimeline.tsx` trend lines | `systolicTrend`/`diastolicTrend`/`pulseTrend` | `rollingAverage(points, key)` | Yes | ✓ FLOWING (regression, unchanged) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full frontend test suite | `cd frontend && npx vitest run` | 551/551 tests passing, 39/39 files | ✓ PASS |
| Type-check | `cd frontend && npx tsc --noEmit` | Zero errors | ✓ PASS |
| `categoryBarRightMargin` regression cases | `npx vitest run src/lib/chartData.test.ts` | 4/4 new cases pass (383@16px, 429@18px, invariant, empty) | ✓ PASS |
| Independent re-derivation of margin math against real production data | Queried `backend/dev.db` (132 readings) with the project's own `derivations.py` classification rules via a one-off Python script; longest real label = "Hypertensive Crisis — 7 readings (5%)" (37 chars) | `estimateChipWidth(label,16)=367`, `categoryBarRightMargin=383` — matches the codebase's own test fixture exactly | ✓ CONFIRMS the CR-01 arithmetic fix is correct in isolation |
| Independent trace of Recharts' own offset/scale-collapse behavior at realistic narrow viewport | Read `node_modules/recharts/es6/state/selectors/selectChartOffsetInternal.js` and `selectXAxisRange` in `axisSelectors.js`; computed `containerWidth` from `App.tsx`'s real `px-4` page padding at a 375px viewport | `offsetWidth = Math.max(343-8-383, 0) = 0` → x-scale range collapses to `[8,8]` → all bars zero-width, label starts at x≈16 with only ~327px of room vs. its ~367px need | ✗ FAIL — confirms a new, currently-live defect (see Truth 5 / gaps) |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared or conventional for this phase; this is a frontend chart-polish phase, not a migration/tooling phase.

### Requirements Coverage

`.planning/REQUIREMENTS.md` does not exist in this repo (confirmed — the project is between milestones; per the prior verification's note and `ROADMAP.md`, Phase 16's decision IDs (`16-CONTEXT.md`) are the requirement source of record for this phase). The task brief's cited "Client-driven request (2026-09-13), 'better data visuals'" is the `ROADMAP.md` Phase 16 entry's own `**Requirements**:` line, not a `REQUIREMENTS.md` row — there is no separate file to cross-reference.

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| D-01 | 16-01 | Count-based rolling window, not calendar-day | ✓ SATISFIED (regression) | Unchanged |
| D-02 | 16-01, 16-03 | No partial-window averaging; trend line starts only at full window | ✓ SATISFIED (regression) | Unchanged |
| D-03 | 16-01, 16-03 | All three series get a trend line, respecting showBP/showPulse | ✓ SATISFIED (regression) | Unchanged |
| D-04 | 16-01, 16-03 | Trend line is bold/foreground; raw lines dim, contrast-verified | ✓ SATISFIED (regression) | Unchanged |
| D-05 | 16-03 | Trend line reuses each series' existing color token | ✓ SATISFIED (regression) | Unchanged |
| D-06 | 16-02, 16-04 | Readability pass on CombinedTimeline/CategoryBars/AmPmComparison | ✗ BLOCKED (partial, same requirement, new mechanism) | AmPmComparison and CombinedTimeline readability fixes are sound (regression-confirmed). CategoryBars' fix closes the narrow CR-01 arithmetic gap but is unbounded against `containerWidth`, reproducing a chart-breaking defect (zero-width bars + likely label clipping) at common real phone widths with today's real data — the core readability defect D-06 exists to close remains open for this chart's primary content |

No orphaned requirement IDs: all decision IDs D-01 through D-06 named in `16-CONTEXT.md` are claimed by at least one plan's `requirements:` frontmatter (16-04 explicitly re-claims D-06 as `gap_closure: true`), and all are addressed above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `chartData.ts` / `CategoryBars.tsx` | `chartData.ts:192-201`, `CategoryBars.tsx:52,93` | `categoryBarRightMargin()`'s output is never clamped against `containerWidth` before use (16-REVIEW.md's WR-04, re-confirmed and sharpened by this verifier with real production data + Recharts source trace — this verifier finds it reproducible TODAY at common phone widths, not just at hypothetical future data volumes as WR-04's own framing implies) | 🛑 Blocker | The chart's bars collapse to zero width and the primary D-10 label content likely clips again, at the exact 375px viewport this phase's own plan names for human verification |
| `CombinedTimeline.tsx` | 163-200, 249 | End-label collision math mutates a closed-over array during render (WR-01, `16-REVIEW.md`, unchanged by 16-04) | ⚠️ Warning | Dev-only (`<StrictMode>`) mispositioning of end-label pills; production unaffected |
| `contrast.test.ts` | 56-63, 157-178 | Dimmed-line hex literals hand-computed, decoupled from the `0.85` opacity constant (WR-02, unchanged) | ⚠️ Warning | Future opacity change wouldn't be caught by this test |
| `chartData.ts` / `CombinedTimeline.tsx` | 207 / 147 | `END_LABEL_HEIGHT` defined twice, no shared source of truth (WR-03, unchanged) | ⚠️ Warning | Drift risk |
| `chartData.ts` | 161-177 (doc comment) | `estimateChipWidth`'s calibration is documented for bold 14px chip text but reused by `categoryBarRightMargin` for CategoryBars' regular-weight 16-18px labels (WR-05, `16-REVIEW.md`, unchanged since re-review) | ⚠️ Warning | Currently safe (regular-weight glyphs are narrower than the bold-calibrated estimate), but incidental, not verified, and not the root cause of the Truth 5 gap (that gap is pure geometry/arithmetic, independent of glyph metrics) |
| `AmPmComparison.tsx` | 95-104 | `withLabels` param always `true`; doc-commented "Mini" mode doesn't exist (IN-01, pre-existing, unchanged) | ℹ️ Info | Longstanding, predates Phase 16 |

No `TBD`/`FIXME`/`XXX` debt markers found in any file this phase (16-01 through 16-04) modified.

### Human Verification Required

### 1. CategoryBars bar visibility and label clipping at narrow viewport (post-16-04-fix)

**Test:** Open the dashboard's BP Categories chart at a ~375px viewport width (browser devtools device toolbar, iPhone SE) against the real dataset.
**Expected:** All six category bars render with visible, non-zero width, and the longest label renders in full without clipping.
**Why human:** jsdom's `ResizeObserver` stub never fires, so `containerWidth` stays 0 in any automated test. This verifier's static trace of Recharts' own shipped selector code predicts the bars will collapse to zero width and the label will very likely still clip at this exact viewport with today's real data (see Gaps) — a live screenshot is the final confirmation, though the zero-width-bar collapse itself follows from pure arithmetic independent of what a screenshot shows.

### 2. AmPmComparison panel gap and label legibility at narrow viewport

**Test:** Open the dashboard's AM/PM comparison chart at a ~375px viewport width.
**Expected:** The two panels sit with a visibly tighter (16px) gap and neither panel's bar value labels are clipped at their edges.
**Why human:** Same jsdom/`ResizeObserver` limitation. No code changed here since the last verification; no defect found by static analysis. Still deferred to end-of-phase per `human_verify_mode: end-of-phase` — never executed in either verification pass.

## Gaps Summary

**16-04 made genuine, verifiable progress and should not be read as a no-op.** The specific arithmetic CR-01 identified — a static `margin.right` (160px/300px) covering roughly half of what the longest D-10 label needs — is fixed. `categoryBarRightMargin()` correctly derives the margin from the actual rendered label set via the existing `estimateChipWidth()` helper, is unit-tested with exact-value assertions that match this verifier's own independent re-derivation against the real 132-reading production dataset, and the old static guess is fully removed (confirmed by `grep`). The full 551/551 test suite and `tsc --noEmit` remain green, and no file outside the plan's declared scope was touched (`git show --stat` on both commits confirms).

**One BLOCKER remains, via a different and more severe mechanism than CR-01.** `categoryBarRightMargin()`'s output is never bounded against the container's actual available width. This verifier traced Recharts' own shipped selector source (`node_modules/recharts/es6/state/selectors/selectChartOffsetInternal.js`): the plot area is hard-clamped to `Math.max(chartWidth - offset.left - offset.right, 0)`, and the moment `margin.left + margin.right >= containerWidth`, the x-axis scale range collapses to a single point — every bar renders with zero width (all six category bars become invisible) and the label text starts near the container's left edge with far less room than it needs, very likely clipping again. Using the real `backend/dev.db` (132 readings) and the project's own classification rules, the real current longest label is "Hypertensive Crisis — 7 readings (5%)" — the exact fixture the new tests lock — which computes `margin.right=383px`. Combined with `App.tsx`'s real `px-4` page padding, a 375px viewport (iPhone SE — the exact device 16-04's own `<human-check>` instructs testers to use) yields a `containerWidth` of ~343px, well under the ~391px threshold needed to avoid the collapse. This is not a hypothetical future-data-volume concern (as `16-REVIEW.md`'s WR-04 framed it, citing a hypothetical 300-reading category) — it reproduces today, with today's real data, at one of the most common phone screen widths in use.

**This is a real, currently-reproducible regression exposed by the fix, not a scope/wording disagreement — no override applies.** Recommended path: a second small closure plan against `CategoryBars.tsx`/`chartData.ts` that clamps `rightMargin` to a safe fraction of `containerWidth` (both values are already in scope in the same component) and, when clamped, shrinks or truncates the label rather than silently requesting more space than exists — `16-REVIEW.md`'s WR-04 already sketches this fix; it simply needs to be treated as the phase's remaining blocker rather than a deferred warning. A regression test should assert the interaction (margin + containerWidth), not just the margin function in isolation, and live-browser confirmation at 320-414px is now more important than before this fix, since the prior static-160px version never triggered this particular collapse.

---

_Verified: 2026-09-18T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
