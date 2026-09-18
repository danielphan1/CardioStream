# Phase 16: Trend Clarity and Chart Polish - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 7 (all modifications to existing files — no brand-new files this phase)
**Analogs found:** 7 / 7 (every analog is same-file or same-directory precedent — this is a polish phase on 3 already-mature components)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/lib/chartData.ts` (add `rollingAverage()`) | utility | transform | same file — `toTimePoints`/`groupAmPm` | exact (self, sibling function) |
| `frontend/src/lib/chartData.test.ts` (add rolling-average tests) | test | transform | same file — `groupAmPm`/`resolveLabelY` describe blocks | exact (self, sibling suite) |
| `frontend/src/components/charts/CombinedTimeline.tsx` (trend `<Line>`s, caption, layout wrap) | component (chart) | render/transform | same file — existing raw `<Line>` + `makeEndLabel`; `AmPmComparison.tsx` for the `min-h-0 flex-1` wrap | exact (self) + role-match (layout) |
| `frontend/src/components/charts/CombinedTimeline.test.tsx` (update line-count assertions for new trend lines) | test | render | same file — `lines()` query helper, `it.each` axis/series blocks | exact (self) |
| `frontend/src/components/charts/CategoryBars.tsx` (responsive right margin) | component (chart) | render | `CombinedTimeline.tsx` — `useElementWidth` usage | role-match (cross-file hook reuse) |
| `frontend/src/components/charts/AmPmComparison.tsx` (responsive gap) | component (chart) | render | `CombinedTimeline.tsx` — `useElementWidth` usage; same file's own existing `min-h-0 flex-1` panels | role-match + exact (self, for layout) |
| `frontend/src/tests/contrast.test.ts` (blended-opacity regression block) | test | transform | same file — `VITALS_LINES` / `it.each` pattern | exact (self) |

**Note on "no brand-new files":** every file in this phase's scope already exists (confirmed via `find`/`Read`: `chartData.test.ts`, `CombinedTimeline.test.tsx`, `contrast.test.ts` all present). The planner should treat all 7 as modifications, not creations — the strongest possible analog is always "this file's own established pattern, extended."

---

## Pattern Assignments

### `frontend/src/lib/chartData.ts` (utility, transform)

**Analog:** same file, `groupAmPm` (lines 65-79) and `toTimePoints` (lines 45-53) — the established "pure function next to the types it consumes, JSDoc explaining WHY not just what" pattern.

**Imports** (lines 13, whole-file — NO React/Recharts, confirmed by file header lines 1-12):
```typescript
import type { BPCategory, Reading, StatsSummary } from "../api/types";
```
`rollingAverage` needs no new import — it operates on `TimePoint[]` (already defined in this file, lines 16-22) and a key of `"systolic" | "diastolic" | "pulse"`.

**Core transform pattern to extend** (`groupAmPm`, lines 65-79 — filter/reduce/round idiom):
```typescript
export function groupAmPm(readings: Reading[]): AmPmRow[] {
  const rows: AmPmRow[] = [];
  for (const period of ["AM", "PM"] as const) {
    const subset = readings.filter((r) => r.am_pm === period);
    if (subset.length === 0) continue;
    const n = subset.length;
    rows.push({
      period,
      systolic: round1(subset.reduce((sum, r) => sum + r.systolic, 0) / n),
      ...
    });
  }
  return rows;
}
```
`rollingAverage(points, key, window = 7)` should follow this same shape: a loop producing one output per input index, `undefined` (not `0` or `NaN`) for indices before a full window exists (D-02) — mirrors this function's `if (subset.length === 0) continue` instinct of "no data → skip/omit, don't fabricate a value." Existing `round1()` helper (lines 55-57) is directly reusable for the averaged output.

**JSDoc convention to match** (e.g. lines 40-44, 109-119, 124-136 — every exported function states *why*, referencing the CONTEXT/decision that motivated it):
```typescript
/**
 * Client-side AM vs PM aggregation (DASH-04 — ≤132 rows, trivial). Returns
 * rows ONLY for periods present in the input (Assumption A2: ...
 */
