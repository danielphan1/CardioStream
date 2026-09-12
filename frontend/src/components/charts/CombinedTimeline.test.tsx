// Behavior tests for CombinedTimeline (Phase 14, D-01/D-03/D-04) — the
// dual-axis chart that replaced the mutually-exclusive BPTimeline/PulseTrend
// pair. Ports the still-live assertions from both retired suites.
//
// jsdom has no layout, so Recharts' ResponsiveContainer normally measures 0x0
// and nothing paints (see StatsSparkline.test.tsx's note). Unlike a sparkline,
// this component's contract IS its rendered structure — which axes are
// mounted, which series exist, whether pulse is dashed — so asserting
// "does not throw" would be vacuous here. The mock below hands the chart a
// real size so the SVG actually renders and can be inspected.
import { render } from "@testing-library/react";
import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Report prefers-reduced-motion, which sets isAnimationActive={false}. Two
// things in Recharts depend on this and would otherwise make these assertions
// meaningless rather than merely flaky:
//   - `showLabels = !isAnimating`, so line-end labels never mount mid-animation
//   - the draw-in effect overwrites strokeDasharray, and jsdom's missing
//     getTotalLength() pins it at "0px 0px"
// Disabling animation also exercises the motion-reduce path the accessibility
// floor requires, so this is the honest environment to assert structure in.
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  );
});

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children, { width: 900, height: 420 } as never)
        : children,
  };
});

const { default: CombinedTimeline } = await import("./CombinedTimeline");

import type { Reading } from "../../api/types";

const reading = (
  id: number,
  datetime: string,
  systolic: number,
  diastolic: number,
  pulse: number,
): Reading => ({
  id,
  datetime,
  systolic,
  diastolic,
  pulse,
  am_pm: "AM",
  bp_category: "Normal",
  pulse_category: "Normal",
  map: Math.round((systolic + 2 * diastolic) / 3),
  pulse_pressure: systolic - diastolic,
  notes: null,
});

const READINGS: Reading[] = [
  reading(1, "2025-01-05T08:00:00", 128, 78, 72),
  reading(2, "2025-02-05T08:00:00", 142, 85, 68),
  reading(3, "2025-03-05T08:00:00", 135, 80, 81),
  reading(4, "2025-04-05T08:00:00", 151, 88, 75),
];

const OVERLAY_GLYPH = "\u25B2"; // incidents marker, from OVERLAY_META

const EVENTS = [
  {
    id: 1,
    ts: new Date("2025-02-20T00:00:00").getTime(),
    type: "incidents" as const,
    dateCell: "February 20, 2025",
    whatHappened: "Hospitalization",
    notes: null,
  },
];

/** Recharts tags each cartesian axis with its own class. */
const yAxes = (c: HTMLElement) => c.querySelectorAll(".recharts-yAxis");
const lines = (c: HTMLElement) => c.querySelectorAll(".recharts-line-curve");

describe("CombinedTimeline axis mounting", () => {
  // The load-bearing invariant, asserted through its actual consequence.
  //
  // Event markers bind to the mmHg axis unconditionally. Recharts resolves
  // yAxisId against REGISTERED axes, and `hide` only removes the axis from
  // the DOM while keeping it registered — which is exactly why both <YAxis>
  // elements stay in the tree and are hidden rather than conditionally
  // unmounted. Counting `.recharts-yAxis` nodes would therefore measure the
  // wrong thing (a hidden axis paints nothing); markers surviving is the
  // behaviour that would actually break for Chris.
  it.each([
    ["both vitals", true, true],
    ["blood pressure only", true, false],
    ["pulse only", false, true],
  ])("renders event markers with %s", (_label, showBP, showPulse) => {
    const { container } = render(
      <CombinedTimeline
        readings={READINGS}
        overlayEvents={EVENTS}
        showBP={showBP}
        showPulse={showPulse}
      />,
    );
    expect(container.textContent).toContain(OVERLAY_GLYPH);
  });

  it("paints only the mmHg axis when pulse is off", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse={false} />,
    );
    expect(yAxes(container)).toHaveLength(1);
    expect(container.textContent).toContain("220"); // mmHg tick
  });

  it("paints only the bpm axis when blood pressure is off", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    expect(yAxes(container)).toHaveLength(1);
    expect(container.textContent).not.toContain("220"); // no mmHg ticks
  });

  it("paints both axes when both vitals are on", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse />,
    );
    expect(yAxes(container)).toHaveLength(2);
  });
});

describe("CombinedTimeline series", () => {
  it("draws three lines when both vitals are on", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse />,
    );
    expect(lines(container)).toHaveLength(3);
  });

  it("draws only systolic and diastolic with pulse off", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse={false} />,
    );
    expect(lines(container)).toHaveLength(2);
  });

  it("draws only pulse with blood pressure off", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    expect(lines(container)).toHaveLength(1);
  });

  it("strokes pulse dashed and in its own colour — the Phase 14 fix", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    const pulse = lines(container)[0];
    expect(pulse.getAttribute("stroke")).toBe("var(--line-pulse)");
    // Dashed is load-bearing: pulse/systolic luminance ratio is ~1.9:1, so
    // in greyscale the stroke pattern is what separates the two series.
    expect(pulse.getAttribute("stroke-dasharray")).toBe("9 5");
  });

  it("never strokes pulse with the systolic colour (the original bug)", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse />,
    );
    const strokes = Array.from(lines(container)).map((l) => l.getAttribute("stroke"));
    expect(new Set(strokes).size).toBe(3);
  });
});

describe("CombinedTimeline conditional chrome (D-04)", () => {
  it("renders the AHA bands only when blood pressure is on", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse={false} />,
    );
    expect(
      container.querySelectorAll(".recharts-reference-area").length,
    ).toBeGreaterThan(0);
  });

  it("renders no bands when blood pressure is off", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    expect(container.querySelectorAll(".recharts-reference-area")).toHaveLength(
      0,
    );
  });

  it("renders the bradycardia reference line only when pulse is on", () => {
    const { container: withPulse } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    expect(withPulse.textContent).toContain("Bradycardia");

    const { container: noPulse } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse={false} />,
    );
    expect(noPulse.textContent).not.toContain("Bradycardia");
  });

  it("labels each visible series at its line end", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse />,
    );
    expect(container.textContent).toContain("Systolic");
    expect(container.textContent).toContain("Diastolic");
    expect(container.textContent).toContain("Pulse");
  });
});

describe("CombinedTimeline domains stay fixed (D-05 / DASH-06)", () => {
  it("uses the clinical mmHg ticks, never auto-fit to the data", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP showPulse={false} />,
    );
    // Data maxes at 151, but the fixed domain still labels 180 and 220.
    expect(container.textContent).toContain("220");
    expect(container.textContent).toContain("180");
  });

  it("uses the fixed bpm ticks", () => {
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    expect(container.textContent).toContain("30");
    expect(container.textContent).toContain("120");
  });
});
