/**
 * ChartDeck — routes the chart region to one of four renderings based purely
 * on store state (Phase 14, D-01/D-05/D-06/D-08).
 *
 * The hero + three-mini rotation is gone. It existed to let Chris switch
 * between four mutually exclusive charts; two of those four are now datasets
 * on one shared timeline, and the remaining two are reached by the view
 * switcher above. Nothing here is a chart *picker* any more.
 *
 * Routing:
 *   chartView "bp_categories"      -> CategoryBars
 *   chartView "am_pm_comparison"   -> AmPmComparison
 *   chartView "timeline" + vitals  -> CombinedTimeline
 *   chartView "timeline", events   -> EventTimelineList   (D-05)
 *   chartView "timeline", nothing  -> pick-something prompt (D-06)
 *
 * `stats` arrives as `StatsSummary | undefined` — App only renders the deck
 * after both queries succeed, so the CategoryBars guard below is type
 * narrowing, not a reachable UI state.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { ChartView, OverlayDataset, Reading, StatsSummary } from "../api/types";
import { prefersReducedMotion } from "../lib/chartData";
import { VIEW_ORDER } from "../lib/chartViews";
import { enabledEventTypes, hasVitals } from "../lib/datasetMeta";
import type { OverlayEvent } from "../lib/overlayEvents";
import { DATASET_KEYS, useFilters } from "../store/filters";

import { EventTimelineList } from "./EventTimelineList";
import AmPmComparison from "./charts/AmPmComparison";
import CategoryBars from "./charts/CategoryBars";
import CombinedTimeline from "./charts/CombinedTimeline";

export type ChartDeckProps = {
  readings: Reading[];
  stats: StatsSummary | undefined;
  overlayEvents?: OverlayEvent[];
};

/** Mirrors --dur-state. THE EXIT -> COMMIT HANDOFF IS A TIMER, AND
 *  `transitionend` IS FORBIDDEN HERE: jsdom never fires transitionend, so a
 *  transitionend-driven commit would hang ChartDeck.test.tsx's exit->in
 *  assertion forever while the browser behaved perfectly — the worst class of
 *  gate failure, one that blames the wrong thing. A timer is also already the
 *  precedent in this component. Keep in step with index.css. */
const EXIT_MS = 220;

/** -1 back, +1 forward along VIEW_ORDER, 0 for a swap that was not a view
 *  change at all (a dataset toggle also changes the remount key). */
type SwapDirection = -1 | 0 | 1;

function directionBetween(from: ChartView, to: ChartView): SwapDirection {
  const a = VIEW_ORDER.indexOf(from);
  const b = VIEW_ORDER.indexOf(to);
  if (a === -1 || b === -1 || a === b) return 0;
  return b > a ? 1 : -1;
}

/**
 * Mount-fade wrapper (D-04), extended into a DIRECTIONAL, SEQUENTIAL swap
 * (quick 261005-mj2, brief §5). The entrance half is unchanged: start at
 * opacity-0 and flip one frame later, with a double rAF so the initial styles
 * are painted before the toggle and the transition actually runs.
 *
 * WHY THE REMOUNT KEY LIVES IN HERE NOW. It used to sit on ChartDeck's
 * wrapper div — `<div key={key}><FadeSwap>…</FadeSwap></div>` — which
 * destroyed this whole component on every view change. A `swapKey` prop on
 * that structure could never have been OBSERVED (the instance was replaced,
 * not updated), so there could be no exit phase at all. The key therefore
 * moved onto `swapKey`, and the fresh-mount guarantee Recharts needs is
 * preserved by the internal `<Fragment key={committed.key}>` below.
 *
 * THAT INNER NODE MUST BE A FRAGMENT, AND NO AUTOMATED GATE CAN TELL YOU
 * OTHERWISE. The height chain is `h-[clamp(…)]` -> this component's own
 * `h-full w-full` div -> CombinedTimeline -> ResponsiveContainer, unbroken
 * `h-full` the whole way. The key cannot go on that `h-full` div: it carries
 * the transition classes, the shown/exiting state and `data-swap-phase`, so
 * keying it would remount it and destroy the very transition this exists to
 * create. A new inner DIV would have AUTO height, break the chain, make
 * ResponsiveContainer measure 0 and render the timeline BLANK — and Recharts
 * draws nothing under jsdom, so the suite would stay green while the chart
 * was empty in the browser. A keyed Fragment forces the remount while adding
 * no DOM node and no height link.
 *
 * SEQUENTIAL, not crossfaded: keeping the outgoing chart mounted alongside the
 * incoming one would mount a second ResponsiveContainer and risk the
 * documented zero-width measurement failure.
 *
 * FOUR OTHER COMPONENTS DESCRIBE THEMSELVES AS MIRRORING "ChartDeck.tsx's
 * FadeSwap" — AddRecordPage.tsx (a local copy of the helper),
 * DateRangePicker.tsx, GuideOverlay.tsx and charts/ChartTooltip.tsx — and
 * every one of them means the ENTRANCE HALF ONLY, the double-rAF `shown`
 * toggle. The exit machinery, `swapKey`, the direction and `data-swap-phase`
 * are this component's alone. Do not propagate them into those four.
 */
