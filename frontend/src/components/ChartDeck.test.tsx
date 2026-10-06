// Behavior tests for ChartDeck's view routing (Phase 14, D-05/D-06/D-08) and
// the code-review fixes CR-02 / WR-01.
//
// Recharts renders nothing under jsdom's 0x0 layout, so these assert WHICH
// branch mounted (heading + landmark), not chart internals — CombinedTimeline
// has its own suite for that.
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Reading } from "../api/types";
import type { OverlayEvent } from "../lib/overlayEvents";
import { useFilters } from "../store/filters";
import { ChartDeck } from "./ChartDeck";

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
  localStorage.clear();
  useFilters.setState(INITIAL);
});

const READINGS: Reading[] = [
  {
    id: 1,
    datetime: "2025-01-05T08:00:00",
    systolic: 128,
    diastolic: 78,
    pulse: 72,
    am_pm: "AM",
    bp_category: "Normal",
    pulse_category: "Normal",
    map: 95,
    pulse_pressure: 50,
    notes: null,
  },
];

const EVENTS: OverlayEvent[] = [
  {
    id: 1,
    ts: Date.parse("2025-02-20T00:00:00"),
    type: "incidents",
    dateCell: "February 20, 2025",
    whatHappened: "Hospitalization",
    notes: null,
  },
];

const deck = (events: OverlayEvent[] = []) =>
  render(
    <ChartDeck readings={READINGS} stats={undefined} overlayEvents={events} />,
  );

const onlyEvents = () =>
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

describe("ChartDeck routing", () => {
  it("renders the timeline when a vital is selected", () => {
    deck();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeTruthy();
  });

  it("renders the event list — not a chart — when no vital is selected (D-05)", () => {
    onlyEvents();
    deck(EVENTS);
    expect(screen.getByRole("heading", { name: "Events" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Events by date" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Timeline" })).toBeNull();
  });

  it("renders the pick-something prompt when nothing is selected (D-06)", () => {
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
    deck();
    expect(screen.getByRole("heading", { name: "Nothing selected" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show everything" })).toBeTruthy();
  });

  it("switches to a summary view regardless of dataset selection", () => {
    onlyEvents();
    act(() => {
      useFilters.setState({ chartView: "am_pm_comparison" });
    });
    deck(EVENTS);
    expect(screen.getByRole("heading", { name: "AM vs PM" })).toBeTruthy();
  });
});

// The directional chart swap (quick 261005-mj2, brief §5). This is the ONLY
// gate in the suite that an entrance-only build fails: a grep for a
// `direction` identifier, or for the VIEW_ORDER import, passes perfectly well
// on an implementation that never drifts the outgoing chart anywhere. The
// observable exit phase is the thing worth asserting, so it is asserted
// rather than inferred from a variable name.
//
// Every OTHER test in this file calls useFilters.setState BEFORE render, so no
// already-mounted deck ever sees a view change and none of them became async.
// This one deliberately changes the view on a MOUNTED deck, which is the only
// way the exit phase can occur at all.
describe("directional view swap (brief §5)", () => {
  it("drifts the outgoing chart out before the incoming one crests in", async () => {
    const { container } = deck();
    expect(container.querySelector('[data-swap-phase="in"]')).toBeTruthy();

    act(() => {
      useFilters.setState({ chartView: "bp_categories" });
    });

    // timeline -> bp_categories is a real move along VIEW_ORDER, so the swap
    // gets an exit phase rather than committing immediately.
    expect(container.querySelector('[data-swap-phase="exit"]')).toBeTruthy();
    await waitFor(() =>
      expect(container.querySelector('[data-swap-phase="in"]')).toBeTruthy(),
    );
  });

  it("commits immediately when the swap was not a view change", () => {
    const { container } = deck();
    // A dataset toggle changes the remount key but not the view, so there is
    // nothing directional to say and the entrance runs alone — exactly the
    // behaviour before the swap existed.
    act(() => {
      useFilters.setState({
        visibleDatasets: {
          blood_pressure: true,
          pulse: false,
          labs: false,
          incidents: false,
          procedures: false,
        },
      });
    });
    expect(container.querySelector('[data-swap-phase="exit"]')).toBeNull();
  });
});

// WR-01: the button says "Show everything" and must do exactly that, without
// also discarding a date range the user deliberately chose.
describe('"Show everything" recovery button (WR-01)', () => {
  it("turns on all five datasets", () => {
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
    deck();
    fireEvent.click(screen.getByRole("button", { name: "Show everything" }));

    expect(useFilters.getState().visibleDatasets).toEqual({
      blood_pressure: true,
      pulse: true,
      labs: true,
      incidents: true,
      procedures: true,
    });
  });

  it("leaves the user's date range alone", () => {
    act(() => {
      useFilters.setState({
        datePreset: "30d",
        visibleDatasets: {
          blood_pressure: false,
          pulse: false,
          labs: false,
          incidents: false,
          procedures: false,
        },
      });
    });
    deck();
    fireEvent.click(screen.getByRole("button", { name: "Show everything" }));

    expect(useFilters.getState().datePreset).toBe("30d");
  });
});
