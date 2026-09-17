---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 06
subsystem: ui
tags: [zustand, agent-bridge, voice-confirmation, typescript]

# Dependency graph
requires:
  - phase: 15 (plans 03/04)
    provides: api/types.ts's list-typed AppliedFilters.bpCategory/pulseCategory/timeOfDay and store/filters.ts's Record<X, boolean> map shape + setBpCategory/setPulseCategory/setTimeOfDay array-replace actions
provides:
  - "applyAgentFilters handling list-typed bpCategory/pulseCategory/timeOfDay deltas (full replace, including explicit-empty-array clear) with amPm fully removed"
  - "composeConfirmation multi-select suffix grammar matching UI-SPEC §9's locked clause order and worked example"
affects: [15-08 (ChartDeck/CommandBar/ShowPanel/useVoiceCommand/agent-parity tests consume this file's new PulseField union and composeConfirmation signature)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Confirmation suffix grammar: selectedOrOmit(map, groupLength) + joinWithAnd, zero-or-all collapses to empty string — reused verbatim from lib/dates.ts's resolveFilters instead of a bespoke local helper"

key-files:
  created: []
  modified:
    - frontend/src/lib/agent.ts
    - frontend/src/lib/agent.test.ts

key-decisions:
  - "Reused lib/dates.ts's existing selectedOrOmit (already governs the identical zero-or-all convention in resolveFilters) instead of writing a new function-local selected() helper as the plan's action text suggested — same behavior, one less duplicated one-liner."
  - "timeOfDaySuffix needs no single-vs-multi branching: joinWithAnd on a 1-item array already returns that item, so `${bucket.toLowerCase()}s` pluralization handles Morning/Evening/Afternoon/Night uniformly for both the single-selected legacy wording and the 2+-selected general form."

requirements-completed: [PH15-07]

# Metrics
duration: ~15min
completed: 2026-09-17
---

# Phase 15 Plan 06: Agent Bridge Multi-Select Deltas Summary

**Rewired `lib/agent.ts`'s `applyAgentFilters`/`composeConfirmation` pair for list-typed `bpCategory`/`pulseCategory`/`timeOfDay` deltas, dropping `amPm` entirely and matching UI-SPEC §9's locked multi-select confirmation grammar.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed (+ 1 test-coverage addendum)
- **Files modified:** 2 (`frontend/src/lib/agent.ts`, `frontend/src/lib/agent.test.ts`)

## Accomplishments
- `applyAgentFilters` now applies `bpCategory`/`pulseCategory`/`timeOfDay` as full-replace array deltas via `setBpCategory`/`setPulseCategory`/`setTimeOfDay`, with the `!= null` (not truthy) guard correctly treating an explicit `[]` as "clear every key"
- `PulseField` union and `reset` branch updated to the three category-ish groups (`bpCategory`, `pulseCategory`, `timeOfDay`) — `amPm` removed everywhere in this file
- `composeConfirmation` produces the exact UI-SPEC §9 worked example: `"Showing blood pressure and pulse, last 30 days, mornings, Stage 1 and Stage 2 blood pressure, Tachycardia pulse"`, with each of the three suffixes independently collapsing to `""` under the zero-or-all convention
- 25/25 tests green in `agent.test.ts`; `npx tsc --noEmit` exits 0 (the project's root `tsconfig.json` is references-only, so this plan's own files carry zero type errors in isolation — see Issues Encountered for the `tsc -b` cross-file caveat)

## Task Commits

Each task was committed atomically:

1. **Task 1: applyAgentFilters — list-typed category deltas, drop amPm** - `8aa095e` (feat)
2. **Task 2: composeConfirmation multi-select suffix grammar + its tests** - `117eb69` (feat)
3. **Addendum: explicit empty-array clear test coverage** - `5f8680a` (test)

_Task 3 is not a plan task — it closes a gap between Task 1's `<behavior>` spec (empty-array clear must be proven) and its `<action>` text, which only described editing existing tests and didn't call out a new one for that exact case._

## Files Created/Modified
- `frontend/src/lib/agent.ts` - `PulseField` union (amPm → pulseCategory + timeOfDay), `applyAgentFilters`'s delta blocks and `hasOtherCommand`/reset touched-sets, `composeConfirmation`'s state param + three suffix builders (`timeOfDaySuffix`, `bpCategorySuffix`, `pulseCategorySuffix`) in UI-SPEC §9's locked clause order
- `frontend/src/lib/agent.test.ts` - `beforeEach` seed and `confState()` helper updated to the v3 `Record<X, boolean>` map shapes; every `amPm`/scalar-`bpCategory` test rewritten; 2 new tests added (full-replace list delta, explicit-empty-array clear) plus the UI-SPEC §9 worked-example and zero-or-all-collapse tests from Task 2

## Decisions Made
- Reused `dates.ts`'s exported `selectedOrOmit` (imported alongside `TIME_OF_DAY_ORDER`) instead of the plan's suggested function-local `selected()` helper — `resolveFilters` in the same module already applies the identical zero-or-all rule to the same three state maps, so importing the existing function keeps the convention single-sourced rather than duplicating a one-line filter.
- `timeOfDaySuffix` uses one general pluralization formula (`${bucket.toLowerCase()}s`) for all four buckets and all selection counts — `joinWithAnd` on a single-item array already returns that item unmodified, so the plan's described "preserve exact legacy singular wording, else general form" split collapses to one code path with no observable difference in output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing test coverage] Added the explicit empty-array clear test Task 1's `<behavior>` required**
- **Found during:** Post-Task-1 review of `<behavior>` vs. the tests actually added
- **Issue:** Task 1's behavior spec requires `applyAgentFilters({ bpCategory: [] })` (and the pulseCategory/timeOfDay equivalents) to clear every key via the `!= null` (not truthy) guard — a load-bearing correctness point called out explicitly in the plan — but the `<action>` section's test-edit instructions only covered updating existing scalar-shaped tests, not adding a new one for this exact case.
- **Fix:** Added two tests: one proving the full-replace list-typed delta shape, one proving the explicit-`[]`-clears-every-key case for all three groups.
- **Files modified:** `frontend/src/lib/agent.test.ts`
- **Verification:** `npx vitest run src/lib/agent.test.ts` — 25/25 passing (up from 23/23 after Task 2)
- **Committed in:** `5f8680a`

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing test coverage for a behavior the plan itself specified)
**Impact on plan:** Closes a gap between the plan's stated behavior contract and its literal test-edit instructions. No scope creep — same two files, same feature.

## Issues Encountered
- The frontend worktree had no `node_modules` (fresh worktree, no prior `npm install` — same class of gap STATE.md's Quick 260913-fdm note flags for Python `.venv`). Ran `npm install` before any test/typecheck command.
- `npx tsc --noEmit` (the plan's literal verification command) is a no-op in this repo — the root `tsconfig.json` is `{ "files": [], "references": [...] }`, so plain `tsc --noEmit` type-checks nothing and always exits 0. Ran `npx tsc -b --noEmit` as a stronger cross-project check and confirmed **zero errors originate in this plan's two files** (`agent.ts`/`agent.test.ts`); all ~25 errors it surfaced are in `App.tsx`, `FilterBar.tsx`, `EmptyState.tsx`, `useStats.ts`, and four `*.test.ts`/`*.test.tsx` files still on the old scalar `amPm`/`bpCategory` shape — every one of those files belongs to sibling wave-3 plan **15-05** or **15-07**, or wave-4 plan **15-08** (which explicitly `depends_on: ["15-04", "15-06", "15-02"]` for exactly this reason). Not in scope for 15-06; expected to resolve once the wave merges.

## Next Phase Readiness
- `lib/agent.ts` now presents a stable `AppliedFilters`-consuming surface (list-typed `bpCategory`/`pulseCategory`/`timeOfDay`, no `amPm`) and a `composeConfirmation` signature matching the v3 store shape — ready for **15-08** (wave 4) to update `ChartDeck.test.tsx`, `CommandBar.test.tsx`, `useVoiceCommand.test.ts`, `ShowPanel.test.tsx`, and `agent-parity.test.ts` against this exact contract.
- No blockers for this plan's own scope. The remaining `tsc -b` errors across the codebase are pre-existing/expected mid-wave state, not something this plan introduced or can fix without touching files outside its `files_modified` list.

---
*Phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor*
*Completed: 2026-09-17*
