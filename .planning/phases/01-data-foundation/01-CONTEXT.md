# Phase 1: Data Foundation - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Chris's real data lives in a correctly-derived, duplicate-proof database — and never in the public repo. This phase delivers: repo + privacy setup (gitignored `data/` dir, committed synthetic sample), SQLAlchemy schema + Alembic migrations (readings table plus empty lab_results/incidents/procedures), an idempotent OMRON ETL with tested derivations (AM/PM, BP category, pulse category, MAP, pulse pressure), and the 132 real readings seeded. Requirements: DATA-01 through DATA-08. No API endpoints, no frontend — those are Phases 2+.

</domain>

<decisions>
## Implementation Decisions

### Category edge rules
- **D-01:** Textbook AHA classification is the spec; `bp_data_cleaned.csv` is a regression check, not the source of truth. Implement published AHA rules + the documented Hypotension rule from scratch, then diff against the CSV. If rows disagree, investigate — the CSV could have bugs; resolve mismatches deliberately and document them.
- **D-02:** Hypotension = systolic <90 **OR** diastolic <60, checked **before** the AHA ladder.
- **D-03:** When systolic and diastolic fall in different AHA categories, the **higher (more severe) category wins** (standard AHA guidance).
- **D-04:** Pulse categories: Bradycardia <60 bpm (60 exactly = Normal, locked in REQUIREMENTS.md); Tachycardia **>100 bpm** — Normal is 60–100 inclusive.

### Re-ingest conflict policy
- **D-05:** Same datetime re-appears with different values → **upsert (update in place)**. The incoming file is truth; edits in the OMRON app are deliberate corrections. Counted as "updated" in the result summary.
- **D-06:** ETL result summary shape: **added / updated / unchanged** counts + total reading count + latest reading date. This shape carries forward to the Phase 5 upload page (API-03).
- **D-07:** Intra-file duplicate datetimes (minute-granularity collisions): **last row in file order wins**, surfaced in the result summary — never silent.
- **D-08:** Rows with missing/unparseable values: **skip the row and report it** in a rejected list with a per-row reason. One bad cell never blocks the rest of the file.

### Synthetic sample design
- **D-09:** Sample produced by a **seeded-random Python generator script; both the script and its output file are committed**. Regenerable if schema evolves; doubles as portfolio evidence.
- **D-10:** Sample matches the real data's character: ~130 rows over the same Feb–Jun span, ~88% bradycardic pulse, systolic spanning ~60–211, every BP category represented (including Crisis and Hypotension), mixed AM/PM.
- **D-11:** Sample format is an **OMRON-format .xlsx** (Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes columns) so it exercises the real openpyxl ingest path end-to-end and works as a Phase 5 upload demo file.
- **D-12:** Seeder data selection: **real export if present locally, else synthetic sample** — one zero-config seed command that works on the dev machine, fresh clones, and CI.

### Data files & seeding flow
- **D-13:** Real data files live in a top-level **gitignored `data/` directory** (raw OMRON export .xlsx + `bp_data_cleaned.csv`). User adds them **before Phase 1 execution starts**, so the ETL is built against the real format from day one.
- **D-14:** Seeding ingests the **raw OMRON xlsx through the full ETL pipeline** (same code path future uploads will use). `bp_data_cleaned.csv` is used **only as the golden-master fixture in the test suite** — it is never loaded into the DB.
- **D-15:** Monorepo layout from day one: top-level `backend/` (FastAPI app, ETL, tests, alembic) and `frontend/` (reserved, created in Phase 2), with `data/` gitignored at root. Matches the Vercel/Railway deploy split.
- **D-16:** Seeder invoked as **`python -m app.seed`** — a module entry point inside the app package sharing the ETL function, SQLAlchemy models, and settings with the API. Documented in the README.

### Claude's Discretion
- MAP formula precision/rounding, exact Numeric column precision, Alembic migration granularity (one vs. two migrations), test fixture organization, generator script internals — planner/executor decide within the locked stack (Python 3.12, pandas 3.x, SQLAlchemy 2.0 sync ORM, Alembic, SQLite dev / Postgres prod).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project stack & patterns
- `CLAUDE.md` — Locked tech stack with versions (pandas 3.x idioms, SQLAlchemy 2.0 typed declarative, psycopg3, naive-datetime portability notes) and the "ETL as pure function `raw_df -> clean_df` shared by CLI seeder and upload route" pattern.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — DATA-01..DATA-08 definitions (this phase's scope).
- `.planning/ROADMAP.md` — Phase 1 goal and five success criteria (golden-master diff, idempotency, test suite, privacy, migrations).
- `.planning/PROJECT.md` — Database schema sketch, data characteristics (132 readings, 88% bradycardia, systolic 60–211), naive-local-time constraint.

### Data files (added by user before execution)
- `data/` (gitignored) — raw OMRON export .xlsx (columns: Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes) and `bp_data_cleaned.csv` (golden-master fixture with derived fields: DateTime, AM_PM, DayOfWeek, WeekNumber, Month, BP_Category, Pulse_Category, MAP, Pulse_Pressure). **Verify actual file format against these assumptions first — flagged blocker in STATE.md.**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo (only CLAUDE.md and .planning/ exist). Phase 1 creates the first code.

### Established Patterns
- CLAUDE.md locks the stack and idioms: SQLAlchemy 2.0 `Mapped[]`/`mapped_column` typed declarative (no raw SQL — one codebase on SQLite dev + Postgres prod), pandas 3.0 Copy-on-Write idioms (`df.loc[...] = ...`, no chained assignment), portable column types (`Numeric`, `DateTime`, `Text`), config via pydantic-settings reading `DATABASE_URL`.

### Integration Points
- The ETL pure function `raw_df -> clean_df` is imported by both `python -m app.seed` (this phase) and the FastAPI `POST /upload` route (Phase 5) — structure it so the pytest suite covers both consumers.
- The result-summary shape (added/updated/unchanged/rejected + total + latest date) becomes the API-03 upload response in Phase 5.

</code_context>

<specifics>
## Specific Ideas

- Golden-master test: run the real raw export through the ETL and diff every derived column against `bp_data_cleaned.csv`; mismatches are investigated (CSV may be wrong), not blindly matched.
- Naive local time end-to-end (DATA-05) — no UTC conversion anywhere; protects AM/PM analysis.
- Idempotency enforced by a DB unique constraint on reading datetime (DATA-03), with upsert semantics layered on top per D-05.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Data Foundation*
*Context gathered: 2026-07-07*
