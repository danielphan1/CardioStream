---
phase: 16-trend-clarity-and-chart-polish
reviewed: 2026-09-18T08:35:13Z
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
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-09-18T08:35:13Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the trend-clarity/chart-polish deliverables: `chartData.ts`'s new pure
helpers (`rollingAverage`, `isDotCrowded`, `estimateChipWidth`,
`resolveLabelY`), their unit tests, the WCAG contrast regression suite, and
the three chart components (`CategoryBars`, `AmPmComparison`,
`CombinedTimeline`) plus `CombinedTimeline`'s behavior tests. `tsc -b` and
`npm run lint` (oxlint) are both clean, and all 99 existing tests pass, so
the issues below are semantic/domain defects that static tooling and the
current test suite do not catch — exactly where an adversarial pass earns
its keep.

`resolveLabelY`'s collision-avoidance math was brute-force verified
(200k random trials) to be order-independent and loop-terminating for the
small (≤3-item) inputs it's actually used with — that part holds up.

The most serious finding is a genuine, demonstrable regression in
`CategoryBars.tsx`: the commit that added the narrow-viewport branch
(`fix(16-02)`) claims "Full category labels never clip on narrow chart
containers," but the numbers say otherwise — the reserved margin is roughly
half of what the label text actually needs. Separately, an empirically
reproduced (not theoretical) React-purity bug was found in
`CombinedTimeline.tsx`'s end-label collision avoidance: under the app's own
`<StrictMode>` root, label pills render 20px off from their production
position.

## Critical Issues

### CR-01: CategoryBars' narrow-mode right margin is far too small for its own D-10 labels — clips the chart's primary content on mobile

**File:** `frontend/src/components/charts/CategoryBars.tsx:46,69,85`
**Issue:**

```tsx
const narrow = containerWidth > 0 && containerWidth < 480;
...
fontSize={narrow ? 16 : 18}
...
margin={{ top: 8, right: narrow ? 160 : 300, bottom: 8, left: 8 }}
```

The commit that introduced this (`fix(16-02): CategoryBars responsive right
margin and label font below 480px`) states in its own message: "Full
category labels never clip on narrow chart containers." That claim doesn't
hold up against the actual label text this component draws.

The full D-10 label for the longest real category is e.g.
`"Hypertensive Crisis — 6 readings (5%)"` — 37 characters. Using the
project's *own* text-width heuristic (`estimateChipWidth`'s
`CHIP_CHAR_WIDTH_FACTOR = 0.62`, documented as "deliberately generous...
errs toward a slightly wider chip") applied at this component's actual
font sizes:

