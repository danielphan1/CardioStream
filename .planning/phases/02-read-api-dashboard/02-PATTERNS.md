# Phase 2: Read API & Dashboard - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 32 new/modified files (9 backend, 23 frontend)
**Analogs found:** 9 / 32 (all backend files; frontend is greenfield — `frontend/` does not exist yet)

**Codebase reality check:** The repo contains only `backend/` (Phase 1: models, config, db, derivations, etl, seed, alembic, tests) plus `data/`. There is **no `main.py`, no routers, no FastAPI app object, and no frontend** anywhere. So:
- Backend new files have strong *convention* analogs (docstring style, decision-ID citations, config/session access, test fixtures) but no *role* analog for controllers — the FastAPI route pattern comes from `02-RESEARCH.md` Code Examples 1, 2, 6.
- Frontend files have **no analogs at all**. Their pattern sources are `02-RESEARCH.md` Code Examples 3–5, 7 + `02-UI-SPEC.md` (design tokens, palette, copy, layout contract). The planner MUST treat those two documents as the frontend "analog."

## File Classification

### Backend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/main.py` (new) | config/app-assembly | request-response | `backend/app/seed.py` (entrypoint conventions) + RESEARCH structure | conventions-only |
| `backend/app/auth.py` (new) | middleware (dependency stub) | request-response | `backend/app/config.py` (thin module + docstring style) | conventions-only |
| `backend/app/deps.py` (new) | dependency (get_db + ReadingFilters) | request-response | `backend/app/db.py` + tests Pitfall-10 pattern | role-match |
| `backend/app/schemas.py` (new) | model (Pydantic response) | request-response | `backend/app/models.py` (field names/aliases to mirror) | role-match |
| `backend/app/routers/readings.py` (new) | controller | CRUD (read) | none in repo — RESEARCH Code Example 1 | no-analog (pattern from RESEARCH) |
| `backend/app/routers/stats.py` (new) | controller | CRUD (aggregate read) | none in repo — RESEARCH Code Example 2 | no-analog (pattern from RESEARCH) |
| `backend/app/config.py` (modify) | config | — | itself — extend `Settings` in place | exact |
| `backend/tests/test_api_readings.py` (new) | test | request-response | `backend/tests/test_categories.py` + `conftest.py` | exact (style), role-match (TestClient is new) |
| `backend/tests/test_api_stats.py` (new) | test | request-response | same as above | same |
| `backend/tests/conftest.py` (modify) | test fixture | — | itself — add `client` fixture below existing DB fixtures | exact |
| `backend/pyproject.toml` (modify) | config | — | itself — add fastapi/uvicorn/httpx deps | exact |

### Frontend (all new — no analogs exist; pattern source = RESEARCH.md examples + UI-SPEC)

| New File | Role | Data Flow | Pattern Source |
|----------|------|-----------|----------------|
| `frontend/` scaffold (package.json, vite.config.ts, tsconfig, index.html) | config | — | `create-vite react-ts` template + RESEARCH Pitfall 11 (pin TS ~5.9) |
| `frontend/src/index.css` | config (design tokens) | — | RESEARCH Example 7 + UI-SPEC Color/Typography/Spacing sections |
| `frontend/src/main.tsx`, `App.tsx` | component (root) | — | Vite template + QueryClientProvider wrap |
| `frontend/src/api/client.ts` | service (fetch wrapper) | request-response | RESEARCH structure; base URL from `import.meta.env.VITE_API_URL` |
| `frontend/src/api/types.ts` | model (TS mirror of Pydantic) | — | Must mirror `backend/app/schemas.py` JSON keys exactly (`datetime`, `map`) |
| `frontend/src/store/filters.ts` | store | event-driven (state) | RESEARCH Code Example 3 (verbatim starting point — future agent command schema) |
| `frontend/src/store/theme.ts` | store | event-driven (state) | RESEARCH Pitfall 12 (`.dark` class + localStorage) |
| `frontend/src/lib/dates.ts` | utility | transform | RESEARCH Pitfall 1 (split-parse date-only strings) + Open Question 1 (anchor to `latest_reading`) |
| `frontend/src/lib/palette.ts` | utility | — | UI-SPEC "Clinical category colors" + "Chart data colors" (single source, CSS vars) |
| `frontend/src/hooks/useReadings.ts`, `useStats.ts` | hook (server state) | request-response | RESEARCH Code Example 4 (`placeholderData: keepPreviousData`) |
| `frontend/src/components/Header.tsx` | component | — | UI-SPEC layout contract (D-11, D-15 toggle, D-16 motif) |
| `frontend/src/components/FilterBar.tsx` | component | event-driven | D-17..D-20; react-day-picker 9 for calendar |
| `frontend/src/components/StatsStrip.tsx` | component | request-response | D-21/D-22; renders `/stats/summary` verbatim |
| `frontend/src/components/ChartDeck.tsx` | component | event-driven | RESEARCH Pattern 4 (hero rotation, CSS swap, Pitfall 8 mini buttons) |
| `frontend/src/components/charts/BPTimeline.tsx` | component (chart) | transform | RESEARCH Code Example 5 (bands-before-lines, time axis, click tooltip) |
| `frontend/src/components/charts/PulseTrend.tsx` | component (chart) | transform | Example 5 variant + `<ReferenceLine y={60}>`, domain [30,120] |
| `frontend/src/components/charts/CategoryBars.tsx` | component (chart) | transform | Vertical BarChart + `<Cell>` fills from palette.ts; data from stats payload |
| `frontend/src/components/charts/AmPmComparison.tsx` | component (chart) | transform | Client-side grouping of filtered readings (Assumption A2) |
| `frontend/src/components/ReadingsTable.tsx` | component | transform | D-23/D-24; slice-state "Show 20 more" |
| `frontend/src/components/EmptyState.tsx` | component | — | D-11; UI-SPEC Copywriting Contract |
| `frontend/src/lib/dates.test.ts`, `src/store/filters.test.ts`, `src/lib/palette.test.ts` | test | — | Vitest; test data-shaping functions, never chart internals (Pitfall 2) |

