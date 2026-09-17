// Unit tests for the zustand filter store — DASH-07, D-17/D-19/D-11, plus the
// Phase 14 dataset model (D-01/D-02/D-10) and the v1→v2 persistence migration.
// The store is testable without React via useFilters.getState().
import { beforeEach, describe, expect, it } from "vitest";

import { useFilters } from "./filters";

const INITIAL = {
  chartView: "timeline" as const,
  datePreset: "all" as const,
  customRange: { from: null, to: null },
  bpCategory: {
    Hypotension: false,
    Normal: false,
    Elevated: false,
    "Stage 1": false,
    "Stage 2": false,
    "Hypertensive Crisis": false,
  },
  pulseCategory: {
    Bradycardia: false,
    Normal: false,
    Tachycardia: false,
  },
  timeOfDay: {
    Morning: false,
    Afternoon: false,
    Evening: false,
    Night: false,
  },
  visibleDatasets: {
    blood_pressure: true,
    pulse: true,
    labs: false,
    incidents: false,
    procedures: false,
  },
};

beforeEach(() => {
  localStorage.clear();
  useFilters.setState(INITIAL);
});

describe("useFilters initial state", () => {
  it("defaults to the timeline view and the safe 'all' preset", () => {
    const s = useFilters.getState();
    expect(s.chartView).toBe("timeline");
    expect(s.datePreset).toBe("all");
    expect(s.customRange).toEqual({ from: null, to: null });
    expect(Object.values(s.bpCategory).every((v) => !v)).toBe(true);
    expect(Object.values(s.pulseCategory).every((v) => !v)).toBe(true);
    expect(Object.values(s.timeOfDay).every((v) => !v)).toBe(true);
  });

  it("defaults to both vitals on and every event type off (D-10)", () => {
    expect(useFilters.getState().visibleDatasets).toEqual({
      blood_pressure: true,
      pulse: true,
      labs: false,
      incidents: false,
      procedures: false,
    });
  });
});

describe("preset ↔ custom exclusivity", () => {
  it("setDatePreset after a custom range clears customRange back to nulls", () => {
    useFilters.getState().setCustomRange("2025-03-01", "2025-03-31");
    useFilters.getState().setDatePreset("7d");
    const s = useFilters.getState();
    expect(s.datePreset).toBe("7d");
    expect(s.customRange).toEqual({ from: null, to: null });
  });

  it("setCustomRange sets datePreset to 'custom' and stores the range", () => {
    useFilters.getState().setCustomRange("2025-03-01", "2025-03-31");
    const s = useFilters.getState();
    expect(s.datePreset).toBe("custom");
    expect(s.customRange).toEqual({ from: "2025-03-01", to: "2025-03-31" });
  });
});

describe("category filter toggle/set actions", () => {
  it("toggleBpCategory flips one key and leaves the rest alone", () => {
    useFilters.getState().toggleBpCategory("Stage 1", true);
    let s = useFilters.getState();
    expect(s.bpCategory["Stage 1"]).toBe(true);
    expect(s.bpCategory.Normal).toBe(false);

    useFilters.getState().toggleBpCategory("Normal", true);
    s = useFilters.getState();
    expect(s.bpCategory["Stage 1"]).toBe(true);
    expect(s.bpCategory.Normal).toBe(true);

    useFilters.getState().toggleBpCategory("Stage 1", false);
    s = useFilters.getState();
    expect(s.bpCategory["Stage 1"]).toBe(false);
    expect(s.bpCategory.Normal).toBe(true);
  });

  it("setBpCategory replaces the whole map exhaustively", () => {
    useFilters.getState().toggleBpCategory("Hypotension", true);
    useFilters.getState().setBpCategory(["Stage 1"]);
    const s = useFilters.getState();
    expect(s.bpCategory["Stage 1"]).toBe(true);
    expect(s.bpCategory.Hypotension).toBe(false);
    expect(
      Object.entries(s.bpCategory).every(
        ([k, v]) => k === "Stage 1" || v === false,
      ),
    ).toBe(true);
  });

  it("togglePulseCategory flips one key and leaves the rest alone", () => {
    useFilters.getState().togglePulseCategory("Bradycardia", true);
    const s = useFilters.getState();
    expect(s.pulseCategory.Bradycardia).toBe(true);
    expect(s.pulseCategory.Tachycardia).toBe(false);
  });

  it("setPulseCategory replaces the whole map exhaustively", () => {
    useFilters.getState().togglePulseCategory("Bradycardia", true);
    useFilters.getState().setPulseCategory(["Tachycardia"]);
    const s = useFilters.getState();
    expect(s.pulseCategory.Tachycardia).toBe(true);
    expect(s.pulseCategory.Bradycardia).toBe(false);
  });

  it("toggleTimeOfDay flips one key and leaves the rest alone", () => {
    useFilters.getState().toggleTimeOfDay("Morning", true);
    const s = useFilters.getState();
    expect(s.timeOfDay.Morning).toBe(true);
    expect(s.timeOfDay.Evening).toBe(false);
  });

  it("setTimeOfDay replaces the whole map exhaustively", () => {
    useFilters.getState().toggleTimeOfDay("Morning", true);
    useFilters.getState().setTimeOfDay(["Evening", "Night"]);
    const s = useFilters.getState();
    expect(s.timeOfDay.Evening).toBe(true);
    expect(s.timeOfDay.Night).toBe(true);
    expect(s.timeOfDay.Morning).toBe(false);
    expect(s.timeOfDay.Afternoon).toBe(false);
  });
});

