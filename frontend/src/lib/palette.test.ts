// Unit tests for the category palette — DASH-03, D-10, D-14.
import { describe, expect, it } from "vitest";

import { CHIP_TEXT, CLINICAL_ORDER, categoryColor } from "./palette";

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
