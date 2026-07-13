---
phase: 01-data-foundation
plan: 06
subsystem: etl
tags: [python, sqlalchemy, idempotency, etl, pydantic, tdd]

# Dependency graph
requires:
  - phase: 01-data-foundation
    plan: 02
    provides: "Reading model (datetime_ -> column 'datetime', map_value -> column 'map'), uq_readings_datetime constraint, Base"
  - phase: 01-data-foundation
    plan: 04
    provides: "parse_omron + transform + RejectedRow(row_index, reason); omron_df/omron_xlsx fixtures"
provides:
  - "backend/app/etl.py: merge_readings(session, clean_df, rejected) -> IngestSummary — Python-level idempotent merge keyed on the datetime natural key (RESEARCH Pattern 2), D-05 upsert, one transaction"
  - "IngestSummary (Pydantic): added, updated, unchanged, rejected, total, latest — the frozen D-06 shape reused verbatim by Phase 5 API-03 POST /upload"
  - "backend/tests/conftest.py: function-scoped in-memory SQLite engine + session fixtures (create_all; migrations stay exclusive to test_migrations.py)"
  - "backend/tests/test_idempotency.py: DATA-03/DATA-05/DATA-07 phase-gate evidence (9 tests)"
affects: [01-07, phase-2-api, phase-5-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent merge: dict-load existing rows keyed by Reading.datetime_, iterate clean_df.itertuples, branch add/update/unchanged on inputs (systolic/diastolic/pulse/notes) — derived columns follow inputs deterministically"
    - "session.merge() forbidden (keys on id PK, not the datetime natural key); grep-verified absent"
    - "Single session.commit() per merge; total/latest queried post-commit (func.max inherits DateTime type -> naive datetime back)"

key-files:
  created:
    - backend/tests/test_idempotency.py
  modified:
    - backend/app/etl.py
    - backend/tests/conftest.py

key-decisions:
  - "Unchanged-detection compares only the four input fields (systolic/diastolic/pulse/notes) — derived columns are deterministic functions of inputs per DATA-01, so comparing them would be redundant"
  - "latest computed via select(func.max(Reading.datetime_)) after commit — inherits the DateTime column type so SQLite returns a naive datetime, not a string"

patterns-established:
  - "IngestSummary field names frozen for Phase 5: added, updated, unchanged, rejected, total, latest"

requirements-completed: [DATA-03, DATA-05, DATA-07]

# Metrics
duration: 9min
completed: 2026-07-09
---

# Phase 01 Plan 06: Idempotent Merge Summary

**merge_readings built TDD: Python-level idempotent merge keyed on the reading datetime (never session.merge, never ON CONFLICT), D-05 file-is-truth upsert with recomputed derived columns, single-transaction commit, returning the frozen D-06 IngestSummary — double-ingest/overlap/constraint/naive-round-trip all proven, 68 tests green**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-09T04:11:30Z
- **Completed:** 2026-07-09T04:20:58Z
- **Tasks:** 2/2 auto (both TDD)
- **Files modified:** 3

## IngestSummary Contract (frozen for Phase 5 API-03)

Field names verbatim — the `POST /upload` response must reuse them exactly:

| Field | Type | Meaning |
|-------|------|---------|
| `added` | `int` | rows inserted (new datetime) |
| `updated` | `int` | rows updated in place (existing datetime, any of systolic/diastolic/pulse/notes differed — D-05) |
| `unchanged` | `int` | rows untouched (existing datetime, all inputs identical) |
| `rejected` | `list[RejectedRow]` | transform's D-08 rejections passed through (`row_index`, `reason`) |
| `total` | `int` | readings in the DB after the merge |
| `latest` | `datetime \| None` | max reading datetime in the DB after commit, naive (DATA-05) |

Call shape: `merge_readings(session, clean_df, rejected) -> IngestSummary`, exported from `app.etl` alongside `parse_omron`/`transform`/`RejectedRow`.

## Accomplishments

- `merge_readings` implements RESEARCH Pattern 2: existing rows dict-loaded once keyed by `Reading.datetime_`, `clean_df.itertuples(index=False)` iteration, add/update/unchanged branching; `session.merge()` explicitly absent (grep-verified) — it keys on the `id` PK, not the datetime natural key
- All writes in ONE transaction (single `session.commit()`); `total`/`latest` queried after commit; `latest` round-trips as a naive datetime (`tzinfo is None`)
- DB fixtures in conftest: function-scoped `create_engine("sqlite://")` + `Base.metadata.create_all` `engine`, `session` bound to it — unit tests stay on create_all, migrations remain exclusive to test_migrations.py (drift guard)
- ROADMAP success criterion 2 proven: `test_double_ingest_adds_zero_rows` asserts second-ingest summary counts (0/0/N) AND direct `SELECT count(*)` equality; `test_overlapping_export_upserts` proves cumulative-export semantics (added=3, updated=1, unchanged=rest, total=union)
- DATA-03 backstop pinned: `test_unique_constraint_safety_net` bypasses the merge and proves `IntegrityError` on duplicate `datetime_` inserts
- DATA-05 pinned end-to-end: `test_datetimes_naive_roundtrip` — stored datetimes naive and exactly equal to clean_df across the 11:59 AM / 12:00 PM boundary
- Full suite green: 68 passed (59 prior + 9 new), zero regressions

## Task Commits

1. **Task 1: IngestSummary + merge_readings (D-05/D-06)** — `77a3f51` (test, RED), `7be3dc9` (feat, GREEN)
2. **Task 2: Idempotency proof tests** — `b82de98` (test)

## Files Created/Modified

- `backend/app/etl.py` — added `IngestSummary` model + `merge_readings`; module docstring updated (pure functions + DB half)
- `backend/tests/conftest.py` — `engine`/`session` in-memory SQLite fixtures
- `backend/tests/test_idempotency.py` — 9 tests: 5 branch-count/shape (Task 1) + 4 named proof tests (Task 2)

## Decisions Made

- Unchanged-detection compares the four input fields only; derived columns are deterministic per DATA-01 so re-comparing them adds nothing
- `latest` uses `func.max(Reading.datetime_)` (inherits the DateTime column type — SQLite returns a datetime, not a string) rather than ordering rows in Python

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1 RED: `test(01-06)` 77a3f51 — collection failed (ImportError: `IngestSummary` absent from `app.etl`)
- Task 1 GREEN: `feat(01-06)` 7be3dc9 — 5/5 tests pass, no test edits; full suite 64 green
- Task 1 REFACTOR: not needed
- Task 2: `test(01-06)` b82de98 — proof/pinning tests only; they exercise behavior implemented under Task 1's RED/GREEN cycle, so they passed on first run by design (the tests themselves are the deliverable — DATA-03/DATA-07 phase-gate evidence)

## Issues Encountered

None.

## Known Stubs

None — merge is complete for its purpose; no placeholders, no hardcoded empties.

## Threat Flags

None new — plan threat register fully addressed:

- **T-1-09 (Tampering, merge_readings) — mitigated:** deterministic branching in one transaction; `uq_readings_datetime` backstop proven by `test_unique_constraint_safety_net`; ORM-only writes (no raw SQL)
- **T-1-04 (Info disclosure, IngestSummary) — mitigated:** summary carries counts, rejection reasons, and dates only — never blood-pressure values (documented in the model docstring; RejectedRow hygiene already asserted in 01-04)
- **T-1-06 (DoS, merge loop) — accepted per plan:** O(n) dict-load on a ~132-row single-user dataset; parse_omron's max_rows caps input

## Next Phase Readiness

- Plan 01-07's seeder is a thin wrapper: `parse_omron` → `transform` → `merge_readings` on a real Session; all fixtures shared via conftest
- Phase 5 upload route returns `IngestSummary` directly as the API-03 response — field names frozen above
- **Open blocker (carried, unchanged):** real OMRON export + bp_data_cleaned.csv still absent from data/ — A1 format assumption stands; this plan needed only synthetic frames

## Self-Check: PASSED

All 3 files exist on disk; all 3 task commits (77a3f51, 7be3dc9, b82de98) present in git history; `pytest tests -q` green (68 passed); `grep "session.merge(" backend/app/etl.py` empty.

---
*Phase: 01-data-foundation*
*Completed: 2026-07-09*