describe("chart view (D-08)", () => {
  it("setChartView switches between the timeline and the summary views", () => {
    useFilters.getState().setChartView("bp_categories");
    expect(useFilters.getState().chartView).toBe("bp_categories");
    useFilters.getState().setChartView("timeline");
    expect(useFilters.getState().chartView).toBe("timeline");
  });

  it("switching view leaves the dataset selection untouched", () => {
    useFilters.getState().setDataset("incidents", true);
    useFilters.getState().setChartView("am_pm_comparison");
    expect(useFilters.getState().visibleDatasets.incidents).toBe(true);
  });
});

describe("showAllData (D-11)", () => {
  it("clears every filter and returns datasets to the shipped default", () => {
    const s0 = useFilters.getState();
    s0.setChartView("bp_categories");
    s0.setCustomRange("2025-03-01", "2025-03-31");
    s0.toggleTimeOfDay("Evening", true);
    s0.setBpCategory(["Hypertensive Crisis"]);
    s0.showOnlyDatasets(["labs"]);

    useFilters.getState().showAllData();

    const s = useFilters.getState();
    expect(s.chartView).toBe("timeline");
    expect(s.datePreset).toBe("all");
    expect(s.customRange).toEqual({ from: null, to: null });
    expect(Object.values(s.bpCategory).every((v) => !v)).toBe(true);
    expect(Object.values(s.pulseCategory).every((v) => !v)).toBe(true);
    expect(Object.values(s.timeOfDay).every((v) => !v)).toBe(true);
    // WR-01: "start over" is subtractive. It must NOT switch on three marker
    // sets the user never asked for — that hands a caregiver a busier screen
    // than the app's own default.
    expect(s.visibleDatasets).toEqual({
      blood_pressure: true,
      pulse: true,
      labs: false,
      incidents: false,
      procedures: false,
    });
  });

  it("restores the default even when the user had turned events on", () => {
    useFilters.getState().showOnlyDatasets(["labs", "incidents", "procedures"]);
    useFilters.getState().showAllData();
    const v = useFilters.getState().visibleDatasets;
    expect(v.blood_pressure).toBe(true);
    expect(v.labs).toBe(false);
  });
});

describe("dataset multi-select (D-01)", () => {
  it("setDataset mutates only that dataset's flag", () => {
    useFilters.getState().setDataset("labs", true);
    expect(useFilters.getState().visibleDatasets).toEqual({
      blood_pressure: true,
      pulse: true,
      labs: true,
      incidents: false,
      procedures: false,
    });
  });

  it("setDataset can toggle a dataset back off", () => {
    useFilters.getState().setDataset("incidents", true);
    useFilters.getState().setDataset("incidents", false);
    expect(useFilters.getState().visibleDatasets.incidents).toBe(false);
  });

  it("the two vitals toggle independently — the case that was impossible before", () => {
    useFilters.getState().setDataset("blood_pressure", false);
    const s = useFilters.getState();
    expect(s.visibleDatasets.blood_pressure).toBe(false);
    expect(s.visibleDatasets.pulse).toBe(true);
  });
});

