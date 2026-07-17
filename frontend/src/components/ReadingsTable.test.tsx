// Behavior tests for ReadingsTable (DASH-09, D-23/D-24) — locks the
// newest-first ordering, 20+20 "Show 20 more" slicing, category chips,
// notes-only-when-present, and filter-change reset contracts.
import { fireEvent, render, screen } from "@testing-library/react";

import type { BPCategory, Reading } from "../api/types";
import { ReadingsTable } from "./ReadingsTable";

/** Naive local ISO string (DATA-05 shape) i days after 2025-01-01 08:00. */
function iso(i: number, hour = 8): string {
  const d = new Date(2025, 0, 1 + i, hour, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:00`;
}

/** Fixture factory — notes default to null (D-24: notes row only when present). */
function makeReading(i: number, overrides: Partial<Reading> = {}): Reading {
  return {
    id: i + 1,
    datetime: iso(i),
    systolic: 120,
    diastolic: 80,
    pulse: 58,
    am_pm: "AM",
    bp_category: "Normal" as BPCategory,
    pulse_category: "Bradycardia",
    map: 93.3,
    pulse_pressure: 40,
    notes: null,
    ...overrides,
  };
}

function makeReadings(n: number): Reading[] {
  return Array.from({ length: n }, (_, i) => makeReading(i));
}

/** All <tr> rows: header + visible data rows (+ notes rows when present). */
function rowCount(): number {
  return screen.getAllByRole("row").length;
}

test("renders 20 rows, then 40, then all 45 via Show 20 more; button disappears", () => {
  render(<ReadingsTable readings={makeReadings(45)} />);

  // 1 header row + 20 data rows
  expect(rowCount()).toBe(21);
  const button = screen.getByRole("button", { name: "Show 20 more" });

  fireEvent.click(button);
  expect(rowCount()).toBe(41); // header + 40

  fireEvent.click(screen.getByRole("button", { name: "Show 20 more" }));
  expect(rowCount()).toBe(46); // header + all 45

  expect(
    screen.queryByRole("button", { name: "Show 20 more" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Showing all 45 readings")).toBeInTheDocument();
});

test("sorts newest-first regardless of input order", () => {
  // Newest reading (largest datetime) has a distinctive BP so we can spot it.
  const newest = makeReading(44, { systolic: 199, diastolic: 99 });
  const shuffled = [
    makeReading(7),
    newest,
    makeReading(0),
    makeReading(30),
    makeReading(12),
  ];
  render(<ReadingsTable readings={shuffled} />);

  const rows = screen.getAllByRole("row");
  // rows[0] is the header; rows[1] is the first data row.
  expect(rows[1]).toHaveTextContent("199 / 99");
});

test("renders BP as 'systolic / diastolic', pulse, and a category chip", () => {
  const readings = [
    makeReading(0, {
      systolic: 128,
      diastolic: 74,
      pulse: 61,
      bp_category: "Stage 1",
    }),
  ];
  render(<ReadingsTable readings={readings} />);

  expect(screen.getByText("128 / 74")).toBeInTheDocument();
  expect(screen.getByText("61")).toBeInTheDocument();

  const chip = screen.getByText("Stage 1");
  // Chip is colored via the palette CSS vars (categoryColor + CHIP_TEXT).
  expect(chip.getAttribute("style")).toContain("var(--cat-stage1)");
  expect(chip.getAttribute("style")).toContain("var(--cat-chip-text)");
});

test("has accessible column headers and no MAP/pulse-pressure/pulse-category columns", () => {
  render(<ReadingsTable readings={makeReadings(3)} />);

  for (const header of [
    "Date",
    "Time",
    "AM/PM",
    "Blood pressure",
    "Pulse",
    "Category",
  ]) {
    expect(
      screen.getByRole("columnheader", { name: header }),
    ).toBeInTheDocument();
  }
  expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  expect(screen.queryByText(/MAP/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/pulse pressure/i)).not.toBeInTheDocument();
});

test("renders a notes row ONLY when notes is non-null and non-empty", () => {
  const readings = [
    makeReading(0, { notes: "felt dizzy" }),
    makeReading(1, { notes: "" }),
    makeReading(2), // notes: null
  ];
  render(<ReadingsTable readings={readings} />);

  // Exactly ONE notes row (the empty-string and null readings get none).
  const noteCells = screen.getAllByText(/^Note:/);
  expect(noteCells).toHaveLength(1);
  expect(screen.getByText(/felt dizzy/)).toBeInTheDocument();

  // header + 3 data rows + 1 notes row
  expect(rowCount()).toBe(5);
});

test("resets to 20 visible when the readings prop identity changes", () => {
  const { rerender } = render(<ReadingsTable readings={makeReadings(45)} />);

  fireEvent.click(screen.getByRole("button", { name: "Show 20 more" }));
  expect(rowCount()).toBe(41); // expanded to 40

  // New array identity (filter change) — stale expansion must not leak.
  rerender(<ReadingsTable readings={makeReadings(45)} />);
  expect(rowCount()).toBe(21); // back to header + 20
});