```
`rollingAverage`'s JSDoc should cite D-01/D-02 the same way (count-based window, no partial-window averaging) so a future reader doesn't "fix" the undefined-prefix as a bug.

**No error handling / no validation section** — this file has neither; every function is total (accepts any array, including empty, and returns a same-length or empty-array result without throwing). `rollingAverage` should follow suit: empty input → empty array, no window-size validation beyond the default.

---

### `frontend/src/lib/chartData.test.ts` (test, transform)

**Analog:** same file — `describe("groupAmPm", ...)` (lines 71-114) for the aggregation-behavior style, and `describe("resolveLabelY", ...)` (lines 238-269) for the "edge case per decision" style most relevant to D-01/D-02's gap/partial-window concerns.

**Shared fixture to reuse** (lines 19-35 — do not duplicate):
```typescript
let nextId = 1;
function reading(overrides: Partial<Reading> = {}): Reading {
  return {
    id: nextId++,
    datetime: "2025-06-03T07:42:00",
    systolic: 128,
    diastolic: 74,
    pulse: 58,
    am_pm: "AM",
    bp_category: "Elevated",
    pulse_category: "Bradycardia",
    map: 92.0,
    pulse_pressure: 54,
    notes: null,
    ...overrides,
  };
}
```
Tests for `rollingAverage` should build `TimePoint[]` via `toTimePoints(readings.map(reading))` or construct `TimePoint` literals directly — either way, reuse this `reading()` factory rather than inventing a second one.

**Edge-case enumeration pattern to copy** (`isDotCrowded`, lines 198-218 — one `it` per boundary condition, degenerate cases named explicitly):
```typescript
describe("isDotCrowded", () => {
  it("returns false at generous spacing (1000px / 50 points = 20px/point)", () => { ... });
  it("returns true at the reported mobile case (350px / 130 points ≈ 2.7px/point)", () => { ... });
  it("returns false for a degenerate width of 0", () => { ... });
  it("returns false for a degenerate pointCount of 0", () => { ... });
  it("returns false for a single point (can't overlap itself)", () => { ... });
});
```
UI-SPEC's own enumeration for `rollingAverage` (line 141) maps 1:1 onto this style: exact 7-count window, a gap in the series, fewer than 7 total points (all-undefined), exactly 7 points (single defined value at the last index) — four `it` blocks, same shape as above.

**Import list to extend** (lines 8-17 — alphabetical, single named-import block from `./chartData`):
```typescript
import {
  categoryBarData,
  estimateChipWidth,
  formatCategoryLabel,
  groupAmPm,
  isDotCrowded,
  prefersReducedMotion,
  resolveLabelY,
  toTimePoints,
} from "./chartData";
```
Add `rollingAverage` here, alphabetically, when it's exported.

---

### `frontend/src/components/charts/CombinedTimeline.tsx` (component/chart, render+transform)

**Analog:** same file — the existing raw `<Line>` blocks (lines 324-373) are the direct template for the new trend `<Line>` elements; `AmPmComparison.tsx` (lines 104-159) is the analog for the caption/layout wrap.

**Imports to extend** (lines 36-64 — grouped: react, recharts, then project modules by depth):
```typescript
import { useState } from "react";
import {
  DefaultZIndexes,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

import type { BPCategory, Reading } from "../../api/types";
import {
  estimateChipWidth,
  isDotCrowded,
  prefersReducedMotion,
  resolveLabelY,
  toTimePoints,
} from "../../lib/chartData";
```
Add `rollingAverage` to the `../../lib/chartData` import group (no new import source needed — everything the trend line needs already lives in this file's existing dependency graph).

**Core pattern — raw `<Line>` to clone for the trend line** (systolic shown, lines 324-337; diastolic/pulse follow the identical shape at 339-353 and 354-373):
```typescript
{showBP && (
  <Line
    yAxisId={MMHG}
    dataKey="systolic"
    stroke="var(--line-systolic)"
    strokeWidth={3}
    dot={crowded ? false : { r: 5 }}
    activeDot={{ r: 10 }}
    isAnimationActive={animate}
  >
    <LabelList
      content={makeEndLabel(lastIndex, "Systolic", "var(--line-systolic)", endLabelYs)}
    />
  </Line>
)}
```
Per UI-SPEC's Trend vs. raw contract (D-04/D-05 table), the new trend `<Line>` for the same series is this same block with:
- `strokeWidth={4}` (bold) vs. raw's now-dimmed `strokeWidth={2}` (was 3 — raw line width must also change)
- `strokeOpacity={0.85}` added to the **raw** line only (trend stays full opacity — no `strokeOpacity` prop needed since default is 1)
- `dot={false}` and `activeDot={false}` (no dots — computed average has no discrete reading)
- a second `dataKey` sourced from `rollingAverage(points, "systolic")` merged into the same `points` array (Recharts reads `dataKey` off each datum in `data={points}`, so the trend value must be a sibling field on `TimePoint`, e.g. `points.map((p, i) => ({ ...p, systolicTrend: trendArray[i] }))`, or `rollingAverage` returns pre-merged rows — planner's call)
- `<LabelList content={makeEndLabel(...)}>` **moved** to the trend line's `<LabelList>` when ≥7 points exist, per the D-04/D-05 table's end-label-pill row — the raw line keeps its own `makeEndLabel` call only in the <7-point branch
- JSX position: **after** all three raw `<Line>` blocks (currently ending at line 373), **before** the overlay-marker `.map()` (currently starting at line 376) — matches the documented "Recharts 3 z-order is JSX order" rule already stated in this file's own header (lines 10, 17) and enforced for bands-before-lines

**Dashed-pulse precedent to carry into the pulse trend line** (lines 354-373, comment at 355-358):
```typescript
{showPulse && (
  // Dashed is NOT decoration: pulse/systolic luminance ratio is only
  // ~1.9:1 light and ~1.1:1 dark (see contrast.test.ts), so in
  // greyscale and under colour-vision deficiency the stroke pattern
  // is what separates these two series, not the hue.
  <Line
    yAxisId={BPM}
    dataKey="pulse"
    stroke="var(--line-pulse)"
    strokeWidth={3}
    strokeDasharray="9 5"
    ...
```
UI-SPEC's contract table (row "Dash pattern (pulse only)") locks this: the pulse trend line keeps `strokeDasharray="9 5"` unchanged — do not drop the dash just because the line got bolder.

**Caption + layout wrap — analog is `AmPmComparison.tsx`'s existing `min-h-0 flex-1` pattern** (`AmPmComparison.tsx` lines 104-131, the BP panel half; full file already uses this twice, at 112 and 139):
```typescript
<div className="flex h-full flex-1 flex-col">
  <p
    className="m-0 text-center"
    style={{ fontSize: 20, fontWeight: 600, color: "var(--color-depth)" }}
  >
    Blood pressure (mmHg)
  </p>
  <div className="min-h-0 flex-1">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart ...>
```
UI-SPEC (Copywriting Contract, line 130) directs wrapping `CombinedTimeline.tsx`'s current outer `<div ref={ref} className="h-full w-full">` (line 224-232) as `flex flex-col gap-2`, with the caption as a `shrink-0 <p>` at 18px Body (`--color-depth`, plain paragraph, not `aria-live` per UI-SPEC line 118), and the existing `<ResponsiveContainer>` (line 233) wrapped in a new `min-h-0 flex-1` div — same technique as above, just `flex-col` instead of `flex-row`, and no need for the `flex-1` on the text row (`shrink-0` instead, since the caption's height is fixed content, not a share of remaining space).

**Existing conditional-render idiom to copy for the two caption strings** (UI-SPEC lines 127-128 give exact copy for ≥7 vs. <7 points):
```typescript
// pattern precedent: the `showBP && (...)` / `showPulse && (...)` ternary-free
// boolean-AND JSX gating already used throughout this file (lines 244, 256,
// 298, 324, 339, 354) — the caption should follow the same idiom:
{points.length >= 7 ? (
  <p>Bold lines show a 7-reading rolling average. ...</p>
) : (
  <p>Trend line needs at least 7 readings to show — you have {points.length} here. ...</p>
)}
```

**Error handling** — none in this file (no try/catch; Recharts and the pure lib functions are total). No new error handling needed for the trend line.

---

### `frontend/src/components/charts/CombinedTimeline.test.tsx` (test, render)

**Analog:** same file — this suite already has the exact mocking/query infrastructure the new trend lines need to be tested against; do not write a second recharts-mocking scaffold elsewhere.

**Recharts sizing mock (required for any assertion on rendered SVG structure)** (lines 40-49):
```typescript
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children, { width: 900, height: 420 } as never)
        : children,
  };
});
```

**Line-counting query that WILL need updating** (line 97, used at 154/161/168/187):
```typescript
const lines = (c: HTMLElement) => c.querySelectorAll(".recharts-line-curve");
```
Existing assertions (e.g. line 154: `expect(lines(container)).toHaveLength(3)` for "both vitals on") assume exactly one `<Line>` per series. Once trend lines are added, the same fixture (`READINGS`, lines 75-80, only 4 points — **below** the 7-point trend threshold per D-02) means these specific existing tests should keep passing unchanged only if the trend `<Line>` still mounts as a `recharts-line-curve` element even when every trend value is `undefined`. Recharts typically still renders a `<path>` element for a `<Line>` whose `dataKey` resolves to all-`undefined` (an empty path), which would silently double the count assertions. Planner should either: (a) extend `READINGS` in a new describe block to ≥7 points to test the trend line's actual rendering, or (b) conditionally omit the trend `<Line>` JSX entirely when `points.length < 7` (cleaner — avoids rendering a guaranteed-empty line). Flagging this as the one place existing green tests could go red or silently stop testing what they claim to.

**Stroke/dasharray assertion pattern to extend for the new bold/dim contract** (lines 171-180):
```typescript
it("strokes pulse dashed and in its own colour — the Phase 14 fix", () => {
  const { container } = render(
    <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
  );
  const pulse = lines(container)[0];
  expect(pulse.getAttribute("stroke")).toBe("var(--line-pulse)");
  expect(pulse.getAttribute("stroke-dasharray")).toBe("9 5");
});
```
A new test in this style, on a ≥7-point fixture, should assert the raw line now carries `stroke-width="2"` and `stroke-opacity="0.85"` while the trend line carries `stroke-width="4"` with no opacity attribute (default 1) — same `getAttribute` idiom, new attribute names.

**End-label pill assertion to extend** (lines 234-246, 251-268) — once the pill moves to the trend line's `<LabelList>` for ≥7-point series (per UI-SPEC's contract table), the existing "draws each end label on a solid pill" and "never lets two end-label pills overlap" tests need a ≥7-point fixture to still exercise real behavior; on the current 4-point `READINGS` fixture the pill would (correctly, per spec) stay on the raw line, so those specific tests likely pass unmodified — only a new ≥7-point describe block is additive here, not a rewrite.

---

### `frontend/src/components/charts/CategoryBars.tsx` (component/chart, render)

**Analog:** `CombinedTimeline.tsx`'s `useElementWidth` usage — this hook already exists and is imported nowhere else; `CategoryBars.tsx` currently has zero responsive handling (confirmed: no `useElementWidth` import, no width state).

**Hook import + usage pattern to copy** (`CombinedTimeline.tsx` lines 62, 206):
```typescript
import { useElementWidth } from "../../hooks/useElementWidth";
...
const { ref, width } = useElementWidth<HTMLDivElement>();
```
`CategoryBars.tsx` has no wrapping `<div>` today — its `return` starts directly at `<ResponsiveContainer>` (line 74). Per the `useElementWidth` hook's own contract (`useElementWidth.ts` — measures a DOM node's live rendered width via `ResizeObserver`), `CategoryBars.tsx` needs a new wrapping `<div ref={ref} className="h-full w-full">` around the existing `<ResponsiveContainer>`, mirroring `CombinedTimeline.tsx`'s outer div (lines 224-232, minus the `onKeyDown` handler which doesn't apply here).

**Margin value to make responsive** (current, line 79):
```typescript
margin={{ top: 8, right: 300, bottom: 8, left: 8 }}
```
UI-SPEC's exact contract (lines 150-152): below 480px container width, `right` → 160 and the D-10 label font (line 64: `fontSize={18}`) → 16. Both values are read off `width` from the new hook, e.g. `const narrow = width > 0 && width < 480;` then `right: narrow ? 160 : 300` and `fontSize={narrow ? 16 : 18}` in the `barLabel` glyph function (line 64).

**Existing label glyph function to touch for the font-size change** (lines 48-71, specifically line 64):
```typescript
const barLabel = ({ x, y, width, height, index }: BarLabelGlyphProps) => {
  ...
  return (
    <text
      x={Number(x) + Number(width) + 8}
      y={Number(y) + Number(height) / 2}
      fontSize={18}
      fill="var(--color-depth)"
      dominantBaseline="middle"
    >
      {row.label}
    </text>
  );
};
```
Note the local variable name collision: this glyph function's own destructured `width` param (the bar's pixel width) is a different value from the container's `width` from `useElementWidth` — the planner/implementer must rename one (e.g. keep the hook's value as `containerWidth`) to avoid shadowing.

**Error handling** — none in this file; no change needed.

---

### `frontend/src/components/charts/AmPmComparison.tsx` (component/chart, render)

**Analog:** same file's own two-panel `min-h-0 flex-1` structure (lines 104-159) already solves "fixed-height parent, flexible chart body" — UI-SPEC explicitly says to reuse this rather than invent a new layout technique; `CombinedTimeline.tsx`'s `useElementWidth` usage is the analog for the new responsive-gap logic this file currently lacks entirely.

**Hook import + usage pattern to copy** (`CombinedTimeline.tsx` lines 62, 206 — same as CategoryBars above):
```typescript
import { useElementWidth } from "../../hooks/useElementWidth";
...
const { ref, width } = useElementWidth<HTMLDivElement>();
```

**Gap value to make responsive** (current, line 104):
```typescript
<div className="flex h-full w-full gap-8">
```
UI-SPEC's contract (lines 154-157): below 480px container width, `gap-8` (32px) → `gap-4` (16px), no vertical stacking. Since this is a Tailwind class, not a `margin={}` prop, the responsive swap is a className toggle: `className={\`flex h-full w-full ${narrow ? "gap-4" : "gap-8"}\`}` — this outer `<div>` becomes the new `ref` target for `useElementWidth`, since it's the container whose live width determines "narrow."

**min-h-0 flex-1 pattern already established in this exact file — do not duplicate elsewhere** (lines 105-131, BP panel; lines 132-159, pulse panel, identical shape):
```typescript
<div className="flex h-full flex-1 flex-col">
  <p className="m-0 text-center" style={{ fontSize: 20, fontWeight: 600, color: "var(--color-depth)" }}>
    Blood pressure (mmHg)
  </p>
  <div className="min-h-0 flex-1">
    <ResponsiveContainer width="100%" height="100%">
      ...
    </ResponsiveContainer>
  </div>
</div>
```
This is the exact pattern `CombinedTimeline.tsx`'s new caption wrap (above) should copy — cited here because `AmPmComparison.tsx` is the ORIGINAL source of this idiom in the codebase, not `CombinedTimeline.tsx`.

**Error handling** — none in this file; no change needed.

---

### `frontend/src/tests/contrast.test.ts` (test, transform)

**Analog:** same file — the `VITALS_LINES` block (lines 36-40, 102-132) is the exact template for the new blended-opacity regression block; no new dependency needed (already imports `hex` from `wcag-contrast`, line 5).

**Literal-hex-object pattern to extend** (lines 8-34 — `LIGHT`/`DARK` are plain hex-literal objects, no computed colors anywhere in this file today):
```typescript
const LIGHT = {
  deck: "#F5F7F6",
  mist: "#E3EBE9",
  ...
  lineSystolic: "#1E3A5F",
  lineDiastolic: "#1F7A6C",
  linePulse: "#9E4A24",
};
```
UI-SPEC already did the alpha-blend arithmetic and gives the resulting ratios directly (lines 97-106 of the UI-SPEC: 12 pre-computed values). Since this file's established style is literal hex, not computed blending, the lazy/consistent path is to add the blended hex results as new literal keys (e.g. `lineSystolicBlended85: "#..."`) computed once by the implementer and pasted in — **do not** add a new `blend()`/alpha-mixing utility function to this test file; that would be inventing a computation style this file has never used, for a one-time 12-value table UI-SPEC already resolved as ratios. If exact blended hex literals are needed rather than the ratios alone, compute them with the standard `result = fg*alpha + bg*(1-alpha)` per channel — a throwaway one-off calculation, not a reusable module.

**`it.each` regression-block pattern to copy exactly** (lines 40, 102-116 — this is the direct template for the new block):
```typescript
const VITALS_LINES = ["lineSystolic", "lineDiastolic", "linePulse"] as const;

describe("light theme — vitals line contrast floors", () => {
  it.each(VITALS_LINES)(
    "%s against deck clears non-text UI floor (3:1, WCAG 1.4.11)",
    (token) => {
      expect(hex(LIGHT[token], LIGHT.deck)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(VITALS_LINES)(
    "%s against mist clears non-text UI floor (3:1, WCAG 1.4.11)",
    (token) => {
      expect(hex(LIGHT[token], LIGHT.mist)).toBeGreaterThanOrEqual(3);
    },
  );
});
```
New block: same `VITALS_LINES` array reused against new `LIGHT`/`DARK` blended keys, same `.toBeGreaterThanOrEqual(3)` floor (UI-SPEC confirms all 12 combinations clear 3.3:1+, comfortably above the 3:1 WCAG 1.4.11 non-text floor already enforced elsewhere in this file) — no new assertion style needed.

**Comment style to match** (lines 134-142 — every non-obvious test file addition in this file explains WHY, referencing the phase/regression it guards):
```typescript
// The Phase 14 regression guard. Before this phase PulseTrend.tsx stroked the
// pulse line with var(--line-systolic) — harmless while the two charts were
// mutually exclusive, invisible-by-collision the moment they share one chart.
```
The new block's comment should name Phase 16 and D-04's 0.85 raw-line dimming as the reason this block exists (per UI-SPEC line 108: "confirm existing tokens still pass contrast at whatever opacity D-04's dimming lands on").

---

## Shared Patterns

### CSS custom-property color tokens, never hardcoded hex in components
**Source:** `frontend/src/lib/palette.ts` (whole file, e.g. lines 27-29) and every chart component's `stroke="var(--line-*)"` usage (`CombinedTimeline.tsx` lines 328, 343, 362; `AmPmComparison.tsx` lines 93, 98)
**Apply to:** `CombinedTimeline.tsx`'s new trend `<Line>` elements — reuse the exact same `var(--line-systolic|diastolic|pulse)` strings already used by the raw lines (D-05, locked — no new tokens). The ONLY place literal hex belongs in this phase is `contrast.test.ts`, which has always used literal hex to mirror `index.css` (that file's own header comment, lines 1-4).

