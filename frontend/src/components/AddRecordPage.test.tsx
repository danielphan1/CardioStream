// Behavior tests for AddRecordPage (Plan 08-03, OVERLAY-02) — the container
// that mounts Plan 08-02's field-sets by type, gates a shared Submit button on
// their reported draft body, calls the correct create-mutation hook, and
// renders the D-03/D-04-locked inline confirmation-and-clear / error loop.
//
// postLab/postIncident/postProcedure are the ONLY mocks (mirrors
// CommandBar.test.tsx's "the ONLY mock" convention) — real useMutation, real
// QueryClientProvider, real ApiError class so the error-branch test exercises
// the true `instanceof` check.
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ApiError, postIncident, postLab, postProcedure } from "../api/client";
import type { Incident, LabResult, Procedure } from "../api/types";
import { AddRecordPage } from "./AddRecordPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    postLab: vi.fn(),
    postIncident: vi.fn(),
    postProcedure: vi.fn(),
  };
});

const mockPostLab = postLab as unknown as Mock;
const mockPostIncident = postIncident as unknown as Mock;
const mockPostProcedure = postProcedure as unknown as Mock;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddRecordPage />
    </QueryClientProvider>,
  );
}

function fillLabRequired() {
  fireEvent.change(screen.getByPlaceholderText("YYYY-MM-DD"), {
    target: { value: "2025-06-13" },
  });
  fireEvent.change(screen.getByLabelText("Test name"), {
    target: { value: "A1C" },
  });
}

const labResult: LabResult = {
  id: 1,
  date: "2025-06-13",
  test_name: "A1C",
  result: null,
  unit: null,
  range_low: null,
  range_high: null,
  notes: null,
};

const incident: Incident = {
  id: 1,
  datetime: "2025-06-13T09:00:00",
  incident_type: "Fall",
  duration: null,
  notes: null,
};

const procedure: Procedure = {
  id: 1,
  date: "2025-06-13",
  procedure_name: "MRI",
  location: null,
  outcome: null,
  notes: null,
};

beforeEach(() => {
  mockPostLab.mockReset();
  mockPostIncident.mockReset();
  mockPostProcedure.mockReset();
});

describe("AddRecordPage (Plan 08-03)", () => {
  it("shows Lab active by default with Submit aria-disabled until required fields are filled", () => {
    renderPage();

    expect(
      screen.getByRole("group", { name: "Record type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lab" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const submit = screen.getByRole("button", { name: "Add Lab Result" });
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fillLabRequired();

    expect(submit).toHaveAttribute("aria-disabled", "false");
  });

  it("discards the Lab field-set's typed values when switching to Incident and back (silent-discard default)", () => {
    renderPage();

    fillLabRequired();
    expect(screen.getByLabelText("Test name")).toHaveValue("A1C");

    fireEvent.click(screen.getByRole("button", { name: "Incident" }));
    expect(
      screen.getByRole("button", { name: "Add Incident" }),
    ).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("button", { name: "Lab" }));
    expect(screen.getByLabelText("Test name")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Add Lab Result" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("submits a valid Lab immediately off the POST resolving, shows confirmation, and clears the field-set", async () => {
    mockPostLab.mockResolvedValue(labResult);
    renderPage();

    fillLabRequired();
    fireEvent.click(screen.getByRole("button", { name: "Add Lab Result" }));

    const region = await screen.findByRole("status");
    expect(region).toHaveTextContent("Added 1 lab result.");
    expect(mockPostLab).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Test name")).toHaveValue("");
  });

  it("submits a valid Incident and shows the incident confirmation", async () => {
    mockPostIncident.mockResolvedValue(incident);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Incident" }));
    fireEvent.change(screen.getByPlaceholderText("YYYY-MM-DD"), {
      target: { value: "2025-06-13" },
    });
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText("What happened"), {
      target: { value: "Fall" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Incident" }));

    const region = await screen.findByRole("status");
    expect(region).toHaveTextContent("Added 1 incident.");
    expect(mockPostIncident).toHaveBeenCalledTimes(1);
  });

  it("submits a valid Procedure and shows the procedure confirmation", async () => {
    mockPostProcedure.mockResolvedValue(procedure);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Procedure" }));
    fireEvent.change(screen.getByPlaceholderText("YYYY-MM-DD"), {
      target: { value: "2025-06-13" },
    });
    fireEvent.change(screen.getByLabelText("Procedure name"), {
      target: { value: "MRI" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Procedure" }));

    const region = await screen.findByRole("status");
    expect(region).toHaveTextContent("Added 1 procedure.");
    expect(mockPostProcedure).toHaveBeenCalledTimes(1);
  });

  it("shows the fixed generic error sentence on a rejected Lab submit, never raw error text (T-08-04)", async () => {
    mockPostLab.mockRejectedValue(new ApiError(422, "/labs"));
    renderPage();

    fillLabRequired();
    fireEvent.click(screen.getByRole("button", { name: "Add Lab Result" }));

    const region = await screen.findByRole("alert");
    expect(region).toHaveTextContent(
      "Something went wrong saving that lab result. Nothing was added — please try again.",
    );
    expect(screen.queryByText(/422/)).not.toBeInTheDocument();
    expect(screen.queryByText(/API request failed/)).not.toBeInTheDocument();
  });
});
