// Behavior tests for FilterSurface (16.1-07, UI-SPEC 5.5) — one per bullet of
// the plan's behaviour block, in BOTH presentations.
//
// The focus, no-trap and presentation-split assertions are the ones that
// matter. A regression in the first two strands a keyboard or switch-access
// user away from the mic, and that user is the primary user (D-03/D-04,
// T-16.1-28). A regression in the third either renders the small-viewport
// panel inside an inert <main> — disabling its own controls — or lets the
// chart paint over the anchored popover (T-16.1-30/T-16.1-31).
//
// No QueryClientProvider here, deliberately: FilterBar, ShowPanel and
// DatesPanel all read the zustand filter store only, so none of them needs a
// query client. The real stores are used throughout.
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DISMISSABLE_FADE_MS } from "../hooks/useDismissable";
import { FilterSurface } from "./FilterSurface";

type SurfaceProps = React.ComponentProps<typeof FilterSurface>;

const DEFAULTS: SurfaceProps = {
  kind: "filters",
  presentation: "anchored",
  open: true,
  onClose: () => {},
  clearanceAbove: 120,
};

function renderSurface(props: Partial<SurfaceProps> = {}) {
  const merged: SurfaceProps = { ...DEFAULTS, ...props };
  const tree = (p: SurfaceProps) => <FilterSurface {...p} />;
  const result = render(tree(merged));
  return {
    ...result,
    setProps: (next: Partial<SurfaceProps>) =>
      result.rerender(tree({ ...merged, ...next })),
  };
}

/** The surface restores focus to its trigger by id, and excludes that same
 *  element from outside-press dismissal, so both paths need a real target. */
function appendTrigger(kind: "filters" | "dates"): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = `${kind}-trigger-button`;
  document.body.appendChild(button);
  return button;
}

const surfaceEl = (kind: "filters" | "dates" = "filters") =>
  document.getElementById(`${kind}-popover`);

afterEach(() => {
  vi.useRealTimers();
  document.getElementById("filters-trigger-button")?.remove();
  document.getElementById("dates-trigger-button")?.remove();
});

