// App — the assembled surfaces (D-20/D-22, UI-SPEC §5.0 vertical order):
// AppShell (the left rail at ≥1024px, the slim top bar below it) → Command Bar
// → <main>, whose content each view supplies itself.
//
// Data is wired per DATA VIEW rather than once: each of the two data
// surfaces mounts useResolvedFilters (the zustand filter store → concrete
// query params bridge) plus useReadings/useStats itself. TanStack Query
// dedupes them by key onto one in-flight request and one cache entry, so
// nothing has to be threaded through the shell. Everything below those two
// receives props and stays presentational.
//
// Error presentation is centralized here (T-02-11): only the UI-SPEC copy
// renders — never raw error messages, status codes, or stack traces
// (ApiError details stay in the console at most).
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AddRecordPage } from "./components/AddRecordPage";
import { AssistantPopup } from "./components/AssistantPopup";
import { ChartDeck } from "./components/ChartDeck";
import { ChartViewSwitcher } from "./components/ChartViewSwitcher";
import { EmptyState } from "./components/EmptyState";
import { FilterStateBlock } from "./components/FilterStateBlock";
import { FilterSurface } from "./components/FilterSurface";
import { FilterTriggerRow } from "./components/FilterTriggerRow";
import { GuideOverlay } from "./components/GuideOverlay";
import { LeftRail } from "./components/LeftRail";
import { LoginGate } from "./components/LoginGate";
import { NavPanel } from "./components/NavPanel";
import { OverlayEventsList } from "./components/OverlayEventsList";
import { ReadingsTable } from "./components/ReadingsTable";
import { SlimTopBar } from "./components/SlimTopBar";
import { StatsStrip } from "./components/StatsStrip";
import { UploadPage } from "./components/UploadPage";
import { useClearanceHeight } from "./hooks/useClearanceHeight";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useIncidents, useLabs, useProcedures } from "./hooks/useRecordEvents";
import { useReadings } from "./hooks/useReadings";
import { useResolvedFilters, useStats } from "./hooks/useStats";
import { hasVitals } from "./lib/datasetMeta";
import { presetLabel } from "./lib/dates";
import {
  incidentsToEvents,
  labsToEvents,
  mergeOverlayEvents,
  proceduresToEvents,
} from "./lib/overlayEvents";
import { useAuth } from "./store/auth";
import { useFilters } from "./store/filters";
import { useGuide } from "./store/guide";
import { useView } from "./store/view";

/** The one shell every authenticated view renders inside (UI-SPEC §5.0).
 *  It owns four things no individual view can own correctly on its own:
 *  exactly one navigation surface per breakpoint, one measured top band, one
 *  overlay state, and the `inert` map that keeps the keyboard path honest.
 *
 *  Tree: the rail and the content column are SIBLINGS; the column holds the
 *  measured band, GuideOverlay, the nav panel and <main>, all siblings of
 *  each other. Nothing here nests one of those surfaces under another. */
