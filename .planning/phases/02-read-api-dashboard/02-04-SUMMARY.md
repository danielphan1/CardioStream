---
phase: 02-read-api-dashboard
plan: 04
subsystem: frontend-charts
tags: [recharts, charts, dash-01, dash-05, d-09, accessibility]
requires:
  - phase: 02-read-api-dashboard
    plan: 02
    provides: "frontend scaffold, api/types.ts (Reading/StatsSummary), index.css theme tokens"
  - phase: 02-read-api-dashboard
    plan: 03
    provides: "lib/dates.ts formatters (fmtShortDate/fmtTooltipTitle), lib/palette.ts categoryColor/CHIP_TEXT"
provides:
  - "BPTimeline: dual-line timeline, 6 AHA ReferenceArea bands BEFORE lines, time-scale x-axis, fixed [40,220] domain, line-end Systolic/Diastolic labels"
  - "PulseTrend: pulse line + dashed 60 bpm bradycardia ReferenceLine, fixed [30,120] domain"
  - "CategoryBars: vertical-layout clinical-order bars with D-10 count+percent labels outside bars"
  - "AmPmComparison: dual-panel AM/PM grouped bars (BP [40,220] / pulse [30,120]) via client groupAmPm"
  - "ChartTooltip: click-persistent large-text tooltip, ≥48px Close + Escape dismiss, palette-keyed category chip"
  - "lib/chartData.ts: toTimePoints, groupAmPm, categoryBarData, formatCategoryLabel, prefersReducedMotion (pure, tested)"
affects: [02-07]
tech-stack:
  added: []
  patterns:
    - "All chart math in pure lib/chartData.ts (Recharts renders 0×0 in jsdom — Pitfall 2); components only lay out JSX"
    - "hero/mini variant prop: hero = accessibilityLayer + click tooltip + axes/labels; mini = accessibilityLayer={false}, no Tooltip, axes hidden (Pitfall 8)"
    - "Bands/lines colored ONLY via var(--...) CSS tokens — zero hex literals in chart files, themes flip for free"
    - "Tooltip dismissal: local dismissed state — chart click/arrow-key resets, Close/Escape sets (Pitfall 6 → D-09 UX)"
key-files:
  created:
    - frontend/src/lib/chartData.ts
    - frontend/src/lib/chartData.test.ts
    - frontend/src/components/charts/ChartTooltip.tsx
    - frontend/src/components/charts/BPTimeline.tsx
    - frontend/src/components/charts/PulseTrend.tsx
    - frontend/src/components/charts/CategoryBars.tsx
    - frontend/src/components/charts/AmPmComparison.tsx
  modified:
    - frontend/src/index.css
decisions:
  - "Band opacity via .chart-band class rule (fill-opacity: var(--band-opacity)) — a class wins over the SVG presentation attribute and resolves the theme-dependent var (0.10 light / 0.14 dark)"
  - "Line-end labels (D-07/A4) via per-Line LabelList custom content that draws only at the final index, with margin.right=96 for label room"
  - "Arrow-key tooltip re-show handled on a wrapper div's onKeyDown (Recharts 3 LineChart does not accept onKeyDown); keydown bubbles from the focusable accessibilityLayer chart"
  - "CategoryBars and AmPmComparison ship no Tooltip: their values are fully text-labeled on/next to the bars (D-10 labels ARE the values; AmPm bars carry AM/PM + rounded value text), and ChartTooltip requires a single Reading which aggregate bars don't have"
  - "ChartTooltip takes pulseFirst prop so PulseTrend leads with its primary series row while sharing one component"
metrics:
  duration: 13min
  tasks: 3
  files: 8
  completed: 2026-07-17
---

# Phase 02 Plan 04: Chart Components Summary

All four Recharts chart components (BP Timeline with six AHA bands behind the lines, Pulse Trend with the 60 bpm bradycardia line, clinical-order Category Bars, dual-panel AM vs PM) plus a click-persistent ≥48px-Close tooltip and a fully-tested pure data-shaping lib — fixed clinical axes, palette-var colors only, hero/mini variants ready for 02-07's ChartDeck.

