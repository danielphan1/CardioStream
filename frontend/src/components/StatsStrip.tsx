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
import type { StatsSummary, VitalStats } from "../api/types";
import { categoryColor } from "../lib/palette";

type StatsStripProps = {
  stats: StatsSummary | undefined;
  isLoading: boolean;
};

/** One vital tile: Label caption, Display avg, 18px min/max line. */
function VitalTile({
  label,
  vital,
}: {
  label: string;
  vital: VitalStats | null;
}) {
  // count === 0 → VitalStats is null → em dash for ALL THREE values
  // (never 0, never blank — D-22 null contract).
  return (
    <div className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
      <p className="text-control leading-tight font-bold">{label}</p>
      <p className="text-h1 leading-tight font-bold">
        {vital !== null ? vital.avg : "—"}
      </p>
      <p className="text-lg">
        {vital !== null
          ? `min ${vital.min} · max ${vital.max}`
          : "min — · max —"}
      </p>
    </div>
  );
}

/** Skeleton tile for the initial-load state (UI-SPEC loading contract). */
function SkeletonTile() {
  return (
    <div className="animate-pulse rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
      <div className="h-6 w-24 rounded bg-[var(--color-foam)]" />
      <div className="mt-2 h-9 w-16 rounded bg-[var(--color-foam)]" />
      <div className="mt-2 h-5 w-32 rounded bg-[var(--color-foam)]" />
    </div>
  );
}

export function StatsStrip({ stats, isLoading }: StatsStripProps) {
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

  return (
    <section aria-label="Summary statistics" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VitalTile label="Systolic" vital={stats.systolic} />
        <VitalTile label="Diastolic" vital={stats.diastolic} />
        <VitalTile label="Pulse" vital={stats.pulse} />
        <div className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
          <p className="text-control leading-tight font-bold">Readings</p>
          <p className="text-h1 leading-tight font-bold">{stats.count}</p>
        </div>
      </div>

      {/* Category percent row — payload order IS clinical order (API-02
          always returns all six labels, zero-filled). Display-only chips:
          the UI-SPEC table-chip exemption allows shorter than 48px. */}
      <ul className="flex flex-wrap gap-2" aria-label="Readings by category">
        {stats.categories.map((c) => (
          <li
            key={c.category}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-sky)] px-4 py-2 text-lg"
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
