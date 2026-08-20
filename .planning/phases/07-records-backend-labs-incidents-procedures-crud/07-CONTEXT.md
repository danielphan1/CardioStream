# Phase 7: Records Backend (Labs / Incidents / Procedures CRUD) - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The `LabResult`, `Incident`, and `Procedure` tables already exist (migrated in Phase 1's DATA-06, currently empty — no seed data, no API). This phase gives each of them a GET-filtered + POST-create API, mirroring the existing `/readings` route, so Phase 8 (manual-entry forms) and Phase 9 (multi-dataset overlay) have something real to build against.

In scope: three new Bearer-gated resource routers (labs, incidents, procedures), each with GET (date-range filtered, mirroring `ReadingFilters`) and POST (create, returning the full created record). No update/delete — out of scope per REQUIREMENTS.md ("typo-correction editing is a future consideration, not required for launch").

Out of scope (explicitly deferred): edit/delete on any of these three resources; resource-specific GET filters beyond date-range (e.g. filter by `incident_type` or `test_name`) — nothing in this milestone's requirements calls for it; the manual-entry forms themselves (Phase 8) and the overlay/toggle UI that consumes this data (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### API shape
- **D-01:** Three separate resource routers — `labs.py`, `incidents.py`, `procedures.py` — each an exact mirror of `readings.py`'s 1-table : 1-router : 1-filter-class : 1-response-schema pattern. Not a single combined `/records` endpoint with a type discriminator. Matches OVERLAY-01's literal wording ("mirroring the existing readings API") and keeps each resource's fields independently typed rather than squashing three tables' worth of mostly-null optional fields into one schema.

### POST response contract
- **D-02:** `POST` returns the full created record (id + all fields) in the same shape as the GET list's items — not a minimal `{id}` ack. Mirrors how `upload.py` returns the full `IngestSummary` rather than a bare success flag. This lets Phase 8's forms do an optimistic cache update and satisfy its own success criterion ("a submitted record shows up in the data immediately, without a page reload") without an extra round-trip.

### Field strictness on create
- **D-03:** Only the bare minimum per resource is required on create — everything else in the schema stays optional, matching the nullable columns already defined in `models.py`:
  - **Lab result:** `date` + `test_name` required; `result`, `unit`, `range_low`, `range_high`, `notes` optional.
  - **Incident:** `datetime` + `incident_type` required; `duration`, `notes` optional.
  - **Procedure:** `date` + `procedure_name` required; `location`, `outcome`, `notes` optional.
  Rationale: lets a caregiver log something fast ("hospitalization, today") and fill in details later; there's no edit route this milestone to fix an incomplete record, so the create floor must not force information caregivers may not have yet. Also aligned with the project's accessibility-first, low-friction-entry goal for a user with limited hand mobility.

### GET filter scope
- **D-04:** Date-range only (`start_date`/`end_date`), an exact mirror of `ReadingFilters` — no resource-specific filters (e.g. filter incidents by `incident_type`, labs by `test_name`) in this phase. Nothing in Phase 7–9's stated requirements needs more than date-range filtering (Phase 9's overlay only needs to place records on the timeline by date); resource-specific filtering would be speculative scope.

