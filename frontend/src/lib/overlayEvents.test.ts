// Unit tests for lib/overlayEvents.ts — OVERLAY-04/OVERLAY-06.
// Key contracts: date-only fields (lab/procedure) route through
// parseDateOnly (Pitfall 1), incident's datetime routes through plain
// new Date() (matches toTimePoints' convention), and the UI-SPEC-locked
// copy builders (empty/error/sentence).
import { describe, expect, it } from "vitest";

import type { Incident, LabResult, Procedure } from "../api/types";
import {
  buildEmptyMessage,
  buildErrorMessage,
  buildOverlaySentence,
  incidentsToEvents,
  labsToEvents,
  mergeOverlayEvents,
  proceduresToEvents,
} from "./overlayEvents";

function lab(overrides: Partial<LabResult> = {}): LabResult {
  return {
    id: 1,
    date: "2025-06-03",
    test_name: "A1C",
    result: 5.4,
    unit: "mg/dL",
    range_low: null,
    range_high: null,
    notes: null,
    ...overrides,
  };
}

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 1,
    datetime: "2025-06-03T07:42:00",
    incident_type: "Fall",
    duration: "2 hours",
    notes: null,
    ...overrides,
  };
}

function procedure(overrides: Partial<Procedure> = {}): Procedure {
  return {
    id: 1,
    date: "2025-06-03",
    procedure_name: "MRI",
    location: "City Hospital",
    outcome: "Completed without complications",
    notes: null,
    ...overrides,
  };
}

describe("labsToEvents", () => {
  it("parses date-only `date` via parseDateOnly, never bare new Date() (Pitfall 1)", () => {
    const events = labsToEvents([lab({ date: "2025-02-22" })]);
    const d = new Date(events[0].ts);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(1); // February (0-based)
    expect(d.getDate()).toBe(22);
  });

  it("formats whatHappened as 'TestName — Result Unit' when both present", () => {
    const events = labsToEvents([lab({ test_name: "A1C", result: 5.4, unit: "mg/dL" })]);
    expect(events[0].whatHappened).toBe("A1C — 5.4 mg/dL");
  });

  it("formats whatHappened as just the test name when result and unit are null", () => {
    const events = labsToEvents([lab({ test_name: "A1C", result: null, unit: null })]);
    expect(events[0].whatHappened).toBe("A1C");
  });

  it("sets type to 'labs' and carries id/notes through", () => {
    const events = labsToEvents([lab({ id: 42, notes: "fasted" })]);
    expect(events[0].type).toBe("labs");
    expect(events[0].id).toBe(42);
    expect(events[0].notes).toBe("fasted");
  });
});

describe("incidentsToEvents", () => {
  it("parses `datetime` via plain new Date(), matching toTimePoints' convention", () => {
    const events = incidentsToEvents([incident({ datetime: "2025-06-03T07:42:00" })]);
    expect(events[0].ts).toBe(new Date("2025-06-03T07:42:00").getTime());
  });

  it("formats whatHappened as 'Type — Duration' when duration is present", () => {
    const events = incidentsToEvents([
      incident({ incident_type: "Fall", duration: "2 hours" }),
    ]);
    expect(events[0].whatHappened).toBe("Fall — 2 hours");
  });

  it("formats whatHappened as just the type when duration is null", () => {
    const events = incidentsToEvents([incident({ incident_type: "Fall", duration: null })]);
    expect(events[0].whatHappened).toBe("Fall");
  });

  it("sets type to 'incidents'", () => {
    const events = incidentsToEvents([incident()]);
    expect(events[0].type).toBe("incidents");
  });
});