### `useElementWidth` for any container-width-dependent responsive behavior
**Source:** `frontend/src/hooks/useElementWidth.ts` (whole file, 22 lines) — already consumed by `CombinedTimeline.tsx` (lines 62, 206)
**Apply to:** `CategoryBars.tsx` and `AmPmComparison.tsx`, both currently missing any responsive width detection. Do not use a viewport media query (`window.innerWidth` / CSS breakpoint) — the hook's own comment (lines 1-4) explains why: rendered chart width diverges from viewport width inside the `max-w-[1280px]` content column.

### `prefersReducedMotion()` → `isAnimationActive` on every `<Line>`/`<Bar>`
**Source:** `frontend/src/lib/chartData.ts` lines 109-119, consumed identically in all three chart components (`CombinedTimeline.tsx` line 205, `CategoryBars.tsx` line 43, `AmPmComparison.tsx` line 77)
**Apply to:** the new trend `<Line>` elements in `CombinedTimeline.tsx` — must set `isAnimationActive={animate}` (the already-computed local `const animate = prefersReducedMotion() === false;`, line 205) exactly like the raw lines beside them, not a hardcoded `true`.

### Recharts z-order is JSX order (not a z-index prop, except the one documented ReferenceArea exception)
**Source:** `CombinedTimeline.tsx` file header (lines 10, 17) and the bands-before-lines JSX structure (lines 244-373)
**Apply to:** trend-line placement — trend `<Line>`s must sit AFTER the three raw `<Line>`s (so bold paints over dim) and BEFORE the `overlayEvents?.map(...)` marker block (so markers stay topmost). This is restated in UI-SPEC's own contract table (line 94) as a locked requirement, not a suggestion.

