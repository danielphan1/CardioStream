// WCAG contrast regression test for the "Open Water" (light) / "Deep Watch"
// (dark) surface, accent, hazard and panel tokens (quick 261003-hev, which
// replaced Phase 13's "Slack Water"/"Night Watch"). Mirrors
// index.css's :root/.dark hex literals so a future token edit that
// regresses contrast fails this test rather than shipping.
import { hex } from "wcag-contrast";
import { describe, expect, it } from "vitest";

const LIGHT = {
  deck: "#EDF3F9",
  mist: "#FFFFFF",
  depth: "#0B2034",
  accent: "#1278AE",
  accentText: "#FFFFFF",
  sky: "#8FD3F4",
  hairline: "#5E7E99",
  focus: "#8A5620",
  hazard: "#9C2B22",
  hazardText: "#FFFFFF",
  panel: "#0E3356",
  panelText: "#F2F8FD",
  lineSystolic: "#1E3A5F",
  lineDiastolic: "#AC40BF",
  linePulse: "#9E4A24",
  lineSystolicDimmedVsDeck: "#3D5676",
  lineSystolicDimmedVsMist: "#405877",
  lineDiastolicDimmedVsDeck: "#B65BC8",
  lineDiastolicDimmedVsMist: "#B85DC9",
  linePulseDimmedVsDeck: "#AA6344",
  linePulseDimmedVsMist: "#AD6545",
};

const DARK = {
  deck: "#071624",
  mist: "#0D2234",
  depth: "#E7EEF2",
  accent: "#56C2EC",
  accentText: "#071624",
  sky: "#8FD3F4",
  hairline: "#6D90AD",
  focus: "#D9A356",
  hazard: "#E2685A",
  hazardText: "#071624",
  panel: "#04101C",
  panelText: "#F2F8FD",
  lineSystolic: "#9DBFE0",
  lineDiastolic: "#B055BE",
  linePulse: "#E3A07C",
  lineSystolicDimmedVsDeck: "#87A6C4",
  lineSystolicDimmedVsMist: "#87A7C6",
  lineDiastolicDimmedVsDeck: "#974CA7",
  lineDiastolicDimmedVsMist: "#984DA9",
  linePulseDimmedVsDeck: "#C28B6F",
  linePulseDimmedVsMist: "#C38D71",
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
  hypotension: "#D8E3EC",
  normal: "#D6E4E6",
  elevated: "#E1E3DB",
  stage1: "#E6E1DE",
  stage2: "#E4DCDF",
  crisis: "#DFDADE",
  refBradycardia: "#D8E3EC",
};

const TINTS_DARK: Record<CategoryKey, string> = {
  hypotension: "#172939",
  normal: "#122A31",
  elevated: "#212929",
  stage1: "#22252A",
  stage2: "#22222D",
  crisis: "#231E29",
  refBradycardia: "#172939",
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
  // The light accent NO LONGER clears this floor after the "Open Water"
  // re-skin (2.66:1 on the richer navy panel), which is why Send inside the
  // panel draws with --color-accent-on-panel instead. That token's own floors
  // are asserted in the "accent inside the dark feature panel" block at the
  // bottom of this file, including a guard that fails if the ordinary accent
  // ever becomes legal here again.
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

// ---------------------------------------------------------------------------
// Tokens introduced by the "Open Water" re-skin (quick 261003-hev).
//
// --color-hairline replaced 2px --color-depth borders with 1px ones. A
// control's boundary is a non-text UI component, so thinning it only stays
// legal while the colour itself clears 3:1 against BOTH grounds it is drawn
// on — the tinted deck and the white card. This block is what stops a future
// "make the borders softer" edit from quietly dropping under the floor.
//
// --color-sky is graphic-only and deliberately NOT asserted against deck: it
// scores 1.47:1 there, which is exactly why it is never a button fill on a
// light surface. It is asserted where it IS load-bearing: on the dark panel.
// ---------------------------------------------------------------------------

describe("hairline border contrast floors (WCAG 1.4.11, 3:1)", () => {
  it("light hairline against deck", () => {
    expect(hex(LIGHT.hairline, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });

  it("light hairline against mist", () => {
    expect(hex(LIGHT.hairline, LIGHT.mist)).toBeGreaterThanOrEqual(3);
  });

  it("dark hairline against deck", () => {
    expect(hex(DARK.hairline, DARK.deck)).toBeGreaterThanOrEqual(3);
  });

  it("dark hairline against mist", () => {
    expect(hex(DARK.hairline, DARK.mist)).toBeGreaterThanOrEqual(3);
  });
});

// --color-accent-on-panel / -text: ONE literal pair for both themes, like
// --color-signal-on-panel, because --color-panel does not invert either.
const ACCENT_ON_PANEL = "#8FD3F4";
const ACCENT_ON_PANEL_TEXT = "#0B2034";

describe("accent inside the dark feature panel (--color-accent-on-panel)", () => {
  it("its text clears AA normal text on the fill (4.5:1, WCAG 1.4.3)", () => {
    expect(
      hex(ACCENT_ON_PANEL_TEXT, ACCENT_ON_PANEL),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("the fill clears the non-text floor on the light-theme panel (3:1)", () => {
    expect(hex(ACCENT_ON_PANEL, LIGHT.panel)).toBeGreaterThanOrEqual(3);
  });

  it("the fill clears the non-text floor on the dark-theme panel (3:1)", () => {
    expect(hex(ACCENT_ON_PANEL, DARK.panel)).toBeGreaterThanOrEqual(3);
  });

  it("exists because --color-accent itself does NOT clear the light panel", () => {
    // The reason this token pair exists at all. If a future edit ever makes
    // the ordinary accent legal on the panel, this guard fails and the extra
    // token can be retired deliberately rather than by accident.
    expect(hex(LIGHT.accent, LIGHT.panel)).toBeLessThan(3);
  });
});

// ---------------------------------------------------------------------------
// The Sky waterline on the dark KPI feature tile (quick 261005-mj2, brief §4).
// A 1px --color-sky border on the TOP edge of --color-panel.
//
// This block passes trivially today, and that is exactly the point: the sky
// literal is the same hex as the already-gated --color-accent-on-panel, so the
// waterline has been riding on ANOTHER token's assertion. Now it has its own.
// A future edit that retints --color-sky for its chart-gradient job would
// otherwise drop this boundary below the floor with a green suite.
//
// Deliberately NOT asserted here: --sheen and --horizon. Both are pure
// decoration behind a card — neither carries text nor draws a boundary — so
// neither has a floor to clear. The omission is a decision, not an oversight.
// ---------------------------------------------------------------------------

describe("the Sky waterline on the dark feature tile", () => {
  // A border is a non-text UI component: WCAG 1.4.11, 3:1 — not 4.5:1.
  it("clears the non-text UI floor on the light-theme panel (3:1)", () => {
    expect(hex(LIGHT.sky, LIGHT.panel)).toBeGreaterThanOrEqual(3);
  });

  it("clears the non-text UI floor on the dark-theme panel (3:1)", () => {
    expect(hex(DARK.sky, DARK.panel)).toBeGreaterThanOrEqual(3);
  });

  it("is on a DARK ground, which is the only place the Sky rule permits it", () => {
    // The Sky-Is-Not-A-Button Rule in one assertion: sky against the light
    // canvas is 1.47:1, so a sky-filled control there would have no visible
    // edge at all. Keeping this guard here records WHY the waterline is
    // allowed on the panel and nowhere else.
    expect(hex(LIGHT.sky, LIGHT.deck)).toBeLessThan(3);
  });
});
