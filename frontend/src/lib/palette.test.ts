// Unit tests for the category palette — DASH-03, D-10, D-14.
import { describe, expect, it } from "vitest";

import {
  CHIP_TEXT,
  CLINICAL_ORDER,
  PULSE_CLINICAL_ORDER,
  categoryColor,
  categoryTint,
  pulseCategoryTint,
} from "./palette";

describe("CLINICAL_ORDER", () => {
  it("has exactly the six canonical labels in clinical order", () => {
    expect(CLINICAL_ORDER).toEqual([
      "Hypotension",
      "Normal",
      "Elevated",
      "Stage 1",
      "Stage 2",
      "Hypertensive Crisis",
    ]);
  });
});

describe("categoryColor", () => {
  it("returns a var(--cat-...) string for every canonical label", () => {
    for (const cat of CLINICAL_ORDER) {
      expect(categoryColor(cat)).toMatch(/^var\(--cat-[a-z0-9]+\)$/);
    }
  });

  it("maps Hypertensive Crisis to --cat-crisis", () => {
    expect(categoryColor("Hypertensive Crisis")).toBe("var(--cat-crisis)");
  });
});

describe("CHIP_TEXT", () => {
  it("is the chip-text CSS var", () => {
    expect(CHIP_TEXT).toBe("var(--cat-chip-text)");
  });
});

// Selected-chip tints (16.1-UI-SPEC section 4.4). The tint hexes live in
// index.css per theme; these accessors are what keep them out of components.
describe("categoryTint", () => {
  it("returns a var(--cat-...-tint) string for every canonical label", () => {
    for (const cat of CLINICAL_ORDER) {
      expect(categoryTint(cat)).toMatch(/^var\(--cat-[a-z0-9]+-tint\)$/);
    }
  });

  it("gives each of the six categories a distinct tint token", () => {
    const tints = CLINICAL_ORDER.map(categoryTint);
    expect(new Set(tints).size).toBe(6);
  });

  it("maps Hypertensive Crisis to --cat-crisis-tint", () => {
    expect(categoryTint("Hypertensive Crisis")).toBe("var(--cat-crisis-tint)");
  });
});

describe("pulseCategoryTint", () => {
  it("returns a tint CSS var for every canonical pulse label", () => {
    for (const cat of PULSE_CLINICAL_ORDER) {
      expect(pulseCategoryTint(cat)).toMatch(/^var\(--[a-z0-9-]+-tint\)$/);
    }
  });

  it("reuses the bradycardia reference tint, matching pulseCategoryColor", () => {
    expect(pulseCategoryTint("Bradycardia")).toBe(
      "var(--ref-bradycardia-tint)",
    );
  });
});

// The invariant that actually breaks if someone inlines a literal: this file
// is CSS-var-only, so no accessor may ever return a hex value.
describe("palette accessors never return a hex literal", () => {
  it("emits no colour literal from any tint or colour accessor", () => {
    const all = [
      ...CLINICAL_ORDER.map(categoryColor),
      ...CLINICAL_ORDER.map(categoryTint),
      ...PULSE_CLINICAL_ORDER.map(pulseCategoryTint),
      CHIP_TEXT,
    ];
    for (const value of all) {
      expect(value).not.toContain("#");
    }
  });
});
