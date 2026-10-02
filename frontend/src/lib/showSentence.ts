// Live selection sentences for the dashboard's filter state (D-20 pattern,
// Phase 14; extended in Phase 16.1 with the filter sentence and the trigger
// count).
//
// NO React imports — same governing constraint as overlayEvents.ts/chartData.ts
// so this stays unit-testable without jsdom. The sentences are read aloud by
// screen readers via aria-live, so wording and ordering are locked by
// 14-UI-SPEC.md §2 / 16.1-UI-SPEC.md §5.4 and must not drift.
//
// ONE DELIBERATE EXCEPTION to the no-non-pure-imports invariant (Phase 16.1):
// this module imports the store's exported DEFAULT_* maps so the shipped
// defaults have a single source (16.1-UI-SPEC.md §5.3 — "do not re-type the
// defaults"), which transitively pulls in zustand. Harmless here: every vitest
// suite in this project runs in the jsdom environment (vite.config.ts
// `test.environment: 'jsdom'`), and the store's localStorage access is lazy
// (initFilters / the setters), never at module load. If the stricter invariant
// is ever needed back, the fix is to move the four maps into a
// lib/filterDefaults.ts that both modules import — NEVER to duplicate them.
import type {
  BPCategory,
  PulseCategory,
  SeriesDataset,
  TimeOfDayBucket,
} from "../api/types";
import {
  DEFAULT_BP_CATEGORY,
  DEFAULT_DATASETS,
  DEFAULT_PULSE_CATEGORY,
  DEFAULT_TIME_OF_DAY,
} from "../store/filters";
import { DATASET_META, DATASET_ORDER, hasVitals } from "./datasetMeta";
import { fmtLongDate, presetLabel, selectedOrAll } from "./dates";
import type { DatePreset } from "./dates";

/** "a" / "a and b" / "a, b and c" — NO Oxford comma, because this string is
 * spoken aloud. Do NOT "fix" it to Intl.ListFormat's conjunction form: that
 * adds the comma. lib/agent.ts's spoken confirmation imports this same one.
 * (Deliberate asymmetry with overlayEvents.ts's joinWithOr, which IS written
 * text and therefore DOES take the Oxford comma.) */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Composes the panel's live-state sentence from the current selection.
 * Always ordered by DATASET_ORDER, never by the order the user ticked boxes,
 * so the same selection always reads the same way.
 */
export function buildShowSentence(
  visible: Record<SeriesDataset, boolean>,
): string {
  const on = DATASET_ORDER.filter((d) => visible[d]);

  if (on.length === 0) return "Nothing selected. Pick a dataset to see it.";

  const names = on.map((d) => DATASET_META[d].label.toLowerCase());
  const list = joinWithAnd(names);

  // No vitals means the chart has nothing to plot, so the timeline slot shows
  // a dated list instead (D-05). Say so, rather than letting the sentence
  // imply a chart that isn't there.
  if (!hasVitals(visible)) {
    return `Showing ${list}. No vitals selected, so these are listed by date.`;
  }

  return `Showing ${list}.`;
}

/** The slice of filter state the D-20 sentence reads. `latestReading` is the
 *  UNFILTERED newest-reading anchor (RESEARCH Open Question 1), passed in by
 *  the caller rather than read from the store. */
export type FilterSentenceState = {
  datePreset: DatePreset;
  latestReading: string | null;
  timeOfDay: Record<TimeOfDayBucket, boolean>;
  bpCategory: Record<BPCategory, boolean>;
  pulseCategory: Record<PulseCategory, boolean>;
};

/**
 * The D-20 live filter sentence — "All data · All times of day · All
 * categories · All pulse categories".
 *
 * Extracted VERBATIM from FilterBar.tsx (Phase 16.1) so the shell can render
 * it outside FilterBar without the wording drifting. 16.1-UI-SPEC.md §5.4:
 * the strings are unchanged and only the markup relocates — do not reword,
 * reorder, or re-punctuate anything here. Each group collapses to its "All …"
 * label under lib/dates.ts's zero-or-all convention; a strict subset joins
 * with joinWithAnd (no Oxford comma — this is spoken aloud).
 */
export function buildFilterSentence({
  datePreset,
  latestReading,
  timeOfDay,
  bpCategory,
  pulseCategory,
}: FilterSentenceState): string {
  const isDayPreset =
    datePreset === "7d" || datePreset === "30d" || datePreset === "90d";

  const sentenceParts = [presetLabel(datePreset)];
  if (isDayPreset && latestReading !== null) {
    sentenceParts.push(`to ${fmtLongDate(latestReading)}`);
  }
  const timeOfDaySegment = selectedOrAll(timeOfDay, "All times of day");
  sentenceParts.push(
    Array.isArray(timeOfDaySegment)
      ? joinWithAnd(timeOfDaySegment)
      : timeOfDaySegment,
  );
  const bpCategorySegment = selectedOrAll(bpCategory, "All categories");
  sentenceParts.push(
    Array.isArray(bpCategorySegment)
      ? joinWithAnd(bpCategorySegment)
      : bpCategorySegment,
  );
  const pulseCategorySegment = selectedOrAll(
    pulseCategory,
    "All pulse categories",
  );
  sentenceParts.push(
    Array.isArray(pulseCategorySegment)
      ? joinWithAnd(pulseCategorySegment)
      : pulseCategorySegment,
  );
  return sentenceParts.join(" · ");
}

/** The slice of filter state the trigger count reads. Date is absent on
 *  purpose — see activeFilterCount. */
export type ActiveFilterState = {
  timeOfDay: Record<TimeOfDayBucket, boolean>;
  bpCategory: Record<BPCategory, boolean>;
  pulseCategory: Record<PulseCategory, boolean>;
  visibleDatasets: Record<SeriesDataset, boolean>;
};

/** True when `current` differs from `defaults` in ANY key. Driven off the
 *  DEFAULT_* map's own keys so a default of `{bp: true, pulse: true, …}`
 *  counts a key turned OFF exactly like a key turned ON — "all false" is a
 *  property of three of the four groups, never an assumption made here. */
function differsFromDefault<K extends string>(
  current: Record<K, boolean>,
  defaults: Record<K, boolean>,
): boolean {
  return (Object.keys(defaults) as K[]).some((k) => current[k] !== defaults[k]);
}

/**
 * How many filter GROUPS differ from their shipped default — the Filters
 * trigger's count badge (16.1-UI-SPEC.md §5.3).
 *
 * Groups, never individual ticks: "Filters · 7" after ticking seven chips is
 * noise, and the detail already lives in the always-visible sentence. So the
 * maximum is 4 and seven ticked BP chips still total 1.
 *
 * The DATE group is deliberately excluded — it owns its own separate trigger
 * ("Dates: Last 30 days"), which already states its state in words.
 *
 * Compares against the store's own exported DEFAULT_* maps rather than
 * re-typed literals (§5.3), so a future default change cannot desynchronise
 * the badge from reality.
 */
export function activeFilterCount(state: ActiveFilterState): number {
  return (
    Number(differsFromDefault(state.timeOfDay, DEFAULT_TIME_OF_DAY)) +
    Number(differsFromDefault(state.bpCategory, DEFAULT_BP_CATEGORY)) +
    Number(differsFromDefault(state.pulseCategory, DEFAULT_PULSE_CATEGORY)) +
    Number(differsFromDefault(state.visibleDatasets, DEFAULT_DATASETS))
  );
}
