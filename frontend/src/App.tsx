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
import { useMemo } from "react";
import type { ReactNode } from "react";

import { AddRecordPage } from "./components/AddRecordPage";
import { AgentStatusBanner } from "./components/AgentStatusBanner";
import { ChartDeck } from "./components/ChartDeck";
import { CommandBar } from "./components/CommandBar";
import { EmptyState } from "./components/EmptyState";
import { FilterBar } from "./components/FilterBar";
import { Header } from "./components/Header";
import { LoginGate } from "./components/LoginGate";
import { OverlayEventsList } from "./components/OverlayEventsList";
import { OverlayToggle } from "./components/OverlayToggle";
import { ReadingsTable } from "./components/ReadingsTable";
import { StatsStrip } from "./components/StatsStrip";
import { UploadPage } from "./components/UploadPage";
import { useIncidents } from "./hooks/useIncidents";
import { useLabs } from "./hooks/useLabs";
import { useProcedures } from "./hooks/useProcedures";
import { useReadings } from "./hooks/useReadings";
import { useResolvedFilters, useStats } from "./hooks/useStats";
import { presetLabel } from "./lib/dates";
import {
  incidentsToEvents,
  labsToEvents,
  mergeOverlayEvents,
  proceduresToEvents,
} from "./lib/overlayEvents";
import { useAuth } from "./store/auth";
import { useFilters } from "./store/filters";
import { useView } from "./store/view";

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

/** The authenticated dashboard. Extracted from App so that ALL data hooks
 *  (useReadings/useStats via useResolvedFilters) live behind the auth gate —
 *  when there is no token this component never mounts, so no request fires
 *  before authentication (D-01, T-05-10). */
function Dashboard() {
  const resolved = useResolvedFilters();
  const readings = useReadings(resolved);
  const stats = useStats(resolved);

  // Overlay data (OVERLAY-03/04/05/06) — fetched only when the matching
  // toggle is on, keyed narrowly on { start_date, end_date } (T-09-06: the
  // overlay endpoints have no server-side effect for am_pm/bp_category, so
  // never key/gate on the full `resolved` object).
  const overlayDatasets = useFilters((s) => s.overlayDatasets);
  const dateWindow = { start_date: resolved.start_date, end_date: resolved.end_date };
  const labs = useLabs(dateWindow, overlayDatasets.labs);
  const incidents = useIncidents(dateWindow, overlayDatasets.incidents);
  const procedures = useProcedures(dateWindow, overlayDatasets.procedures);

  // Gated on the toggle flag, not just query state (Gap 1 / CR-1 fix):
  // TanStack Query's `enabled: false` stops future fetches but does NOT
  // clear previously-cached `data`, so toggling a dataset off while another
  // stays on must short-circuit to [] here rather than trusting labs.data
  // to already be empty. useMemo also restores referential stability across
  // unrelated re-renders (WR-2) since Query keeps `.data` stable via
  // structural sharing when content is unchanged.
  const labsEvents = useMemo(
    () => (overlayDatasets.labs ? labsToEvents(labs.data ?? []) : []),
    [overlayDatasets.labs, labs.data],
  );
  const incidentsEvents = useMemo(
    () => (overlayDatasets.incidents ? incidentsToEvents(incidents.data ?? []) : []),
    [overlayDatasets.incidents, incidents.data],
  );
  const proceduresEvents = useMemo(
    () => (overlayDatasets.procedures ? proceduresToEvents(procedures.data ?? []) : []),
    [overlayDatasets.procedures, procedures.data],
  );
  const overlayEvents = useMemo(
    () => mergeOverlayEvents(labsEvents, incidentsEvents, proceduresEvents),
    [labsEvents, incidentsEvents, proceduresEvents],
  );

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
    chartRegion = (
      <ChartDeck
        readings={readings.data ?? []}
        stats={stats.data}
        overlayEvents={overlayEvents}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      {/* Command bar (D-01) — full-width sky band under the header, top billing
          for the primary control. Inner div matches main's content-column
          gutters so the input aligns with the dashboard below. Phase 4 mounts
          the mic button into this same bar. */}
      <section className="bg-[var(--color-sky)]">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 xl:px-16">
          <CommandBar latestReading={latestReading} />
          <AgentStatusBanner />
        </div>
      </section>
      {/* Page gutters 16px / 32px (≥768px) / 64px (≥1280px); 32px vertical
          rhythm between sections; single column (UI-SPEC responsive). */}
      <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 md:px-8 xl:px-16">
        <FilterBar latestReading={latestReading} />
        <OverlayToggle />
        <StatsStrip stats={stats.data} isLoading={stats.isPending} />
        {chartRegion}
        <section aria-label="Readings table">
          <h2 className="mb-4 text-2xl leading-tight font-bold text-[var(--color-ink)]">
            Readings
          </h2>
          <ReadingsTable readings={readings.data ?? []} />
        </section>
        <OverlayEventsList
          labs={{ enabled: overlayDatasets.labs, events: labsEvents, isError: labs.isError }}
          incidents={{
            enabled: overlayDatasets.incidents,
            events: incidentsEvents,
            isError: incidents.isError,
          }}
          procedures={{
            enabled: overlayDatasets.procedures,
            events: proceduresEvents,
            isError: procedures.isError,
          }}
        />
      </main>
    </div>
  );
}

/** The caregiver upload surface (D-05, post-auth). The Header persists across
 *  both views; UploadPage mounts no data hooks so switching here fires no fetch.
 *  Foam background matches the dashboard's min-h-screen wrapper. */
function UploadView() {
  return (
    <div className="min-h-screen bg-[var(--color-foam)]">
      <Header />
      <UploadPage />
    </div>
  );
}

/** The caregiver "Add Record" surface (Phase 8, D-01). Same wrapper shape as
 *  UploadView — Header persists, AddRecordPage mounts no read-data hooks so
 *  switching here fires no fetch (only its own POST mutations on submit). */
function RecordsView() {
  return (
    <div className="min-h-screen bg-[var(--color-foam)]">
      <Header />
      <AddRecordPage />
    </div>
  );
}

/** Auth gate (D-01): until a token exists the app renders ONLY the LoginGate —
 *  no header, no dashboard chrome, and crucially no data hooks mount (the
 *  Dashboard tree is not rendered), so nothing fetches before authentication.
 *  Once authed, a zustand view swap (D-05, no react-router) chooses between the
 *  dashboard and the caregiver upload/records pages. */
function App() {
  const token = useAuth((s) => s.token);
  const view = useView((s) => s.view);
  if (token === null) return <LoginGate />;
  if (view === "upload") return <UploadView />;
  if (view === "records") return <RecordsView />;
  return <Dashboard />;
}

export default App;
