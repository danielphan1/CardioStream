// Unit tests for lib/chartData.ts — DASH-01..06, D-10, Assumption A2.
// ALL testable chart logic lives in these pure functions (RESEARCH
// Validation Architecture): Recharts renders 0×0 in jsdom (Pitfall 2), so
// tests target data shaping, never chart internals.
import { describe, expect, it } from "vitest";

import type { Reading, StatsSummary } from "../api/types";
import {
  categoryBarData,
  formatCategoryLabel,
  groupAmPm,
  isDotCrowded,
  prefersReducedMotion,
  toTimePoints,
} from "./chartData";

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

describe("toTimePoints", () => {
  it("maps each reading to { ts, systolic, diastolic, pulse, reading }", () => {
    const r = reading({ systolic: 142, diastolic: 88, pulse: 61 });
    const points = toTimePoints([r]);
    expect(points).toHaveLength(1);
    expect(points[0].systolic).toBe(142);
    expect(points[0].diastolic).toBe(88);
    expect(points[0].pulse).toBe(61);
    expect(points[0].reading).toBe(r);
  });

  it("ts is epoch ms of the naive ISO parsed as LOCAL time (DATA-05)", () => {
    // Naive ISO with a time component parses as local time per ECMAScript —
    // this is the DATA-05 contract (RESEARCH Pitfall 1: only date-ONLY
    // strings parse as UTC).
    const r = reading({ datetime: "2025-06-03T07:42:00" });
    const [p] = toTimePoints([r]);
    const expected = new Date(2025, 5, 3, 7, 42, 0).getTime(); // local
    expect(p.ts).toBe(expected);
  });

  it("preserves input order (API serves datetime-ascending)", () => {
    const a = reading({ datetime: "2025-02-22T11:26:00" });
    const b = reading({ datetime: "2025-06-13T09:21:00" });
    const points = toTimePoints([a, b]);
    expect(points[0].reading).toBe(a);
    expect(points[1].reading).toBe(b);
  });

  it("returns an empty array for no readings", () => {
    expect(toTimePoints([])).toEqual([]);
  });
});

describe("groupAmPm", () => {
  it("averages systolic/diastolic/pulse per period, rounded to 1 decimal", () => {
    const rows = groupAmPm([
      reading({ am_pm: "AM", systolic: 120, diastolic: 80, pulse: 60 }),
      reading({ am_pm: "AM", systolic: 130, diastolic: 70, pulse: 50 }),
    ]);
    expect(rows).toEqual([
      { period: "AM", systolic: 125, diastolic: 75, pulse: 55 },
    ]);
  });

  it("rounds averages to one decimal place", () => {
    const rows = groupAmPm([
      reading({ am_pm: "PM", systolic: 120, diastolic: 80, pulse: 60 }),
      reading({ am_pm: "PM", systolic: 121, diastolic: 81, pulse: 61 }),
      reading({ am_pm: "PM", systolic: 121, diastolic: 81, pulse: 61 }),
    ]);
    // 362/3 = 120.666… → 120.7; 242/3 = 80.666… → 80.7; 182/3 = 60.666… → 60.7
    expect(rows).toEqual([
      { period: "PM", systolic: 120.7, diastolic: 80.7, pulse: 60.7 },
    ]);
  });

  it("returns AM before PM when both periods are present", () => {
    const rows = groupAmPm([
      reading({ am_pm: "PM", systolic: 110, diastolic: 70, pulse: 65 }),
      reading({ am_pm: "AM", systolic: 140, diastolic: 90, pulse: 55 }),
    ]);
    expect(rows.map((r) => r.period)).toEqual(["AM", "PM"]);
  });

  it("returns rows only for periods present (Assumption A2 — AM filter yields one row)", () => {
    const rows = groupAmPm([
      reading({ am_pm: "AM" }),
      reading({ am_pm: "AM" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].period).toBe("AM");
  });

  it("returns an empty array for no readings", () => {
    expect(groupAmPm([])).toEqual([]);
  });
});

describe("formatCategoryLabel", () => {
  it('formats the D-10 exact string with Math.round-ed percent: "Stage 1 — 34 readings (26%)"', () => {
    expect(formatCategoryLabel("Stage 1", 34, 25.8)).toBe(
      "Stage 1 — 34 readings (26%)",
    );
  });

  it('uses singular "reading" for count 1', () => {
    expect(formatCategoryLabel("Normal", 1, 0.8)).toBe(
      "Normal — 1 reading (1%)",
    );
  });

  it('zero-count categories read "Hypotension — 0 readings (0%)"', () => {
    expect(formatCategoryLabel("Hypotension", 0, 0)).toBe(
      "Hypotension — 0 readings (0%)",
    );
  });
});

describe("categoryBarData", () => {
  const stats: StatsSummary = {
    count: 132,
    systolic: { avg: 131.9, min: 60, max: 211 },
    diastolic: { avg: 82.1, min: 42, max: 129 },
    pulse: { avg: 55.9, min: 42, max: 69 },
    categories: [
      { category: "Hypotension", count: 0, percent: 0 },
      { category: "Normal", count: 28, percent: 21.2 },
      { category: "Elevated", count: 18, percent: 13.6 },
      { category: "Stage 1", count: 34, percent: 25.8 },
      { category: "Stage 2", count: 46, percent: 34.8 },
      { category: "Hypertensive Crisis", count: 6, percent: 4.5 },
    ],
    latest_reading: "2025-06-13T09:21:00",
  };

  it("maps the six clinical-order categories to { category, count, percent, label }", () => {
    const rows = categoryBarData(stats);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.category)).toEqual([
      "Hypotension",
      "Normal",
      "Elevated",
      "Stage 1",
      "Stage 2",
      "Hypertensive Crisis",
    ]);
    expect(rows[3]).toEqual({
      category: "Stage 1",
      count: 34,
      percent: 25.8,
      label: "Stage 1 — 34 readings (26%)",
    });
  });

  it("labels come from formatCategoryLabel including zero-count rows", () => {
    const rows = categoryBarData(stats);
    expect(rows[0].label).toBe("Hypotension — 0 readings (0%)");
  });
});

describe("prefersReducedMotion", () => {
  it("returns false when matchMedia is unavailable (jsdom guard)", () => {
    // jsdom does not implement matchMedia by default.
    expect(prefersReducedMotion()).toBe(false);
  });

  it("reflects matchMedia matches when available", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
    })) as typeof window.matchMedia;
    try {
      expect(prefersReducedMotion()).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("isDotCrowded", () => {
  it("returns false at generous spacing (1000px / 50 points = 20px/point)", () => {
    expect(isDotCrowded(1000, 50)).toBe(false);
  });

  it("returns true at the reported mobile case (350px / 130 points ≈ 2.7px/point)", () => {
    expect(isDotCrowded(350, 130)).toBe(true);
  });

  it("returns false for a degenerate width of 0", () => {
    expect(isDotCrowded(0, 50)).toBe(false);
  });

  it("returns false for a degenerate pointCount of 0", () => {
    expect(isDotCrowded(1000, 0)).toBe(false);
  });

  it("returns false for a single point (can't overlap itself)", () => {
    expect(isDotCrowded(1000, 1)).toBe(false);
  });
});
