// Unit tests for lib/agent.ts — VOICE-06, D-07, D-08, D-13.
// The zustand filter store is REAL (no mock): applyAgentFilters mutates it via
// getState() outside the React tree, exactly as production does. Reset both the
// filter store and the pulse signal to defaults between tests.
import { beforeEach, describe, expect, it } from "vitest";

import { useFilters } from "../store/filters";
import {
  applyAgentFilters,
  composeConfirmation,
  useAgentPulse,
  type PulseField,
} from "./agent";
import type { ChartId, BPCategory } from "../api/types";
import type { DatePreset } from "./dates";

beforeEach(() => {
  useFilters.setState({
    activeChart: "bp_timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
    overlayDatasets: { labs: false, incidents: false, procedures: false },
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
});

type ConfState = {
  activeChart: ChartId;
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null };
  amPm: "all" | "AM" | "PM";
  bpCategory: "all" | BPCategory;
};

function confState(overrides: Partial<ConfState> = {}): ConfState {
  return {
    activeChart: "bp_timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
    ...overrides,
  };
}

describe("applyAgentFilters", () => {
  it("changes only the mentioned field; other filters carry over (D-13)", () => {
    useFilters.setState({ datePreset: "30d", amPm: "AM" });

    applyAgentFilters({ activeChart: "pulse_trend" });

    const s = useFilters.getState();
    expect(s.activeChart).toBe("pulse_trend");
    expect(s.datePreset).toBe("30d"); // survived
    expect(s.amPm).toBe("AM"); // survived
  });

  it("reset returns the store to defaults", () => {
    useFilters.setState({
      datePreset: "30d",
      amPm: "AM",
      bpCategory: "Stage 2",
    });

    applyAgentFilters({ reset: true });

    const s = useFilters.getState();
    expect(s.datePreset).toBe("all");
    expect(s.amPm).toBe("all");
    expect(s.bpCategory).toBe("all");
  });

  it("applies reset FIRST, then per-field deltas", () => {
    useFilters.setState({ datePreset: "30d", bpCategory: "Stage 2" });

    applyAgentFilters({ reset: true, activeChart: "pulse_trend", amPm: "AM" });

    const s = useFilters.getState();
    expect(s.activeChart).toBe("pulse_trend"); // delta after reset
    expect(s.amPm).toBe("AM"); // delta after reset
    expect(s.datePreset).toBe("all"); // reset default (no delta)
    expect(s.bpCategory).toBe("all"); // reset default (no delta)
  });

  it("custom range sets datePreset custom and stores strings verbatim (Pitfall 7)", () => {
    applyAgentFilters({ customRange: { from: "2025-02-01", to: "2025-04-30" } });

    const s = useFilters.getState();
    expect(s.datePreset).toBe("custom");
    expect(s.customRange).toEqual({ from: "2025-02-01", to: "2025-04-30" });
  });

  it("a day preset clears any prior custom range (store built-in)", () => {
    useFilters.getState().setCustomRange("2025-02-01", "2025-04-30");

    applyAgentFilters({ datePreset: "30d" });

    const s = useFilters.getState();
    expect(s.datePreset).toBe("30d");
    expect(s.customRange).toEqual({ from: null, to: null });
  });

  it("marks a D-08 pulse for exactly the touched groups and bumps seq", () => {
    const fields = applyAgentFilters({
      activeChart: "pulse_trend",
      amPm: "AM",
    });

    expect([...fields].sort()).toEqual(["amPm", "chart"]);
    const pulse = useAgentPulse.getState();
    expect([...pulse.fields].sort()).toEqual(["amPm", "chart"]);
    expect(pulse.seq).toBe(1); // bumped from 0
  });

  it("reset marks all five pulse groups", () => {
    applyAgentFilters({ reset: true });

    const expected: PulseField[] = [
      "amPm",
      "bpCategory",
      "chart",
      "dateRange",
      "overlay",
    ];
    expect([...useAgentPulse.getState().fields].sort()).toEqual(expected);
  });

  it("overlayDataset + overlayState reaches setOverlayDataset and pulses overlay", () => {
    applyAgentFilters({ overlayDataset: "labs", overlayState: "on" });

    expect(useFilters.getState().overlayDatasets.labs).toBe(true);
    expect(useAgentPulse.getState().fields).toContain("overlay");
  });
});

describe("composeConfirmation", () => {
  it("emits the VOICE-06/D-07 canonical string exactly", () => {
    expect(
      composeConfirmation(
        confState({ activeChart: "bp_timeline", datePreset: "30d", amPm: "AM" }),
        null,
      ),
    ).toBe("Showing blood pressure, last 30 days, mornings");
  });

  it("renders a custom range with parseDateOnly-safe long dates", () => {
    expect(
      composeConfirmation(
        confState({
          activeChart: "bp_timeline",
          datePreset: "custom",
          customRange: { from: "2025-02-01", to: "2025-04-30" },
        }),
        null,
      ),
    ).toBe("Showing blood pressure, February 1, 2025 through April 30, 2025");
  });

  it("composes pulse + PM + category suffix from all data", () => {
    expect(
      composeConfirmation(
        confState({
          activeChart: "pulse_trend",
          datePreset: "all",
          amPm: "PM",
          bpCategory: "Stage 2",
        }),
        null,
      ),
    ).toBe("Showing pulse, all data, evenings, Stage 2 readings only");
  });
});
