---
phase: 16-trend-clarity-and-chart-polish
verified: 2026-09-18T08:48:19Z
status: gaps_found
score: 11/13 must-haves verified
overrides_applied: 0
gaps:
  - truth: "On a narrow (<480px) chart container, CategoryBars' longest label ('Hypertensive Crisis — NN readings (NN%)') still renders in full, not clipped or truncated, because the reserved right margin and label font shrink together"
    status: failed
    reason: "16-REVIEW.md's CR-01 finding, independently re-derived by this verifier using the codebase's own estimateChipWidth() text-width heuristic: the longest real D-10 label (e.g. 'Hypertensive Crisis — 6 readings (5%)', 37 chars) needs ~367px at the narrow 16px font but CategoryBars.tsx only reserves margin.right: 160px below 480px container width (~207px short — the reserved margin covers under half of what's needed). The wide-mode 300px margin is also short of the ~413px the 18px font needs. Embedded Recharts SVGs default to overflow:hidden (no override in index.css), so text past plot-width + margin.right is invisible, not just cramped — the chart's entire primary content (per this component's own doc comment: 'the labels ARE the values') clips exactly at the breakpoint this fix exists to support. No component test exists for CategoryBars.tsx, so nothing currently guards this."
    artifacts:
      - path: "frontend/src/components/charts/CategoryBars.tsx"
        issue: "margin.right (narrow: 160, wide: 300) and fontSize (narrow: 16, wide: 18) both shrink together as designed, but the absolute reserved-margin values are roughly half of what the actual label text requires at either breakpoint — labels clip rather than render in full."
    missing:
      - "Derive margin.right from the actual rendered label set instead of a static guess, e.g. Math.max(...rows.map(r => estimateChipWidth(r.label, labelFontSize))) + padding, reusing the estimateChipWidth() helper already exported from lib/chartData.ts"
      - "Add a regression test (component test or a chartData.test.ts-level assertion) that locks the computed margin to cover the longest formatted label at both breakpoints"
      - "Verify once in a real browser at 320–414px width — jsdom does no real text layout, so this class of bug is invisible to the existing automated suite"
deferred: []
human_verification:
  - test: "Open the dashboard's BP Categories chart at a ~375px viewport width (browser devtools device toolbar) once the CategoryBars margin gap above is fixed."
    expected: "The full 'Hypertensive Crisis — NN readings (NN%)' label renders without clipping and bars remain visibly wider than a sliver."
    why_human: "jsdom's ResizeObserver stub never fires, so containerWidth stays 0 in any automated test — the narrow branch only exercises live in a real browser with real text layout."
  - test: "Open the dashboard's AM/PM comparison chart at a ~375px viewport width."
    expected: "The two panels sit with a visibly tighter (16px) gap and neither panel's bar value labels are clipped at their edges."
    why_human: "Same jsdom/ResizeObserver limitation as above. No defect was found by code review or by this verifier's independent estimate for this component (its labels are short 2-3 char numbers centered on individual bars, not a long string reserved in a fixed margin like CategoryBars), but the plan's own human-check task for this was never executed — deferred to end-of-phase per human_verify_mode: end-of-phase."
---

# Phase 16: Trend Clarity and Chart Polish Verification Report

