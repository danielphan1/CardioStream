// Behavior tests for ChartViewSwitcher — the component's FIRST test file
// (16.1-09, UI-SPEC section 5.7). It shipped in Phase 14 with its coverage
// riding on ChartDeck's and App's suites, so every claim below was previously
// only implied: the group's accessible name, the single-select pressed state,
// the 48px target floor, and the agent pulse.
//
// The visible label prefix is the one thing section 5.7 adds, and it is the
// reason this file exists now. A standalone row of three bare buttons has no
// visible name, which for the primary user — who reads the screen rather than
// the accessibility tree — made the row unlabelled in practice.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAgentPulse } from "../lib/agent";
import { useFilters } from "../store/filters";
import { ChartViewSwitcher } from "./ChartViewSwitcher";

// Same shape ShowPanel.test.tsx seeds, so the two suites cannot disagree about
// what a default store looks like.
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

// The locked copy (UI-SPEC section 6), in the locked order.
const LABELS = ["Timeline", "BP Categories", "AM vs PM"];

beforeEach(() => {
  useFilters.setState(INITIAL_FILTERS);
  useAgentPulse.setState({ seq: 0, fields: [] });
});

describe("ChartViewSwitcher group", () => {
  it("renders the visible label prefix", () => {
    render(<ChartViewSwitcher />);
    expect(screen.getByText("View:")).toBeTruthy();
  });

  it("renders the three buttons with the locked copy, in order", () => {
    render(<ChartViewSwitcher />);
    const names = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(names).toEqual(LABELS);
  });

  it("keeps the group role and its accessible name", () => {
    render(<ChartViewSwitcher />);
    const group = screen.getByRole("group", { name: "Chart view" });
    // The prefix is outside the group, so adding it did not rename the group
    // or fold a non-button into it.
    expect(group.querySelectorAll("button")).toHaveLength(3);
    expect(group.textContent).not.toContain("View:");
  });

  it("marks only the stored view as pressed", () => {
    render(<ChartViewSwitcher />);
    expect(
      screen.getByRole("button", { name: "Timeline" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "BP Categories" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: "AM vs PM" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("moves the pressed state when the store changes", () => {
    render(<ChartViewSwitcher />);
    act(() => {
      useFilters.setState({ chartView: "am_pm_comparison" });
    });
    expect(
      screen.getByRole("button", { name: "AM vs PM" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Timeline" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("writes the clicked view to the store", () => {
    render(<ChartViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "BP Categories" }));
    expect(useFilters.getState().chartView).toBe("bp_categories");
  });

  it("every button meets the 48px target floor", () => {
    render(<ChartViewSwitcher />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.className).toContain("min-h-12");
    }
  });
});

describe("agent pulse parity (D-08)", () => {
  it("rings the group when the agent touches the chart view", () => {
    const { container } = render(<ChartViewSwitcher />);
    act(() => {
      useAgentPulse.getState().mark(["chart"]);
    });
    expect(container.innerHTML).toContain("ring-[var(--color-accent)]");
  });

  it("does not ring for an unrelated field", () => {
    const { container } = render(<ChartViewSwitcher />);
    act(() => {
      useAgentPulse.getState().mark(["bpCategory"]);
    });
    expect(container.innerHTML).not.toContain("ring-[var(--color-accent)]");
  });
});
