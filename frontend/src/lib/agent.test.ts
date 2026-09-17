// Unit tests for lib/agent.ts — VOICE-06, D-07, D-08, D-13.
// The zustand filter store is REAL (no mock): applyAgentFilters mutates it via
// getState() outside the React tree, exactly as production does. Reset both the
// filter store and the pulse signal to defaults between tests.
import { beforeEach, describe, expect, it } from "vitest";

import { useFilters } from "../store/filters";
import { useGuide } from "../store/guide";
import { useSpeech } from "../store/speech";
import {
  applyAgentFilters,
  composeConfirmation,
  useAgentPulse,
  type PulseField,
} from "./agent";
import type {
  BPCategory,
  ChartView,
  PulseCategory,
  SeriesDataset,
  TimeOfDayBucket,
} from "../api/types";
import { CLINICAL_ORDER, PULSE_CLINICAL_ORDER } from "./palette";
import { TIME_OF_DAY_ORDER, type DatePreset } from "./dates";

const ALL_FALSE_BP: Record<BPCategory, boolean> = Object.fromEntries(
  CLINICAL_ORDER.map((c) => [c, false]),
) as Record<BPCategory, boolean>;
const ALL_FALSE_PULSE: Record<PulseCategory, boolean> = Object.fromEntries(
  PULSE_CLINICAL_ORDER.map((c) => [c, false]),
) as Record<PulseCategory, boolean>;
const ALL_FALSE_TOD: Record<TimeOfDayBucket, boolean> = Object.fromEntries(
  TIME_OF_DAY_ORDER.map((c) => [c, false]),
) as Record<TimeOfDayBucket, boolean>;

