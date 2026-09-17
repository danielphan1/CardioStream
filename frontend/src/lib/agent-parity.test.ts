// VOICE-05 / ACC-03 lockstep parity test (D-15). Proves TWO things so no manual
// filter is ever voice-unreachable and no command vocabulary is dead:
//
//   1. Enumeration reachability — every concrete value of the FULL frontend unions
//      (ChartView×3, SeriesDataset×5, BPCategory×6, PulseCategory×3, TimeOfDayBucket×4,
//      datePreset×4) through the SINGLE mutation surface applyAgentFilters() actually
//      mutates the matching useFilters slice. Adding a view/dataset/category/preset
//      without a command path, or a store action with no AppliedFilters field, breaks
//      this suite.
//   2. Frontend↔backend token equality — the enumerated unions equal the
//      backend/app/agent/schemas.py ChartToken / AppliedFilters literals verbatim
//      (read from disk, read-only). Token drift on either side breaks the build.
//
// The zustand store is REAL (reset in beforeEach), mutated only via applyAgentFilters
// exactly as production does — never useFilters.setState directly (single-surface rule).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it } from "vitest";

import { applyAgentFilters, useAgentPulse } from "./agent";
import { useFilters } from "../store/filters";
import type {
  BPCategory,
  ChartView,
  PulseCategory,
  SeriesDataset,
  TimeOfDayBucket,
} from "../api/types";

// The full frontend unions — enumerated so a future addition without a command
// path (or a backend token drift) fails a concrete assertion, not silently.
const CHART_VIEWS = [
  "timeline",
  "bp_categories",
  "am_pm_comparison",
] as const satisfies readonly ChartView[];

const BP_CATEGORIES = [
  "Hypotension",
  "Normal",
  "Elevated",
  "Stage 1",
  "Stage 2",
  "Hypertensive Crisis",
] as const satisfies readonly BPCategory[];

const PULSE_CATEGORIES = [
  "Bradycardia",
  "Normal",
  "Tachycardia",
] as const satisfies readonly PulseCategory[];

const TIME_OF_DAY_BUCKETS = [
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
] as const satisfies readonly TimeOfDayBucket[];

const DATE_PRESETS = ["7d", "30d", "90d", "all"] as const;

const DATASETS = [
  "blood_pressure",
  "pulse",
  "labs",
  "incidents",
  "procedures",
] as const satisfies readonly SeriesDataset[];

// All-false default maps for the beforeEach seed and the reset-to-defaults
// assertion below — same "governs a brand-new device only" shape as
// store/filters.ts's own DEFAULT_BP_CATEGORY/DEFAULT_PULSE_CATEGORY/
// DEFAULT_TIME_OF_DAY (not imported — this suite's fixtures stay self-contained).
const ALL_FALSE_BP: Record<BPCategory, boolean> = Object.fromEntries(
  BP_CATEGORIES.map((c) => [c, false]),
) as Record<BPCategory, boolean>;
const ALL_FALSE_PULSE: Record<PulseCategory, boolean> = Object.fromEntries(
  PULSE_CATEGORIES.map((c) => [c, false]),
) as Record<PulseCategory, boolean>;
const ALL_FALSE_TIME: Record<TimeOfDayBucket, boolean> = Object.fromEntries(
  TIME_OF_DAY_BUCKETS.map((c) => [c, false]),
) as Record<TimeOfDayBucket, boolean>;

// The nine mutating actions on the filter store (store/filters.ts) that are
// reachable through some AppliedFilters field (ACC-03); the store is compared
// against this list below so adding an action without a command path fails.
// The three toggle* category actions (toggleBpCategory/togglePulseCategory/
// toggleTimeOfDay) are deliberately excluded — UI-only checkbox-click actions,
// no AppliedFilters field ever drives a single-key category toggle from the
// agent (same exclusion status as the initFilters bootstrap exclusion below).
const STORE_ACTIONS = [
  "setChartView",
  "setDatePreset",
  "setCustomRange",
  "setBpCategory",
  "setPulseCategory",
  "setTimeOfDay",
  "showAllData",
  "setDataset",
  "showOnlyDatasets",
] as const;

