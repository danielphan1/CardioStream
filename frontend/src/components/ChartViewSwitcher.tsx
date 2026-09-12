// Chart view switcher (Phase 14, D-08) — the three-way single-select that
// replaces ChartDeck's hero/mini rotation.
//
// Only three views exist now: the combined timeline, and the two summaries.
// BP Categories and AM vs PM are aggregates over the filtered range, not time
// series, so there is no honest way to overlay them onto the timeline — they
// stay their own views rather than becoming Show-panel checkboxes.
//
// Reuses FilterBar's exact active/inactive class pair so the switcher reads as
// the same control family as the date and AM/PM segments beside it.
import { useEffect, useState } from "react";

import type { ChartView } from "../api/types";
import { useAgentPulse } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import { useFilters } from "../store/filters";

const inactiveClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-mist)] text-[var(--color-depth)] border-2 border-[var(--color-depth)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-brass)] text-[var(--color-brass-text)] border-2 border-[var(--color-brass)]";

const VIEWS: { key: ChartView; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "bp_categories", label: "BP Categories" },
  { key: "am_pm_comparison", label: "AM vs PM" },
];

export function ChartViewSwitcher() {
  const chartView = useFilters((s) => s.chartView);
  const setChartView = useFilters((s) => s.setChartView);

  const pulseSeq = useAgentPulse((s) => s.seq);
  const pulseFields = useAgentPulse((s) => s.fields);
  const [pulsing, setPulsing] = useState<PulseField[]>([]);
  useEffect(() => {
    if (pulseSeq === 0) return;
    setPulsing(pulseFields);
    const t = setTimeout(() => setPulsing([]), 1500);
    return () => clearTimeout(t);
  }, [pulseSeq, pulseFields]);
  const pulseClass = pulsing.includes("chart")
    ? " rounded-lg ring-2 ring-[var(--color-brass)] motion-safe:animate-pulse"
    : "";

  return (
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
  );
}
