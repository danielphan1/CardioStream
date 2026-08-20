# Phase 7: Records Backend (Labs / Incidents / Procedures CRUD) - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 9 (3 new routers + 3 modified shared files + 3 implied test files)
**Analogs found:** 9 / 9 (all role-match or exact; no "no analog" files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/routers/labs.py` (new) | router | CRUD (GET+POST, no update/delete) | `backend/app/routers/readings.py` (GET half) + `backend/app/routers/auth.py` (POST body/response shape) | role-match (composite) |
| `backend/app/routers/incidents.py` (new) | router | CRUD (GET+POST) | same as above | role-match (composite) |
| `backend/app/routers/procedures.py` (new) | router | CRUD (GET+POST) | same as above | role-match (composite) |
| `backend/app/deps.py` (modified — add `LabFilters`/`IncidentFilters`/`ProcedureFilters`) | utility (FastAPI dependency) | transform (query→where-clause) | `ReadingFilters` in the same file | exact |
| `backend/app/schemas.py` (modified — add `LabResultOut`/`IncidentOut`/`ProcedureOut` + `*Create` input models) | model (Pydantic DTO) | transform (ORM→JSON, JSON→ORM) | `ReadingOut` in the same file (Out side); `AuthRequest` in `routers/auth.py` (Create-input side, weak) | exact (Out) / partial (Create) |
| `backend/app/main.py` (modified — 3 new `include_router` calls) | config (app assembly) | request-response | existing `readings`/`stats`/`upload` registration block, same file | exact |
| `backend/tests/test_api_labs.py` (new, implied) | test | CRUD | `backend/tests/test_api_readings.py` | role-match |
| `backend/tests/test_api_incidents.py` (new, implied) | test | CRUD | `backend/tests/test_api_readings.py` + `Incident.datetime_` aliasing test from same file's serialization test | role-match |
| `backend/tests/test_api_procedures.py` (new, implied) | test | CRUD | `backend/tests/test_api_readings.py` | role-match |

Note on test file naming/count: CONTEXT.md doesn't pin exact test filenames — one file per resource (mirroring `test_api_readings.py` : `readings.py`) is the established 1:1 convention; a combined `test_api_records.py` is an equally valid implementation-location choice per Claude's discretion.

---

## Pattern Assignments

### `backend/app/routers/labs.py` / `incidents.py` / `procedures.py` (router, CRUD)

**Primary analog (GET half):** `backend/app/routers/readings.py` (full file, 34 lines)

**Imports pattern** (readings.py lines 14-22):
```python
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import ReadingFilters, get_db
from app.models import Reading
from app.schemas import ReadingOut
```
For labs.py, swap `ReadingFilters`→`LabFilters`, `Reading`→`LabResult`, `ReadingOut`→`LabResultOut` (and add the `*Create` schema + `HTTPException`/status only if the POST handler needs explicit error branches — see below). Same substitution pattern for incidents.py/procedures.py.

**Core GET pattern** (readings.py lines 24-34, exact structure to mirror):
```python
router = APIRouter()


@router.get("/readings", response_model=list[ReadingOut])
def list_readings(
    filters: Annotated[ReadingFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> list[Reading]:
    """Return readings matching the filter set, datetime ascending."""
    stmt = filters.apply(select(Reading)).order_by(Reading.datetime_)
    return list(db.scalars(stmt).all())
```
Mirror verbatim for `GET /labs`, `GET /incidents`, `GET /procedures` — swap the model/filter/schema names and the order-by column (`LabResult.date`, `Incident.datetime_`, `Procedure.date`).

**Secondary analog (POST body/response shape):** `backend/app/routers/auth.py` (full file, 42 lines) — the only existing route that accepts a Pydantic request body and returns a `response_model` without a file upload:
```python
class AuthRequest(BaseModel):
    password: str


class AuthResponse(BaseModel):
    token: str


@router.post("/auth", response_model=AuthResponse)
def auth(request: Request, body: AuthRequest) -> AuthResponse:
    ...
    return AuthResponse(token=_serializer().dumps("authorized"))
```
Structural takeaway for the three new POST handlers: declare a `*Create` Pydantic input model (per D-03's required/optional split), accept it as the plain request body (`body: LabResultCreate`), and return the `response_model=LabResultOut` per D-02 (the full created record, not a bare ack). No rate limiting (`@limiter.limit`) — that decorator is specific to `/auth`'s brute-force concern and is NOT part of this pattern (Claude's Discretion section explicitly defaults new POST routes to no rate limit).

**DB-write construct to copy (no existing router does this — synthesized from the ETL's single-row insert, `backend/app/etl.py` lines 386-401):**
```python
if current is None:
    session.add(
        Reading(
            datetime_=dt,
            systolic=int(row.systolic),
            ...
            notes=incoming_notes,
        )
    )
    added += 1
```
Adapted shape for a POST create route (no existing exact analog — this is the closest DB-write precedent in the codebase; standard SQLAlchemy 2.0 idiom for the rest):
```python
@router.post("/labs", response_model=LabResultOut)
def create_lab(
    body: LabResultCreate,
    db: Annotated[Session, Depends(get_db)],
) -> LabResult:
    row = LabResult(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
```
`db.refresh(row)` is required so the returned object has its DB-assigned `id` populated before Pydantic serializes it via `response_model` (`from_attributes=True` on the Out schema, same as `ReadingOut`).

**Error handling pattern — do NOT copy upload.py's try/except wholesale.** `upload.py`'s never-500 wrapper (lines 41-48) exists because it parses untrusted file bytes through pandas/openpyxl, which can raise many exception types:
```python
try:
    raw = parse_omron(file.file)
    clean, rejected = transform(raw)
    return merge_readings(db, clean, rejected)
except HTTPException:
    raise
except Exception as exc:  # noqa: BLE001 — never-500 backstop (D-10)
    raise HTTPException(status_code=400, detail="not-omron") from exc
```
The three new POST routes have no analogous parse step — FastAPI + Pydantic already reject a malformed body with a 422 automatically before the handler body runs (same mechanism that gives `GET /readings` its 422 on bad query params, see `test_invalid_params_return_422` below). No manual try/except is needed unless a resource-specific business-rule validation is added (none is specified in CONTEXT.md D-03).

---

### `backend/app/deps.py` (utility, modified — add 3 filter classes)

**Analog:** `ReadingFilters`, same file, lines 43-76 (exact — this is the literal template named in D-04 and canonical_refs)

```python
class ReadingFilters:
    """Shared query-param filter set for /readings and /stats/summary."""

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        am_pm: Annotated[Literal["AM", "PM"] | None, Query()] = None,
        bp_category: Annotated[BPCategory | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date
        self.am_pm = am_pm
        self.bp_category = bp_category

    def apply(self, stmt: Select) -> Select:
        """Add where-clauses for every provided filter to ``stmt``."""
        if self.start_date:
            stmt = stmt.where(
                Reading.datetime_ >= datetime.combine(self.start_date, datetime.min.time())
            )
        if self.end_date:  # inclusive end date — Pitfall 4, safe at date.max
            stmt = stmt.where(
                Reading.datetime_ <= datetime.combine(self.end_date, datetime.max.time())
            )
        ...
        return stmt
```

Per D-04 (date-range only, no `am_pm`/`bp_category` equivalents) the new classes drop everything except `start_date`/`end_date`:
```python
class LabFilters:
    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date

    def apply(self, stmt: Select) -> Select:
        if self.start_date:
            stmt = stmt.where(LabResult.date >= self.start_date)
        if self.end_date:
            stmt = stmt.where(LabResult.date <= self.end_date)
        return stmt
```
Important divergence from `ReadingFilters`: `LabResult.date`/`Procedure.date` are plain `Date` columns (not `DateTime`), so the comparison is a direct `date` vs `date` comparison — no `datetime.combine(..., datetime.min/max.time())` needed (that dance exists in `ReadingFilters` specifically because `Reading.datetime_` is a `DateTime` column being bounded by `date` query params). `IncidentFilters` DOES need the `datetime.combine` treatment, because `Incident.datetime_` is a `DateTime` column, same as `Reading.datetime_` — copy `ReadingFilters.apply`'s `start_date`/`end_date` branches verbatim (including the inclusive end-of-day comparison, `datetime.max.time()`) for `IncidentFilters`.

Whether these are three separate classes or one generic date-range base is explicitly Claude's Discretion (CONTEXT.md line 38) — not pinned by this pattern map.

---

### `backend/app/schemas.py` (model, modified — add 3 Out models + 3 Create models)

**Analog (Out side):** `ReadingOut`, same file, lines 24-40 (exact)

```python
class ReadingOut(BaseModel):
    """One reading as served by GET /readings (API-01)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    datetime: DateTimeType = Field(validation_alias=AliasChoices("datetime_", "datetime"))
    systolic: int
    ...
    notes: str | None = None
```

Apply per-resource, noting which fields need `AliasChoices` treatment (only where the ORM attribute name differs from the desired JSON key, per `models.py`):

- **`LabResultOut`** — no aliasing needed; `LabResult`'s ORM attribute names (`date`, `test_name`, `result`, `unit`, `range_low`, `range_high`, `notes`) already match desired JSON keys 1:1.
- **`IncidentOut`** — needs the SAME aliasing treatment as `ReadingOut.datetime`, because `Incident.datetime_` (attribute) maps to column `datetime` for the identical reason (`datetime` module shadowing): `datetime: DateTimeType = Field(validation_alias=AliasChoices("datetime_", "datetime"))`. This is the one place D-01's "exact mirror" pattern requires copying `ReadingOut`'s alias line verbatim, per canonical_refs' explicit callout.
- **`ProcedureOut`** — no aliasing needed; attribute names match column/JSON keys 1:1.

**Analog (Create-input side, weak):** `AuthRequest` in `backend/app/routers/auth.py` line 28-29 — the only existing request-body Pydantic model in the codebase, but trivial (single required field, no optional fields, not `from_attributes`). No existing schema demonstrates the "some required, some optional" shape D-03 calls for. Synthesize directly from D-03's field lists and `models.py`'s nullable columns:
```python
class LabResultCreate(BaseModel):
    date: DateType
    test_name: str
    result: float | None = None
    unit: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    notes: str | None = None


class IncidentCreate(BaseModel):
    datetime: DateTimeType  # maps directly to Incident.datetime_ via **body.model_dump() -> datetime_=... construction in the route, NOT via AliasChoices (that's a validation_alias for reading FROM attributes; here the model IS the input, so map explicitly in the route: Incident(datetime_=body.datetime, ...))
    incident_type: str
    duration: str | None = None
    notes: str | None = None


class ProcedureCreate(BaseModel):
    date: DateType
    procedure_name: str
    location: str | None = None
    outcome: str | None = None
    notes: str | None = None
```
Note the asymmetry: `IncidentCreate.datetime` cannot rely on `**body.model_dump()` unpacking directly into `Incident(...)` the way `LabResultCreate`/`ProcedureCreate` can, because the ORM attribute is `datetime_` not `datetime`. The route body must construct explicitly: `Incident(datetime_=body.datetime, incident_type=body.incident_type, duration=body.duration, notes=body.notes)`.

---

### `backend/app/main.py` (config, modified — 3 new router registrations)

**Analog:** same file, lines 69-76 (exact — this is a self-referential pattern, extend the existing block)

```python
app.include_router(auth.router)
app.include_router(readings.router, dependencies=[Depends(verify_token)])
app.include_router(stats.router, dependencies=[Depends(verify_token)])
app.include_router(agent.router, dependencies=[Depends(verify_token)])
app.include_router(upload.router, dependencies=[Depends(verify_token)])
```
Add three more lines identically gated:
```python
app.include_router(labs.router, dependencies=[Depends(verify_token)])
app.include_router(incidents.router, dependencies=[Depends(verify_token)])
app.include_router(procedures.router, dependencies=[Depends(verify_token)])
```
Also extend the import line (main.py line 26): `from app.routers import agent, auth, incidents, labs, procedures, readings, stats, upload`.

---

### `backend/tests/test_api_labs.py` / `test_api_incidents.py` / `test_api_procedures.py` (test, CRUD)

**Analog:** `backend/tests/test_api_readings.py` (full file, 184 lines) + fixtures in `backend/tests/conftest.py`

**Fixture reuse (conftest.py lines 72-116, no changes needed):**
```python
@pytest.fixture
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()

@pytest.fixture
def session(engine):
    with Session(engine) as s:
        yield s

@pytest.fixture
def client(session):
    from fastapi.testclient import TestClient
    from app.auth import verify_token
    from app.deps import get_db
    from app.main import app
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[verify_token] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```
`client`/`session` fixtures are resource-agnostic — reuse as-is, no new fixtures needed for DB/app wiring.

**Per-resource seed helper pattern (test_api_readings.py lines 23-52):**
```python
def _reading(dt, systolic, diastolic, pulse, am_pm, bp_category, notes=None) -> Reading:
    return Reading(datetime_=dt, systolic=systolic, ...)

@pytest.fixture
def seeded(session):
    rows = [_reading(...), _reading(...), ...]
    session.add_all(rows)
    session.commit()
    return rows
```
Mirror with `_lab_result(...)`/`_incident(...)`/`_procedure(...)` builders and a `seeded` fixture per test file.

**GET filter test pattern (test_api_readings.py lines 55-72, 145-157):**
```python
def test_no_filters_returns_all_rows_ordered_ascending(client, seeded) -> None:
    r = client.get("/readings")
    assert r.status_code == 200
    ...

@pytest.mark.parametrize("params", [{"am_pm": "MORNING"}, {"start_date": "not-a-date"}, ...])
def test_invalid_params_return_422(client, seeded, params: dict) -> None:
    r = client.get("/readings", params=params)
    assert r.status_code == 422
```
For labs/incidents/procedures, the invalid-params parametrization narrows to just malformed dates (D-04: date-range only, no enum params) — `{"start_date": "not-a-date"}`, `{"end_date": "2025-13-45"}`.

**Serialization test pattern (test_api_readings.py lines 160-176)** — apply to `IncidentOut` specifically (the one schema with `AliasChoices`, mirroring `ReadingOut.datetime`):
```python
def test_serialization_uses_clean_keys_and_naive_iso(client, seeded) -> None:
    r = client.get("/readings")
    item = r.json()[0]
    assert "datetime" in item
    assert "datetime_" not in item
    for row in r.json():
        assert "Z" not in row["datetime"]
        assert "+" not in row["datetime"]
```

**POST create + gating test pattern — analog `test_auth_upload.py` lines 208-217 (response-shape assertion) and 266-270 (`test_upload_without_token_401`, the gating-test template):**
```python
def test_upload_valid_xlsx_ingests(real_gate_client, valid_token, omron_xlsx) -> None:
    ...
    resp = _upload(real_gate_client, path, valid_token)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"added", "updated", "unchanged", "rejected", "total", "latest"}

def test_upload_without_token_401(real_gate_client, omron_xlsx) -> None:
    """POST /upload with no Bearer token → 401 (gated like every data route)."""
    resp = _upload(real_gate_client, path, token=None)
    ...
```
Adapt for the three new POST routes: assert `resp.status_code == 200`, assert the response body's key set matches the `*Out` schema (including the DB-assigned `id`), and add a `test_post_<resource>_without_token_401` mirroring the gating-test shape (using the plain `client` fixture with `app.dependency_overrides[verify_token]` NOT set — see `real_gate_client` fixture in `test_auth_upload.py` for the un-overridden-auth variant, distinct from the `client` fixture in `conftest.py` which always overrides `verify_token`).

---

## Shared Patterns

### Router-level Bearer auth (applies to all 3 new routers)
**Source:** `backend/app/main.py` lines 69-76
```python
app.include_router(readings.router, dependencies=[Depends(verify_token)])
```
**Apply to:** `labs.router`, `incidents.router`, `procedures.router` — attach identically at `include_router` time in `main.py`; never `Depends(verify_token)` inside the router module itself.

### DB access exclusively via `get_db` (applies to all 3 new routers)
**Source:** `backend/app/deps.py` lines 37-40
```python
def get_db() -> Iterator[Session]:
    """Yield a request-scoped Session; tests override this dependency."""
    with SessionLocal() as session:
        yield session
```
**Apply to:** every new route handler's `db: Annotated[Session, Depends(get_db)]` parameter — never import `SessionLocal` directly in a router module (RESEARCH Pitfall 10, restated in deps.py's own docstring).

### Date-range filter dependency, one class per resource
**Source:** `backend/app/deps.py` `ReadingFilters`, lines 43-76
**Apply to:** `LabFilters`/`IncidentFilters`/`ProcedureFilters` — same `__init__` + `apply(stmt) -> Select` shape, narrowed to `start_date`/`end_date` only per D-04. `IncidentFilters` needs the `datetime.combine(..., datetime.min/max.time())` inclusive-end-date treatment (DateTime column); `LabFilters`/`ProcedureFilters` compare `Date` columns directly (no `datetime.combine`).

### Pydantic Out schema: `from_attributes=True`, alias only where the ORM attribute name diverges from the JSON key
**Source:** `backend/app/schemas.py` `ReadingOut`, lines 24-40
**Apply to:** `LabResultOut`, `IncidentOut` (needs `AliasChoices("datetime_", "datetime")`, same reason as `ReadingOut.datetime`), `ProcedureOut`.

### POST returns the full created record, never a bare ack
**Source:** `backend/app/routers/upload.py` docstring lines 4-7 (D-10 precedent, restated by D-02) + `backend/app/routers/auth.py` lines 36-42 (concrete `response_model` shape)
**Apply to:** all 3 new POST handlers — `response_model=<Resource>Out`, return the ORM row after `db.refresh(row)` so the generated `id` is populated.

### Naive local datetimes end-to-end — no timezone handling anywhere
**Source:** `backend/app/models.py` lines 3-4, `deps.py` line 17, restated project-wide (DATA-05)
**Apply to:** `IncidentCreate.datetime` parsing and `IncidentOut.datetime` serialization — same as `Reading`/`ReadingOut`, no `Z`/offset ever.

## No Analog Found

None. Every file has at least a role-match analog; the weakest match is the `*Create` input-model shape (schemas.py), for which `AuthRequest` is a structurally-thin but real precedent and D-03's field lists fully specify the rest.

## Metadata

**Analog search scope:** `backend/app/`, `backend/app/routers/`, `backend/tests/`
**Files scanned:** `models.py`, `deps.py`, `schemas.py`, `main.py`, `routers/readings.py`, `routers/stats.py`, `routers/upload.py`, `routers/auth.py`, `auth.py`, `etl.py` (targeted insert section), `seed.py`, `conftest.py`, `tests/test_api_readings.py`, `tests/test_auth_upload.py` (targeted sections)
**Pattern extraction date:** 2026-08-20