beforeEach(() => {
  useFilters.setState({
    chartView: "timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    bpCategory: { ...ALL_FALSE_BP },
    pulseCategory: { ...ALL_FALSE_PULSE },
    timeOfDay: { ...ALL_FALSE_TIME },
    visibleDatasets: {
      blood_pressure: true,
      pulse: true,
      labs: false,
      incidents: false,
      procedures: false,
    },
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
});

describe("enumeration reachability — every UI filter is voice-reachable (ACC-03)", () => {
  it.each(CHART_VIEWS)(
    "applyAgentFilters({ chartView: '%s' }) mutates the store",
    (view) => {
      applyAgentFilters({ chartView: view });
      expect(useFilters.getState().chartView).toBe(view);
    },
  );

  it.each(BP_CATEGORIES)(
    "applyAgentFilters({ bpCategory: ['%s'] }) mutates the store",
    (category) => {
      applyAgentFilters({ bpCategory: [category] });
      expect(useFilters.getState().bpCategory[category]).toBe(true);
    },
  );

  it.each(PULSE_CATEGORIES)(
    "applyAgentFilters({ pulseCategory: ['%s'] }) mutates the store",
    (category) => {
      applyAgentFilters({ pulseCategory: [category] });
      expect(useFilters.getState().pulseCategory[category]).toBe(true);
    },
  );

  it.each(TIME_OF_DAY_BUCKETS)(
    "applyAgentFilters({ timeOfDay: ['%s'] }) mutates the store",
    (bucket) => {
      applyAgentFilters({ timeOfDay: [bucket] });
      expect(useFilters.getState().timeOfDay[bucket]).toBe(true);
    },
  );

  it.each(DATE_PRESETS)(
    "applyAgentFilters({ datePreset: '%s' }) mutates the store",
    (preset) => {
      applyAgentFilters({ datePreset: preset });
      expect(useFilters.getState().datePreset).toBe(preset);
    },
  );

  it("applyAgentFilters({ customRange }) sets a custom range", () => {
    applyAgentFilters({ customRange: { from: "2025-02-01", to: "2025-04-30" } });
    const s = useFilters.getState();
    expect(s.datePreset).toBe("custom");
    expect(s.customRange).toEqual({ from: "2025-02-01", to: "2025-04-30" });
  });

  it("applyAgentFilters({ reset: true }) returns the store to defaults", () => {
    useFilters.setState({
      datePreset: "30d",
      bpCategory: { ...ALL_FALSE_BP, "Stage 2": true },
    });
    applyAgentFilters({ reset: true });
    const s = useFilters.getState();
    expect(s.datePreset).toBe("all");
    for (const key of BP_CATEGORIES) expect(s.bpCategory[key]).toBe(false);
    for (const key of PULSE_CATEGORIES) expect(s.pulseCategory[key]).toBe(false);
    for (const key of TIME_OF_DAY_BUCKETS) expect(s.timeOfDay[key]).toBe(false);
  });

  it.each(DATASETS)(
    "applyAgentFilters({ overlayDataset: '%s', overlayState: 'on' }) mutates the store",
    (dataset) => {
      applyAgentFilters({ overlayDataset: dataset, overlayState: "on" });
      expect(useFilters.getState().visibleDatasets[dataset]).toBe(true);
    },
  );

  it.each(DATASETS)(
    "applyAgentFilters({ showOnly: ['%s'] }) leaves ONLY that dataset on",
    (dataset) => {
      applyAgentFilters({ showOnly: [dataset] });
      const v = useFilters.getState().visibleDatasets;
      expect(v[dataset]).toBe(true);
      expect(Object.values(v).filter(Boolean)).toHaveLength(1);
    },
  );

  it.each(DATASETS)(
    "applyAgentFilters({ datasetsOn: ['%s'] }) turns it on additively",
    (dataset) => {
      applyAgentFilters({ datasetsOn: [dataset] });
      expect(useFilters.getState().visibleDatasets[dataset]).toBe(true);
    },
  );
});

describe("store↔command 1:1 mapping — no unreachable action, no dead field", () => {
  // Each case exercises exactly one store action through one AppliedFilters field.
  // Tagged so the covered-action set can be compared to the real store below.
  const CASES: {
    action: (typeof STORE_ACTIONS)[number];
    apply: () => void;
    assert: () => void;
  }[] = [
    {
      action: "setChartView",
      apply: () => applyAgentFilters({ chartView: "bp_categories" }),
      assert: () =>
        expect(useFilters.getState().chartView).toBe("bp_categories"),
    },
    {
      action: "setDatePreset",
      apply: () => applyAgentFilters({ datePreset: "30d" }),
      assert: () => expect(useFilters.getState().datePreset).toBe("30d"),
    },
    {
      action: "setCustomRange",
      apply: () =>
        applyAgentFilters({ customRange: { from: "2025-02-01", to: "2025-04-30" } }),
      assert: () => expect(useFilters.getState().customRange.from).toBe("2025-02-01"),
    },
    {
      action: "setBpCategory",
      apply: () => applyAgentFilters({ bpCategory: ["Stage 2"] }),
      assert: () =>
        expect(useFilters.getState().bpCategory["Stage 2"]).toBe(true),
    },
    {
      action: "setPulseCategory",
      apply: () => applyAgentFilters({ pulseCategory: ["Tachycardia"] }),
      assert: () =>
        expect(useFilters.getState().pulseCategory["Tachycardia"]).toBe(true),
    },
    {
      action: "setTimeOfDay",
      apply: () => applyAgentFilters({ timeOfDay: ["Morning"] }),
      assert: () =>
        expect(useFilters.getState().timeOfDay["Morning"]).toBe(true),
    },
    {
      action: "showAllData",
      apply: () => applyAgentFilters({ reset: true }),
      assert: () => expect(useFilters.getState().datePreset).toBe("all"),
    },
    {
      action: "setDataset",
      apply: () =>
        applyAgentFilters({ overlayDataset: "labs", overlayState: "on" }),
      assert: () =>
        expect(useFilters.getState().visibleDatasets.labs).toBe(true),
    },
    {
      action: "showOnlyDatasets",
      apply: () => applyAgentFilters({ showOnly: ["pulse"] }),
      assert: () =>
        expect(useFilters.getState().visibleDatasets.blood_pressure).toBe(false),
    },
  ];

  it.each(CASES)("$action is reachable and mutates the store", ({ apply, assert }) => {
    apply();
    assert();
  });

  it("the covered actions equal the store's full mutating-action surface", () => {
    const covered = [...new Set(CASES.map((c) => c.action))].sort();
    expect(covered).toEqual([...STORE_ACTIONS].sort());

    // Bind STORE_ACTIONS to the actual store: any function-typed key on the store
    // state is a mutating action. Adding one without a command path fails here.
    // `initFilters` (impeccable P1, 2026-08-27 re-critique — localStorage
    // bootstrap) is deliberately excluded: it's a bootstrap-only action
    // mirroring store/theme.ts's initTheme / store/speech.ts's initSpeech,
    // never voice-reachable, so it's not part of the AppliedFilters surface.
    // `toggleBpCategory`/`togglePulseCategory`/`toggleTimeOfDay` are also
    // excluded: UI-only checkbox-click actions (flip one category, leave the
    // rest of the group alone) with no AppliedFilters field that ever drives a
    // single-key toggle from the agent — the agent always replaces the whole
    // group via the matching set* action instead.
    const actualActions = Object.entries(useFilters.getState())
      .filter(
        ([key, value]) =>
          typeof value === "function" &&
          key !== "initFilters" &&
          key !== "toggleBpCategory" &&
          key !== "togglePulseCategory" &&
          key !== "toggleTimeOfDay",
      )
      .map(([key]) => key)
      .sort();
    expect(actualActions).toEqual([...STORE_ACTIONS].sort());
  });
});

describe("frontend voice vocabulary matches backend tokens (D-15)", () => {
  // lib -> src -> frontend -> repo root; then into the backend schema.
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../..");
  const schemaText = readFileSync(
    resolve(repoRoot, "backend/app/agent/schemas.py"),
    "utf8",
  );

  function literalTokens(match: RegExpMatchArray | null): string[] {
    if (match == null) return [];
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  }

  it("backend ChartToken equals the frontend ChartView union verbatim", () => {
    const backendCharts = literalTokens(
      schemaText.match(/ChartToken = Literal\[([^\]]*)\]/),
    );
    expect(backendCharts).toEqual([...CHART_VIEWS].sort());
  });

  it("backend AppliedFilters.bpCategory equals the frontend BPCategory union verbatim", () => {
    // \s* between the two brackets: ruff wraps this particular field across
    // lines (list[\n        Literal[...]\n    ]) while pulseCategory/timeOfDay
    // below stay on one line — the pattern tolerates both.
    const backendBp = literalTokens(
      schemaText.match(/bpCategory: list\[\s*Literal\[([^\]]*)\]\s*\]/),
    );
    expect(backendBp).toEqual([...BP_CATEGORIES].sort());
  });

  it("backend AppliedFilters.pulseCategory equals the frontend PulseCategory union verbatim", () => {
    const backendPulse = literalTokens(
      schemaText.match(/pulseCategory: list\[\s*Literal\[([^\]]*)\]\s*\]/),
    );
    expect(backendPulse).toEqual([...PULSE_CATEGORIES].sort());
  });

  it("backend AppliedFilters.timeOfDay equals the frontend TimeOfDayBucket union verbatim", () => {
    const backendTimeOfDay = literalTokens(
      schemaText.match(/timeOfDay: list\[\s*Literal\[([^\]]*)\]\s*\]/),
    );
    expect(backendTimeOfDay).toEqual([...TIME_OF_DAY_BUCKETS].sort());
  });

  it("backend DatasetToken equals the frontend SeriesDataset union verbatim", () => {
    const backendDatasets = literalTokens(
      schemaText.match(/DatasetToken = Literal\[([^\]]*)\]/),
    );
    expect(backendDatasets).toEqual([...DATASETS].sort());
  });

  it("schemas.py contains every chart token and BP category label (presence)", () => {
    for (const token of CHART_VIEWS) expect(schemaText).toContain(token);
    for (const label of BP_CATEGORIES) expect(schemaText).toContain(label);
  });
});
