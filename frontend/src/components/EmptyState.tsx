// Guided empty state (D-11) — shown when the current filters match zero
// readings. Explains WHY it's empty (which filters), anchors the user with
// the newest UNFILTERED reading date, and offers exactly one escape hatch:
// the "Show all data" button. The chosen range is NEVER auto-widened —
// the button is the only way out (D-11 hard rule).
//
// Copy is verbatim from 02-UI-SPEC.md Copywriting Contract, extended per
// 15-UI-SPEC.md §8 for the v3 multi-select filter shape (Phase 15). This
// component receives typed props only and never renders error objects or
// raw status text (T-02-11 — error presentation is centralized in App).
import { Sailboat } from "lucide-react";

import type { BPCategory, PulseCategory, TimeOfDayBucket } from "../api/types";
import { fmtLongDate, TIME_OF_DAY_ORDER } from "../lib/dates";
import { CLINICAL_ORDER, PULSE_CLINICAL_ORDER } from "../lib/palette";
import { joinWithAnd } from "../lib/showSentence";
import { useFilters } from "../store/filters";

type EmptyStateProps = {
  /** UNFILTERED newest reading (stats.latest_reading) — D-11 anchor. */
  latestReading: string | null;
  bpCategory: Record<BPCategory, boolean>;
  pulseCategory: Record<PulseCategory, boolean>;
  timeOfDay: Record<TimeOfDayBucket, boolean>;
  /** Display label for the active date range (lib/dates presetLabel). */
  presetLabel: string;
};

// Zero-or-all collapse: 0 or every key selected means "no filter" — the same
// locally-scoped helper shape as lib/agent.ts composeConfirmation's `selected`.
function selected<K extends string>(m: Record<K, boolean>): K[] {
  return (Object.keys(m) as K[]).filter((k) => m[k]);
}

export function EmptyState({
  latestReading,
  bpCategory,
  pulseCategory,
  timeOfDay,
  presetLabel,
}: EmptyStateProps) {
  const showAllData = useFilters((s) => s.showAllData);

  // "There are no {time of day }readings in {presetLabel}{ in {category}}{ with {pulse} pulse}."
  // Each clause collapses to "" under the zero-or-all convention (15-UI-SPEC §8).
  const timeOfDaySelected = selected(timeOfDay);
  const timeOfDayPrefix =
    timeOfDaySelected.length === 0 ||
    timeOfDaySelected.length === TIME_OF_DAY_ORDER.length
      ? ""
      : `${joinWithAnd(timeOfDaySelected.map((b) => b.toLowerCase()))} `;

  const bpCategorySelected = selected(bpCategory);
  const bpCategoryClause =
    bpCategorySelected.length === 0 ||
    bpCategorySelected.length === CLINICAL_ORDER.length
      ? ""
      : ` in ${joinWithAnd(bpCategorySelected)}`;

  const pulseCategorySelected = selected(pulseCategory);
  const pulseCategoryClause =
    pulseCategorySelected.length === 0 ||
    pulseCategorySelected.length === PULSE_CLINICAL_ORDER.length
      ? ""
      : ` with ${joinWithAnd(pulseCategorySelected)} pulse`;

  const newestSentence =
    latestReading !== null
      ? ` The newest reading is from ${fmtLongDate(latestReading)}.`
      : "";

  return (
    <section
      aria-label="No matching readings"
      className="flex flex-col items-center gap-4 rounded-xl bg-[var(--color-mist)] p-8 text-center shadow-[var(--shadow-elevation)]"
    >
      {/* Subtle nautical touch (D-16) — decorative only. */}
      <Sailboat aria-hidden="true" className="h-10 w-10" />
      <h2 className="text-heading leading-tight">
        No readings match these filters
      </h2>
      <p className="text-lg">
        {`There are no ${timeOfDayPrefix}readings in ${presetLabel}${bpCategoryClause}${pulseCategoryClause}.${newestSentence}`}
      </p>
      <button
        type="button"
        onClick={showAllData}
        className="min-h-12 rounded-xl bg-[var(--color-brass)] px-6 text-label text-[var(--color-brass-text)]"
      >
        Show all data
      </button>
    </section>
  );
}