## What Was Built

- **`lib/chartData.ts`** (TDD, 16 tests): `toTimePoints` (epoch-ms local-time points preserving API order — DATA-05), `groupAmPm` (present-periods-only 1-decimal averages — A2), `categoryBarData` + `formatCategoryLabel` (exact D-10 strings: "Stage 1 — 34 readings (26%)", singular "1 reading", zero-count "Hypotension — 0 readings (0%)"), `prefersReducedMotion` (matchMedia guard for jsdom). No React/Recharts imports.
- **`ChartTooltip.tsx`**: Recharts custom `content` — `fmtTooltipTitle` title (20px bold), "BP 128 / 74" + "Pulse 58" rows at 18px (order flips via `pulseFirst`), display-only category chip (`categoryColor` background, `CHIP_TEXT` text, 20px), notes as plain text node when present, `min-h-12 min-w-12` accent Close button, Escape keydown listener while visible. All content is React text nodes (T-02-08); chip colors come from the closed palette map, never response-string-interpolated styles.
- **`BPTimeline.tsx`**: six `<ReferenceArea>` bands (40–90–120–130–140–180–220 systolic thresholds) rendered BEFORE the two `<Line>`s (Recharts 3 z-order = JSX order), `className="chart-band"` + hero-only 14px edge labels in the category's solid color (decorative tint — explicitly exempt from contrast floors, rationale in code comment), time-scale numeric XAxis with `fmtShortDate` ticks, fixed YAxis [40,220] with AHA-threshold ticks, strokeWidth 3 lines with `dot r=5` / `activeDot r=10`, D-07 line-end "Systolic"/"Diastolic" SVG text labels at the last point (20px bold, line's own var color), hero `<Tooltip trigger="click">` with dismissed-state wiring.
- **`PulseTrend.tsx`**: pulse line in systolic navy (single-series reuse per UI-SPEC), dashed `6 4` ReferenceLine at y=60 labeled "60 bpm — Bradycardia" (16px, insideBottomRight), fixed domain [30,120] ticks [30,60,90,120], same time axis/tooltip/mini rules.
- **`CategoryBars.tsx`**: `layout="vertical"` BarChart over `categoryBarData(stats)` (six zero-filled clinical-order rows always), per-row `<Cell fill={categoryColor(...)}>`, D-10 full label outside the bar end in ink at 18px via LabelList custom content (300px right margin reserves label room), XAxis `[0,"dataMax"]` integer ticks, hidden category YAxis. No Tooltip by design — the labels are the values.
- **`AmPmComparison.tsx`**: two side-by-side BarCharts (flex row, equal widths) because BP and pulse have different locked domains — left "Blood pressure (mmHg)" [40,220], right "Pulse (bpm)" [30,120]. AM bars `var(--line-systolic)`, PM bars `var(--line-diastolic)`, disambiguated by direct "AM"/"PM" text above bars + rounded values on bars (never color alone). Bars render from the domain floor by design (D-05 positional consistency, noted in code). Renders 1-row (single-period) and 0-row data without errors (A2). Mini = single simplified BP chart.
- **`index.css`**: one appended rule — `.chart-band { fill-opacity: var(--band-opacity); }`.

## Verification

- `npm test -- --run` — 5 files, 41 tests passed (16 new chartData tests)
- `npm run build` — exit 0 (tsc -b + vite build)
- BPTimeline: exactly 6 `<ReferenceArea` (first at line 115, before first `<Line` at 185 — source-order gate), contains `domain={[40, 220]}`, `scale="time"`, `trigger="click"`, both line vars
- ChartTooltip: contains `Escape` and `min-h-12`; zero `dangerouslySetInnerHTML` occurrences
- PulseTrend: `y={60}`, `strokeDasharray="6 4"`, `domain={[30, 120]}`, "60 bpm — Bradycardia"
- CategoryBars: `layout="vertical"`, `categoryBarData`, `categoryColor`, `<Cell>`
- AmPmComparison: `groupAmPm`, `[40, 220]`, `[30, 120]`
- Zero `#` hex color literals across all five chart files
- Visual rendering (band stacking, time-axis proportional spacing per A3, line-end label placement per A4, tooltip behavior) verifies at the plan 02-07 human checkpoint — jsdom cannot render Recharts (Pitfall 2)

