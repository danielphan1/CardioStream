---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 08
subsystem: frontend-tests
tags: [testing, agent-parity, filter-store, voice-vocabulary]
dependency-graph:
  requires: ["15-02", "15-04", "15-06"]
  provides: "a fully green frontend test suite against the v3 FilterState shape, plus a rewritten agent-parity.test.ts proving full voice-reachability and frontend/backend token parity for the three category filter groups"
  affects: []
tech-stack:
  added: []
  patterns:
    - "self-contained per-file test fixtures (no shared constant import) mirroring visibleDatasets's existing inline-literal style"
    - "regex cross-file parity check tolerant of formatter line-wrapping (\\s* between adjacent brackets)"
key-files:
  created: []
  modified:
    - frontend/src/components/ChartDeck.test.tsx
    - frontend/src/components/CommandBar.test.tsx
    - frontend/src/components/ShowPanel.test.tsx
    - frontend/src/hooks/useVoiceCommand.test.ts
    - frontend/src/lib/agent-parity.test.ts
decisions:
  - "STORE_ACTIONS ends up at 9 entries (8 today minus setAmPm, plus setPulseCategory/setTimeOfDay) — the three toggle* category actions stay UI-only and excluded from both STORE_ACTIONS and the actualActions surface filter, exactly mirroring the pre-existing initFilters exclusion rationale"
  - "agent-parity.test.ts's bpCategory backend-token regex uses \\s* between list[ and Literal[ rather than the plan's literal adjacent-bracket text, because ruff wraps that one field across three lines (list[\\n Literal[...]\\n]) while pulseCategory/timeOfDay stay on one line — \\s* matches both shapes"
metrics:
  duration: "~3 min (09:15:41 - 09:18:19 between the two task commits)"
  completed: 2026-09-17
---

# Phase 15 Plan 08: Frontend Test Suite v3 Migration + Agent Parity Rewrite Summary

Repaired the last four frontend test fixtures still constructing the pre-Phase-15 scalar `amPm`/`bpCategory` filter-store shape, and fully rewrote `lib/agent-parity.test.ts` — the ACC-03/D-15 lockstep test — against the real, already-shipped v3 `FilterState` (multi-select `bpCategory`/`pulseCategory`/`timeOfDay` maps) and the real `backend/app/agent/schemas.py` on disk.

## What Was Built

**Task 1 — Four scalar-fixture test files repaired.** `ChartDeck.test.tsx` and `ShowPanel.test.tsx`'s module-level `INITIAL`/`INITIAL_FILTERS` constants, and `CommandBar.test.tsx`/`useVoiceCommand.test.ts`'s `beforeEach` `useFilters.setState({...})` seeds, all dropped the removed `amPm` field and replaced the scalar `bpCategory: "all"` with three inline all-false boolean maps (`bpCategory` ×6 keys, `pulseCategory` ×3 keys, `timeOfDay` ×4 keys) — written as self-contained object literals matching each file's existing `visibleDatasets` style, no shared constant import. `ShowPanel.test.tsx`'s D-08 pulse-parity test also had its `mark(["amPm"])` call changed to `mark(["bpCategory"])`, since `"amPm"` is no longer a member of the `PulseField` union.

**Task 2 — `lib/agent-parity.test.ts` rewritten for the v3 schema.** The `AMPM` constant and its `it.each` block are gone. Added `PULSE_CATEGORIES` (3 values) and `TIME_OF_DAY_BUCKETS` (4 values) mirroring `BP_CATEGORIES`'s `as const satisfies readonly ...[]` shape. The `beforeEach` seed and the enumeration-reachability tests were converted to the list-replace form (`applyAgentFilters({ bpCategory: [category] })` → asserts `bpCategory[category] === true`), with matching new blocks for `pulseCategory`/`timeOfDay`. `STORE_ACTIONS` now has exactly 9 entries (`setAmPm` removed, `setPulseCategory`/`setTimeOfDay` added); the three `toggle*` category actions are explicitly excluded from both `STORE_ACTIONS` and the `actualActions` surface-comparison filter, with a code comment documenting why (UI-only, no `AppliedFilters` field drives a single-key toggle). The `CASES` array's old `setAmPm` object was converted in place into the new list-replace `setBpCategory` case, and the separate pre-existing scalar `setBpCategory` duplicate was deleted — the array now has exactly one `setBpCategory` entry. Two new `CASES` entries were added for `setPulseCategory`/`setTimeOfDay`. The D-15 backend-token parity tests were updated: the `bpCategory` regex now matches `bpCategory: list[Literal[...]]`, tolerant of whitespace/newlines between the two opening brackets (see Deviations), and its expected value dropped the `"all"` sentinel; two new parity tests were added for `pulseCategory`/`timeOfDay` mirroring the same shape.

