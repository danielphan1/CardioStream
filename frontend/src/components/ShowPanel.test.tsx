// Behavior tests for ShowPanel (Phase 14, D-01/D-02/D-07/D-08) — the
// five-dataset checkbox row that replaced the chart picker AND OverlayToggle.
// Locks real checkbox semantics, the 48px target floor, independent toggling
// of the two vitals, the live sentence, and the never-disabled indicator
// ported from the deleted OverlayToggle suite.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAgentPulse } from "../lib/agent";
import { useFilters } from "../store/filters";
import { ShowPanel } from "./ShowPanel";

const INITIAL_FILTERS = {
  chartView: "timeline" as const,
  datePreset: "all" as const,
  customRange: { from: null, to: null },
  amPm: "all" as const,
  bpCategory: "all" as const,
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
  it("shows the note when the view cannot render datasets", () => {
    act(() => {
      useFilters.setState({ chartView: "bp_categories" });
    });
    render(<ShowPanel />);
    expect(
      screen.getByText(/These datasets show on the Timeline/),
    ).toBeTruthy();
  });

  it("hides the note on the timeline", () => {
    render(<ShowPanel />);
    expect(screen.queryByText(/These datasets show on the Timeline/)).toBeNull();
  });

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

describe("live selection sentence (D-20)", () => {
  it("names the selection in fixed order, not click order", () => {
    act(() => {
      useFilters.setState({
        visibleDatasets: {
          blood_pressure: true,
          pulse: true,
          labs: false,
          incidents: true,
          procedures: false,
        },
      });
    });
    render(<ShowPanel />);
    expect(
      screen.getByText("Showing blood pressure, pulse and incidents."),
    ).toBeTruthy();
  });

  it("explains the events-only case rather than implying a chart", () => {
    act(() => {
      useFilters.setState({
        visibleDatasets: {
          blood_pressure: false,
          pulse: false,
          labs: false,
          incidents: true,
          procedures: false,
        },
      });
    });
    render(<ShowPanel />);
    expect(screen.getByText(/listed by date/)).toBeTruthy();
  });

  it("prompts when nothing is selected", () => {
    act(() => {
      useFilters.setState({
        visibleDatasets: {
          blood_pressure: false,
          pulse: false,
          labs: false,
          incidents: false,
          procedures: false,
        },
      });
    });
    render(<ShowPanel />);
    expect(screen.getByText(/Nothing selected/)).toBeTruthy();
  });

  it("is announced politely", () => {
    const { container } = render(<ShowPanel />);
    expect(container.querySelectorAll('[aria-live="polite"]').length).toBeGreaterThan(0);
  });
});

describe("agent pulse parity (D-08)", () => {
  it("rings the group when the agent touches datasets", () => {
    const { container } = render(<ShowPanel />);
    act(() => {
      useAgentPulse.getState().mark(["datasets"]);
    });
    expect(container.innerHTML).toContain("ring-[var(--color-brass)]");
  });

  it("does not ring for an unrelated field", () => {
    const { container } = render(<ShowPanel />);
    act(() => {
      useAgentPulse.getState().mark(["amPm"]);
    });
    expect(container.innerHTML).not.toContain("ring-[var(--color-brass)]");
  });
});
