---
phase: 01-data-foundation
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/alembic.ini
  - backend/alembic/env.py
  - backend/alembic/script.py.mako
  - backend/alembic/versions/0e2b4637ae04_create_future_tables_lab_results_.py
  - backend/alembic/versions/bb7feabf6399_create_readings_table.py
  - backend/app/__init__.py
  - backend/app/config.py
  - backend/app/db.py
  - backend/app/derivations.py
  - backend/app/etl.py
  - backend/app/models.py
  - backend/app/seed.py
  - backend/pyproject.toml
  - backend/scripts/generate_sample.py
  - backend/tests/__init__.py
  - backend/tests/conftest.py
  - backend/tests/test_categories.py
  - backend/tests/test_derivations.py
  - backend/tests/test_etl.py
  - backend/tests/test_golden_master.py
  - backend/tests/test_idempotency.py
  - backend/tests/test_migrations.py
  - backend/tests/test_sample.py
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the Phase 01 data foundation: derivations (BP/pulse categories, MAP, AM/PM), the OMRON ETL pipeline (`parse_omron` → `transform` → `merge_readings`), SQLAlchemy models, Alembic migrations, the CLI seeder, the deterministic synthetic-sample generator, and the full test suite. The suite passes (68 passed, 7 skipped — golden-master skips cleanly with real data absent).

**What is solid:** The medical derivation logic in `app/derivations.py` is correct against the pinned AHA thresholds and locked decisions D-02/D-03/D-04 — I traced every boundary (Crisis strictly >180/>120, Stage 2 ≥140/≥90, Stage 1 ≥130/≥80, Elevated systolic-only 120–129, hypotension gate first, severity-max via `_SEVERITY.index` which is unreachable for "Hypotension" because the gate short-circuits). Migrations match the models exactly (columns, `Numeric(5,1, asdecimal=False)`, `uq_readings_datetime`). Privacy constraints hold: `data/` and `*.db` are gitignored, the committed sample is synthetic and derives categories only via `app.derivations`, and rejection reasons never echo health values.

**Key concerns:** One Critical — `transform` crashes the entire file on inputs that pass its own validation gate, violating the locked D-08 invariant "one bad row never aborts the file" (empirically reproduced). Four Warnings around silent vital truncation, NaN-notes idempotency, dedupe-granularity mismatch, and ambiguous text-date parsing.

## Critical Issues

### CR-01: `transform` aborts the entire file on text-numeric vitals that pass validation (violates locked D-08)

