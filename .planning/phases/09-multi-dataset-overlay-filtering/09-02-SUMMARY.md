---
phase: 09-multi-dataset-overlay-filtering
plan: 02
subsystem: ui
tags: [zustand, typescript, react, agent-bridge, design-tokens]

# Dependency graph
requires:
  - phase: 07-records-backend
    provides: GET /labs, /incidents, /procedures routes (start_date/end_date query params)
  - phase: 08-manual-entry-forms
    provides: LabResult/Incident/Procedure types already in api/types.ts
provides:
  - "OverlayDataset union type (single declaration site in api/types.ts)"
  - "AppliedFilters.overlayDataset/overlayState fields (byte-identical mirror of backend Plan 09-01)"
  - "getLabs/getIncidents/getProcedures typed GET wrappers"
  - "OVERLAY_META/OVERLAY_ORDER shared icon/color/glyph map"
  - "overlayDatasets independent multi-select on useFilters store"
  - "applyAgentFilters overlay bridge — voice/text reachable via the single mutation surface"
  - "Three --overlay-* CSS tokens in both themes"
affects: [09-03, 09-04, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent multi-select Record<K, boolean> field on a zustand store (vs. existing single-select string fields)"
    - "Shared static config map (OVERLAY_META) imported by multiple downstream render surfaces instead of inline per-component maps"

key-files:
  created:
    - frontend/src/lib/overlayMeta.ts
  modified:
    - frontend/src/api/types.ts
    - frontend/src/api/client.ts
    - frontend/src/store/filters.ts
    - frontend/src/store/filters.test.ts
    - frontend/src/index.css
    - frontend/src/lib/agent.ts
    - frontend/src/lib/agent.test.ts
    - frontend/src/lib/agent-parity.test.ts

key-decisions:
  - "Followed plan's explicit field-by-field spec verbatim rather than re-deriving from backend/app/agent/schemas.py, since backend Plan 09-01 (parallel wave-1 worktree) has not yet merged into this worktree's base — the plan text already gives the exact byte-identical field names (overlayDataset: DatasetToken | None, overlayState: Literal['on','off'] | None), confirmed by reading 09-01-PLAN.md's own task spec for consistency"

patterns-established:
  - "Overlay dataset multi-select pattern: Record<OverlayDataset, boolean> + single mutator taking (dataset, on) — the template Plans 09-04/09-05 will consume for toggle UI and chart markers"

requirements-completed: [OVERLAY-03, OVERLAY-04]

# Metrics
duration: ~20min
completed: 2026-08-21
---

# Phase 09 Plan 02: Frontend Overlay Wire Contract & Store Multi-Select Summary

**OverlayDataset union + AppliedFilters mirror, three typed GET wrappers, an independent overlayDatasets multi-select on the zustand filter store, the applyAgentFilters overlay bridge, and locked --overlay-* color tokens in both themes — the shared interface every later Phase 9 plan builds against.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-21
- **Tasks:** 3/3 completed
- **Files modified:** 8 modified, 1 created

## Accomplishments
- Established the single-declaration-site `OverlayDataset` union and extended `AppliedFilters` with `overlayDataset`/`overlayState`, byte-identical to backend Plan 09-01's field names and ordering
- Added `getLabs`/`getIncidents`/`getProcedures` typed GET wrappers mirroring the existing `getReadings` pattern, verified against the real `LabFilters`/`IncidentFilters`/`ProcedureFilters` query-param names (`start_date`/`end_date`) in `backend/app/deps.py`
- Created `overlayMeta.ts` — the single shared icon/color/glyph map (FlaskConical/AlertTriangle/ClipboardList from `lucide-react`, verified present in the installed package) that Plans 09-04/09-05 will import
- Added `overlayDatasets: Record<OverlayDataset, boolean>` as an independent multi-select field on `useFilters`, defaulting to all-`false`, with `setOverlayDataset` mutating exactly one flag and `showAllData` resetting all three (D-01/D-07/D-08)
- Extended `applyAgentFilters` with a new overlay branch (`overlayDataset != null && overlayState != null` guard requiring both fields together) reaching `setOverlayDataset` and pulsing the new `"overlay"` `PulseField`
- Extended `agent-parity.test.ts`'s mandatory structural gate (`STORE_ACTIONS`/`CASES`) so `setOverlayDataset` is proven voice-reachable — the build-breaking "covered actions equal the store's full mutating-action surface" assertion is green

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire contract — api/types.ts, api/client.ts, lib/overlayMeta.ts** - `d228155` (feat)
2. **Task 2: Store multi-select — store/filters.ts + store/filters.test.ts + index.css tokens** - `6e8feef` (feat)
3. **Task 3: Agent bridge — lib/agent.ts + lib/agent.test.ts + lib/agent-parity.test.ts** - `cc2ebb7` (feat)

_No plan-metadata commit yet — this executor does not update STATE.md/ROADMAP.md (orchestrator owns those after the wave)._

## Files Created/Modified
- `frontend/src/api/types.ts` - `OverlayDataset` union (single declaration site) + `AppliedFilters.overlayDataset`/`.overlayState`
- `frontend/src/api/client.ts` - `DateWindow` type + `getLabs`/`getIncidents`/`getProcedures` GET wrappers
- `frontend/src/lib/overlayMeta.ts` - `OVERLAY_META`/`OVERLAY_ORDER` shared icon/color/glyph map (new file)
- `frontend/src/store/filters.ts` - `overlayDatasets` field + `setOverlayDataset` action; `showAllData` resets it
- `frontend/src/store/filters.test.ts` - overlay multi-select tests (independence, toggle-off) + extended `showAllData` test
- `frontend/src/index.css` - `--overlay-labs`/`--overlay-incidents`/`--overlay-procedures` tokens in `:root` and `.dark`
- `frontend/src/lib/agent.ts` - `PulseField` gains `"overlay"`; reset pulses it; new overlay branch reaches `setOverlayDataset`
- `frontend/src/lib/agent.test.ts` - 5-field reset test (renamed from "four") + new overlay-bridge test
- `frontend/src/lib/agent-parity.test.ts` - `setOverlayDataset` added to `STORE_ACTIONS`, `beforeEach`, and `CASES`

## Decisions Made
- Backend Plan 09-01 (adding `overlayDataset`/`overlayState` to `backend/app/agent/schemas.py`) runs in a separate parallel wave-1 worktree and has not merged into this worktree's base commit. Rather than reading a stale/pre-change `schemas.py` as the "byte-identical mirror target," followed the 09-02 plan's own explicit field specification (`overlayDataset?: OverlayDataset | null`, `overlayState?: "on" | "off" | null`, inserted after `bpCategory` and before `reset`) and cross-checked it against 09-01-PLAN.md's own task text for consistency — both specify the identical field names, types, and insertion point, so no drift risk.
- `agent-parity.test.ts`'s backend↔frontend token-parity block (the `ChartToken`/`bpCategory` literal diff read from disk) was deliberately left untouched per the plan's explicit instruction — it doesn't assert `AppliedFilters` field names, so it is unaffected by the backend schema not yet being updated in this worktree.

## Deviations from Plan

None - plan executed exactly as written. All three tasks followed the plan's field-by-field spec verbatim; no bugs, missing functionality, or blocking issues were encountered.

## Issues Encountered
- `frontend/node_modules` was not present in the freshly-spawned worktree (fresh checkout, no install). Ran `npm ci` (installs exactly what's pinned in `package-lock.json`, including the already-declared `lucide-react` dependency — no new/different package added) before any verification command could run. Not a deviation from the plan's own scope, just an environment-setup prerequisite.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Every later Phase 9 plan (09-03 hooks/data-fetching, 09-04 OverlayToggle/OverlayEventsList, 09-05 chart markers, 09-06) can now import `OverlayDataset`, `AppliedFilters.overlayDataset/overlayState`, `getLabs/getIncidents/getProcedures`, `OVERLAY_META/OVERLAY_ORDER`, `useFilters().overlayDatasets`/`setOverlayDataset`, and the `--overlay-*` CSS tokens — all locked and test-covered.
- Backend Plan 09-01 (parallel wave-1 worktree) must land with the exact field names confirmed above before the full-stack `toggle_dataset` voice/text flow can be end-to-end tested; the frontend contract is ready and waiting, no frontend rework anticipated.
- Full frontend suite (`cd frontend && npx tsc --noEmit && npx vitest run`) is green: 219/219 tests pass, zero regressions beyond this plan's scope.

---
*Phase: 09-multi-dataset-overlay-filtering*
*Completed: 2026-08-21*
