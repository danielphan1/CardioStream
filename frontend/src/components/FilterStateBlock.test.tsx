// Behavior tests for FilterStateBlock (Phase 16.1, 16.1-UI-SPEC §5.4) — the
// always-visible applied-filter state that lives outside every popover.
//
// The region-count assertion below is the important one and is the stronger
// successor to ShowPanel.test.tsx's "is announced politely" (which only
// asserted `> 0` polite regions, and which plan 16.1-07 removes). Here the
// claim is EXACTLY ONE region for all three lines: that is what stops a
// single agent command from firing three racing polite utterances on top of
// the Command Bar's own region and the spoken confirmation.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useFilters } from "../store/filters";
import { FilterStateBlock } from "./FilterStateBlock";

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
});

describe("one polite live region (§5.4)", () => {
  it("emits EXACTLY ONE aria-live region for all three lines", () => {
    const { container } = render(<FilterStateBlock latestReading={null} />);
    const regions = container.querySelectorAll("[aria-live]");
    expect(regions).toHaveLength(1);
    expect(regions[0].getAttribute("aria-live")).toBe("polite");
  });

  it("stays exactly one region even when the third line is showing", () => {
    act(() => {
      useFilters.setState({ chartView: "bp_categories" });
    });
    const { container } = render(<FilterStateBlock latestReading={null} />);
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(container.querySelectorAll("p")).toHaveLength(3);
  });

  it("never announces assertively — a filter change must not interrupt the mic", () => {
    const { container } = render(<FilterStateBlock latestReading={null} />);
    expect(container.querySelectorAll('[aria-live="assertive"]')).toHaveLength(
      0,
    );
  });

  it("leaves aria-atomic at its default false, so one changed line reads alone", () => {
    const { container } = render(<FilterStateBlock latestReading={null} />);
    expect(container.querySelectorAll('[aria-atomic="true"]')).toHaveLength(0);
    const region = container.querySelector("[aria-live]");
    const atomic = region?.getAttribute("aria-atomic");
    expect(atomic === null || atomic === "false").toBe(true);
  });

  it("puts no live attribute, aria-atomic or role=status on the paragraphs", () => {
    act(() => {
      useFilters.setState({ chartView: "am_pm_comparison" });
    });
    const { container } = render(<FilterStateBlock latestReading={null} />);
    for (const p of Array.from(container.querySelectorAll("p"))) {
      expect(p.hasAttribute("aria-live")).toBe(false);
      expect(p.hasAttribute("aria-atomic")).toBe(false);
      expect(p.getAttribute("role")).toBeNull();
    }
  });
});

describe("the three lines", () => {
  it("reads both sentences at the default state, with no note", () => {
    render(<FilterStateBlock latestReading={null} />);
    expect(
      screen.getByText(
        "All data · All times of day · All categories · All pulse categories",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Showing blood pressure and pulse.")).toBeTruthy();
    expect(
      screen.queryByText(/These datasets show on the Timeline/),
    ).toBeNull();
  });

  it("orders the lines filter sentence, then Show sentence, then note", () => {
    act(() => {
      useFilters.setState({ chartView: "bp_categories" });
    });
    const { container } = render(<FilterStateBlock latestReading={null} />);
    const lines = Array.from(container.querySelectorAll("p")).map(
      (p) => p.textContent,
    );
    expect(lines).toEqual([
      "All data · All times of day · All categories · All pulse categories",
      "Showing blood pressure and pulse.",
      "These datasets show on the Timeline. Switch back to see them.",
    ]);
  });

  it("shows the note only off the timeline", () => {
    act(() => {
      useFilters.setState({ chartView: "am_pm_comparison" });
    });
    render(<FilterStateBlock latestReading={null} />);
    expect(
      screen.getByText("These datasets show on the Timeline. Switch back to see them."),
    ).toBeTruthy();
  });

  it("prompts when every dataset is off", () => {
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
    render(<FilterStateBlock latestReading={null} />);
    expect(
      screen.getByText("Nothing selected. Pick a dataset to see it."),
    ).toBeTruthy();
  });

  it("reflects an applied filter and the newest-reading anchor", () => {
    act(() => {
      useFilters.setState({
        datePreset: "30d",
        timeOfDay: {
          Morning: true,
          Afternoon: false,
          Evening: false,
          Night: false,
        },
      });
    });
    render(<FilterStateBlock latestReading="2025-06-13T09:21:00" />);
    expect(
      screen.getByText(
        "Last 30 days · to June 13, 2025 · Morning · All categories · All pulse categories",
      ),
    ).toBeTruthy();
  });
});
