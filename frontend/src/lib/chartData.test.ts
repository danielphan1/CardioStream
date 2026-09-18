// Unit tests for lib/chartData.ts — DASH-01..06, D-10, Assumption A2.
// ALL testable chart logic lives in these pure functions (RESEARCH
// Validation Architecture): Recharts renders 0×0 in jsdom (Pitfall 2), so
// tests target data shaping, never chart internals.
import { describe, expect, it } from "vitest";

import type { Reading, StatsSummary } from "../api/types";
import type { CategoryBarRow } from "./chartData";
import {
  categoryBarData,
  categoryBarRightMargin,
  clampCategoryBarRightMargin,
  estimateChipWidth,
  formatCategoryLabel,
  groupAmPm,
  isDotCrowded,
  prefersReducedMotion,
  resolveLabelY,
  rollingAverage,
  toTimePoints,
  truncateLabelForWidth,
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

describe("estimateChipWidth", () => {
  it("estimates a real mid-length band name: Normal (6 chars x 14 x 0.62, rounded)", () => {
    expect(estimateChipWidth("Normal", 14)).toBe(52);
  });

  it("estimates the longest real band name: Hypertensive Crisis (19 chars, worst case)", () => {
    expect(estimateChipWidth("Hypertensive Crisis", 14)).toBe(165);
  });

  it("returns 0 for the degenerate empty string", () => {
    expect(estimateChipWidth("", 14)).toBe(0);
  });
});

describe("categoryBarRightMargin", () => {
  const rows: CategoryBarRow[] = [
    {
      category: "Hypertensive Crisis",
      count: 6,
      percent: 4.5,
      label: "Hypertensive Crisis — 6 readings (5%)",
    },
    {
      category: "Normal",
      count: 28,
      percent: 21.2,
      label: "Normal — 28 readings (21%)",
    },
  ];

  it("at the narrow 16px breakpoint, covers the longest label (estimateChipWidth 367 + 16px padding)", () => {
    expect(categoryBarRightMargin(rows, 16)).toBe(383);
  });

  it("at the wide 18px breakpoint, covers the longest label (estimateChipWidth 413 + 16px padding)", () => {
    expect(categoryBarRightMargin(rows, 18)).toBe(429);
  });

  it("never drops below the longest label's own estimated width (invariant, survives padding retuning)", () => {
    const longest = Math.max(...rows.map((r) => estimateChipWidth(r.label, 16)));
    expect(categoryBarRightMargin(rows, 16)).toBeGreaterThanOrEqual(longest);
  });

  it("returns 0 for the degenerate empty-rows case", () => {
    expect(categoryBarRightMargin([], 16)).toBe(0);
  });
});

describe("clampCategoryBarRightMargin", () => {
  const rows: CategoryBarRow[] = [
    {
      category: "Hypertensive Crisis",
      count: 6,
      percent: 4.5,
      label: "Hypertensive Crisis — 6 readings (5%)",
    },
  ];

  it("clamps to a non-zero plot width at the real production-scale narrow container (343px — a 375px iPhone SE viewport minus App.tsx's px-4 page padding), the exact 16-VERIFICATION.md round-2 regression", () => {
    const rawMargin = categoryBarRightMargin(rows, 16);
    expect(rawMargin).toBe(383);
    const clamped = clampCategoryBarRightMargin(rawMargin, 343);
    expect(clamped).toBe(295);
    // Recreates Recharts' own offset formula (selectChartOffsetInternal.js):
    // offsetWidth = Math.max(chartWidth - margin.left - margin.right, 0).
    // 8 mirrors CategoryBars.tsx's hardcoded margin.left.
    const plotWidth = Math.max(343 - 8 - clamped, 0);
    expect(plotWidth).toBeGreaterThan(0);
    expect(plotWidth).toBe(40);
  });

  it("does not clamp when the container is wide enough — matches categoryBarRightMargin's own unclamped output", () => {
    const rawMargin = categoryBarRightMargin(rows, 16);
    expect(clampCategoryBarRightMargin(rawMargin, 900)).toBe(rawMargin);
  });

  it("passes the input through unchanged when containerWidth hasn't been measured yet (0 — jsdom/pre-ResizeObserver state)", () => {
    expect(clampCategoryBarRightMargin(383, 0)).toBe(383);
  });

  it("never returns a negative margin even when the container is smaller than the minimum plot width itself", () => {
    expect(clampCategoryBarRightMargin(383, 20)).toBe(0);
  });
});

describe("truncateLabelForWidth", () => {
  it("returns the label unchanged when it already fits", () => {
    expect(truncateLabelForWidth("Normal — 28 readings (21%)", 300, 16)).toBe(
      "Normal — 28 readings (21%)",
    );
  });

  it("shrinks the longest real label to fit the clamped budget from the 343px scenario above, appending an ellipsis", () => {
    // 279 = the 295px clamped margin from the case above minus the 16px
    // CATEGORY_LABEL_MARGIN_PADDING.
    expect(
      truncateLabelForWidth(
        "Hypertensive Crisis — 6 readings (5%)",
        279,
        16,
      ),
    ).toBe("Hypertensive Crisis — 6 rea…");
  });

  it("never returns an empty string, even at a 0px budget", () => {
    expect(
      truncateLabelForWidth("Hypertensive Crisis — 6 readings (5%)", 0, 16),
    ).toBe("…");
  });
});

// CombinedTimeline's Systolic/Diastolic/Pulse end-label pills converge in
// pixel space once filtering narrows the plotted range far enough —
// live-verified at a 7-day filter, where "Pulse" clipped the top of
// "Systolic". This is the collision math that fixes it.
describe("resolveLabelY", () => {
  const GAP = 20; // CombinedTimeline's END_LABEL_HEIGHT: 14px font + 3px pad*2

  it("passes a y through unchanged when nothing is placed yet", () => {
    expect(resolveLabelY(100, [])).toBe(100);
  });

  it("passes a y through unchanged when it doesn't collide with anything placed", () => {
    expect(resolveLabelY(100, [200])).toBe(100);
  });

  it("pushes down exactly one gap when it collides with one placed label", () => {
    expect(resolveLabelY(100, [95])).toBe(95 + GAP);
  });

  it("cascades: pushing past one collision can require pushing past a second", () => {
    // 100 collides with 95 -> becomes 115, which then collides with 110.
    expect(resolveLabelY(100, [95, 110])).toBe(110 + GAP);
  });

  it("is order-independent — same placed set, different order, same result", () => {
    expect(resolveLabelY(100, [95, 110])).toBe(resolveLabelY(100, [110, 95]));
  });

  it("never returns a value within GAP of any placed label", () => {
    const placed = [50, 52, 200];
    const result = resolveLabelY(51, placed);
    for (const p of placed) {
      expect(Math.abs(result - p)).toBeGreaterThanOrEqual(GAP);
    }
  });
});

// D-01/D-02/D-03: the count-based 7-reading rolling average CombinedTimeline
// (Phase 16, Plan 16-03) will plot alongside the raw dimmed line.
describe("rollingAverage", () => {
  it("returns undefined for every index before a full 7-reading window exists (D-02, partial window)", () => {
    const points = toTimePoints(
      [100, 101, 103, 104, 106, 107].map((systolic) => reading({ systolic })),
    );
    expect(rollingAverage(points, "systolic")).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("averages the first full 7-reading window, rounded to 1 decimal (exact window)", () => {
    const points = toTimePoints(
      [100, 101, 103, 104, 106, 107, 109].map((systolic) =>
        reading({ systolic }),
      ),
    );
    const result = rollingAverage(points, "systolic");
    expect(result.slice(0, 6)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(result[6]).toBe(104.3);
  });

  it("slides the window: the 8th point drops the earliest of the prior 7", () => {
    const points = toTimePoints(
      [100, 101, 103, 104, 106, 107, 109, 112].map((systolic) =>
        reading({ systolic }),
      ),
    );
    const result = rollingAverage(points, "systolic");
    expect(result[6]).toBe(104.3);
    expect(result[7]).toBe(106);
  });

  it("is purely count-based, indifferent to wildly uneven time gaps between readings (D-01)", () => {
    const points = toTimePoints(
      [
        { systolic: 100, datetime: "2015-01-01T00:00:00" },
        { systolic: 101, datetime: "2016-03-15T00:00:00" },
        { systolic: 103, datetime: "2019-11-02T00:00:00" },
        { systolic: 104, datetime: "2020-01-01T00:00:00" },
        { systolic: 106, datetime: "2024-06-30T00:00:00" },
        { systolic: 107, datetime: "2024-12-01T00:00:00" },
        { systolic: 109, datetime: "2025-06-03T07:42:00" },
      ].map((overrides) => reading(overrides)),
    );
    expect(rollingAverage(points, "systolic")[6]).toBe(104.3);
  });

  it("returns an empty array for empty input", () => {
    expect(rollingAverage([], "systolic")).toEqual([]);
  });

  it("reads whichever key is passed, not a hardcoded field (D-03, per-key correctness)", () => {
    const points = toTimePoints(
      [60, 61, 63, 64, 66, 67, 69].map((diastolic) => reading({ diastolic })),
    );
    expect(rollingAverage(points, "diastolic")[6]).toBe(64.3);
  });
});
