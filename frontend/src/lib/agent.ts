// Agent-reply → store primitives (VOICE-06, D-07, D-08, D-13, RESEARCH
// Pattern 4). These are pure, backend-free functions proven by unit tests;
// plan 03-04's CommandBar and Phase 4 voice both consume them UNCHANGED.
//
// Trust boundary (T-03-07): only server-composed AppliedFilters fields —
// closed TS unions — reach the store actions here. Unknown fields are ignored
// by construction; nothing model-authored is executed.
import { useEffect, useState } from "react";
import { create } from "zustand";

import type {
  AppliedFilters,
  BPCategory,
  ChartView,
  PulseCategory,
  SeriesDataset,
  TimeOfDayBucket,
} from "../api/types";
import type { DatePreset } from "./dates";
import { fmtLongDateOnly, presetLabel, selectedOrOmit, TIME_OF_DAY_ORDER } from "./dates";
import { DATASET_META, DATASET_ORDER } from "./datasetMeta";
import { CLINICAL_ORDER, PULSE_CLINICAL_ORDER } from "./palette";
import { joinWithAnd } from "./showSentence";
import { useFilters } from "../store/filters";
import { useGuide } from "../store/guide";
import { useSpeech } from "../store/speech";

// The control groups that highlight on a D-08 pulse. Phase 14 renamed
// "overlay" to "datasets" — the group now covers all five, not just events.
export type PulseField =
  | "chart"
  | "dateRange"
  | "bpCategory"
  | "pulseCategory"
  | "timeOfDay"
  | "datasets";

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
 * The D-08 pulse flash, shared by every control group that highlights on an
 * agent command (FilterBar, ShowPanel, ChartViewSwitcher).
 *
 * When an agent command touches a filter group, the matching control group
 * flashes briefly so the agent and the manual controls read as one system.
 * `seq` bumps on every apply (even when the same fields repeat), so this
 * effect re-fires reliably. Call sites gate the animation behind
 * `motion-safe:` — reduced-motion users get NO pulse — and a static `ring-2`
 * fallback keeps the change perceivable without motion.
 */
export function useAgentPulseFlash(): PulseField[] {
  const pulseSeq = useAgentPulse((s) => s.seq);
  const pulseFields = useAgentPulse((s) => s.fields);
  const [pulsing, setPulsing] = useState<PulseField[]>([]);
  useEffect(() => {
    if (pulseSeq === 0) return; // no apply yet
    setPulsing(pulseFields);
    const t = setTimeout(() => setPulsing([]), 1500);
    return () => clearTimeout(t);
  }, [pulseSeq, pulseFields]);
  return pulsing;
}

/**
 * Apply a server-composed filter delta to the zustand store from OUTSIDE the
 * React tree via useFilters.getState() (D-13 carry-over): reset first if asked,
 * then mutate ONLY the fields present in the delta so unmentioned filters carry
 * over. Records which groups changed as a D-08 pulse and returns them.
 */
