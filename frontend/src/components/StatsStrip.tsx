// Vitals strip (DASH-08, D-21/D-22, 16.1-UI-SPEC §5.6) — renders the
// GET /stats/summary payload VERBATIM as one island row of four readouts.
// Every number on screen comes straight from the `stats` prop: avg/min/max
// per vital and the reading count are all computed by the backend (API-02).
// NO client-side arithmetic over the raw series happens here — the strip must
// agree with the API cell-for-cell (Architectural Responsibility Map).
//
// Note on `latest_reading`: it is part of the StatsSummary payload but is NOT
// a readout — it is the UNFILTERED newest-reading anchor consumed by the date
// presets (lib/dates.ts) and the D-11 EmptyState copy, so it renders there,
// not here.
//
// Presentational only: data is fetched at App level (plan 02-07) and passed
// down. `isLoading` covers the initial load; after first load TanStack
// Query's keepPreviousData prevents blank cells on filter changes.
//
// 16.1-08: the four stat cards plus the category-percent list (588px
// measured) collapse into this one ~90px row. Four things were REMOVED, each
// for a recorded reason — do not restore any of them as an oversight:
//   - the per-cell sparkline and the latest-category status pill: both
//     restate the chart directly below at worse fidelity. Dropping them made
//     the sparkline component dead code (deleted in the same plan) and left
//     the raw per-reading prop with no consumer, so this component now takes
//     only the backend-computed payload.
//   - the per-cell sparkline's svg (see above).
//
// 2026-10-02, client request: the four lucide symbols are BACK, and the row
// is tighter (~90px -> ~70px). 16.1-08 dropped them because an icon would
// spend 32px of a 156.0px cell — but that reasoning applied to the VALUE
// line, which has only 9.9px of slack. Re-measured against real Atkinson
// metrics: the LABEL line's worst case ("Readings" at 20px/700) is 87.7px,
// so a 20px symbol plus an 8px gap totals 115.7px and leaves 40.3px spare.
// The symbols sit on the label line for exactly that reason; putting one on
// the value line is still forbidden. The value also drops 36px -> 24px,
// which is what buys the height AND widens the value line's own slack from
// 9.9px to roughly 36px.
//   - the six-chip category-percent list: it duplicates the `BP Categories`
//     chart view, which renders the same distribution larger, labelled, and
//     one voice command away (§5.6, decision closed 2026-09-30). Dropped
//     outright — not relocated below the chart, not made collapsible, not
//     kept at a smaller size.
import { Activity, Gauge, HeartPulse, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { StatsSummary, VitalStats } from "../api/types";

type StatsStripProps = {
  stats: StatsSummary | undefined;
  isLoading: boolean;
};

/** The row IS the island (§5.6): one mist surface, 24px horizontal and 8px
 *  vertical padding (tightened from 12px on 2026-10-02 with the smaller
 *  value type; the row is now ~70px, not ~90px). */
const ROW =
  "rounded-xl bg-[var(--color-mist)] px-6 py-2 shadow-[var(--shadow-elevation)]";

/** Two columns on phones, four from 1024px up. The four-column breakpoint
 *  stays at 1024px deliberately: moving it down to 768px would make THAT the
 *  real worst case at 152.0px against the 146.1px the inline value-plus-range
 *  layout needs — a 5.9px margin, tighter than the 9.9px §9.4 records as the
 *  floor, and §9.4 is the number a future editor will trust. Four readouts at
 *  375px would be ~82px each, which cannot hold a 20px/700 label, and
 *  shrinking the type below the 18px floor is forbidden. */
const GRID = "grid grid-cols-2 lg:grid-cols-4 gap-4";

/** The 2px desktop divider is painted INSIDE the 16px grid gap by a
 *  pseudo-element rather than as a left border on the cell: preflight sets
 *  box-sizing to border-box, so a real border would eat 2px of the 156.0px
 *  cell at the 1024px worst case and silently shrink §9.4's recorded slack to
 *  7.9px. A pseudo-element costs the cell's content width nothing. */
const DIVIDER =
  "lg:relative lg:before:absolute lg:before:inset-y-0 lg:before:-left-2 lg:before:w-0.5 lg:before:bg-[var(--color-depth)] lg:before:content-['']";

/** One vital readout: label on line 1, value with its range inline to the
 *  right on line 2. Exactly two line boxes at every width ≥640px. */
function VitalCell({
  label,
  vital,
  divided,
  Icon,
}: {
  label: string;
  vital: VitalStats | null;
  divided: boolean;
  Icon: LucideIcon;
}) {
  return (
    <div className={divided ? DIVIDER : undefined}>
      {/* The symbol is decoration: the adjacent word already names the vital,
          so it is aria-hidden and adds nothing to the announced string. */}
      <p className="flex items-center gap-2 text-label text-[var(--color-depth)]">
        <Icon aria-hidden="true" size={20} className="shrink-0" />
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        {/* count === 0 → VitalStats is null → em dash for the value AND for
            the range (never 0, never blank — the D-22 null contract). */}
        <p className="text-heading text-[var(--color-depth)]">
          {vital !== null ? vital.avg : "—"}
        </p>
        {/* The VISIBLE range is a bare numeric range; the min/max WORDS live
            in the visually-hidden span, so shortening what is drawn costs a
            screen-reader user nothing. A visually-hidden span rather than an
            aria-label on this paragraph because aria-label on a generic-role
            element is not reliably honoured, and sr-only is already this
            codebase's idiom (ReadingsTable, OverlayEventsList, UploadPage).

            MEASURED in a browser against real Atkinson metrics (2026-09-30),
            not estimated from character counts: this inline layout needs
            146.1px of the 156.0px cell at the 1024px worst case — 9.9px of
            slack, about 6%. DO NOT LENGTHEN THE VISIBLE STRING: no unit, no
            spaces around the separator, no four-digit value, no third inline
            element. Any of those breaks the locked row height, and the only
            correct response is a fresh in-browser measurement pass.

            The separator is U+2013, correct typography for a numeric range.
            It is NOT the em-dash sentence joiner quick task 260930-n7i
            retired from user-facing copy, and it must not be "fixed" to a
            hyphen-minus or to the word "to". */}
        <p className="text-base text-[var(--color-depth)]">
          {vital !== null ? (
            <>
              <span aria-hidden="true">{`${vital.min}–${vital.max}`}</span>
              <span className="sr-only">{`minimum ${vital.min}, maximum ${vital.max}`}</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">minimum and maximum unavailable</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Skeleton cell for the initial-load state (§5.6 loading contract) — same
 *  grid, same two line boxes, so the row does not jump when data lands. */
function SkeletonCell() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-24 rounded bg-[var(--color-deck)]" />
      <div className="mt-1 h-9 w-20 rounded bg-[var(--color-deck)]" />
    </div>
  );
}

export function StatsStrip({ stats, isLoading }: StatsStripProps) {
  if (!isLoading && stats === undefined) {
    // Not loading and no data: the error surface is centralized in App
    // (plan 02-07, T-02-11) — this component never renders error copy.
    return null;
  }

  return (
    <section aria-label="Summary statistics" aria-busy={isLoading} className={ROW}>
      <div className={GRID}>
        {isLoading || stats === undefined ? (
          <>
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
            <SkeletonCell />
          </>
        ) : (
          <>
            <VitalCell label="Systolic" vital={stats.systolic} divided={false} Icon={Gauge} />
            <VitalCell label="Diastolic" vital={stats.diastolic} divided Icon={Activity} />
            <VitalCell label="Pulse" vital={stats.pulse} divided Icon={HeartPulse} />
            <div className={DIVIDER}>
              <p className="flex items-center gap-2 text-label text-[var(--color-depth)]">
                <ListChecks aria-hidden="true" size={20} className="shrink-0" />
                Readings
              </p>
              {/* NO secondary line here: a count has no minimum or maximum, a
                  fabricated range would be meaningless, and the other three
                  cells set the row height anyway. Do not add a "total" or
                  "all time" filler string to balance the cell visually — on a
                  data surface an invented word is worse than white space. */}
              <p className="text-heading text-[var(--color-depth)]">{stats.count}</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
