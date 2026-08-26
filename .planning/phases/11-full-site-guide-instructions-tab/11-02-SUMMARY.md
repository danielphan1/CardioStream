---
phase: 11-full-site-guide-instructions-tab
plan: 02
subsystem: ui
tags: [zustand, react, typescript, agent-fanout, guide-overlay]

# Dependency graph
requires:
  - phase: 09-multi-dataset-overlay-filtering
    provides: "explicit-state (never toggle/flip) voice-action precedent, present-value-delta fan-out discipline in applyAgentFilters"
  - phase: 10-spoken-replies-tts
    provides: "store/speech.ts's setEnabled/toggleEnabled naming convention and the speechEnabled branch in applyAgentFilters this plan mirrors"
provides:
  - "frontend/src/store/guide.ts — ephemeral useGuide store (open/setOpen/toggleOpen), the single visibility source Plan 11-04's GuideOverlay/Header button will read"
  - "frontend/src/api/types.ts's AppliedFilters.guideOpen field — the frontend half of the wire contract Plan 11-01 defines on the backend"
  - "applyAgentFilters's guideOpen branch + D-07 auto-close check — the ONE place a server-composed guideOpen delta or any other command reaches the guide's visibility state"
affects: [11-04-guide-overlay-header-button, 11-01-backend-toggle-guide-schema]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ephemeral zustand store with no localStorage (store/view.ts shape) paired with speech.ts-style setX/toggleX action naming"
    - "D-07 auto-close: an explicitly enumerated hasOtherCommand boolean (never Object.keys(f)) guards a side-effect check placed at the top of applyAgentFilters, before any per-field branch"

key-files:
  created:
    - frontend/src/store/guide.ts
    - frontend/src/store/guide.test.ts
  modified:
    - frontend/src/api/types.ts
    - frontend/src/lib/agent.ts
    - frontend/src/lib/agent.test.ts

key-decisions:
  - "useGuide has zero persistence code (no localStorage) per D-01's per-session framing — verified via grep -c localStorage == 0"
  - "hasOtherCommand is explicitly enumerated field-by-field, not derived from Object.keys(f), because FastAPI's response_model always serializes every AppliedFilters key (including nulls) — an Object.keys presence check would always be true and falsely auto-close the guide on every delta, including guideOpen-only ones"

patterns-established:
  - "Pattern: guide.ts's open/setOpen/toggleOpen naming — the template Plan 11-04's Header button and any future ephemeral UI-visibility store should follow"

requirements-completed: [GUIDE-03]

# Metrics
duration: ~15min
completed: 2026-08-26
---

# Phase 11 Plan 02: Guide Store + Agent Fan-Out Wiring Summary

**Ephemeral `useGuide` zustand store plus `applyAgentFilters`'s `guideOpen` branch and D-07 auto-close check, giving Plan 11-04's `GuideOverlay`/Header button a fully wired, independently-tested visibility contract before either component exists.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-26T00:56:42Z
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `store/guide.ts` — ephemeral `useGuide` (open defaults false, `setOpen`, `toggleOpen`), zero localStorage, mirrors `store/view.ts`'s no-persistence shape with `store/speech.ts`'s action-naming convention
- `AppliedFilters.guideOpen?: "open" | "closed" | null` added to `api/types.ts`, positioned after `speechEnabled` per the plan's field ordering
- `applyAgentFilters`'s new `guideOpen` branch routes a server-composed delta straight to `useGuide.getState().setOpen(...)`, with no `touched.add(...)` call (guide isn't a FilterBar pulse group)
- D-07 auto-close: an explicitly-enumerated `hasOtherCommand` check closes an already-open guide whenever the same delta carries any other command field, verified to NOT fire on a `guideOpen`-only delta or an empty delta

## Task Commits

Each task followed the RED → GREEN TDD cycle with separate commits:

1. **Task 1: store/guide.ts + guide.test.ts + api/types.ts guideOpen field**
   - `f8bb185` (test) — failing test for guide store open/setOpen/toggleOpen (RED: import of `./guide` failed, module didn't exist)
   - `76e2af5` (feat) — implemented guide store + `AppliedFilters.guideOpen` field (GREEN: 5/5 guide.test.ts, tsc clean)
2. **Task 2: lib/agent.ts guideOpen branch + D-07 auto-close + lib/agent.test.ts**
   - `cde8eaa` (test) — 4 failing tests for guideOpen fan-out + D-07 auto-close (RED: 4/4 new tests failed, 12 pre-existing tests still passed)
   - `2d31b75` (feat) — routed guideOpen through applyAgentFilters + D-07 auto-close (GREEN: 21/21 across both test files, tsc clean)

**Plan metadata:** committed alongside this SUMMARY.md (see final commit below)

## Files Created/Modified
- `frontend/src/store/guide.ts` - ephemeral zustand store: `open` (default false), `setOpen(open)`, `toggleOpen()`
- `frontend/src/store/guide.test.ts` - 5 tests covering default state, setOpen(true/false), toggleOpen both directions
- `frontend/src/api/types.ts` - added `guideOpen?: "open" | "closed" | null;` to `AppliedFilters`, after `speechEnabled`, before `reset`
- `frontend/src/lib/agent.ts` - added `useGuide` import, `hasOtherCommand`/D-07 auto-close check (runs before the `f.reset` block), and the `f.guideOpen != null` branch (after the `speechEnabled` block)
- `frontend/src/lib/agent.test.ts` - added `useGuide` import + `beforeEach` reset, plus 4 new tests: guideOpen-reaches-setOpen, unrelated-command-auto-closes, guideOpen-only-delta-doesn't-retrigger, reset-also-auto-closes

## Decisions Made
- Followed the plan's exact spec for `hasOtherCommand`'s field enumeration and insertion point (top of `applyAgentFilters`, before the `f.reset` block) — no deviation from the plan's own worked-through design.
- No backend `guideOpen`/`ToggleGuide` code exists yet in this worktree (Plan 11-01 is a separate wave-1 plan with `depends_on: []`, run in parallel) — this plan's frontend-only `AppliedFilters.guideOpen` field matches the Literal shape both 11-CONTEXT.md and 11-PATTERNS.md specify for the backend mirror, so no rework is expected when 11-01 merges.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `node_modules` was absent in this fresh worktree checkout; ran `npm ci` in `frontend/` before any test/typecheck command (standard worktree setup, not a plan deviation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 11-04 (`GuideOverlay`, Header "Guide" button) can now import `useGuide` directly and rely on `setOpen`/`toggleOpen` exactly as specified in 11-PATTERNS.md's recommended shape.
- Plan 11-01 (backend `ToggleGuide` schema + `AppliedFilters.guideOpen`) is independent (wave 1, no `depends_on`) — once merged, the wire contract will match this plan's frontend `guideOpen?: "open" | "closed" | null` field byte-for-byte, no follow-up change anticipated.
- Full frontend suite (308 tests, 26 files) passes with zero regressions from these shared-file edits (`api/types.ts`, `lib/agent.ts`).

---
*Phase: 11-full-site-guide-instructions-tab*
*Completed: 2026-08-26*

## Self-Check: PASSED

All claimed files verified present on disk (guide.ts, guide.test.ts, SUMMARY.md) and all 5 commit hashes (f8bb185, 76e2af5, cde8eaa, 2d31b75, c3f9e47) verified present in git log.
