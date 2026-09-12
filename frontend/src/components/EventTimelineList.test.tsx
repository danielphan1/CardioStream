// Behavior tests for EventTimelineList (Phase 14, D-05) — the dated list the
// timeline slot renders when no vitals are checked. This is the literal answer
// to the client's "versus the hospital stays".
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OverlayEvent } from "../lib/overlayEvents";
import { EventTimelineList } from "./EventTimelineList";

const evt = (
  id: number,
  ts: number,
  type: OverlayEvent["type"],
  whatHappened: string,
): OverlayEvent => ({
  id,
  ts,
  type,
  dateCell: `Day ${id}`,
  whatHappened,
  notes: null,
});

describe("EventTimelineList", () => {
  it("renders one row per event", () => {
    render(
      <EventTimelineList
        events={[
          evt(1, 300, "incidents", "Hospitalization"),
          evt(2, 200, "procedures", "Catheter change"),
          evt(3, 100, "labs", "Creatinine"),
        ]}
        enabledTypes={["labs", "incidents", "procedures"]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("preserves the caller's order (newest-first from mergeOverlayEvents)", () => {
    render(
      <EventTimelineList
        events={[
          evt(1, 300, "incidents", "Newest"),
          evt(2, 200, "labs", "Middle"),
          evt(3, 100, "procedures", "Oldest"),
        ]}
        enabledTypes={["labs", "incidents", "procedures"]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0].textContent).toContain("Newest");
    expect(rows[2].textContent).toContain("Oldest");
  });

  it("carries the event type as visible text, not only as a glyph", () => {
    render(
      <EventTimelineList
        events={[evt(1, 100, "incidents", "Fall")]}
        enabledTypes={["incidents"]}
      />,
    );
    expect(screen.getByText(/Incident/)).toBeTruthy();
  });

  it("marks the decorative glyph aria-hidden", () => {
    const { container } = render(
      <EventTimelineList
        events={[evt(1, 100, "labs", "Creatinine")]}
        enabledTypes={["labs"]}
      />,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it("explains an empty range using the enabled types", () => {
    render(<EventTimelineList events={[]} enabledTypes={["incidents"]} />);
    expect(
      screen.getByText("No incidents recorded in this date range."),
    ).toBeTruthy();
  });

  it("falls back to the nothing-selected prompt when no types are on", () => {
    render(<EventTimelineList events={[]} enabledTypes={[]} />);
    expect(screen.getByText(/Nothing selected/)).toBeTruthy();
  });

  it("rows meet the 48px target floor", () => {
    const { container } = render(
      <EventTimelineList
        events={[evt(1, 100, "labs", "Creatinine")]}
        enabledTypes={["labs"]}
      />,
    );
    expect(container.querySelector("li")?.className).toContain("min-h-12");
  });

  it("singularises the count line", () => {
    render(
      <EventTimelineList
        events={[evt(1, 100, "labs", "Creatinine")]}
        enabledTypes={["labs"]}
      />,
    );
    expect(screen.getByText(/Showing all 1 event in this date range\./)).toBeTruthy();
  });
});