beforeEach(() => {
  useFilters.setState({
    chartView: "timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    bpCategory: { ...ALL_FALSE_BP },
    pulseCategory: { ...ALL_FALSE_PULSE },
    timeOfDay: { ...ALL_FALSE_TOD },
    visibleDatasets: {
      blood_pressure: true,
      pulse: true,
      labs: false,
      incidents: false,
      procedures: false,
    },
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
  useSpeech.setState({ enabled: true, isSpeaking: false, primed: false });
  useGuide.setState({ open: false });
});

type ConfState = {
  chartView: ChartView;
  visibleDatasets: Record<SeriesDataset, boolean>;
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null };
  bpCategory: Record<BPCategory, boolean>;
  pulseCategory: Record<PulseCategory, boolean>;
  timeOfDay: Record<TimeOfDayBucket, boolean>;
};

function confState(overrides: Partial<ConfState> = {}): ConfState {
  return {
    chartView: "timeline",
    visibleDatasets: {
      blood_pressure: true,
      pulse: false,
      labs: false,
      incidents: false,
      procedures: false,
    },
    datePreset: "all",
    customRange: { from: null, to: null },
    bpCategory: { ...ALL_FALSE_BP },
    pulseCategory: { ...ALL_FALSE_PULSE },
    timeOfDay: { ...ALL_FALSE_TOD },
    ...overrides,
  };
}

describe("applyAgentFilters", () => {
  it("changes only the mentioned field; other filters carry over (D-13)", () => {
    useFilters.setState({
      datePreset: "30d",
      timeOfDay: { ...ALL_FALSE_TOD, Morning: true },
    });

    applyAgentFilters({ showOnly: ["pulse"] });

    const s = useFilters.getState();
    expect(s.visibleDatasets.pulse).toBe(true);
    expect(s.visibleDatasets.blood_pressure).toBe(false);
    expect(s.datePreset).toBe("30d"); // survived
    expect(s.timeOfDay.Morning).toBe(true); // survived
  });

  it("reset returns the store to defaults", () => {
    useFilters.setState({
      datePreset: "30d",
      timeOfDay: { ...ALL_FALSE_TOD, Morning: true },
      bpCategory: { ...ALL_FALSE_BP, "Stage 2": true },
    });

    applyAgentFilters({ reset: true });

    const s = useFilters.getState();
    expect(s.datePreset).toBe("all");
    expect(Object.values(s.timeOfDay).every((v) => v === false)).toBe(true);
    expect(Object.values(s.bpCategory).every((v) => v === false)).toBe(true);
  });

  it("applies reset FIRST, then per-field deltas", () => {
    useFilters.setState({
      datePreset: "30d",
      bpCategory: { ...ALL_FALSE_BP, "Stage 2": true },
    });

    applyAgentFilters({
      reset: true,
      showOnly: ["pulse"],
      timeOfDay: ["Morning"],
    });

    const s = useFilters.getState();
    expect(s.visibleDatasets.pulse).toBe(true); // delta applied after reset
    expect(s.visibleDatasets.blood_pressure).toBe(false);
    expect(s.timeOfDay).toEqual({ ...ALL_FALSE_TOD, Morning: true }); // delta after reset
    expect(s.datePreset).toBe("all"); // reset default (no delta)
    expect(Object.values(s.bpCategory).every((v) => v === false)).toBe(true); // reset default (no delta)
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
      showOnly: ["pulse"],
      bpCategory: ["Stage 1"],
    });

    expect([...fields].sort()).toEqual(["bpCategory", "datasets"]);
    const pulse = useAgentPulse.getState();
    expect([...pulse.fields].sort()).toEqual(["bpCategory", "datasets"]);
    expect(pulse.seq).toBe(1); // bumped from 0
  });

  it("reset marks all six pulse groups", () => {
    applyAgentFilters({ reset: true });

    const expected: PulseField[] = [
      "bpCategory",
      "chart",
      "dateRange",
      "datasets",
      "pulseCategory",
      "timeOfDay",
    ].sort() as PulseField[];
    expect([...useAgentPulse.getState().fields].sort()).toEqual(expected);
  });

  it("overlayDataset + overlayState is ADDITIVE — one dataset, others untouched", () => {
    applyAgentFilters({ overlayDataset: "labs", overlayState: "on" });

    const v = useFilters.getState().visibleDatasets;
    expect(v.labs).toBe(true);
    expect(v.blood_pressure).toBe(true); // survived — this path never clears
    expect(useAgentPulse.getState().fields).toContain("datasets");
  });

  it("datasetsOn turns several on additively, leaving the rest", () => {
    applyAgentFilters({ datasetsOn: ["incidents"] });

    const v = useFilters.getState().visibleDatasets;
    expect(v.incidents).toBe(true);
    expect(v.blood_pressure).toBe(true);
    expect(v.pulse).toBe(true);
  });

  it("showOnly is EXCLUSIVE — the client's own 'only ...' phrasing", () => {
    applyAgentFilters({ showOnly: ["blood_pressure", "pulse"] });

    expect(useFilters.getState().visibleDatasets).toEqual({
      blood_pressure: true,
      pulse: true,
      labs: false,
      incidents: false,
      procedures: false,
    });
  });

  it("applies showOnly LAST so an exclusive instruction wins over an additive one", () => {
    applyAgentFilters({
      datasetsOn: ["procedures"],
      showOnly: ["pulse"],
    });

    const v = useFilters.getState().visibleDatasets;
    expect(v.pulse).toBe(true);
    expect(v.procedures).toBe(false);
  });

  it("a showOnly delta closes an open guide (hasOtherCommand enumeration)", () => {
    useGuide.setState({ open: true });

    applyAgentFilters({ showOnly: ["pulse"] });

    expect(useGuide.getState().open).toBe(false);
  });

  it("an empty showOnly list is ignored rather than blanking the dashboard", () => {
    applyAgentFilters({ showOnly: [] });

    expect(useFilters.getState().visibleDatasets.blood_pressure).toBe(true);
  });

  it("speechEnabled reaches useSpeech.setEnabled without touching the pulse (no PulseField for it)", () => {
    const fields = applyAgentFilters({ speechEnabled: "off" });

    expect(useSpeech.getState().enabled).toBe(false);
    expect(fields).toEqual([]);
  });

  it("guideOpen reaches useGuide.setOpen without touching the pulse", () => {
    const fields = applyAgentFilters({ guideOpen: "open" });

    expect(useGuide.getState().open).toBe(true);
    expect(fields).toEqual([]);
  });

  it("an unrelated command auto-closes an already-open guide (D-07)", () => {
    useGuide.setState({ open: true });

    applyAgentFilters({ showOnly: ["pulse"] });

    expect(useGuide.getState().open).toBe(false);
  });

  it("a guideOpen-only delta does not spuriously re-trigger the auto-close path", () => {
    useGuide.setState({ open: true });

    applyAgentFilters({ guideOpen: "closed" });

    expect(useGuide.getState().open).toBe(false);
  });

  it("reset also auto-closes an already-open guide", () => {
    useGuide.setState({ open: true });

    applyAgentFilters({ reset: true });

    expect(useGuide.getState().open).toBe(false);
  });
});

describe("composeConfirmation", () => {
  it("emits the VOICE-06/D-07 canonical string exactly", () => {
    expect(
      composeConfirmation(
        confState({ datePreset: "30d", amPm: "AM" }),
        null,
      ),
    ).toBe("Showing blood pressure, last 30 days, mornings");
  });

  it("renders a custom range with parseDateOnly-safe long dates", () => {
    expect(
      composeConfirmation(
        confState({
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
          visibleDatasets: {
            blood_pressure: false,
            pulse: true,
            labs: false,
            incidents: false,
            procedures: false,
          },
          datePreset: "all",
          amPm: "PM",
          bpCategory: "Stage 2",
        }),
        null,
      ),
    ).toBe("Showing pulse, all data, evenings, Stage 2 readings only");
  });
});
