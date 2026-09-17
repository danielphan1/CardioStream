// Unit tests for lib/dates.ts — DASH-07, D-17, D-18.
// Key contracts: split-parse for date-only strings (RESEARCH Pitfall 1),
// presets anchored to the newest reading, never today (Pitfall 9).
import { describe, expect, it } from "vitest";

import type { BPCategory, PulseCategory, TimeOfDayBucket } from "../api/types";
import {
  combineLocalDateTime,
  fmtLongDate,
  fmtShortDate,
  fmtTooltipTitle,
  formatDateParam,
  isValidDateText,
  parseDateOnly,
  presetLabel,
  resolveFilters,
  TIME_OF_DAY_ORDER,
  type FilterDateState,
} from "./dates";
import { CLINICAL_ORDER, PULSE_CLINICAL_ORDER } from "./palette";

const ANCHOR = "2025-06-13T09:21:00"; // newest seeded reading

function allFalse<K extends string>(keys: K[]): Record<K, boolean> {
  return Object.fromEntries(keys.map((k) => [k, false])) as Record<
    K,
    boolean
  >;
}

function withTrue<K extends string>(
  keys: K[],
  trueKeys: K[],
): Record<K, boolean> {
  const m = allFalse(keys);
  for (const k of trueKeys) m[k] = true;
  return m;
}

function state(overrides: Partial<FilterDateState> = {}): FilterDateState {
  return {
    datePreset: "all",
    customRange: { from: null, to: null },
    bpCategory: allFalse<BPCategory>(CLINICAL_ORDER),
    pulseCategory: allFalse<PulseCategory>(PULSE_CLINICAL_ORDER),
    timeOfDay: allFalse<TimeOfDayBucket>(TIME_OF_DAY_ORDER),
    ...overrides,
  };
}

describe("parseDateOnly", () => {
  it("parses YYYY-MM-DD as LOCAL midnight, never UTC (Pitfall 1)", () => {
    const d = parseDateOnly("2025-02-22");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(1); // February (0-based)
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(0);
  });
});

describe("formatDateParam", () => {
  it("formats local date components zero-padded as YYYY-MM-DD", () => {
    expect(formatDateParam(new Date(2025, 5, 13))).toBe("2025-06-13");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatDateParam(new Date(2025, 2, 5))).toBe("2025-03-05");
  });
});

describe("formatters", () => {
  it("fmtLongDate renders the UI-SPEC long form", () => {
    expect(fmtLongDate("2025-06-13T09:21:00")).toBe("June 13, 2025");
  });

  it("fmtShortDate renders axis-tick form from epoch ms", () => {
    expect(fmtShortDate(new Date(2025, 5, 13).getTime())).toBe("Jun 13");
  });

  it("fmtTooltipTitle renders the UI-SPEC tooltip title", () => {
    expect(fmtTooltipTitle("2025-06-03T07:42:00")).toBe("June 3, 2025 · 7:42 AM");
  });
});

describe("resolveFilters", () => {
  it("resolves 30d anchored to the newest reading: anchor − 29 days through anchor, inclusive", () => {
    const resolved = resolveFilters(state({ datePreset: "30d" }), ANCHOR);
    expect(resolved).toEqual({ start_date: "2025-05-15", end_date: "2025-06-13" });
  });

  it("resolves 7d anchored to the newest reading", () => {
    const resolved = resolveFilters(state({ datePreset: "7d" }), ANCHOR);
    expect(resolved).toEqual({ start_date: "2025-06-07", end_date: "2025-06-13" });
  });

  it("resolves 90d anchored to the newest reading (month rollover)", () => {
    const resolved = resolveFilters(state({ datePreset: "90d" }), ANCHOR);
    expect(resolved).toEqual({ start_date: "2025-03-16", end_date: "2025-06-13" });
  });

  it('"all" resolves to no date keys', () => {
    expect(resolveFilters(state(), ANCHOR)).toEqual({});
  });

  it("a single true bpCategory key resolves to a one-element array", () => {
    const resolved = resolveFilters(
      state({ bpCategory: withTrue<BPCategory>(CLINICAL_ORDER, ["Stage 1"]) }),
      ANCHOR,
    );
    expect(resolved).toEqual({ bp_category: ["Stage 1"] });
  });

  it("two true bpCategory keys resolve to both elements in the array", () => {
    const resolved = resolveFilters(
      state({
        bpCategory: withTrue<BPCategory>(CLINICAL_ORDER, ["Stage 1", "Stage 2"]),
      }),
      ANCHOR,
    );
    expect(resolved).toEqual({ bp_category: ["Stage 1", "Stage 2"] });
  });

  it("all bpCategory keys true omits bp_category entirely (zero-or-all)", () => {
    const resolved = resolveFilters(
      state({
        bpCategory: withTrue<BPCategory>(CLINICAL_ORDER, CLINICAL_ORDER),
      }),
      ANCHOR,
    );
    expect(resolved.bp_category).toBeUndefined();
  });

  it("no bpCategory keys true omits bp_category entirely (zero-or-all)", () => {
    const resolved = resolveFilters(state(), ANCHOR);
    expect(resolved.bp_category).toBeUndefined();
  });

  it("two true timeOfDay keys resolve to time_of_day array, same zero-or-all behavior", () => {
    const resolved = resolveFilters(
      state({
        timeOfDay: withTrue<TimeOfDayBucket>(TIME_OF_DAY_ORDER, [
          "Morning",
          "Evening",
        ]),
      }),
      ANCHOR,
    );
    expect(resolved).toEqual({ time_of_day: ["Morning", "Evening"] });
  });

  it("all timeOfDay keys true omits time_of_day entirely (zero-or-all)", () => {
    const resolved = resolveFilters(
      state({
        timeOfDay: withTrue<TimeOfDayBucket>(
          TIME_OF_DAY_ORDER,
          TIME_OF_DAY_ORDER,
        ),
      }),
      ANCHOR,
    );
    expect(resolved.time_of_day).toBeUndefined();
  });

  it("custom range passes through non-null from/to", () => {
    const resolved = resolveFilters(
      state({
        datePreset: "custom",
        customRange: { from: "2025-03-01", to: "2025-03-31" },
      }),
      ANCHOR,
    );
    expect(resolved).toEqual({ start_date: "2025-03-01", end_date: "2025-03-31" });
  });

  it("day preset with latestReading null omits date keys (defensive fallback)", () => {
    expect(resolveFilters(state({ datePreset: "30d" }), null)).toEqual({});
  });
});

describe("presetLabel", () => {
  it("is the single source of preset display labels (D-20)", () => {
    expect(presetLabel("all")).toBe("All data");
    expect(presetLabel("7d")).toBe("Last 7 days");
    expect(presetLabel("30d")).toBe("Last 30 days");
    expect(presetLabel("90d")).toBe("Last 90 days");
    expect(presetLabel("custom")).toBe("Custom range");
  });
});

describe("isValidDateText", () => {
  it("accepts a well-formed YYYY-MM-DD date", () => {
    expect(isValidDateText("2025-06-13")).toBe(true);
  });

  it("rejects an impossible date that JS silently rolls over", () => {
    expect(isValidDateText("2025-02-31")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidDateText("")).toBe(false);
  });

  it("rejects the wrong shape", () => {
    expect(isValidDateText("13-06-2025")).toBe(false);
  });
});

describe("combineLocalDateTime", () => {
  it("combines date + time into naive-local seconds-included format (DATA-05)", () => {
    expect(combineLocalDateTime("2025-04-01", "08:00")).toBe("2025-04-01T08:00:00");
  });
});
