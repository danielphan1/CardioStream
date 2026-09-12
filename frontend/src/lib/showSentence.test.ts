// Unit tests for the Show panel's live sentence (Phase 14, D-20 pattern).
// Pure function — no jsdom needed, same constraint as overlayEvents.ts.
import { describe, expect, it } from "vitest";

import type { SeriesDataset } from "../api/types";
import { buildShowSentence } from "./showSentence";

const sel = (on: SeriesDataset[]): Record<SeriesDataset, boolean> => ({
  blood_pressure: on.includes("blood_pressure"),
  pulse: on.includes("pulse"),
  labs: on.includes("labs"),
  incidents: on.includes("incidents"),
  procedures: on.includes("procedures"),
});

describe("buildShowSentence", () => {
  it("prompts when nothing is selected", () => {
    expect(buildShowSentence(sel([]))).toBe(
      "Nothing selected — pick a dataset to see it.",
    );
  });

  it("names a single dataset", () => {
    expect(buildShowSentence(sel(["blood_pressure"]))).toBe(
      "Showing blood pressure.",
    );
  });

  it("joins two with 'and', no comma", () => {
    expect(buildShowSentence(sel(["blood_pressure", "pulse"]))).toBe(
      "Showing blood pressure and pulse.",
    );
  });

  it("joins three with commas and a final 'and' (no Oxford comma)", () => {
    expect(
      buildShowSentence(sel(["blood_pressure", "pulse", "incidents"])),
    ).toBe("Showing blood pressure, pulse and incidents.");
  });

  it("orders by DATASET_ORDER, not by selection order", () => {
    const a = buildShowSentence(sel(["procedures", "blood_pressure"]));
    const b = buildShowSentence(sel(["blood_pressure", "procedures"]));
    expect(a).toBe(b);
    expect(a).toBe("Showing blood pressure and procedures.");
  });

  it("flags the events-only case instead of implying a chart", () => {
    expect(buildShowSentence(sel(["incidents"]))).toBe(
      "Showing incidents — no vitals selected, so these are listed by date.",
    );
  });

  it("treats a single vital as enough to be a chart", () => {
    expect(buildShowSentence(sel(["pulse", "labs"]))).toBe(
      "Showing pulse and labs.",
    );
  });
});
