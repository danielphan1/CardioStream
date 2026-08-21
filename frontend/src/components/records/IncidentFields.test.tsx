// Behavior tests for IncidentFields (Plan 08-02, OVERLAY-02). Locks:
// - date+time combine into the naive-local, seconds-included format
//   ("2025-04-01T08:00:00" — no Z, no offset — Pitfall 5)
// - presence-only required check on Time (Pitfall 4): an empty native
//   time input is "", not a format error, but the field is still required
// - optional-field omission (duration present, notes empty)
//
// No QueryClientProvider or vi.mock needed — IncidentFields makes no
// network calls, mirrors LabFields.test.tsx's plain render-and-assert shape.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IncidentFields } from "./IncidentFields";

function setDate(value: string) {
  const dateInput = screen.getByPlaceholderText("YYYY-MM-DD");
  fireEvent.change(dateInput, { target: { value } });
}

describe("IncidentFields (Plan 08-02)", () => {
  it("combines date+time into the naive-local seconds-included datetime string (Pitfall 5)", () => {
    const onDraftChange = vi.fn();
    render(<IncidentFields onDraftChange={onDraftChange} />);

    setDate("2025-04-01");
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "08:00" },
    });
    fireEvent.change(screen.getByLabelText("What happened"), {
      target: { value: "Fall" },
    });

    const latest = onDraftChange.mock.calls.at(-1)?.[0];
    expect(latest.datetime).toBe("2025-04-01T08:00:00");
    expect(latest.incident_type).toBe("Fall");
  });

  it("calls onDraftChange with null when Time is empty, even with valid date+incident_type (Pitfall 4)", () => {
    const onDraftChange = vi.fn();
    render(<IncidentFields onDraftChange={onDraftChange} />);

    setDate("2025-04-01");
    fireEvent.change(screen.getByLabelText("What happened"), {
      target: { value: "Fall" },
    });
    // Time left untouched ("").

    expect(onDraftChange.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it("includes duration and omits notes when notes is left empty", () => {
    const onDraftChange = vi.fn();
    render(<IncidentFields onDraftChange={onDraftChange} />);

    setDate("2025-04-01");
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "08:00" },
    });
    fireEvent.change(screen.getByLabelText("What happened"), {
      target: { value: "Fall" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "2 hours" },
    });

    const latest = onDraftChange.mock.calls.at(-1)?.[0];
    expect(latest.duration).toBe("2 hours");
    expect("notes" in latest).toBe(false);
  });
});
