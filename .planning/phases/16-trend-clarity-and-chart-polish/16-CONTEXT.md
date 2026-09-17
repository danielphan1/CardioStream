# Phase 16: Trend Clarity and Chart Polish - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Chris can see which *direction* his health is moving, not just where each reading landed. A rolling-average trend line is drawn over the combined timeline's raw points for blood pressure and pulse, plus a readability pass on `CombinedTimeline`, `CategoryBars`, and `AmPmComparison`. No new chart types — this phase improves what already exists, on top of Phase 15's just-shipped multi-select filter surface.

</domain>

<decisions>
## Implementation Decisions

### Rolling average window
- **D-01:** Count-based window — average of the **last 7 readings**, not calendar days. Readings are not daily (gaps in the series), so a calendar-day window would average anywhere from 1 to many readings unevenly across different windows; a count-based window is always a smooth, evenly-weighted line and is simpler to unit-test. This directly answers the ROADMAP's own flagged concern about "how it handles gaps in the series."
- **D-02:** The trend line only starts once a **full 7-reading window exists** — no partial-window averaging at the start of the series. Skips the misleadingly steep/noisy average a 1-2-reading partial window would produce at the left edge of the chart.

### Which series get a trend line
- **D-03:** **All three series** — systolic, diastolic, and pulse — get their own rolling-average trend line whenever they're shown (respecting the existing `showBP`/`showPulse` toggles from Phase 14/15). Not BP-only: pulse direction matters too given ~88% of readings already show bradycardia, and consistent treatment across every series is simpler to implement and test than a BP-only special case.

