---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 03
subsystem: frontend-types
tags: [typescript, vitest, filters, pulse-category, query-params]

# Dependency graph
requires:
  - phase: 14-unified-show-panel-and-combined-timeline
    provides: SeriesDataset/AppliedFilters union pattern and the datasetsOn?/showOnly? optional-array-or-null shape this plan's new bpCategory/pulseCategory/timeOfDay fields mirror
provides:
  - PulseCategory/TimeOfDayBucket exported TS unions matching backend Literal vocabularies
  - List-typed ResolvedFilters/AppliedFilters (bp_category/pulse_category/time_of_day arrays), amPm/am_pm fully removed
  - pulseCategoryColor()/PULSE_CLINICAL_ORDER in lib/palette.ts, reusing existing CSS vars
  - getJson support for string[] query param values (repeated-key serialization via URLSearchParams.append)
  - List-aware resolveFilters plus shared selectedKeys/selectedOrOmit/selectedOrAll zero-or-all helpers in lib/dates.ts
affects: [15-04, 15-05, 15-06, 15-07, 15-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-or-all filter convention: a Record<K, boolean> selection map resolves to `undefined` (omitted from the query) when 0 or all keys are true, and to the array of true keys for any strict subset — implemented once in selectedOrOmit, reused per filter group"
    - "Multi-value query params serialize as repeated keys via URLSearchParams.append, never comma-joined or .set (which overwrites to the last value)"

key-files:
  created: []
  modified:
    - frontend/src/api/types.ts
    - frontend/src/lib/palette.ts
    - frontend/src/api/client.ts
    - frontend/src/lib/dates.ts
    - frontend/src/lib/dates.test.ts

key-decisions:
  - "Followed the plan's exact type/helper shapes verbatim — no deviation from the specified PulseCategory/TimeOfDayBucket unions, selectedOrOmit/selectedOrAll signatures, or getJson array-append branch."

patterns-established:
  - "selectedKeys/selectedOrOmit/selectedOrAll in lib/dates.ts are the single shared implementation of the zero-or-all filter-group convention; later plans (store, FilterBar) should call these rather than re-deriving the omit logic per filter."

requirements-completed: [PH15-05]

# Metrics
duration: 15min
completed: 2026-09-17
---

# Phase 15 Plan 03: Shared Frontend Filter Contracts Summary

**New `PulseCategory`/`TimeOfDayBucket` TS unions, list-typed `ResolvedFilters`/`AppliedFilters`, repeated-query-key support in `getJson`, and a list-aware `resolveFilters` with shared zero-or-all selection helpers — the fixed interface every later Phase 15 frontend plan builds against.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-17T08:24:00-07:00 (approx, first file read)
- **Completed:** 2026-09-17T08:39:00-07:00
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `api/types.ts` now exports `PulseCategory`/`TimeOfDayBucket`, tightens `Reading.pulse_category`, and widens `ResolvedFilters`/`AppliedFilters` to list-typed `bp_category`/`pulse_category`/`time_of_day` (and `bpCategory`/`pulseCategory`/`timeOfDay`), with `amPm`/`am_pm` removed entirely
- `lib/palette.ts` gained `PULSE_CLINICAL_ORDER` and `pulseCategoryColor()`, reusing the three existing CSS vars (`--ref-bradycardia`, `--cat-normal`, `--cat-elevated`) with zero new custom properties
- `api/client.ts`'s `getJson` serializes array-valued params as repeated query keys (`URLSearchParams.append`), never comma-joined or overwritten
- `lib/dates.ts`'s `resolveFilters` is list-aware: `selectedOrOmit` implements the zero-or-all convention once, reused for `bpCategory`/`pulseCategory`/`timeOfDay`
- `dates.test.ts` rewritten for the new `Record<K, boolean>` `FilterDateState` shape; 24 tests passing (up from the prior 22, replacing the single amPm/bpCategory test with 6 zero-or-all cases)

## Task Commits

Each task was committed atomically:

1. **Task 1: Type unions + AppliedFilters/ResolvedFilters widening + Pulse Category palette** - `1222594` (feat)
2. **Task 2: Multi-value query params in getJson + list-aware resolveFilters** - `db9e35b` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `frontend/src/api/types.ts` - PulseCategory/TimeOfDayBucket unions, Reading.pulse_category tightened, ResolvedFilters/AppliedFilters widened to lists, amPm/am_pm removed
- `frontend/src/lib/palette.ts` - PULSE_CLINICAL_ORDER + pulseCategoryColor(), mirroring CLINICAL_ORDER/categoryColor()
- `frontend/src/api/client.ts` - getJson accepts `string | string[]` param values, appends arrays as repeated keys
- `frontend/src/lib/dates.ts` - TIME_OF_DAY_ORDER, selectedKeys/selectedOrOmit/selectedOrAll helpers, FilterDateState widened to boolean maps, resolveFilters rewritten for list-aware zero-or-all resolution
- `frontend/src/lib/dates.test.ts` - state() helper rebuilt for the map shape, 6 new zero-or-all tests replacing the old single-value amPm/bpCategory test

## Decisions Made
None beyond the plan itself - followed the plan's exact type and helper shapes as specified.

## Deviations from Plan

None - plan executed exactly as written. One clarifying note (not a deviation, no code change): the plan's own `<verify>` command `cd frontend && npx tsc --noEmit` is a no-op in this repo — the root `tsconfig.json` declares `"files": []` with project references, so plain `tsc --noEmit` (without `-b`) checks nothing and always exits 0. Verification was actually performed with `npx tsc -b --noEmit` (matching this repo's own `npm run build` script, `"build": "tsc -b && vite build"`), which does real type-checking via the project-reference graph.