describe("proceduresToEvents", () => {
  it("parses date-only `date` via parseDateOnly, never bare new Date() (Pitfall 1)", () => {
    const events = proceduresToEvents([procedure({ date: "2025-02-22" })]);
    const d = new Date(events[0].ts);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(1); // February (0-based)
    expect(d.getDate()).toBe(22);
  });

  it("formats whatHappened as 'Name — Location; Outcome' when both present", () => {
    const events = proceduresToEvents([
      procedure({
        procedure_name: "MRI",
        location: "City Hospital",
        outcome: "Completed without complications",
      }),
    ]);
    expect(events[0].whatHappened).toBe("MRI — City Hospital; Completed without complications");
  });

  it("formats whatHappened as just the name when location and outcome are null", () => {
    const events = proceduresToEvents([
      procedure({ procedure_name: "MRI", location: null, outcome: null }),
    ]);
    expect(events[0].whatHappened).toBe("MRI");
  });

  it("sets type to 'procedures'", () => {
    const events = proceduresToEvents([procedure()]);
    expect(events[0].type).toBe("procedures");
  });
});

describe("mergeOverlayEvents", () => {
  it("sorts the combined array strictly descending by ts, interleaving mixed types", () => {
    const labEvents = labsToEvents([lab({ id: 1, date: "2025-06-01" })]);
    const incidentEvents = incidentsToEvents([
      incident({ id: 2, datetime: "2025-06-03T07:42:00" }),
    ]);
    const procedureEvents = proceduresToEvents([procedure({ id: 3, date: "2025-06-02" })]);

    const merged = mergeOverlayEvents(labEvents, incidentEvents, procedureEvents);

    expect(merged.map((e) => e.type)).toEqual(["incidents", "procedures", "labs"]);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].ts).toBeGreaterThan(merged[i].ts);
    }
  });

  it("regardless of input array order, produces the same descending-sorted output", () => {
    const labEvents = labsToEvents([lab({ id: 1, date: "2025-06-01" })]);
    const incidentEvents = incidentsToEvents([
      incident({ id: 2, datetime: "2025-06-03T07:42:00" }),
    ]);
    const procedureEvents = proceduresToEvents([procedure({ id: 3, date: "2025-06-02" })]);

    const merged = mergeOverlayEvents(procedureEvents, labEvents, incidentEvents);

    expect(merged.map((e) => e.type)).toEqual(["incidents", "procedures", "labs"]);
  });
});

describe("buildEmptyMessage", () => {
  it("renders the 1-type message", () => {
    expect(buildEmptyMessage(["labs"])).toBe("No labs recorded in this date range.");
  });

  it("renders the 2-type message joined with 'or', in labs→incidents→procedures order", () => {
    expect(buildEmptyMessage(["incidents", "labs"])).toBe(
      "No labs or incidents recorded in this date range.",
    );
  });

  it("renders the 3-type message with an Oxford comma + 'or'", () => {
    expect(buildEmptyMessage(["procedures", "labs", "incidents"])).toBe(
      "No labs, incidents, or procedures recorded in this date range.",
    );
  });
});

describe("buildErrorMessage", () => {
  it("renders the labs error message", () => {
    expect(buildErrorMessage("labs")).toBe("Couldn't load labs — try again in a moment.");
  });

  it("renders the incidents error message", () => {
    expect(buildErrorMessage("incidents")).toBe(
      "Couldn't load incidents — try again in a moment.",
    );
  });

  it("renders the procedures error message", () => {
    expect(buildErrorMessage("procedures")).toBe(
      "Couldn't load procedures — try again in a moment.",
    );
  });
});

describe("buildOverlaySentence", () => {
  it('renders "No overlays selected" when all three flags are false', () => {
    expect(
      buildOverlaySentence({ labs: false, incidents: false, procedures: false }),
    ).toBe("No overlays selected");
  });

  it('renders "Labs, Incidents overlaid" when labs+incidents are true, procedures false', () => {
    expect(
      buildOverlaySentence({ labs: true, incidents: true, procedures: false }),
    ).toBe("Labs, Incidents overlaid");
  });

  it("orders the list labs→incidents→procedures regardless of key order", () => {
    expect(
      buildOverlaySentence({ procedures: true, labs: true, incidents: false }),
    ).toBe("Labs, Procedures overlaid");
  });
});
