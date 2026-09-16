---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 05
subsystem: api
tags: [typescript, react, tanstack-query, auth, demo-mode]

# Dependency graph
requires:
  - phase: 19-01
    provides: "Backend /health `demo: bool(site_username)` extension and /auth optional username field this plan mirrors on the frontend"
provides:
  - "HealthStatus.demo: boolean — the required frontend wire-contract field Header.tsx (Plan 19-06) reads for the demo badge and write-UI hiding"
  - "postAuth(password, username?) — the widened client function LoginGate.tsx (Plan 19-06) calls for demo-mode login"
  - "Both pre-existing HealthStatus test-mock call sites (useHealth.test.ts, AgentStatusBanner.test.tsx) updated in the same commit as the type widening, keeping tsc -b green"
affects: [19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional trailing parameter passed through unconditionally to postJson — JSON.stringify drops the undefined key, matching the backend's Pydantic Optional default with no special-casing on either side"

key-files:
  created: []
  modified:
    - frontend/src/api/types.ts
    - frontend/src/api/client.ts
    - frontend/src/hooks/useHealth.test.ts
    - frontend/src/components/AgentStatusBanner.test.tsx

key-decisions:
  - "Widened postAuth's signature to a single-line declaration to satisfy the plan's literal grep acceptance criteria — this project has no Prettier config/dependency (lint is oxlint-only), so there is no formatter conflict"

patterns-established:
  - "Type-widening ripple containment: when a required field is added to a shared wire-contract type, grep every call site typed against the old shape and fix all of them in the same commit as the type change, not deferred to whichever later plan happens to run tsc -b first"

requirements-completed: [D-03]

# Metrics
duration: ~12min
completed: 2026-09-16
---

# Phase 19 Plan 05: Widen HealthStatus + postAuth Summary

**Widened the frontend `HealthStatus`/`postAuth` wire-contract types for guest demo mode and fixed every ripple site the type change touched, keeping `tsc -b` and the full Vitest suite green.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-16T00:45:50-07:00 (worktree base commit)
- **Completed:** 2026-09-16T00:53:23-07:00
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `HealthStatus` now carries a required `demo: boolean` field, mirroring backend Plan 19-01's `/health` extension byte-for-byte
- `postAuth` accepts an optional `username`, passed through unconditionally to `postJson`, matching the backend's `username: str | None = None` default
- Both pre-existing `health()` test-mock helpers (`useHealth.test.ts`, `AgentStatusBanner.test.tsx`) updated to satisfy the widened type, in the same commit as the type change
- A second, plan-unlisted `HealthStatus` literal assertion in `useHealth.test.ts` (not covered by the `health()` helper) also fixed — found because the plan's own verification command (full `tsc -b` / targeted vitest run) was executed literally, not skipped
- Full frontend suite (483 tests, 37 files) green; `tsc -b --noEmit` exits 0 project-wide

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen HealthStatus + postAuth** - `9c1b1fe` (feat)
2. **Task 2: Fix the two existing HealthStatus mock helpers (Pitfall 2)** - `e3a7873` (test)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `frontend/src/api/types.ts` - `HealthStatus` gains `demo: boolean`; leading comment updated to reference backend Plan 19-01
- `frontend/src/api/client.ts` - `postAuth(password, username?)` widened signature; body passes `{ password, username }` to `postJson`
- `frontend/src/hooks/useHealth.test.ts` - `health()` helper base literal gains `demo: false`; a second, standalone `toEqual` literal assertion also fixed
- `frontend/src/components/AgentStatusBanner.test.tsx` - `health()` helper base literal gains `demo: false`

## Decisions Made
- Formatted `postAuth`'s signature as a single line (`export function postAuth(password: string, username?: string): Promise<{ token: string }> {`) to satisfy the plan's literal `grep -n "postAuth(password: string, username?: string)"` acceptance check. Confirmed no formatter conflict: this project has no `.prettierrc`/`prettier` devDependency, `lint` runs `oxlint` only.
- Fresh worktree had no `frontend/node_modules` (a known worktree-isolation gap per STATE.md's 260913-fdm note) — ran `npm install` before any `tsc`/`vitest` verification command could execute; this is standard worktree setup, not a deviation from the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a second HealthStatus literal assertion in useHealth.test.ts missed by the plan's grep**
- **Found during:** Task 2 (Fix the two existing HealthStatus mock helpers)
- **Issue:** The plan's Pitfall 2 analysis (from 19-RESEARCH.md) identified exactly two `health()` helper definitions as the blast radius of the `demo: boolean` field addition. Running the plan's own verification command (`npx vitest run src/hooks/useHealth.test.ts src/components/AgentStatusBanner.test.tsx`) surfaced a third break: `useHealth.test.ts`'s "surfaces the resolved HealthStatus body verbatim" test asserts `result.current.data` against a separate, hand-written object literal (not built via the `health()` helper) that also lacked the `demo` field, causing a `toEqual` mismatch.
- **Fix:** Added `demo: false` to the standalone literal at `useHealth.test.ts` line ~59, alongside the already-planned `health()` helper fix.
- **Files modified:** `frontend/src/hooks/useHealth.test.ts`
- **Verification:** `npx vitest run src/hooks/useHealth.test.ts src/components/AgentStatusBanner.test.tsx` — 10/10 tests pass; full suite (483 tests) confirmed green afterward
- **Committed in:** `e3a7873` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, a direct blocking consequence of Task 1's type widening)
**Impact on plan:** Necessary for correctness — the plan's own stated verification step (running the targeted test files, not just grepping for `demo: false`) would have failed without this fix. No scope creep; the plan's `<done>` criterion ("no test in either file regresses") required it.

## Issues Encountered
- Fresh worktree had no `frontend/node_modules` — resolved with `npm install` before running any verification command. Not a code issue, standard worktree setup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `HealthStatus.demo` and `postAuth(password, username?)` are the exact shapes Plan 19-06 (LoginGate + Header) needs to build against — both `key_links` from 19-05-PLAN.md's frontmatter (`postAuth(password, demoMode ? username : undefined)` and `useHealth().data?.demo`) are satisfied by this plan's output.
- No blockers for Plan 19-06.

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*