## Pattern Assignments

### `backend/app/routers/readings.py` + `stats.py` (controllers, read)

**Analog:** none in repo. **Primary pattern:** `02-RESEARCH.md` Code Examples 1 & 2 (shared `ReadingFilters` dependency, aliased `ReadingOut`, zero-filled clinical-order categories, unfiltered `latest_reading`). Copy those examples as the skeleton.

**Conventions to copy from Phase 1 code anyway:**

**Module docstring citing decisions/requirements** — every Phase 1 module opens this way. From `backend/app/derivations.py` lines 1–10:
```python
"""Medical derivations for Chris's health readings — single source of truth.

Categories are computed here and ONLY here (DATA-01). The ETL transform,
sample-data generator, golden-master test, and any future API code must import
these functions; nothing else may ever recompute a category.

Canonical labels (pinned; surface in Phase 2 charts/API):
  BP:    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2",
         "Hypertensive Crisis"
  Pulse: "Bradycardia", "Normal", "Tachycardia"
```
New routers should carry the same style: docstring naming API-01/API-02 and the decision IDs they implement.

**Canonical labels contract** — the router's `BPCategory` Literal and stats `CLINICAL_ORDER` must match `derivations.py` verbatim: `"Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"` (BP) and `"Bradycardia", "Normal", "Tachycardia"` (pulse). Never recompute a category — serve stored column values only (`derivations.py` lines 2–5 make this an explicit invariant).

**ORM query style** — SQLAlchemy 2.0 `select()` via session, as in `backend/app/seed.py` lines 57–58 (context-managed session usage):
```python
with SessionLocal() as session:
    summary = merge_readings(session, clean, rejected)
```
Routers get their session from the `get_db` dependency instead (see `deps.py` below) — never import `SessionLocal` in route modules (RESEARCH Pitfall 10).

---

### `backend/app/deps.py` (dependency: `get_db` + `ReadingFilters`)

**Analog:** `backend/app/db.py` (whole file, 9 lines):
```python
"""Database engine and session factory (sync SQLAlchemy 2.0, per locked stack)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings

engine = create_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine)
```
**Pattern:** keep `db.py` untouched; `deps.py` wraps it in a generator dependency:
```python
from app.db import SessionLocal

def get_db():
    with SessionLocal() as session:
        yield session
```
This is what tests override via `app.dependency_overrides[get_db]` (Pitfall 10). Import convention: absolute `from app.x import y` (used across all Phase 1 modules — `seed.py` lines 28–29, `conftest.py` line 24).

`ReadingFilters` goes here too — copy RESEARCH Code Example 1 including the inclusive-end-date fix (`< end_date + timedelta(days=1)`, Pitfall 4).

---

### `backend/app/schemas.py` (Pydantic response models)

**Analog:** `backend/app/models.py` — the schemas must mirror it field-for-field, working around its attribute renames.

