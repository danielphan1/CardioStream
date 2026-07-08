# Phase 1: Data Foundation - Research

**Researched:** 2026-07-07
**Domain:** Python ETL (pandas 3.x + openpyxl), SQLAlchemy 2.0 / Alembic schema, medical derivation correctness, repo privacy
**Confidence:** HIGH (medical spec + stack verified against official sources; OMRON file format MEDIUM until the real file lands in `data/`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Category edge rules
- **D-01:** Textbook AHA classification is the spec; `bp_data_cleaned.csv` is a regression check, not the source of truth. Implement published AHA rules + the documented Hypotension rule from scratch, then diff against the CSV. If rows disagree, investigate — the CSV could have bugs; resolve mismatches deliberately and document them.
- **D-02:** Hypotension = systolic <90 **OR** diastolic <60, checked **before** the AHA ladder.
- **D-03:** When systolic and diastolic fall in different AHA categories, the **higher (more severe) category wins** (standard AHA guidance).
- **D-04:** Pulse categories: Bradycardia <60 bpm (60 exactly = Normal, locked in REQUIREMENTS.md); Tachycardia **>100 bpm** — Normal is 60–100 inclusive.

#### Re-ingest conflict policy
- **D-05:** Same datetime re-appears with different values → **upsert (update in place)**. The incoming file is truth; edits in the OMRON app are deliberate corrections. Counted as "updated" in the result summary.
- **D-06:** ETL result summary shape: **added / updated / unchanged** counts + total reading count + latest reading date. This shape carries forward to the Phase 5 upload page (API-03).
- **D-07:** Intra-file duplicate datetimes (minute-granularity collisions): **last row in file order wins**, surfaced in the result summary — never silent.
- **D-08:** Rows with missing/unparseable values: **skip the row and report it** in a rejected list with a per-row reason. One bad cell never blocks the rest of the file.

#### Synthetic sample design
- **D-09:** Sample produced by a **seeded-random Python generator script; both the script and its output file are committed**. Regenerable if schema evolves; doubles as portfolio evidence.
- **D-10:** Sample matches the real data's character: ~130 rows over the same Feb–Jun span, ~88% bradycardic pulse, systolic spanning ~60–211, every BP category represented (including Crisis and Hypotension), mixed AM/PM.
- **D-11:** Sample format is an **OMRON-format .xlsx** (Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes columns) so it exercises the real openpyxl ingest path end-to-end and works as a Phase 5 upload demo file.
- **D-12:** Seeder data selection: **real export if present locally, else synthetic sample** — one zero-config seed command that works on the dev machine, fresh clones, and CI.

#### Data files & seeding flow
- **D-13:** Real data files live in a top-level **gitignored `data/` directory** (raw OMRON export .xlsx + `bp_data_cleaned.csv`). User adds them **before Phase 1 execution starts**, so the ETL is built against the real format from day one.
- **D-14:** Seeding ingests the **raw OMRON xlsx through the full ETL pipeline** (same code path future uploads will use). `bp_data_cleaned.csv` is used **only as the golden-master fixture in the test suite** — it is never loaded into the DB.
- **D-15:** Monorepo layout from day one: top-level `backend/` (FastAPI app, ETL, tests, alembic) and `frontend/` (reserved, created in Phase 2), with `data/` gitignored at root. Matches the Vercel/Railway deploy split.
- **D-16:** Seeder invoked as **`python -m app.seed`** — a module entry point inside the app package sharing the ETL function, SQLAlchemy models, and settings with the API. Documented in the README.

### Claude's Discretion
- MAP formula precision/rounding, exact Numeric column precision, Alembic migration granularity (one vs. two migrations), test fixture organization, generator script internals — planner/executor decide within the locked stack (Python 3.12, pandas 3.x, SQLAlchemy 2.0 sync ORM, Alembic, SQLite dev / Postgres prod).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | ETL ingests OMRON exports, computes derived fields (AM/PM, BP category, pulse category, MAP, pulse pressure) in ETL only | Pure-function ETL pattern (§Architecture Patterns), pandas 3.0 read_excel + openpyxl (§Standard Stack), derivation formulas (§Code Examples) |
| DATA-02 | AHA classification + Hypotension; Bradycardia/Normal/Tachycardia pulse | AHA thresholds verified against heart.org (§Verified AHA Classification), severity-max implementation pattern (§Code Examples) |
| DATA-03 | Idempotent re-ingest, DB unique constraint on datetime | Python-level merge with unique constraint safety net (§Architecture Patterns: Idempotent Merge), counts satisfy D-06 |
| DATA-04 | Seed 132 real readings | `python -m app.seed` flow (D-12/D-16), full-ETL seeding path (§Architecture Patterns) |
| DATA-05 | Naive local time end-to-end | SQLAlchemy `DateTime` (no timezone), tz-naive pandas datetimes (§Common Pitfalls: Timezone Leakage) |
| DATA-06 | Alembic migrations incl. empty future tables | Alembic 1.18 + `render_as_batch=True` + naming convention, verified against official docs (§Architecture Patterns: Migrations) |
| DATA-07 | Tests: category boundaries, MAP, AM/PM, idempotency | Boundary test matrix (§Validation Architecture), golden-master skip pattern (§Code Examples) |
| DATA-08 | No real health data in repo; synthetic sample committed | Gitignore-first commit ordering (§Common Pitfalls: Privacy Is Irreversible), seeded generator design (D-09..D-11) |
</phase_requirements>

## Summary

Phase 1 is a pure-Python backend phase: parse an OMRON `.xlsx` export with pandas 3.0 + openpyxl, compute five derived fields via a tested pure function, and merge rows into a SQLAlchemy 2.0 schema (SQLite dev / Postgres prod) managed by Alembic. There are no exotic dependencies — every library is a top-of-ecosystem package already locked in CLAUDE.md, re-verified today on PyPI and passed through slopcheck (all `[OK]`).

The three correctness-critical areas are: (1) the **AHA classification thresholds**, now verified against heart.org — the 2025 AHA/ACC guideline explicitly kept the 2017 categories unchanged, and the Crisis boundary is *strictly greater than* 180/120 (180 exactly is Stage 2); (2) **idempotent merge with added/updated/unchanged counts** — dialect-level `ON CONFLICT` upserts cannot cheaply report per-row added-vs-updated-vs-unchanged, so a Python-level merge inside one transaction (with the DB unique constraint as a safety net) is the right design for a 132-row single-user dataset; (3) **privacy ordering** — `.gitignore` with `data/` must exist in the very first commit, before any real file can be staged.

The single open risk is that `data/` does not exist yet (verified: absent from the working tree). D-13 says the user adds real files before execution; the plan must front-load a human checkpoint verifying the actual OMRON file format (Date/Time as two columns? datetime cells or strings?) before ETL tasks run, and every test that touches real data must skip cleanly when `data/` is absent (fresh clones, CI).

**Primary recommendation:** Build the ETL as a pure `raw_df -> (clean_df, rejected)` function with a separate `merge_readings(session, clean_df) -> summary` loader; classify BP by mapping systolic and diastolic to categories independently and taking the more severe (after the D-02 hypotension gate); enable Alembic `render_as_batch=True` + the standard SQLAlchemy naming convention from day one.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File parsing (xlsx → DataFrame) | ETL module (`app/etl.py`) | — | pandas/openpyxl; same code path serves Phase 5 upload route |
| Derivations (AM/PM, categories, MAP, PP) | ETL pure function | — | DATA-01: categories computed in ETL only — single source of truth; DB stores results |
| Row rejection / intra-file dedupe | ETL pure function | — | D-07/D-08 happen before the DB sees anything |
| Idempotency + upsert | DB loader (merge function) | DB unique constraint | D-05 semantics need per-row compare; constraint is the last-line guarantee (DATA-03) |
| Schema + portability (SQLite/Postgres) | SQLAlchemy models | Alembic migrations | Typed declarative with portable types per CLAUDE.md |
| Migrations (readings + 3 empty future tables) | Alembic | — | DATA-06; autogenerate from models |
| Seeding | `python -m app.seed` CLI | ETL + loader | Thin entry point; all logic lives in shared modules (D-16) |
| Privacy (real data never committed) | Repo config (`.gitignore`) | Golden-master test skip logic | Irreversible if missed — first commit concern, not code |
| Synthetic sample | Generator script | Committed xlsx artifact | D-09..D-11; exercises real ingest path |

## Standard Stack

All packages below were locked in CLAUDE.md (versions verified against the PyPI JSON API on 2026-07-07), re-confirmed on PyPI today, and passed slopcheck. `[VERIFIED: PyPI registry + slopcheck OK]` applies to every row.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.12 (3.13.4 also on machine) | Runtime | pandas 3.x requires ≥3.11; both 3.12 and 3.13 installed locally |
| pandas | 3.0.3 | ETL derivations | Locked stack; CoW idioms (`df.loc[...] = ...`), default `str` dtype |
| openpyxl | 3.1.5 | `.xlsx` engine for `pd.read_excel` | Must be installed explicitly; also writes the synthetic sample xlsx |
| SQLAlchemy | 2.0.51 | ORM, typed declarative | One model set for SQLite dev + Postgres prod; `Mapped[]`/`mapped_column` per CLAUDE.md |
| Alembic | 1.18.5 | Migrations | DATA-06 (empty future tables); autogenerate from models |
| pydantic | 2.13.4 | Result-summary model, row validation | Summary shape carries to Phase 5 API-03 response |
| pydantic-settings | 2.14.2 | Config (`DATABASE_URL`) from env | Shared by seeder and future API |
| pytest | 9.1.1 | Test suite | DATA-07 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ruff | 0.15.20 | Lint + format | Dev tool, per CLAUDE.md |
| psycopg (`psycopg[binary]`) | 3.3.4 | Postgres driver | **Defer install to Phase 5 (deploy)** — Phase 1 runs on SQLite; keep models portable now, add driver when Postgres appears |
| fastapi / httpx | 0.139.0 / 0.28.1 | API framework / TestClient | **Not needed in Phase 1** (no endpoints). Listed because `app/` package layout must anticipate them (D-15/D-16) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python-level merge loop | Dialect `insert().on_conflict_do_update()` (sqlite + postgresql dialects) [ASSUMED — stable API, docs.sqlalchemy.org/en/20/dialects] | ON CONFLICT can't distinguish updated vs unchanged per row without RETURNING gymnastics, and the construct differs per dialect. At 132–200 rows, the Python loop is simpler, portable, and directly yields D-06 counts |
| openpyxl for sample generation | pandas `df.to_excel()` | `to_excel` also uses openpyxl under the hood; either is fine — `to_excel` is less code, use it |
| Alembic for test DB setup | `Base.metadata.create_all()` in test fixtures | Use create_all in tests (fast, in-memory); verify migrations separately with one `alembic upgrade head` check. Don't run migrations per-test |

**Installation:**
```bash
# backend/, inside a venv (python3.12 -m venv .venv)
pip install "pandas==3.0.*" "openpyxl==3.1.*" "sqlalchemy==2.0.*" "alembic==1.18.*" \
            "pydantic==2.13.*" "pydantic-settings==2.14.*" "pytest==9.*" "ruff==0.15.*"
```

**Version verification:** Done 2026-07-07 via PyPI JSON API: pandas 3.0.3, sqlalchemy 2.0.51, alembic 1.18.5, openpyxl 3.1.5, pytest 9.1.1, pydantic 2.13.4, pydantic-settings 2.14.2, ruff 0.15.20, psycopg 3.3.4, fastapi 0.139.0, httpx 0.28.1. All match CLAUDE.md's stack table (verified same day).

## Package Legitimacy Audit

slopcheck installed and run this session (`slopcheck install ... ` on the PyPI ecosystem): **11/11 packages rated [OK]**.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| pandas | PyPI | 15+ yrs | top-10 PyPI | github.com/pandas-dev/pandas | [OK] | Approved |
| sqlalchemy | PyPI | 15+ yrs | top-50 PyPI | github.com/sqlalchemy/sqlalchemy | [OK] | Approved |
| alembic | PyPI | 10+ yrs | very high | github.com/sqlalchemy/alembic | [OK] | Approved |
| openpyxl | PyPI | 10+ yrs | very high | foss.heptapod.net/openpyxl/openpyxl | [OK] | Approved |
| pydantic | PyPI | 8+ yrs | top-20 PyPI | github.com/pydantic/pydantic | [OK] | Approved |
| pydantic-settings | PyPI | 4+ yrs | very high | github.com/pydantic/pydantic-settings | [OK] | Approved |
| pytest | PyPI | 15+ yrs | top-20 PyPI | github.com/pytest-dev/pytest | [OK] | Approved |
| ruff | PyPI | 3+ yrs | very high | github.com/astral-sh/ruff | [OK] | Approved |
| psycopg | PyPI | 4+ yrs (v3 line) | very high | github.com/psycopg/psycopg | [OK] | Approved (deferred to Phase 5) |
| fastapi | PyPI | 7+ yrs | top-30 PyPI | github.com/fastapi/fastapi | [OK] | Approved (not installed this phase) |
| httpx | PyPI | 6+ yrs | very high | github.com/encode/httpx | [OK] | Approved (not installed this phase) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

(Age/download figures are order-of-magnitude characterizations of universally known packages, not fresh registry pulls; the load-bearing verification is slopcheck [OK] + today's PyPI version confirmation.)

## Verified AHA Classification (the medical spec)

Verified against heart.org "Understanding Blood Pressure Readings" and confirmed unchanged by the 2025 AHA/ACC guideline (categories and the ≥130/80 hypertension threshold were explicitly retained from 2017). `[CITED: heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings; ahajournals.org/doi/10.1161/HYP.0000000000000249]`

| Category | Systolic (mm Hg) | Logic | Diastolic (mm Hg) |
|----------|------------------|-------|-------------------|
| Normal | <120 | and | <80 |
| Elevated | 120–129 | and | <80 |
| Stage 1 Hypertension | 130–139 | or | 80–89 |
| Stage 2 Hypertension | ≥140 | or | ≥90 |
| Hypertensive Crisis | **>180** | and/or | **>120** |

**Critical boundary facts:**
- Crisis is *strictly greater than* 180 / 120. **SBP exactly 180 → Stage 2. DBP exactly 120 → Stage 2.** SBP 181 or DBP 121 → Crisis.
- D-03's "higher category wins" is implemented naturally by classifying systolic and diastolic *independently* on the ladder and taking the more severe result — this reproduces the and/or logic of the official table exactly (e.g., 125/85 → Stage 1 via diastolic; 125/75 → Elevated).
- Hypotension (D-02, locked): SBP <90 **OR** DBP <60, checked **before** the ladder. The commonly cited clinical definition of low BP is <90/60 [ASSUMED — consistent with AHA's low-BP page, not re-verified this session], but the rule here is a locked user decision regardless.
- Pulse (D-04, locked): Bradycardia <60, Normal 60–100 inclusive, Tachycardia >100.

**Derivation formulas** (standard clinical estimates, HIGH confidence, universally consistent across sources):
- **MAP** = DBP + (SBP − DBP)/3, equivalently (SBP + 2·DBP)/3
- **Pulse pressure** = SBP − DBP (integer)
- **AM/PM**: reading hour <12 → "AM", else "PM" (12:00 noon exactly = PM). Must match the CSV's convention — golden-master diff will confirm.

**Recommendation on MAP precision (Claude's discretion):** compute as float, round to 1 decimal place for storage (`Numeric(5, 1)`), and diff against the CSV with tolerance (`atol=0.05`) until the CSV's own rounding convention is inspected — then pin exactly.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────────────────┐
                         │                 data/ (gitignored)           │
                         │  omron_export.xlsx    bp_data_cleaned.csv    │
                         └───────┬──────────────────────┬───────────────┘
                                 │                      │ (test fixture ONLY,
     backend/sample_data/        │                      │  never loaded to DB)
     omron_sample.xlsx ──────┐   │                      ▼
     (committed, D-12        │   │              [golden-master test]
      fallback)              ▼   ▼                      ▲
                        ┌────────────────┐              │ diff derived cols
python -m app.seed ───► │ parse_omron()  │              │
(picks real file if     │ xlsx → raw_df  │              │
 present, else sample)  └───────┬────────┘              │
                                ▼                       │
                        ┌────────────────┐   clean_df   │
                        │ transform()    ├──────────────┘
                        │ pure function: │
                        │ dedupe (D-07)  │──► rejected rows + reasons (D-08)
                        │ reject (D-08)  │
                        │ derive 5 cols  │
                        └───────┬────────┘
                                ▼
                        ┌────────────────┐    ┌──────────────────────────┐
                        │ merge_readings │───►│ SQLite dev / Postgres     │
                        │ per-row:       │    │ readings (UNIQUE datetime)│
                        │ add/update/    │    │ lab_results (empty)       │
                        │ unchanged      │    │ incidents   (empty)       │
                        └───────┬────────┘    │ procedures  (empty)       │
                                ▼             └────────────▲──────────────┘
                        IngestSummary                      │
                        (added/updated/unchanged/          │ alembic upgrade head
                         rejected/total/latest_date)   [Alembic migrations]
                        └── reused by Phase 5 POST /upload
```

### Recommended Project Structure

```
Health-Visualizer/
├── .gitignore                  # data/ + dev.db + .venv + __pycache__  — FIRST COMMIT
├── data/                       # gitignored; user drops real files here (D-13)
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py           # pydantic-settings: DATABASE_URL (default sqlite:///./dev.db)
│   │   ├── db.py               # engine + Session factory (sync)
│   │   ├── models.py           # Base w/ naming_convention; Reading + 3 future tables
│   │   ├── etl.py              # parse_omron(), transform(), merge_readings(), IngestSummary
│   │   └── seed.py             # python -m app.seed (thin: pick file → ETL → merge → print summary)
│   ├── alembic/
│   │   ├── env.py              # render_as_batch=True; target_metadata = Base.metadata
│   │   └── versions/
│   ├── alembic.ini
│   ├── sample_data/
│   │   └── omron_sample.xlsx   # committed synthetic sample (D-09..D-11)
│   ├── scripts/
│   │   └── generate_sample.py  # seeded-random generator (committed, D-09)
│   ├── tests/
│   │   ├── conftest.py         # tmp SQLite engine fixture, sample-file fixture
│   │   ├── test_categories.py  # boundary matrix (pure function, no DB)
│   │   ├── test_derivations.py # MAP, pulse pressure, AM/PM
│   │   ├── test_etl.py         # parse/reject/dedupe on synthetic sample
│   │   ├── test_idempotency.py # double-ingest, upsert, unchanged counts (DB)
│   │   └── test_golden_master.py  # skipif data/ absent; diff vs bp_data_cleaned.csv
│   └── pyproject.toml          # deps + pytest + ruff config
└── frontend/                   # reserved, created Phase 2 (D-15)
```

### Pattern 1: ETL as three composable functions
**What:** `parse_omron(path_or_buffer) -> raw_df`, `transform(raw_df) -> (clean_df, rejected: list[RejectedRow])`, `merge_readings(session, clean_df) -> IngestSummary`. The seeder and the Phase 5 upload route both call the same three functions.
**When to use:** Always here — it is the CLAUDE.md-mandated pattern ("pure function raw_df -> clean_df shared by CLI seeder and upload route") and lets unit tests hit `transform` with hand-built DataFrames (no files, no DB).

### Pattern 2: Idempotent merge with D-06 counts (not ON CONFLICT)
**What:** Load existing rows keyed by datetime into a dict, then per clean row: absent → INSERT (added); present with different values → UPDATE (updated); identical → skip (unchanged). One transaction. The `UniqueConstraint` on `datetime` remains as a hard guarantee against any bug in the merge (DATA-03's literal requirement).
**When to use:** This dataset (hundreds of rows, single user). Dialect ON CONFLICT would need per-dialect constructs and can't report unchanged-vs-updated.
**Detail:** "identical" means all of systolic/diastolic/pulse/notes equal — derived fields are recomputed deterministically so they follow the inputs.

### Pattern 3: Alembic with batch mode + naming convention from migration #1
**What:** `render_as_batch=True` in `env.py`'s `context.configure()`, and the standard naming convention on `MetaData`. Verified against Alembic and SQLAlchemy official docs. `[CITED: alembic.sqlalchemy.org/en/latest/batch.html; docs.sqlalchemy.org/en/20/core/constraints.html]`
**Why:** SQLite barely supports ALTER; batch mode does move-and-copy, and it's explicitly documented as "safe to use in all cases" (no-op on Postgres). Unnamed constraints can't be dropped on SQLite — the naming convention names every constraint at model-definition time, which also makes autogenerate diffs reproducible on both databases.
**Migration granularity (discretion):** two migrations reads well for the roadmap's success criterion #5 ("readings table plus empty future tables") — migration 1: readings; migration 2: lab_results/incidents/procedures. One combined migration is also acceptable; recommend two for portfolio legibility.

### Pattern 4: Golden-master test that skips off-machine
**What:** `pytest.mark.skipif(not Path("data/bp_data_cleaned.csv").exists(), reason="real data not present")`. The golden-master runs only on the dev machine; CI and fresh clones rely on the boundary/unit tests plus the synthetic sample.
**When to use:** Any test touching `data/` (golden master, real-file seed check).

### Pattern 5: Seeder file selection (D-12)
**What:** `app/seed.py` resolves the input: if a real export exists under `data/` (glob `data/*.xlsx`), use it; else use `backend/sample_data/omron_sample.xlsx`. Print which source was used plus the IngestSummary.

### Anti-Patterns to Avoid
- **Computing categories anywhere but `transform()`:** DATA-01 mandates single source of truth. No SQL-side CASE expressions, no recomputation in future API code.
- **`session.merge()` for the upsert:** SQLAlchemy's `merge()` keys on primary key (autoincrement id), not the datetime natural key — it cannot implement D-05. Use the explicit dict-lookup loop.
- **Chained assignment / `inplace=True` pandas idioms:** dead under pandas 3.0 CoW. Always `df.loc[mask, "col"] = value` and treat every op as returning a copy (CLAUDE.md).
- **Loading `bp_data_cleaned.csv` into the DB "just to seed faster":** explicitly forbidden by D-14 — it bypasses the ETL path the tests must exercise.
- **`datetime.utcnow()` / tz-aware anything:** DATA-05. Naive local time everywhere.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| xlsx parsing | cell-walking with raw openpyxl | `pd.read_excel(path, engine="openpyxl")` | pandas handles headers, dtypes, datetime cells, blank trailing rows |
| Excel serial-date decoding | manual `(value - 25569) * 86400` math | pandas' read_excel datetime handling; if a column arrives as text, `pd.to_datetime(..., errors="coerce")` | Excel epoch/leap-year-1900 bugs are a classic trap; openpyxl+pandas already decode date-formatted cells to `datetime` |
| Migration diffing | hand-written DDL | `alembic revision --autogenerate` | Names, types, constraints stay in sync with models on both dialects |
| Config parsing | `os.environ.get` scattered | pydantic-settings `BaseSettings` | Typed, defaulted, one place; shared with Phase 2+ API |
| DataFrame equality in tests | manual loops | `pandas.testing.assert_frame_equal` / `assert_series_equal` (with `check_exact=False`, `atol`) | Correct NaN semantics, dtype-aware diffs, readable failure output |
| Sample xlsx writing | manual openpyxl workbook assembly | `df.to_excel(path, index=False)` | One line; same engine |

**Key insight:** every hard sub-problem in this phase (Excel quirks, schema migration, DataFrame comparison) is already solved by a library the stack mandates anyway. The only genuinely custom logic is the ~40-line classifier + merge loop — which is exactly the code the test suite exists to pin down.

## Common Pitfalls

### Pitfall 1: Privacy is a first-commit problem, not a code problem
**What goes wrong:** A real health-data file gets committed before `.gitignore` exists; git history now contains PHI in a public portfolio repo, and rewriting history is the only fix.
**Why it happens:** Scaffolding tasks and data-drop timing race each other; D-13 has the user adding files "before Phase 1 execution starts" — possibly before the repo has a `.gitignore`.
**How to avoid:** Plan task #1 = `.gitignore` containing `data/`, `dev.db`, `.venv/`, `__pycache__/`, committed alone before anything else. Verify with `git check-ignore -v data/somefile` and `git status` showing data/ invisible.
**Warning signs:** `git status` ever lists anything under `data/`.

### Pitfall 2: Crisis/Stage-2 boundary off-by-one
**What goes wrong:** Implementing Crisis as `>=180` (or Stage 2 diastolic reaching Crisis at `>=120`) misclassifies edge readings; Chris's data reaches systolic 211, so Crisis rows genuinely exist.
**Why it happens:** The AHA table's "140 or higher" (inclusive) vs "higher than 180" (exclusive) asymmetry is easy to flatten.
**How to avoid:** Boundary tests at 179/180/181 systolic and 119/120/121 diastolic; spec table above is the verified source.
**Warning signs:** Golden-master diff shows disagreement only on extreme rows.

### Pitfall 3: Hypotension-gate precedence on wide-pulse-pressure rows
**What goes wrong:** A reading like 200/55 is Hypotension under D-02 (diastolic <60 checked before the ladder) even though systolic is Crisis-range. The CSV may have classified such rows differently.
**Why it happens:** Two locked rules (hypotension-first, higher-wins) interact; only one can apply to these rows.
**How to avoid:** D-02 is locked — implement it literally, add an explicit test pinning `classify_bp(200, 55) == "Hypotension"`, and treat any golden-master mismatch on such rows as a D-01 "investigate and document" event, not a code bug.
**Warning signs:** Golden-master mismatches concentrated on rows with diastolic <60 and high systolic.

### Pitfall 4: Timezone leakage breaks AM/PM (DATA-05)
**What goes wrong:** A UTC conversion sneaks in (server default `func.now()`, `pd.Timestamp.utcnow()`, `datetime.now(timezone.utc)`), shifting some readings across the noon/midnight boundary and silently corrupting AM/PM analysis.
**Why it happens:** tz-aware is the "modern best practice" reflex; here it is explicitly wrong.
**How to avoid:** SQLAlchemy `DateTime()` (timezone=False is the default); never call `tz_localize`/`tz_convert`; no `timezone.utc` imports in app code. Store what the OMRON device recorded.
**Warning signs:** Any `datetime64[ns, tz]` dtype in the pipeline; timestamps ending in `+00:00`.

### Pitfall 5: pandas 3.0 idiom breakage
**What goes wrong:** pandas 2.x habits — chained assignment (`df["col"][mask] = x`), reliance on `SettingWithCopyWarning`, assuming object dtype for strings — silently no-op or change dtype behavior under 3.0.
**Why it happens:** Most training-data examples and blog posts predate pandas 3.0 (released 2026-01-21).
**How to avoid:** `df.loc[mask, "col"] = value` only; expect `str` dtype for the Notes/Symptoms columns; missing values in str columns are still NaN — use `df["notes"].isna()`, and normalize to `None` before DB insert.
**Warning signs:** A mutation that "doesn't take"; dtype assertions failing on `object` vs `str`.

### Pitfall 6: `Numeric` on SQLite is approximate
**What goes wrong:** SQLAlchemy `Numeric` on SQLite round-trips through float (SQLite has no native decimal); tests comparing MAP with `==` against `Decimal` values flake or a warning appears.
**Why it happens:** CLAUDE.md mandates portable `Numeric`, which is correct for Postgres but floats on SQLite.
**How to avoid:** Round MAP in the ETL *before* insert (one decimal), and compare in tests with `pytest.approx` / `atol`. Optionally `Numeric(5, 1, asdecimal=False)` to get floats consistently on both backends.
**Warning signs:** `SAWarning` about Decimal objects on SQLite; equality-test flakes on MAP.

### Pitfall 7: Models drift from migrations
**What goes wrong:** Tests use `metadata.create_all()` (fast, correct choice) so nothing exercises the Alembic migrations, and by Phase 5 `alembic upgrade head` no longer matches the models.
**How to avoid:** One cheap test or verification step: run `alembic upgrade head` against a temp SQLite file and assert `alembic check` (1.18 supports it) or compare reflected tables to `Base.metadata.tables.keys()`.
**Warning signs:** autogenerate producing "surprise" diffs later.

### Pitfall 8: Golden-master compares the wrong column set
**What goes wrong:** `bp_data_cleaned.csv` has extra derived columns (DayOfWeek, WeekNumber, Month) that are *not* in the DB schema and not phase requirements. Diffing the whole frame fails spuriously; the CSV's category label strings may also differ from the DB's canonical labels ("Stage 1" vs "Hypertension Stage 1").
**How to avoid:** Diff exactly: DateTime, AM_PM, BP_Category, Pulse_Category, MAP (with atol), Pulse_Pressure. Build an explicit label-mapping dict from CSV labels → canonical labels after inspecting the real CSV (execution-time task), and document it in the test.
**Warning signs:** Golden-master failing on columns the ETL never produces.

## Code Examples

All examples follow patterns verified against official docs cited in Sources; code is illustrative for the planner, not copy-paste-final.

### Declarative base with naming convention (SQLAlchemy 2.0 typed)
```python
# Source: docs.sqlalchemy.org/en/20/core/constraints.html (naming convention dict quoted verbatim)
from sqlalchemy import MetaData, UniqueConstraint, Integer, Numeric, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)

class Reading(Base):
    __tablename__ = "readings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    datetime_: Mapped[datetime] = mapped_column("datetime", DateTime, nullable=False)  # naive local
    systolic: Mapped[int]
    diastolic: Mapped[int]
    pulse: Mapped[int]
    am_pm: Mapped[str] = mapped_column(Text)
    bp_category: Mapped[str] = mapped_column(Text)
    pulse_category: Mapped[str] = mapped_column(Text)
    map_value: Mapped[float] = mapped_column("map", Numeric(5, 1, asdecimal=False))
    pulse_pressure: Mapped[int]
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    __table_args__ = (UniqueConstraint("datetime"),)  # DATA-03 hard guarantee
```
(Note: `map` is a Python builtin and `datetime` shadows the module — map attribute names to the sketch's column names via the first `mapped_column` argument as shown.)

### BP classifier implementing D-02/D-03 + verified AHA table
```python
# Spec: heart.org BP categories (verified 2026-07-07); D-02 hypotension gate; D-03 severity-max
SEVERITY = ["Normal", "Elevated", "Stage 1", "Stage 2", "Crisis"]  # canonical labels: planner may adjust

def _sys_cat(s: int) -> str:
    if s > 180: return "Crisis"          # strictly greater — 180 is Stage 2
    if s >= 140: return "Stage 2"
    if s >= 130: return "Stage 1"
    if s >= 120: return "Elevated"
    return "Normal"

def _dia_cat(d: int) -> str:
    if d > 120: return "Crisis"          # strictly greater — 120 is Stage 2
    if d >= 90: return "Stage 2"
    if d >= 80: return "Stage 1"
    return "Normal"

def classify_bp(systolic: int, diastolic: int) -> str:
    if systolic < 90 or diastolic < 60:   # D-02: checked BEFORE the ladder
        return "Hypotension"
    return max(_sys_cat(systolic), _dia_cat(diastolic), key=SEVERITY.index)  # D-03

def classify_pulse(pulse: int) -> str:    # D-04
    if pulse < 60: return "Bradycardia"
    if pulse > 100: return "Tachycardia"
    return "Normal"
```

### env.py batch mode
```python
# Source: alembic.sqlalchemy.org/en/latest/batch.html — "safe to use in all cases; no-op on non-SQLite"
context.configure(
    connection=connection,
    target_metadata=Base.metadata,
    render_as_batch=True,
)
```

### Idempotent merge with D-06 counts
```python
from sqlalchemy import select

def merge_readings(session, clean_df) -> IngestSummary:
    existing = {r.datetime_: r for r in session.scalars(select(Reading))}
    added = updated = unchanged = 0
    for row in clean_df.itertuples(index=False):
        current = existing.get(row.datetime)
        if current is None:
            session.add(Reading(**_to_kwargs(row))); added += 1
        elif _differs(current, row):        # compare systolic/diastolic/pulse/notes
            _apply(current, row); updated += 1   # D-05: incoming file is truth
        else:
            unchanged += 1
    session.commit()
    return IngestSummary(added=added, updated=updated, unchanged=unchanged,
                         rejected=..., total=len(existing) + added,
                         latest=max(existing | new datetimes))
```

### Golden-master test skeleton
```python
import pytest
from pathlib import Path

REAL_CSV = Path(__file__).parents[2] / ".." / "data" / "bp_data_cleaned.csv"  # resolve from repo root

@pytest.mark.skipif(not REAL_CSV.exists(), reason="real data not present (gitignored)")
def test_golden_master():
    raw = parse_omron(find_real_export())
    clean, rejected = transform(raw)
    expected = pd.read_csv(REAL_CSV, parse_dates=["DateTime"])
    # diff ONLY the five derived columns + DateTime; map CSV labels -> canonical first
    pd.testing.assert_series_equal(clean["map"], expected["MAP"], check_exact=False, atol=0.05, ...)
```

### Boundary test matrix (the DATA-07 core)
| Function | Must-test values | Expected |
|----------|------------------|----------|
| classify_bp | (89, 70), (90, 60), (200, 55) | Hypotension, Normal-path, Hypotension (D-02 precedence pin) |
| classify_bp | (119,79), (120,79), (129,79), (130,79), (139,79), (140,79) | Normal, Elevated, Elevated, Stage 1, Stage 1, Stage 2 |
| classify_bp | (115,80), (115,89), (115,90) — with sys<90 guard avoided | Stage 1, Stage 1, Stage 2 (diastolic drives, D-03) |
| classify_bp | (180,100), (181,100), (150,120), (150,121) | Stage 2, Crisis, Stage 2, Crisis |
| classify_pulse | 59, 60, 100, 101 | Bradycardia, Normal, Normal, Tachycardia |
| MAP | (120, 80) → 93.3; (90, 60) → 70.0 | rounding convention pinned |
| am_pm | 00:00, 11:59, 12:00, 23:59 | AM, AM, PM, PM |
| pulse_pressure | (120, 80) → 40 | integer |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2017-only citation for AHA categories | 2025 AHA/ACC guideline (Aug 2025) — categories retained unchanged | 2025-08 | Spec is current; cite 2025 guideline for the portfolio README |
| pandas 2.x chained assignment / SettingWithCopyWarning | pandas 3.0 CoW always-on, `str` dtype default | 2026-01 (3.0.0) | Write `df.loc[...] = ...`; expect str dtype |
| `declarative_base()` + untyped columns | `DeclarativeBase` + `Mapped[]`/`mapped_column` | SQLAlchemy 2.0 | Locked in CLAUDE.md |
| psycopg2 | psycopg 3 (`postgresql+psycopg://`) | current | Deferred to Phase 5, but keep the URL scheme in mind |

**Deprecated/outdated:** nothing else relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Real OMRON export has columns Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes with Date/Time in two columns (per PROJECT.md + weakly corroborated by OMRON community reports that the newer export "separates date and time into two columns") | Architecture / ETL | ETL parser targets wrong shape; must be verified against the actual file before ETL tasks (STATE.md flagged blocker) |
| A2 | Date/Time cells arrive as Excel datetime/time cells (pandas decodes natively), not text or serial numbers | ETL parsing | Parser needs `pd.to_datetime(..., errors="coerce")` fallback branch; recommend building the defensive branch regardless |
| A3 | `bp_data_cleaned.csv` category label strings and MAP rounding convention unknown until file inspected | Golden-master test | Diff needs a label-mapping dict and tolerance; execution-time inspection task required |
| A4 | Hypotension <90/60 matches the common clinical definition | Medical spec | None — D-02 locks the rule independent of external sources |
| A5 | Dialect `on_conflict_do_update` API shape (listed only as rejected alternative) | Alternatives | None — not the recommended path |
| A6 | Age/download characterizations in the legitimacy audit table are from general knowledge, not fresh registry pulls | Package audit | None material — slopcheck [OK] + PyPI version check are the load-bearing verifications |

## Open Questions

1. **Actual OMRON file format (A1/A2)**
   - What we know: PROJECT.md's column list came from the user; OMRON's newer export separates Date and Time columns.
   - What's unclear: header row position, cell types, blank-row noise, whether Symptoms/Consumed/Notes are truly empty.
   - Recommendation: plan an explicit first ETL task "inspect `data/*.xlsx` with `pd.read_excel(..., nrows=5)` and pin the parser to reality"; gate ETL implementation behind the files existing (checkpoint if `data/` still absent at execution).
2. **CSV label strings + MAP rounding (A3)**
   - What we know: CSV has DateTime, AM_PM, DayOfWeek, WeekNumber, Month, BP_Category, Pulse_Category, MAP, Pulse_Pressure.
   - What's unclear: exact category spellings; MAP decimals.
   - Recommendation: inspect at execution; encode a label map in the golden-master test; per D-01, mismatches are investigated, not auto-matched.
3. **Canonical DB label strings** (e.g., "Stage 1" vs "Hypertension Stage 1", "Crisis" vs "Hypertensive Crisis")
   - Recommendation: planner picks canonical labels now (they surface in Phase 2 charts/API filters); suggest matching whatever the CSV/Tableau prototype used so the dashboard reads identically to the prototype — decide after CSV inspection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Runtime (CLAUDE.md) | ✓ | 3.12 at /usr/local/bin/python3.12 (3.13.4 default) | Use 3.12 venv per CLAUDE.md |
| pip | Package install | ✓ | 25.1.1 | — |
| SQLite | Dev database | ✓ | 3.51.0 (well past 3.24 ON CONFLICT floor) | — |
| git | Repo/privacy setup | ✓ | 2.39.3 | — |
| PostgreSQL (psql) | Prod DB | ✗ | — | Not needed until Phase 5 deploy; SQLite is the sanctioned dev DB |
| Node.js | — | ✓ 24.14.0 | — | Not needed this phase |
| `data/` real OMRON xlsx + `bp_data_cleaned.csv` | DATA-04 seed, golden-master | ✗ **absent as of research** | — | Synthetic sample covers dev/tests; **no fallback for golden-master or real seed** |

**Missing dependencies with no fallback:**
- Real data files in `data/` — D-13 says user adds them before execution. Plan must verify presence at execution start (checkpoint) before the golden-master/seed tasks; all other tasks proceed regardless.

**Missing dependencies with fallback:**
- PostgreSQL — SQLite dev is the locked fallback until Phase 5.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.1.1 (greenfield — nothing installed yet) |
| Config file | none — Wave 0 creates `backend/pyproject.toml` with `[tool.pytest.ini_options]` |
| Quick run command | `cd backend && python -m pytest tests -x -q` |
| Full suite command | `cd backend && python -m pytest tests -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Derived fields computed correctly in ETL | unit | `python -m pytest tests/test_derivations.py -x` | ❌ Wave 0 |
| DATA-02 | AHA + hypotension + pulse boundaries | unit | `python -m pytest tests/test_categories.py -x` | ❌ Wave 0 |
| DATA-03 | Double-ingest adds zero rows; overlap upserts | integration (SQLite) | `python -m pytest tests/test_idempotency.py -x` | ❌ Wave 0 |
| DATA-04 | 132 readings seeded, golden-master diff clean | integration (local-only, skipif) | `python -m pytest tests/test_golden_master.py -x` | ❌ Wave 0 |
| DATA-05 | Timestamps naive local end-to-end | unit assertion inside ETL/idempotency tests (no tzinfo anywhere) | covered by above | ❌ Wave 0 |
| DATA-06 | Migrations create 4 tables | smoke | `alembic upgrade head` on temp DB + table-name assert | ❌ Wave 0 |
| DATA-07 | The suite itself | — | full suite command | ❌ Wave 0 |
| DATA-08 | data/ ignored; sample committed | smoke | `git check-ignore data/ && test -f backend/sample_data/omron_sample.xlsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests -q` + `git check-ignore data/`
- **Phase gate:** full suite green (golden-master included on the dev machine) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/pyproject.toml` — deps + pytest + ruff config
- [ ] `backend/tests/conftest.py` — tmp SQLite engine/session fixture, sample-xlsx path fixture
- [ ] `backend/tests/test_categories.py`, `test_derivations.py`, `test_etl.py`, `test_idempotency.py`, `test_golden_master.py`
- [ ] Framework install: `pip install pytest==9.*` (with the rest of the stack)

## Security Domain

### Applicable ASVS Categories (Level 1; phase has no auth/API surface)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (Phase 5) | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | pandas/pydantic row validation; D-08 per-row rejection; never eval/exec anything from the file |
| V6 Cryptography | no | — |
| V8/V12 Data Protection & Files | yes | gitignored `data/`; no PHI in logs/test output (print counts + reasons, not full reading values, in rejected-row reports where feasible); `DATABASE_URL` via env only |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Real health data committed to public repo | Information Disclosure | `.gitignore` in first commit; `git check-ignore` verification; never `git add -f` under data/ |
| Malformed/hostile xlsx breaks or corrupts ingest | Tampering / DoS | Row-level try/reject (D-08); openpyxl read-only usage; file size/row-count sanity cap becomes load-bearing in Phase 5 upload — design `parse_omron` to accept a max-rows guard now |
| SQL injection | Tampering | ORM-only access (no raw SQL) — locked by CLAUDE.md |
| Secrets in code | Information Disclosure | pydantic-settings + env vars; no secrets exist in Phase 1 beyond DATABASE_URL |

## Project Constraints (from CLAUDE.md)

Directives binding on this phase:
- **Fixed stack, do not substitute:** PostgreSQL (SQLite ok for dev), Python + pandas ETL, SQLAlchemy 2.0 **sync** typed declarative (`Mapped[]`/`mapped_column`), Alembic, no raw SQL, portable column types (`Numeric`, `DateTime`, `Text`)
- **pandas 3.0 idioms:** no chained assignment, no `inplace` reliance; `df.loc[mask, col] = ...`
- **ETL pattern:** pure function `raw_df -> clean_df` imported by both the CLI seeder and the (future) FastAPI upload route; pytest covers both consumers
- **Privacy:** no real health data in repo; DB not exposed; no trackers
- **Quality:** tests required for BP category boundaries, MAP, AM/PM logic
- **Config:** pydantic-settings reading env vars (`DATABASE_URL`, later `ANTHROPIC_API_KEY` etc.); SQLite locally via `DATABASE_URL=sqlite:///./dev.db`
- **Do not use:** psycopg2, pandas 2.x idioms, Create React App (n/a), calling Anthropic from frontend (n/a this phase)
- **GSD workflow enforcement:** file changes go through GSD commands

## Sources

### Primary (HIGH confidence)
- https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings — exact AHA category table incl. "higher than 180 and/or higher than 120" Crisis wording (fetched 2026-07-07)
- https://www.ahajournals.org/doi/10.1161/HYP.0000000000000249 + https://www.jacc.org/doi/10.1016/j.jacc.2025.07.010 — 2025 AHA/ACC guideline retained 2017 categories and ≥130/80 threshold
- https://alembic.sqlalchemy.org/en/latest/batch.html — `render_as_batch=True`, "safe in all cases", naming-convention interaction (fetched 2026-07-07)
- https://docs.sqlalchemy.org/en/20/core/constraints.html — standard naming_convention dict, why it matters for Alembic/SQLite (fetched 2026-07-07)
- PyPI JSON API (2026-07-07) — all Phase 1 package versions confirmed current
- slopcheck run (2026-07-07) — 11/11 packages [OK]
- Local environment probes — Python 3.12/3.13, SQLite 3.51, no psql, `data/` absent

### Secondary (MEDIUM confidence)
- CLAUDE.md stack research (same-day, cites PyPI/npm/official docs) — pandas 3.0 CoW/str-dtype behavior, SQLAlchemy/psycopg guidance
- https://learn.microsoft.com/en-us/answers/questions/4952827/omron-data-excel + OMRON helpdesk pages (via search) — newer OMRON export separates Date and Time into two columns

### Tertiary (LOW confidence)
- OMRON export cell types (datetime cells vs text vs serials) — unverifiable until the real file lands; defensive parsing recommended

## Metadata

**Confidence breakdown:**
- Medical spec (AHA/pulse/MAP): HIGH — verified against heart.org + 2025 guideline; edge semantics quoted exactly
- Standard stack: HIGH — locked in CLAUDE.md, re-verified on PyPI today, slopcheck clean
- Architecture (ETL/merge/Alembic): HIGH — patterns verified against official Alembic/SQLAlchemy docs; merge design follows directly from locked D-05/D-06
- OMRON file format: MEDIUM-LOW — corroborated shape, but real file absent; execution-time verification is mandatory
- Pitfalls: HIGH — grounded in verified doc behavior (batch mode, Numeric-on-SQLite, pandas 3.0 changes)

**Research date:** 2026-07-07
**Valid until:** ~2026-08-07 (stable domain; medical spec stable; re-check package versions at install time)
