// Unit tests for the Show panel's live sentence (Phase 14, D-20 pattern) and
// the filter sentence / trigger count extracted in Phase 16.1.
//
// buildShowSentence and buildFilterSentence are pure; activeFilterCount reads
// the store's exported DEFAULT_* maps, which transitively imports zustand —
// harmless, every suite here runs under jsdom (vite.config.ts).
import { describe, expect, it } from "vitest";

import type {
  BPCategory,
  PulseCategory,
  SeriesDataset,
  TimeOfDayBucket,
} from "../api/types";
import {
  activeFilterCount,
  buildFilterSentence,
  buildShowSentence,
} from "./showSentence";
import type { ActiveFilterState, FilterSentenceState } from "./showSentence";

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
      "Nothing selected. Pick a dataset to see it.",
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
      "Showing incidents. No vitals selected, so these are listed by date.",
    );
  });

  it("treats a single vital as enough to be a chart", () => {
    expect(buildShowSentence(sel(["pulse", "labs"]))).toBe(
      "Showing pulse and labs.",
    );
  });
});

// ── Phase 16.1 ────────────────────────────────────────────────────────────
// buildFilterSentence is the D-20 sentence extracted verbatim from
// FilterBar.tsx; activeFilterCount backs the Filters trigger's count badge
// (16.1-UI-SPEC §5.3/§5.4). These assertions are what stop the extracted
// strings from drifting from what FilterBar rendered before the move.
const ALL_TIMES: Record<TimeOfDayBucket, boolean> = {
  Morning: false,
  Afternoon: false,
  Evening: false,
  Night: false,
};
const ALL_BP: Record<BPCategory, boolean> = {
  Hypotension: false,
  Normal: false,
  Elevated: false,
  "Stage 1": false,
  "Stage 2": false,
  "Hypertensive Crisis": false,
};
const ALL_PULSE: Record<PulseCategory, boolean> = {
  Bradycardia: false,
  Normal: false,
  Tachycardia: false,
};

const sentenceState = (
  over: Partial<FilterSentenceState> = {},
): FilterSentenceState => ({
  datePreset: "all",
  latestReading: null,
  timeOfDay: { ...ALL_TIMES },
  bpCategory: { ...ALL_BP },
  pulseCategory: { ...ALL_PULSE },
  ...over,
});

describe("buildFilterSentence", () => {
  it("collapses every group to its All … label at the shipped default", () => {
    expect(buildFilterSentence(sentenceState())).toBe(
      "All data · All times of day · All categories · All pulse categories",
    );
  });

  // The anchor is its OWN sentence part, so it joins with " · " rather than a
  // space — byte-identical to what FilterBar rendered before the extraction.
  // Do not "fix" this to read "Last 30 days to June 13, 2025"; that would be
  // the reword §5.4 forbids.
  it("anchors a day preset to the newest reading", () => {
    expect(
      buildFilterSentence(
        sentenceState({
          datePreset: "30d",
          latestReading: "2025-06-13T09:21:00",
        }),
      ),
    ).toBe(
      "Last 30 days · to June 13, 2025 · All times of day · All categories · All pulse categories",
    );
  });

  it("omits the anchor for a day preset with no reading yet", () => {
    expect(
      buildFilterSentence(
        sentenceState({ datePreset: "7d", latestReading: null }),
      ),
    ).toBe(
      "Last 7 days · All times of day · All categories · All pulse categories",
    );
  });

  it("never anchors 'all' or 'custom', even with a reading present", () => {
    const anchor = "2025-06-13T09:21:00";
    expect(
      buildFilterSentence(
        sentenceState({ datePreset: "all", latestReading: anchor }),
      ),
    ).toBe(
      "All data · All times of day · All categories · All pulse categories",
    );
    expect(
      buildFilterSentence(
        sentenceState({ datePreset: "custom", latestReading: anchor }),
      ),
    ).toBe(
      "Custom range · All times of day · All categories · All pulse categories",
    );
  });

  it("collapses a group back to All … when EVERY member is selected", () => {
    const allOn: Record<TimeOfDayBucket, boolean> = {
      Morning: true,
      Afternoon: true,
      Evening: true,
      Night: true,
    };
    expect(buildFilterSentence(sentenceState({ timeOfDay: allOn }))).toContain(
      "All times of day",
    );
  });

  it("joins a strict subset with 'and' — no Oxford comma", () => {
    expect(
      buildFilterSentence(
        sentenceState({
          timeOfDay: { ...ALL_TIMES, Morning: true, Evening: true },
        }),
      ),
    ).toBe(
      "All data · Morning and Evening · All categories · All pulse categories",
    );
  });

  it("names each group's own subset independently", () => {
    expect(
      buildFilterSentence(
        sentenceState({
          bpCategory: { ...ALL_BP, "Stage 1": true, "Stage 2": true },
          pulseCategory: { ...ALL_PULSE, Tachycardia: true },
        }),
      ),
    ).toBe("All data · All times of day · Stage 1 and Stage 2 · Tachycardia");
  });

  it("joins parts with ' · '", () => {
    expect(buildFilterSentence(sentenceState()).split(" · ")).toHaveLength(4);
  });
});

