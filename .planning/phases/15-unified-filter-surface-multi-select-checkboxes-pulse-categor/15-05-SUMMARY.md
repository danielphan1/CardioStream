---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 05
subsystem: frontend-component
tags: [react, vitest, filters, multi-select, checkboxes, accessibility]

# Dependency graph
requires:
  - phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
    plan: 04
    provides: v3 filter store shape (bpCategory/pulseCategory/timeOfDay Record<K, boolean> maps, amPm dropped) and toggle*/set* action pairs per category group — this plan's checkbox onChange handlers call toggleBpCategory/togglePulseCategory/toggleTimeOfDay directly
  - phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
    plan: 03
    provides: PulseCategory/TimeOfDayBucket unions, PULSE_CLINICAL_ORDER/pulseCategoryColor, TIME_OF_DAY_ORDER, selectedOrAll zero-or-all helper — this plan's checkbox groups and live sentence import all of these directly
provides:
  - FilterBar.tsx as a real 4-group multi-select checkbox surface (Date unchanged buttons, Time of Day / BP Category / Pulse Category as real <input type=checkbox>) — the user-facing control the whole phase exists to ship
  - FilterBar.test.tsx (new file) — 11 tests locking multi-select semantics, the zero-or-all sentence collapse, and the 48px floor
