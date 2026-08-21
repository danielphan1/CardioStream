// Behavior tests for LabFields (Plan 08-02, OVERLAY-02). Locks:
// - required-field gating (date + test_name)
// - Pitfall 3 NaN-guard: non-empty-but-non-numeric optional numeric text
//   blocks the whole body (onDraftChange(null)), not just the bad field
// - optional fields are omitted (not sent as "" / null) when empty
//
// No QueryClientProvider or vi.mock needed — LabFields makes no network
// calls, mirrors UploadPage.test.tsx's plain render-and-assert shape.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabFields } from "./LabFields";

function setDate(value: string) {
  const dateInput = screen.getByPlaceholderText("YYYY-MM-DD");
  fireEvent.change(dateInput, { target: { value } });
}

describe("LabFields (Plan 08-02)", () => {
  it("emits exactly { date, test_name } when only the required fields are filled", () => {
    const onDraftChange = vi.fn();
    render(<LabFields onDraftChange={onDraftChange} />);

    setDate("2025-06-13");
    fireEvent.change(screen.getByLabelText("Test name"), {
      target: { value: "A1C" },
    });

    const latest = onDraftChange.mock.calls.at(-1)?.[0];
    expect(latest).toEqual({ date: "2025-06-13", test_name: "A1C" });
    expect(Object.keys(latest)).toEqual(["date", "test_name"]);
  });

  it("blocks the whole body with null when Result is non-empty but non-numeric (Pitfall 3)", () => {
    const onDraftChange = vi.fn();
    render(<LabFields onDraftChange={onDraftChange} />);

    setDate("2025-06-13");
    fireEvent.change(screen.getByLabelText("Test name"), {
      target: { value: "A1C" },
    });
    fireEvent.change(screen.getByLabelText("Result"), {
      target: { value: "abc" },
    });

    expect(onDraftChange.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it("includes result/range_low/range_high as numbers when numeric text is provided", () => {
    const onDraftChange = vi.fn();
    render(<LabFields onDraftChange={onDraftChange} />);

    setDate("2025-06-13");
    fireEvent.change(screen.getByLabelText("Test name"), {
      target: { value: "A1C" },
    });
    fireEvent.change(screen.getByLabelText("Result"), {
      target: { value: "5.4" },
    });
    fireEvent.change(screen.getByLabelText("Normal range — low"), {
      target: { value: "4.0" },
    });
    fireEvent.change(screen.getByLabelText("Normal range — high"), {
      target: { value: "6.0" },
    });

    const latest = onDraftChange.mock.calls.at(-1)?.[0];
    expect(latest.result).toBe(5.4);
    expect(latest.range_low).toBe(4.0);
    expect(latest.range_high).toBe(6.0);
  });

  it("calls onDraftChange with null when Date is untouched (required field missing)", () => {
    const onDraftChange = vi.fn();
    render(<LabFields onDraftChange={onDraftChange} />);

    fireEvent.change(screen.getByLabelText("Test name"), {
      target: { value: "A1C" },
    });

    expect(onDraftChange.mock.calls.at(-1)?.[0]).toBeNull();
    // No visible error text renders for an untouched field.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
