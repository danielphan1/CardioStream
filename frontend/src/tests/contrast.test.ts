// WCAG contrast regression test for the Phase 13 "Slack Water" (light) /
// "Night Watch" (dark) accent, hazard, and panel token trio. Mirrors
// index.css's :root/.dark hex literals so a future token edit that
// regresses contrast fails this test rather than shipping.
import { hex } from "wcag-contrast";
import { describe, expect, it } from "vitest";

const LIGHT = {
  deck: "#F5F7F6",
  mist: "#E3EBE9",
  depth: "#101C2E",
  accent: "#0D826C",
  accentText: "#FFFFFF",
  focus: "#8A5A1E",
  hazard: "#9C2B22",
  hazardText: "#FFFFFF",
  panel: "#101C2E",
  panelText: "#F5F7F6",
  lineSystolic: "#1E3A5F",
  lineDiastolic: "#AC40BF",
  linePulse: "#9E4A24",
  lineSystolicDimmedVsDeck: "#3E5676",
  lineSystolicDimmedVsMist: "#3C5574",
  lineDiastolicDimmedVsDeck: "#B75BC7",
  lineDiastolicDimmedVsMist: "#B45AC5",
  linePulseDimmedVsDeck: "#AB6444",
  linePulseDimmedVsMist: "#A86242",
};

const DARK = {
  deck: "#0A121F",
  mist: "#101D30",
  depth: "#E7EEF2",
  accent: "#33C1A6",
  accentText: "#0A121F",
  focus: "#D9A356",
  hazard: "#E2685A",
  hazardText: "#0A121F",
  panel: "#050A12",
  panelText: "#F5F7F6",
  lineSystolic: "#9DBFE0",
  lineDiastolic: "#B055BE",
  linePulse: "#E3A07C",
  lineSystolicDimmedVsDeck: "#87A5C3",
  lineSystolicDimmedVsMist: "#88A7C6",
  lineDiastolicDimmedVsDeck: "#974BA6",
  lineDiastolicDimmedVsMist: "#984DA9",
  linePulseDimmedVsDeck: "#C28B6E",
  linePulseDimmedVsMist: "#C38C71",
};

// --color-signal-on-panel: ONE literal for both themes, so it is deliberately
// not a per-theme key. The Command Bar's --color-panel does not invert, so the
// ring judged against it must not either (16.1-UI-SPEC §4.3(2)).
const FOCUS_ON_PANEL = "#D9A356";

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

// The six BP categories plus the pulse Bradycardia reference, which reuses
// --ref-bradycardia (= the hypotension hex, so its tint is the same literal).
const CATEGORY_KEYS = [
  "hypotension",
  "normal",
  "elevated",
  "stage1",
  "stage2",
  "crisis",
  "refBradycardia",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Selected category-chip fills — 12% of the category hue over --color-deck.
// Mirrors index.css's --cat-*-tint / --ref-bradycardia-tint literals.
const TINTS_LIGHT: Record<CategoryKey, string> = {
  hypotension: "#DFE7EA",
  normal: "#DDE8E3",
  elevated: "#E8E6D8",
  stage1: "#EDE4DC",
  stage2: "#EBDFDD",
  crisis: "#E6DDDC",
  refBradycardia: "#DFE7EA",
};

const TINTS_DARK: Record<CategoryKey, string> = {
  hypotension: "#1A2534",
  normal: "#14272C",
  elevated: "#242625",
  stage1: "#242125",
  stage2: "#251E28",
  crisis: "#261A24",
  refBradycardia: "#1A2534",
};

// The category hues themselves — index.css --cat-* / --ref-bradycardia.
const CATS_LIGHT: Record<CategoryKey, string> = {
  hypotension: "#3E6E8E",
  normal: "#2B7A5B",
  elevated: "#866A00",
  stage1: "#B5591C",
  stage2: "#A33323",
  crisis: "#7A1F1A",
  refBradycardia: "#3E6E8E",
};

const CATS_DARK: Record<CategoryKey, string> = {
  hypotension: "#8FB3D1",
  normal: "#5FBF8F",
  elevated: "#E0B84E",
  stage1: "#E58F52",
  stage2: "#E8776C",
  crisis: "#F0584C",
  refBradycardia: "#8FB3D1",
};

describe("light theme — accent contrast floors", () => {
  it("accent text on accent fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.accentText, LIGHT.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("accent against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });

  it("accent against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.mist)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme — accent contrast floors", () => {
  it("accent text on accent fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.accentText, DARK.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("accent against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.accent, DARK.deck)).toBeGreaterThanOrEqual(3);
  });

  it("accent against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.accent, DARK.mist)).toBeGreaterThanOrEqual(3);
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

// ---------------------------------------------------------------------------
// Phase 16.1 additions (16.1-UI-SPEC §7.2). The focus ring is brass and the
// accent is teal — 135 degrees of hue apart — so focus can never be mistaken
// for an active state. The ring is always judged against the surface BEHIND
// the control, never against an accent fill: the 3px ring carries a 2px
// outline-offset, which exposes a band of deck/mist/panel between fill and
// ring. (Ring-on-accent-fill is 1.24:1 light and 1.00:1 dark — which is why
// the offset is load-bearing and index.css documents it as such.)
// ---------------------------------------------------------------------------

describe("focus ring contrast floors (16.1-UI-SPEC §4.3(2))", () => {
  it("light focus ring against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.focus, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });

  it("dark focus ring against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.focus, DARK.deck)).toBeGreaterThanOrEqual(3);
  });

  it("light focus ring against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.focus, LIGHT.mist)).toBeGreaterThanOrEqual(3);
  });

  it("dark focus ring against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.focus, DARK.mist)).toBeGreaterThanOrEqual(3);
  });
});

