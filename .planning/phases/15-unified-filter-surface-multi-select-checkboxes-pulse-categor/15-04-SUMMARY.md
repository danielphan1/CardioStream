---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 04
subsystem: frontend-store
tags: [zustand, vitest, filters, localStorage-migration, multi-select]

# Dependency graph
requires:
  - phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
    plan: 03
    provides: PulseCategory/TimeOfDayBucket unions, PULSE_CLINICAL_ORDER/pulseCategoryColor, TIME_OF_DAY_ORDER, list-aware FilterDateState/resolveFilters — this plan's store shape and default-map builders consume all of these directly
provides:
  - v3 filter store shape (bpCategory/pulseCategory/timeOfDay Record<K, boolean> maps, amPm dropped entirely — resolved Option B)
  - v2→v3 localStorage migration (migrateV2/isV2Filters/isV3Filters) chained after the existing v1→v2 path — readStoredFilters now tries v3 → v2 → v1(legacy) → null
  - toggle*/set* action pairs per category group (toggleBpCategory/setBpCategory, togglePulseCategory/setPulseCategory, toggleTimeOfDay/setTimeOfDay) — the fixed action signatures every later-wave consumer (FilterBar, agent bridge, EmptyState) builds against
affects: [15-05, 15-06, 15-07, 15-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toggle*/set* action pairs per filter group: toggle mutates exactly one key (UI checkbox onChange, never voice-reachable, mirrors setDataset's shape); set REPLACES the whole map exhaustively, built from the group's canonical order constant rather than spreading current state (mirrors showOnlyDatasets's exhaustive-rebuild reasoning) — this is what the agent bridge calls with Claude's full desired selection"
    - "3-way localStorage migration chain (v3 passthrough → v2→v3 → v1→v2→v3), each hop expressed as its own type guard + pure mapper function, never a second hand-written v1-to-v3 shortcut — extends the existing v1→v2 pattern instead of replacing it"

key-files:
  created: []
  modified:
    - frontend/src/store/filters.ts
    - frontend/src/store/filters.test.ts

key-decisions:
  - "Followed the plan's exact type/action shapes verbatim (PersistedFiltersV2/PersistedFilters rename, isV2Filters/isV3Filters/migrateV2, toggle*/set* signatures) — no deviation from the specified design."
  - "Fixed a plan gap in filters.test.ts's pre-existing 'useFilters initial state' test (Rule 1): it asserted s.amPm/s.bpCategory as scalars, which the plan's own Task 1/Task 2 test-update instructions never mentioned, but the field no longer exists after this plan's store-shape change. Updated its assertions to the same all-false-map-values convention already used elsewhere in the plan's own new tests, so the full suite stays green without waiting for a later plan to notice."

patterns-established:
  - "toggleBpCategory/setBpCategory and their pulse-category/time-of-day siblings are the fixed action set later Phase 15 plans (FilterBar, agent bridge) must call — toggle* for checkbox UI, set* for full-replacement voice/agent commands."

requirements-completed: [PH15-04, PH15-05]

# Metrics
duration: 15min
completed: 2026-09-17
---

# Phase 15 Plan 04: v3 Filter Store Shape + Category Toggle/Set Actions Summary

**Converted `store/filters.ts` — the zustand store that IS the agent command schema — from single-value `amPm`/`bpCategory` sentinels to three multi-select `Record<K, boolean>` maps (`bpCategory`, `pulseCategory`, `timeOfDay`), dropped `amPm` entirely, and added a v2→v3 localStorage migration chained after the existing v1→v2 path plus toggle/set action pairs per category group.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-17T08:50:38-07:00 (worktree base commit)
- **Completed:** 2026-09-17T08:58:27-07:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `filters.ts`'s `PersistedFilters` is now the v3 shape (`bpCategory`/`pulseCategory`/`timeOfDay` boolean maps, no `amPm`); the old current-shape type was renamed `PersistedFiltersV2` and kept unchanged in shape
- `isV3Filters`/`isV2Filters` type guards and `migrateV2` mapper added; `readStoredFilters`'s fallback chain now tries v3 passthrough → v2→v3 migration → v1→v2→v3 migration (chained through the existing `migrateLegacy`, never a second hand-written v1-to-v3 mapper) → `null`
- `FilterState`'s fields widened to match; initial state, `persistCurrent()`, and `showAllData()`'s reset object all updated to the three new default-false maps (`DEFAULT_BP_CATEGORY`/`DEFAULT_PULSE_CATEGORY`/`DEFAULT_TIME_OF_DAY`, built the same `Object.fromEntries` way as `DEFAULT_DATASETS`)
- `setAmPm` deleted; `setBpCategory` widened from a scalar setter to a full-replacement multi-select action. Added `toggleBpCategory`/`togglePulseCategory`/`toggleTimeOfDay` (UI-only, single-key mutation, mirrors `setDataset`) and `setPulseCategory`/`setTimeOfDay` (voice-reachable, exhaustive full-replacement, mirrors `showOnlyDatasets`)
- `filters.test.ts`: `INITIAL` constant, the v1→v2 "preserves the date range and filters" assertion, and the `showAllData`/setter-persistence tests all updated to the map shape; a new `"v2 → v3 migration"` describe block added (proves the "never silently reset a caregiver's prior selection" principle for the new migration hop, including a stray-but-ignored `amPm` key); the superseded scalar-passthrough `"restores a valid persisted blob on initFilters()"` test deleted (its scenario is now covered by the new v2→v3 block); the old `"single-select filters (D-19)"` block replaced with a `"category filter toggle/set actions"` block covering all three group pairs
- 39/39 tests pass; this plan's own files (`filters.ts`/`filters.test.ts`) type-check with zero errors under `npx tsc -b --noEmit`

## Task Commits

Each task was committed atomically:

1. **Task 1: v3 store shape + v2→v3 migration** - `630e91a` (feat)
2. **Task 2: New toggle/set actions per category group + non-migration test updates** - `afb9909` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `frontend/src/store/filters.ts` - v3 `PersistedFilters` shape, `isV3Filters`/`isV2Filters`/`migrateV2`, widened `FilterState`, new toggle*/set* action pairs per category group, `showAllData` reset updated
- `frontend/src/store/filters.test.ts` - `INITIAL` constant widened; new `"v2 → v3 migration"` describe block; `"single-select filters (D-19)"` replaced with `"category filter toggle/set actions"`; `showAllData`/setter-persistence/initial-state tests updated to the map shape; superseded scalar-passthrough bootstrap test deleted

## Decisions Made
Followed the plan's exact type and action shapes as specified — `PersistedFiltersV2`/`PersistedFilters` naming, `isV2Filters`/`isV3Filters`/`migrateV2` chain order, and the `toggle*`/`set*` signatures all match the plan's action text verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a plan gap: the pre-existing "useFilters initial state" test asserted `s.amPm`/`s.bpCategory` as scalars**
- **Found during:** Task 1 (and would have surfaced again at Task 2's full-suite verify)
- **Issue:** Neither Task 1's nor Task 2's test-update instructions mentioned the `describe("useFilters initial state", ...)` block's first test, which asserted `expect(s.amPm).toBe("all")` and `expect(s.bpCategory).toBe("all")`. Once the store's field types changed (Task 1), `s.amPm` is `undefined` and `s.bpCategory` is an object — both assertions would fail, and the full suite (Task 2's `<verify>`) would not pass as the plan's own `<done>` criteria require.
- **Fix:** Updated the assertions to the same "every key is false" convention already used elsewhere in the plan's own new tests (`Object.values(s.bpCategory).every((v) => !v)`, same for `pulseCategory`/`timeOfDay`).
- **Files modified:** `frontend/src/store/filters.test.ts`
- **Commit:** `630e91a` (bundled into Task 1's commit, since it's a direct consequence of Task 1's store-shape change)

## Issues Encountered
None beyond the plan gap above. `npm install` was required in this fresh worktree (no `node_modules`) before any verification could run — expected worktree setup, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `filters.ts` now exposes the fixed v3 shape and action set (`toggleBpCategory`/`setBpCategory`, `togglePulseCategory`/`setPulseCategory`, `toggleTimeOfDay`/`setTimeOfDay`) that later Phase 15 plans (FilterBar 15-05, agent bridge 15-06, `useStats`/EmptyState 15-07/15-08) build against.
- As documented by 15-03's precedent, several consumer files (`App.tsx`, `FilterBar.tsx`, `CommandBar.tsx`/test, `ShowPanel.test.tsx`, `useStats.ts`, `useVoiceCommand.ts`/test, `agent.ts`/`agent.test.ts`/`agent-parity.test.ts`) now show `tsc -b --noEmit` errors against this plan's widened `FilterState`/dropped `amPm` — confirmed via `npx tsc -b --noEmit | grep store/filters` returning nothing (this plan's own files are clean). These consumer files are explicitly owned and fixed by their respective later-wave plans (15-05 through 15-08), not this plan — same expected-and-tracked pattern 15-03 established for `useStats.ts`/`agent.ts`/`agent.test.ts`/`agent-parity.test.ts`, now also covering `FilterBar.tsx`/`App.tsx`/`CommandBar.tsx`/`useVoiceCommand.ts` and their tests. The whole project will type-check again once all Phase 15 wave plans land.
- Per the plan's own `<verify>` command `cd frontend && npx tsc --noEmit`, this repo's root `tsconfig.json` declares `"files": []` with project references, so plain `tsc --noEmit` is a no-op (always exits 0) — same clarifying note 15-03 recorded. Real type-checking was additionally performed via `npx tsc -b --noEmit` as described above.

## Self-Check: PASSED

- FOUND: `frontend/src/store/filters.ts`
- FOUND: `frontend/src/store/filters.test.ts`
- FOUND: commit `630e91a` (Task 1)
- FOUND: commit `afb9909` (Task 2)

---
*Phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor*
*Completed: 2026-09-17*
