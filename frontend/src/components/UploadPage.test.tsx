// Behavior tests for the caregiver upload surface (DASH-10, D-08/D-09/D-10,
// plan 05-05). Locks:
// - selecting a file ingests IMMEDIATELY via postFile (no preview/confirm, D-08)
// - the IngestSummary renders as plain-language SENTENCES with pluralization
//   (D-09), never numeric stat-tiles
// - rejected rows fold into an optional disclosure of value-free reasons (D-10)
// - a 400 shows the non-OMRON copy; any other failure shows the generic copy;
//   NEITHER ever surfaces a status code or traceback (D-10, T-05-13)
//
// postFile is the only mock (the real ApiError runs so the 400-vs-generic branch
// is exercised through the true error type).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ApiError, postFile } from "../api/client";
import type { IngestSummary } from "../api/types";
import { UploadPage } from "./UploadPage";

// Keep the real module (ApiError) — replace only postFile.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, postFile: vi.fn() };
});

const mockPostFile = postFile as unknown as Mock;

beforeEach(() => {
  mockPostFile.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function selectFile(container: HTMLElement, name = "omron.xlsx") {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File(["data"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

const baseSummary: IngestSummary = {
  added: 12,
  updated: 0,
  unchanged: 3,
  rejected: [],
  total: 15,
  latest: "2025-06-13T09:21:00",
};

describe("UploadPage summary sentences (D-09)", () => {
  it("renders the plain-language sentences (the user-endorsed verbatim, plurals)", async () => {
    mockPostFile.mockResolvedValue(baseSummary);
    const { container } = render(<UploadPage />);

    selectFile(container);

    const panel = await screen.findByRole("status");
    expect(panel.textContent).toContain("Added 12 new readings.");
    expect(panel.textContent).toContain("3 were already on file.");
    expect(panel.textContent).toContain("0 skipped.");
    expect(panel.textContent).toContain(
      "Your data now goes through June 13, 2025.",
    );
    // Common case: nothing updated → the "Updated …" sentence is omitted.
    expect(panel.textContent).not.toContain("Updated");
    // postFile was called immediately with the chosen file (D-08, no confirm).
    expect(mockPostFile).toHaveBeenCalledWith("/upload", expect.any(File));
  });

  it("uses singular nouns/verbs when counts are 1 (pluralization)", async () => {
    mockPostFile.mockResolvedValue({
      added: 1,
      updated: 1,
      unchanged: 1,
      rejected: [],
      total: 3,
      latest: "2025-06-13T09:21:00",
    } satisfies IngestSummary);
    const { container } = render(<UploadPage />);

    selectFile(container);

    const panel = await screen.findByRole("status");
    expect(panel.textContent).toContain("Added 1 new reading.");
    expect(panel.textContent).toContain("Updated 1 reading that changed.");
    expect(panel.textContent).toContain("1 was already on file.");
  });

  it("omits the through-date sentence when nothing is on file (total 0)", async () => {
    mockPostFile.mockResolvedValue({
      added: 0,
      updated: 0,
      unchanged: 0,
      rejected: [],
      total: 0,
      latest: null,
    } satisfies IngestSummary);
    const { container } = render(<UploadPage />);

    selectFile(container);

    const panel = await screen.findByRole("status");
    expect(panel.textContent).toContain("Added 0 new readings.");
    expect(panel.textContent).not.toContain("Your data now goes through");
  });
});

describe("UploadPage rejected-row disclosure (D-10)", () => {
  it("shows a disclosure of value-free reasons when rows are skipped", async () => {
    mockPostFile.mockResolvedValue({
      added: 2,
      updated: 0,
      unchanged: 0,
      rejected: [
        { row_index: 4, reason: "datetime: missing or unparseable" },
        { row_index: 7, reason: "systolic: missing or unparseable" },
      ],
      total: 2,
      latest: "2025-06-13T09:21:00",
    } satisfies IngestSummary);
    const { container } = render(<UploadPage />);

    selectFile(container);

    // The skipped count reflects the rejected rows.
    const panel = await screen.findByRole("status");
    expect(panel.textContent).toContain("2 skipped.");

    // The disclosure toggle exists and reveals value-free per-row reasons.
    const toggle = screen.getByRole("button", { name: /show which rows/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Row 4: datetime: missing or unparseable.")).toBeInTheDocument();
    expect(screen.getByText("Row 7: systolic: missing or unparseable.")).toBeInTheDocument();
  });

  it("shows no disclosure when nothing was skipped", async () => {
    mockPostFile.mockResolvedValue(baseSummary);
    const { container } = render(<UploadPage />);

    selectFile(container);

    await screen.findByRole("status");
    expect(
      screen.queryByRole("button", { name: /show which rows/i }),
    ).not.toBeInTheDocument();
  });
});

describe("UploadPage friendly errors (D-10, T-05-13)", () => {
  it("maps a 400 to the non-OMRON notice — never a status code", async () => {
    mockPostFile.mockRejectedValue(new ApiError(400, "/upload"));
    const { container } = render(<UploadPage />);

    selectFile(container, "not-omron.xlsx");

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain(
      "This doesn't look like an OMRON export.",
    );
    expect(notice.textContent).toContain("Nothing was added.");
    expect(screen.queryByText(/400/)).not.toBeInTheDocument();
    expect(screen.queryByText(/API request failed/)).not.toBeInTheDocument();
    // No success summary rendered — the file ingested nothing.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("maps any non-400 failure to the generic notice — never a traceback", async () => {
    mockPostFile.mockRejectedValue(new ApiError(0, "/upload"));
    const { container } = render(<UploadPage />);

    selectFile(container);

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Something went wrong reading that file.");
    expect(screen.queryByText(/500|API request failed/)).not.toBeInTheDocument();
  });
});

describe("UploadPage loading state (D-08)", () => {
  it("shows the reading-your-file line while the POST is in flight", async () => {
    let resolve!: (v: IngestSummary) => void;
    mockPostFile.mockReturnValue(
      new Promise<IngestSummary>((r) => {
        resolve = r;
      }),
    );
    const { container } = render(<UploadPage />);

    selectFile(container);

    expect(await screen.findByText("Reading your file…")).toBeInTheDocument();
    resolve(baseSummary);
    await waitFor(() =>
      expect(screen.queryByText("Reading your file…")).not.toBeInTheDocument(),
    );
  });
});