**Critical field-name facts** (`models.py` lines 40–52):
```python
id: Mapped[int] = mapped_column(Integer, primary_key=True)
# Naive local time — plain DateTime, never the tz-aware variant (DATA-05).
datetime_: Mapped[datetime] = mapped_column("datetime", DateTime, nullable=False)
systolic: Mapped[int] = mapped_column(Integer)
diastolic: Mapped[int] = mapped_column(Integer)
pulse: Mapped[int] = mapped_column(Integer)
am_pm: Mapped[str] = mapped_column(Text)
bp_category: Mapped[str] = mapped_column(Text)
pulse_category: Mapped[str] = mapped_column(Text)
# asdecimal=False -> floats consistently on SQLite and Postgres (RESEARCH Pitfall 6).
map_value: Mapped[float] = mapped_column("map", Numeric(5, 1, asdecimal=False))
pulse_pressure: Mapped[int] = mapped_column(Integer)
notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```
**Pattern to copy:** ORM attributes are `datetime_` and `map_value`; JSON keys must be `datetime` and `map`. Use `from_attributes=True` + `Field(validation_alias=AliasChoices("datetime_", "datetime"))` per RESEARCH Code Example 1 lines (ReadingOut model) and Pitfall 3. Naive datetimes serialize with no `Z`/offset — do not add timezone handling (DATA-05, `models.py` line 3).

---

### `backend/app/config.py` (MODIFY — extend Settings)

**Analog:** itself (whole file, 21 lines):
```python
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
```
**Pattern:** add fields (e.g. `cors_origins: list[str] = ["http://localhost:5173"]`) to this class. Do NOT create a new config mechanism; all consumers call `get_settings()` (cached). CONTEXT.md explicitly locks this ("extend Settings ... rather than new config mechanisms").

---

### `backend/app/main.py` (app assembly)

**Analog:** conventions from `backend/app/seed.py` (module docstring naming the decision IDs it implements, lines 1–21; absolute imports lines 28–29). No FastAPI app exists — assemble per RESEARCH Architecture Diagram: `CORSMiddleware` (explicit origins from `get_settings().cors_origins`, no `allow_credentials`, no `*`) → include routers with `dependencies=[Depends(verify_token)]` at router level so Phase 5 flips one function.

### `backend/app/auth.py` (verify_token stub)

**Analog:** `config.py` thin-module shape. Content is a documented no-op:
```python
def verify_token() -> None:
    """No-op auth dependency (Phase 2 design stub). Phase 5 replaces the body
    with itsdangerous token verification — routes never change."""
```
Attach at router level in `main.py`, not per-route.

---

### `backend/tests/test_api_readings.py` + `test_api_stats.py` (tests)

**Analog 1 — test style:** `backend/tests/test_categories.py`. Copy: module docstring citing decision IDs/pitfalls (lines 1–14), `pytest.mark.parametrize` boundary matrices (lines 21–52), typed test signatures:
```python
@pytest.mark.parametrize(
    ("systolic", "diastolic", "expected"),
    [
        # D-02 hypotension gate FIRST
        (89, 70, "Hypotension"),
        ...
    ],
)
def test_classify_bp_boundaries(systolic: int, diastolic: int, expected: str) -> None:
    assert classify_bp(systolic, diastolic) == expected
```
Use the same shape for filter-boundary tests (e.g. reading at 23:xx on `end_date` must be included — Pitfall 4).

**Analog 2 — DB fixtures:** `backend/tests/conftest.py` lines 71–85:
```python
@pytest.fixture
def engine():
    """Function-scoped in-memory SQLite engine with the full schema created."""
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session(engine):
    """A Session bound to the function-scoped in-memory engine."""
    with Session(engine) as s:
        yield s
```
**Pattern:** extend `conftest.py` with the `client` fixture from RESEARCH Code Example 6 — it composes the existing `session` fixture with `app.dependency_overrides[get_db]` and clears overrides after. Do not create a second fixture mechanism. Also copy the section-comment convention (`# --- DB fixtures (plan 01-06) ---`, conftest line 66) when adding the API-fixture section.

**Must-have serialization test** (Pitfall 3): assert exact JSON keys `datetime` and `map` (not `datetime_`/`map_value`) in a `/readings` response.

---

### Frontend files (no analogs — pattern sources instead)

For every frontend file the "analog" is a document, not code:

