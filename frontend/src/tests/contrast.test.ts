// WCAG contrast regression test for the Phase 13 "Slack Water" (light) /
// "Night Watch" (dark) brass, hazard, and panel token trio. Mirrors
// index.css's :root/.dark hex literals so a future token edit that
// regresses contrast fails this test rather than shipping.
import { hex } from "wcag-contrast";
import { describe, expect, it } from "vitest";

const LIGHT = {
  deck: "#F5F7F6",
  mist: "#E3EBE9",
  brass: "#8A5A1E",
  brassText: "#FFFFFF",
  hazard: "#9C2B22",
  hazardText: "#FFFFFF",
  panel: "#101C2E",
  panelText: "#F5F7F6",
  lineSystolic: "#1E3A5F",
  lineDiastolic: "#1F7A6C",
  linePulse: "#9E4A24",
  lineSystolicDimmedVsDeck: "#3E5676",
  lineSystolicDimmedVsMist: "#3C5574",
  lineDiastolicDimmedVsDeck: "#3F8D81",
  lineDiastolicDimmedVsMist: "#3C8B7F",
  linePulseDimmedVsDeck: "#AB6444",
  linePulseDimmedVsMist: "#A86242",
};

const DARK = {
  deck: "#0A121F",
  mist: "#101D30",
  brass: "#D9A356",
  brassText: "#0A121F",
  hazard: "#E2685A",
  hazardText: "#0A121F",
  panel: "#050A12",
  panelText: "#F5F7F6",
  lineSystolic: "#9DBFE0",
  lineDiastolic: "#7FD6C4",
  linePulse: "#E3A07C",
  lineSystolicDimmedVsDeck: "#87A5C3",
  lineSystolicDimmedVsMist: "#88A7C6",
  lineDiastolicDimmedVsDeck: "#6DB9AB",
  lineDiastolicDimmedVsMist: "#6EBAAE",
  linePulseDimmedVsDeck: "#C28B6E",
  linePulseDimmedVsMist: "#C38C71",
};

// The three vitals series a CombinedTimeline can draw at once (Phase 14).
// A plotted line is a non-text UI component, so the floor is 3:1 (WCAG
// 1.4.11), not 4.5:1. Both grounds are tested because the chart sits on mist
// inside a card but the page behind it is deck.
const VITALS_LINES = ["lineSystolic", "lineDiastolic", "linePulse"] as const;

// The 6 series/background pairs (3 vitals lines x 2 backgrounds) for the
// Phase 16 dimmed-raw-line regression block below: [tokenKey, backgroundKey].
const DIMMED_LINE_PAIRS = [
  ["lineSystolicDimmedVsDeck", "deck"],
  ["lineDiastolicDimmedVsDeck", "deck"],
  ["linePulseDimmedVsDeck", "deck"],
  ["lineSystolicDimmedVsMist", "mist"],
  ["lineDiastolicDimmedVsMist", "mist"],
  ["linePulseDimmedVsMist", "mist"],
] as const;

describe("light theme — brass contrast floors", () => {
  it("brass text on brass fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.brassText, LIGHT.brass)).toBeGreaterThanOrEqual(4.5);
  });

  it("brass against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.brass, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });

  it("brass against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.brass, LIGHT.mist)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme — brass contrast floors", () => {
  it("brass text on brass fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.brassText, DARK.brass)).toBeGreaterThanOrEqual(4.5);
  });

  it("brass against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.brass, DARK.deck)).toBeGreaterThanOrEqual(3);
  });

  it("brass against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.brass, DARK.mist)).toBeGreaterThanOrEqual(3);
  });
});

describe("light theme — hazard contrast floors", () => {
  it("hazard text on hazard fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.hazardText, LIGHT.hazard)).toBeGreaterThanOrEqual(4.5);
  });

  it("hazard against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.hazard, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme — hazard contrast floors", () => {
  it("hazard text on hazard fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.hazardText, DARK.hazard)).toBeGreaterThanOrEqual(4.5);
  });

  it("hazard against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.hazard, DARK.deck)).toBeGreaterThanOrEqual(3);
  });
});

describe("light theme — panel contrast floors", () => {
  it("panel text on panel fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.panelText, LIGHT.panel)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("dark theme — panel contrast floors", () => {
  it("panel text on panel fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.panelText, DARK.panel)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("light theme — vitals line contrast floors", () => {
  it.each(VITALS_LINES)(
    "%s against deck clears non-text UI floor (3:1, WCAG 1.4.11)",
    (token) => {
      expect(hex(LIGHT[token], LIGHT.deck)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(VITALS_LINES)(
    "%s against mist clears non-text UI floor (3:1, WCAG 1.4.11)",
    (token) => {
      expect(hex(LIGHT[token], LIGHT.mist)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("dark theme — vitals line contrast floors", () => {
  it.each(VITALS_LINES)(
    "%s against deck clears non-text UI floor (3:1, WCAG 1.4.11)",
    (token) => {
      expect(hex(DARK[token], DARK.deck)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(VITALS_LINES)(
    "%s against mist clears non-text UI floor (3:1, WCAG 1.4.11)",
    (token) => {
      expect(hex(DARK[token], DARK.mist)).toBeGreaterThanOrEqual(3);
    },
  );
});

// The Phase 16 regression guard (D-04): CombinedTimeline dims each raw
// vitals line to 0.85 opacity once its rolling average is plotted on top, so
// the average reads as the primary signal. This locks in that the dimmed
// line still clears the 3:1 non-text floor — a future opacity change that
// breaks contrast fails here instead of shipping.
describe("light theme — dimmed raw vitals line contrast floors (Phase 16, D-04 @ 0.85 opacity)", () => {
  it.each(DIMMED_LINE_PAIRS)(
    "%s clears the non-text UI floor (3:1, WCAG 1.4.11)",
    (token, bgKey) => {
      expect(hex(LIGHT[token], LIGHT[bgKey])).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("dark theme — dimmed raw vitals line contrast floors (Phase 16, D-04 @ 0.85 opacity)", () => {
  it.each(DIMMED_LINE_PAIRS)(
    "%s clears the non-text UI floor (3:1, WCAG 1.4.11)",
    (token, bgKey) => {
      expect(hex(DARK[token], DARK[bgKey])).toBeGreaterThanOrEqual(3);
    },
  );
});

// The Phase 14 regression guard. Before this phase PulseTrend.tsx stroked the
// pulse line with var(--line-systolic) — harmless while the two charts were
// mutually exclusive, invisible-by-collision the moment they share one chart.
// Pulse must never again resolve to another plotted series' colour.
//
// Note this is an identity check, not a contrast floor: pulse/systolic
// luminance ratio is only ~1.9:1 in light and ~1.1:1 in dark, so in greyscale
// the hues do NOT separate these lines. The dashed pulse stroke asserted in
// CombinedTimeline.test.tsx is what carries that distinction.
describe("vitals series colours are mutually distinct", () => {
  it("light theme assigns a different hex to each of the three series", () => {
    const light = [LIGHT.lineSystolic, LIGHT.lineDiastolic, LIGHT.linePulse];
    expect(new Set(light).size).toBe(3);
  });

  it("dark theme assigns a different hex to each of the three series", () => {
    const dark = [DARK.lineSystolic, DARK.lineDiastolic, DARK.linePulse];
    expect(new Set(dark).size).toBe(3);
  });
});
