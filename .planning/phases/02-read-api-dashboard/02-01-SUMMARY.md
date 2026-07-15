---
phase: 02-read-api-dashboard
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, read-api, cors, auth-stub]
requires:
  - phase: 01
    provides: "Reading model (datetime_/map_value aliases), derivations canonical labels, SessionLocal, in-memory test fixtures"
provides:
  - "GET /readings (API-01): filterable by start_date/end_date (inclusive)/am_pm/bp_category, datetime-ascending, alias-correct JSON"
  - "GET /stats/summary (API-02): count, avg/min/max vitals, six zero-filled clinical-order categories, unfiltered latest_reading"
  - "ReadingFilters shared filter dependency (the Phase 3 agent filter semantics)"
  - "verify_token no-op auth stub attached at router level (Phase 5 flips one function)"
  - "get_db generator dependency (test-overridable; routes never import SessionLocal)"
  - "Settings.cors_origins + CORSMiddleware for the Vite dev origin"
affects: [02-02 frontend api/types.ts, phase-03 agent filter schema, phase-05 auth enforcement]
tech-stack:
  added: [fastapi 0.139.0, uvicorn 0.51.0, httpx 0.28.1]
  patterns: [shared filter dependency, validation_alias AliasChoices bridging, router-level auth dependency, dependency_overrides test isolation, StaticPool in-memory engine for TestClient]
key-files:
  created:
    - backend/app/auth.py
    - backend/app/deps.py
    - backend/app/schemas.py
    - backend/app/main.py
    - backend/app/routers/__init__.py
    - backend/app/routers/readings.py
    - backend/app/routers/stats.py
    - backend/tests/test_api_readings.py
    - backend/tests/test_api_stats.py
  modified:
    - backend/pyproject.toml
    - backend/app/config.py
    - backend/tests/conftest.py
key-decisions:
  - "conftest engine fixture uses StaticPool + check_same_thread=False so the TestClient threadpool shares the in-memory SQLite schema (behavior-neutral for Phase 1 single-threaded tests)"
  - "schemas.py imports datetime as DateTimeType because the JSON field is literally named `datetime` and would shadow the annotation in the model class namespace"
  - "latest_reading serialized via .isoformat() — naive ISO, no Z/offset (DATA-05)"
duration: 8min
completed: 2026-07-15
---

# Phase 2 Plan 01: Read API (GET /readings + GET /stats/summary) Summary

**One-liner:** First two FastAPI endpoints on the Phase 1 backend — filterable /readings and aggregate /stats/summary sharing one ReadingFilters dependency, with alias-correct JSON (`datetime`/`map`), router-level verify_token stub, and Vite-origin-only CORS; 30 new integration tests, full suite 113 passed.

## What Was Built

- **`backend/app/deps.py`** — `get_db()` generator (the only DB entry point for routes; test-overridable) and `ReadingFilters` (start_date, INCLUSIVE end_date via `< end_date + timedelta(days=1)`, am_pm Literal, bp_category Literal of the six verbatim canonical labels).
- **`backend/app/schemas.py`** — `ReadingOut` bridging ORM attributes `datetime_`/`map_value` to JSON keys `datetime`/`map` via `Field(validation_alias=AliasChoices(...))`; `VitalStats`, `CategoryStat`, `StatsSummary` per the interface contract with plan 02-02.
- **`backend/app/auth.py`** — `verify_token` no-op stub, attached at ROUTER level in main.py so Phase 5 enforcement flips one function (T-02-03 accepted this phase).
- **`backend/app/main.py`** — FastAPI app; CORSMiddleware with explicit `Settings.cors_origins` (localhost:5173), `allow_methods=["GET"]`, no credentials, no wildcard (T-02-02); both routers mounted behind the stub.
- **`backend/app/routers/readings.py`** — API-01: `filters.apply(select(Reading)).order_by(Reading.datetime_)`; serves stored derived values only.
- **`backend/app/routers/stats.py`** — API-02: one aggregate select (count + avg/min/max ×3), grouped category query, zero-fill across `CLINICAL_ORDER`, percents against filtered count, avg rounded to 1 decimal, vitals null at count 0, `latest_reading` deliberately UNFILTERED (D-11 anchor).
- **Tests** — 20 readings tests + 10 stats tests (TDD RED→GREEN both tasks), reusing the Phase 1 `session` fixture through a new `client` fixture with `app.dependency_overrides[get_db]`.

