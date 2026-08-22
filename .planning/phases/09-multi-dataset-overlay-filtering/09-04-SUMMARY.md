---
phase: 09-multi-dataset-overlay-filtering
plan: 04
subsystem: ui
tags: [react, zustand, accessibility, aria-pressed, pagination, overlay]

# Dependency graph
requires:
  - phase: 09-multi-dataset-overlay-filtering (Plan 09-02)
    provides: overlayDatasets/setOverlayDataset/activeChart in store/filters.ts, "overlay" PulseField in lib/agent.ts, OVERLAY_META/OVERLAY_ORDER in lib/overlayMeta.ts
  - phase: 09-multi-dataset-overlay-filtering (Plan 09-03)
    provides: OverlayEvent shape + mergeOverlayEvents/buildEmptyMessage/buildErrorMessage/buildOverlaySentence in lib/overlayEvents.ts
provides:
  - OverlayToggle.tsx — 3-button role=group multi-select overlay toggle row (click half of OVERLAY-03), doesn't-apply-here indicator (OVERLAY-05), agent-pulse visual parity
  - OverlayEventsList.tsx — accessible, conditionally-mounted, paginated 4-column events table (OVERLAY-06), per-type error isolation
affects: [09-05 (chart markers — will read these same OVERLAY_META tokens), 09-06 (App.tsx wiring — will mount both new components with real useLabs/useIncidents/useProcedures query results)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-dataset inline style={{backgroundColor: color}} for multi-select pressed state, reusing FilterBar's categoryColor(cat) inline-style technique rather than a shared accent Tailwind class"
    - "useMemo-stabilized merged-array identity feeding a reset-on-identity-change useEffect (see Deviations) — the correct way to apply ReadingsTable's pagination-reset pattern when the array is locally derived from multiple props rather than passed through directly"

key-files:
  created:
    - frontend/src/components/OverlayToggle.tsx
    - frontend/src/components/OverlayToggle.test.tsx
    - frontend/src/components/OverlayEventsList.tsx
    - frontend/src/components/OverlayEventsList.test.tsx
  modified: []

key-decisions:
  - "Memoized the OverlayEventsList merged array via useMemo (keyed on the three datasets' events/isError) rather than recomputing it as a plain local variable every render, to avoid a pagination-reset bug the plan's literal wording would have introduced."

patterns-established:
  - "New independent multi-select control groups (first in this codebase) mount as their own component, own role=group, own useAgentPulse subscription — sibling of FilterBar, not nested inside it."

requirements-completed: [OVERLAY-03, OVERLAY-04, OVERLAY-05, OVERLAY-06]

# Metrics
duration: 15min
completed: 2026-08-22
---

# Phase 9 Plan 4: Overlay Toggle Row & Accessible Events Table Summary

**OverlayToggle.tsx (3-button multi-select, doesn't-apply-here note, agent-pulse parity) and OverlayEventsList.tsx (conditionally-mounted, paginated, per-type-error-isolated 4-column accessible table) — the codebase's first true multi-select toggle group plus its accessible-table twin.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-21T18:59:41-07:00 (first commit)
- **Completed:** 2026-08-21T19:14:12-07:00 (last commit)
- **Tasks:** 2 completed
- **Files modified:** 4 (all new)

## Accomplishments
- `OverlayToggle.tsx`: independently `aria-pressed` Labs/Incidents/Procedures buttons, each toggling only its own `overlayDatasets` flag via `setOverlayDataset`; buttons stay fully clickable (never `disabled`) on every chart, with a dimmed `opacity-60` + `aria-live="polite"` "doesn't apply here" note shown only on BP Categories/AM-PM
- `OverlayEventsList.tsx`: renders nothing when no overlay dataset is ON; renders a 4-column (Date/Type/What happened/Notes) accessible table with 20-row paging otherwise; merges and sorts labs/incidents/procedures newest-first regardless of input order; isolates one dataset's fetch error from another's rows
- Both components import shared `OVERLAY_META`/`OVERLAY_ORDER` (Plan 09-02) and `mergeOverlayEvents`/copy builders (Plan 09-03) rather than re-declaring any state — zero duplicated maps
- 21 new tests (12 OverlayToggle + 9 OverlayEventsList), all passing; full frontend suite (263 tests) still green after the change

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: OverlayToggle.tsx + OverlayToggle.test.tsx**
   - `83d63ee` test(09-04): add failing test for OverlayToggle multi-select group
   - `5fb5826` feat(09-04): implement OverlayToggle multi-select toggle row
2. **Task 2: OverlayEventsList.tsx + OverlayEventsList.test.tsx**
   - `b1a8664` test(09-04): add failing test for OverlayEventsList accessible table
   - `3d4e51e` feat(09-04): implement OverlayEventsList accessible events table

**Plan metadata:** (this commit)

## Files Created/Modified
- `frontend/src/components/OverlayToggle.tsx` - 3-button role=group multi-select overlay toggle, doesn't-apply-here indicator, overlay-state sentence, agent-pulse ring
- `frontend/src/components/OverlayToggle.test.tsx` - 12 behavior tests covering independent aria-pressed, note visibility, sentence copy, pulse parity
- `frontend/src/components/OverlayEventsList.tsx` - conditionally-mounted paginated 4-column accessible table, per-type error isolation
- `frontend/src/components/OverlayEventsList.test.tsx` - 9 behavior tests covering null-render, paging, merge/sort, empty/error states, columns, notes, type badge

## Decisions Made
- Memoized `merged` in `OverlayEventsList` via `useMemo` on the three datasets' `events`/`isError` identities (see Deviations below) — necessary correctness fix, not a style preference.
- No other decisions beyond what 09-UI-SPEC.md already locked (exact markup, copy, color tokens reproduced verbatim).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Memoized OverlayEventsList's merged event array to avoid a pagination-reset bug**
- **Found during:** Task 2 (OverlayEventsList.tsx implementation)
- **Issue:** The plan's `<action>` text specifies "a `useEffect` resetting `visible` to `PAGE_SIZE` whenever `merged`'s array identity changes." Taken literally, `merged` would be a plain local variable recomputed via `mergeOverlayEvents(...)` (a `[...a,...b,...c].sort(...)` spread) on every render. Since a spread+sort always allocates a new array, `merged`'s reference would differ on *every* render — including the re-render triggered by clicking "Show 20 more" itself (`setVisible` → re-render → new `merged` reference → effect dependency "changed" → effect fires → `setVisible(PAGE_SIZE)` immediately reverts the just-expanded page size). This would make pagination silently non-functional beyond the first page.
- **Fix:** Wrapped the `mergeOverlayEvents(...)` call in `useMemo`, keyed on the six actual per-dataset identities (`labs.events`, `labs.isError`, `incidents.events`, `incidents.isError`, `procedures.events`, `procedures.isError`). The memoized reference now only changes when the underlying data genuinely changes (a real filter/refetch), matching `ReadingsTable.tsx`'s implicit assumption that its `readings` prop is stable across re-renders caused by its own internal state.
- **Files modified:** `frontend/src/components/OverlayEventsList.tsx`
- **Verification:** `"renders 20 rows + Show 20 more; clicking reveals all 25 and shows the all-shown copy"` test in `OverlayEventsList.test.tsx` exercises exactly this click-through-pagination path and passes.
- **Committed in:** `3d4e51e` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Wrapped `useAgentPulse.getState().mark(...)` calls in `act(...)` in OverlayToggle.test.tsx**
- **Found during:** Task 1 (OverlayToggle.test.tsx)
- **Issue:** Calling the zustand `mark()` action directly from a test (outside a React event handler or `fireEvent`) triggered React's "not wrapped in act(...)" warning and caused one assertion (`toContain("motion-safe:animate-pulse")`) to read stale DOM before the pulse effect's state update had flushed.
- **Fix:** Wrapped the two direct `useAgentPulse.getState().mark([...])` calls in `act(() => { ... })`, matching React Testing Library's documented pattern for externally-triggered state updates.
- **Files modified:** `frontend/src/components/OverlayToggle.test.tsx`
- **Verification:** All 12 `OverlayToggle.test.tsx` tests pass with no `act()` warnings in output.
- **Committed in:** `5fb5826` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes)
**Impact on plan:** Both fixes are necessary for correctness (working pagination; deterministic pulse assertions) and were fully contained within the two new files this plan creates. No scope creep — no other files touched.

## Issues Encountered
None beyond the two auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `OverlayToggle.tsx` and `OverlayEventsList.tsx` are both self-contained, ready to be mounted by Plan 09-06's `App.tsx` wiring (per 09-UI-SPEC.md's `main` layout: `FilterBar` → `OverlayToggle` → `StatsStrip` → chart region → readings table → `OverlayEventsList`).
- Neither component performs its own data fetching — Plan 09-06's `useLabs`/`useIncidents`/`useProcedures` TanStack Query results feed `OverlayEventsList`'s `{ enabled, events, isError }` props directly.
- Plan 09-05 (chart markers on BPTimeline/PulseTrend) can now safely reuse the same `OVERLAY_META` tokens this plan's components already render, guaranteeing the toggle button, chart marker, and table badge all read as the same visual system per D-05.
- No blockers.

---
*Phase: 09-multi-dataset-overlay-filtering*
*Completed: 2026-08-22*

## Self-Check: PASSED

All claimed files verified present on disk:
- FOUND: frontend/src/components/OverlayToggle.tsx
- FOUND: frontend/src/components/OverlayToggle.test.tsx
- FOUND: frontend/src/components/OverlayEventsList.tsx
- FOUND: frontend/src/components/OverlayEventsList.test.tsx
- FOUND: .planning/phases/09-multi-dataset-overlay-filtering/09-04-SUMMARY.md

All claimed commits verified present in git history:
- FOUND: 83d63ee (test: OverlayToggle RED)
- FOUND: 5fb5826 (feat: OverlayToggle GREEN)
- FOUND: b1a8664 (test: OverlayEventsList RED)
- FOUND: 3d4e51e (feat: OverlayEventsList GREEN)
