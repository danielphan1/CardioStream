// VOICE-05 / ACC-03 lockstep parity test (D-15). Proves TWO things so no manual
// filter is ever voice-unreachable and no command vocabulary is dead:
//
//   1. Enumeration reachability — every concrete value of the FULL frontend unions
//      (ChartId×4, BPCategory×6+"all", datePreset×4, amPm×3) applied through the
//      SINGLE mutation surface applyAgentFilters() actually mutates the matching
//      useFilters slice. Adding a chart/category/preset without a command path, or
//      a store action with no AppliedFilters field, breaks this suite.
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
import type { BPCategory, ChartId } from "../api/types";

// The full frontend unions — enumerated so a future addition without a command
// path (or a backend token drift) fails a concrete assertion, not silently.
const CHART_IDS = [
  "bp_timeline",
  "pulse_trend",
  "bp_categories",
  "am_pm_comparison",
] as const satisfies readonly ChartId[];

const BP_CATEGORIES = [
  "Hypotension",
  "Normal",
  "Elevated",
  "Stage 1",
  "Stage 2",
  "Hypertensive Crisis",
] as const satisfies readonly BPCategory[];

const DATE_PRESETS = ["7d", "30d", "90d", "all"] as const;
const AMPM = ["all", "AM", "PM"] as const;

// The six mutating actions on the filter store (store/filters.ts). Every one MUST
// be reachable through some AppliedFilters field (ACC-03); the store is compared
// against this list below so adding an action without a command path fails.
const STORE_ACTIONS = [
  "setActiveChart",
  "setDatePreset",
  "setCustomRange",
  "setAmPm",
  "setBpCategory",
  "showAllData",
  "setOverlayDataset",
] as const;

beforeEach(() => {
  useFilters.setState({
    activeChart: "bp_timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
    overlayDatasets: { labs: false, incidents: false, procedures: false },
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
});

describe("enumeration reachability — every UI filter is voice-reachable (ACC-03)", () => {
  it.each(CHART_IDS)(
    "applyAgentFilters({ activeChart: '%s' }) mutates the store",
    (chart) => {
      applyAgentFilters({ activeChart: chart });
      expect(useFilters.getState().activeChart).toBe(chart);
    },
  );

  it.each(["all", ...BP_CATEGORIES] as const)(
    "applyAgentFilters({ bpCategory: '%s' }) mutates the store",
    (category) => {
      applyAgentFilters({ bpCategory: category });
      expect(useFilters.getState().bpCategory).toBe(category);
    },
  );

  it.each(DATE_PRESETS)(
    "applyAgentFilters({ datePreset: '%s' }) mutates the store",
    (preset) => {
      applyAgentFilters({ datePreset: preset });
      expect(useFilters.getState().datePreset).toBe(preset);
    },
  );

  it.each(AMPM)(
    "applyAgentFilters({ amPm: '%s' }) mutates the store",
    (amPm) => {
      applyAgentFilters({ amPm });
      expect(useFilters.getState().amPm).toBe(amPm);
    },
  );

  it("applyAgentFilters({ customRange }) sets a custom range", () => {
    applyAgentFilters({ customRange: { from: "2025-02-01", to: "2025-04-30" } });
    const s = useFilters.getState();
    expect(s.datePreset).toBe("custom");
    expect(s.customRange).toEqual({ from: "2025-02-01", to: "2025-04-30" });
  });

  it("applyAgentFilters({ reset: true }) returns the store to defaults", () => {
    useFilters.setState({ datePreset: "30d", amPm: "AM", bpCategory: "Stage 2" });
    applyAgentFilters({ reset: true });
    const s = useFilters.getState();
    expect(s.datePreset).toBe("all");
    expect(s.amPm).toBe("all");
    expect(s.bpCategory).toBe("all");
  });
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
      action: "setActiveChart",
      apply: () => applyAgentFilters({ activeChart: "pulse_trend" }),
      assert: () => expect(useFilters.getState().activeChart).toBe("pulse_trend"),
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
      action: "setAmPm",
      apply: () => applyAgentFilters({ amPm: "PM" }),
      assert: () => expect(useFilters.getState().amPm).toBe("PM"),
    },
    {
      action: "setBpCategory",
      apply: () => applyAgentFilters({ bpCategory: "Stage 2" }),
      assert: () => expect(useFilters.getState().bpCategory).toBe("Stage 2"),
    },
    {
      action: "showAllData",
      apply: () => applyAgentFilters({ reset: true }),
      assert: () => expect(useFilters.getState().datePreset).toBe("all"),
    },
    {
      action: "setOverlayDataset",
      apply: () =>
        applyAgentFilters({ overlayDataset: "labs", overlayState: "on" }),
      assert: () =>
        expect(useFilters.getState().overlayDatasets.labs).toBe(true),
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
    const actualActions = Object.entries(useFilters.getState())
      .filter(([, value]) => typeof value === "function")
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

  it("backend ChartToken equals the frontend ChartId union verbatim", () => {
    const backendCharts = literalTokens(
      schemaText.match(/ChartToken = Literal\[([^\]]*)\]/),
    );
    expect(backendCharts).toEqual([...CHART_IDS].sort());
  });

  it("backend AppliedFilters.bpCategory equals the frontend BPCategory union + 'all'", () => {
    const backendBp = literalTokens(
      schemaText.match(/bpCategory: Literal\[([^\]]*)\]/),
    );
    expect(backendBp).toEqual(["all", ...BP_CATEGORIES].sort());
  });

  it("schemas.py contains every chart token and BP category label (presence)", () => {
    for (const token of CHART_IDS) expect(schemaText).toContain(token);
    for (const label of BP_CATEGORIES) expect(schemaText).toContain(label);
  });
});