export function applyAgentFilters(f: AppliedFilters): PulseField[] {
  const s = useFilters.getState();
  const touched = new Set<PulseField>();

  // D-07: if Chris issues any OTHER dashboard command while the guide is
  // open, the command applies normally AND the guide auto-closes, so Chris
  // sees the result immediately without a separate close command. Explicitly
  // enumerated (never derived from Object.keys(f)) because FastAPI's
  // response_model serializes every AppliedFilters key — most `null` — so a
  // presence check via Object.keys would always be true and break this
  // logic (T-11-06). A guideOpen-only delta must NOT trip this check; the
  // explicit guideOpen branch below governs that case on its own.
  const hasOtherCommand =
    f.reset === true ||
    f.chartView != null ||
    f.datePreset != null ||
    (f.customRange?.from != null && f.customRange?.to != null) ||
    f.bpCategory != null ||
    f.pulseCategory != null ||
    f.timeOfDay != null ||
    (f.overlayDataset != null && f.overlayState != null) ||
    (f.datasetsOn != null && f.datasetsOn.length > 0) ||
    (f.showOnly != null && f.showOnly.length > 0) ||
    f.speechEnabled != null;
  if (hasOtherCommand && useGuide.getState().open) {
    useGuide.getState().setOpen(false);
  }

  if (f.reset) {
    s.showAllData(); // view/date/category/datasets → defaults
    touched.add("chart");
    touched.add("dateRange");
    touched.add("bpCategory");
    touched.add("timeOfDay");
    touched.add("pulseCategory");
    touched.add("datasets");
  }

  // Present-value deltas only (`!= null` — "all" is a valid present value, so
  // truthiness would be wrong; every value here is otherwise a non-empty token).
  if (f.chartView != null) {
    s.setChartView(f.chartView);
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
  if (f.bpCategory != null) {
    s.setBpCategory(f.bpCategory);
    touched.add("bpCategory");
  }
  if (f.pulseCategory != null) {
    s.setPulseCategory(f.pulseCategory);
    touched.add("pulseCategory");
  }
  if (f.timeOfDay != null) {
    s.setTimeOfDay(f.timeOfDay);
    touched.add("timeOfDay");
  }
  // Three dataset paths, deliberately distinct (see backend schemas.py):
  //   overlayDataset + overlayState  one dataset, additive  "show my pulse"
  //   datasetsOn                     several,     additive  "BP for 30 days"
  //   showOnly                       several,     EXCLUSIVE "only BP and pulse"
  // showOnly is applied LAST so that a delta carrying both an additive and an
  // exclusive instruction ends in the exclusive state the user asked for.
  if (f.overlayDataset != null && f.overlayState != null) {
    s.setDataset(f.overlayDataset, f.overlayState === "on");
    touched.add("datasets");
  }
  if (f.datasetsOn != null && f.datasetsOn.length > 0) {
    for (const dataset of f.datasetsOn) {
      s.setDataset(dataset, true);
    }
    touched.add("datasets");
  }
  if (f.showOnly != null && f.showOnly.length > 0) {
    s.showOnlyDatasets(f.showOnly);
    touched.add("datasets");
  }
  if (f.speechEnabled != null) {
    useSpeech.getState().setEnabled(f.speechEnabled === "on");
    // No touched.add(...) — Voice Replies is not one of FilterBar's five
    // highlighted PulseField groups (RESEARCH: no PulseField exists for it).
  }
  if (f.guideOpen != null) {
    useGuide.getState().setOpen(f.guideOpen === "open");
    // No touched.add(...) — the guide isn't a FilterBar pulse group either.
  }

  const fields = [...touched];
  useAgentPulse.getState().mark(fields);
  return fields;
}

const VIEW_PHRASE: Record<ChartView, string> = {
  timeline: "the timeline",
  bp_categories: "BP categories",
  am_pm_comparison: "the AM vs PM comparison",
};

/** What the timeline is actually drawing, in fixed DATASET_ORDER. Returns
 *  null when nothing is selected — "Showing nothing, all data" is grammatical
 *  but reads as a glitch, and this string is spoken aloud (WR-02). */
function datasetsPhrase(visible: Record<SeriesDataset, boolean>): string | null {
  const on = DATASET_ORDER.filter((d) => visible[d]);
  if (on.length === 0) return null;
  return joinWithAnd(on.map((d) => DATASET_META[d].label.toLowerCase()));
}

/**
 * Deterministic full-state echo composed from POST-apply store state — never
 * from model text (VOICE-06, D-07). LOCKED template (UI-SPEC §9):
 *   "Showing {chartPhrase}, {rangePhrase}{timeOfDaySuffix}{bpCategorySuffix}{pulseCategorySuffix}"
 * Canonical: bp_timeline + 30d + Morning only → "Showing blood pressure, last
 * 30 days, mornings". Each suffix collapses to "" under the zero-or-all
 * convention (selectedOrOmit — none selected or every key selected both mean
 * "no filter"). `_latestReading` is accepted for call-site parity with the
 * resolver family; the locked format never anchors day presets to a date.
 */
export function composeConfirmation(
  state: {
    chartView: ChartView;
    visibleDatasets: Record<SeriesDataset, boolean>;
    datePreset: DatePreset;
    customRange: { from: string | null; to: string | null };
    bpCategory: Record<BPCategory, boolean>;
    pulseCategory: Record<PulseCategory, boolean>;
    timeOfDay: Record<TimeOfDayBucket, boolean>;
  },
  _latestReading: string | null,
): string {
  let chartPhrase: string;
  // On the timeline, name the DATASETS — that is what changed and what Chris
  // is looking at. On a summary view the datasets do not apply, so name the
  // view instead. Saying "showing the timeline" while he just asked for pulse
  // would be technically true and useless.
  if (state.chartView === "timeline") {
    const phrase = datasetsPhrase(state.visibleDatasets);
    if (phrase === null) {
      return "Nothing selected — pick a dataset to see it";
    }
    chartPhrase = phrase;
  } else {
    chartPhrase = VIEW_PHRASE[state.chartView];
  }

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

  // Zero-or-all (none selected, or every key selected) collapses a suffix to
  // "" — selectedOrOmit already encodes that convention (resolveFilters uses
  // the identical call shape for the query-param side of the same state).
  const timeOfDaySelected = selectedOrOmit(state.timeOfDay, TIME_OF_DAY_ORDER.length);
  const timeOfDaySuffix = timeOfDaySelected
    ? `, ${joinWithAnd(timeOfDaySelected.map((b) => `${b.toLowerCase()}s`))}`
    : "";

  const bpSelected = selectedOrOmit(state.bpCategory, CLINICAL_ORDER.length);
  const bpCategorySuffix = bpSelected
    ? `, ${joinWithAnd(bpSelected)} blood pressure`
    : "";

  const pulseSelected = selectedOrOmit(
    state.pulseCategory,
    PULSE_CLINICAL_ORDER.length,
  );
  const pulseCategorySuffix = pulseSelected
    ? `, ${joinWithAnd(pulseSelected)} pulse`
    : "";

  return `Showing ${chartPhrase}, ${rangePhrase}${timeOfDaySuffix}${bpCategorySuffix}${pulseCategorySuffix}`;
}
