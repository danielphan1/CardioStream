---
phase: 07-records-backend-labs-incidents-procedures-crud
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, crud, backend]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "LabResult/Incident/Procedure SQLAlchemy models, migrated but empty (DATA-06)"
  - phase: 02-read-api-dashboard
    provides: "readings.py router pattern, ReadingFilters/ReadingOut pattern, get_db dependency, main.py router-gating convention"
provides:
  - "GET/POST /labs, /incidents, /procedures — Bearer-gated CRUD (create + filtered read) for all three future-data tables"
  - "LabFilters/IncidentFilters/ProcedureFilters date-range dependency classes in deps.py"
  - "LabResultOut/Create, IncidentOut/Create, ProcedureOut/Create Pydantic schemas in schemas.py"
affects: [08-manual-entry-forms, 09-multi-dataset-overlay-filtering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "1-table : 1-router : 1-filter-class : 1-response-schema, mirrored 3x from readings.py"
    - "POST returns the full created record (id + all fields) via db.refresh(row) after commit, never a bare ack"
    - "Router-level Bearer gating only: dependencies=[Depends(verify_token)] at include_router time, never per-route"

key-files:
  created:
    - backend/app/routers/labs.py
    - backend/app/routers/incidents.py
    - backend/app/routers/procedures.py
  modified:
    - backend/app/deps.py
    - backend/app/schemas.py
    - backend/app/main.py

key-decisions:
  - "Explicit ORM row construction for Incident (datetime_=body.datetime, ...) instead of **body.model_dump(), because IncidentCreate's `datetime` field name does not match the ORM attribute `datetime_`"
  - "LabFilters/ProcedureFilters compare Date columns directly (no datetime.combine); IncidentFilters uses the same datetime.combine(..., datetime.min/max.time()) inclusive end-of-day treatment as ReadingFilters, because Incident.datetime_ is a DateTime column"
  - "No try/except in any new POST handler — FastAPI/Pydantic 422s a malformed body before the handler runs; upload.py's never-500 file-parsing backstop does not apply here (no analog precedent)"
  - "No rate limiting on any of the 6 new routes, matching /readings and /upload precedent (only /agent is rate-limited)"

patterns-established:
  - "Records-resource pattern: any future migrated-but-empty table gets the same 4-file shape (router + filter class + Out/Create schema pair + main.py registration) demonstrated here for labs/incidents/procedures"

requirements-completed: [OVERLAY-01]

# Metrics
duration: 9min
completed: 2026-08-20
---

# Phase 07 Plan 01: Records Backend (Labs / Incidents / Procedures CRUD) Summary

**Three new Bearer-gated FastAPI routers (labs, incidents, procedures) each mirroring the existing `/readings` GET pattern plus a new POST-create handler, giving the already-migrated-but-empty tables a real API surface for Phase 8's forms and Phase 9's overlay to build against.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-20T22:19:00Z
- **Completed:** 2026-08-20T22:28:05Z
- **Tasks:** 2 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `GET`/`POST /labs`, `/incidents`, `/procedures` all live, Bearer-gated identically to every other data route
- Each POST returns the full created record (including the DB-assigned `id`), verified by an embedded smoke test
- Date-range filtering (`start_date`/`end_date`) works for all three resources, mirroring `ReadingFilters`' exact semantics (including `Incident`'s inclusive end-of-day `DateTime` comparison)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define records contracts — filter classes + Pydantic schemas** - `1d3bf00` (feat)
2. **Task 2: Implement labs/incidents/procedures routers and wire Bearer-gated registration** - `3c87075` (feat)

**Plan metadata:** _pending — committed by orchestrator/self-check step below_

_Note: This plan had no TDD tasks; both were `type="auto"`._

## Files Created/Modified
- `backend/app/deps.py` - Added `LabFilters`, `IncidentFilters`, `ProcedureFilters` date-range dependency classes (imports `Incident`/`LabResult`/`Procedure` from `app.models`)
- `backend/app/schemas.py` - Added `LabResultOut`/`LabResultCreate`, `IncidentOut`/`IncidentCreate`, `ProcedureOut`/`ProcedureCreate`; added `date as DateType` import
- `backend/app/routers/labs.py` (new) - `GET /labs` + `POST /labs`, mirrors `readings.py` exactly plus a create handler
- `backend/app/routers/incidents.py` (new) - `GET /incidents` + `POST /incidents`; POST constructs the `Incident` row explicitly (`datetime_=body.datetime`) since the field name doesn't match the ORM attribute
- `backend/app/routers/procedures.py` (new) - `GET /procedures` + `POST /procedures`, mirrors `labs.py`'s pattern
- `backend/app/main.py` - Extended router import line; registered all three new routers with `dependencies=[Depends(verify_token)]`

## Decisions Made
- Followed the plan's explicit Pydantic/route shapes verbatim — no open decisions left to resolve during execution. See `key-decisions` in frontmatter for the two structural choices (`Incident` explicit-construction, `IncidentFilters`' `datetime.combine` treatment) that were pinned by the plan itself, not improvised.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<verify><automated>` scripts pass verbatim, and both `<acceptance_criteria>` checklists are satisfied:
- All three filter classes exist with `apply(self, stmt: Select) -> Select}`; `LabFilters`/`ProcedureFilters` compare `Date` columns directly; `IncidentFilters.apply` uses `datetime.combine(...)` twice, matching `ReadingFilters.apply`.
- All six schema classes exist; `IncidentOut.datetime` uses `AliasChoices("datetime_", "datetime")`; none of the three `*Create` classes has an `id` field.
- All 6 routes appear in `app.openapi()["paths"]`; all 3 routers register via `dependencies=[Depends(verify_token)]` in `main.py` only (no per-router `Depends(verify_token)`); the `Incident` POST handler constructs the row explicitly, not via `**body.model_dump()`; no new router file contains `@limiter.limit` or a `try`/`except` block.

## Issues Encountered

None affecting correctness. One out-of-scope, pre-existing item was discovered and logged (not fixed, per the scope-boundary rule) — see `.planning/phases/07-records-backend-labs-incidents-procedures-crud/deferred-items.md`: `backend/app/main.py` has a pre-existing `ruff format` whitespace gap (missing blank line before `@app.get("/health")`) unrelated to either hunk this plan touched; `ruff check` (lint) is clean, only `ruff format` (whitespace) flags it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 (Manual-Entry Forms) and Phase 9 (Multi-Dataset Overlay) now have real `GET`/`POST /labs`, `/incidents`, `/procedures` to build against, matching the exact response/request shapes specified in 07-CONTEXT.md's D-01 through D-04.
- Plan 07-02 (per the threat model's T-07-01 mitigation note) is expected to add the dedicated gating/serialization test suite (`test_api_labs.py`, `test_api_incidents.py`, `test_api_procedures.py`) — this plan's own smoke-test verification covers functional correctness but is not a substitute for that permanent test coverage.
- No blockers.

---
*Phase: 07-records-backend-labs-incidents-procedures-crud*
*Completed: 2026-08-20*
