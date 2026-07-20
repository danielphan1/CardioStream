// Agent-reply → store primitives (VOICE-06, D-07, D-08, D-13, RESEARCH
// Pattern 4). These are pure, backend-free functions proven by unit tests;
// plan 03-04's CommandBar and Phase 4 voice both consume them UNCHANGED.
//
// Trust boundary (T-03-07): only server-composed AppliedFilters fields —
// closed TS unions — reach the store actions here. Unknown fields are ignored
// by construction; nothing model-authored is executed.
import { create } from "zustand";

import type { AppliedFilters, BPCategory, ChartId } from "../api/types";
import type { DatePreset } from "./dates";
import { parseDateOnly, presetLabel } from "./dates";
import { useFilters } from "../store/filters";

// The four filter groups FilterBar (plan 03-04) highlights on a D-08 pulse.
export type PulseField = "chart" | "dateRange" | "amPm" | "bpCategory";

// Tiny zustand signal store: `mark` bumps `seq` and replaces `fields`, so a
// FilterBar effect keyed on `seq` re-runs its highlight even when the same
// fields change twice. Kept out of useFilters so the filter store stays the
// pure command schema (nothing UI-ephemeral leaks into it).
export const useAgentPulse = create<{
  seq: number;
  fields: PulseField[];
  mark: (fields: PulseField[]) => void;
}>((set) => ({
  seq: 0,
  fields: [],
  mark: (fields) => set((st) => ({ seq: st.seq + 1, fields })),
}));

/**
 * Apply a server-composed filter delta to the zustand store from OUTSIDE the
 * React tree via useFilters.getState() (D-13 carry-over): reset first if asked,
 * then mutate ONLY the fields present in the delta so unmentioned filters carry
 * over. Records which groups changed as a D-08 pulse and returns them.
 */
export function applyAgentFilters(f: AppliedFilters): PulseField[] {
  const s = useFilters.getState();
  const touched = new Set<PulseField>();

  if (f.reset) {
    s.showAllData(); // datePreset/customRange/amPm/bpCategory → defaults
    touched.add("chart");
    touched.add("dateRange");
    touched.add("amPm");
    touched.add("bpCategory");
  }

  // Present-value deltas only (`!= null` — "all" is a valid present value, so
  // truthiness would be wrong; every value here is otherwise a non-empty token).
  if (f.activeChart != null) {
    s.setActiveChart(f.activeChart);
    touched.add("chart");
  }
  if (f.datePreset != null) {
    s.setDatePreset(f.datePreset); // store clears customRange itself
    touched.add("dateRange");
  }
  if (f.customRange?.from && f.customRange?.to) {
    // Strings straight through — no Date construction (Pitfall 7).
    s.setCustomRange(f.customRange.from, f.customRange.to);
    touched.add("dateRange");
  }
  if (f.amPm != null) {
    s.setAmPm(f.amPm);
    touched.add("amPm");
  }
  if (f.bpCategory != null) {
    s.setBpCategory(f.bpCategory);
    touched.add("bpCategory");
  }

  const fields = [...touched];
  useAgentPulse.getState().mark(fields);
  return fields;
}

const CHART_PHRASE: Record<ChartId, string> = {
  bp_timeline: "blood pressure",
  pulse_trend: "pulse",
  bp_categories: "BP categories",
  am_pm_comparison: "the AM vs PM comparison",
};

// parseDateOnly-safe long-date form — NEVER new Date("YYYY-MM-DD") (Pitfall 7,
// UTC-midnight off-by-one). Mirrors dates.ts fmtLongDate output, safely.
function fmtLongDateOnly(dateOnly: string): string {
  return parseDateOnly(dateOnly).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Deterministic full-state echo composed from POST-apply store state — never
 * from model text (VOICE-06, D-07). LOCKED template:
 *   "Showing {chartPhrase}, {rangePhrase}{ampmSuffix}{categorySuffix}"
 * Canonical: bp_timeline + 30d + AM + all → "Showing blood pressure, last 30
 * days, mornings". `_latestReading` is accepted for call-site parity with the
 * resolver family; the locked format never anchors day presets to a date.
 */
export function composeConfirmation(
  state: {
    activeChart: ChartId;
    datePreset: DatePreset;
    customRange: { from: string | null; to: string | null };
    amPm: "all" | "AM" | "PM";
    bpCategory: "all" | BPCategory;
  },
  _latestReading: string | null,
): string {
  const chartPhrase = CHART_PHRASE[state.activeChart];

  let rangePhrase: string;
  if (state.datePreset === "all") {
    rangePhrase = "all data";
  } else if (state.datePreset === "custom") {
    const { from, to } = state.customRange;
    rangePhrase =
      from && to
        ? `${fmtLongDateOnly(from)} through ${fmtLongDateOnly(to)}`
        : "all data";
  } else {
    rangePhrase = presetLabel(state.datePreset).toLowerCase(); // "last 30 days"
  }

  const ampmSuffix =
    state.amPm === "AM" ? ", mornings" : state.amPm === "PM" ? ", evenings" : "";
  const categorySuffix =
    state.bpCategory !== "all" ? `, ${state.bpCategory} readings only` : "";

  return `Showing ${chartPhrase}, ${rangePhrase}${ampmSuffix}${categorySuffix}`;
}
