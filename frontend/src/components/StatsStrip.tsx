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
//
// EVERY PIXEL FIGURE ABOVE WAS MEASURED AGAINST ATKINSON HYPERLEGIBLE and the
// 2026-10-05 client typeface swap retired that face for Plus Jakarta Sans, so
// they are now approximations rather than measurements. They are kept because
// the DIRECTION of the error is known and safe: Plus Jakarta Sans is the
// narrower of the two, so every "spare" figure here understates the real
// slack and no cell gets tighter than the numbers claim. Do not treat them as
// exact, and re-measure before using them to justify ADDING anything to a
// cell — that is the one move they can no longer support.
//   - the six-chip category-percent list: it duplicates the `BP Categories`
//     chart view, which renders the same distribution larger, labelled, and
//     one voice command away (§5.6, decision closed 2026-09-30). Dropped
//     outright — not relocated below the chart, not made collapsible, not
//     kept at a smaller size.
import { Activity, Gauge, HeartPulse, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { StatsSummary, VitalStats } from "../api/types";
import { useCountUp } from "../hooks/useCountUp";

type StatsStripProps = {
  stats: StatsSummary | undefined;
  isLoading: boolean;
};

/** The crest every readout arrives on (quick 261005-mj2, brief §4). */
const CREST =
  "motion-safe:animate-[swell-rise_var(--dur-crest)_var(--ease-swell)_both]";

/** THE KPI ROW IS STEPS 3-6 OF ONE LADDER, not a group that starts over.
 *  LeftRail crested at step 0 and GreetingHeader took steps 1 and 2, so the
 *  first card starts at step 3. The `3 +` is load-bearing: without it the
 *  first card would rise alongside the rail and the entrance would stop being
 *  "rail, then greeting, then the cards left-to-right" — which is the whole
 *  thesis. Four siblings and three steps of sibling delay, so the brief's
 *  cap of four per group still holds. */
const LADDER_OFFSET = 3;

/** Mirrors --stagger-step, for the JS side of the same ladder (useCountUp
 *  cannot read a CSS custom property). Keep in step with index.css. */
const STAGGER_MS = 60;

/** The CSS delay and the JS delay for card `n` (0-based, left to right). They
 *  must agree: the card is invisible until the CSS delay elapses, and the
 *  count has to start at that same instant rather than behind the curtain. */
function ladderStep(n: number) {
  return {
    css: `calc(var(--stagger-step) * ${LADDER_OFFSET + n})`,
    ms: (LADDER_OFFSET + n) * STAGGER_MS,
  };
}

/** The row is no longer the island (quick 261003-hev). EACH CELL is its own
 *  elevated card now, matching the reference dashboards' KPI row, so the
 *  section itself is a bare grid with no surface, no padding and no shadow. */
const ROW = "";

/** Two columns on phones, four from 1024px up. The four-column breakpoint
 *  stays at 1024px deliberately: moving it down to 768px would make THAT the
 *  real worst case at 152.0px against the 146.1px the inline value-plus-range
 *  layout needs — a 5.9px margin, tighter than the 9.9px §9.4 records as the
 *  floor, and §9.4 is the number a future editor will trust. Four readouts at
 *  375px would be ~82px each, which cannot hold a 20px/700 label, and
 *  shrinking the type below the 18px floor is forbidden. */
const GRID = "grid grid-cols-2 lg:grid-cols-4 gap-4";

/** Each readout is now a card. The divider pseudo-element is GONE: separate
 *  cards with a 16px gap already say "these are four things", and a divider
 *  between two floating cards would be drawing a line in mid-air.
 *
 *  Card padding is what forced the stacked layout below — see VitalCell. */
/** NO BORDER. A card is a container, not a control: WCAG 1.4.11's 3:1
 *  boundary rule governs interactive components, and applying it to static
 *  surfaces as well is what kept this looking outlined rather than floating.
 *  The shadow alone separates the card from the canvas, exactly as it does in
 *  both reference dashboards. Controls keep their hairlines. */
const CARD =
  "rounded-xl bg-[var(--color-mist)] px-5 py-4 shadow-[var(--shadow-elevation)]";

/** One tile in the row is the dark one — the reference's navy feature tile
 *  dropped into the stat row. Readings is the natural choice: it is the only
 *  readout with no min-max, so it was already the odd cell out. */
const CARD_FEATURE =
  "rounded-xl bg-[var(--color-panel)] px-5 py-4 shadow-[var(--shadow-elevation)]";

/** One vital readout as a card: label, then the value, then the range on its
 *  OWN line.
 *
 *  The range moved off the value's line deliberately and the §9.4 measurement
 *  is why. That measurement — 146.1px needed inside a 156.0px cell at the
 *  1024px worst case, 9.9px of slack — was taken when the row was one surface
 *  and a cell had no padding of its own. A card spends 32px of its width on
 *  px-4, leaving ~124px, which is 22px LESS than the inline layout needs: the
 *  value and range would have wrapped at exactly the breakpoint the old
 *  comment warned about. Stacking removes the constraint entirely (each line
 *  is now short on its own) and is also what both reference dashboards do
 *  with a KPI tile.
 *
 *  The cost is height: ~70px of strip becomes ~104px of cards. That is the
 *  trade the card treatment buys, not an oversight.
 *
 *  Unchanged: the em-dash null contract (D-22), the visually-hidden min/max
 *  WORDS, and the U+2013 range separator — which is correct typography for a
 *  numeric range and is NOT the em-dash joiner that 260930-n7i retired. */
function VitalCell({
  label,
  vital,
  Icon,
  step,
}: {
  label: string;
  vital: VitalStats | null;
  Icon: LucideIcon;
  /** 0-based position in the row, left to right — see ladderStep. */
  step: number;
}) {
  const delay = ladderStep(step);
  // Settles on `vital.avg` verbatim; a null vital returns the em dash
  // immediately and never counts (D-22). See useCountUp's header.
  const avg = useCountUp(vital === null ? null : vital.avg, delay.ms);

  return (
    <div className={`${CARD} ${CREST}`} style={{ animationDelay: delay.css }}>
      {/* The symbol is decoration: the adjacent word already names the vital,
          so it is aria-hidden and adds nothing to the announced string. */}
      {/* Label and range sit in --color-muted at regular weight; only the
          value holds full ink and 700. Setting every line at 20px/700 ink is
          what made the old strip read as a wall of bold navy — the references
          put a quiet grey label above a loud number, and so does this now. */}
      <p className="flex items-center gap-2 text-base font-normal text-[var(--color-muted)]">
        <Icon aria-hidden="true" size={20} className="shrink-0" />
        {label}
      </p>
      {/* `tnum` (index.css) is what stops the cell shimmying while the digits
          change — proportional figures would re-measure on every frame. */}
      <p className="tnum mt-1 text-display text-[var(--color-depth)]">{avg}</p>
      <p className="tnum text-base font-normal text-[var(--color-muted)]">
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
  );
}

/** The dark feature tile. Its own component so the count-up hook has a top
 *  level to live at — StatsStrip itself returns early and branches on
 *  `isLoading`, so a hook called inside that branch would be conditional. */
function ReadingsCell({ count, step }: { count: number; step: number }) {
  const delay = ladderStep(step);
  const shown = useCountUp(count, delay.ms);

  return (
    // The 1px --color-sky waterline on the TOP edge only. Sky on a DARK
    // ground is exactly where the Sky-Is-Not-A-Button Rule permits it: the
    // rule bans a text-bearing sky FILL on a light surface, and this is a
    // boundary on navy. Newly gated in contrast.test.ts rather than left to
    // ride on --color-accent-on-panel's identical literal.
    <div
      className={`${CARD_FEATURE} ${CREST} border-t border-[var(--color-sky)]`}
      style={{ animationDelay: delay.css }}
    >
      <p className="flex items-center gap-2 text-base font-normal text-[var(--color-muted-on-panel)]">
        <ListChecks aria-hidden="true" size={20} className="shrink-0" />
        Readings
      </p>
      {/* NO secondary line here: a count has no minimum or maximum, a
          fabricated range would be meaningless, and the other three
          cells set the row height anyway. Do not add a "total" or
          "all time" filler string to balance the cell visually — on a
          data surface an invented word is worse than white space. */}
      <p className="tnum mt-1 text-display text-[var(--color-panel-text)]">
        {shown}
      </p>
    </div>
  );
}

/** Skeleton cell for the initial-load state (§5.6 loading contract) — same
 *  grid, same two line boxes, so the row does not jump when data lands. */
function SkeletonCell() {
  return (
    <div className={`${CARD} motion-safe:animate-pulse`}>
      <div className="h-6 w-24 rounded bg-[var(--color-deck)]" />
      <div className="mt-1 h-9 w-20 rounded bg-[var(--color-deck)]" />
      <div className="mt-1 h-6 w-16 rounded bg-[var(--color-deck)]" />
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
            {/* step 0..3, left to right — the four cards crest in that order. */}
            <VitalCell label="Systolic" vital={stats.systolic} Icon={Gauge} step={0} />
            <VitalCell label="Diastolic" vital={stats.diastolic} Icon={Activity} step={1} />
            <VitalCell label="Pulse" vital={stats.pulse} Icon={HeartPulse} step={2} />
            <ReadingsCell count={stats.count} step={3} />
          </>
        )}
      </div>
    </section>
  );
}
