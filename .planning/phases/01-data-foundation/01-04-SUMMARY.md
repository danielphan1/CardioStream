---
phase: 01-data-foundation
plan: 04
subsystem: etl
tags: [python, pandas, etl, openpyxl, tdd]

# Dependency graph
requires:
  - phase: 01-data-foundation
    plan: 01
    provides: "backend/ scaffold, pinned pandas 3/openpyxl deps, gitignored data/"
  - phase: 01-data-foundation
    plan: 03
    provides: "app/derivations.py — the ONLY source of category/MAP/AM-PM logic (DATA-01)"
provides:
  - "backend/app/etl.py — parse_omron(path_or_buffer, max_rows=10000) -> raw_df and transform(raw_df) -> (clean_df, list[RejectedRow]) — the pure ETL shared by the seeder (01-07) and the Phase 5 upload route"
  - "RejectedRow(row_index, reason) frozen dataclass with hygiene-safe reasons (never echoes other health values)"
  - "D-07 pinned by tests: intra-file duplicate datetimes (minute granularity) resolve last-in-file-order wins; displaced rows surfaced in rejected"
  - "D-08 pinned by tests: NaT datetime / missing / non-numeric / non-positive vitals rejected per-row with field-naming reasons; one bad row never aborts the file"
  - "backend/tests/conftest.py — omron_df and omron_xlsx fixtures (8-column assumed OMRON shape) reusable by 01-06/01-07"
