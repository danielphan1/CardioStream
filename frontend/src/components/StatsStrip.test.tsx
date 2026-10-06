// Behavior tests for StatsStrip (Phase 16.1, 16.1-UI-SPEC §5.6 / §6) — the
// one-row vitals strip that replaced the four stat cards and the
// category-percent list.
//
// This is the component's FIRST test file. Three contracts here were
// human-verification-only before and are now real automated gates:
//   1. the visible range is the en-dash numeric form asserted BY CODEPOINT,
//      so a hyphen-minus substitution fails. That string length is what holds
//      the locked row height at the 1024px worst case (§9.4's 9.9px slack) —
//      a silent "improvement" back to the long `min 98 · max 142` form would
//      wrap the cell to a third line and nothing else would catch it.
//   2. the min/max WORDS survive in a visually-hidden span, so shortening
//      what is drawn costs a screen-reader user nothing.
//   3. the D-22 null contract: zero readings renders em dashes, never 0 and
//      never blank. A health figure that shows 0 where the real answer is
//      "no data" is a clinical misstatement, not a cosmetic bug.
//   4. the values COUNT UP on arrival (quick 261005-mj2), so the assertions
//      that read a counted number are async now. The exact-match form is
//      preserved in every case — `findByText` and `waitFor` change only how
//      long the test is willing to wait, never what it accepts. In
//      particular the Readings cell's `textContent` comparison stays an
//      exact `toBe`: it is the §5.6 "no range, no filler copy" contract, and
//      relaxing it to `toContain` to accommodate an animation would trade a
//      real gate for a visual flourish.
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StatsSummary } from "../api/types";

import { StatsStrip } from "./StatsStrip";

// All six category labels are present in the payload (API-02 always returns
// them, zero-filled) precisely so the "the percent list is gone" assertions
// below prove a rendering decision rather than an empty array.
const CATEGORIES: StatsSummary["categories"] = [
  { category: "Hypotension", count: 0, percent: 0 },
  { category: "Normal", count: 12, percent: 40 },
  { category: "Elevated", count: 6, percent: 20 },
  { category: "Stage 1", count: 6, percent: 20 },
  { category: "Stage 2", count: 6, percent: 20 },
  { category: "Hypertensive Crisis", count: 0, percent: 0 },
];

const STATS: StatsSummary = {
  count: 30,
  systolic: { avg: 117.9, min: 98, max: 142 },
  diastolic: { avg: 76.4, min: 61, max: 95 },
  pulse: { avg: 68.2, min: 52, max: 101 },
  categories: CATEGORIES,
  latest_reading: "2026-09-30T08:15:00",
};

/** How long to wait for a counted value to SETTLE. The fourth card's own
 *  ladder delay is 360ms and the count runs 460ms, so the last number lands
 *  around 820ms — only 180ms inside Testing Library's 1000ms default, which
 *  is not enough headroom on a loaded machine. This widens the WAIT only;
 *  every assertion it guards is still an exact match, so a wrong or
 *  reformatted number fails here exactly as it did before. */
const SETTLE = { timeout: 3000 };

// count === 0 means every VitalStats is null (D-22).
const EMPTY_STATS: StatsSummary = {
  count: 0,
  systolic: null,
  diastolic: null,
  pulse: null,
  categories: CATEGORIES.map((c) => ({ ...c, count: 0, percent: 0 })),
  latest_reading: null,
};

/** The cell wrapper for a readout, found via its own label. */
function cellFor(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  if (labelEl.parentElement === null) throw new Error(`no cell for ${label}`);
  return labelEl.parentElement;
}

describe("landmark and cell anatomy (§5.6)", () => {
  it("renders the Summary statistics landmark with exactly four labels", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    const section = screen.getByRole("region", { name: "Summary statistics" });
    for (const label of ["Systolic", "Diastolic", "Pulse", "Readings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(section.querySelectorAll("section")).toHaveLength(0);
  });

  it("gives each vitals cell three stacked line boxes: label, value, range", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    const cell = cellFor("Systolic");
    // Was two line boxes (the value and range shared a baseline-aligned flex
    // row). The "Open Water" card treatment (quick 261003-hev) spends 32px of
    // each cell on padding, which leaves less than the 146.1px the inline
    // value-plus-range layout measured at, so the range moved to its own
    // line — the same anatomy both reference dashboards give a KPI tile.
    expect(cell.querySelectorAll("p")).toHaveLength(3);
    expect(cell.querySelectorAll(":scope > *")).toHaveLength(3);
  });

  it("stays two columns on phones and only goes to four from the lg breakpoint", () => {
    const { container } = render(<StatsStrip stats={STATS} isLoading={false} />);
    const grid = container.querySelector("section > div");
    expect(grid?.className).toContain("grid-cols-2");
    expect(grid?.className).toContain("lg:grid-cols-4");
    // Four columns at 768px would be a 152.0px worst case against 146.1px
    // needed — tighter than the floor §9.4 records, so it is rejected.
    expect(grid?.className).not.toContain("md:grid-cols-4");
  });
});