function AppShell({
  children,
  showCommandBar = false,
  showFilters = false,
  latestReading = null,
}: {
  children: ReactNode;
  /** True on the dashboard only, exactly as today — plan 16.1-09 turns it on
   *  for the Readings view too. */
  showCommandBar?: boolean;
  /** True on the dashboard only: gates the filter cluster at the top of
   *  <main> (the trigger row plus the always-visible D-20 state block). The
   *  upload and records views have no filter state to show. */
  showFilters?: boolean;
  latestReading?: string | null;
}) {
  const guideOpen = useGuide((s) => s.open);
  const setGuideOpen = useGuide((s) => s.setOpen);

  // One state for the three overlays this phase adds — mutually exclusive by
  // construction, so there are no booleans that can desynchronise.
  // Deliberately component state and NOT store/filters.ts (§8): that store is
  // the agent command schema, and transient UI state must never become
  // reachable or mutable by model output.
  const [openOverlay, setOpenOverlay] = useState<
    "nav" | "filters" | "dates" | null
  >(null);
  const anyOverlayOpen = guideOpen || openOverlay !== null;

  // Two queries, named at the point of use, never interchangeable: the first
  // is the rail-vs-slim-bar switch, the second the popover-vs-panel switch
  // (plan 16.1-07 consumes it; it already gates <main> below).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isWide = useMediaQuery("(min-width: 768px)");

  // Mutual exclusion with the guide, REVERSE direction (§5.2 superseding
  // note) — load-bearing, not symmetry for its own sake. The Guide is a
  // control in the top band, which is never made inert, so it stays clickable
  // while a panel covers the content; and lib/agent.ts can open the guide by
  // voice at any moment. Without this, guideOpen and openOverlay === "nav"
  // can coexist, and since both surfaces are fixed on the panel layer over
  // backdrops on the layer beneath, with NavPanel after GuideOverlay in this
  // tree, the nav panel paints over the guide and tapping Guide appears to do
  // nothing. One effect covers every entry point — slim bar, rail and agent —
  // rather than three handlers scattered across the controls. It also closes
  // a ≥768px filter popover when the rail's Guide is used.
  useEffect(() => {
    if (guideOpen) setOpenOverlay(null);
  }, [guideOpen]);

  // Crossing to ≥1024px mounts the rail and unmounts the slim bar, so an
  // already-open nav panel must not be left sitting over a newly visible
  // rail with its trigger gone.
  useEffect(() => {
    if (isDesktop) setOpenOverlay((o) => (o === "nav" ? null : o));
  }, [isDesktop]);

  const shellTopRef = useRef<HTMLDivElement>(null);
  const clearance = useClearanceHeight(shellTopRef);

  function toggleNav() {
    // A second tap on the still-live trigger closes the panel it opened
    // (§5.2 dismiss route (d)). Opening also closes the guide, so the two
    // can never stack.
    setOpenOverlay((o) => (o === "nav" ? null : "nav"));
    setGuideOpen(false);
  }

  // Same mutual-exclusion contract as toggleNav: one overlay state means a
  // filter surface and the guide can never stack. The row owns the
  // second-press-closes case itself, so this only ever opens.
  function openFilterSurface(which: "filters" | "dates") {
    setOpenOverlay(which);
    setGuideOpen(false);
  }

  return (
    <div className="flex min-h-screen">
      {/* The rail's root carries the reassignment of the `inert` that used to
          sit on the deleted horizontal band's wrapper (§5.0): the eight
          controls moved in here, so the attribute moved with them. Without
          it, Tab still walks a keyboard or switch-access user through eight
          invisible, unusable controls before reaching the guide — the rail
          has no stacking offset of its own, so the guide's backdrop covers it
          completely.

          Scoped to the guide alone, deliberately, and NOT to every overlay:
          the nav panel exists only below 1024px where this rail is unmounted,
          the <768px panels likewise never coexist with it, and the ≥768px
          anchored popover deliberately leaves the content behind it live — it
          is a disclosure that covers nothing, so disabling the rail there
          would remove working navigation for no benefit. */}
      {isDesktop && <LeftRail inert={guideOpen} />}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--color-deck)]">
        {/* The ONE measured top band. The Command Bar no longer lives in it
            (quick 261002-kem — it moved into the dismissible AssistantPopup
            below), so below 1024px this is the slim bar alone and at >=1024px
            it measures as empty; either way the ref stays the single source of
            every panel's top offset, the guide's included, and the band goes
            sticky above every overlay layer while an overlay is open.

            This wrapper is NEVER made inert (D-03/D-04): the menu trigger
            inside it must stay live so a second tap closes the panel it
            opened. The mic that used to be the other reason now lives in the
            popup, which is also never made inert — it is a sibling of <main>,
            not a child. */}
        <div
          ref={shellTopRef}
          className={anyOverlayOpen ? "sticky top-0 z-[60]" : undefined}
        >
          {!isDesktop && (
            <SlimTopBar
              menuOpen={openOverlay === "nav"}
              onToggleMenu={toggleNav}
            />
          )}
        </div>
        <GuideOverlay clearanceAbove={clearance} />
        {!isDesktop && (
          <NavPanel
            open={openOverlay === "nav"}
            onClose={() => setOpenOverlay(null)}
            clearanceAbove={clearance}
          />
        )}
        {/* <main> deliberately carries NO layout classes: every view supplies
            its own gutter and spacing wrapper, so this commit changes no
            view's spacing. Its `inert` is UI-SPEC §5.0's table verbatim — the
            guide, the nav panel, and the <768px full-viewport filter/dates
            panels each cover this content, while the ≥768px anchored popover
            covers nothing and leaves it live. The band above is never made
            inert, for the reason stated on it.

            The showFilters-gated cluster below is plan 16.1-07's: its
            gutters match the Command Bar's inner gutters, pt-2 is §5.3's 8px
            below the band (this element has no padding of its own, so
            without it the row would butt against the band at 0px), pb-6 is
            §5.4's 24px above the vitals strip, and the inner gap-2 is
            §5.4's 8px between the trigger row and the state block. Dashboard's
            children wrapper carries bottom padding ONLY, for the same reason:
            a 32px top padding there would stack on this cluster's 24px and
            push the vitals strip 56px down. */}
        <main
          inert={
            guideOpen ||
            openOverlay === "nav" ||
            (openOverlay !== null && !isWide)
          }
        >
          {showFilters && (
            <div className="mx-auto max-w-[1280px] px-4 md:px-8 xl:px-16 pt-2 pb-6">
              <div className="flex flex-col gap-2">
                {/* The trigger row sits ABOVE the sentence it summarises —
                    §5.4's reading order. At ≥768px each trigger carries its
                    own anchored popover; below that the surfaces are the
                    sibling panels further down, outside <main>. */}
                <FilterTriggerRow
                  openOverlay={openOverlay}
                  onOpen={openFilterSurface}
                  onClose={() => setOpenOverlay(null)}
                  isWide={isWide}
                />
                {/* The D-20 state block is rendered HERE, unconditionally and
                    outside every popover (§5.4) — it is how the primary user
                    knows what is applied without opening anything. Do not
                    move it into a disclosure. */}
                <FilterStateBlock latestReading={latestReading} />
              </div>
            </div>
          )}
          {children}
        </main>
        {/* The <768px filter surfaces are SIBLINGS of <main>, never children,
            and that placement is required rather than tidy (§5.0's structure
            table, T-16.1-30): <main> is inert while either is open, so a
            panel rendered inside it would have its own controls disabled.
            The anchored ≥768px popovers are the opposite case — they cover
            nothing, leave the content live, and therefore belong inside
            <main> next to their triggers, where FilterTriggerRow puts them. */}
        {/* The assistant (quick 261002-kem) — the Command Bar plus the agent
            status banner, in a dismissible floating card. Gated on the same
            showCommandBar prop the band used, so it still appears on the
            dashboard and the readings view only. A SIBLING of <main>, never a
            child, for the same reason the filter panels are: <main> goes inert
            under the guide and the nav panel, and the assistant is the primary
            user's main input — it must stay live. Its own dismissed state is
            persisted, so the popup starts closed for anyone who closed it. */}
        {showCommandBar && <AssistantPopup latestReading={latestReading} />}
        {showFilters && !isWide && (
          <>
            <FilterSurface
              kind="filters"
              presentation="panel"
              open={openOverlay === "filters"}
              onClose={() => setOpenOverlay(null)}
              clearanceAbove={clearance}
            />
            <FilterSurface
              kind="dates"
              presentation="panel"
              open={openOverlay === "dates"}
              onClose={() => setOpenOverlay(null)}
              clearanceAbove={clearance}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Skeleton hero + mini placeholders for the initial load only — after
 *  first load keepPreviousData keeps charts on screen (no spinner). */
function ChartSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <div className="h-[clamp(420px,calc(100vh_-_300px),760px)] animate-pulse rounded-xl bg-[var(--color-mist)] shadow-[var(--shadow-elevation)]" />
      <div className="grid gap-8 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-xl bg-[var(--color-mist)] shadow-[var(--shadow-elevation)]" />
        <div className="h-36 animate-pulse rounded-xl bg-[var(--color-mist)] shadow-[var(--shadow-elevation)]" />
        <div className="h-36 animate-pulse rounded-xl bg-[var(--color-mist)] shadow-[var(--shadow-elevation)]" />
      </div>
    </div>
  );
}

