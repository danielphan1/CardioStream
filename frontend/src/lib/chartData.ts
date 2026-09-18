/**
 * Pure data-shaping functions for the four dashboard charts
 * (DASH-01..06, D-10, RESEARCH Assumption A2).
 *
 * NO React, NO Recharts imports — everything testable lives here because
 * Recharts renders 0×0 in jsdom (RESEARCH Pitfall 2 / Validation
 * Architecture): chart components only lay out JSX around these outputs.
 *
 * Time contract (DATA-05 / Pitfall 1): API datetimes are naive ISO WITH a
 * time component ("2025-06-03T07:42:00"), which `new Date()` parses as
 * LOCAL time per ECMAScript — exactly the naive-local end-to-end contract.
 */
import type { BPCategory, Reading, StatsSummary } from "../api/types";

/** One chart point per reading — epoch-ms x plus the source reading. */
export type TimePoint = {
  ts: number;
  systolic: number;
  diastolic: number;
  pulse: number;
  reading: Reading;
};

/** One grouped-bar row for the AM vs PM chart (DASH-04). */
export type AmPmRow = {
  period: "AM" | "PM";
  systolic: number;
  diastolic: number;
  pulse: number;
};

/** One horizontal-bar row for the BP Categories chart (DASH-03). */
export type CategoryBarRow = {
  category: BPCategory;
  count: number;
  percent: number;
  label: string;
};

/**
 * Map readings to time-axis points. `ts` is epoch ms of the naive ISO
 * parsed as local time; input order is preserved (the API serves
 * datetime-ascending).
 */