### `min-h-0 flex-1` for a flexible chart body under a fixed-height parent + adjacent fixed-height sibling text
**Source:** `AmPmComparison.tsx` lines 105-131 and 132-159 (both panels use this identical structure)
**Apply to:** `CombinedTimeline.tsx`'s new caption + chart wrap — per UI-SPEC's Copywriting Contract section (line 130), this is a direct instruction to reuse this exact technique, not invent a new one.

### Pure, total, side-effect-free functions in `lib/chartData.ts` with one colocated `describe` block per function in `chartData.test.ts`
**Source:** every exported function in `chartData.ts` (whole file) paired 1:1 with a `describe(...)` block in `chartData.test.ts` (whole file)
**Apply to:** `rollingAverage()` — new function, new `describe("rollingAverage", ...)` block, no exceptions to this established discipline.

---

## No Analog Found

None. Every file in this phase's scope is a modification to an existing, already-idiomatic file, and the strongest analog for each is the file's own established pattern (extended) plus one cross-file borrow (`useElementWidth`, `min-h-0 flex-1`). No net-new architectural pattern is being introduced this phase — consistent with CONTEXT.md's framing of Phase 16 as polish-only ("No new chart types").

---

## Metadata

**Analog search scope:** `frontend/src/lib/`, `frontend/src/components/charts/`, `frontend/src/hooks/`, `frontend/src/tests/` — the full set of directories CONTEXT.md/UI-SPEC.md name or imply for this phase; no broader codebase search was needed since every touched file already contains its own strongest precedent.
**Files scanned:** 9 (`chartData.ts`, `chartData.test.ts`, `CombinedTimeline.tsx`, `CombinedTimeline.test.tsx`, `CategoryBars.tsx`, `AmPmComparison.tsx`, `contrast.test.ts`, `useElementWidth.ts`, `palette.ts`)
**Pattern extraction date:** 2026-09-17
