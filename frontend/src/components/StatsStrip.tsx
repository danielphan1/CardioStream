// Stats strip (DASH-08, D-21/D-22) — renders the GET /stats/summary payload
// VERBATIM as accessible tiles. Every number on screen comes straight from
// the `stats` prop: avg/min/max per vital, reading count, and percent per
// category are all computed by the backend (API-02). NO client-side
// arithmetic over readings happens here — the strip must agree with the API
// tile-for-tile (Architectural Responsibility Map).
//
// Note on `latest_reading`: it is part of the StatsSummary payload but is
// NOT a tile — it is the UNFILTERED newest-reading anchor consumed by the
// date presets (lib/dates.ts) and the D-11 EmptyState copy, so it renders
// there, not here.
//
// Presentational only: data is fetched at App level (plan 02-07) and passed
// down. `isLoading` covers the initial load; after first load TanStack
// Query's keepPreviousData prevents blank tiles on filter changes.
//
// 13-11: rewired to the structural reference's icon + label + large value +
// sparkline + status-pill card language (13-UI-SPEC.md Component Language
// item 2). `readings` is a new prop — the sparkline needs the raw per-reading
// series (verbatim, no derivation) that `stats` alone doesn't carry.
import { Activity, Gauge, HeartPulse, ListChecks } from "lucide-react";

import type { BPCategory, Reading, StatsSummary, VitalStats } from "../api/types";
import { categoryColor, CHIP_TEXT } from "../lib/palette";

import StatsSparkline from "./charts/StatsSparkline";

type StatsStripProps = {
  stats: StatsSummary | undefined;
  isLoading: boolean;
  readings: Reading[];
};

/** One vital tile: icon, label, Display avg, sparkline, 18px min/max line,
 *  and (Systolic/Diastolic only) a status pill for the latest category. */
function VitalTile({
  label,
  vital,
  Icon,
  values,
  sparklineColor,
  statusCategory,
}: {
  label: string;
  vital: VitalStats | null;
  Icon: typeof Gauge;
  values: number[];
  sparklineColor: string;
  statusCategory?: BPCategory | null;
}) {
  // count === 0 → VitalStats is null → em dash for ALL THREE values
  // (never 0, never blank — D-22 null contract).
  return (
    <div className="rounded-xl bg-[var(--color-mist)] p-6 shadow-[var(--shadow-elevation)]">
      <Icon aria-hidden="true" size={24} className="text-[var(--color-depth)]" />
      <p className="mt-2 text-label text-[var(--color-depth)]">{label}</p>
      <p className="text-display font-display text-[var(--color-depth)]">
        {vital !== null ? vital.avg : "—"}
      </p>
      <p className="text-[18px] text-[var(--color-depth)]">
        {vital !== null
          ? `min ${vital.min} · max ${vital.max}`
          : "min — · max —"}
      </p>
      {vital !== null && values.length >= 2 && (
        <StatsSparkline values={values} color={sparklineColor} />
      )}
      {statusCategory != null && (
        <span
          className="mt-2 inline-block w-fit rounded-full px-3 py-1 text-[18px]"
          style={{ backgroundColor: categoryColor(statusCategory), color: CHIP_TEXT }}
        >
          {statusCategory}
        </span>
      )}
    </div>
  );
}

/** Skeleton tile for the initial-load state (UI-SPEC loading contract). */
function SkeletonTile() {
  return (
    <div className="animate-pulse rounded-xl bg-[var(--color-mist)] p-6 shadow-[var(--shadow-elevation)]">
      <div className="h-6 w-24 rounded bg-[var(--color-deck)]" />
      <div className="mt-2 h-9 w-16 rounded bg-[var(--color-deck)]" />
      <div className="mt-2 h-5 w-32 rounded bg-[var(--color-deck)]" />
    </div>
  );
}

export function StatsStrip({ stats, isLoading, readings }: StatsStripProps) {
  if (isLoading) {
    return (
      <section
        aria-label="Summary statistics"
        aria-busy="true"
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
          <SkeletonTile />
        </div>
      </section>
    );
  }

  if (stats === undefined) {
    // Not loading and no data: the error surface is centralized in App
    // (plan 02-07, T-02-11) — this component never renders error copy.
    return null;
  }

  // `readings` already arrives oldest-to-newest (backend `ORDER BY
  // datetime_` — readings.py) — sparkline reads left-to-right forward in
  // time for free, no client sort needed.
  const chronological = readings;
  // Drives the status pill — only Systolic/Diastolic show it (BP category is
  // a joint systolic+diastolic classification; Pulse has no AHA category
  // ladder, only a bradycardia reference line; Readings count isn't a vital).
  const latestCategory = chronological.at(-1)?.bp_category ?? null;

  return (
    <section aria-label="Summary statistics" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VitalTile
          label="Systolic"
          vital={stats.systolic}
          Icon={Gauge}
          values={chronological.map((r) => r.systolic)}
          sparklineColor="var(--line-systolic)"
          statusCategory={latestCategory}
        />
        <VitalTile
          label="Diastolic"
          vital={stats.diastolic}
          Icon={Activity}
          values={chronological.map((r) => r.diastolic)}
          sparklineColor="var(--line-diastolic)"
          statusCategory={latestCategory}
        />
        <VitalTile
          label="Pulse"
          vital={stats.pulse}
          Icon={HeartPulse}
          values={chronological.map((r) => r.pulse)}
          sparklineColor="var(--line-systolic)"
          statusCategory={null}
        />
        <div className="rounded-xl bg-[var(--color-mist)] p-6 shadow-[var(--shadow-elevation)]">
          <ListChecks aria-hidden="true" size={24} className="text-[var(--color-depth)]" />
          <p className="mt-2 text-label text-[var(--color-depth)]">Readings</p>
          <p className="text-display font-display text-[var(--color-depth)]">{stats.count}</p>
        </div>
      </div>

      {/* Category percent row — payload order IS clinical order (API-02
          always returns all six labels, zero-filled). Display-only chips:
          the UI-SPEC table-chip exemption allows shorter than 48px. */}
      <ul className="flex flex-wrap gap-2" aria-label="Readings by category">
        {stats.categories.map((c) => (
          <li
            key={c.category}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-mist)] px-4 py-2 text-lg"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(c.category) }}
            />
            {c.category} {c.percent}%
          </li>
        ))}
      </ul>
    </section>
  );
}
