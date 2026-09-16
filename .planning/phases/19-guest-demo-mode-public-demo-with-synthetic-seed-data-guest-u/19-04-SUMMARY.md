---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 04
subsystem: backend
tags: [seed, demo-mode, idempotency, boot-sequence]

# Dependency graph
requires:
  - "backend/app/config.py Settings.site_username (19-01)"
  - "backend/sample_data/demo_records.json (19-03)"
provides:
  - "backend/app/seed.py seed_records(session) -> dict[str, int] — idempotent labs/incidents/procedures seeder, mandatorily wired into main()"
  - "backend/start.sh boot-time auto-seed gated strictly on SITE_USERNAME"
affects: [19-guest-demo-seeding, guest-demo-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "date_cls.fromisoformat()/datetime.fromisoformat() applied to raw JSON date/datetime strings before ORM construction — SQLite's strict Date/DateTime bind processors reject plain strings, unlike the Pydantic-mediated POST routes where FastAPI already parsed them"

key-files:
  created:
    - backend/tests/test_seed.py
  modified:
    - backend/app/seed.py
    - backend/start.sh
    - backend/.env.example

key-decisions:
  - "seed_records() skip check uses session.scalar(select(func.count()).select_from(model)) matching etl.py's existing counting idiom, not the legacy session.query().count() the plan's action prose used as shorthand — same behavior, codebase-consistent style"
  - "Fresh SessionLocal() block for seed_records() reuses the variable name `session` (shadowing the closed prior readings-seed session) to match the plan's literal grep-verifiable acceptance criterion `counts = seed_records(session)`"

patterns-established:
  - "Non-fatal secondary-seed pattern in a CLI entry point: a separate SessionLocal block wrapped in try/except Exception, printing a WARNING to stderr on failure without affecting the primary seed's exit code — reusable if a future data type needs the same one-time-populate-then-leave-alone treatment"

requirements-completed: [D-05, D-07, D-09, D-11]

# Metrics
duration: 25min
completed: 2026-09-16
---

# Phase 19 Plan 04: Labs/Incidents/Procedures Seeder + Boot-Time Auto-Seed Summary

**`seed_records()` idempotently populates labs/incidents/procedures from the committed demo fixture, mandatorily wired into `python -m app.seed`'s `main()`, and `start.sh` now auto-runs that entry point on boot strictly when `SITE_USERNAME` is set — closing the "three of four record types stay empty" gap for both the hosted guest demo and any local clone.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `seed_records(session)` loads `demo_records.json`, skips any table that already has rows (D-07 — a populated table is a terminal state, no reset mechanism needed), and otherwise bulk-inserts, returning the exact per-table added count
- `Incident` rows built field-by-field (`datetime_=...`, never `**row`) mirroring `routers/incidents.py`'s `create_incident` pattern, since the fixture's `datetime` key doesn't match the ORM's `datetime_` attribute
- Mandatorily wired into `main()`: a separate, non-fatal `try`/`except` block calls `seed_records()` after the existing readings seed succeeds, so `python -m app.seed` — both `start.sh`'s boot-time invocation and a plain local run — now populates all four tables in one command, not just readings
- `start.sh` runs `python -m app.seed` between `alembic upgrade head` and the `exec uvicorn` line, gated strictly on `SITE_USERNAME` being non-empty (dead code on Chris's real deployment, which never sets it) with `|| echo ... continuing boot` so a seed failure never blocks the deployment from starting
- `.env.example` documents the new variable with a placeholder only (`choose-a-guest-username`), positioned between the existing `SITE_PASSWORD` and `TOKEN_SECRET` blocks
- `test_seed.py` — the first test file `app/seed.py` has ever had — includes a genuine subprocess test (`test_main_via_actual_entry_point_populates_all_four_tables`) that runs `python -m app.seed` against a freshly migrated, empty SQLite file and confirms all four tables end up populated, proving the wiring is real and exercised through the literal entry point

## Task Commits

Each task was committed atomically (TDD RED/GREEN split preserved):

1. **Task 1 RED: failing tests for seed_records() + entry-point wiring** - `5979dac` (test)
2. **Task 1 GREEN: seed_records() implementation + mandatory main() wiring** - `62323d2` (feat)
3. **Task 2: boot-time auto-seed gate in start.sh + .env.example** - `853c28d` (feat)

**Plan metadata:** (pending — committed by orchestrator after wave completion, per worktree isolation)

## Files Created/Modified

- `backend/tests/test_seed.py` - 4 tests: 3 unit tests against `seed_records(session)` (populate, idempotent second call, `Incident.datetime_` field mapping) + 1 subprocess test running the actual `python -m app.seed` entry point end-to-end
- `backend/app/seed.py` - Added `seed_records(session) -> dict[str, int]`; mandatorily wired into `main()` behind a non-fatal `try`/`except`
- `backend/start.sh` - Boot-time `python -m app.seed` invocation gated strictly on `SITE_USERNAME`, inserted between migrations and uvicorn
- `backend/.env.example` - New `SITE_USERNAME` documentation block, placeholder value only

## Decisions Made

- Used `session.scalar(select(func.count()).select_from(model))` (matching `etl.py`'s existing counting idiom at line 430) rather than the legacy `session.query(model).count()` the plan's action prose used as illustrative shorthand — same behavior, keeps the file consistent with the rest of the codebase's SQLAlchemy 2.0 style.
- Reused the variable name `session` for the fresh `seed_records()` `SessionLocal` block in `main()` (the prior readings-seed `with SessionLocal() as session:` block has already closed and gone out of scope by that point) specifically to match the plan's literal, grep-verified acceptance criterion `counts = seed_records(session)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `demo_records.json`'s date/datetime strings raised `TypeError` against SQLite's strict column types**
- **Found during:** Task 1 implementation, empirically verified with a throwaway script before trusting the fix
- **Issue:** `demo_records.json`'s `date`/`datetime` fields are plain JSON strings (e.g. `"2025-05-15"`, `"2025-05-05T15:49:00"`). Unlike the POST routes (`IncidentCreate`/`LabResultCreate`/`ProcedureCreate`), which are Pydantic models that already coerce these to real `date`/`datetime` objects before the ORM ever sees them, `seed_records()` reads the fixture directly via `json.loads` — so the raw strings reached SQLAlchemy's SQLite dialect, which raises `TypeError: SQLite Date/DateTime type only accepts Python date/datetime objects as input` (confirmed via a direct empirical repro, not assumed).
- **Fix:** Both `LabResult`/`Procedure`'s `date` field and `Incident`'s `datetime` field are parsed via `date.fromisoformat()` / `datetime.fromisoformat()` before construction, matching the naive-local-time convention (DATA-05) every other write path in this codebase already follows.
- **Files modified:** `backend/app/seed.py`
- **Commit:** `62323d2`

Or: all other deviations — none; the rest of the plan (idempotency behavior, `Incident` field-by-field construction, `main()` wiring shape, `start.sh` gate, `.env.example` block) executed exactly as written.

## Issues Encountered

- **Worktree Python environment gap** (matches the documented STATE.md pitfall from Quick 260913-fdm): this worktree has no `.venv` and no `pytest` on the bare `python3`. The main repo's `backend/.venv` (an editable install of `app`) was used to run tests — verified BEFORE trusting any result that, when invoked with `cwd` set to the worktree's `backend/` directory, `import app` resolves to the worktree's own `app/__init__.py` (cwd's empty-string `sys.path[0]` wins over the editable-install meta-path finder), so no test ran against stale main-repo source.

## User Setup Required

None - no external service configuration required. `SITE_USERNAME` is set only on the separate demo deployment's Railway variables when that deployment is created (a later, non-code step outside this plan's scope).

## Next Phase Readiness

- A demo deployment now self-populates all four tables on first boot with zero shell/CLI access required, purely from setting `SITE_USERNAME` in Railway.
- Chris's real deployment's boot sequence is byte-for-byte unaffected — the gate is dead code there.
- No blockers for the remaining Phase 19 plans (19-02, 19-06, 19-07).

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: backend/app/seed.py
- FOUND: backend/tests/test_seed.py
- FOUND: backend/start.sh
- FOUND: backend/.env.example
- FOUND: .planning/phases/19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u/19-04-SUMMARY.md
- FOUND commit: 5979dac (Task 1 RED)
- FOUND commit: 62323d2 (Task 1 GREEN)
- FOUND commit: 853c28d (Task 2)
