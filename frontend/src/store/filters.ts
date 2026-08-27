// zustand filter store — THE Phase 3 agent command schema (DASH-07,
// D-02/D-03/D-11/D-17/D-19). Each action maps 1:1 to a future voice command
// ("show pulse", "last 30 days", "mornings only", "show all data"), so the
// agent-response handler mutates exactly this shape — no redesign in Phase 3.
//
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
// Derived concrete dates live in lib/dates.ts `resolveFilters`, never here.
//
// DECISION: default `datePreset: "all"` — the always-safe default so first
// load shows Chris's full range (RESEARCH Open Question 2; ROADMAP SC4).
import { create } from "zustand";

import type { BPCategory, ChartId, OverlayDataset } from "../api/types";
import type { DatePreset } from "../lib/dates";

export type { DatePreset };

const STORAGE_KEY = "hv-filters";

// Internal-only shape of the persisted blob — mirrors FilterState's 6
// persisted fields exactly (excludes the action functions).
type PersistedFilters = {
  activeChart: ChartId;
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null };
  amPm: "all" | "AM" | "PM";
  bpCategory: "all" | BPCategory;
  overlayDatasets: Record<OverlayDataset, boolean>;
};

// Shape-only validation (impeccable P1, 2026-08-27 re-critique) — checks
// primitive types only, not exact literal-union membership (e.g. that
// activeChart is one of the 4 valid ChartId values). ChartDeck.tsx's existing
// CHART_REGISTRY.find((c) => c.id === activeChart) ?? CHART_REGISTRY[0]
// fallback already guards against a shape-valid but unrecognized activeChart
// downstream, so this guard deliberately doesn't duplicate that check.
function isPersistedFilters(value: unknown): value is PersistedFilters {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  if (typeof v.activeChart !== "string") return false;
  if (typeof v.datePreset !== "string") return false;
  if (typeof v.amPm !== "string") return false;
  if (typeof v.bpCategory !== "string") return false;

  if (typeof v.customRange !== "object" || v.customRange === null)
    return false;
  const range = v.customRange as Record<string, unknown>;
  if (typeof range.from !== "string" && range.from !== null) return false;
  if (typeof range.to !== "string" && range.to !== null) return false;

  if (typeof v.overlayDatasets !== "object" || v.overlayDatasets === null)
    return false;
  const overlays = v.overlayDatasets as Record<string, unknown>;
  if (typeof overlays.labs !== "boolean") return false;
  if (typeof overlays.incidents !== "boolean") return false;
  if (typeof overlays.procedures !== "boolean") return false;

  return true;
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
    return isPersistedFilters(parsed) ? parsed : null;
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
  activeChart: ChartId; // D-02/D-03
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null }; // "YYYY-MM-DD"
  amPm: "all" | "AM" | "PM"; // D-19 single-select
  bpCategory: "all" | BPCategory; // D-19 single-select
  initFilters: () => void;
  setActiveChart: (c: ChartId) => void; // each action ↔ one future voice command
  setDatePreset: (p: Exclude<DatePreset, "custom">) => void;
  setCustomRange: (from: string, to: string) => void;
  setAmPm: (v: "all" | "AM" | "PM") => void;
  setBpCategory: (v: "all" | BPCategory) => void;
  overlayDatasets: Record<OverlayDataset, boolean>; // D-01 independent multi-select
  setOverlayDataset: (dataset: OverlayDataset, on: boolean) => void;
  showAllData: () => void; // D-11 big button
}

export const useFilters = create<FilterState>((set, get) => {
  // Called as the final statement of every mutating setter below so a
  // filter/overlay session built via voice commands survives a Safari/iOS
  // involuntary reload (impeccable P1, 2026-08-27 re-critique). A future new
  // setter that forgets to call this is a visible gap, not a silent one.
  const persistCurrent = () => {
    const s = get();
    storeFilters({
      activeChart: s.activeChart,
      datePreset: s.datePreset,
      customRange: s.customRange,
      amPm: s.amPm,
      bpCategory: s.bpCategory,
      overlayDatasets: s.overlayDatasets,
    });
  };

  return {
    activeChart: "bp_timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
    initFilters: () => {
      const stored = readStoredFilters();
      if (stored) set(stored);
    },
    setActiveChart: (activeChart) => {
      set({ activeChart });
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
    overlayDatasets: { labs: false, incidents: false, procedures: false },
    setOverlayDataset: (dataset, on) => {
      set((s) => ({
        overlayDatasets: { ...s.overlayDatasets, [dataset]: on },
      }));
      persistCurrent();
    },
    showAllData: () => {
      set({
        datePreset: "all",
        customRange: { from: null, to: null },
        amPm: "all",
        bpCategory: "all",
        overlayDatasets: { labs: false, incidents: false, procedures: false },
      });
      persistCurrent();
    },
  };
});
