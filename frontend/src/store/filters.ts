// zustand filter store — THE agent command schema (DASH-07,
// D-02/D-03/D-11/D-17/D-19). Each action maps 1:1 to a voice command
// ("show pulse", "last 30 days", "mornings only", "show all data"), so the
// agent-response handler mutates exactly this shape.
//
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
// Derived concrete dates live in lib/dates.ts `resolveFilters`, never here.
//
// DECISION: default `datePreset: "all"` — the always-safe default so first
// load shows Chris's full range (RESEARCH Open Question 2; ROADMAP SC4).
//
// PHASE 14: `activeChart` (single-select) and `overlayDatasets` (multi-select)
// are gone, replaced by one `visibleDatasets` five-key map plus a separate
// `chartView`. The old split — a radio-style chart picker beside a
// checkbox-style overlay row — was the root cause of the client's complaint
// that he could not see blood pressure and pulse together, or events alone.
import { create } from "zustand";

import type {
  BPCategory,
  ChartView,
  SeriesDataset,
} from "../api/types";
import type { DatePreset } from "../lib/dates";

export type { DatePreset };

const STORAGE_KEY = "hv-filters";

/** Every dataset the Show panel can toggle, in fixed render order. */
export const DATASET_KEYS: SeriesDataset[] = [
  "blood_pressure",
  "pulse",
  "labs",
  "incidents",
  "procedures",
];

/** D-10: blood pressure and pulse on, events off. Governs a brand-new device
 *  only — an existing session is restored from localStorage below. */
const DEFAULT_DATASETS: Record<SeriesDataset, boolean> = {
  blood_pressure: true,
  pulse: true,
  labs: false,
  incidents: false,
  procedures: false,
};

// Internal-only shape of the persisted blob — mirrors FilterState's 6
// persisted fields exactly (excludes the action functions).
type PersistedFilters = {
  chartView: ChartView;
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null };
  amPm: "all" | "AM" | "PM";
  bpCategory: "all" | BPCategory;
  visibleDatasets: Record<SeriesDataset, boolean>;
};

// Shape-only validation (impeccable P1, 2026-08-27 re-critique) — checks
// primitive types only, not exact literal-union membership (e.g. that
// chartView is one of the 3 valid ChartView values). ChartDeck.tsx's own
// exhaustive switch with a timeline fallback already guards against a
// shape-valid but unrecognized chartView downstream, so this guard
// deliberately doesn't duplicate that check.
function isPersistedFilters(value: unknown): value is PersistedFilters {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  if (typeof v.chartView !== "string") return false;
  if (typeof v.datePreset !== "string") return false;
  if (typeof v.amPm !== "string") return false;
  if (typeof v.bpCategory !== "string") return false;

  if (typeof v.customRange !== "object" || v.customRange === null)
    return false;
  const range = v.customRange as Record<string, unknown>;
  if (typeof range.from !== "string" && range.from !== null) return false;
  if (typeof range.to !== "string" && range.to !== null) return false;

  if (typeof v.visibleDatasets !== "object" || v.visibleDatasets === null)
    return false;
  const datasets = v.visibleDatasets as Record<string, unknown>;
  for (const key of DATASET_KEYS) {
    if (typeof datasets[key] !== "boolean") return false;
  }

  return true;
}

// ── v1 → v2 migration ─────────────────────────────────────────────────────
// A blob written by the pre-Phase-14 app has `activeChart` + a three-key
// `overlayDatasets`. Returning null for those would be simpler, but it would
// silently reset Chris's date range on his first load after deploy — a worse
// upgrade experience than this mapping costs to maintain.

type LegacyFilters = {
  activeChart: string;
  overlayDatasets: Record<"labs" | "incidents" | "procedures", boolean>;
};

function isLegacyFilters(value: unknown): value is LegacyFilters {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.activeChart !== "string") return false;
  if (typeof v.overlayDatasets !== "object" || v.overlayDatasets === null)
    return false;
  const o = v.overlayDatasets as Record<string, unknown>;
  return (
    typeof o.labs === "boolean" &&
    typeof o.incidents === "boolean" &&
    typeof o.procedures === "boolean"
  );
}

/** The old `activeChart` carried two orthogonal facts at once — which view to
 *  show AND (for the two timeline charts) which vital. Split them apart. */
