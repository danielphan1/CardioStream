// Behavior tests for OverlayEventsList (Plan 09-04, OVERLAY-06) — the
// accessible, conditionally-mounted, paginated 4-column events table.
// Templated on ReadingsTable.test.tsx's rowCount()/fixture-factory
// conventions, adapted to the { enabled, events, isError } props shape and
// AgentStatusBanner's null-render-when-nothing-to-show convention.
import { fireEvent, render, screen } from "@testing-library/react";

import type { OverlayEvent } from "../lib/overlayEvents";
import { OverlayEventsList } from "./OverlayEventsList";

type DatasetProps = { enabled: boolean; events: OverlayEvent[]; isError: boolean };

const OFF: DatasetProps = { enabled: false, events: [], isError: false };

function makeOverlayEvent(
  i: number,
  overrides: Partial<OverlayEvent> = {},
): OverlayEvent {
  return {
    id: i + 1,
    ts: new Date(2025, 0, 1 + i, 8, 0, 0).getTime(),
    type: "labs",
    dateCell: `Jan ${i + 1}, 2025`,
    whatHappened: `Event ${i}`,
    notes: null,
    ...overrides,
  };
}

/** All <tr> rows: header + visible data rows. */
function rowCount(): number {
  return screen.getAllByRole("row").length;
}

describe("conditional mount (D-07 default)", () => {
  it("renders nothing when no overlay dataset is ON", () => {
    const { container } = render(
      <OverlayEventsList labs={OFF} incidents={OFF} procedures={OFF} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("pagination", () => {
  it("renders 20 rows + Show 20 more; clicking reveals all 25 and shows the all-shown copy", () => {
    const events = Array.from({ length: 25 }, (_, i) => makeOverlayEvent(i));
    render(
      <OverlayEventsList
        labs={{ enabled: true, events, isError: false }}
        incidents={OFF}
        procedures={OFF}
      />,
    );

    // 1 header row + 20 data rows
    expect(rowCount()).toBe(21);
    const button = screen.getByRole("button", { name: "Show 20 more" });

    fireEvent.click(button);

    expect(rowCount()).toBe(26); // header + all 25
    expect(
      screen.queryByRole("button", { name: "Show 20 more" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Showing all 25 overlaid events"),
    ).toBeInTheDocument();
  });
});

describe("merge + sort", () => {
  it("merges events from multiple enabled types, sorted newest-first, interleaved regardless of input order", () => {
    const labEvents = [
      makeOverlayEvent(0, { id: 1, type: "labs", ts: new Date(2025, 5, 1).getTime(), whatHappened: "Lab event" }),
    ];
    const incidentEvents = [
      makeOverlayEvent(0, {
        id: 2,
        type: "incidents",
        ts: new Date(2025, 5, 3).getTime(),
        whatHappened: "Incident event",
      }),
    ];
    const procedureEvents = [
      makeOverlayEvent(0, {
        id: 3,
        type: "procedures",
        ts: new Date(2025, 5, 2).getTime(),
        whatHappened: "Procedure event",
      }),
    ];

    render(
      <OverlayEventsList
        labs={{ enabled: true, events: labEvents, isError: false }}
        incidents={{ enabled: true, events: incidentEvents, isError: false }}
        procedures={{ enabled: true, events: procedureEvents, isError: false }}
      />,
    );

    const rows = screen.getAllByRole("row");
    // rows[0] is the header
    expect(rows[1]).toHaveTextContent("Incident event");
    expect(rows[2]).toHaveTextContent("Procedure event");
    expect(rows[3]).toHaveTextContent("Lab event");
  });
});

describe("empty state", () => {
  it('renders "No labs recorded in this date range." when labs is ON with zero events and no error', () => {
    render(
      <OverlayEventsList
        labs={{ enabled: true, events: [], isError: false }}
        incidents={OFF}
        procedures={OFF}
      />,
    );

    expect(
      screen.getByText("No labs recorded in this date range."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("per-type error isolation", () => {
  it("shows the labs error alert but still renders the 2 incident rows", () => {
    const incidentEvents = [
      makeOverlayEvent(0, { id: 1, type: "incidents", whatHappened: "Fall" }),
      makeOverlayEvent(1, { id: 2, type: "incidents", whatHappened: "Dizzy spell" }),
    ];
    render(
      <OverlayEventsList
        labs={{ enabled: true, events: [], isError: true }}
        incidents={{ enabled: true, events: incidentEvents, isError: false }}
        procedures={OFF}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load labs — try again in a moment.");

    // header + 2 incident rows — the labs error never suppresses these.
    expect(rowCount()).toBe(3);
    expect(screen.getByText("Fall")).toBeInTheDocument();
    expect(screen.getByText("Dizzy spell")).toBeInTheDocument();
  });

  it("renders only the error alert (no table, no empty message) when every ON type is erroring", () => {
    render(
      <OverlayEventsList
        labs={{ enabled: true, events: [], isError: true }}
        incidents={OFF}
        procedures={OFF}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load labs — try again in a moment.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No labs recorded/),
    ).not.toBeInTheDocument();
  });
});

describe("table structure", () => {
  it("has exactly 4 columnheader-role elements named Date, Type, What happened, Notes", () => {
    render(
      <OverlayEventsList
        labs={{ enabled: true, events: [makeOverlayEvent(0)], isError: false }}
        incidents={OFF}
        procedures={OFF}
      />,
    );

    for (const name of ["Date", "Type", "What happened", "Notes"]) {
      expect(
        screen.getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  });
});

describe("Notes cell", () => {
  it("renders notes as plain text and blank when null", () => {
    const events = [
      makeOverlayEvent(0, {
        id: 1,
        notes: "fasted before draw",
        whatHappened: "Has notes",
      }),
      makeOverlayEvent(1, { id: 2, notes: null, whatHappened: "No notes" }),
    ];
    render(
      <OverlayEventsList
        labs={{ enabled: true, events, isError: false }}
        incidents={OFF}
        procedures={OFF}
      />,
    );

    expect(screen.getByText("fasted before draw")).toBeInTheDocument();

    // Locate the "No notes" row directly (order-independent) and assert its
    // trailing Notes cell has no text — never dangerouslySetInnerHTML.
    const noNotesRow = screen.getByText("No notes").closest("tr");
    expect(noNotesRow).not.toBeNull();
    const cells = noNotesRow!.querySelectorAll("td");
    expect(cells[cells.length - 1]).toHaveTextContent("");
  });
});

describe("Type badge", () => {
  it("shows the per-type icon badge with the type's color token", () => {
    render(
      <OverlayEventsList
        labs={{
          enabled: true,
          events: [makeOverlayEvent(0, { type: "labs" })],
          isError: false,
        }}
        incidents={OFF}
        procedures={OFF}
      />,
    );

    const badge = screen.getByText("Lab");
    expect(badge.getAttribute("style")).toContain("var(--overlay-labs)");
  });
});