affects: [01-05, 01-06, 01-07, phase-5-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure ETL pipeline: file -> parse_omron -> transform -> clean_df; no DB, no side effects — importable by CLI seeder and FastAPI upload route alike"
    - "Dual parse branch: native date/time cells AND text via pd.to_datetime(errors='coerce') — A2 unverified, both defended"
    - "pandas 3.0 idioms: no chained assignment, no inplace; notes as str dtype in raw frame, object-dtype None in clean frame (DB-ready)"

key-files:
  created:
    - backend/tests/conftest.py
    - backend/app/etl.py
    - backend/tests/test_etl.py
  modified: []

key-decisions:
  - "data/ still empty (01-01 'skip') — parser pinned to the ASSUMED A1 format: header row 0, columns Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes; documented in etl.py module docstring; A1/A2 blocker remains OPEN"
  - "Plan spot-check literal corrected: 120/80 -> 'Stage 1', not 'Elevated' — diastolic 80 >= 80 is Stage 1 per the 01-03 pinned AHA ladder (D-03 severity-max); derivations.py is the single source of truth (DATA-01), tests fixed, module untouched"
  - "max_rows DoS guard counts data rows AFTER blank-row drop and raises ValueError naming the limit (T-1-06)"
  - "Dedupe granularity: datetime floored to minute for D-07 duplicate detection (OMRON records at minute precision)"

patterns-established:
  - "transform imports classify_bp/classify_pulse/compute_map/compute_pulse_pressure/derive_am_pm — never re-implements thresholds (verified: grep for def classify_* in etl.py = 0)"
  - "Rejection reasons follow 'field: problem' shape and never include other readings from the row (asserted by test)"

requirements-completed: [DATA-01 (etl path), DATA-05, DATA-07 (partial: D-07/D-08 pinned)]

# Metrics
duration: 9min
completed: 2026-07-09
---

# Phase 01 Plan 04: File-Facing ETL (parse_omron + transform) Summary

**Pure ETL built TDD: parse_omron reads (assumed-format) OMRON xlsx from path or buffer into a naive-datetime raw frame with a 10k-row DoS guard; transform derives all five columns exclusively via app.derivations with D-07 last-wins dedupe and D-08 per-row hygiene-safe rejection — 52 tests green**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-09T03:26:25Z
- **Completed:** 2026-07-09T03:35:00Z
- **Tasks:** 3/3
- **Files modified:** 3

## OMRON Format Status (Task 1 — blocker A1/A2 REMAINS OPEN)

`data/` is empty — the user chose "skip" at the 01-01 checkpoint, so no real
OMRON export or `bp_data_cleaned.csv` was available to inspect. Consequences,
per the plan's explicit fallback branch:

- **parse_omron targets the ASSUMED A1 format**: header row 0, columns
  `Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes`
- **Both A2 cell-type branches are implemented and tested**: native
  date/datetime/time cells AND text values (e.g. `"2025-03-01"`, `"8:05 AM"`)
  via `pd.to_datetime(..., errors="coerce")`; garbage coerces to NaT and
  routes to D-08 rejection in transform
- **CSV label spellings and MAP decimals (A3, feeds 01-07's golden master)
  could NOT be recorded** — inspection must happen when the files land
- The assumed-format facts are recorded in the `etl.py` module docstring
  ("FORMAT NOTE — ASSUMED, NOT INSPECTED") with an instruction to re-verify
  against the real file

## Accomplishments

- `backend/tests/conftest.py`: `omron_df` (8-column OMRON-shaped frame from
  row dicts) and `omron_xlsx` (tmp .xlsx writer) fixtures, reusable by 01-06/01-07
- `parse_omron(path_or_buffer, max_rows=10_000)`: header normalization to
  snake_case, Date+Time combined into one naive `datetime64[ns]` column
  (DATA-05, asserted `dt.tz is None`), blank rows dropped, buffer input
  accepted (Phase 5 `UploadFile.file`), ValueError DoS guard (T-1-06)
- `transform(raw_df) -> (clean_df, list[RejectedRow])`: 10-column DB-ready
  clean frame; all five derived columns computed by calling `app.derivations`
  functions (DATA-01 — zero threshold re-implementation, grep-verified);
  D-07 last-wins minute-granularity dedupe with displaced rows surfaced;
  D-08 per-row rejection with `"field: problem"` reasons that never echo
  other health values (T-1-04, asserted by test)
- Full backend suite green: 52 passed (23 new ETL tests + 29 prior derivation tests)
- Verification greps clean: no `tz_localize`/`tz_convert`/`timezone.utc`
  under `backend/app/`; no `def classify_*` in etl.py

## Task Commits

1. **Task 1: Fixtures + parser contract (assumed format)** - `0aff483` (test)
2. **Task 2: parse_omron** - `a4e7870` (test, RED), `3bd1cf8` (feat, GREEN)
3. **Task 3: transform** - `60c1b5d` (test, RED), `e0b8c25` (feat, GREEN), `abc5872` (fix, plan-literal correction)

## Files Created/Modified

- `backend/tests/conftest.py` - omron_df / omron_xlsx fixtures; assumed-format docstring (59 lines)
- `backend/app/etl.py` - parse_omron + transform + RejectedRow; format note; DATA-01/D-07/D-08 docs (258 lines)
- `backend/tests/test_etl.py` - 8 parse tests + 12 transform tests + e2e pipeline test (445 lines)

## Decisions Made

- Assumed-format branch taken (data/ empty); defensive text-parse branch is
  mandatory and tested, per plan fallback
- Dedupe compares datetimes floored to the minute (`dt.floor("min")`) —
  matches "minute-granularity datetime" in D-07
- `notes` is pandas 3.0 `str` dtype in the raw frame, object-dtype with
  `None` (not NaN) in the clean frame so the DB layer receives NULLs directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan spot-check literal wrong: 120/80 is "Stage 1", not "Elevated"**
- **Found during:** Task 3 (GREEN run failed on the plan's known-value check)
- **Issue:** Plan behavior spec said row (120, 80, 55) yields bp_category
  "Elevated", but the 01-03 pinned AHA ladder (D-03 severity-max) classifies
  diastolic 80 as Stage 1; "Elevated" requires diastolic <80 — the 01-03
  committed matrix pins `(120, 70) -> "Elevated"` and diastolic 80 -> Stage 1
- **Fix:** Corrected the TEST expectations (spot check + e2e) to "Stage 1";
  `derivations.py` untouched — it is the single source of truth (DATA-01).
  All other plan spot-check values (AM, Bradycardia, MAP 93.3, PP 40) were
  correct and unchanged
- **Files modified:** backend/tests/test_etl.py
- **Commit:** abc5872

---

**Total deviations:** 1 auto-fixed (plan literal contradicted the pinned derivation contract)
**Impact on plan:** None on scope; flags that the plan's example row is not an "Elevated" exemplar.

## TDD Gate Compliance

- Task 2 RED: `test(01-04)` a4e7870 — suite failed (ModuleNotFoundError: app.etl)
- Task 2 GREEN: `feat(01-04)` 3bd1cf8 — 8/8 parse tests pass, no test edits
- Task 3 RED: `test(01-04)` 60c1b5d — collection failed (RejectedRow/transform absent)
- Task 3 GREEN: `feat(01-04)` e0b8c25 — implementation only; the separate
  `fix` commit abc5872 corrected the plan's wrong expected literal (documented deviation)
- REFACTOR: not needed

## Issues Encountered

None beyond the documented deviation. Fresh worktree required creating
`backend/.venv` (Python 3.12) — environment setup, not a deviation.

## Known Stubs

None — both functions are complete for their purpose. No placeholder values,
no hardcoded empties.

## Threat Flags

None new — the plan's threat register is fully mitigated:
- T-1-06: max_rows ValueError guard; pandas/openpyxl parsing only, no eval of cell content; garbage coerces to NaT/NaN -> D-08
- T-1-07: per-row validation with explicit reasons; dedupe surfaced, never silent; categories imported from derivations only
- T-1-04: RejectedRow.reason names field + problem only — asserted by a dedicated test; all test data synthetic

## Next Phase Readiness

- 01-07 (seeder + golden master) can import `parse_omron`/`transform` directly;
  fixtures in conftest.py are shared
- **Open blocker (carried, unchanged):** real OMRON export + bp_data_cleaned.csv
  still absent — the A1 format assumption and the A3 CSV label/MAP-decimals
  inspection remain outstanding; re-verify `parse_omron` and encode the 01-07
  label map when files land in `data/`
- Phase 5 upload route can pass `UploadFile.file` to parse_omron unchanged
  (buffer input tested)

## Self-Check: PASSED

All 3 created files exist on disk; all 6 task commits (0aff483, a4e7870,
3bd1cf8, 60c1b5d, e0b8c25, abc5872) present in git history; full suite
`pytest tests -q` green (52 passed).

---
*Phase: 01-data-foundation*
*Completed: 2026-07-09*
