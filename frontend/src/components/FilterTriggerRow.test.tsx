// Behavior tests for FilterTriggerRow (16.1-07, UI-SPEC 5.3) — one per bullet
// of the plan's behaviour block.
//
// The badge and pulse assertions are the ones that matter. The badge counting
// GROUPS rather than ticks is what keeps "Filters 7" off the screen after a
// caregiver ticks seven chips (T-16.1-32), and the pulse firing on the
// always-rendered trigger with the surface CLOSED is the whole point of
// consuming the hook here rather than inside the popover (T-16.1-29) — with
// the popover closed being the normal state for a voice-driven change.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentPulse } from "../lib/agent";
import { CLINICAL_ORDER } from "../lib/palette";
import {
  DEFAULT_BP_CATEGORY,
  DEFAULT_DATASETS,
  DEFAULT_PULSE_CATEGORY,
  DEFAULT_TIME_OF_DAY,
  useFilters,
} from "../store/filters";
import { FilterTriggerRow } from "./FilterTriggerRow";

type RowProps = React.ComponentProps<typeof FilterTriggerRow>;

const DEFAULTS: RowProps = {
  openOverlay: null,
  onOpen: () => {},
  onClose: () => {},
  // Below 768px by default so no anchored surface mounts and the row's own
  // two controls are the only buttons in the tree.
  isWide: false,
};

function renderRow(props: Partial<RowProps> = {}) {
  return render(<FilterTriggerRow {...DEFAULTS} {...props} />);
}

const ACCENT_RING = "ring-[var(--color-accent)]";

const datesTrigger = () => document.getElementById("dates-trigger-button")!;
const filtersTrigger = () => document.getElementById("filters-trigger-button")!;

