---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 06
subsystem: ui
tags: [react, zustand, tanstack-query, vitest, accessibility]

requires:
  - phase: 19-05
    provides: "HealthStatus.demo field on getHealth()/useHealth(), backend /health demo flag"
provides:
  - "LoginGate conditional Username field, driven by a plain getHealth() useEffect (no QueryClientProvider dependency)"
  - "Header persistent 'Guest Demo · Synthetic Data' badge and individually-hidden Upload/Add Record buttons, driven by useHealth()"
affects: [19-07]

tech-stack:
  added: []
  patterns:
    - "Two different demoMode-detection mechanisms for the same boolean, chosen by mount context: LoginGate (pre-QueryClientProvider, standalone-tested) uses a raw useEffect + getHealth(); Header (always inside the authed QueryClientProvider tree) reuses the existing useHealth() TanStack Query hook with zero new fetch"
    - "Wrap each conditionally-hidden control individually in {!demoMode && (...)}, not the surrounding fragment — prevents a future addition to the same block from being accidentally swept up by a coarser guard"

key-files:
  created:
    - frontend/src/components/Header.test.tsx
  modified:
    - frontend/src/components/LoginGate.tsx
    - frontend/src/components/LoginGate.test.tsx
    - frontend/src/components/Header.tsx

key-decisions:
  - "LoginGate detects demoMode via a plain useEffect + getHealth(), not useHealth() — LoginGate renders standalone in unit tests with no QueryClientProvider ancestor (19-RESEARCH.md Pitfall 4), a deliberate deviation from 19-UI-SPEC.md's literal suggestion for a smaller test blast radius with the same single-source-of-truth outcome"
  - "Header reuses the existing useHealth() hook (already polling /health every 60s for AgentStatusBanner) — zero new fetch call, since Header is always mounted deep inside the authed, QueryClientProvider-wrapped tree"

requirements-completed: [D-04, D-08, D-11]

duration: ~25min
completed: 2026-09-16
---

# Phase 19 Plan 06: LoginGate Guest Field + Header Demo Badge Summary

**LoginGate's guest-username field (raw getHealth() useEffect) and Header's persistent demo badge + individually-hidden write buttons (existing useHealth() hook) — both driven by the same `demoMode` boolean via the mechanism appropriate to where each component mounts.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `LoginGate` shows a conditional "Username" field above "Password" only when `getHealth()` resolves `demo: true`; submit is gated on both fields in demo mode; demo-specific heading and rejection copy render correctly; Chris's real deployment (`demo: false`) is byte-for-byte unchanged.
- `Header` shows a `role="status"` "Guest Demo · Synthetic Data" badge and individually hides the "Upload" and "Add Record" buttons when `demo: true`, with zero new network fetch (reuses `useHealth()`).
- The pre-auth "no PHI leak" invariant (T-05-10) is now stated precisely — `LoginGate`'s one fetch is proven scoped to `/health` via a dedicated fail-first regression test, not a blanket "zero fetches" assertion.

## Task Commits

Each task followed the RED → GREEN TDD cycle with 2 commits each:

1. **Task 1: LoginGate — conditional guest-username field**
   - `a9444e0` (test) — 6 new/changed assertions confirmed failing against unmodified `LoginGate.tsx`
   - `962217b` (feat) — implementation + 2 pre-existing assertion fixes for `postAuth`'s new 2-arg signature; 12/12 tests green, tsc clean
2. **Task 2: Header — demo badge + hidden write buttons**
   - `654eeb7` (test) — new `Header.test.tsx`, 3/5 tests confirmed failing against unmodified `Header.tsx`
   - `f08f2da` (feat) — implementation; 5/5 tests green, tsc clean

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `frontend/src/components/LoginGate.tsx` - conditional Username field, `demoMode` state via `useEffect(getHealth)`, gated submit, demo-specific heading/rejection copy
- `frontend/src/components/LoginGate.test.tsx` - URL-branching `fetchMock`/`mockHealthDemo` helper, precise `/health`-scoped no-leak assertion + fail-first regression, 4 new demo-mode tests, 2 pre-existing assertions updated for `postAuth`'s 2-arg call
- `frontend/src/components/Header.tsx` - `useHealth()`-driven `demoMode`, badge in title group, Upload/Add Record each individually wrapped in `{!demoMode && (...)}`
- `frontend/src/components/Header.test.tsx` (new) - 5 tests: badge shown/hidden, buttons hidden/shown, other controls untouched

## Decisions Made

- `LoginGate` uses a raw `useEffect` + `getHealth()` rather than `useHealth()` — see key-decisions in frontmatter. This is a deliberate, plan-documented deviation from `19-UI-SPEC.md`'s literal suggestion, not an ad-hoc choice.
- `Header` reuses the existing `useHealth()` hook with zero new fetch — see key-decisions in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 2 pre-existing LoginGate.test.tsx assertions broken by the postAuth signature change**
- **Found during:** Task 1, GREEN phase test run
- **Issue:** The plan's own specified change — `postAuth(password, demoMode ? username : undefined)` — means `postAuth` is now always called with 2 arguments (the second explicitly `undefined` outside demo mode). Two pre-existing tests ("calls postAuth then useAuth.login on a successful submit", "submits on the Enter key") asserted `toHaveBeenCalledWith("hunter2")` (1 arg), which vitest treats as an exact-arity mismatch against the actual 2-arg call and fails.
- **Fix:** Updated both assertions to `toHaveBeenCalledWith("hunter2", undefined)`, matching the new (and correct, per-plan) call signature.
- **Files modified:** `frontend/src/components/LoginGate.test.tsx`
- **Verification:** `npx vitest run src/components/LoginGate.test.tsx` — 12/12 green
- **Committed in:** `962217b` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary consequence of the plan's own specified `postAuth` signature change; no scope creep, no behavior change beyond what the plan already specified.

## Issues Encountered

None beyond the deviation above.

## Threat Model Compliance

- T-19-06-01 (Information Disclosure, rejection copy): confirmed — "That username or password didn't work." never states which field was wrong.
- T-19-06-02 (Information Disclosure, pre-auth `/health` fetch): confirmed via the new fail-first regression test (`fetchMock.mock.calls.every(...)` asserting every call targets `/health`).
- T-19-06-03 (not a security control, hidden buttons): accepted per plan — UX-only, server-side `reject_if_demo` (Plan 19-02) is the real boundary.
- T-19-06-04 (Tampering, untested regression / D-11 fail-first): confirmed — both tasks' new/changed assertions were run and observed to FAIL against the pre-fix components before implementation (see Task Commits above).

No new threat surface introduced beyond what's already in the plan's threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both visible demo-mode surfaces (`LoginGate`, `Header`) are complete and verified; full frontend suite (493 tests) and `tsc -b --noEmit` are green with zero regressions.
- Plan 19-07 (or any remaining wave-2/wave-3 work) can proceed — nothing in this plan blocks downstream plans; `getHealth`/`useHealth`'s `demo` field (from 19-05) is now consumed by both intended frontend surfaces.

## Self-Check: PASSED

- FOUND: frontend/src/components/LoginGate.tsx
- FOUND: frontend/src/components/LoginGate.test.tsx
- FOUND: frontend/src/components/Header.tsx
- FOUND: frontend/src/components/Header.test.tsx
- FOUND: a9444e0
- FOUND: 962217b
- FOUND: 654eeb7
- FOUND: f08f2da

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*
