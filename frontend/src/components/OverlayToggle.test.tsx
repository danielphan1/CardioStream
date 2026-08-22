// Behavior tests for OverlayToggle (Plan 09-04, OVERLAY-03/OVERLAY-05) — the
// codebase's first true multi-select toggle group. Locks independent
// per-button aria-pressed state, the "doesn't apply here" indicator that
// never disables the buttons, the overlay-state sentence, and agent-pulse
// visual parity.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAgentPulse } from "../lib/agent";
import { useFilters } from "../store/filters";
import { OverlayToggle } from "./OverlayToggle";

const INITIAL_FILTERS = {
  activeChart: "bp_timeline" as const,
  datePreset: "all" as const,
  customRange: { from: null, to: null },
  amPm: "all" as const,
  bpCategory: "all" as const,
  overlayDatasets: { labs: false, incidents: false, procedures: false },
};

beforeEach(() => {
  useFilters.setState(INITIAL_FILTERS);
  useAgentPulse.setState({ seq: 0, fields: [] });
});

describe("OverlayToggle button group", () => {
  it('role="group" aria-label="Overlay events" contains exactly 3 named buttons', () => {
    render(<OverlayToggle />);
    const group = screen.getByRole("group", { name: "Overlay events" });
    expect(group).toBeInTheDocument();
    for (const name of ["Labs", "Incidents", "Procedures"]) {
      expect(
        screen.getByRole("button", { name }),
      ).toBeInTheDocument();
    }
  });

  it('clicking "Labs" when off calls setOverlayDataset("labs", true) and flips only its own aria-pressed', () => {
    render(<OverlayToggle />);
    const labsBtn = screen.getByRole("button", { name: "Labs" });
    const incidentsBtn = screen.getByRole("button", { name: "Incidents" });
    const proceduresBtn = screen.getByRole("button", { name: "Procedures" });

    expect(labsBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(labsBtn);

    expect(labsBtn).toHaveAttribute("aria-pressed", "true");
    expect(incidentsBtn).toHaveAttribute("aria-pressed", "false");
    expect(proceduresBtn).toHaveAttribute("aria-pressed", "false");
    expect(useFilters.getState().overlayDatasets).toEqual({
      labs: true,
      incidents: false,
      procedures: false,
    });
  });

  it("clicking an already-pressed button flips it back off", () => {
    useFilters.setState({
      overlayDatasets: { labs: true, incidents: false, procedures: false },
    });
    render(<OverlayToggle />);
    const labsBtn = screen.getByRole("button", { name: "Labs" });
    expect(labsBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(labsBtn);
    expect(labsBtn).toHaveAttribute("aria-pressed", "false");
    expect(useFilters.getState().overlayDatasets.labs).toBe(false);
  });

  it("buttons stay fully interactive (no disabled attribute) regardless of activeChart", () => {
    useFilters.setState({ activeChart: "bp_categories" });
    render(<OverlayToggle />);
    for (const name of ["Labs", "Incidents", "Procedures"]) {
      expect(screen.getByRole("button", { name })).not.toHaveAttribute(
        "disabled",
      );
    }
  });
});

describe("doesn't-apply-here indicator (OVERLAY-05)", () => {
  it("shows the aria-live note when activeChart is bp_categories", () => {
    useFilters.setState({ activeChart: "bp_categories" });
    render(<OverlayToggle />);
    const note = screen.getByText(
      "Overlays aren't shown on this chart — switch to Blood Pressure or Pulse to see them.",
    );
    expect(note).toBeInTheDocument();
    expect(note).toHaveAttribute("aria-live", "polite");
  });

  it("shows the note when activeChart is am_pm_comparison", () => {
    useFilters.setState({ activeChart: "am_pm_comparison" });
    render(<OverlayToggle />);
    expect(
      screen.getByText(
        "Overlays aren't shown on this chart — switch to Blood Pressure or Pulse to see them.",
      ),
    ).toBeInTheDocument();
  });

  it("hides the note when activeChart is bp_timeline", () => {
    useFilters.setState({ activeChart: "bp_timeline" });
    render(<OverlayToggle />);
    expect(
      screen.queryByText(
        "Overlays aren't shown on this chart — switch to Blood Pressure or Pulse to see them.",
      ),
    ).not.toBeInTheDocument();
  });

  it("hides the note when activeChart is pulse_trend", () => {
    useFilters.setState({ activeChart: "pulse_trend" });
    render(<OverlayToggle />);
    expect(
      screen.queryByText(
        "Overlays aren't shown on this chart — switch to Blood Pressure or Pulse to see them.",
      ),
    ).not.toBeInTheDocument();
  });
});

describe("overlay-state sentence", () => {
  it('shows "No overlays selected" when all 3 are off', () => {
    render(<OverlayToggle />);
    expect(screen.getByText("No overlays selected")).toBeInTheDocument();
  });

  it('shows "Labs, Incidents overlaid" when labs+incidents are on, procedures off', () => {
    useFilters.setState({
      overlayDatasets: { labs: true, incidents: true, procedures: false },
    });
    render(<OverlayToggle />);
    expect(
      screen.getByText("Labs, Incidents overlaid"),
    ).toBeInTheDocument();
  });
});

describe("agent-pulse visual parity", () => {
  it('gains the pulse ring/motion-safe class when useAgentPulse seq increments with fields including "overlay"', () => {
    render(<OverlayToggle />);
    const group = screen.getByRole("group", { name: "Overlay events" });
    expect(group.className).not.toContain("animate-pulse");

    useAgentPulse.getState().mark(["overlay"]);

    expect(group.className).toContain("motion-safe:animate-pulse");
  });

  it("does not pulse when the marked fields do not include overlay", () => {
    render(<OverlayToggle />);
    const group = screen.getByRole("group", { name: "Overlay events" });

    useAgentPulse.getState().mark(["amPm"]);

    expect(group.className).not.toContain("animate-pulse");
  });
});