## TDD Gate Compliance

Task 1 followed RED → GREEN:
- RED: `test(02-04)` e933271 (failing — module absent)
- GREEN: `feat(02-04)` 020361d (16 tests pass)

No refactor commit needed — implementation was minimal on first pass.

## Deviations from Plan

**1. [Rule 3 - Blocking] Moved arrow-key handler off LineChart onto a wrapper div**
- **Found during:** Task 2
- **Issue:** Recharts 3 `LineChart` props don't include `onKeyDown` — `tsc -b` failed
- **Fix:** Wrapper `<div className="h-full w-full" onKeyDown={...}>` around ResponsiveContainer; keydown bubbles up from the focusable accessibilityLayer chart, preserving the D-09 arrow-key re-show behavior
- **Files modified:** frontend/src/components/charts/BPTimeline.tsx (pattern replicated in PulseTrend.tsx)
- **Commit:** 72ef6e0

**2. [Rule 1 - Bug] Removed unused `@ts-expect-error` in chartData.test.ts**
- **Found during:** Task 2 (first `tsc -b` run — vitest doesn't type-check, so RED/GREEN passed with it)
- **Issue:** TS2578 unused directive broke the build; the matchMedia-restore branch it guarded was unnecessary
- **Fix:** Simplified restore to a single `window.matchMedia = original` assignment
- **Files modified:** frontend/src/lib/chartData.test.ts
- **Commit:** 72ef6e0

**3. [Minor] ChartTooltip doc comment reworded to avoid the forbidden-API literal**
- **Found during:** Task 2 verification
- **Issue:** The T-02-08 comment originally named the forbidden React prop verbatim, which would trip the acceptance-criteria grep ("no dangerouslySetInnerHTML")
- **Fix:** Reworded to "raw-HTML injection props are forbidden"; grep count is now 0
- **Commit:** 72ef6e0

## Known Stubs

None — all five components consume real `api/types.ts` shapes through `lib/chartData.ts`/`lib/palette.ts`/`lib/dates.ts`; no mock data, placeholder text, or unwired props. The components are intentionally presentational (props in, JSX out) — 02-07's ChartDeck supplies data from the query hooks and the fixed-height parents.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. T-02-08 mitigated as planned (text-node-only rendering, closed palette map); T-02-SC respected (zero new packages, `npm ci` from the committed lockfile only).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | e933271 | test(02-04): add failing tests for chart data-shaping lib |
| 1 (GREEN) | 020361d | feat(02-04): implement chart data-shaping lib (16 tests green) |
| 2 | 72ef6e0 | feat(02-04): add ChartTooltip and BPTimeline with AHA bands |
| 3 | cdaa4a0 | feat(02-04): add PulseTrend, CategoryBars, AmPmComparison charts |

## Notes for 02-07 (ChartDeck)

- Parents MUST supply fixed heights (hero `h-[420px]`, mini `h-36`) — charts use `ResponsiveContainer width="100%" height="100%"` (Pitfall 2)
- Mini variants already disable accessibilityLayer/Tooltip/axes; 02-07 supplies the wrapping `<button>` and `pointer-events: none` on the inner SVG
- `CategoryBars` takes `stats: StatsSummary`; the other three take `readings: Reading[]`
- Verify visually at the checkpoint: band z-order, time-axis gap proportionality (A3), line-end label placement (A4), CategoryBars label fit at narrow widths

## Self-Check: PASSED

All 7 created files + index.css modification exist on disk; all 4 task commits (e933271, 020361d, 72ef6e0, cdaa4a0) present in git log.
