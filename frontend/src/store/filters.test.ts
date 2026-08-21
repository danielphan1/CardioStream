// Unit tests for the zustand filter store — DASH-07, D-17/D-19/D-11.
// The store is testable without React via useFilters.getState().
import { beforeEach, describe, expect, it } from "vitest";

import { useFilters } from "./filters";

const INITIAL = {
  activeChart: "bp_timeline" as const,
  datePreset: "all" as const,
  customRange: { from: null, to: null },
  amPm: "all" as const,
  bpCategory: "all" as const,
  overlayDatasets: { labs: false, incidents: false, procedures: false },
};

beforeEach(() => {
  useFilters.setState(INITIAL);
});

describe("useFilters initial state", () => {
  it("defaults to bp_timeline hero (D-03) and the safe 'all' preset", () => {
    const s = useFilters.getState();
    expect(s.activeChart).toBe("bp_timeline");
    expect(s.datePreset).toBe("all");
    expect(s.customRange).toEqual({ from: null, to: null });
    expect(s.amPm).toBe("all");
    expect(s.bpCategory).toBe("all");
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

describe("single-select filters (D-19)", () => {
  it("setAmPm sets and clears the AM/PM filter", () => {
    useFilters.getState().setAmPm("AM");
    expect(useFilters.getState().amPm).toBe("AM");
    useFilters.getState().setAmPm("all");
    expect(useFilters.getState().amPm).toBe("all");
  });

  it("setBpCategory sets and clears the category filter", () => {
    useFilters.getState().setBpCategory("Stage 1");
    expect(useFilters.getState().bpCategory).toBe("Stage 1");
    useFilters.getState().setBpCategory("all");
    expect(useFilters.getState().bpCategory).toBe("all");
  });
});

describe("showAllData (D-11)", () => {
  it("resets every filter but leaves activeChart untouched", () => {
    const s0 = useFilters.getState();
    s0.setActiveChart("pulse_trend");
    s0.setCustomRange("2025-03-01", "2025-03-31");
    s0.setAmPm("PM");
    s0.setBpCategory("Hypertensive Crisis");
    s0.setOverlayDataset("procedures", true);

    useFilters.getState().showAllData();

    const s = useFilters.getState();
    expect(s.activeChart).toBe("pulse_trend"); // D-11: clears filters, not chart
    expect(s.datePreset).toBe("all");
    expect(s.customRange).toEqual({ from: null, to: null });
    expect(s.amPm).toBe("all");
    expect(s.bpCategory).toBe("all");
    expect(s.overlayDatasets).toEqual({
      labs: false,
      incidents: false,
      procedures: false,
    });
  });
});

describe("overlay multi-select (D-01/D-07)", () => {
  it("setOverlayDataset('labs', true) mutates only that dataset's flag", () => {
    useFilters.getState().setOverlayDataset("labs", true);
    expect(useFilters.getState().overlayDatasets).toEqual({
      labs: true,
      incidents: false,
      procedures: false,
    });
  });

  it("setOverlayDataset can toggle a dataset back off", () => {
    useFilters.getState().setOverlayDataset("incidents", true);
    useFilters.getState().setOverlayDataset("incidents", false);
    expect(useFilters.getState().overlayDatasets.incidents).toBe(false);
  });
});