function FadeSwap({
  swapKey,
  view,
  children,
}: {
  /** Changes whenever the RENDERING changes, not just when the view does. */
  swapKey: string;
  /** The live chart view, so the direction can be derived against the view
   *  that was current when the showing node was committed. Deriving it here
   *  rather than taking it as a prop is what keeps a dataset toggle at
   *  direction 0 without any stale state to reset. */
  view: ChartView;
  children: ReactNode;
}) {
  // Seeded from the first render, so there is no exit on mount.
  const [committed, setCommitted] = useState(() => ({
    key: swapKey,
    view,
    node: children,
    enterFrom: 0 as SwapDirection,
  }));
  const [shown, setShown] = useState(false);
  const [exiting, setExiting] = useState(false);

  // The CURRENT props, read at timer-fire time rather than captured when the
  // timer was armed. A second swap mid-exit would otherwise commit a stale
  // key — chart B flashing in and straight back out — and a permanently blank
  // chart on a health dashboard is the worst outcome available here.
  const latest = useRef({ swapKey, view, children });
  latest.current = { swapKey, view, children };

  const needsSwap = swapKey !== committed.key;
  const direction = directionBetween(committed.view, view);

  useEffect(() => {
    if (!needsSwap) return;

    const commit = (enterFrom: SwapDirection) => {
      setCommitted({
        key: latest.current.swapKey,
        view: latest.current.view,
        node: latest.current.children,
        enterFrom,
      });
      setShown(false);
      setExiting(false);
    };

    // Direction 0 (a dataset toggle) and reduced motion both commit at once
    // and run the entrance only — exactly the behaviour before this change.
    // Reduced motion is checked in JS because the index.css token block cannot
    // reach this timer: leaving it would hold an opacity-0 wrapper for 220ms
    // with the transition already instant, i.e. a blank flash.
    if (direction === 0 || prefersReducedMotion()) {
      commit(0);
      return;
    }

    setExiting(true);
    const timer = setTimeout(() => commit(direction), EXIT_MS);
    // Keyed on swapKey, so React's cleanup cancels a SUPERSEDED timer when a
    // second swap arrives mid-exit.
    return () => clearTimeout(timer);
  }, [needsSwap, direction, swapKey]);

  useEffect(() => {
    if (shown) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [shown, committed.key]);

  // While the showing node IS the live one, render the LIVE children rather
  // than the stored copy. A date-filter change does not alter `swapKey`, and a
  // frozen stale node would be a DATA bug, not a motion one.
  const node = needsSwap ? committed.node : children;

  // The outgoing chart drifts out toward the side it CAME FROM and the
  // incoming one drifts in from the other, so the travel says where you went
  // (brief §5). Transform and opacity only.
  const outgoingSide = direction > 0 ? "-translate-x-8" : "translate-x-8";
  const incomingSide =
    committed.enterFrom === 0
      ? "scale-95"
      : committed.enterFrom > 0
        ? "translate-x-8"
        : "-translate-x-8";
  const phaseClass = exiting
    ? `duration-[var(--dur-state)] ${outgoingSide} opacity-0`
    : shown
      ? "duration-[var(--dur-travel)] translate-x-0 scale-100 opacity-100"
      : `duration-[var(--dur-travel)] ${incomingSide} opacity-0`;

  return (
    <div
      // The ONLY thing that makes the exit phase observable. A grep for a
      // `direction` identifier passes on an entrance-only build; the
      // exit->in assertion in ChartDeck.test.tsx does not.
      data-swap-phase={exiting ? "exit" : "in"}
      className={`h-full w-full transition-[opacity,transform] ease-[var(--ease-swell)] motion-reduce:transition-none ${phaseClass}`}
    >
      <Fragment key={committed.key}>{node}</Fragment>
    </div>
  );
}

/** D-06 — never a blank panel. One tap restores everything.
 *  Uses showOnlyDatasets rather than showAllData so the button does what it
 *  says (turn every dataset on) without also resetting the date range the
 *  user deliberately set (WR-01). */
function NothingSelected() {
  const showOnlyDatasets = useFilters((s) => s.showOnlyDatasets);
  return (
    <section
      aria-label="Nothing selected"
      className="flex flex-col items-center gap-4 rounded-xl bg-[var(--color-mist)] p-8 text-center shadow-[var(--shadow-elevation)]"
    >
      {/* No heading here — ChartDeck already renders "Nothing selected" as the
          region title above, and EventTimelineList/CombinedTimeline likewise
          leave the heading to the parent. Repeating it stacked the same text
          twice on screen and announced it twice (found by ChartDeck.test). */}
      <p className="text-base">
        Tick a box above to choose what to see, or show everything at once.
      </p>
      <button
        type="button"
        onClick={() => showOnlyDatasets(DATASET_KEYS)}
        className="press-swell min-h-12 rounded-xl bg-[var(--color-accent)] px-6 text-label text-[var(--color-accent-text)]"
      >
        Show everything
      </button>
    </section>
  );
}

export function ChartDeck({ readings, stats, overlayEvents }: ChartDeckProps) {
  const chartView = useFilters((s) => s.chartView);
  const visibleDatasets = useFilters((s) => s.visibleDatasets);

  const showBP = visibleDatasets.blood_pressure;
  const showPulse = visibleDatasets.pulse;
  const eventTypes: OverlayDataset[] = enabledEventTypes(visibleDatasets);

  let title: string;
  let body: ReactNode;
  // `key` is FadeSwap's `swapKey`: it drives the remount of the chart node
  // INSIDE FadeSwap (which Recharts needs), so it must change whenever the
  // rendering changes — not just when chartView does. It used to sit on the
  // wrapper div below, where it destroyed FadeSwap itself on every change and
  // made an exit phase impossible; see FadeSwap's header.
  let key: string;

  if (chartView === "bp_categories") {
    title = "BP Categories";
    key = "bp_categories";
    body = stats === undefined ? null : <CategoryBars stats={stats} />;
  } else if (chartView === "am_pm_comparison") {
    title = "AM vs PM";
    key = "am_pm_comparison";
    body = <AmPmComparison readings={readings} />;
  } else if (hasVitals(visibleDatasets)) {
    title = "Timeline";
    key = `timeline-${showBP}-${showPulse}`;
    body = (
      <CombinedTimeline
        readings={readings}
        overlayEvents={overlayEvents}
        showBP={showBP}
        showPulse={showPulse}
      />
    );
  } else if (eventTypes.length > 0) {
    // D-05: with nothing to plot, a chart would be an axis with no data on
    // it, which reads as broken. A dated list is the honest rendering.
    title = "Events";
    key = `events-${eventTypes.join("-")}`;
    body = (
      <EventTimelineList
        events={overlayEvents ?? []}
        enabledTypes={eventTypes}
      />
    );
  } else {
    title = "Nothing selected";
    key = "empty";
    body = <NothingSelected />;
  }

  // The timeline needs a fixed height for ResponsiveContainer (Pitfall 2);
  // the list and prompt size to their own content.
  const fixedHeight = chartView !== "timeline" || hasVitals(visibleDatasets);

  return (
    <section aria-label="Charts" className="flex flex-col gap-8">
      {/* The chart sits in its own elevated white card on the tinted canvas
          (quick 261003-hev) — the structural move both reference dashboards
          make, and what stops the timeline's full-bleed clinical bands from
          reading as the page's own background. The heading moved inside the
          card with it, so the card is the whole unit rather than a frame
          floating under a loose title. */}
      <div className="rounded-xl bg-[var(--color-mist)] p-5 shadow-[var(--shadow-elevation)] md:p-6">
        <h2 className="text-heading leading-tight text-[var(--color-depth)]">
          {title}
        </h2>
        {/* The wrapper keeps ONLY its height class — the key moved onto
            FadeSwap's swapKey so the FadeSwap instance survives a swap and
            can run an exit phase. Do not put a key back on this div. */}
        <div className={fixedHeight ? "h-[clamp(420px,calc(100vh_-_300px),760px)]" : undefined}>
          <FadeSwap swapKey={key} view={chartView}>
            {body}
          </FadeSwap>
        </div>
      </div>
    </section>
  );
}