## Verification Evidence

- `pytest tests/test_api_readings.py -q` → 20 passed (incl. inclusive end-date 23:15 boundary, exact-JSON-key set assertion, `am_pm=MORNING` → 422)
- `pytest tests/test_api_stats.py -q` → 10 passed (incl. six clinical-order categories under a one-category filter; `latest_reading` non-null with `count == 0`)
- Full backend suite: **113 passed, 7 skipped** (skips = Phase 1 real-data-file guards) — no Phase 1 regressions
- `python -c "from app.main import app"` imports clean; get_db override keeps tests off dev.db
- `pip show fastapi` → 0.139.0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `datetime` field name shadowed the `datetime` type annotation in ReadingOut**
- **Found during:** Task 1 verification
- **Issue:** Pydantic raised `PydanticUserError: unevaluable-type-annotation` — the field named `datetime` shadows the imported type inside the model class namespace.
- **Fix:** `from datetime import datetime as DateTimeType`; field stays named `datetime` so the JSON key is unchanged.
- **Files modified:** backend/app/schemas.py
- **Commit:** 9847d37

**2. [Rule 3 - Blocking] In-memory SQLite engine unusable across TestClient threadpool threads**
- **Found during:** Task 2 GREEN
- **Issue:** `sqlite3.ProgrammingError: SQLite objects created in a thread can only be used in that same thread` + `no such table: readings` — TestClient runs sync endpoints in a threadpool; the Phase 1 `engine` fixture's default SingletonThreadPool gives each thread its own empty in-memory DB.
- **Fix:** `create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)` — the documented FastAPI/SQLite testing pattern; behavior-neutral for single-threaded Phase 1 tests (full suite re-verified).
- **Files modified:** backend/tests/conftest.py
- **Commit:** 90fbdad

**3. [Adaptation] Verification commands run from the worktree, not the plan's absolute main-repo path**
- The plan's verify commands reference `/Users/dp/Documents/GitHub/Health-Visualizer/backend`; this executor runs in a git worktree. Commands ran with cwd at the worktree's `backend/` using the shared main-repo venv interpreter — confirmed `app` resolves to the worktree code (`app.deps.__file__` check). Package installs land in the shared venv (intended; venv is gitignored and shared).

## TDD Gate Compliance

Both TDD tasks followed RED→GREEN with gate commits in order:
- Task 2: `test` 77d5e61 → `feat` 90fbdad
- Task 3: `test` 89994a9 → `feat` 3ecb71c
No refactor commits needed.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `verify_token` no-op | backend/app/auth.py | Intentional per plan/threat model (T-02-03): auth designed now at router level, enforced in Phase 5 with itsdangerous — never a route retrofit. |

## Deferred Issues

- Starlette `httpx`→`httpx2` TestClient deprecation warning (third-party; stack pins httpx 0.28.x) — logged in `deferred-items.md`.

## Threat Flags

None — all new surface (query-param parsing, CORS, unauthenticated reads) is covered by the plan's threat register (T-02-01..05 dispositions implemented as specified).

## Commits

| Task | Commit | Type |
|------|--------|------|
| 1 — skeleton modules + deps install | 9847d37 | feat |
| 2 RED — API-01 tests | 77d5e61 | test |
| 2 GREEN — /readings + app assembly | 90fbdad | feat |
| 3 RED — API-02 tests | 89994a9 | test |
| 3 GREEN — /stats/summary | 3ecb71c | feat |

## Self-Check: PASSED

All 9 claimed files exist on disk; all 5 task commits verified in git log; no unintended deletions; no untracked files left behind.