## Verification

- `agent-parity.test.ts` alone: 53/53 passing
- Full frontend suite (`npx vitest run`): 39 test files, 523/523 passing
- `npx tsc -b --force`: zero type errors across the whole project
- `grep -n 'amPm\|"all"' frontend/src/lib/agent-parity.test.ts`: only legitimate `datePreset` `"all"`-value references remain (that field's `"all"` is a real, unchanged value in the schema) — no scalar `amPm`/`bpCategory` shape references

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `npx tsc --noEmit` is a no-op in this repo; substituted `npx tsc -b --force`**
- **Found during:** Task 1 verification
- **Issue:** The plan's own `<verify>` command for both tasks was `npx tsc --noEmit`. This repo's root `tsconfig.json` has `"files": []` and only `references` to `tsconfig.app.json`/`tsconfig.node.json` — running plain `tsc --noEmit` at the root resolves zero files (confirmed via `--listFiles`) and always exits 0, silently skipping type-checking entirely regardless of real errors.
- **Fix:** Used `npx tsc -b --force` (project-reference build mode, which respects each referenced project's own `noEmit: true` and therefore only type-checks, no JS emitted) as the real verification gate for both tasks.
- **Files modified:** None (verification-only substitution, no source change)
- **Commit:** N/A (verification methodology only)

**2. [Rule 1 - Bug] agent-parity.test.ts's bpCategory backend-token regex needed `\s*` between brackets, not the plan's literal adjacent-bracket text**
- **Found during:** Task 2, before writing the regex
- **Issue:** The plan's action text specified the replacement regex as `/bpCategory: list\[Literal\[([^\]]*)\]\]/` (brackets immediately adjacent). The real `backend/app/agent/schemas.py` has ruff-formatted this one field across three lines (`bpCategory: list[\n        Literal["Hypotension", ...]\n    ] | None = None`) because the single-line form exceeds the line-length limit — `pulseCategory`/`timeOfDay` stay on one line since they're shorter. A literal-adjacent regex would silently match `null` (no error, but `literalTokens(null)` returns `[]`, so the parity assertion would false-fail against an empty array instead of comparing real tokens).
- **Fix:** Added `\s*` between `list[` and `Literal[`, and between the inner `Literal[...]`'s closing `]` and the outer closing `]`, so the pattern matches both the wrapped `bpCategory` field and the single-line `pulseCategory`/`timeOfDay` fields identically. Verified directly against the real file via a standalone Node script before writing the test.
- **Files modified:** `frontend/src/lib/agent-parity.test.ts`
- **Commit:** da87d72

## Known Stubs

None — this plan touched only test files; no runtime UI/data paths were modified.

## Self-Check: PASSED

- `frontend/src/components/ChartDeck.test.tsx` — FOUND
- `frontend/src/components/CommandBar.test.tsx` — FOUND
- `frontend/src/components/ShowPanel.test.tsx` — FOUND
- `frontend/src/hooks/useVoiceCommand.test.ts` — FOUND
- `frontend/src/lib/agent-parity.test.ts` — FOUND (contains `toggleBpCategory` per the must-haves `contains` check)
- Commit `ca297cd` — FOUND in `git log --oneline --all`
- Commit `da87d72` — FOUND in `git log --oneline --all`