export function toTimePoints(readings: Reading[]): TimePoint[] {
  return readings.map((reading) => ({
    ts: new Date(reading.datetime).getTime(),
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    pulse: reading.pulse,
    reading,
  }));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Client-side AM vs PM aggregation (DASH-04 — ≤132 rows, trivial). Returns
 * rows ONLY for periods present in the input (Assumption A2: an AM-filtered
 * dataset yields a single AM row), AM before PM, averages rounded to one
 * decimal.
 */
export function groupAmPm(readings: Reading[]): AmPmRow[] {
  const rows: AmPmRow[] = [];
  for (const period of ["AM", "PM"] as const) {
    const subset = readings.filter((r) => r.am_pm === period);
    if (subset.length === 0) continue;
    const n = subset.length;
    rows.push({
      period,
      systolic: round1(subset.reduce((sum, r) => sum + r.systolic, 0) / n),
      diastolic: round1(subset.reduce((sum, r) => sum + r.diastolic, 0) / n),
      pulse: round1(subset.reduce((sum, r) => sum + r.pulse, 0) / n),
    });
  }
  return rows;
}

/**
 * D-01/D-02: count-based rolling average over the last `window` readings for
 * a single vitals key (systolic/diastolic/pulse), one output entry per input
 * point. This is deliberately a *reading-count* window, not a calendar-day
 * window — readings are not daily, so a time-based window would silently mix
 * in wildly different sample densities. Mirrors `groupAmPm`'s "no data ->
 * skip/omit, don't fabricate" instinct: indices before a full window exists
 * (the first `window - 1`) are `undefined`, never a partial-window average.
 */
export function rollingAverage(
  points: TimePoint[],
  key: "systolic" | "diastolic" | "pulse",
  window = 7,
): (number | undefined)[] {
  return points.map((_, i) => {
    if (i < window - 1) return undefined;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += points[j][key];
    return round1(sum / window);
  });
}

/**
 * D-10 exact label format: "Stage 1 — 34 readings (26%)". Percent is
 * Math.round-ed; count 1 uses the singular "reading".
 */
export function formatCategoryLabel(
  category: string,
  count: number,
  percent: number,
): string {
  const noun = count === 1 ? "reading" : "readings";
  return `${category} — ${count} ${noun} (${Math.round(percent)}%)`;
}

/**
 * Rows for the BP Categories bars (DASH-03). `stats.categories` already
 * arrives as all six labels in clinical order, zero-filled, from
 * /stats/summary — this only attaches the D-10 display label so the bars
 * always match the stats strip.
 */
export function categoryBarData(stats: StatsSummary): CategoryBarRow[] {
  return stats.categories.map((c) => ({
    category: c.category,
    count: c.count,
    percent: c.percent,
    label: formatCategoryLabel(c.category, c.count, c.percent),
  }));
}

/**
 * Whether the user prefers reduced motion (D-04 — charts set
 * `isAnimationActive={!prefersReducedMotion()}`). Guarded for jsdom, where
 * matchMedia is unavailable — returns false there.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Matches `dot={{ r: 5 }}` in CombinedTimeline — diameter = 2*r. */
const DOT_DIAMETER_PX = 10;

/**
 * Whether per-point dots would visually overlap at the chart's current
 * rendered width (CombinedTimeline mobile-overplotting fix,
 * /impeccable critique P1, 2026-08-27). True when the average px-per-point
 * is tighter than one dot's own diameter. `width` must be the chart's live
 * container width (from `useElementWidth`), not the viewport width, since
 * the two diverge inside the `max-w-[1280px]` content column (DESIGN.md
 * Layout section).
 */
export function isDotCrowded(width: number, pointCount: number): boolean {
  if (width <= 0 || pointCount <= 1) return false;
  return width / pointCount < DOT_DIAMETER_PX;
}

/**
 * Average glyph width as a fraction of font-size for the bold 14px Inter
 * band-label chip text — deliberately generous so the estimate errs toward
 * a slightly wider chip rather than one that clips its own label.
 */
const CHIP_CHAR_WIDTH_FACTOR = 0.62;

/**
 * Sizes the solid background rect behind a BP Timeline band-label chip so
 * the chip fully covers its own text (CombinedTimeline.tsx's `makeBandLabelChip`,
 * /impeccable critique P3, 2026-08-28). SVG offers no synchronous
 * string-width query without an actual DOM measurement pass, so this is a
 * same-order-of-magnitude estimate for a decorative chip, not pixel-exact
 * text metrics.
 */
export function estimateChipWidth(text: string, fontSize: number): number {
  return Math.round(text.length * fontSize * CHIP_CHAR_WIDTH_FACTOR);
}

/** Covers CategoryBars.tsx's own 8px label offset (`barLabel`'s `x + width +
 *  8`) plus a small buffer — Phase 16 gap-closure fix for CR-01/
 *  16-VERIFICATION.md's clipping finding (the prior static 160px/300px
 *  margin.right guess covered roughly half of what the longest real D-10
 *  label needs). */
export const CATEGORY_LABEL_MARGIN_PADDING = 16;

/**
 * The `BarChart margin.right` CategoryBars needs to draw its D-10 labels
 * ("Hypertensive Crisis — NN readings (NN%)") in full without SVG clipping —
 * derived from the actual label set via `estimateChipWidth()` instead of a
 * static guess (Phase 16 gap-closure fix for CR-01/16-VERIFICATION.md).
 */
export function categoryBarRightMargin(
  rows: CategoryBarRow[],
  fontSize: number,
): number {
  if (rows.length === 0) return 0;
  return (
    Math.max(...rows.map((r) => estimateChipWidth(r.label, fontSize))) +
    CATEGORY_LABEL_MARGIN_PADDING
  );
}

// Mirrors CategoryBars.tsx's own hardcoded `margin.left: 8` on its
// <BarChart> — duplicated here (not imported) because the clamp math below
// needs to reason about the exact same plot-area geometry Recharts itself
// will compute.
const CATEGORY_BAR_LEFT_MARGIN = 8;

// ponytail: fixed floor, revisit if live QA shows bars still read as a
// sliver at this width. Not measured/derived — chosen well clear of
// Recharts' own zero-clamp.
const MIN_CATEGORY_BAR_PLOT_WIDTH = 40;

/**
 * Bounds `rightMargin` against the container's actual measured width so
 * CategoryBars' bars never collapse to zero width. Recharts hard-clamps its
 * own plot area (`offsetWidth = Math.max(chartWidth - offset.left -
 * offset.right, 0)`, `recharts/es6/state/selectors/selectChartOffsetInternal.js`
 * lines 71-78) — the moment `margin.left + margin.right >= containerWidth`,
 * every bar renders zero-width and invisible. Round 1's `categoryBarRightMargin()`
 * (CR-01) sized the margin correctly for the label but never bounded it
 * against the container — this is the round-2 gap-closure fix
 * (16-VERIFICATION.md BLOCKER).
 */
export function clampCategoryBarRightMargin(
  rightMargin: number,
  containerWidth: number,
): number {
  if (containerWidth <= 0) return rightMargin;
  const maxMargin =
    containerWidth - CATEGORY_BAR_LEFT_MARGIN - MIN_CATEGORY_BAR_PLOT_WIDTH;
  return Math.min(rightMargin, Math.max(maxMargin, 0));
}

/**
 * Graceful-degradation half of the round-2 fix: when
 * `clampCategoryBarRightMargin()` reduces `margin.right` below what the full
 * label needs, the label must shrink (ellipsis-truncated) to fit rather than
 * clip invisibly past the SVG's `overflow: hidden` edge.
 */
export function truncateLabelForWidth(
  label: string,
  maxWidthPx: number,
  fontSize: number,
): string {
  if (maxWidthPx <= 0) return "…";
  if (estimateChipWidth(label, fontSize) <= maxWidthPx) return label;
  const perCharWidth = fontSize * CHIP_CHAR_WIDTH_FACTOR;
  const maxChars = Math.max(1, Math.floor(maxWidthPx / perCharWidth) - 1);
  return `${label.slice(0, maxChars)}…`;
}

/** Matches CombinedTimeline.tsx's END_LABEL_HEIGHT (its 14px chip font + 3px
 *  vertical padding on each side) — kept here, not there, so the function and
 *  its one constant don't trip oxlint's react(only-export-components) (same
 *  reason components/rdpSizing.ts exists as its own module). */
const END_LABEL_HEIGHT = 20;

/**
 * Pushes `y` down past any already-placed label it would overlap, looping
 * because pushing past one can land on another. CombinedTimeline's line-end
 * pills (Systolic/Diastolic/Pulse) converge in pixel space once filtering
 * narrows the plotted range far enough — live-verified at a 7-day filter,
 * where "Pulse" clipped the top of "Systolic". At most 3 labels ever exist,
 * so this always settles in a couple of passes.
 */
export function resolveLabelY(y: number, placed: number[]): number {
  let candidate = y;
  let moved = true;
  while (moved) {
    moved = false;
    for (const other of placed) {
      if (Math.abs(candidate - other) < END_LABEL_HEIGHT) {
        candidate = other + END_LABEL_HEIGHT;
        moved = true;
      }
    }
  }
  return candidate;
}