describe("FilterSurface mounting and geometry", () => {
  it("renders nothing at all when it has never been open", () => {
    const { container } = renderSurface({ open: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("anchored: one absolutely-positioned box above the chart, and NO backdrop", () => {
    const { container } = renderSurface({ presentation: "anchored" });

    const surface = surfaceEl();
    expect(surface).not.toBeNull();
    expect(surface?.className).toContain("absolute");
    // The explicit stacking level is what keeps Recharts' own positioned
    // wrapper from painting over these controls.
    expect(surface?.className).toContain("z-30");
    // A disclosure that covers nothing must not dim what is behind it. The
    // only aria-hidden nodes here are icons and legend marks, never a
    // full-viewport sheet.
    expect(
      container.querySelector('[aria-hidden="true"][class*="inset-0"]'),
    ).toBeNull();
  });

  it("panel: an aria-hidden mist backdrop plus a fixed panel offset by the clearance it was given", () => {
    const { container } = renderSurface({
      presentation: "panel",
      clearanceAbove: 120,
    });

    const backdrop = container.querySelector(
      '[aria-hidden="true"][class*="inset-0"]',
    );
    expect(backdrop).not.toBeNull();
    expect(backdrop?.className).toContain("z-40");

    const surface = surfaceEl();
    expect(surface?.className).toContain("fixed");
    expect(surface?.className).toContain("z-50");
    // The measured top band, not a guess — content can never scroll behind it.
    expect((surface as HTMLElement).style.top).toBe("120px");
    // The backdrop is a SIBLING of the panel, never its parent.
    expect(backdrop?.contains(surface as Node)).toBe(false);
  });

  it("stays mounted for the full exit fade and then unmounts", () => {
    vi.useFakeTimers();
    const { setProps } = renderSurface();

    expect(surfaceEl()).not.toBeNull();

    setProps({ open: false });
    act(() => {
      vi.advanceTimersByTime(DISMISSABLE_FADE_MS - 1);
    });
    expect(surfaceEl()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(surfaceEl()).toBeNull();
  });
});

describe("FilterSurface dismiss affordance", () => {
  it("anchored: Close is the first focusable control, clears 48px, and holds focus on open", () => {
    renderSurface({ presentation: "anchored" });

    const close = screen.getByRole("button", { name: "Close" });
    // First in DOM among the surface's own buttons.
    expect(surfaceEl()?.querySelectorAll("button")[0]).toBe(close);
    expect(close.className).toContain("min-h-12");
    expect(close).toHaveFocus();
  });

  it("panel: Close is the first focusable control, clears 48px, and holds focus on open", () => {
    renderSurface({ presentation: "panel" });

    const close = screen.getByRole("button", { name: "Close" });
    expect(surfaceEl()?.querySelectorAll("button")[0]).toBe(close);
    expect(close.className).toContain("min-h-12");
    expect(close).toHaveFocus();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    renderSurface({ onClose });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    renderSurface({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("returns focus to its own trigger once it closes", () => {
    const trigger = appendTrigger("filters");
    const { setProps } = renderSurface();

    setProps({ open: false });

    expect(trigger).toHaveFocus();
  });
});

describe("FilterSurface outside-press dismissal", () => {
  it("anchored: a press outside the surface closes it", () => {
    const onClose = vi.fn();
    renderSurface({ presentation: "anchored", onClose });

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalled();
  });

  it("anchored: a press INSIDE the surface leaves it open", () => {
    const onClose = vi.fn();
    renderSurface({ presentation: "anchored", onClose });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Close" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("anchored: a press on the trigger itself never closes it — the trigger owns its own toggle", () => {
    const trigger = appendTrigger("filters");
    const onClose = vi.fn();
    renderSurface({ presentation: "anchored", onClose });

    fireEvent.pointerDown(trigger);

    // Otherwise a closing tap fires both this and the trigger's toggle, which
    // cancel out and leave the surface open.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("panel: an outside press does NOT close it — Close and Escape are the routes out", () => {
    const onClose = vi.fn();
    renderSurface({ presentation: "panel", onClose });

    fireEvent.pointerDown(document.body);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("FilterSurface contents", () => {
  it("filters: a Filters heading naming the surface, then Time of Day, BP Category, Pulse Category and Show in that order", () => {
    renderSurface({ kind: "filters" });

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveAccessibleName("Filters");
    expect(surfaceEl()).toHaveAttribute("aria-labelledby", heading.id);

    for (const name of [
      "Time of day",
      "Blood pressure category",
      "Pulse category",
    ]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }

    // Reading order is the spec's order, and Show closes the surface.
    const text = surfaceEl()?.textContent ?? "";
    expect(text.indexOf("Time of Day:")).toBeLessThan(
      text.indexOf("BP Category:"),
    );
    expect(text.indexOf("BP Category:")).toBeLessThan(
      text.indexOf("Pulse Category:"),
    );
    expect(text.indexOf("Pulse Category:")).toBeLessThan(text.indexOf("Show:"));
  });

  it("dates: the date-preset group under a directly-labelled surface, and no new heading", () => {
    renderSurface({ kind: "dates" });

    expect(screen.getByRole("group", { name: "Date range" })).toBeInTheDocument();
    expect(surfaceEl("dates")).toHaveAttribute("aria-label", "Dates");
    // The copy contract introduces no "Dates" heading string, and DatesPanel's
    // own visible prefix already names its contents.
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("FilterSurface is a disclosure, not a modal", () => {
  it("exposes a plain group with no modal role or modal attribute", () => {
    renderSurface();

    const surface = surfaceEl();
    expect(surface).toHaveAttribute("role", "group");
    expect(surface?.hasAttribute("aria-modal")).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("installs no Tab handler, so focus can leave for the mic and the Command Bar", () => {
    renderSurface();

    const tab = createEvent.keyDown(window, { key: "Tab" });
    fireEvent(window, tab);

    // Trapping here would lock a switch-access user away from their only
    // reliable input.
    expect(tab.defaultPrevented).toBe(false);
  });
});