function migrateLegacy(legacy: LegacyFilters & Record<string, unknown>): PersistedFilters {
  let chartView: ChartView = "timeline";
  let blood_pressure = true;
  let pulse = true;

  switch (legacy.activeChart) {
    case "bp_timeline":
      pulse = false;
      break;
    case "pulse_trend":
      blood_pressure = false;
      break;
    case "bp_categories":
      chartView = "bp_categories";
      break;
    case "am_pm_comparison":
      chartView = "am_pm_comparison";
      break;
    // Unrecognized value → timeline with both vitals, the safe default.
  }

  const range = (legacy.customRange ?? { from: null, to: null }) as {
    from: string | null;
    to: string | null;
  };

  return {
    chartView,
    datePreset: (legacy.datePreset as DatePreset) ?? "all",
    customRange: { from: range.from ?? null, to: range.to ?? null },
    amPm: (legacy.amPm as "all" | "AM" | "PM") ?? "all",
    bpCategory: (legacy.bpCategory as "all" | BPCategory) ?? "all",
    visibleDatasets: {
      blood_pressure,
      pulse,
      labs: legacy.overlayDatasets.labs,
      incidents: legacy.overlayDatasets.incidents,
      procedures: legacy.overlayDatasets.procedures,
    },
  };
}

// localStorage access can throw (Chromium with site data blocked throws
// SecurityError on mere access; older Safari private mode throws on
// setItem). Guard both directions exactly like store/theme.ts/store/speech.ts
// so filter persistence degrades gracefully instead of blanking the app at
// bootstrap (main.tsx calls initFilters before render).
function readStoredFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPersistedFilters(parsed)) return parsed;
    if (isLegacyFilters(parsed)) {
      return migrateLegacy(parsed as LegacyFilters & Record<string, unknown>);
    }
    return null;
  } catch {
    return null;
  }
}

function storeFilters(filters: PersistedFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* persistence unavailable — filters still apply for this session */
  }
}

interface FilterState {
  chartView: ChartView; // D-08 — timeline vs the two summary views
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null }; // "YYYY-MM-DD"
  amPm: "all" | "AM" | "PM"; // D-19 single-select
  bpCategory: "all" | BPCategory; // D-19 single-select
  visibleDatasets: Record<SeriesDataset, boolean>; // D-01 independent multi-select
  initFilters: () => void;
  setChartView: (v: ChartView) => void;
  setDatePreset: (p: Exclude<DatePreset, "custom">) => void;
  setCustomRange: (from: string, to: string) => void;
  setAmPm: (v: "all" | "AM" | "PM") => void;
  setBpCategory: (v: "all" | BPCategory) => void;
  /** Additive: flip one dataset, leave the rest alone ("show my pulse"). */
  setDataset: (dataset: SeriesDataset, on: boolean) => void;
  /** Exclusive: named datasets on, every other one off ("only pulse"). */
  showOnlyDatasets: (datasets: SeriesDataset[]) => void;
  showAllData: () => void; // D-11 big button
}

export const useFilters = create<FilterState>((set, get) => {
  // Called as the final statement of every mutating setter below so a
  // filter/dataset session built via voice commands survives a Safari/iOS
  // involuntary reload (impeccable P1, 2026-08-27 re-critique). A future new
  // setter that forgets to call this is a visible gap, not a silent one.
  const persistCurrent = () => {
    const s = get();
    storeFilters({
      chartView: s.chartView,
      datePreset: s.datePreset,
      customRange: s.customRange,
      amPm: s.amPm,
      bpCategory: s.bpCategory,
      visibleDatasets: s.visibleDatasets,
    });
  };

  return {
    chartView: "timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
    visibleDatasets: { ...DEFAULT_DATASETS },
    initFilters: () => {
      const stored = readStoredFilters();
      if (stored) set(stored);
    },
    setChartView: (chartView) => {
      set({ chartView });
      persistCurrent();
    },
    setDatePreset: (datePreset) => {
      set({ datePreset, customRange: { from: null, to: null } });
      persistCurrent();
    },
    setCustomRange: (from, to) => {
      set({ datePreset: "custom", customRange: { from, to } });
      persistCurrent();
    },
    setAmPm: (amPm) => {
      set({ amPm });
      persistCurrent();
    },
    setBpCategory: (bpCategory) => {
      set({ bpCategory });
      persistCurrent();
    },
    setDataset: (dataset, on) => {
      set((s) => ({
        visibleDatasets: { ...s.visibleDatasets, [dataset]: on },
      }));
      persistCurrent();
    },
    showOnlyDatasets: (datasets) => {
      // Built from DATASET_KEYS rather than spreading current state, so the
      // result is exhaustive and "only X" can never leave a stale dataset on.
      const next = {} as Record<SeriesDataset, boolean>;
      for (const key of DATASET_KEYS) next[key] = datasets.includes(key);
      set({ visibleDatasets: next });
      persistCurrent();
    },
    showAllData: () => {
      set({
        chartView: "timeline",
        datePreset: "all",
        customRange: { from: null, to: null },
        amPm: "all",
        bpCategory: "all",
        visibleDatasets: {
          blood_pressure: true,
          pulse: true,
          labs: true,
          incidents: true,
          procedures: true,
        },
      });
      persistCurrent();
    },
  };
});
