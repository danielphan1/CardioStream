---
phase: 01-data-foundation
plan: 02
subsystem: database
tags: [sqlalchemy, alembic, schema, migrations, sqlite, postgres]

# Dependency graph
requires:
  - phase: 01-data-foundation
    plan: 01
    provides: "backend scaffold, pinned deps, app.config.get_settings(), app.db engine"
provides:
  - "backend/app/models.py: Base(DeclarativeBase) with 5-key naming convention; Reading + LabResult + Incident + Procedure typed declarative models"
  - "Reading model with UniqueConstraint('datetime') — DATA-03 hard guarantee, named uq_readings_datetime"
  - "Naive DateTime/Date everywhere — no timezone in any column (DATA-05)"
  - "Alembic environment: render_as_batch=True (both modes), target_metadata = Base.metadata, URL from get_settings().database_url (DATABASE_URL env)"
  - "Two migrations: 0001 bb7feabf6399 (readings), 0002 0e2b4637ae04 (empty future tables, DATA-06)"
  - "backend/tests/test_migrations.py: models-vs-migrations drift guard (RESEARCH Pitfall 7)"
affects: [01-06, 01-07, phase-2-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constraint naming convention on MetaData — every constraint named at model-definition time (SQLite batch-migration prerequisite)"
    - "Numeric(5, 1, asdecimal=False) for MAP — floats consistently on SQLite and Postgres (RESEARCH Pitfall 6)"
    - "Alembic URL injected in env.py via config.set_main_option from app settings — DATABASE_URL controls migrations exactly like the app"
    - "Unit tests use create_all; migrations exercised ONLY in test_migrations.py (drift guard)"

key-files:
  created:
    - backend/app/models.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/script.py.mako
    - backend/alembic/README
    - backend/alembic/versions/bb7feabf6399_create_readings_table.py
    - backend/alembic/versions/0e2b4637ae04_create_future_tables_lab_results_.py
    - backend/tests/test_migrations.py
  modified: []

key-decisions:
  - "Two-migration granularity (readings first, future tables second) per RESEARCH.md discretion recommendation — documented in migration 0002 docstring"
  - "Incident.duration typed as nullable Text (format unknown, e.g. '5 min'); incidents.datetime/incident_type and procedures.date/procedure_name non-null mirroring lab_results date/test_name pattern"
  - "Alembic-scaffolded README committed with the environment (part of alembic init output)"

patterns-established:
  - "Model attribute names avoid Python shadowing while DB columns keep sketch names: datetime_ -> column 'datetime', map_value -> column 'map'"

requirements-completed: [DATA-03, DATA-05, DATA-06]

# Metrics
duration: 15min
completed: 2026-07-09
---

# Phase 01 Plan 02: Schema and Migrations Summary

**SQLAlchemy 2.0 typed declarative schema (Reading with named unique naive-datetime constraint + 3 empty future tables) managed by Alembic batch-mode migrations, with a smoke test pinning models-vs-migrations parity**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-09T02:48:42Z
- **Completed:** 2026-07-09T03:03:55Z
- **Tasks:** 3/3 auto
- **Files modified:** 8

## Canonical Names (contract for 01-06, 01-07, Phase 2 API)

**Model attribute names vs DB column names** — the two places they differ:

| Model attribute | DB column | Why |
|-----------------|-----------|-----|
| `Reading.datetime_` | `datetime` | avoids shadowing the `datetime` module |
| `Reading.map_value` | `map` | avoids shadowing the `map` builtin |
| `Incident.datetime_` | `datetime` | same shadowing rule |

All other attributes match their column names exactly.

**Tables and columns:**
- `readings`: id, datetime (naive, UNIQUE as `uq_readings_datetime`), systolic, diastolic, pulse, am_pm, bp_category, pulse_category, map (`Numeric(5,1,asdecimal=False)` → float on both backends), pulse_pressure, notes (nullable)
- `lab_results`: id, date, test_name, result, unit, range_low, range_high, notes (all nullable except date/test_name)
- `incidents`: id, datetime (naive), incident_type, duration, notes (duration/notes nullable)
- `procedures`: id, date, procedure_name, location, outcome, notes (location/outcome/notes nullable)

**Migrations:** `bb7feabf6399` (0001, readings) → `0e2b4637ae04` (0002, future tables). Import as `from app.models import Base, Reading, LabResult, Incident, Procedure`.

## Accomplishments

- `Reading` model on a naming-convention Base: duplicate-datetime insert raises `IntegrityError` (DATA-03 proven in Task 1 verify and pinned in test suite); plain `DateTime` everywhere — zero timezone configuration (DATA-05)
- Alembic wired to app settings: `DATABASE_URL=... alembic upgrade head` works against any URL; `render_as_batch=True` in both offline and online configure calls (SQLite move-and-copy, Postgres no-op); static `sqlalchemy.url` in alembic.ini neutralized
- `lab_results`, `incidents`, `procedures` exist EMPTY from migration 0002 (DATA-06) — no seed data, no API
- `tests/test_migrations.py` (3 tests, green): upgrade head on tmp SQLite → reflected tables == `Base.metadata.tables.keys()` == the 4 model tables; readings `datetime` reflects with `timezone is False`; `uq_readings_datetime` survives migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Reading model on a naming-convention Base** - `f4360d2` (feat)
2. **Task 2: Alembic environment + migration 0001 (readings)** - `2cc17df` (feat)
3. **Task 3: Future-table models + migration 0002 + smoke test** - `06158f4` (feat)

## Files Created/Modified

- `backend/app/models.py` - Base with naming convention; Reading, LabResult, Incident, Procedure typed declarative models
- `backend/alembic.ini` - Alembic config; static URL neutralized (env.py owns the URL)
- `backend/alembic/env.py` - `target_metadata = Base.metadata`, `render_as_batch=True` both modes, URL from `get_settings().database_url`
- `backend/alembic/script.py.mako`, `backend/alembic/README` - Alembic scaffold
- `backend/alembic/versions/bb7feabf6399_create_readings_table.py` - Migration 0001
- `backend/alembic/versions/0e2b4637ae04_create_future_tables_lab_results_.py` - Migration 0002 (granularity decision in docstring)
- `backend/tests/test_migrations.py` - Drift guard: the only place migrations are exercised

## Decisions Made

- **Two migrations, not one:** readings in 0001, future tables in 0002 — RESEARCH.md discretion recommendation for portfolio legibility of roadmap success criterion 5
- **`Incident.duration` as nullable Text:** format unspecified in PROJECT.md sketch; Text is the portable non-committal choice, refinable when incidents get an API
- **Nullability pattern for future tables:** temporal column + primary descriptive field non-null (mirrors the plan's explicit lab_results spec), everything else nullable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment contained the literal string `timezone=True`**
- **Found during:** Task 1 verification
- **Issue:** A code comment explaining the DATA-05 rule ("never DateTime(timezone=True)") tripped the acceptance-criteria grep for forbidden timezone strings
- **Fix:** Reworded the comment to avoid the literal string
- **Files modified:** `backend/app/models.py`
- **Verification:** `grep -E "timezone=True|tz_localize|timezone\.utc"` finds nothing
- **Committed in:** f4360d2

---

**Total deviations:** 1 auto-fixed (trivial)
**Impact on plan:** None — plan executed as written.

## Issues Encountered

None. Fresh worktree required creating a new venv (`python3.12 -m venv .venv` + editable install) before Alembic/pytest could run — expected per parallel-execution environment note, not a deviation.

## Known Stubs

None — future tables are intentionally empty per DATA-06 (requirement, not a stub).

## Threat Model Compliance

- **T-1-03 (Tampering, DB access layer) — mitigated:** all access via typed declarative ORM; migrations are Alembic autogenerate output, no hand-written SQL strings
- **T-1-04 (Tampering/integrity, readings.datetime) — mitigated:** `UniqueConstraint("datetime")` at schema level, proven by IntegrityError verify and pinned by `test_readings_unique_datetime_constraint_survives_migration`
- **T-1-02 (Info disclosure, dev.db/scratch DBs) — accepted:** dev.db covered by `.gitignore` (`*.db`), scratch migration DBs held only synthetic verify rows

## Next Phase Readiness

- Plans 01-06 (merge loader) and 01-07 (seeder) can import `Reading` and rely on the unique-datetime constraint for idempotent merges
- Phase 2 API consumes the canonical column names above; remember `datetime_`/`map_value` attribute spelling in Python code
- `alembic upgrade head` is the deployment schema path; tests elsewhere should keep using `Base.metadata.create_all` (drift guard covers parity)

## Self-Check: PASSED

All 8 created files exist on disk; all 3 task commits (f4360d2, 2cc17df, 06158f4) present in git history; `pytest tests -q` green (3 passed).

---
*Phase: 01-data-foundation*
*Completed: 2026-07-09*
