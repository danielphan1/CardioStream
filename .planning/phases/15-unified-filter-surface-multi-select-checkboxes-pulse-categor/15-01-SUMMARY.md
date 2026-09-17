---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, readings-filters, backend]

# Dependency graph
requires: []
provides:
  - "ReadingFilters.bp_category converted from scalar equality to list-typed IN-clause (OR-within-group, AND-across-groups)"
  - "ReadingFilters.pulse_category new list-typed IN-clause filter (Bradycardia/Normal/Tachycardia)"
  - "ReadingFilters.time_of_day new query-time-only filter (Morning/Afternoon/Evening/Night) with midnight-wrap handling"
  - "am_pm query filter fully removed from ReadingFilters (Reading.am_pm column and ReadingOut.am_pm field untouched)"
  - "classify_time_of_day pure boundary classifier + _time_of_day_predicate SQL builder in app/deps.py"
  - "ReadingOut.pulse_category tightened to Literal[\"Bradycardia\",\"Normal\",\"Tachycardia\"]"
affects: [15-02, 15-03, 15-04, 15-05, 15-06, 15-07, 15-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "List-typed FastAPI Query filters: Annotated[list[Literal[...]] | None, Query()] = None, with `if self.field:` truthy guard (never `is not None`) to prevent an empty/absent list compiling to SQLAlchemy's always-false IN ()"
    - "Query-time-only derived values (never stored) live in app/deps.py, not app/derivations.py — derivations.py is scoped to values computed once at ETL/ingestion time"
    - "Midnight-wrapping bucket ranges encoded as (lo, hi) tuples with lo > hi as the wrap signal, shared verbatim between the pure classifier and the SQL predicate builder (single source of the boundary numbers)"

key-files:
  created:
    - backend/tests/test_time_of_day.py
  modified:
    - backend/app/deps.py
    - backend/app/schemas.py
    - backend/tests/test_api_readings.py
    - backend/tests/test_api_stats.py

key-decisions:
  - "PD-02 (plan-authored, executed as written): am_pm query filter removed entirely, not converted to a list and not deprecated-but-kept — time_of_day is its functional superset and the frontend will never send am_pm again once Phase 15 ships"
  - "classify_time_of_day placed in app/deps.py, not app/derivations.py — derivations.py's own docstring scopes it to ETL/ingestion-time values; time-of-day is deliberately query-time-only, never stored"
  - "time_of_day integration tests use a dedicated time_of_day_seeded fixture rather than extending the shared seeded fixture, to avoid disturbing the many other tests with hardcoded row-count/category assertions against seeded"

patterns-established:
  - "Zero-or-all list filter convention: None and [] are both falsy in Python, so a single `if self.field:` guard before `.where(...)` is the entire correctness mechanism for 'no selection = no restriction' — documented inline on ReadingFilters.apply()"

requirements-completed: [PH15-02, PH15-03, PH15-03b, PH15-05, PH15-05b, PH15-08]

# Metrics
duration: ~10min
completed: 2026-09-17
---

# Phase 15 Plan 01: Backend Filter Foundation (IN-clause, pulse_category, time_of_day) Summary

**Converted `ReadingFilters.bp_category` to a list-typed `IN`-clause filter, added a new `pulse_category` mirror filter and a brand-new query-time-only `time_of_day` filter with correct midnight-wrap handling, and removed the `am_pm` query filter entirely — the shared backend foundation every other Phase 15 plan (frontend, agent schema, wire contract) builds on.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2/2 completed
- **Files modified:** 4 (1 created, 3 modified) in-plan, plus 1 out-of-scope regression fix (`backend/tests/test_api_stats.py`)

## Accomplishments
- `bp_category` and the new `pulse_category` are both list-typed `IN`-clause filters with correct OR-within-group / AND-across-groups semantics, and a verified zero-or-all guarantee (an absent or empty list never compiles to SQLAlchemy's always-false `IN ()`)
- New `time_of_day` filter (Morning/Afternoon/Evening/Night) is the project's first query-time-only derived value — no ETL/schema change — with `classify_time_of_day` unit-tested at every boundary including the midnight wrap (hour 4→Night, 5→Morning, 20→Evening, 21→Night)
- `am_pm` query filtering fully removed from `ReadingFilters`, with a regression test proving it's now a silently-ignored unrecognized param, not a 422 and not a filter; `Reading.am_pm` column and `ReadingOut.am_pm` response field are untouched
- `ReadingOut.pulse_category` tightened from `str` to `Literal["Bradycardia", "Normal", "Tachycardia"]`
- Full backend suite: 325 passed, 7 skipped (pre-existing `live` marker deselection), 0 failed

## Task Commits

1. **Task 1: Convert bp_category to IN-clause, add pulse_category, remove am_pm** - `f4150c1` (feat)
2. **Task 2: Add time_of_day — pure boundary classifier + SQL predicate + tests** - `17e62ae` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `backend/app/deps.py` - `PulseCategory`/`TimeOfDayBucket` Literals, `_TIME_OF_DAY_HOURS` table, `_hour_in_bucket`/`classify_time_of_day`/`_time_of_day_predicate`, `ReadingFilters` list-typed `bp_category`/`pulse_category`/`time_of_day` with `am_pm` removed
- `backend/app/schemas.py` - `ReadingOut.pulse_category` tightened to `Literal[...]`
- `backend/tests/test_time_of_day.py` - new: boundary classifier unit tests (10 parametrized cases, midnight wrap covered)
- `backend/tests/test_api_readings.py` - dropped `test_am_pm_filter`, rewrote `test_filters_combine`/added `test_date_range_combines_with_bp_category` to prove AND-across-groups without `am_pm`, added OR-within-group/omitted-filter/pulse_category/time_of_day-wrap tests, added `time_of_day_seeded` fixture, extended the invalid-params 422 parametrize list
- `backend/tests/test_api_stats.py` - fixed two tests that depended on the now-removed `am_pm` query param (see Deviations)

## Decisions Made
- PD-02 (already locked in the plan's own objective, executed as written): `am_pm` removed entirely rather than converted or deprecated-in-place
- `classify_time_of_day` placed in `app/deps.py` rather than `app/derivations.py`, per the plan's explicit instruction and `derivations.py`'s own ETL-scoped docstring
- Used a dedicated `time_of_day_seeded` fixture in `test_api_readings.py` instead of mutating the shared `seeded` fixture, to keep the many existing hardcoded-count assertions against `seeded` unaffected

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `am_pm`-dependent tests in `backend/tests/test_api_stats.py`**
- **Found during:** Task 1 (removing the `am_pm` query filter)
- **Issue:** `test_stats_respect_same_filters_as_readings` and `test_invalid_params_return_422` in `test_api_stats.py` (not in this plan's declared `files_modified`, but consuming the same shared `ReadingFilters`) both sent `am_pm` as a query param — one expecting it to filter rows, the other expecting `am_pm=MORNING` to 422. Removing the `am_pm` parameter turns both into false negatives (silently-ignored no-op instead of a filter; no-longer-validated param instead of a 422). The plan's own overall `<verification>` explicitly requires "full backend suite green (no am_pm-filter regressions elsewhere)", so this was in-scope for the plan's success criteria even though outside the per-task `files_modified` list.
- **Fix:** Rewrote `test_stats_respect_same_filters_as_readings` to use `bp_category=Stage 1` instead of `am_pm=PM` (same two seeded rows, same expected aggregate values). Rewrote `test_invalid_params_return_422` to use `bp_category=stage 1` (wrong case) instead of `am_pm=MORNING`.
- **Files modified:** `backend/tests/test_api_stats.py`
- **Verification:** Full backend suite (`pytest -q`) green: 325 passed, 7 skipped, 0 failed
- **Committed in:** `f4150c1` (Task 1 commit, staged alongside the other Task 1 files since it's a direct consequence of that task's `am_pm` removal)

---

**Total deviations:** 1 auto-fixed (1 bug/regression fix, Rule 1)
**Impact on plan:** Necessary to satisfy the plan's own verification requirement ("no am_pm-filter regressions elsewhere"); no scope creep beyond fixing the two broken assertions.

## Issues Encountered
- This worktree had no local `.venv` and the main repo's `.venv` has an editable install of `app` that would silently shadow the worktree's modified source (known risk, documented in STATE.md's `260913-fdm`/worktree note). Created a fresh `.venv` inside the worktree's `backend/` directory and confirmed `app.__file__` resolved inside the worktree before trusting any test result.

## Next Phase Readiness
- Backend filter foundation (`bp_category`/`pulse_category`/`time_of_day` list filters, `am_pm` removed) is complete, tested, and has zero dependency on any other Phase 15 plan — unblocks the frontend store-shape conversion, the agent schema conversion (PH15-06), and the wire-contract plans.
- No blockers.

---
*Phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor*
*Completed: 2026-09-17*
