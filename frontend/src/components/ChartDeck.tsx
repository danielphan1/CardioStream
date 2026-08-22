/**
 * ChartDeck — hero slot + three live mini buttons + animated rotation
 * (D-02/D-03/D-04, RESEARCH Pattern 4, Pitfall 8).
 *
 * - Registry covers all four ChartIds in fixed order; `activeChart` (zustand)
 *   picks the hero, the OTHER three render as minis in registry order.
 * - Each mini is ONE <button> — the whole card is the ≥48px target, with a
 *   `pointer-events-none` wrapper around the chart so the button handles
 *   activation (minis already ship accessibilityLayer off, no Tooltip).
 * - Swap = 250ms opacity + scale transition on the two affected slots only:
 *   the hero wrapper is keyed on `activeChart` and each mini's fade wrapper
 *   is keyed by chart id, so only remounting slots animate. Under
 *   `prefers-reduced-motion` the swap is instant (motion-reduce).
 * - `stats` arrives as `StatsSummary | undefined` — App only renders the deck
 *   after both queries succeed, so the CategoryBars guard below is type
 *   narrowing, not a reachable UI state.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { ChartId, Reading, StatsSummary } from "../api/types";
import type { OverlayEvent } from "../lib/overlayEvents";
import { useFilters } from "../store/filters";

import AmPmComparison from "./charts/AmPmComparison";
import BPTimeline from "./charts/BPTimeline";
import CategoryBars from "./charts/CategoryBars";
import PulseTrend from "./charts/PulseTrend";

export type ChartDeckProps = {
  readings: Reading[];
  stats: StatsSummary | undefined;
  overlayEvents?: OverlayEvent[];
};

type ChartEntry = {
  id: ChartId;
  /** Visible 20px mini-card title (UI-SPEC mini-card labels). */
  title: string;
  /** Fills `aria-label="Show {ariaName} chart"`. */
  ariaName: string;
  hero: (data: ChartDeckProps) => ReactNode;
  mini: (data: ChartDeckProps) => ReactNode;
};

// Fixed registry order — minis always render in this order (Pattern 4).
const CHART_REGISTRY: readonly ChartEntry[] = [
  {
    id: "bp_timeline",
    title: "Blood Pressure",
    ariaName: "blood pressure",
    hero: ({ readings, overlayEvents }) => (
      <BPTimeline readings={readings} variant="hero" overlayEvents={overlayEvents} />
    ),
    mini: ({ readings, overlayEvents }) => (
      <BPTimeline readings={readings} variant="mini" overlayEvents={overlayEvents} />
    ),
  },
  {
    id: "pulse_trend",
    title: "Pulse",
    ariaName: "pulse trend",
    hero: ({ readings, overlayEvents }) => (
      <PulseTrend readings={readings} variant="hero" overlayEvents={overlayEvents} />
    ),
    mini: ({ readings, overlayEvents }) => (
      <PulseTrend readings={readings} variant="mini" overlayEvents={overlayEvents} />
    ),
  },
  {
    id: "bp_categories",
    title: "BP Categories",
    ariaName: "BP categories",
    // Type-narrowing guard: App renders the deck only after stats succeed.
    hero: ({ stats }) =>
      stats === undefined ? null : <CategoryBars stats={stats} variant="hero" />,
    mini: ({ stats }) =>
      stats === undefined ? null : <CategoryBars stats={stats} variant="mini" />,
  },
  {
    id: "am_pm_comparison",
    title: "AM vs PM",
    ariaName: "AM vs PM comparison",
    hero: ({ readings }) => (
      <AmPmComparison readings={readings} variant="hero" />
    ),
    mini: ({ readings }) => (
      <AmPmComparison readings={readings} variant="mini" />
    ),
  },
];

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

export function ChartDeck({ readings, stats, overlayEvents }: ChartDeckProps) {
  const activeChart = useFilters((s) => s.activeChart);
  const setActiveChart = useFilters((s) => s.setActiveChart);

  // Default hero is bp_timeline via the store default (D-03).
  const active =
    CHART_REGISTRY.find((c) => c.id === activeChart) ?? CHART_REGISTRY[0];
  const minis = CHART_REGISTRY.filter((c) => c.id !== active.id);
  const data: ChartDeckProps = { readings, stats, overlayEvents };

  return (
    <section aria-label="Charts" className="flex flex-col gap-6">
      {/* Hero slot — parent supplies the fixed height (Pitfall 2). Keyed on
          the active chart so a rotation remounts (and fades) only the hero. */}
      <div>
        <h2 className="text-2xl leading-tight font-bold text-[var(--color-ink)]">
          {active.title}
        </h2>
        <div key={active.id} className="h-[420px]">
          <FadeSwap>{active.hero(data)}</FadeSwap>
        </div>
      </div>

      {/* Mini row — the other three charts, 3-across ≥768px, stacked below.
          Unaffected minis keep their keys (no remount, no fade); only the
          former hero mounts fresh and fades in. */}
      <div className="grid gap-6 md:grid-cols-3">
        {minis.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-label={`Show ${entry.ariaName} chart`}
            onClick={() => setActiveChart(entry.id)}
            className="min-h-12 rounded-lg bg-[var(--color-sky)] p-4 text-left"
          >
            <span className="block text-[20px] font-bold text-[var(--color-ink)]">
              {entry.title}
            </span>
            {/* Pitfall 8: the button handles activation — the chart is a
                non-interactive preview behind pointer-events-none. */}
            <div aria-hidden="true" className="pointer-events-none h-36">
              <FadeSwap>{entry.mini(data)}</FadeSwap>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