### Trend line visual treatment
- **D-04:** The trend line is the **bold/foreground** treatment — thicker, more opaque stroke than today's raw-point lines. The existing raw-point lines/dots dim or shrink to a supporting role. Raw data stays inspectable via the existing click-tooltip (`ChartTooltip`), it just isn't the visual foreground anymore. Rejected: adding the trend line as a 4th/5th/6th distinct stroke alongside unchanged raw lines (too many lines on an already-busy chart), and a raw/trend view toggle (adds a new control surface beyond this phase's polish-only scope).
- **D-05:** Each series' trend line **reuses that series' existing color token** (`--line-systolic`, `--line-diastolic`, `--line-pulse`) — distinguished from the raw line by weight/opacity, not by a new hue. No new color tokens, no new legend entries, no new contrast-pair verification needed (unlike Phase 14's `--line-pulse` addition, which *did* need a new token because pulse had no distinct color before).

### Readability pass priorities
- **D-06 (Claude's discretion — see below):** No specific readability pain point was named this round. Left to the researcher/planner to identify concrete density/labelling/colour/axis issues on `CombinedTimeline`, `CategoryBars`, and `AmPmComparison` once looking at the real rendered charts — informed by how the trend-line additions (D-01–D-05) themselves change what needs polish (e.g. dimmed raw dots may ease some of today's density complaints for free).

### Claude's Discretion
- Exact readability improvements (D-06) — density, labelling, colour, axis legibility fixes, once the real charts (with trend lines added) are in front of the researcher/planner.
- Exact opacity/stroke-width values for the dimmed raw points vs. bold trend line (D-04) — cosmetic detail, belongs in `/gsd-ui-phase 16`'s design contract per CLAUDE.md's impeccable + GSD pairing convention.
- Whether the trend line needs its own end-label pill (mirroring `CombinedTimeline.tsx`'s existing `makeEndLabel` treatment for raw lines) or a different end-of-line treatment — implementation/UI-SPEC detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and constraints
- `.planning/ROADMAP.md` §Phase 16 — Goal, scope, and the explicit note that the rolling average is a *derived medical-adjacent value* needing unit tests per CLAUDE.md's Quality constraint, including gap handling (resolved by D-01/D-02 above).
- `.planning/PROJECT.md` — Core Value (voice-first), Constraints (non-negotiable accessibility floor: ≥48px targets, ≥18px text, high contrast, no color-alone signalling) — every readability/visual change in this phase must be checked against this list.
- `CLAUDE.md` §"impeccable + GSD pairing (frontend design work)" — names `/gsd-ui-phase` (producing UI-SPEC.md) as the entry point for a formal design contract; ROADMAP.md's own plan placeholder for this phase says to run `/gsd-ui-phase 16` before planning — do not skip straight to `/gsd-plan-phase 16`.

### The three charts this phase touches
- `frontend/src/components/charts/CombinedTimeline.tsx` — the chart the trend lines add to. Read the file header in full: documents the bands-before-lines z-order requirement, the numeric time-axis pitfall, the dual always-mounted-hidden-axis rule, and the `markerAxis` fix — all precedent that a new trend-line `<Line>` series must respect (correct `yAxisId`, correct JSX order relative to bands).
- `frontend/src/components/charts/CategoryBars.tsx` — in scope for the readability pass only (D-06), no rolling-average work here (categories are already an aggregate, not a time series).
- `frontend/src/components/charts/AmPmComparison.tsx` — same: readability pass only (D-06).

### Data-shaping layer (where the rolling-average function belongs)
- `frontend/src/lib/chartData.ts` — pure data-shaping functions with **NO React, NO Recharts imports** (file header: "Recharts renders 0×0 in jsdom" — everything testable lives here). `toTimePoints()` is the existing function producing `TimePoint[]` that a new `rollingAverage()`-style function would consume/extend. This is the established, correct location for the new window-arithmetic function and its unit tests (matches `groupAmPm`/`categoryBarData`'s existing pattern).
- `frontend/src/lib/palette.ts` — `categoryColor()` and the existing color-token accessors; D-05 means no new palette entries are needed here.

### Established accessibility/motion precedent to follow
- `frontend/src/lib/chartData.ts`'s `prefersReducedMotion()` / `isDotCrowded()` — the trend line's `isAnimationActive` and any dot-crowding logic should follow the same established helpers, not reinvent them.
- Phase 14's `--line-pulse` addition (`.planning/phases/14-unified-show-panel-and-combined-timeline/14-CONTEXT.md`) — the precedent for when a NEW color token is/isn't needed and how it gets contrast-verified in `frontend/src/tests/contrast.test.ts`. D-05 above means this phase should NOT need to repeat that process, but the researcher should confirm the existing systolic/diastolic/pulse tokens still pass contrast at whatever opacity D-04's dimming lands on.

No dedicated ADR directory exists for this project; PROJECT.md and ROADMAP.md are the canonical product/scope docs, and this CONTEXT.md is the canonical decisions doc for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toTimePoints()` (`lib/chartData.ts`) — the existing readings→chart-points mapper; a rolling-average function is a natural sibling/extension of this, operating on the same `TimePoint[]` shape.
- `resolveLabelY()` / `makeEndLabel()` (`CombinedTimeline.tsx`) — the existing collision-avoidance pattern for line-end label pills; if the trend line gets its own end label, this is the pattern to extend rather than duplicate.
- `isDotCrowded()` / `prefersReducedMotion()` (`lib/chartData.ts`) — existing helpers the trend line's rendering should reuse for consistency with the raw lines' behavior.

### Established Patterns
- Derived-but-client-side-computed values (`groupAmPm`, `categoryBarData`) live in `lib/chartData.ts` as pure functions with dedicated unit tests, NOT computed on the backend — this is the pattern a rolling-average function should follow, since (like AM/PM grouping) it depends on whatever subset of readings is currently filtered/displayed, not a fixed server-side computation.
- Series color assignment is always via CSS custom properties (`var(--line-systolic)` etc.), never hardcoded hex — D-05's "reuse existing token" decision follows this established discipline directly.
- Bands/lines z-order is JSX order in Recharts 3 (`CombinedTimeline.tsx`'s own Pitfall 7 note) — a new trend-line `<Line>` element's position in the JSX tree relative to the existing raw `<Line>` elements will determine whether it draws on top of or behind them.

### Integration Points
- `CombinedTimeline.tsx`'s `<LineChart>` body — where new trend-line `<Line>` elements for systolic/diastolic/pulse get added, each bound to the same `yAxisId` (`MMHG`/`BPM`) as its raw counterpart.
- `lib/chartData.ts` — where the new rolling-average pure function and its unit tests get added, following `groupAmPm`'s existing test-file precedent (`chartData.test.ts` — location to confirm during research/planning).

</code_context>

<specifics>
## Specific Ideas

No specific visual reference was given this round (unlike Phase 13's nickelfox.com/dribbble reference) — the trend-line visual treatment (D-04/D-05) is directional guidance for `/gsd-ui-phase 16` to turn into an exact design contract, not a locked pixel spec.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-Trend Clarity and Chart Polish*
*Context gathered: 2026-09-17*