| Concern | Copy from |
|---------|-----------|
| zustand store shape (`filters.ts`) | RESEARCH Code Example 3 verbatim — this shape IS the Phase 3 agent command schema; keep `resolveFilters()` pure and outside the store |
| Query hooks | RESEARCH Code Example 4 (`placeholderData: keepPreviousData`, `staleTime`) |
| BP Timeline JSX | RESEARCH Code Example 5 (ReferenceAreas BEFORE Lines; `XAxis type="number" scale="time"`; fixed `domain={[40, 220]}`; `Tooltip trigger="click"`) |
| CSS tokens / dark mode | RESEARCH Code Example 7 + `02-UI-SPEC.md` (Design System, Spacing, Typography, both 60/30/10 palettes, chart data colors, clinical category colors, fixed axis bounds) |
| Copy strings (empty states, filter sentence, labels) | `02-UI-SPEC.md` Copywriting Contract |
| Layout/interaction (hero deck, filter bar order, table) | `02-UI-SPEC.md` Layout & Interaction Contract + D-17..D-24 |
| TS API types | Mirror `backend/app/schemas.py` JSON keys exactly (`datetime`, `map`, category label strings with spaces) |

**Planner note:** `02-UI-SPEC.md` resolved several discretion items (exact hex values, fixed axis bounds) — frontend plans must reference it, not re-derive palette/tokens.

## Shared Patterns

### 1. Decision-ID docstrings (all new backend files, test files)
**Source:** every Phase 1 module (`derivations.py` 1–31, `seed.py` 1–21, `models.py` 1–10, `test_categories.py` 1–14).
Every module opens with a docstring stating what it does, which requirement/decision IDs it implements, and any pinned invariants. New Phase 2 files must continue this — it is the project's primary self-documentation mechanism.

### 2. Canonical category labels — single source of truth
**Source:** `backend/app/derivations.py` lines 7–10 (and enforcement note lines 2–5).
**Apply to:** `schemas.py` Literals, `routers/*` filter validation, `CLINICAL_ORDER` in stats, `frontend/src/api/types.ts`, `frontend/src/lib/palette.ts` keys, category chips.
Exact strings: `"Hypotension"`, `"Normal"`, `"Elevated"`, `"Stage 1"`, `"Stage 2"`, `"Hypertensive Crisis"`; `"Bradycardia"`, `"Normal"`, `"Tachycardia"`. Spaces included — URL-encode in query params, never snake_case them.

### 3. Naive local datetimes end-to-end (DATA-05)
**Source:** `models.py` lines 3, 41–42; `derivations.py` lines 29–30.
**Apply to:** API filtering (`datetime.combine(date, datetime.min.time())`), JSON serialization (no `Z`), frontend `lib/dates.ts` (date-only strings parsed via `new Date(y, m-1, d)`, never `new Date("YYYY-MM-DD")` — RESEARCH Pitfall 1).

### 4. Config access via cached `get_settings()`
**Source:** `backend/app/config.py` lines 17–20; consumed in `db.py` line 8.
**Apply to:** `main.py` CORS origins, any future env-driven value. Never read `os.environ` directly.

### 5. Test DB isolation via fixtures + dependency override
**Source:** `conftest.py` lines 71–85 (in-memory engine/session) + RESEARCH Code Example 6 (`app.dependency_overrides[get_db]`).
**Apply to:** both new API test files. The module-level engine in `db.py` must never be hit by tests (Pitfall 10) — which is exactly why routes must depend on `get_db`, not import `SessionLocal`.

### 6. Attribute/column alias discipline
**Source:** `models.py` lines 33–36, 42, 50.
**Apply to:** `schemas.py` (validation aliases), API tests (assert JSON keys), `frontend/src/api/types.ts` (fields named `datetime`, `map`).

## No Analog Found

Files where the planner should use RESEARCH.md / UI-SPEC patterns (documented above) instead of codebase analogs:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/routers/*.py` | controller | read | No FastAPI routes exist anywhere in the repo (first-ever endpoints) |
| `backend/app/main.py` | app assembly | request-response | No app object exists |
| All 23 `frontend/` files | components/stores/hooks/utils/config/tests | various | `frontend/` directory does not exist; created fresh this phase |

## Metadata

**Analog search scope:** entire repo — `backend/app/`, `backend/tests/`, `backend/scripts/`, `backend/alembic/`; confirmed no `frontend/`, no other source directories (`find` over repo root)
**Files scanned:** 15 backend Python files enumerated; 7 read in full (models, config, db, derivations, seed, conftest, test_categories); UI-SPEC headings verified
**Pattern extraction date:** 2026-07-14