**Phase Goal:** Chris can see which *direction* his health is moving, not just where each reading landed. No new chart types — this improves what already exists.
**Verified:** 2026-09-18T08:48:19Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `rollingAverage()` returns `undefined` for every index before a full 7-reading window exists (D-02) | ✓ VERIFIED | `chartData.ts:83-99` implements exactly `i < window - 1 → undefined`; `chartData.test.ts` Case A (6 readings, all `undefined`) passes |
| 2 | `rollingAverage()` is count-based, indifferent to time gaps between readings (D-01) | ✓ VERIFIED | Implementation loops over array indices only, never reads `ts`; Case D test (wildly uneven datetimes, same result) passes |
| 3 | Same `rollingAverage()` correctly averages whichever key it's called with (D-03) | ✓ VERIFIED | `key` is a generic parameter read inside the loop (`points[j][key]`); Case F (diastolic) test passes |
| 4 | The 0.85 raw-line dimming opacity clears the WCAG 1.4.11 3:1 floor, both themes, both backgrounds, all 3 series | ✓ VERIFIED | 12 new assertions in `contrast.test.ts` pass; hex literals independently re-derived by this verifier from `round(fg*0.85 + bg*0.15)` per channel and confirmed to match exactly (e.g. `#1E3A5F` over `#F5F7F6` → `#3E5676` ✓) |
| 5 | On a narrow (<480px) container, CategoryBars' longest label renders in full, never clipped | ✗ FAILED | `16-REVIEW.md` CR-01, independently re-derived: label needs ~367-397px (narrow) but only 160px is reserved — see gaps below |
| 6 | On a narrow (<480px) container, AmPmComparison's panels reclaim space via smaller gap instead of clipping | ? UNCERTAIN | Code changes present and match plan intent; no defect found by code review or by this verifier's estimate, but the live-viewport check was never executed (jsdom can't test it) |
| 7 | Neither readability fix uses `window.innerWidth` or a CSS media query — both use `useElementWidth` | ✓ VERIFIED | `grep` for `window.innerWidth`/`@media`/`matchMedia` in both files returns zero matches; both call `useElementWidth<HTMLDivElement>()` |
| 8 | When ≥7 readings plotted, each visible series draws a bold 4px trend line over a dimmed 2px/0.85-opacity raw line | ✓ VERIFIED | `CombinedTimeline.tsx:361-469`; `CombinedTimeline.test.tsx` "draws 6 lines" + "dims the raw lines" tests pass |
| 9 | When <7 readings plotted, no trend line drawn, raw lines render exactly as before Phase 16 | ✓ VERIFIED | `hasTrend` gate confirmed to make all Phase-16 branches no-ops for the original 4-point `READINGS` fixture; all 19 pre-existing assertions in `CombinedTimeline.test.tsx` are byte-for-byte unmodified (`git diff` confirms pure-addition diff) and still pass |
| 10 | Pulse trend line keeps its dashed stroke pattern | ✓ VERIFIED | `CombinedTimeline.tsx:460` `strokeDasharray="9 5"` on the trend `<Line>`; test asserts `lines(container)[5]` dasharray `"9 5"` |
| 11 | End-of-line label pill moves from raw line to trend line once a trend line exists, never both | ✓ VERIFIED | Raw lines wrap `LabelList` in `{!hasTrend && (...)}`, trend lines always render their `LabelList` when mounted (which is itself `hasTrend`-gated); "never duplicates the end-label pill" test (exactly 3 `rect`s with 6 lines mounted) passes |
| 12 | Clicking any point still opens the tooltip showing that reading's real values | ✓ VERIFIED | `trendPoints` is `{...p, ...trend fields}` — every point (raw and trend `<Line>`s share the same `trendPoints` data array) still carries the full `reading` object; `ChartTooltip.tsx` reads `payload?.[0]?.payload?.reading` unchanged |
| 13 | A visible 18px caption states trend status and the exact reading count when <7 | ✓ VERIFIED | `CombinedTimeline.tsx:264-268`; tests assert both caption variants ("Bold lines show..." and "you have 4 here") |

**Score:** 11/13 truths verified (1 failed, 1 uncertain — see gaps and human verification below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/chartData.ts` | `rollingAverage()` exported pure function | ✓ VERIFIED | Exact signature match, reuses `round1()`, JSDoc cites D-01/D-02 |
| `frontend/src/lib/chartData.test.ts` | `describe("rollingAverage", ...)` with 6 cases | ✓ VERIFIED | 6 `it` blocks (A-F) present and passing |
| `frontend/src/tests/contrast.test.ts` | 12-value dimmed-line contrast regression block | ✓ VERIFIED | `DIMMED_LINE_PAIRS` + 2 `describe` blocks, 12 assertions passing |
| `frontend/src/components/charts/CategoryBars.tsx` | Responsive right margin (300→160) and label font (18→16) below 480px | ⚠️ WIRED but defective | `useElementWidth` correctly wired; the chosen margin values do not actually prevent clipping (see gap) |
| `frontend/src/components/charts/AmPmComparison.tsx` | Responsive gap (gap-8→gap-4) below 480px | ✓ VERIFIED | `useElementWidth` wired, `narrow` branch on className confirmed |
| `frontend/src/components/charts/CombinedTimeline.tsx` | Trend `<Line>` elements, conditional dimming, caption, flex-col layout | ✓ VERIFIED | All present, `rollingAverage` imported and called |
| `frontend/src/components/charts/CombinedTimeline.test.tsx` | Trend-line rendering assertions, zero regressions | ✓ VERIFIED | 6 new tests pass; pre-existing tests unmodified (`git diff` confirms pure addition) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `chartData.ts rollingAverage` | `CombinedTimeline.tsx` | `import { rollingAverage } ...` | ✓ WIRED | `gsd-sdk verify.key-links` reported a false negative (path-resolution quirk treating the descriptive "from" text as a literal path); manually confirmed via `grep -n "rollingAverage(points" CombinedTimeline.tsx` — 3 call sites (systolic/diastolic/pulse) |
| `CombinedTimeline.tsx` trend `<Line>` | `trendPoints` merged data | `dataKey="systolicTrend"` etc. | ✓ WIRED | Confirmed by direct code read: `trendPoints` built from `rollingAverage()` output and passed as `<LineChart data={trendPoints}>` |
| `CategoryBars.tsx` | `useElementWidth.ts` | `const { ref, width: containerWidth } = useElementWidth<HTMLDivElement>()` | ✓ WIRED | `gsd-sdk verify.key-links` confirmed |
| `AmPmComparison.tsx` | `useElementWidth.ts` | same | ✓ WIRED | `gsd-sdk verify.key-links` confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CombinedTimeline.tsx` trend lines | `systolicTrend`/`diastolicTrend`/`pulseTrend` | `rollingAverage(points, key)` computed from `toTimePoints(readings)`, `readings` = component prop from live `/readings` fetch upstream | Yes | ✓ FLOWING |
| `CategoryBars.tsx` narrow branch | `containerWidth` | `useElementWidth` (ResizeObserver on live DOM) | Yes (in a real browser; stubbed to 0 in jsdom, by design) | ✓ FLOWING (untestable in jsdom, not a stub) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full frontend test suite (all 3 plans' changes together) | `cd frontend && npx vitest run` | 547/547 tests passing, 39/39 files | ✓ PASS |
| Type-check | `cd frontend && npx tsc --noEmit` | Zero errors | ✓ PASS |
| Phase-specific test files | `npx vitest run src/lib/chartData.test.ts src/tests/contrast.test.ts src/components/charts/CombinedTimeline.test.tsx` | 99/99 passing | ✓ PASS |
| CategoryBars narrow-margin math | Manual re-derivation of `estimateChipWidth()` against real D-10 label strings (node script) | 367-397px needed vs. 160px reserved at narrow breakpoint | ✗ FAIL (confirms CR-01) |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared or conventional for this phase; this is a frontend chart-polish phase, not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| D-01 | 16-01 | Count-based rolling window, not calendar-day | ✓ SATISFIED | `rollingAverage()` loops over array indices, ignores `ts` |
| D-02 | 16-01, 16-03 | No partial-window averaging; trend line starts only at full window / `hasTrend` gate | ✓ SATISFIED | Both `rollingAverage()`'s `undefined` prefix and `hasTrend = points.length >= 7` gate confirmed |
| D-03 | 16-01, 16-03 | All three series (systolic/diastolic/pulse) get a trend line, respecting showBP/showPulse | ✓ SATISFIED | Trend `<Line>`s gated on `showBP &&`/`showPulse &&` in addition to `hasTrend` |
| D-04 | 16-01, 16-03 | Trend line is bold/foreground; raw lines dim to supporting role; 0.85 opacity contrast-verified | ✓ SATISFIED | `strokeWidth`/`strokeOpacity` split confirmed in code + tests; contrast regression passes |
| D-05 | 16-03 | Trend line reuses each series' existing color token, no new hue | ✓ SATISFIED | `stroke="var(--line-systolic)"` etc. on trend lines, identical to raw lines |
| D-06 | 16-02 | Readability pass on CombinedTimeline/CategoryBars/AmPmComparison | ✗ BLOCKED (partial) | AmPmComparison fix is sound; CombinedTimeline's caption/layout wrap (in 16-03) is sound; **CategoryBars' fix does not actually prevent the clipping it claims to fix** (CR-01) — the core readability defect this decision exists to close remains open for the chart's primary content |

No orphaned requirement IDs: all decision IDs D-01 through D-06 named in `16-CONTEXT.md` are claimed by at least one plan's `requirements:` frontmatter, and all are addressed above (this project is between milestones — no active `REQUIREMENTS.md`; `16-CONTEXT.md`'s decision IDs are the requirement source of record per `ROADMAP.md`'s own note).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CategoryBars.tsx` | 46, 69, 85 | Under-provisioned responsive margin (CR-01, from `16-REVIEW.md`, independently confirmed) | 🛑 Blocker | Primary chart content (D-10 labels) clips on real mobile viewports — the exact regression this plan exists to fix |
| `CombinedTimeline.tsx` | 163-200, 249 | End-label collision math mutates a closed-over array during render (WR-01, `16-REVIEW.md`) | ⚠️ Warning | Dev-only (`<StrictMode>` in `main.tsx`) mispositioning of end-label pills by `END_LABEL_HEIGHT` (20px); production builds strip `StrictMode` double-invoke so shipped users are unaffected, but `npm run dev` — the tool this phase's own human-check tasks instruct testers to use — shows incorrect pill positions |
| `contrast.test.ts` | 56-63, 157-178 | Dimmed-line hex literals are hand-computed, decoupled from the actual `0.85` opacity constant in `CombinedTimeline.tsx` (WR-02) | ⚠️ Warning | A future opacity change would not be caught by this regression test despite its stated purpose |
| `chartData.ts` / `CombinedTimeline.tsx` | 183 / 147 | `END_LABEL_HEIGHT` defined twice with no shared source of truth (WR-03) | ⚠️ Warning | Drift risk if either definition changes independently |
| `CombinedTimeline.tsx` | 366-367, 384-385, 406-407 | Repeated magic numbers (`strokeWidth`/`strokeOpacity` ternaries copy-pasted 3x) | ℹ️ Info | Maintainability only |
| Multiple chart files | various | In-chart text sits at 14-16px, below CLAUDE.md's stated "≥18px body fonts" floor (IN-02) | ℹ️ Info | Longstanding, multi-phase pattern predating this phase; flagged for a scoped exception note in UI-SPEC/DESIGN docs, not a new regression |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the 7 files this phase modified.

### Human Verification Required

### 1. CategoryBars label clipping at narrow viewport (post-fix)

**Test:** Once the CategoryBars margin gap (see Gaps below) is closed, open the dashboard's BP Categories chart at a ~375px viewport width (browser devtools device toolbar).
**Expected:** The full "Hypertensive Crisis — NN readings (NN%)" label renders without clipping and the bars remain visibly wider than a sliver.
**Why human:** jsdom's `ResizeObserver` stub never fires, so `containerWidth` stays 0 in any automated test — the narrow branch (and any fix to it) only exercises live in a real browser with real text layout.

### 2. AmPmComparison panel gap and label legibility at narrow viewport

**Test:** Open the dashboard's AM/PM comparison chart at a ~375px viewport width.
**Expected:** The two panels sit with a visibly tighter (16px) gap and neither panel's bar value labels are clipped at their edges.
**Why human:** Same jsdom/`ResizeObserver` limitation. No defect was found by code review or by this verifier's independent estimate (labels here are short 2-3 character numbers centered on individual bars, structurally lower risk than CategoryBars' long strings reserved in a fixed side margin), but the plan's own human-check task for this was never executed and is deferred to end-of-phase per `human_verify_mode: end-of-phase` in `.planning/config.json`.

## Gaps Summary

One BLOCKER: **CategoryBars' narrow-viewport fix (D-06, Plan 16-02) does not achieve its stated goal.** The plan's own must-have — "the longest label still renders in full, not clipped or truncated" — is demonstrably false using the codebase's own text-width estimator (`estimateChipWidth`, already exported from `lib/chartData.ts` and used elsewhere in this same phase for an analogous purpose). The reserved right margin (160px narrow / 300px wide) covers roughly half of what the actual D-10 label text needs (~367-397px narrow / ~413-446px wide). This was independently found by the phase's own code review (`16-REVIEW.md` CR-01, filed 2026-09-18T08:35Z) and has not been fixed since — no commit after the review touches `CategoryBars.tsx`. Since Recharts renders into a plain `<svg>` with the default UA `overflow: hidden`, this is a functional defect (invisible text), not a cosmetic one, and it defeats this component's stated sole purpose ("the labels ARE the values").

Everything else — the phase's actual payload (rolling-average trend lines on `CombinedTimeline`, D-01 through D-05) — is solid: implementation matches the plan/UI-SPEC exactly, is fully unit-tested (99 phase-specific tests + 547/547 full-suite passing, zero regressions to the 19 pre-existing `CombinedTimeline` assertions), the WCAG contrast math for the dimmed raw lines checks out byte-for-byte, and the tooltip/click-to-inspect path is provably unaffected since trend and raw lines share one underlying data array that still carries the full `reading` object.

Three warning-level code-review findings (StrictMode-only mispositioning of end-label pills, contrast-test/opacity-constant decoupling, duplicate `END_LABEL_HEIGHT` constant) do not block the phase goal — they are dev-experience/maintainability risks the reviewer already scoped fixes for, not functional failures in what ships.

**This is a real regression, not a scope/wording disagreement — no override applies.** Recommended path: a small closure plan against `CategoryBars.tsx` following `16-REVIEW.md`'s own suggested fix (derive `margin.right` from `estimateChipWidth()` over the actual label set, add a regression test, and confirm once in a real ~375px browser).

---

_Verified: 2026-09-18T08:48:19Z_
_Verifier: Claude (gsd-verifier)_