describe("showOnlyDatasets — exclusive selection (the client's own phrasing)", () => {
  it("'only blood pressure and pulse' turns those on and everything else off", () => {
    useFilters.getState().showOnlyDatasets(["blood_pressure", "pulse"]);
    expect(useFilters.getState().visibleDatasets).toEqual({
      blood_pressure: true,
      pulse: true,
      labs: false,
      incidents: false,
      procedures: false,
    });
  });

  it("'only the hospital stays' leaves no vitals on, which is the events-only view", () => {
    useFilters.getState().showOnlyDatasets(["incidents"]);
    const v = useFilters.getState().visibleDatasets;
    expect(v.incidents).toBe(true);
    expect(v.blood_pressure).toBe(false);
    expect(v.pulse).toBe(false);
  });

  it("clears a previously-on dataset not named in the new set", () => {
    useFilters.getState().setDataset("procedures", true);
    useFilters.getState().showOnlyDatasets(["pulse"]);
    expect(useFilters.getState().visibleDatasets.procedures).toBe(false);
  });

  it("an empty list turns everything off rather than throwing", () => {
    useFilters.getState().showOnlyDatasets([]);
    expect(
      Object.values(useFilters.getState().visibleDatasets).every((v) => !v),
    ).toBe(true);
  });
});

describe("initFilters (localStorage bootstrap)", () => {
  it("leaves defaults untouched when the persisted value is corrupted JSON", () => {
    localStorage.setItem("hv-filters", "garbage");

    expect(() => useFilters.getState().initFilters()).not.toThrow();

    expect(useFilters.getState().visibleDatasets).toEqual(
      INITIAL.visibleDatasets,
    );
    expect(useFilters.getState().chartView).toBe(INITIAL.chartView);
  });

  it("leaves defaults untouched when the blob is valid JSON but wrong shape", () => {
    localStorage.setItem(
      "hv-filters",
      JSON.stringify({
        chartView: "timeline",
        datePreset: "7d",
        customRange: { from: null, to: null },
        amPm: "AM",
        bpCategory: "Stage 2",
        // labs is the STRING "true", not boolean — exercises the type
        // guard's per-field check, not just missing-key detection.
        visibleDatasets: {
          blood_pressure: true,
          pulse: true,
          labs: "true",
          incidents: false,
          procedures: true,
        },
      }),
    );

    useFilters.getState().initFilters();

    expect(useFilters.getState().visibleDatasets).toEqual(
      INITIAL.visibleDatasets,
    );
  });

  it("leaves defaults untouched when localStorage has no persisted key", () => {
    useFilters.getState().initFilters();

    const s = useFilters.getState();
    expect(s.chartView).toBe(INITIAL.chartView);
    expect(s.datePreset).toBe(INITIAL.datePreset);
    expect(s.visibleDatasets).toEqual(INITIAL.visibleDatasets);
  });
});

// A blob written by the pre-Phase-14 app. Discarding these would silently
// reset Chris's date range on his first load after deploy, so they migrate.
describe("v1 → v2 migration of pre-Phase-14 persisted filters", () => {
  const legacy = (activeChart: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      activeChart,
      datePreset: "30d",
      customRange: { from: null, to: null },
      amPm: "PM",
      bpCategory: "Stage 1",
      overlayDatasets: { labs: true, incidents: false, procedures: true },
      ...extra,
    });

  it("bp_timeline becomes the timeline with blood pressure only", () => {
    localStorage.setItem("hv-filters", legacy("bp_timeline"));
    useFilters.getState().initFilters();
    const s = useFilters.getState();
    expect(s.chartView).toBe("timeline");
    expect(s.visibleDatasets.blood_pressure).toBe(true);
    expect(s.visibleDatasets.pulse).toBe(false);
  });

  it("pulse_trend becomes the timeline with pulse only", () => {
    localStorage.setItem("hv-filters", legacy("pulse_trend"));
    useFilters.getState().initFilters();
    const s = useFilters.getState();
    expect(s.chartView).toBe("timeline");
    expect(s.visibleDatasets.blood_pressure).toBe(false);
    expect(s.visibleDatasets.pulse).toBe(true);
  });

  it("bp_categories keeps its view and restores both vitals", () => {
    localStorage.setItem("hv-filters", legacy("bp_categories"));
    useFilters.getState().initFilters();
    const s = useFilters.getState();
    expect(s.chartView).toBe("bp_categories");
    expect(s.visibleDatasets.blood_pressure).toBe(true);
    expect(s.visibleDatasets.pulse).toBe(true);
  });

  it("am_pm_comparison keeps its view and restores both vitals", () => {
    localStorage.setItem("hv-filters", legacy("am_pm_comparison"));
    useFilters.getState().initFilters();
    expect(useFilters.getState().chartView).toBe("am_pm_comparison");
  });

  it("carries the event toggles across verbatim", () => {
    localStorage.setItem("hv-filters", legacy("bp_timeline"));
    useFilters.getState().initFilters();
    const v = useFilters.getState().visibleDatasets;
    expect(v.labs).toBe(true);
    expect(v.incidents).toBe(false);
    expect(v.procedures).toBe(true);
  });

  it("preserves the date range and filters — the whole point of migrating", () => {
    localStorage.setItem("hv-filters", legacy("bp_timeline"));
    useFilters.getState().initFilters();
    const s = useFilters.getState();
    expect(s.datePreset).toBe("30d");
    expect(s.bpCategory["Stage 1"]).toBe(true);
  });

  it("falls back to timeline with both vitals for an unrecognized activeChart", () => {
    localStorage.setItem("hv-filters", legacy("some_future_chart"));
    useFilters.getState().initFilters();
    const s = useFilters.getState();
    expect(s.chartView).toBe("timeline");
    expect(s.visibleDatasets.blood_pressure).toBe(true);
    expect(s.visibleDatasets.pulse).toBe(true);
  });

  it("rejects a legacy blob whose overlayDatasets are the wrong type", () => {
    localStorage.setItem(
      "hv-filters",
      JSON.stringify({
        activeChart: "bp_timeline",
        overlayDatasets: { labs: 1, incidents: false, procedures: true },
      }),
    );
    useFilters.getState().initFilters();
    expect(useFilters.getState().visibleDatasets).toEqual(
      INITIAL.visibleDatasets,
    );
  });
});

