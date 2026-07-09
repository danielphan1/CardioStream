---
phase: 01-data-foundation
plan: 01
subsystem: infra
tags: [python, sqlalchemy, pydantic-settings, gitignore, privacy, scaffolding]

# Dependency graph
requires: []
provides:
  - "Privacy gate: .gitignore (data/, *.db, .venv/, caches) committed alone as first commit — data/ provably invisible to git"
  - "Monorepo layout per D-15: data/ (gitignored), backend/app/, README.md with Privacy section; frontend/ deferred to Phase 2"
  - "backend/pyproject.toml with audited pinned deps (pandas 3.0.*, sqlalchemy 2.0.*, alembic 1.18.*, pydantic 2.13.*, pydantic-settings 2.14.*, openpyxl 3.1.*; dev: pytest 9.*, ruff 0.15.*)"
  - "backend/app/config.py: pydantic-settings Settings with database_url default sqlite:///./dev.db (env DATABASE_URL)"
  - "backend/app/db.py: sync SQLAlchemy engine + SessionLocal sessionmaker (no async, no timezone config)"
  - "backend/.venv (Python 3.12, local-only) with all pinned deps installed and importable"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, database, etl, seeding]

# Tech tracking
tech-stack:
  added: [pandas 3.0.x, openpyxl 3.1.x, sqlalchemy 2.0.x, alembic 1.18.x, pydantic 2.13.x, pydantic-settings 2.14.x, pytest 9.x, ruff 0.15.x]
  patterns:
    - "Sync SQLAlchemy 2.0 engine from get_settings().database_url — SQLite dev / Postgres prod portable"
    - "Naive datetimes end-to-end (DATA-05 groundwork) — no timezone configuration anywhere"
    - "pydantic-settings BaseSettings + cached get_settings() accessor for all config"

key-files:
  created:
    - .gitignore
    - README.md
    - backend/pyproject.toml
    - backend/app/__init__.py
    - backend/app/config.py
    - backend/app/db.py
    - backend/tests/__init__.py
  modified: []

key-decisions:
  - "User chose 'skip' at Task 3 checkpoint: real OMRON export and bp_data_cleaned.csv deferred — ETL (01-04) builds against the assumed OMRON format; golden-master test and real-data seed (01-07) auto-skip until files appear in data/"
  - ".gitignore committed alone as the plan's first commit before any other artifact (irreversible privacy ordering, RESEARCH Pitfall 1)"
  - "fastapi/httpx/psycopg deliberately NOT installed this phase — no API surface, SQLite dev only"

patterns-established:
  - "Privacy-first commits: never git add -f under data/; git check-ignore probe before any data-adjacent work"
  - "Pinned-only dependencies from the RESEARCH.md legitimacy audit table"

requirements-completed: [DATA-08]

# Metrics
duration: 7min
completed: 2026-07-08
---

# Phase 01 Plan 01: Privacy-Safe Monorepo Skeleton Summary

**Privacy gate (.gitignore covering data/ committed first) plus backend/ scaffold with pinned pandas 3/SQLAlchemy 2 deps, pydantic-settings config, and sync engine; real data files explicitly deferred by user ("skip")**

## Performance

- **Duration:** ~7 min active execution (plus human-action checkpoint wait)
- **Started:** 2026-07-08T23:46:30Z
- **Completed:** 2026-07-08T23:54:00Z
- **Tasks:** 3/3 (2 auto + 1 checkpoint resolved via "skip")
- **Files modified:** 7

## Accomplishments

- `.gitignore` committed ALONE as first commit (32edec8) — `data/`, `*.db`, `.venv/`, caches ignored before any real health data could land; `git check-ignore` probe passes (DATA-08)
- Monorepo layout per D-15: `data/` (untracked by design), `backend/app/`, root `README.md` with `## Privacy` section; no `frontend/` yet
- `backend/pyproject.toml` with only the 8 audited, pinned packages (no fastapi/httpx/psycopg this phase); `[tool.pytest.ini_options]` + ruff config (line-length 100, py312)
- Python 3.12 venv at `backend/.venv` with all deps installed; `app.config.get_settings()` and `app.db.engine`/`SessionLocal` import cleanly, `database_url` defaults to `sqlite:///./dev.db`
- Task 3 checkpoint resolved: user replied "skip" — real data deferred, blocker recorded in STATE.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit .gitignore alone, then create monorepo layout** - `32edec8` (chore), `381281b` (docs: README stub)
2. **Task 2: Backend Python project — pinned deps, config, engine** - `5fb35be` (feat), `c859ace` (chore: egg-info gitignore fix)
3. **Task 3: Add real data files to data/** - no commit (human-action checkpoint; user chose "skip", data/ remains empty and gitignored)

## Files Created/Modified

- `.gitignore` - Privacy gate: data/, *.db, .venv/, __pycache__/, .pytest_cache/, .ruff_cache/, .env, .DS_Store, *.egg-info/
- `README.md` - Project title, description, `## Privacy` section (real data in gitignored data/, only synthetic sample committed)
- `backend/pyproject.toml` - health-visualizer-backend, requires-python >=3.12, pinned deps, pytest/ruff config
- `backend/app/__init__.py` - Package marker
- `backend/app/config.py` - `Settings(BaseSettings)` with `database_url` (env `DATABASE_URL`, default sqlite:///./dev.db), cached `get_settings()`
- `backend/app/db.py` - Sync `create_engine` + `SessionLocal` sessionmaker
- `backend/tests/__init__.py` - Wave-0 test tree marker (pytest exits 5 until 01-02, expected)

## Decisions Made

- **Task 3 resolved as "skip" (user decision):** Real OMRON export `.xlsx` and `bp_data_cleaned.csv` are NOT in `data/`. Per the checkpoint contract: plan 01-04 builds ETL against the assumed OMRON format (Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes); the golden-master test and real-data seed in 01-07 auto-skip until the files appear. Blocker stays open in STATE.md — real format must be verified when files land.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Added `*.egg-info/` to .gitignore**
- **Found during:** Task 2 (editable install created `backend/health_visualizer_backend.egg-info/`)
- **Issue:** Editable install build artifact was untracked and would pollute the repo
- **Fix:** Extended `.gitignore` with `*.egg-info/`
- **Files modified:** `.gitignore`
- **Verification:** `git status --porcelain` clean of egg-info entries
- **Committed in:** c859ace

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Housekeeping only; no scope creep.

## Issues Encountered

None beyond the documented deviation.

## Known Stubs

None — no application logic yet; scaffold files are complete for their purpose.

## User Setup Required

**Open item (deferred, not blocking scaffold):** Place the raw OMRON export `.xlsx` and `data/bp_data_cleaned.csv` into the repo-root `data/` directory when available. They will be invisible to git (verify with `git check-ignore data/<file>`). Until then, real-data tests and seeding auto-skip.

## Next Phase Readiness

- Wave 1 complete: privacy gate active, backend scaffold + pinned deps importable — plans 01-02 (models/migrations) and beyond can build on `app.db.engine` / `app.config.get_settings()`
- **Open blocker (carried in STATE.md):** real OMRON export + bp_data_cleaned.csv absent from data/ — plans 01-04 and 01-07 must target the assumed format and auto-skip real-data tests until files appear; verify the real format when files land

## Self-Check: PASSED

All 7 created files exist on disk; all 4 task commits (32edec8, 381281b, 5fb35be, c859ace) present in git history.

---
*Phase: 01-data-foundation*
*Completed: 2026-07-08*