const countState = (
  over: Partial<ActiveFilterState> = {},
): ActiveFilterState => ({
  timeOfDay: { ...ALL_TIMES },
  bpCategory: { ...ALL_BP },
  pulseCategory: { ...ALL_PULSE },
  visibleDatasets: sel(["blood_pressure", "pulse"]),
  ...over,
});

const ALL_BP_ON: Record<BPCategory, boolean> = {
  Hypotension: true,
  Normal: true,
  Elevated: true,
  "Stage 1": true,
  "Stage 2": true,
  "Hypertensive Crisis": true,
};

describe("activeFilterCount", () => {
  it("is 0 at the shipped default", () => {
    expect(activeFilterCount(countState())).toBe(0);
  });

  it("counts the Time of Day group once for any bucket", () => {
    expect(
      activeFilterCount(
        countState({ timeOfDay: { ...ALL_TIMES, Morning: true } }),
      ),
    ).toBe(1);
  });

  it("counts every BP chip ticked as exactly 1 for that group — groups, never ticks", () => {
    expect(activeFilterCount(countState({ bpCategory: ALL_BP_ON }))).toBe(1);
  });

  it("counts seven ticked chips across two groups as 2, not 7", () => {
    expect(
      activeFilterCount(
        countState({
          bpCategory: ALL_BP_ON,
          pulseCategory: { ...ALL_PULSE, Tachycardia: true },
        }),
      ),
    ).toBe(2);
  });

  it("counts the Pulse Category group once", () => {
    expect(
      activeFilterCount(
        countState({ pulseCategory: { ...ALL_PULSE, Bradycardia: true } }),
      ),
    ).toBe(1);
  });

  it("counts blood_pressure turned OFF — the default is a map, not 'all false'", () => {
    expect(
      activeFilterCount(countState({ visibleDatasets: sel(["pulse"]) })),
    ).toBe(1);
  });

  it("counts labs turned ON the same way", () => {
    expect(
      activeFilterCount(
        countState({
          visibleDatasets: sel(["blood_pressure", "pulse", "labs"]),
        }),
      ),
    ).toBe(1);
  });

  it("does not count a dataset map that matches the default exactly", () => {
    expect(
      activeFilterCount(
        countState({ visibleDatasets: sel(["pulse", "blood_pressure"]) }),
      ),
    ).toBe(0);
  });

  it("caps at 4 — the date group owns its own trigger and is never counted", () => {
    expect(
      activeFilterCount(
        countState({
          timeOfDay: { ...ALL_TIMES, Night: true },
          bpCategory: { ...ALL_BP, Normal: true },
          pulseCategory: { ...ALL_PULSE, Normal: true },
          visibleDatasets: sel([]),
        }),
      ),
    ).toBe(4);
  });
});
