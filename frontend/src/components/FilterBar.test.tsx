// Behavior tests for FilterBar (Phase 15, PH15-01) — the converted 4-group
// multi-select checkbox surface (Date unchanged, Time of Day + BP Category +
// Pulse Category as real checkboxes). Locks the phase's headline capability
// (two categories in the same group can both apply at once) and the 48px
// target floor. Structured after ShowPanel.test.tsx, the closest existing
// checkbox-group component test.
//
// BP Category and Pulse Category both include a "Normal" option, so every
// checkbox lookup below is scoped to its own role="group" container via
// `within` rather than queried globally — a bare `screen.getByRole("checkbox",
// { name: "Normal" })` would ambiguously match both groups.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CLINICAL_ORDER, PULSE_CLINICAL_ORDER } from "../lib/palette";
import { useFilters } from "../store/filters";
import { FilterBar } from "./FilterBar";

const TIME_OF_DAY_LABELS = ["Morning", "Afternoon", "Evening", "Night"];

const INITIAL_FILTERS = {
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
  useFilters.setState(INITIAL_FILTERS);
});

const timeOfDayGroup = () => screen.getByRole("group", { name: "Time of day" });
const bpCategoryGroup = () =>
  screen.getByRole("group", { name: "Blood pressure category" });
const pulseCategoryGroup = () =>
  screen.getByRole("group", { name: "Pulse category" });

describe("Time of Day checkbox group", () => {
  it("renders exactly 4 checkboxes with the correct accessible names", () => {
    render(<FilterBar />);
    const group = timeOfDayGroup();
    expect(within(group).getAllByRole("checkbox")).toHaveLength(4);
    for (const label of TIME_OF_DAY_LABELS) {
      expect(within(group).getByRole("checkbox", { name: label })).toBeTruthy();
    }
  });

  it("checking Morning mutates only timeOfDay.Morning, leaving siblings alone", () => {
    render(<FilterBar />);
    fireEvent.click(
      within(timeOfDayGroup()).getByRole("checkbox", { name: "Morning" }),
    );
    const t = useFilters.getState().timeOfDay;
    expect(t.Morning).toBe(true);
    expect(t.Afternoon).toBe(false);
    expect(t.Evening).toBe(false);
    expect(t.Night).toBe(false);
    // Other groups untouched.
    expect(Object.values(useFilters.getState().bpCategory).every((v) => !v)).toBe(
      true,
    );
    expect(
      Object.values(useFilters.getState().pulseCategory).every((v) => !v),
    ).toBe(true);
  });

  it("checking both Morning and Evening leaves BOTH true — multi-select", () => {
    render(<FilterBar />);
    const group = timeOfDayGroup();
    fireEvent.click(within(group).getByRole("checkbox", { name: "Morning" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Evening" }));
    const t = useFilters.getState().timeOfDay;
    expect(t.Morning).toBe(true);
    expect(t.Evening).toBe(true);
  });
});

describe("BP Category checkbox group", () => {
  it("renders exactly 6 checkboxes named after CLINICAL_ORDER", () => {
    render(<FilterBar />);
    const group = bpCategoryGroup();
    expect(within(group).getAllByRole("checkbox")).toHaveLength(6);
    for (const label of CLINICAL_ORDER) {
      expect(within(group).getByRole("checkbox", { name: label })).toBeTruthy();
    }
  });

  it("checking Stage 1 then Stage 2 leaves BOTH true — 'Stage 1 AND Stage 2', the phase's headline capability, inexpressible under the old single-select buttons", () => {
    render(<FilterBar />);
    const group = bpCategoryGroup();
    fireEvent.click(within(group).getByRole("checkbox", { name: "Stage 1" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Stage 2" }));
    const b = useFilters.getState().bpCategory;
    expect(b["Stage 1"]).toBe(true);
    expect(b["Stage 2"]).toBe(true);
  });
});

describe("Pulse Category checkbox group", () => {
  it("renders exactly 3 checkboxes named after PULSE_CLINICAL_ORDER", () => {
    render(<FilterBar />);
    const group = pulseCategoryGroup();
    expect(within(group).getAllByRole("checkbox")).toHaveLength(3);
    for (const label of PULSE_CLINICAL_ORDER) {
      expect(within(group).getByRole("checkbox", { name: label })).toBeTruthy();
    }
  });

  it("checking Tachycardia sets only that key true", () => {
    render(<FilterBar />);
    fireEvent.click(
      within(pulseCategoryGroup()).getByRole("checkbox", { name: "Tachycardia" }),
    );
    const p = useFilters.getState().pulseCategory;
    expect(p.Tachycardia).toBe(true);
    expect(p.Bradycardia).toBe(false);
    expect(p.Normal).toBe(false);
  });
});

// The "live sentence — zero-or-all convention" describe that used to sit here
// is gone with the sentence itself (16.1-07, UI-SPEC 5.4): FilterBar renders
// no sentence and no live region any more. Its coverage was not dropped — the
// zero-or-all string logic is owned by lib/showSentence.test.ts and the
// rendering by FilterStateBlock.test.tsx, both of which shipped in plan
// 16.1-04.

describe("48px accessibility floor", () => {
  it("every checkbox-bearing label carries min-h-12", () => {
    const { container } = render(<FilterBar />);
    const labels = container.querySelectorAll("label");
    // 4 Time of Day + 6 BP Category + 3 Pulse Category = 13 real <label>s.
    // Date stays exclusive buttons, so it contributes none here.
    expect(labels).toHaveLength(13);
    for (const label of Array.from(labels)) {
      expect(label.className).toContain("min-h-12");
    }
  });
});
