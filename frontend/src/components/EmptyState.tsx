// Guided empty state (D-11) — shown when the current filters match zero
// readings. Explains WHY it's empty (which filters), anchors the user with
// the newest UNFILTERED reading date, and offers exactly one escape hatch:
// the "Show all data" button. The chosen range is NEVER auto-widened —
// the button is the only way out (D-11 hard rule).
//
// Copy is verbatim from 02-UI-SPEC.md Copywriting Contract. This component
// receives typed props only and never renders error objects or raw status
// text (T-02-11 — error presentation is centralized in App, plan 02-07).
import { Sailboat } from "lucide-react";

import { fmtLongDate } from "../lib/dates";
import { useFilters } from "../store/filters";

type EmptyStateProps = {
  /** UNFILTERED newest reading (stats.latest_reading) — D-11 anchor. */
  latestReading: string | null;
  amPm: "all" | "AM" | "PM";
  /** "all" or a category label — "all" omits the category clause. */
  bpCategory: string;
  /** Display label for the active date range (lib/dates presetLabel). */
  presetLabel: string;
};

export function EmptyState({
  latestReading,
  amPm,
  bpCategory,
  presetLabel,
}: EmptyStateProps) {
  const showAllData = useFilters((s) => s.showAllData);

  // "There are no {AM|PM} readings in {presetLabel}{ in {category}}."
  // The AM/PM segment is omitted entirely when the filter is "all".
  const amPmSegment = amPm === "all" ? "" : `${amPm} `;
  const categoryClause = bpCategory === "all" ? "" : ` in ${bpCategory}`;
  const newestSentence =
    latestReading !== null
      ? ` The newest reading is from ${fmtLongDate(latestReading)}.`
      : "";

  return (
    <section
      aria-label="No matching readings"
      className="flex flex-col items-center gap-4 rounded-lg bg-[var(--color-sky)] p-8 text-center"
    >
      {/* Subtle nautical touch (D-16) — decorative only. */}
      <Sailboat aria-hidden="true" className="h-10 w-10" />
      <h2 className="text-2xl leading-tight font-bold">
        No readings match these filters
      </h2>
      <p className="text-lg">
        {`There are no ${amPmSegment}readings in ${presetLabel}${categoryClause}.${newestSentence}`}
      </p>
      <button
        type="button"
        onClick={showAllData}
        className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)]"
      >
        Show all data
      </button>
    </section>
  );
}
