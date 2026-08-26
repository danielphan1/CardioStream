// Unit tests for lib/voiceCommands.ts — GUIDE-02, D-08/D-09/D-10.
// Key contracts: exactly 8 categories in the UI-SPEC-locked order, EXAMPLES
// is a referential derivation (not an independently-authored duplicate list),
// and the similar-phrasings note is the exact locked string.
import { describe, expect, it } from "vitest";

import {
  EXAMPLES,
  SIMILAR_PHRASINGS_NOTE,
  VOICE_COMMAND_CATEGORIES,
} from "./voiceCommands";

describe("VOICE_COMMAND_CATEGORIES", () => {
  it("has exactly 8 entries", () => {
    expect(VOICE_COMMAND_CATEGORIES).toHaveLength(8);
  });

  it("has the exact locked id sequence, in order", () => {
    expect(VOICE_COMMAND_CATEGORIES.map((c) => c.id)).toEqual([
      "charts",
      "date-range",
      "am-pm",
      "bp-category",
      "overlay",
      "reset",
      "speech",
      "guide",
    ]);
  });

  it("every label is non-empty", () => {
    for (const category of VOICE_COMMAND_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
    }
  });

  it("every example is non-empty", () => {
    for (const category of VOICE_COMMAND_CATEGORIES) {
      expect(category.example.length).toBeGreaterThan(0);
    }
  });
});

describe("EXAMPLES", () => {
  it("has length 8", () => {
    expect(EXAMPLES).toHaveLength(8);
  });

  it("is referentially derived from VOICE_COMMAND_CATEGORIES.map((c) => c.example), not a coincidental duplicate", () => {
    expect(EXAMPLES).toEqual(VOICE_COMMAND_CATEGORIES.map((c) => c.example));
  });
});

describe("SIMILAR_PHRASINGS_NOTE", () => {
  it("equals the exact locked string", () => {
    expect(SIMILAR_PHRASINGS_NOTE).toBe(
      "Similar phrasings work too — you don't need the exact words.",
    );
  });
});