- narrow (16px): `37 * 16 * 0.62 ≈ 367px` needed vs. **160px** reserved — a
  ~207px shortfall (the margin covers less than half of what's needed).
- wide (18px): `37 * 18 * 0.62 ≈ 413px` needed vs. **300px** reserved — a
  ~113px shortfall.

Even discounting the 0.62 factor substantially for CategoryBars' regular
(non-bold) weight, the narrow case is not close — it's off by roughly 2x —
and the wide case has essentially zero safety margin, meaning any
Hypertensive-Crisis row with a double- or triple-digit count/percent will
clip there too.

This isn't a cosmetic nit: `Bar`/`ResponsiveContainer` render into a plain
`<svg>` (`node_modules/recharts/es6/container/Surface.js` sets no
`overflow: visible`, and `index.css` has no override), and embedded SVG
elements are clipped to their own bounds by the default UA stylesheet
(`svg:not(:root) { overflow: hidden; }`). Text drawn past
`plot width + margin.right` is invisible, not just visually cramped. Per
this file's own doc comment, "the labels ARE the values... there is
nothing extra to inspect" — when they clip, the chart loses its entire
purpose on any phone-width viewport, which is precisely the breakpoint
this code path exists to support. There is no test coverage for this
(no `CategoryBars` component test exists among the reviewed files), so
nothing currently guards the regression.

**Fix:** Derive the margin from the actual label set instead of a static
guess, using the estimator this codebase already has:

```tsx
import { categoryBarData, estimateChipWidth, prefersReducedMotion } from "../../lib/chartData";
...
const labelFontSize = narrow ? 16 : 18;
const rightMargin =
  Math.max(...rows.map((r) => estimateChipWidth(r.label, labelFontSize))) + 16;
...
margin={{ top: 8, right: rightMargin, bottom: 8, left: 8 }}
```

Add a regression test (mirroring the existing `estimateChipWidth` tests in
`chartData.test.ts`) asserting the computed margin covers the longest
formatted label at both the narrow and wide breakpoints, and verify once in
an actual browser at 320–414px width — jsdom cannot catch this class of bug
since it does no real text layout.

## Warnings

### WR-01: End-label collision avoidance mutates shared state during render — empirically wrong under the app's own `<StrictMode>`

**File:** `frontend/src/components/charts/CombinedTimeline.tsx:163-200,249`
**Issue:** `makeEndLabel`'s returned `EndLabel` function is passed to
Recharts as `LabelList`'s `content` prop. Recharts invokes this via
`createElement(content, props)` (`node_modules/recharts/es6/component/Label.js:285`),
so React treats it as a genuine function component subject to normal
render rules — including React 19's `<StrictMode>` double-invocation of
component render bodies in development. `main.tsx` wraps the whole app in
`<StrictMode>`.

`EndLabel`'s body has a side effect outside of its return value:

```tsx
const labelY = resolveLabelY(Number(y), placedYs);
placedYs.push(labelY);   // mutates the closed-over array
```

`placedYs` (`endLabelYs` in the parent) is a plain array shared by closure
across all three series' end labels for one render. Under `StrictMode`,
each `EndLabel` invocation fires twice; the array mutation survives both
invocations (arrays are mutated by reference, unaffected by React
discarding a render's output), so by the time the *second* invocation of a
later label runs, `placedYs` already contains extra entries from the
duplicated calls to itself and its siblings. This corrupts the collision
math for lines that don't actually collide, pushing labels further down
than intended.

This was empirically reproduced, not just reasoned about — rendering the
same `CombinedTimeline` instance with and without `<StrictMode>` wrapping
(mocked `ResponsiveContainer`, same props) yields different pill `y`
positions for every series:

| series (by render order) | without StrictMode | with StrictMode | diff |
|---|---|---|---|
| 1st pill | 141.37 | 161.37 | +20 (`END_LABEL_HEIGHT`) |
| 2nd pill | 272.27 | 292.27 | +20 |
| 3rd pill | 185 | 205 | +20 |

Production builds strip `StrictMode`'s double-invoke behavior, so shipped
users aren't affected — but every developer running `npm run dev` (which is
exactly how this file's own comments say these positioning bugs were
"live-verified," e.g. "Pulse clipped the top of Systolic at a 7-day
filter") is looking at label positions offset by a full `END_LABEL_HEIGHT`
from what actually ships. No test in `CombinedTimeline.test.tsx` renders
inside `StrictMode`, so this class of regression is invisible to CI as
well as to the manual verification workflow the codebase relies on.

**Fix:** Don't mutate closure state from inside a render-time callback.
Resolve all three Y positions once, in the parent component's own (pure)
render body, before building the JSX tree — e.g. compute an ordered list of
`{seriesKey, y}` via a single pass once each `Line`'s last point is known,
or restructure `makeEndLabel` to accept a pre-resolved Y rather than
computing-and-pushing at label-render time.

### WR-02: Dimmed-line contrast fixtures are hardcoded blends, fully decoupled from the opacity constant they claim to guard

**File:** `frontend/src/tests/contrast.test.ts:56-63,157-178`
**Issue:** The comment above `DIMMED_LINE_PAIRS` states: "This locks in that
the dimmed line still clears the 3:1 non-text floor — a future opacity
change that breaks contrast fails here instead of shipping." The listed hex
values (e.g. `lineSystolicDimmedVsDeck: "#3E5676"`) are hand-computed
alpha blends of `--line-systolic` (etc.) at exactly 0.85 opacity over
`deck`/`mist` — verified correct for the pairs checked (e.g.
`(30,58,95)*0.85 + (245,247,246)*0.15 → (62,86,118) = #3E5676`, matches).

The problem is the linkage the docstring claims doesn't exist: these are
static literals in the test file, not a value derived from
`CombinedTimeline.tsx`'s actual `strokeOpacity={hasTrend ? 0.85 : 1}`
(line 367/385/407). If a future change bumps that opacity to, say, 0.6 for
better legibility, this test does not read that value anywhere — it will
keep passing (or failing) based on the frozen 0.85 math, giving zero actual
protection against the exact regression it's named after. The same applies
to a future edit of `--line-systolic`/`--line-diastolic`/`--line-pulse` in
`index.css`: nothing ties these literals back to the source tokens except a
comment, so drift is silent until someone manually recomputes by hand.

**Fix:** Export the opacity constant from `chartData.ts` (or
`CombinedTimeline.tsx`) and compute the expected blended color in the test
from the *same* base hex + that constant via a small `blend(fg, bg, alpha)`
helper, rather than hand-typing the result. That way a change to either the
opacity or the base token actually flows through and the test catches what
it says it catches.

### WR-03: `END_LABEL_HEIGHT` is defined twice, in two files, with no shared source of truth

**File:** `frontend/src/lib/chartData.ts:183`, `frontend/src/components/charts/CombinedTimeline.tsx:147`
**Issue:**

```ts
// chartData.ts:183 (module-private, used only by resolveLabelY)
const END_LABEL_HEIGHT = 20;
```
```tsx
// CombinedTimeline.tsx:147 (drives the actual rendered pill height)
const END_LABEL_HEIGHT = CHIP_FONT_SIZE + CHIP_PAD_Y * 2; // = 20
```

The two constants happen to agree today (both evaluate to 20) and are kept
in sync only by a doc comment ("Matches CombinedTimeline.tsx's
END_LABEL_HEIGHT ... kept here, not there, so the function and its one
constant don't trip oxlint's react(only-export-components)"). If either
`CHIP_FONT_SIZE`/`CHIP_PAD_Y` in `CombinedTimeline.tsx` or the literal `20`
in `chartData.ts` changes without the other, `resolveLabelY`'s collision
detection silently stops matching the actual rendered chip height —
reintroducing the exact overlapping-pill bug ("Pulse clipped the top of
Systolic") this whole mechanism was built to fix, with no test able to
catch it since `chartData.test.ts` only exercises `resolveLabelY` against
its own local `GAP` constant, never against `CombinedTimeline`'s real
`END_LABEL_HEIGHT`.

**Fix:** Export `END_LABEL_HEIGHT` from `chartData.ts` and import it in
`CombinedTimeline.tsx` instead of re-deriving it. The stated oxlint
constraint (`react/only-export-components`) applies to files that export
React components, not to a plain constant export from a non-component
module like `chartData.ts` — `resolveLabelY` and `estimateChipWidth` are
already exported from there, so `END_LABEL_HEIGHT` can join them with no
new lint friction.

## Info

### IN-01: Repeated magic numbers for raw/trend line styling

**File:** `frontend/src/components/charts/CombinedTimeline.tsx:366-367,384-385,406-407`
**Issue:** `strokeWidth={hasTrend ? 2 : 3}` and
`strokeOpacity={hasTrend ? 0.85 : 1}` are copy-pasted identically across
the systolic, diastolic, and pulse `<Line>` elements. A future tuning pass
(this file has already had several, per its own header notes) risks
updating one occurrence and missing the other two.
**Fix:** Hoist to named constants once, e.g.
`const RAW_STROKE_WIDTH_TRENDED = 2`, `const RAW_STROKE_WIDTH = 3`,
`const RAW_LINE_DIMMED_OPACITY = 0.85`, and reference them in all three
places (and in the `contrast.test.ts` fixture, per WR-02).

### IN-02: Chart label/tick font sizes sit below CLAUDE.md's "≥18px body fonts" floor

**File:** `frontend/src/components/charts/CategoryBars.tsx:69,91`; `frontend/src/components/charts/AmPmComparison.tsx:54,63,122,128,149,154`; `frontend/src/components/charts/CombinedTimeline.tsx:99,264(ok),308-333,344`
**Issue:** CLAUDE.md lists "≥18px body fonts" under non-negotiable
accessibility constraints, given Chris's profile. Across all three
reviewed chart components, in-chart text is consistently 14-16px: axis
ticks (`fontSize: 16`), `AmPmComparison`'s AM/PM period + value labels
(`fontSize={16}`), `CombinedTimeline`'s band/end-label chip text
(`CHIP_FONT_SIZE = 14`) and overlay marker glyphs (`fontSize: 14`). Most
notably, `CategoryBars`' D-10 label — described in its own file header as
"the labels ARE the values" (i.e., primary content, not chrome) — is
explicitly dropped from 18px to **16px** on narrow containers, moving
further from the stated floor exactly where legibility matters most
(small mobile screens). This reads as a long-standing, multi-phase pattern
(D-06/D-10/UI-SPEC references throughout) rather than something newly
introduced here, so it's likely a deliberate, previously-negotiated
tradeoff for dense chart chrome — but as submitted it visibly conflicts
with the letter of CLAUDE.md's constraint, which draws no "chart chrome vs.
body text" distinction.
**Fix:** Either raise the affected font sizes to ≥18px where layout allows,
or record an explicit, scoped exception in UI-SPEC.md/DESIGN.md ("chart
axis/label chrome is exempt from the 18px floor because X") so the
constraint and the implementation stop visibly disagreeing.

---

_Reviewed: 2026-09-18T08:35:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