beforeEach(() => {
  // Every group at its shipped default, so the badge starts absent.
  useFilters.setState({
    chartView: "timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    bpCategory: { ...DEFAULT_BP_CATEGORY },
    pulseCategory: { ...DEFAULT_PULSE_CATEGORY },
    timeOfDay: { ...DEFAULT_TIME_OF_DAY },
    visibleDatasets: { ...DEFAULT_DATASETS },
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
});

describe("FilterTriggerRow structure", () => {
  it("renders exactly the two triggers, each naming the surface it controls", () => {
    renderRow();

    expect(screen.getAllByRole("button")).toHaveLength(2);

    // The dates trigger states its own state in words, so it needs no badge.
    expect(datesTrigger()).toHaveTextContent("Dates: All data");
    expect(datesTrigger()).toHaveAttribute("aria-controls", "dates-popover");
    expect(filtersTrigger()).toHaveTextContent("Filters");
    expect(filtersTrigger()).toHaveAttribute(
      "aria-controls",
      "filters-popover",
    );
  });

  it("clears the 48px floor on both triggers", () => {
    renderRow();

    expect(datesTrigger().className).toContain("min-h-12");
    expect(filtersTrigger().className).toContain("min-h-12");
  });

  it("marks only the open trigger as expanded", () => {
    renderRow({ openOverlay: "filters" });

    expect(filtersTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(datesTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("reflects the current preset in the dates trigger", () => {
    act(() => {
      useFilters.setState({ datePreset: "30d" });
    });
    renderRow();

    expect(datesTrigger()).toHaveTextContent("Dates: Last 30 days");
  });
});

describe("FilterTriggerRow count badge", () => {
  it("renders no badge and says so in words when nothing is applied", () => {
    renderRow();

    expect(filtersTrigger()).toHaveAccessibleName("Filters, none applied");
    // No badge element at rest — there is no "0" to show.
    expect(
      filtersTrigger().querySelector('[aria-hidden="true"].rounded-full'),
    ).toBeNull();
  });

  it("counts two groups off default as 2, in both the badge and the accessible name", () => {
    act(() => {
      useFilters.setState({
        timeOfDay: { ...DEFAULT_TIME_OF_DAY, Morning: true },
        bpCategory: { ...DEFAULT_BP_CATEGORY, Normal: true },
      });
    });
    renderRow();

    expect(filtersTrigger()).toHaveAccessibleName("Filters, 2 applied");
    const badge = filtersTrigger().querySelector(
      '[aria-hidden="true"].rounded-full',
    );
    expect(badge).toHaveTextContent("2");
  });

  it("counts GROUPS, not ticks — every BP chip on still reads 1", () => {
    act(() => {
      useFilters.setState({
        bpCategory: Object.fromEntries(
          CLINICAL_ORDER.map((c) => [c, true]),
        ) as typeof DEFAULT_BP_CATEGORY,
      });
    });
    renderRow();

    // "Filters 6" after ticking every chip is noise; the detail already lives
    // in the always-visible state block.
    expect(filtersTrigger()).toHaveAccessibleName("Filters, 1 applied");
    expect(
      filtersTrigger().querySelector('[aria-hidden="true"].rounded-full'),
    ).toHaveTextContent("1");
  });

  it("counts a dataset turned OFF from its default, not just one turned on", () => {
    act(() => {
      useFilters.setState({
        visibleDatasets: { ...DEFAULT_DATASETS, pulse: false },
      });
    });
    renderRow();

    expect(filtersTrigger()).toHaveAccessibleName("Filters, 1 applied");
  });

  it("hides the badge from assistive tech, so the count is announced once", () => {
    act(() => {
      useFilters.setState({
        timeOfDay: { ...DEFAULT_TIME_OF_DAY, Morning: true },
      });
    });
    renderRow();

    const badge = filtersTrigger().querySelector(".rounded-full");
    expect(badge).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FilterTriggerRow agent pulse", () => {
  it("rings the Dates trigger when the agent touches the date range", () => {
    renderRow();
    act(() => {
      useAgentPulse.getState().mark(["dateRange"]);
    });

    expect(datesTrigger().className).toContain(ACCENT_RING);
    expect(filtersTrigger().className).not.toContain(ACCENT_RING);
  });

  it.each(["bpCategory", "pulseCategory", "timeOfDay", "datasets"] as const)(
    "rings the Filters trigger when the agent touches %s",
    (field) => {
      renderRow();
      act(() => {
        useAgentPulse.getState().mark([field]);
      });

      expect(filtersTrigger().className).toContain(ACCENT_RING);
      expect(datesTrigger().className).not.toContain(ACCENT_RING);
    },
  );

  it("rings with the surface CLOSED — the normal state for a voice command", () => {
    renderRow({ openOverlay: null });
    act(() => {
      useAgentPulse.getState().mark(["timeOfDay"]);
    });

    // If the ring lived inside the popover it would signal nothing here, which
    // is precisely the case this row exists to cover.
    expect(filtersTrigger().className).toContain(ACCENT_RING);
  });

  it("does not ring for a field neither trigger speaks for", () => {
    renderRow();
    act(() => {
      useAgentPulse.getState().mark(["chart"]);
    });

    expect(datesTrigger().className).not.toContain(ACCENT_RING);
    expect(filtersTrigger().className).not.toContain(ACCENT_RING);
  });
});

describe("FilterTriggerRow toggling", () => {
  it("opens its own surface when closed", () => {
    const onOpen = vi.fn();
    renderRow({ onOpen });

    fireEvent.click(filtersTrigger());
    expect(onOpen).toHaveBeenCalledWith("filters");

    fireEvent.click(datesTrigger());
    expect(onOpen).toHaveBeenCalledWith("dates");
  });

  it("closes instead of reopening when its surface is already open", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    renderRow({ openOverlay: "filters", onOpen, onClose });

    fireEvent.click(filtersTrigger());

    expect(onClose).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("mounts its anchored surface at ≥768px, immediately after its trigger", () => {
    renderRow({ isWide: true, openOverlay: "filters" });

    const surface = document.getElementById("filters-popover");
    expect(surface).not.toBeNull();
    // Immediately after the trigger in DOM order is what makes Tab flow
    // trigger, contents, next control with nothing trapped.
    expect(filtersTrigger().nextElementSibling).toBe(surface);
  });

  it("mounts no anchored surface below 768px — App renders those outside <main>", () => {
    renderRow({ isWide: false, openOverlay: "filters" });

    expect(document.getElementById("filters-popover")).toBeNull();
  });
});