describe("the secondary range string (§6)", () => {
  it("draws the range as an en-dash numeric range, asserted by codepoint", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    const visible = screen.getByText("98–142");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(visible.textContent).toBe("98–142");
  });

  it("never substitutes a hyphen-minus or re-adds the min/max words visibly", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    expect(screen.queryByText("98-142")).toBeNull();
    expect(screen.queryByText("min 98 · max 142")).toBeNull();
  });

  it("keeps the min and max words in a visually-hidden span", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    const announced = screen.getByText("minimum 98, maximum 142");
    expect(announced).toHaveClass("sr-only");
    expect(announced).not.toHaveAttribute("aria-hidden");
  });

  // Still VERBATIM, still no client arithmetic — the count-up settles on the
  // payload string character for character, so these remain exact matches and
  // are merely awaited. A reformat (118, or 117.90) fails them exactly as a
  // client-side recomputation would.
  it("renders the backend averages verbatim, with no client arithmetic", async () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    expect(await screen.findByText("117.9", undefined, SETTLE)).toBeInTheDocument();
    expect(await screen.findByText("76.4", undefined, SETTLE)).toBeInTheDocument();
    expect(await screen.findByText("68.2", undefined, SETTLE)).toBeInTheDocument();
    expect(await screen.findByText("30", undefined, SETTLE)).toBeInTheDocument();
  });
});

describe("the Readings cell has no secondary line (§5.6)", () => {
  it("renders only a label and a count, with no range and no filler copy", async () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    const cell = cellFor("Readings");
    expect(cell.querySelectorAll("p")).toHaveLength(2);
    expect(cell.querySelectorAll(".sr-only")).toHaveLength(0);
    // Awaited because the count animates, but still an EXACT comparison of
    // the whole cell's text: "Readings" plus the number and nothing else.
    await waitFor(() => expect(cell.textContent).toBe("Readings30"), SETTLE);
  });

  it("invents no range words under the count", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    const cell = cellFor("Readings");
    for (const filler of ["total", "all time", "minimum", "maximum"]) {
      expect(cell.textContent?.toLowerCase()).not.toContain(filler);
    }
  });
});

describe("the D-22 null contract", () => {
  it("renders an em dash for every null value and range, never a zero", () => {
    render(<StatsStrip stats={EMPTY_STATS} isLoading={false} />);
    // Three null values plus three null ranges.
    expect(screen.getAllByText("—")).toHaveLength(6);
    for (const label of ["Systolic", "Diastolic", "Pulse"]) {
      // Label, value, range — the range line box survives the null state
      // rather than collapsing, so the row height does not change.
      expect(cellFor(label).querySelectorAll("p")).toHaveLength(3);
      expect(cellFor(label).textContent).not.toContain("0");
    }
    // The ONLY 0 in the strip is the reading count itself.
    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(1);
    expect(cellFor("Readings")).toContainElement(zeros[0]);
  });

  it("announces the missing range in words rather than leaving it blank", () => {
    render(<StatsStrip stats={EMPTY_STATS} isLoading={false} />);
    const announced = screen.getAllByText("minimum and maximum unavailable");
    expect(announced).toHaveLength(3);
    for (const el of announced) expect(el).toHaveClass("sr-only");
  });
});

describe("loading and absent states", () => {
  it("marks the section busy and renders four pulsing skeleton cells", () => {
    const { container } = render(<StatsStrip stats={undefined} isLoading />);
    const section = screen.getByRole("region", { name: "Summary statistics" });
    expect(section).toHaveAttribute("aria-busy", "true");
    // The skeleton's pulse is `motion-safe:animate-pulse` now (quick
    // 261005-mj2 gated the one remaining ungated animation in the app), and
    // the rendered class TOKEN is therefore `motion-safe:animate-pulse`, which
    // the `.animate-pulse` class selector does not match. Substring match
    // instead — and the count of FOUR stays, because four skeleton cells is
    // the §5.6 loading contract (the row must not jump when data lands), not
    // merely "a skeleton exists".
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(
      4,
    );
    expect(screen.queryByText("Systolic")).toBeNull();
  });

  it("renders nothing when there is no data and no load in flight", () => {
    const { container } = render(<StatsStrip stats={undefined} isLoading={false} />);
    // The error surface is centralized in App — this component owns no copy
    // for it, so the absent state is an empty render.
    expect(container).toBeEmptyDOMElement();
  });
});

describe("what the strip no longer renders (§5.6)", () => {
  it("draws no chart of its own: the sparkline is gone", () => {
    const { container } = render(<StatsStrip stats={STATS} isLoading={false} />);
    // Not a bare svg count, and not a path count: since 2026-10-02 each
    // readout carries a decorative lucide symbol, and those are svgs made of
    // paths. What must stay absent is a PLOTTED chart. The sparkline was a
    // Recharts component, so its wrapper class is the honest marker — and the
    // structural guarantee behind it is that this component no longer accepts
    // the raw per-reading series at all, so it cannot plot one.
    expect(container.querySelectorAll('[class*="recharts"]')).toHaveLength(0);
    expect(container.querySelectorAll("polyline")).toHaveLength(0);
  });

  it("gives each readout a decorative symbol that adds nothing to the announced text", () => {
    const { container } = render(<StatsStrip stats={STATS} isLoading={false} />);
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(4);
    // Decoration only: the adjacent word names the vital, so no symbol may
    // reach the accessibility tree or the announced string.
    icons.forEach((i) => expect(i.getAttribute("aria-hidden")).toBe("true"));
    // The labels still carry the meaning on their own.
    for (const label of ["Systolic", "Diastolic", "Pulse", "Readings"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows no status pill naming a blood-pressure category", () => {
    render(<StatsStrip stats={STATS} isLoading={false} />);
    for (const c of CATEGORIES) {
      expect(screen.queryByText(c.category)).toBeNull();
    }
  });

  it("shows no category-percent list even though the payload carries one", () => {
    const { container } = render(<StatsStrip stats={STATS} isLoading={false} />);
    expect(screen.queryByLabelText("Readings by category")).toBeNull();
    expect(container.querySelectorAll("ul")).toHaveLength(0);
    expect(screen.queryByText("Normal 40%")).toBeNull();
  });
});