// The Command Bar panel never inverts, so a theme-dependent ring would be
// wrong there: the light --color-signal scores only 2.90:1 on the light panel
// hex, under the 3:1 floor. --color-signal-on-panel closes that pre-existing
// gap. Both themes are tested because --color-panel itself has two values
// (#101C2E light / #050A12 dark) even though the ring token has one.
describe("focus ring on the Command Bar's dark panel (--color-signal-on-panel)", () => {
  it("on-panel ring against the light-theme panel clears 3:1 (WCAG 1.4.11)", () => {
    expect(hex(FOCUS_ON_PANEL, LIGHT.panel)).toBeGreaterThanOrEqual(3);
  });

  it("on-panel ring against the dark-theme panel clears 3:1 (WCAG 1.4.11)", () => {
    expect(hex(FOCUS_ON_PANEL, DARK.panel)).toBeGreaterThanOrEqual(3);
  });
});

// Send is accent-filled and sits on the Command Bar's dark panel, so the
// accent needs a non-text floor against panel as well as deck and mist.
describe("accent against the Command Bar panel (Send)", () => {
  it("light accent against the panel clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.panel)).toBeGreaterThanOrEqual(3);
  });

  it("dark accent against the panel clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.accent, DARK.panel)).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Selected category chips (16.1-UI-SPEC §4.4). The 12% tint strength is the
// ONLY free variable in §4.4 — every other operand here is a locked token —
// so the two pairs that move when it changes are both pinned below.
//
// Why the dot-on-tint block exists: a future 12% -> 20% edit would darken
// every light tint and push the 12px dot toward its 3:1 floor (light Stage 1
// is already the worst case at 3.79:1) while leaving the chip-text pairs at
// their ~13:1 margins and not touching border-vs-mist at all. Without the
// dot-on-tint block that regression would ship green.
//
// The rest-state pair (dot on --color-deck) is deliberately NOT asserted:
// both operands are locked tokens, so no free variable can drift it.
// ---------------------------------------------------------------------------

describe("chip text on each selected-chip tint (4.5:1, WCAG 1.4.3)", () => {
  it.each(CATEGORY_KEYS)("light %s tint carries --color-depth text", (key) => {
    expect(hex(LIGHT.depth, TINTS_LIGHT[key])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CATEGORY_KEYS)("dark %s tint carries --color-depth text", (key) => {
    expect(hex(DARK.depth, TINTS_DARK[key])).toBeGreaterThanOrEqual(4.5);
  });
});

// The selected chip's 2px border is the category's own hue, drawn on the
// filter popover's mist surface.
describe("selected-chip 2px border against the popover surface (3:1, WCAG 1.4.11)", () => {
  it.each(CATEGORY_KEYS)("light %s border against mist", (key) => {
    expect(hex(CATS_LIGHT[key], LIGHT.mist)).toBeGreaterThanOrEqual(3);
  });

  it.each(CATEGORY_KEYS)("dark %s border against mist", (key) => {
    expect(hex(CATS_DARK[key], DARK.mist)).toBeGreaterThanOrEqual(3);
  });
});

// The 12px category dot stays visible in BOTH chip states; selected is the
// case that depends on the free 12% figure.
describe("12px category dot on its own selected tint (3:1, WCAG 1.4.11)", () => {
  it.each(CATEGORY_KEYS)("light %s dot on its tint", (key) => {
    expect(hex(CATS_LIGHT[key], TINTS_LIGHT[key])).toBeGreaterThanOrEqual(3);
  });

  it.each(CATEGORY_KEYS)("dark %s dot on its tint", (key) => {
    expect(hex(CATS_DARK[key], TINTS_DARK[key])).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Greyscale separation guards (16.1-UI-SPEC §4.3(1)).
//
// These are identity/separation guards, NOT WCAG floors — same spirit as the
// "vitals series colours are mutually distinct" block above, but measuring
// luminance distance instead of hex inequality. They exist so that a future
// hue edit which re-collapses two SOLID series in greyscale fails here rather
// than shipping: dark systolic-vs-diastolic used to sit at 1.12:1, i.e.
// effectively identical to a greyscale or colour-blind viewer, and the violet
// diastolic is what fixed it (now 2.24:1).
//
// The floors are asymmetric per theme on purpose: they are set just under the
// measured values, which differ by theme, so each is a real ratchet rather
// than a floor one theme clears trivially.
//
// Pulse-vs-systolic is NOT guarded here — it is 1.89:1 light / 1.14:1 dark
// and unchanged by this phase. The DASHED pulse stroke asserted in
// CombinedTimeline.test.tsx is what separates that pair, not luminance.
// ---------------------------------------------------------------------------

describe("solid vitals series separate in greyscale", () => {
  it("light systolic vs diastolic stays at least 2.2:1 apart in luminance", () => {
    expect(
      hex(LIGHT.lineSystolic, LIGHT.lineDiastolic),
    ).toBeGreaterThanOrEqual(2.2);
  });

  it("dark systolic vs diastolic stays at least 2.0:1 apart in luminance", () => {
    expect(hex(DARK.lineSystolic, DARK.lineDiastolic)).toBeGreaterThanOrEqual(
      2.0,
    );
  });

  it("light diastolic vs pulse stays at least 1.2:1 apart in luminance", () => {
    expect(hex(LIGHT.lineDiastolic, LIGHT.linePulse)).toBeGreaterThanOrEqual(
      1.2,
    );
  });

  it("dark diastolic vs pulse stays at least 1.8:1 apart in luminance", () => {
    expect(hex(DARK.lineDiastolic, DARK.linePulse)).toBeGreaterThanOrEqual(1.8);
  });
});
