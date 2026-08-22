---
phase: 09-multi-dataset-overlay-filtering
plan: 03
subsystem: api
tags: [tanstack-query, react-query, typescript, overlay, labs, incidents, procedures]

# Dependency graph
requires:
  - phase: 09-multi-dataset-overlay-filtering (plan 02)
    provides: getLabs/getIncidents/getProcedures API client wrappers, LabResult/Incident/Procedure/OverlayDataset types, overlayMeta.ts's OVERLAY_ORDER/OVERLAY_META
provides:
  - useLabs(window, enabled) / useIncidents(window, enabled) / useProcedures(window, enabled) — lazy, narrowly-keyed TanStack Query read hooks
  - useCreateLab/useCreateIncident/useCreateProcedure cache invalidation on success
  - lib/overlayEvents.ts — pure OverlayEvent shaping (labsToEvents/incidentsToEvents/proceduresToEvents/mergeOverlayEvents) + copy builders (buildEmptyMessage/buildErrorMessage/buildOverlaySentence)
affects: [09-04 (accessible OverlayEventsList table), 09-05 (BPTimeline/PulseTrend chart markers), 09-06 (voice toggle wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy TanStack Query hooks with an explicit `enabled` boolean param, narrowly keyed on { start_date, end_date } instead of the full ResolvedFilters — avoids cache fragmentation when the backend filter surface is narrower than the frontend's"
    - "Mutation onSuccess cache invalidation via useQueryClient().invalidateQueries — surfaces newly created records without waiting out staleTime"
    - "Pure data-shaping module (no React/Recharts imports) unit-tested independently of rendering, mirroring chartData.ts's established convention"

key-files:
  created:
    - frontend/src/hooks/useLabs.ts
    - frontend/src/hooks/useIncidents.ts
    - frontend/src/hooks/useProcedures.ts
    - frontend/src/lib/overlayEvents.ts
    - frontend/src/lib/overlayEvents.test.ts
  modified:
    - frontend/src/hooks/useCreateRecord.ts

key-decisions:
  - "incidentsToEvents' dateCell reuses lib/dates.ts's fmtLongDate (comma-joined with a separately computed toLocaleTimeString) rather than duplicating the long-date formatting logic inline"
  - "buildEmptyMessage/buildOverlaySentence both source their fixed labs→incidents→procedures ordering from overlayMeta.ts's existing OVERLAY_ORDER constant rather than re-declaring the order"

patterns-established:
  - "Pattern: overlay read hooks gate on `enabled` and key on DateWindow only — any future 4th overlay dataset should follow this exact useLabs.ts shape"

requirements-completed: [OVERLAY-04, OVERLAY-06]

# Metrics
duration: 20min
completed: 2026-08-21
---

# Phase 09 Plan 03: Overlay Data Layer Summary

**Three lazy, narrowly-keyed TanStack Query hooks (useLabs/useIncidents/useProcedures) with create-mutation cache invalidation, plus a pure, fully-unit-tested lib/overlayEvents.ts that shapes LabResult/Incident/Procedure arrays into one merged, sorted OverlayEvent[] and the UI-SPEC copy strings.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-21T22:26:44Z (per STATE.md Phase 09 execution start)
- **Completed:** 2026-08-22T01:55:00Z
- **Tasks:** 2 completed
- **Files modified:** 6 (4 created, 1 modified, 1 test file created)

## Accomplishments
- `useLabs`/`useIncidents`/`useProcedures` fetch only when their overlay toggle is on (`enabled` param), keyed on `{ start_date, end_date }` only — matches the backend's actual `LabFilters`/`IncidentFilters`/`ProcedureFilters` surface, avoiding needless refetches on AM/PM or category filter changes
- `useCreateRecord.ts`'s three mutations now invalidate their matching overlay query key on success, so Phase 8's manual-entry forms surface new records in the overlay immediately rather than after a 5-minute stale wait
- `lib/overlayEvents.ts` implements the full pure API (labs/incidents/procedures → `OverlayEvent[]`, merge+sort, empty/error/sentence copy builders) with the date-only Pitfall 1 bug avoided by construction — 23 passing unit tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Overlay read hooks + create-mutation cache invalidation** - `9835133` (feat)
2. **Task 2: Pure overlay-event shaping — lib/overlayEvents.ts + test** - `c66ff5a` (test, RED) → `1373c36` (feat, GREEN)

**Plan metadata:** committed by orchestrator after worktree merge (worktree mode — STATE.md/ROADMAP.md updates excluded per execution contract)

## Files Created/Modified
- `frontend/src/hooks/useLabs.ts` - `useLabs(window, enabled)` TanStack Query hook mirroring useReadings.ts, gated + narrowly keyed
- `frontend/src/hooks/useIncidents.ts` - `useIncidents(window, enabled)` — identical shape, `getIncidents`/`"incidents"` key
- `frontend/src/hooks/useProcedures.ts` - `useProcedures(window, enabled)` — identical shape, `getProcedures`/`"procedures"` key
- `frontend/src/hooks/useCreateRecord.ts` - added `useQueryClient()` + `onSuccess` cache invalidation to all three create mutations
- `frontend/src/lib/overlayEvents.ts` - `OverlayEvent` type, `labsToEvents`/`incidentsToEvents`/`proceduresToEvents`, `mergeOverlayEvents`, `buildEmptyMessage`/`buildErrorMessage`/`buildOverlaySentence`
- `frontend/src/lib/overlayEvents.test.ts` - 23 tests covering every `<behavior>` case in the plan

## Decisions Made
- Reused `lib/dates.ts`'s existing `fmtLongDate` inside `incidentsToEvents` (rather than re-deriving the long-date pattern inline) for `dateCell`'s date component, then appended a separately computed `toLocaleTimeString` with a comma separator per the UI-SPEC's incident date-cell format (distinct from `fmtTooltipTitle`'s middle-dot separator)
- Sourced the fixed labs→incidents→procedures ordering for `buildEmptyMessage`/`buildOverlaySentence` from `overlayMeta.ts`'s existing `OVERLAY_ORDER` constant (created in Plan 09-02) instead of re-declaring a duplicate order array

## Deviations from Plan

None - plan executed exactly as written. `npm ci` was run once at the start of execution to populate the worktree's `frontend/node_modules` (worktrees don't share `node_modules` with the main checkout) — this is standard environment setup, not a plan deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-04 (accessible `OverlayEventsList` table) can consume `lib/overlayEvents.ts`'s merged `OverlayEvent[]` and copy builders directly, plus `useLabs`/`useIncidents`/`useProcedures` for data fetching
- Plan 09-05 (`BPTimeline.tsx`/`PulseTrend.tsx` chart markers) can consume the same `OverlayEvent[]` shape for `ReferenceLine` positioning (`ts` is epoch ms)
- No blockers identified

---
*Phase: 09-multi-dataset-overlay-filtering*
*Completed: 2026-08-21*