### Claude's Discretion
- Exact Pydantic schema/field naming conventions for the three new response models (following `ReadingOut`'s `from_attributes` + `AliasChoices` pattern where a column needs aliasing, e.g. `Incident.datetime_` → JSON `datetime`, same as `Reading`).
- Whether the three new `Filters` dependency classes each get their own class (mirroring `ReadingFilters`) or share one generic date-range-filter base — implementation-location detail, not a product decision.
- Exact request-body Pydantic model shape for POST (e.g. a `*Create` input model per resource) — standard FastAPI/Pydantic pattern, no user preference expressed.
- Whether new POST routes get any rate limiting — precedent is no rate limit on `/readings`/`/upload` (only `/agent` is rate-limited, for billing protection); default to no rate limit unless research surfaces a reason otherwise.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level requirements & state
- `.planning/PROJECT.md` — Core Value, v1.1 milestone goal, "manual entry forms are in scope; agent-parsed entry is not" boundary
- `.planning/REQUIREMENTS.md` §Multi-Dataset Filtering & Overlay (OVERLAY) — OVERLAY-01 (this phase's sole requirement: "Backend CRUD (GET filtered + POST create) for labs, incidents, and procedures, mirroring the existing readings API, Bearer-gated like every other route"); also OVERLAY-02/03 (Phase 8/9, for context on what this API feeds) and the Out-of-Scope table ("Edit/delete on labs, incidents, procedures records" — create + read only for v1.1)
- `.planning/ROADMAP.md` §Phase 7 — Goal, Depends on ("Nothing new — extends v1.0's existing schema/migrations"), 3 Success Criteria

### Existing code this phase extends (read before implementing)
- `backend/app/models.py` — `LabResult`, `Incident`, `Procedure` SQLAlchemy models (already migrated, already have all the fields this phase's schemas/routes need — no new migration required)
- `backend/app/routers/readings.py` — the exact router pattern to mirror three times (GET only there; this phase adds POST too)
- `backend/app/deps.py` — `ReadingFilters` class (the date-range filter pattern to mirror per D-04), `get_db` dependency (route modules must never import `SessionLocal` directly)
- `backend/app/schemas.py` — `ReadingOut`'s `from_attributes=True` + `AliasChoices` pattern for column-name aliasing (e.g. `datetime_`/`map_value` → clean JSON keys)
- `backend/app/main.py` — router registration + `dependencies=[Depends(verify_token)]` gating pattern (attach at router level, per D-01's "Bearer-gated like every other route")
- `backend/app/routers/upload.py` — the only existing POST route; shows the "never-500, return the real created/processed object" convention (D-02 follows this precedent)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/models.py` — `LabResult`, `Incident`, `Procedure` tables already exist with all needed columns; zero new migration work, purely an API-layer phase.
- `backend/app/deps.py` `ReadingFilters` — direct template for three new `LabFilters`/`IncidentFilters`/`ProcedureFilters` (or a shared generic date-range base per Claude's discretion).
- `backend/app/schemas.py` `ReadingOut` — direct template for `LabResultOut`/`IncidentOut`/`ProcedureOut`; `Incident.datetime_` needs the same `AliasChoices("datetime_", "datetime")` treatment `Reading.datetime_` already uses.
- `backend/app/routers/readings.py` — direct template for the GET half of each new router.
- `backend/app/routers/upload.py` — template for "return the real object, never a bare ack" and the never-500 exception-handling discipline, applicable to the POST half.

### Established Patterns
- Router-level auth: `app.include_router(x.router, dependencies=[Depends(verify_token)])` in `main.py` — never per-route `Depends`.
- DB access exclusively via `get_db`; never a direct `SessionLocal` import in a route module.
- Naive local datetimes end-to-end (DATA-05) — no timezone handling anywhere, including in any new POST request body parsing.
- One filter-class-per-concern convention, matching `ReadingFilters`.

### Integration Points
- `backend/app/main.py` — three new `app.include_router(...)` calls, gated identically to `readings`/`stats`/`upload`.
- No frontend integration this phase — `frontend/src/api/*` wiring is Phase 8/9's job, not this phase's.

</code_context>

<specifics>
## Specific Ideas

No particular visual/copy references — this is a pure backend/API phase. The concrete decisions above (three separate routers, full-record POST response, minimal required fields, date-range-only filtering) fully specify the shape; exact schema/route naming is Claude's discretion during planning.

</specifics>

<deferred>
## Deferred Ideas

- Resource-specific GET filters (filter incidents by type, labs by test name, procedures by name) — reconsidered if a future phase (Phase 9's overlay, or beyond) needs more than date-range filtering to plot/list records; not needed by anything currently scoped.
- Edit/delete routes for labs, incidents, procedures — already tracked in REQUIREMENTS.md's Out of Scope table as "a future consideration, not required for launch."

### Reviewed Todos (not folded)
None — no todos in the project matched Phase 7's scope (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 7-Records Backend (Labs / Incidents / Procedures CRUD)*
*Context gathered: 2026-08-20*
