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
