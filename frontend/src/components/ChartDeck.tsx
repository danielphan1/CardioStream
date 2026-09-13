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
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { OverlayDataset, Reading, StatsSummary } from "../api/types";
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

/**
 * Mount-fade wrapper (D-04): starts opacity-0 scale-95 and flips to
 * opacity-100 scale-100 one frame after mount, riding the 250ms ease-in-out
 * transition. Double rAF guarantees the initial styles are painted before
 * the toggle so the transition actually runs. `motion-reduce:transition-none`
 * makes the swap instant under prefers-reduced-motion.
 */
function FadeSwap({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <div
      className={`h-full w-full transition-[opacity,transform] duration-[250ms] ease-in-out motion-reduce:transition-none ${
        shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      {children}
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
      <p className="text-lg">
        Tick a box above to choose what to see — or show everything at once.
      </p>
      <button
        type="button"
        onClick={() => showOnlyDatasets(DATASET_KEYS)}
        className="min-h-12 rounded-xl bg-[var(--color-brass)] px-6 text-label text-[var(--color-brass-text)]"
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
  // `key` drives the FadeSwap remount, so it must change whenever the
  // rendering changes — not just when chartView does.
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
      <div>
        <h2 className="text-heading leading-tight text-[var(--color-depth)]">
          {title}
        </h2>
        <div key={key} className={fixedHeight ? "h-[420px]" : undefined}>
          <FadeSwap>{body}</FadeSwap>
        </div>
      </div>
    </section>
  );
}
