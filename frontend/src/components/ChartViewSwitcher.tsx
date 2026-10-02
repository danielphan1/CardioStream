// Chart view switcher (Phase 14, D-08) — the three-way single-select that
// replaces ChartDeck's hero/mini rotation.
//
// Only three views exist now: the combined timeline, and the two summaries.
// Both summaries are aggregates over the filtered range, not time series, so
// there is no honest way to overlay them onto the timeline — they stay their
// own views rather than becoming Show-panel checkboxes. Their three labels are
// declared exactly once, in the table below, and the plan greps this file for
// exactly three lines carrying them: name the concept in these comments, never
// the button copy.
//
// IT IS NOT A FILTER (16.1-09, UI-SPEC section 5.7). Everything else that used
// to sit on this row moved into the filter popover; this stayed, because the
// chart view is a property of the chart and store/filters.ts already holds
// chartView separately from the filter groups. Do not move it in there.
//
// Reuses FilterBar's exact active/inactive class pair, and takes its visible
// label prefix from the same place, so a standalone row still reads as one
// member of the control family rather than three unnamed buttons. The groups
// it used to sit beside are now behind the two triggers above it.
import type { ChartView } from "../api/types";
import { useAgentPulseFlash } from "../lib/agent";
import { useFilters } from "../store/filters";

const inactiveClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-mist)] text-[var(--color-depth)] border-2 border-[var(--color-depth)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";

const VIEWS: { key: ChartView; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "bp_categories", label: "BP Categories" },
  { key: "am_pm_comparison", label: "AM vs PM" },
];

export function ChartViewSwitcher() {
  const chartView = useFilters((s) => s.chartView);
  const setChartView = useFilters((s) => s.setChartView);

  const pulsing = useAgentPulseFlash();
  const pulseClass = pulsing.includes("chart")
    ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
    : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-label text-[var(--color-depth)]">View:</span>
      {/* The prefix is a SIBLING of the group, not inside it: the group's
          accessible name is unchanged, and the pulse ring still wraps the
          buttons only rather than the label too. */}
      <div
        role="group"
        aria-label="Chart view"
        className={`flex flex-wrap gap-2${pulseClass}`}
      >
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={chartView === key}
            onClick={() => setChartView(key)}
            className={chartView === key ? activeClass : inactiveClass}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
