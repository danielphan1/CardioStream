// Behavior tests for ProcedureFields (Plan 08-02, OVERLAY-02). Locks:
// - required-field gating (date + procedure_name)
// - optional fields omitted when empty
//
// No QueryClientProvider or vi.mock needed — ProcedureFields makes no
// network calls, mirrors UploadPage.test.tsx's plain render-and-assert shape.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProcedureFields } from "./ProcedureFields";

function setDate(value: string) {
  const dateInput = screen.getByPlaceholderText("YYYY-MM-DD");
  fireEvent.change(dateInput, { target: { value } });
}

describe("ProcedureFields (Plan 08-02)", () => {
  it("emits exactly { date, procedure_name } when only the required fields are filled", () => {
    const onDraftChange = vi.fn();
    render(<ProcedureFields onDraftChange={onDraftChange} />);

    setDate("2025-06-13");
    fireEvent.change(screen.getByLabelText("Procedure name"), {
      target: { value: "MRI" },
    });

    const latest = onDraftChange.mock.calls.at(-1)?.[0];
    expect(latest).toEqual({ date: "2025-06-13", procedure_name: "MRI" });
    expect(Object.keys(latest)).toEqual(["date", "procedure_name"]);
  });

  it("calls onDraftChange with null when Date is missing", () => {
    const onDraftChange = vi.fn();
    render(<ProcedureFields onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByLabelText("Procedure name"), {
      target: { value: "MRI" },
    });

    expect(onDraftChange.mock.calls.at(-1)?.[0]).toBeNull();
  });
});
