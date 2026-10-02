// Behavior tests for ShowPanel (Phase 14, D-01/D-02/D-07/D-08) — the
// five-dataset checkbox row that replaced the chart picker AND OverlayToggle.
// Locks real checkbox semantics, the 48px target floor, independent toggling
// of the two vitals, and the never-disabled indicator ported from the deleted
// OverlayToggle suite. The sentence and note assertions moved out in 16.1-07
// with the paragraphs themselves — see the two notes further down.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAgentPulse } from "../lib/agent";
import { useFilters } from "../store/filters";
import { ShowPanel } from "./ShowPanel";

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
  pulseCategory: { Bradycardia: false, Normal: false, Tachycardia: false },
  timeOfDay: { Morning: false, Afternoon: false, Evening: false, Night: false },
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
  useAgentPulse.setState({ seq: 0, fields: [] });
});

const LABELS = [
  "Blood Pressure",
  "Pulse",
  "Labs",
  "Incidents",
  "Procedures",
];

describe("ShowPanel checkbox group", () => {
  it("renders exactly five real checkboxes, one per dataset", () => {
    render(<ShowPanel />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(5);
    for (const label of LABELS) {
      expect(screen.getByRole("checkbox", { name: label })).toBeTruthy();
    }
  });

  it("reflects store state as checked/unchecked", () => {
    render(<ShowPanel />);
    expect(
      (screen.getByRole("checkbox", { name: "Blood Pressure" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: "Labs" }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("ticking a box turns that dataset on and leaves the others alone", () => {
    render(<ShowPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Labs" }));

    const v = useFilters.getState().visibleDatasets;
    expect(v.labs).toBe(true);
    expect(v.blood_pressure).toBe(true);
    expect(v.pulse).toBe(true);
    expect(v.incidents).toBe(false);
  });

  it("unticking a box turns that dataset off", () => {
    render(<ShowPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Pulse" }));
    expect(useFilters.getState().visibleDatasets.pulse).toBe(false);
  });

  it("the two vitals toggle independently — impossible before Phase 14", () => {
    render(<ShowPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Blood Pressure" }));

    const v = useFilters.getState().visibleDatasets;
    expect(v.blood_pressure).toBe(false);
    expect(v.pulse).toBe(true);
  });

  it("every label meets the 48px target floor", () => {
    const { container } = render(<ShowPanel />);
    const labels = container.querySelectorAll("label");
    expect(labels).toHaveLength(5);
    for (const label of Array.from(labels)) {
      expect(label.className).toContain("min-h-12");
    }
  });

  it("legend marks are aria-hidden so the label text carries the meaning", () => {
    const { container } = render(<ShowPanel />);
    // One mark per dataset: 2 vitals (svg) + 3 events (span).
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });
});

describe("not-applicable indicator (OVERLAY-05 carry-over, D-01 lock)", () => {
  // The two note-rendering tests that used to open this describe moved with
  // the note itself (16.1-07, UI-SPEC 5.4): ShowPanel renders no note any
  // more, so both assertions are owned by FilterStateBlock.test.tsx, which
  // shipped in plan 16.1-04. What stays below is control BEHAVIOUR, which is
  // unaffected by the relocation.

  // Ported from the deleted OverlayToggle suite. This encodes a real
  // regression (quick-task 260827-kir): the indicator must never become a
  // functional gate — a caregiver can pre-set datasets from any view.
  it("NEVER disables the checkboxes, even where they do not apply", () => {
    act(() => {
      useFilters.setState({ chartView: "am_pm_comparison" });
    });
    render(<ShowPanel />);
    for (const box of screen.getAllByRole("checkbox")) {
      expect((box as HTMLInputElement).disabled).toBe(false);
    }
  });

  it("still applies a toggle made from a non-timeline view", () => {
    act(() => {
      useFilters.setState({ chartView: "bp_categories" });
    });
    render(<ShowPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Incidents" }));
    expect(useFilters.getState().visibleDatasets.incidents).toBe(true);
  });

  it("applies no opacity dimming to the group under any state", () => {
    act(() => {
      useFilters.setState({ chartView: "bp_categories" });
    });
    const { container } = render(<ShowPanel />);
    expect(container.innerHTML).not.toContain("opacity-60");
  });
});

// The "live selection sentence (D-20)" describe that used to sit here is gone
// with the sentence itself (16.1-07, UI-SPEC 5.4). Its four assertions all
// have live owners that shipped in plan 16.1-04: the three string cases in
// lib/showSentence.test.ts, and the polite-announcement case in
// FilterStateBlock.test.tsx — where it became the stronger claim that EXACTLY
// ONE live region serves all three lines, rather than merely more than zero.

describe("agent pulse parity (D-08)", () => {
  it("rings the group when the agent touches datasets", () => {
    const { container } = render(<ShowPanel />);
    act(() => {
      useAgentPulse.getState().mark(["datasets"]);
    });
    expect(container.innerHTML).toContain("ring-[var(--color-accent)]");
  });

  it("does not ring for an unrelated field", () => {
    const { container } = render(<ShowPanel />);
    act(() => {
      useAgentPulse.getState().mark(["bpCategory"]);
    });
    expect(container.innerHTML).not.toContain("ring-[var(--color-accent)]");
  });
});