/** The ONE fetch-failure surface, shared by both data views (T-02-11).
 *  UI-SPEC §6 pins this copy as "unchanged and centralized in App.tsx", so it
 *  is a component rather than a second literal copy inside the readings
 *  destination: a user-visible string with two homes drifts. Renders UI-SPEC
 *  copy ONLY — no raw error text, status code or stack trace ever reaches the
 *  screen. */
function DataUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-label="Data unavailable"
      className="flex flex-col items-center gap-4 rounded-xl bg-[var(--color-mist)] p-8 text-center shadow-[var(--shadow-elevation)]"
    >
      <h2 className="text-heading leading-tight">Couldn't load the readings</h2>
      <p className="text-base">
        The dashboard couldn't reach the data server. It will keep retrying. You
        can also press Try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-12 rounded-xl bg-[var(--color-accent)] px-6 text-label text-[var(--color-accent-text)]"
      >
        Try again
      </button>
    </section>
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
  const visibleDatasets = useFilters((s) => s.visibleDatasets);
  const dateWindow = { start_date: resolved.start_date, end_date: resolved.end_date };
  const labs = useLabs(dateWindow, visibleDatasets.labs);
  const incidents = useIncidents(dateWindow, visibleDatasets.incidents);
  const procedures = useProcedures(dateWindow, visibleDatasets.procedures);

  // Gated on the toggle flag, not just query state (Gap 1 / CR-1 fix):
  // TanStack Query's `enabled: false` stops future fetches but does NOT
  // clear previously-cached `data`, so toggling a dataset off while another
  // stays on must short-circuit to [] here rather than trusting labs.data
  // to already be empty. useMemo also restores referential stability across
  // unrelated re-renders (WR-2) since Query keeps `.data` stable via
  // structural sharing when content is unchanged.
  const labsEvents = useMemo(
    () => (visibleDatasets.labs ? labsToEvents(labs.data ?? []) : []),
    [visibleDatasets.labs, labs.data],
  );
  const incidentsEvents = useMemo(
    () => (visibleDatasets.incidents ? incidentsToEvents(incidents.data ?? []) : []),
    [visibleDatasets.incidents, incidents.data],
  );
  const proceduresEvents = useMemo(
    () => (visibleDatasets.procedures ? proceduresToEvents(procedures.data ?? []) : []),
    [visibleDatasets.procedures, procedures.data],
  );
  const overlayEvents = useMemo(
    () => mergeOverlayEvents(labsEvents, incidentsEvents, proceduresEvents),
    [labsEvents, incidentsEvents, proceduresEvents],
  );

  // EmptyState copy inputs (D-11) — read from the same store the charts use.
  const datePreset = useFilters((s) => s.datePreset);
  const timeOfDay = useFilters((s) => s.timeOfDay);
  const bpCategory = useFilters((s) => s.bpCategory);
  const pulseCategory = useFilters((s) => s.pulseCategory);

  // UNFILTERED newest reading — the honest preset anchor (D-20) and the
  // D-11 EmptyState anchor. latest_reading is unfiltered in EVERY response.
  const latestReading = stats.data?.latest_reading ?? null;

  const initialPending = readings.isPending || stats.isPending;
  const hasError = readings.isError || stats.isError;

  // The chart region only consumes `readings` when it is plotting a vitals
  // series or a summary chart. In the events-only and nothing-selected states
  // it does not, so a zero-reading range must not suppress it (CR-01).
  const chartView = useFilters((s) => s.chartView);
  const regionNeedsReadings =
    chartView !== "timeline" || hasVitals(visibleDatasets);
  // Where the chart slot IS the event list, OverlayEventsList below would
  // repeat the same rows under a second heading — announced twice to a screen
  // reader (CR-02).
  const eventsAreTheChart =
    chartView === "timeline" && !hasVitals(visibleDatasets);

  let chartRegion: ReactNode;
  if (initialPending) {
    chartRegion = <ChartSkeleton />;
  } else if (hasError) {
    chartRegion = (
      <DataUnavailable
        onRetry={() => {
          void readings.refetch();
          void stats.refetch();
        }}
      />
    );
  } else if ((readings.data ?? []).length === 0 && regionNeedsReadings) {
    // Zero-result filters → guided empty state in place of the deck (D-11);
    // the FilterBar above stays visible so the user can adjust.
    //
    // `regionNeedsReadings` is load-bearing (CR-01). Before Phase 14 the chart
    // region always needed blood-pressure readings, so a bare length check was
    // right. It isn't any more: with no vitals selected the region renders the
    // event list or the pick-something prompt, neither of which reads
    // `readings`. Without the guard, asking for hospital stays over a window
    // with no BP readings — exactly the periods worth looking at — showed
    // "no readings" and hid the events entirely.
    chartRegion = (
      <EmptyState
        latestReading={latestReading}
        timeOfDay={timeOfDay}
        bpCategory={bpCategory}
        pulseCategory={pulseCategory}
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
    <AppShell showCommandBar showFilters latestReading={latestReading}>
      {/* Page gutters 16px / 32px (≥768px) / 64px (≥1280px); single column
          (UI-SPEC responsive). One wrapper cluster now — the visualizations
          (vitals strip, view switcher, chart region) — with the overlay-event
          detail list a sibling 48px below it. The tabular records moved to
          their own rail destination in 16.1-09 (§5.8), which is the last
          piece of this phase's vertical-length reduction.

          Inside the cluster: the 32px cluster rhythm falls below the vitals
          strip, and an inner 24px wrapper pairs the view switcher with the
          chart it switches (§5.7's two spacing deltas, expressed on-scale
          with no negative margin).

          The old full-width controls band that opened this column is gone
          (16.1-07): the four control groups now live in the shell's trigger
          row above, reachable only through FilterSurface.

          Bottom padding ONLY, no top padding: the shell's filter cluster
          above already supplies §5.4's 24px below the state block, and a 32px
          top padding here would stack on it and put the vitals strip 56px
          down instead. */}
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 pb-8 md:px-8 xl:px-16">
        <div className="flex flex-col gap-8">
          <StatsStrip stats={stats.data} isLoading={stats.isPending} />
          <div className="flex flex-col gap-6">
            <ChartViewSwitcher />
            {chartRegion}
          </div>
        </div>
        {/* The event list is now a direct child of the 48px cluster gap: the
            wrapper that used to pair it with the tabular records has nothing
            left to pair it with, and dropping it leaves this element's own
            spacing untouched while removing the empty 48px tail the wrapper
            left behind in the suppressed case.

            Suppressed when the chart slot has itself become the event list —
            see eventsAreTheChart (CR-02). */}
        {!eventsAreTheChart && (
          <OverlayEventsList
            labs={{ enabled: visibleDatasets.labs, events: labsEvents, isError: labs.isError }}
            incidents={{
              enabled: visibleDatasets.incidents,
              events: incidentsEvents,
              isError: incidents.isError,
            }}
            procedures={{
              enabled: visibleDatasets.procedures,
              events: proceduresEvents,
              isError: procedures.isError,
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

/** The Readings destination (UI-SPEC §5.8) — the filtered table on its own
 *  surface rather than pinned below the chart. The rail has offered this item
 *  since plan 16.1-03 and the View union has accepted the value since then;
 *  this is the renderer it was waiting for.
 *
 *  THE FILTER CLUSTER IS NOT OPTIONAL HERE (T-16.1-39). The trigger row and
 *  the always-visible state block both arrive from AppShell's showFilters
 *  cluster — the SAME mounted components the dashboard uses, never second
 *  copies, so the DOM still holds exactly one state-block region
 *  (T-16.1-41). They belong on this surface because the table is narrowed by
 *  the same store: without them, a user who narrowed to Stage 2 elsewhere
 *  would land on a silently filtered table and read it as the complete
 *  record of his own blood pressure.
 *
 *  Hooks are mounted here rather than hoisted into the shell — see the file
 *  header for why that costs no extra request. */
function ReadingsView() {
  const resolved = useResolvedFilters();
  const readings = useReadings(resolved);
  const stats = useStats(resolved);

  // The UNFILTERED newest-reading anchor (D-20), exactly as Dashboard takes
  // it: both the Command Bar and the live state block need it, and
  // latest_reading is unfiltered in every stats response.
  const latestReading = stats.data?.latest_reading ?? null;

  return (
    <AppShell showCommandBar showFilters latestReading={latestReading}>
      {/* Same gutters and same bottom-padding-only rule as Dashboard's
          wrapper: the shell's filter cluster above already supplies §5.4's
          24px, so a top padding here would stack on it. */}
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 pb-8 md:px-8 xl:px-16">
        <section aria-label="Readings table">
          <h2 className="mb-4 text-heading leading-tight text-[var(--color-depth)]">
            Readings
          </h2>
          {/* Neither of the two guards below existed when the table sat under
              the chart, because Dashboard's chart region absorbed both states
              for the whole column. On its own surface the table is the only
              thing here, and it renders "Showing all 0 readings" for whatever
              array it is handed — which during a loading or failed fetch is a
              false statement about a person's medical record, on the one
              surface whose entire job is to be the complete record. So the
              table is handed data only once there is data. */}
          {readings.isPending ? (
            <div
              aria-busy="true"
              className="h-[clamp(420px,calc(100vh_-_300px),760px)] animate-pulse rounded-xl bg-[var(--color-mist)] shadow-[var(--shadow-elevation)]"
            />
          ) : readings.isError ? (
            <DataUnavailable onRetry={() => void readings.refetch()} />
          ) : (
            <ReadingsTable readings={readings.data ?? []} />
          )}
        </section>
      </div>
    </AppShell>
  );
}

/** The caregiver upload surface (D-05, post-auth). The shell persists across
 *  every view; UploadPage mounts no data hooks so switching here fires no
 *  fetch. It supplies its own gutter wrapper, so it needs no layout classes
 *  and no Command Bar from the shell. */
function UploadView() {
  return (
    <AppShell>
      <UploadPage />
    </AppShell>
  );
}

/** The caregiver "Add Record" surface (Phase 8, D-01). Same shape as
 *  UploadView — AddRecordPage mounts no read-data hooks so switching here
 *  fires no fetch (only its own POST mutations on submit). */
function RecordsView() {
  return (
    <AppShell>
      <AddRecordPage />
    </AppShell>
  );
}

/** Auth gate (D-01): until a token exists the app renders ONLY the LoginGate —
 *  no shell, no dashboard chrome, and crucially no data hooks mount (the
 *  Dashboard tree is not rendered), so nothing fetches before authentication.
 *  Once authed, a zustand view swap (D-05, no react-router) chooses between the
 *  four rail destinations: the two data views and the two caregiver write
 *  surfaces. The dashboard is the fall-through, so it is also the landing
 *  surface and the recovery target for any unrecognised value. */
function App() {
  const token = useAuth((s) => s.token);
  const view = useView((s) => s.view);
  if (token === null) return <LoginGate />;
  if (view === "upload") return <UploadView />;
  if (view === "records") return <RecordsView />;
  if (view === "readings") return <ReadingsView />;
  return <Dashboard />;
}

export default App;