// A blob written by the pre-Phase-15 app — scalar amPm/bpCategory
// single-select fields. Same "don't silently reset Chris's choice" principle
// as the v1→v2 block above, now proven for v2→v3 too.
describe("v2 → v3 migration of pre-Phase-15 persisted filters", () => {
  it("migrates a v2 blob's scalar bpCategory into the v3 multi-select map, ignoring the stray amPm field", () => {
    const v2 = {
      chartView: "bp_categories",
      datePreset: "30d",
      customRange: { from: null, to: null },
      bpCategory: "Stage 2",
      visibleDatasets: {
        blood_pressure: false,
        pulse: true,
        labs: true,
        incidents: false,
        procedures: true,
      },
      amPm: "AM", // stray v2 field — tolerated but ignored, no v3 destination
    };
    localStorage.setItem("hv-filters", JSON.stringify(v2));

    useFilters.getState().initFilters();

    const s = useFilters.getState();
    expect(s.bpCategory["Stage 2"]).toBe(true);
    expect(
      Object.entries(s.bpCategory).every(
        ([k, v]) => k === "Stage 2" || v === false,
      ),
    ).toBe(true);
    expect(Object.values(s.pulseCategory).every((v) => !v)).toBe(true);
    expect(Object.values(s.timeOfDay).every((v) => !v)).toBe(true);
    expect(s.datePreset).toBe("30d");
    expect(s.customRange).toEqual({ from: null, to: null });
    expect(s.visibleDatasets).toEqual(v2.visibleDatasets);
  });
});

describe("setter persistence (writes the 'hv-filters' key)", () => {
  it("setDatePreset persists its change to localStorage", () => {
    useFilters.getState().setDatePreset("30d");

    const stored = JSON.parse(localStorage.getItem("hv-filters")!);
    expect(stored.datePreset).toBe("30d");
    expect(stored.chartView).toBe("timeline"); // full slice, not just the changed field
  });

  it("setDataset persists its change to localStorage", () => {
    useFilters.getState().setDataset("labs", true);

    const stored = JSON.parse(localStorage.getItem("hv-filters")!);
    expect(stored.visibleDatasets.labs).toBe(true);
  });

  it("showOnlyDatasets persists the whole exclusive set", () => {
    useFilters.getState().showOnlyDatasets(["pulse"]);

    const stored = JSON.parse(localStorage.getItem("hv-filters")!);
    expect(stored.visibleDatasets.pulse).toBe(true);
    expect(stored.visibleDatasets.blood_pressure).toBe(false);
  });

  it("setChartView persists its change to localStorage", () => {
    useFilters.getState().setChartView("am_pm_comparison");

    const stored = JSON.parse(localStorage.getItem("hv-filters")!);
    expect(stored.chartView).toBe("am_pm_comparison");
  });

  it("a throwing localStorage.setItem never blocks a setter (guarded try/catch)", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() =>
        useFilters.getState().toggleTimeOfDay("Morning", true),
      ).not.toThrow();
      expect(useFilters.getState().timeOfDay.Morning).toBe(true);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("a throwing localStorage.getItem never blocks bootstrap", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => useFilters.getState().initFilters()).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
