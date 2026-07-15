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

import type { BPCategory, ChartId } from "../api/types";
import type { DatePreset } from "../lib/dates";

export type { DatePreset };

interface FilterState {
  activeChart: ChartId; // D-02/D-03
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null }; // "YYYY-MM-DD"
  amPm: "all" | "AM" | "PM"; // D-19 single-select
  bpCategory: "all" | BPCategory; // D-19 single-select
  setActiveChart: (c: ChartId) => void; // each action ↔ one future voice command
  setDatePreset: (p: Exclude<DatePreset, "custom">) => void;
  setCustomRange: (from: string, to: string) => void;
  setAmPm: (v: "all" | "AM" | "PM") => void;
  setBpCategory: (v: "all" | BPCategory) => void;
  showAllData: () => void; // D-11 big button
}

export const useFilters = create<FilterState>((set) => ({
  activeChart: "bp_timeline",
  datePreset: "all",
  customRange: { from: null, to: null },
  amPm: "all",
  bpCategory: "all",
  setActiveChart: (activeChart) => set({ activeChart }),
  setDatePreset: (datePreset) =>
    set({ datePreset, customRange: { from: null, to: null } }),
  setCustomRange: (from, to) =>
    set({ datePreset: "custom", customRange: { from, to } }),
  setAmPm: (amPm) => set({ amPm }),
  setBpCategory: (bpCategory) => set({ bpCategory }),
  showAllData: () =>
    set({
      datePreset: "all",
      customRange: { from: null, to: null },
      amPm: "all",
      bpCategory: "all",
    }),
}));