affects: [15-06, 15-07, 15-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visible label prefix per filter group (a small text-label <span> immediately before each role=group div), matching ShowPanel.tsx's own 'Show:' prefix — applied to all 4 FilterBar groups including the previously-unlabeled Date group"
    - "Colored-chip checkbox control: <label> carries the solid categoryColor()/pulseCategoryColor() fill regardless of checked state (D-14, unchanged), wraps a real <input type=checkbox> with accentColor: CHIP_TEXT, and the checked-state 3px ring moves from the old button's aria-pressed condition to the map's boolean value directly"

key-files:
  created:
    - frontend/src/components/FilterBar.test.tsx
  modified:
    - frontend/src/components/FilterBar.tsx

key-decisions:
  - "Followed the plan's exact action text verbatim — group order, control markup, aria-labels, and the selectedOrAll+joinWithAnd sentence assembly all match Task 1's action description with no deviation."
  - "Scoped every checkbox test query to its own role=group container via within(), not global screen queries — BP Category and Pulse Category both include a 'Normal' option, so a global getByRole('checkbox', { name: 'Normal' }) would ambiguously match two elements. This wasn't explicit in the plan's action text but is required for the tests to run at all; documented as a Rule 1 fix below."

patterns-established:
  - "FilterBar's per-group heading span + role=group wrapper pairing is now the fixed layout unit for this component — a future 5th group would follow the same <div className='flex flex-wrap items-center gap-2'><span>Label:</span><div role='group'>...</div></div> shape."

requirements-completed: [PH15-01]

# Metrics
duration: 9min
completed: 2026-09-17
---

# Phase 15 Plan 05: Convert FilterBar to the 4-Group Checkbox Surface Summary

**Converted `FilterBar.tsx`'s AM/PM and BP Category groups from single-select `aria-pressed` buttons to real multi-select checkboxes matching `ShowPanel.tsx`'s control language, replaced AM/PM with a new four-bucket Time of Day group, added a brand-new Pulse Category group, and created `FilterBar.test.tsx` (11 tests) — the user-facing control surface that makes "Stage 1 AND Stage 2" expressible for the first time.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-17T09:00:55-07:00 (worktree base commit)
- **Completed:** 2026-09-17T09:08:06-07:00
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `FilterBar.tsx` now renders 4 groups left to right, each with a visible heading `<span>` (`Date:`, `Time of Day:`, `BP Category:`, `Pulse Category:`) — matching `ShowPanel.tsx`'s `Show:` prefix precedent, including on the previously-unlabeled Date group
- Time of Day: brand-new 4-bucket checkbox group (`Morning`/`Afternoon`/`Evening`/`Night`) using `ShowPanel.tsx`'s exact `boxClass` plain-checkbox markup, claiming the `"Time of day"` aria-label the removed AM/PM group used to own
- BP Category: converted from `aria-pressed` buttons to real `<input type="checkbox">` inside colored-chip `<label>`s — the solid `categoryColor()` fill stays unconditional (D-14), the checked-state ring moved from the button's active condition to `bpCategory[cat]` directly
- Pulse Category: brand-new group, structurally identical to BP Category, mapping over `PULSE_CLINICAL_ORDER`/`pulseCategoryColor()`
- Live sentence rewritten: date segment unchanged, then Time of Day / BP Category / Pulse Category each collapse via `selectedOrAll(map, allLabel)` and `joinWithAnd` for strict subsets — no more scalar `amPm`/`bpCategory` string checks
- `FilterBar.test.tsx` created (did not exist before this plan): 11 tests covering per-group checkbox counts/names, the "Stage 1 AND Stage 2" multi-select proof, independent single-key mutation, the zero-or-all sentence collapse (0 selected and all-selected both render `"All …"`), `joinWithAnd` subset joining, and the 48px `min-h-12` floor across all 13 checkbox labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert FilterBar to the 4-group checkbox surface** - `cf14282` (feat)
2. **Task 2: FilterBar.test.tsx (new file)** - `f33fc55` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `frontend/src/components/FilterBar.tsx` - 4-group checkbox surface (Date buttons unchanged + visible prefix; Time of Day new; BP Category converted; Pulse Category new); rewritten zero-or-all live sentence
- `frontend/src/components/FilterBar.test.tsx` - new file, 11 tests across 5 `describe` blocks (Time of Day, BP Category, Pulse Category, live sentence, 48px floor)

## Decisions Made
Followed the plan's exact control markup, aria-labels, and sentence-assembly shape as specified in Task 1's action text — no deviation on the component itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped every checkbox test query to its own `role="group"` container via `within()`**
- **Found during:** Task 2, while drafting the BP Category and Pulse Category test blocks
- **Issue:** `CLINICAL_ORDER` (BP Category) and `PULSE_CLINICAL_ORDER` (Pulse Category) both include a `"Normal"` option. A global `screen.getByRole("checkbox", { name: "Normal" })` — the query shape the plan's action text implies by analogy with `ShowPanel.test.tsx`'s flat `screen.getByRole` calls — would throw "multiple elements found" once both groups render, since Testing Library's `getByRole` requires a unique match.
- **Fix:** Added `timeOfDayGroup()`/`bpCategoryGroup()`/`pulseCategoryGroup()` helpers that resolve each `role="group"` container by its `aria-label`, and scoped every checkbox lookup and click through `within(group)`. This is the same disambiguation Testing Library's own docs recommend for repeated accessible names and does not change what behavior is being tested — only how the element is located.
- **Files modified:** `frontend/src/components/FilterBar.test.tsx`
- **Commit:** `f33fc55` (part of Task 2's original commit, not a follow-up fix — caught before first test run)

## Issues Encountered

**Cross-plan type gap (expected, not a bug in this plan's files):** `cd frontend && npx tsc --noEmit` is a confirmed no-op in this repo (root `tsconfig.json` has `"files": []` with project references — same finding 15-03's SUMMARY documented). Running the real check (`npx tsc -b --noEmit`) surfaces `PulseField` type errors at `FilterBar.tsx:167` and `:228` (`"timeOfDay"`/`"pulseCategory"` not yet assignable to `PulseField`), because `lib/agent.ts`'s `PulseField` union — owned by plan 15-06 per `15-PATTERNS.md`'s file classification, not this plan (`files_modified` here is only `FilterBar.tsx`/`FilterBar.test.tsx`) — has not been widened yet in this isolated worktree. The same `tsc -b` run also surfaces ~30 pre-existing errors in `App.tsx`, `agent.ts`, `useStats.ts`, `useVoiceCommand.ts`, and several test files, all stemming from 15-04's already-merged `amPm` removal and all explicitly flagged in 15-03's SUMMARY as owned by later Phase 15 plans (15-06/15-07/15-08). None of these are new; none were introduced by this plan's two files. The whole project type-checks again once all Phase 15 wave-3 plans merge.

Confirmed via `npx vitest run` (full suite): 4 pre-existing failing test files (`agent.test.ts`, `agent-parity.test.ts`, `smoke.test.tsx`, `LoginGate.test.tsx`) — all failing on the same `amPm`/`setAmPm` gap in `lib/agent.ts`/`hooks/useStats.ts`, none touching `FilterBar.tsx` or `FilterBar.test.tsx`. `FilterBar.test.tsx` itself: 11/11 passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `FilterBar.tsx` now exposes the 4-group checkbox surface (`role="group"` labels: `"Date range"`, `"Time of day"`, `"Blood pressure category"`, `"Pulse category"`) that Phase 15's agent-bridge plan (15-06) and any later human-verify checkpoint build against.
- `PulseField` in `lib/agent.ts` still needs `"timeOfDay"`/`"pulseCategory"` added (owned by 15-06) before the whole project type-checks clean again — flagged above, not fixed here per this plan's declared file scope.
