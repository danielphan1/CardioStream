// Narrow-width behaviour of CombinedTimeline (quick 261003-iuc).
//
// Its own file because it has to mock useElementWidth, and the main
// CombinedTimeline.test.tsx deliberately exercises the measured-width-unknown
// path (jsdom never fires ResizeObserver, so `width` stays 0 there and the
// full-width layout is what renders).
//
// What this guards: at a phone width the 112px right margin reserved for the
// end-label pills left an 86px plot inside a 318px chart. Dropping the pills
// reclaims it, but the pills are the ONLY thing naming the three series — so
// the key has to appear in the same breath, or the chart becomes unreadable
// in a different way.
import { render } from "@testing-library/react";
import { cloneElement, isValidElement, type ReactElement } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Reading } from "../../api/types";

// Same reduced-motion stub as CombinedTimeline.test.tsx, and for the same
// reason: Recharts gates line-end labels on `showLabels = !isAnimating`, so
// with animation on the end-label pills never mount and every assertion about
// them below would pass for the wrong reason.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
});

// Recharts draws nothing at zero width, and jsdom has no layout — so the
// container is pinned, exactly as CombinedTimeline.test.tsx does. This is the
// CHART's width; `useElementWidth` below is the CARD's measured width, and it
// is that one, not this, that decides `compact`.
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

const width = { current: 0 };
// One stable ref object, as useRef would hand back, so the mock does not
// churn the node attach/detach on every render. `width` is the knob the tests
// turn: it is the CARD's measured width, which is what decides `compact`.
const stableRef = { current: null as HTMLDivElement | null };
vi.mock("../../hooks/useElementWidth", () => ({
  useElementWidth: () => ({ ref: stableRef, width: width.current }),
}));

const { default: CombinedTimeline } = await import("./CombinedTimeline");

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

// Four points, deliberately under the hasTrend threshold (>= 7): the pills sit
// on the RAW lines here, which is the path with three separate call sites.
const READINGS: Reading[] = [
  reading(1, "2025-01-05T08:00:00", 128, 78, 72),
  reading(2, "2025-02-05T08:00:00", 142, 85, 68),
  reading(3, "2025-03-05T08:00:00", 135, 80, 81),
  reading(4, "2025-04-05T08:00:00", 151, 88, 75),
];

// Eight points — past the threshold, so the pills move to the trend lines and
// the other three call sites are what gets exercised.
const TREND_READINGS: Reading[] = [
  reading(5, "2025-01-05T08:00:00", 118, 76, 66),
  reading(6, "2025-02-05T08:00:00", 122, 78, 70),
  reading(7, "2025-03-05T08:00:00", 130, 82, 68),
  reading(8, "2025-04-05T08:00:00", 128, 80, 74),
  reading(9, "2025-05-05T08:00:00", 135, 84, 71),
  reading(10, "2025-06-05T08:00:00", 140, 86, 69),
  reading(11, "2025-07-05T08:00:00", 132, 81, 73),
  reading(12, "2025-08-05T08:00:00", 138, 85, 70),
];

const renderAt = (w: number, readings: Reading[] = READINGS) => {
  width.current = w;
  return render(<CombinedTimeline readings={readings} showBP showPulse />);
};

/** The end-label pills are the only thing drawing a <rect> filled with a
 *  series colour — the band chips use category colours and the series key uses
 *  stroked <line> swatches, so this counts pills and nothing else. */
const pillFills = (c: HTMLElement) =>
  [...c.querySelectorAll("rect")]
    .map((r) => r.getAttribute("fill"))
    .filter((f): f is string => f !== null)
    .filter((f) => f.startsWith("var(--line-"));

beforeEach(() => {
  width.current = 0;
});

describe("CombinedTimeline at phone width", () => {
  it("drops the end-label pills so the plot gets the margin back", () => {
    const { container } = renderAt(318);
    expect(pillFills(container)).toEqual([]);
  });

  it("names every visible series in the key instead", () => {
    const { container } = renderAt(318);
    const items = [...container.querySelectorAll("ul li")].map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual(["Systolic", "Diastolic", "Pulse"]);
  });

  it("keys only the series that are actually shown", () => {
    width.current = 318;
    const { container } = render(
      <CombinedTimeline readings={READINGS} showBP={false} showPulse />,
    );
    const items = [...container.querySelectorAll("ul li")].map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual(["Pulse"]);
  });

  it("drops the pills on the trend lines too, once 7+ readings exist", () => {
    const { container } = renderAt(318, TREND_READINGS);
    expect(pillFills(container)).toEqual([]);
    expect(container.querySelectorAll("ul li")).toHaveLength(3);
  });

  it("keeps the pills and shows no key at full width", () => {
    const { container } = renderAt(900);
    expect(pillFills(container)).toContain("var(--line-systolic)");
    expect(container.querySelectorAll("ul li")).toHaveLength(0);
  });

  it("keeps the pills while the width is still unmeasured", () => {
    const { container } = renderAt(0);
    expect(pillFills(container)).toContain("var(--line-systolic)");
    expect(container.querySelectorAll("ul li")).toHaveLength(0);
  });
});