**File:** `backend/app/etl.py:186-191` (validation) vs `backend/app/etl.py:237-239` (coercion)
**Issue:** `_validate_row` validates vitals with `float(val)`, but the derive loop coerces with `int(row["systolic"])` on the *raw* value. Any text cell whose value parses as a float but not as an int — e.g. `"118.5"` (an Excel text-formatted decimal, entirely plausible in a device export whose cell types are explicitly unverified per the module's own A2 note) or `"inf"` — passes validation, then raises an unhandled `ValueError` in the loop, aborting the whole transform. Empirically reproduced:

```
transform(df with systolic="118.5") -> ValueError: invalid literal for int() with base 10: '118.5'
```

This directly violates the locked D-08 decision quoted in the docstring: "one bad row never aborts the file." In Phase 5 this becomes an unhandled 500 on upload; in the seeder it kills the entire seed run. (`"inf"`/`"nan"` strings are a second path through the same gap: `float("inf") > 0` passes, `int()` raises.)
**Fix:** Make the validation gate and the coercion agree. Either coerce through the validated float:

```python
sbp = int(float(row["systolic"]))
dbp = int(float(row["diastolic"]))
pulse = int(float(row["pulse"]))
```

or (better, see WR-02) reject non-integer vitals in `_validate_row`:

```python
num = float(val)
if not num > 0 or not float(num).is_integer():
    return f"{field}: not a positive integer"
```

Also add `math.isfinite(num)` to the check so `inf` is rejected rather than accepted. Add a regression test: a row with systolic `"118.5"` must be rejected while the other rows survive.

## Warnings

### WR-01: NaN notes silently break merge idempotency — the `None` guard in `merge_readings` is a no-op

**File:** `backend/app/etl.py:319`
**Issue:** `incoming_notes = row.notes if row.notes is not None else None` is a tautology — it returns `row.notes` in every case and normalizes nothing. If a clean frame ever carries `NaN` notes (anything that bypasses `transform`'s object-dtype normalization, or a future refactor of the notes handling), the merge never converges: SQLite stores the `NaN` as `NULL`, and on re-ingest `current.notes (None) == incoming_notes (nan)` is `False`, so every identical re-ingest counts `updated` forever. Empirically reproduced: first ingest `added=1`, identical second ingest `updated=1, unchanged=0`. This silently defeats the DATA-03 idempotency guarantee for the exact field least covered by tests, and the dead-code guard suggests normalization was *intended* here.
**Fix:**

```python
incoming_notes = None if row.notes is None or (isinstance(row.notes, float) and pd.isna(row.notes)) else str(row.notes)
```

or simply `incoming_notes = None if pd.isna(row.notes) else str(row.notes)`. Add an idempotency test whose clean frame carries a NaN note.

### WR-02: Non-integer vitals are silently floor-truncated, which can change the medical category

**File:** `backend/app/etl.py:237-239` with gate at `backend/app/etl.py:186-191`
**Issue:** `_validate_row` accepts any positive float, and the derive loop truncates via `int()`. A native float cell of `129.9` is stored as systolic `129` and classified **"Elevated"**, when rounding would give `130` → **"Stage 1"** (empirically confirmed). The project constraint is explicit that derived medical categorizations must be correct; silent truncation at a category boundary is a correctness defect for a medical categorization, not a style issue. OMRON devices emit integers, so any non-integer is either a re-typed cell or format drift — both worth surfacing, not silently flooring.
**Fix:** Reject non-integer vitals in `_validate_row` (preferred — pairs with the CR-01 fix): `if not float(num).is_integer(): return f"{field}: not a whole number"`. If fractional vitals must be tolerated, use `round()` and document it, never `int()` truncation. Add boundary tests (129.9, 89.5).

### WR-03: Duplicate-detection granularity mismatch — intra-file dedupe is minute-level, cross-file merge key is second-level

**File:** `backend/app/etl.py:227` (dedupe: `dt.floor("min")`) vs `backend/app/etl.py:312-321` (merge keyed on exact datetime) and `backend/app/models.py:55` (unique constraint on exact datetime)
**Issue:** D-07 defines "duplicate" as same minute: within one file, `08:05:10` and `08:05:40` are duplicates and last-wins. But `merge_readings` keys on the exact datetime including seconds, and `uq_readings_datetime` constrains exact values only. So if the DB holds a reading at `08:05:10` and a later cumulative export carries the same logical reading stamped `08:05:40`, the merge **adds** a second row — the database now contains two readings that the pipeline's own D-07 definition calls duplicates, and the DATA-03 "duplicates structurally impossible" claim holds only at second granularity while duplicates are defined at minute granularity. The surviving row of an intra-file dedupe also keeps its original seconds (line 231 keeps the row, not the floored value), so the stored key is whatever seconds the last row happened to carry.
**Fix:** Normalize `clean_df["datetime"]` to minute precision in `transform` after the dedupe (`valid["datetime"] = valid["datetime"].dt.floor("min")` via `.loc`), making the stored natural key match the D-07 duplicate definition. If second precision is deliberately preserved, document why the duplicate definitions intentionally differ and add a cross-file same-minute test pinning the chosen behavior.

### WR-04: Text-date fallback parses with no `format`/`dayfirst` — ambiguous dates are silently misread

**File:** `backend/app/etl.py:72` (`_coerce_date`), also `backend/app/etl.py:86` (`_coerce_time`)
**Issue:** The A2 fallback branch calls `pd.to_datetime(str(val), errors="coerce")` with pandas' default month-first inference. If the real OMRON export uses text dates in day-first form (e.g. `"03/04/2025"` meaning 3 April), every ambiguous date parses to the wrong day **silently** — no NaT, no rejection, just wrong datetimes flowing into the DB and the AM/PM/date-range features Chris queries by voice. The module honestly flags the format as assumed (A1/A2 open), but "wrong data accepted silently" is a worse failure mode than "unparseable data rejected," and nothing at runtime will surface the misread.
**Fix:** When the real export lands, pin an explicit `format=` string. Until then, defend the ambiguity: try ISO first, and for slash-formats either require an explicit configured format or reject rows where `pd.to_datetime(v)` and `pd.to_datetime(v, dayfirst=True)` disagree (i.e. genuinely ambiguous values become `RejectedRow`s, not guesses).

## Info

### IN-01: `max_rows` DoS guard runs after the full workbook is already loaded

**File:** `backend/app/etl.py:108-119`
**Issue:** `pd.read_excel` materializes the entire file into memory before `len(df) > max_rows` is checked, so the T-1-06 guard bounds downstream row processing but not memory — a pathological multi-gigabyte or zip-bomb xlsx is fully expanded first.
**Fix:** Note for Phase 5: enforce an upload byte-size limit at the FastAPI boundary before `parse_omron` is invoked; the row guard alone is not the DoS defense.

### IN-02: `RejectedRow.row_index` is the post-drop frame index, not the spreadsheet row

**File:** `backend/app/etl.py:114` (blank-row drop + `reset_index`) with `backend/app/etl.py:219`
**Issue:** Indices are reported after blank rows are dropped and the index reset, and are 0-based with the header excluded. "row 0" in the seeder output / future upload response corresponds to spreadsheet row 2 at best, and drifts further if interior blank rows were dropped. A caregiver trying to locate a rejected row in Excel will look at the wrong row.
**Fix:** Track the original Excel row number (e.g. capture the pre-drop index and report `idx + 2`), or document the offset in the reason text.

### IN-03: `seed.resolve_source` glob matches Excel lock files

**File:** `backend/app/seed.py:44`
**Issue:** `sorted(_REAL_DATA_DIR.glob("*.xlsx"))` matches `~$export.xlsx` (Excel's lock/temp file, created whenever the export is open in Excel), and `"~$..."` sorts before most names — the seeder would try to parse a lock file and crash with an opaque openpyxl error.
**Fix:** `[p for p in sorted(_REAL_DATA_DIR.glob("*.xlsx")) if not p.name.startswith("~$")]`.

### IN-04: `app/db.py` binds the engine at import time from cached settings

**File:** `backend/app/db.py:8`
**Issue:** `engine` is created at module import using `get_settings()` (lru_cached). Any process that imports `app.db` (directly or transitively) before `DATABASE_URL` is set is permanently bound to `sqlite:///./dev.db` — env changes and `get_settings.cache_clear()` after import have no effect on the already-created engine. `test_migrations.py` avoids `app.db` today, but this is a latent trap for Phase 5 app startup ordering and future tests.
**Fix:** Consider lazy engine creation (`@lru_cache def get_engine()`) mirroring the settings pattern.

### IN-05: Sample-character guarantees rely on bare `assert`

**File:** `backend/scripts/generate_sample.py:160-184`
**Issue:** `assert_character` enforces the D-10 guarantees with `assert` statements, which vanish under `python -O` — the script would then silently write a sample missing category coverage. Low likelihood (manual script, and `test_sample.py` re-checks the committed file), but the function's whole purpose is to "fail loudly."
**Fix:** Raise `ValueError`/`RuntimeError` explicitly instead of `assert`.

### IN-06: A missing vitals column degrades into per-row rejections instead of a format error

**File:** `backend/app/etl.py:122-124`
**Issue:** `parse_omron` backfills any missing expected column with `pd.NA`, so uploading a wrong-format file (e.g. no `Systolic` header, or a renamed header like `Systolic (mmHg)` which normalizes to `systolic_(mmhg)`) yields N individual "systolic: missing" rejections rather than one clear "unrecognized file format" error. Correct but hostile failure mode for the Phase 5 upload UX.
**Fix:** If any of `date`/`time`/`systolic`/`diastolic`/`pulse` is absent from the parsed headers, raise a single `ValueError("missing expected column(s): ...")` — backfill only the optional columns.

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
