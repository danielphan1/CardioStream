// App — the assembled dashboard (D-20/D-22, UI-SPEC vertical order):
// Header → FilterBar → StatsStrip → chart region → ReadingsTable.
//
// Data is wired ONCE here: useResolvedFilters bridges the zustand filter
// store into concrete query params; useReadings/useStats fetch; everything
// below receives props and stays presentational.
//
// Error presentation is centralized here (T-02-11): only the UI-SPEC copy
// renders — never raw error messages, status codes, or stack traces
// (ApiError details stay in the console at most).
import type { ReactNode } from "react";

import { ChartDeck } from "./components/ChartDeck";
import { EmptyState } from "./components/EmptyState";
import { FilterBar } from "./components/FilterBar";
import { Header } from "./components/Header";
import { ReadingsTable } from "./components/ReadingsTable";
import { StatsStrip } from "./components/StatsStrip";
import { useReadings } from "./hooks/useReadings";
import { useResolvedFilters, useStats } from "./hooks/useStats";
import { presetLabel } from "./lib/dates";
import { useFilters } from "./store/filters";

/** Skeleton hero + mini placeholders for the initial load only — after
 *  first load keepPreviousData keeps charts on screen (no spinner). */
function ChartSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="h-[420px] animate-pulse rounded-lg bg-[var(--color-sky)]" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-lg bg-[var(--color-sky)]" />
        <div className="h-36 animate-pulse rounded-lg bg-[var(--color-sky)]" />
        <div className="h-36 animate-pulse rounded-lg bg-[var(--color-sky)]" />
      </div>
    </div>
  );
}

function App() {
  const resolved = useResolvedFilters();
  const readings = useReadings(resolved);
  const stats = useStats(resolved);

  // EmptyState copy inputs (D-11) — read from the same store the charts use.
  const datePreset = useFilters((s) => s.datePreset);
  const amPm = useFilters((s) => s.amPm);
  const bpCategory = useFilters((s) => s.bpCategory);

  // UNFILTERED newest reading — the honest preset anchor (D-20) and the
  // D-11 EmptyState anchor. latest_reading is unfiltered in EVERY response.
  const latestReading = stats.data?.latest_reading ?? null;

  const initialPending = readings.isPending || stats.isPending;
  const hasError = readings.isError || stats.isError;

  let chartRegion: ReactNode;
  if (initialPending) {
    chartRegion = <ChartSkeleton />;
  } else if (hasError) {
    // UI-SPEC error copy ONLY (T-02-11) — no raw error text ever renders.
    chartRegion = (
      <section
        aria-label="Data unavailable"
        className="flex flex-col items-center gap-4 rounded-lg bg-[var(--color-sky)] p-8 text-center"
      >
        <h2 className="text-2xl leading-tight font-bold">
          Couldn't load the readings
        </h2>
        <p className="text-lg">
          The dashboard couldn't reach the data server. It will keep retrying
          — or press Try again.
        </p>
        <button
          type="button"
          onClick={() => {
            void readings.refetch();
            void stats.refetch();
          }}
          className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)]"
        >
          Try again
        </button>
      </section>
    );
  } else if ((readings.data ?? []).length === 0) {
    // Zero-result filters → guided empty state in place of the deck (D-11);
    // the FilterBar above stays visible so the user can adjust.
    chartRegion = (
      <EmptyState
        latestReading={latestReading}
        amPm={amPm}
        bpCategory={bpCategory}
        presetLabel={presetLabel(datePreset)}
      />
    );
  } else {
    chartRegion = <ChartDeck readings={readings.data ?? []} stats={stats.data} />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      {/* Page gutters 16px / 32px (≥768px) / 64px (≥1280px); 32px vertical
          rhythm between sections; single column (UI-SPEC responsive). */}
      <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 md:px-8 xl:px-16">
        <FilterBar latestReading={latestReading} />
        <StatsStrip stats={stats.data} isLoading={stats.isPending} />
        {chartRegion}
        <section aria-label="Readings table">
          <h2 className="mb-4 text-2xl leading-tight font-bold text-[var(--color-ink)]">
            Readings
          </h2>
          <ReadingsTable readings={readings.data ?? []} />
        </section>
      </main>
    </div>
  );
}

export default App;