Using `tsc -b --noEmit`, this plan's five in-scope files (`api/types.ts`, `lib/palette.ts`, `api/client.ts`, `lib/dates.ts`, `lib/dates.test.ts`) type-check with zero errors. Pre-existing, out-of-scope files that also reference the old `AppliedFilters.amPm`/scalar `ResolvedFilters.bp_category`/`FilterDateState` shape — `frontend/src/hooks/useStats.ts`, `frontend/src/lib/agent.ts`, `frontend/src/lib/agent.test.ts`, `frontend/src/lib/agent-parity.test.ts` — now show type errors against the widened types. This is the expected, intentional cost of this plan's "interface-first ordering": those four files are explicitly owned and fixed by later Phase 15 plans (`useStats.ts` by 15-07; `agent.ts`/`agent.test.ts`/`agent-parity.test.ts` by 15-06 and 15-08, confirmed via grep across the phase's PLAN.md files), not this plan. The whole project will type-check again once all Phase 15 wave plans land.

## Issues Encountered
None - `npm install` was required in this fresh worktree (no `node_modules`) before any verification could run; this is expected worktree setup, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `api/types.ts`, `lib/palette.ts`, `api/client.ts`, and `lib/dates.ts` now expose the fixed contracts (`PulseCategory`/`TimeOfDayBucket`, list-typed `ResolvedFilters`/`AppliedFilters`, `pulseCategoryColor`, `selectedKeys`/`selectedOrOmit`/`selectedOrAll`, `TIME_OF_DAY_ORDER`) that later Phase 15 plans (store, FilterBar, agent bridge) should import rather than redefine.
- Downstream plans 15-06/15-07/15-08 must update `useStats.ts`, `agent.ts`, `agent.test.ts`, and `agent-parity.test.ts` to the new `AppliedFilters`/`ResolvedFilters`/`FilterDateState` shapes (amPm removed, bpCategory list-typed) — tracked as expected pending work above, not a blocker for this plan.

## Self-Check: PASSED

- FOUND: `frontend/src/api/types.ts`, `frontend/src/lib/palette.ts`, `frontend/src/api/client.ts`, `frontend/src/lib/dates.ts`, `frontend/src/lib/dates.test.ts` (all modified files present)
- FOUND: `.planning/phases/15-unified-filter-surface-multi-select-checkboxes-pulse-categor/15-03-SUMMARY.md`
- FOUND: commit `1222594` (Task 1)
- FOUND: commit `db9e35b` (Task 2)
- FOUND: commit `0724211` (plan metadata / this SUMMARY)

---
*Phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor*
*Completed: 2026-09-17*
