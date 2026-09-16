---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 02
subsystem: api
tags: [fastapi, auth, dependency-injection, pytest]

# Dependency graph
requires:
  - phase: 19-01
    provides: "reject_if_demo dependency defined in backend/app/auth.py (unwired)"
provides:
  - "reject_if_demo wired per-route onto the 4 mutating routes (POST /upload, /labs, /incidents, /procedures)"
  - "backend/tests/test_demo_guard.py: 8-test regression suite covering 403 enforcement, GET/agent unaffected, 401-before-403 ordering, and guard-inert-when-off"
affects: [19-03, 19-04, 19-05, 19-06, 19-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-route dependencies=[Depends(...)] on the @router.post decorator only, never router-level include_router — the established pattern for a guard that must NOT apply to GET routes sharing the same APIRouter"

key-files:
  created:
    - backend/tests/test_demo_guard.py
  modified:
    - backend/app/routers/labs.py
    - backend/app/routers/incidents.py
    - backend/app/routers/procedures.py
    - backend/app/routers/upload.py

key-decisions:
  - "Unrolled the plan's 'one parametrized test acceptable' 403 coverage into 4 individually-named test functions (test_labs_post_403_under_demo_mode etc.) instead of pytest.mark.parametrize — the plan's own acceptance criteria greps for `^def test_` count (>=7), which a parametrized single def under-counts even though it runs the route assertions at collection time."

requirements-completed: [D-03, D-11]

# Metrics
duration: ~12min
completed: 2026-09-16
---

# Phase 19 Plan 02: Wire reject_if_demo onto the 4 write routes Summary

**Attached `dependencies=[Depends(reject_if_demo)]` to the POST decorator of labs/incidents/procedures/upload routers (GET decorators and `app.main`'s router-level `verify_token` untouched), proven by an 8-test `test_demo_guard.py` covering 403 enforcement, GET/`/agent` unaffected, and the 401-before-403 auth-ordering invariant.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-16 (commit `402bf2a` base)
- **Completed:** 2026-09-16T01:05:11-07:00
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 5 (4 routers + 1 new test file)

## Accomplishments
- All 4 mutating routes (`POST /upload`, `/labs`, `/incidents`, `/procedures`) now return 403 on a demo deployment (`SITE_USERNAME` set), regardless of token validity, with one shared opaque `detail` message
- GET routes on the same routers and `POST /agent` proven completely unaffected (still 200) — `/agent`'s continued availability under demo mode is now an explicit test, not an assumed side-effect
- The auth-ordering invariant (`verify_token` fires before `reject_if_demo`) is pinned by `test_missing_token_still_401_on_demo`, closing 19-RESEARCH.md's flagged Assumption A1
- Confirmed the guard is inert dead code when `SITE_USERNAME` is unset (today's real deployment) — zero behavior change for Chris's production site

## Task Commits

TDD flow (RED then GREEN):

1. **RED: add failing demo-guard coverage** - `2bc196c` (test) — 4/8 tests fail as expected (write routes return 422/400, not yet 403); the other 4 (GET-unaffected, agent-unaffected, missing-token, inert-when-off) already pass since nothing was touched yet
2. **GREEN: wire reject_if_demo onto the 4 mutating routes** - `6822e9e` (feat) — routers updated, all 8 demo-guard tests pass, full backend suite 304 passed / 0 failed / 0 regressions; also unrolled the parametrized 403 test into 4 named functions to satisfy the plan's `>=7 def test_` acceptance threshold

**Plan metadata:** (this SUMMARY commit, made by the executor per worktree protocol)

## Files Created/Modified
- `backend/tests/test_demo_guard.py` - New 8-test suite: 4 named 403 tests (one per write route), 1 GET-routes-unaffected test, 1 `/agent`-unaffected test (fake interpreter override, no network call), 1 missing-token-still-401 ordering test, 1 guard-inert-when-SITE_USERNAME-unset regression test
- `backend/app/routers/labs.py` - `create_lab`'s `@router.post` decorator gains `dependencies=[Depends(reject_if_demo)]`; `list_labs`'s `@router.get` untouched
- `backend/app/routers/incidents.py` - same pattern on `create_incident`
- `backend/app/routers/procedures.py` - same pattern on `create_procedure`
- `backend/app/routers/upload.py` - same pattern on `upload`

## Decisions Made
- Used 4 individually-named test functions instead of `pytest.mark.parametrize` for the write-route 403 coverage, because the plan's acceptance criteria greps `^def test_` for a count `>=7` — a parametrized single `def` under-counts against that literal check even though the plan's prose says either style is acceptable. Named functions also make failures easier to identify by route name in CI output.
- Followed the existing `real_gate_client`/`valid_token` fixture idiom from `test_auth_upload.py` verbatim (locally redefined, since pytest fixtures aren't shared across files without a `conftest.py` entry) rather than promoting them to `conftest.py` — out of scope for this plan, and the duplication is small (one fixture pair, already an established pattern in this codebase per `test_auth_upload.py`'s own header comment).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Parametrized test under-counted against the plan's own acceptance grep**
- **Found during:** Task 1 (writing `test_demo_guard.py`)
- **Issue:** Plan's acceptance criteria requires `grep -c "^def test_" backend/tests/test_demo_guard.py` to be `>= 7`. An initial draft used `@pytest.mark.parametrize("path", _WRITE_ROUTES)` over 3 routes, which collapses to a single `def`, yielding only 6 total defs — failing the plan's own literal acceptance check despite full behavioral coverage.
- **Fix:** Unrolled into 4 separately-named functions (`test_labs_post_403_under_demo_mode`, `test_incidents_post_403_under_demo_mode`, `test_procedures_post_403_under_demo_mode`, plus the existing `test_upload_403_under_demo_mode`), bringing the total to 8 defs.
- **Files modified:** `backend/tests/test_demo_guard.py`
- **Verification:** `grep -c "^def test_" backend/tests/test_demo_guard.py` → `8`; `python -m pytest tests/test_demo_guard.py -q` → 8 passed
- **Committed in:** `6822e9e` (part of the GREEN task commit)

---

**Total deviations:** 1 auto-fixed (1 bug/acceptance-mismatch)
**Impact on plan:** Test-only correction to satisfy the plan's own literal acceptance grep; no change to behavioral coverage or scope.

## Issues Encountered
- This worktree had no `backend/.venv` (fresh worktree, per STATE.md's documented Blockers/Concerns pitfall about worktree-isolated Python work). Created a local venv (`python3 -m venv .venv && pip install -e ".[dev]"`) and verified `app.deps.__file__` resolved inside the worktree (not the main repo's editable install) before trusting any test result, per the documented mitigation from Quick 260913-fdm.
- The worktree branch was initially on a stale base (predating any Phase 19 planning docs — `.planning/phases/19-...` didn't exist yet). Corrected via the mandated `git reset --hard` to the orchestrator-specified base commit `402bf2a1a` before starting work, per the worktree branch check protocol.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- D-03's actual enforcement point is now live: a demo deployment is read-only end-to-end, with `/agent` staying fully voice/text-operable for guests (core value preserved).
- Plan 19-01's `reject_if_demo` dependency is now fully wired and regression-tested; downstream plans in this phase (19-03 through 19-07, synthetic seed data / guest UX) can build on a demo deployment that is provably write-blocked.
- No blockers for subsequent phase-19 plans.

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*
