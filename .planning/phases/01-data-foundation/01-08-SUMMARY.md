---
phase: 01-data-foundation
plan: 08
subsystem: etl
tags: [python, pandas, gap-closure, tdd, validation, idempotency]

# Dependency graph
requires:
  - phase: 01-data-foundation
    plan: 04
    provides: "parse_omron + transform pure ETL; _validate_row gate; conftest fixtures"
  - phase: 01-data-foundation
    plan: 06
    provides: "merge_readings idempotent DB merge + D-06 IngestSummary"
provides:
  - "backend/app/etl.py — _validate_row rejects non-finite (math.isfinite) and non-integer (is_integer) vitals; derive loop coerces via int(float(...)) so gate and coercion agree by construction (Gap 1: CR-01 + WR-02)"
  - "backend/app/etl.py — merge_readings normalizes NaN notes via pd.isna so identical re-ingests converge to unchanged (WR-01, DATA-03)"
  - "backend/app/etl.py — transform floors stored datetimes to minute precision, matching the D-07 duplicate definition (WR-03)"
  - "backend/app/etl.py — _coerce_date rejects ambiguous slash-format text dates via ISO-first short-circuit + dual-parse dayfirst guard (WR-04)"
  - "11 regression tests pinning every fixed behavior across test_etl.py and test_idempotency.py"
affects: [phase-2-api, phase-5-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate/coercion agreement by construction: every value _validate_row passes is coercible by int(float(...)) — editing one side cannot desync the other"
    - "Reject-never-round for medical values: fractional vitals are format drift, rejected per D-08; rounding or truncating can silently cross an AHA category boundary"
    - "Ambiguity guard for text dates: ISO8601 short-circuit, then default vs dayfirst dual parse — disagree means reject (NaT), never guess"

key-files:
  created: []
  modified:
    - backend/app/etl.py
    - backend/tests/test_etl.py
    - backend/tests/test_idempotency.py

key-decisions:
  - "Non-integer vitals REJECTED, never rounded/truncated (plan-pinned): OMRON emits integer vitals; 129.9 stored as either 129/'Elevated' or 130/'Stage 1' is a guess — unacceptable for medical data"
  - "ISO 8601 dates bypass the WR-04 dual-parse guard: dateutil's dayfirst=True misreads Y-M-D as Y-D-M, so the plan's assume-ISO-agrees strategy needed a format='ISO8601' short-circuit (deviation, Rule 1)"
  - "isfinite check runs BEFORE the positivity comparison so NaN (which fails all comparisons) cannot slip through"

patterns-established:
  - "Minute-floored stored natural key: DB key granularity now provably matches the pipeline's own D-07 duplicate definition — cross-file re-stamped seconds merge as unchanged, never duplicate"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-07]

# Metrics
duration: 7min
completed: 2026-07-14
---

# Phase 01 Plan 08: Gap Closure — ETL Validation/Coercion Agreement Summary

**Verification Gap 1 (blocker) closed TDD-style: '118.5'/'inf'/129.9 vitals now become hygiene-safe RejectedRows instead of aborting the file or silently truncating across an AHA boundary, NaN notes converge on re-ingest, stored natural keys are minute-floored to match D-07, and ambiguous slash dates are rejected rather than guessed month-first — 79 passed, 7 skipped**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-14T02:57:52Z
- **Completed:** 2026-07-14T03:04:28Z
- **Tasks:** 3/3 (each RED-then-GREEN, 6 commits)
- **Files modified:** 3

## Gap 1 Closure Evidence (CR-01 + WR-02)

The two empirical reproductions from 01-VERIFICATION.md now behave per D-08:

| Input | Before (verified defect) | After |
|-------|--------------------------|-------|
| systolic `"118.5"` text | unhandled `ValueError` aborts the ENTIRE file | RejectedRow `"systolic: not a whole number"`; sibling rows survive |
| systolic `129.9` float | silently floor-truncated to 129 → 'Elevated' | RejectedRow — never stored as 129/'Elevated' or rounded to 130/'Stage 1' |
| `"inf"` / `"nan"` text | `int("inf")` ValueError / NaN slips comparisons | RejectedRow `"...: not a finite number"` (isfinite runs before positivity) |
| `"118"` text / `130.0` float | accepted | still accepted; 130.0 stores 130 → 'Stage 1' (pinned) |

- Rejection reasons stay field-name-plus-problem only — hygiene test asserts `"118.5"`, and sibling vitals never appear in reasons (T-1-04)
- Derive loop coerces `int(float(row[...]))` — structurally unable to raise on any gate-passed value (T-01-08-01 mitigated)

## WR-01 + WR-03 Closure Evidence

- `test_nan_notes_merge_converges`: clean frame with `float("nan")` notes (bypassing transform, the WR-01 reproduction path) — first ingest added=1, second ingest `(0, 0, 1)`, stored notes is `None`. Dead guard `row.notes if row.notes is not None else None` removed (grep = 0 matches)
- `test_transform_floors_datetime_to_minute`: raw 08:05:10 → stored `2025-03-01 08:05:00` (CoW-safe `assign`, no chained assignment per CLAUDE.md)
- `test_cross_file_same_minute_different_seconds_no_duplicate`: 08:05:10 then 08:05:40 re-export → second summary `(0, 0, 1)`, direct DB count stays 1 — the DB can no longer contain two rows the pipeline's own D-07 definition calls duplicates
- `floor("min")` now appears twice in etl.py: D-07 dedupe comparison AND stored-key normalization
- Golden-master note added to the transform docstring: second-precision DateTimes in the real CSV are investigated under the D-01 process (EXCLUDED_ROWS) when data lands

## WR-04 Closure Evidence

- `"03/04/2025"` (March 4 vs 3 April — genuinely ambiguous) → NaT from parse_omron, RejectedRow `"datetime: missing or unparseable"` from transform
- `"13/04/2025"` (no month 13 — unambiguous) → parses to 2025-04-13
- ISO `"2025-03-01"` parses exactly as before (existing `test_parse_text_date_time_fallback` untouched and green)
- FORMAT NOTE updated: pin explicit `format=` and remove the guard when the real OMRON export lands (Gap 2, A1/A2 open)

## Verification Results

- Full suite: **79 passed, 7 skipped**, exit 0 (68 prior + 11 new regression tests; golden-master still skips cleanly, data/ empty by user choice — Gap 2)
- Double-seed idempotent: run 1 added=132; run 2 **added=0, updated=0, unchanged=132** (required `alembic upgrade head` first — dev.db was absent in this checkout; documented seeder precondition, not a code change)
- All plan acceptance greps pass: `is_integer`/`isfinite`/`import math` present, three `int(float(row` coercions, dead notes guard gone, `pd.isna(row.notes)` in merge_readings, `dayfirst=True` in `_coerce_date`

## Task Commits

1. **Task 1 RED: failing non-integer/non-finite rejection tests** - `63e8801` (test)
2. **Task 1 GREEN: _validate_row isfinite/is_integer + int(float(...)) coercion** - `3ab9f91` (fix)
3. **Task 2 RED: failing NaN-notes convergence + minute-key tests** - `74ff6d6` (test)
4. **Task 2 GREEN: pd.isna notes normalization + minute-floored stored key** - `7294f3d` (fix)
5. **Task 3 RED: failing ambiguous slash-date test** - `02c771c` (test)
6. **Task 3 GREEN: ISO-first short-circuit + dual-parse dayfirst guard** - `d5ac9bd` (fix)

## Files Created/Modified

- `backend/app/etl.py` - _validate_row finite/integer gates; int(float(...)) derive coercion; NaN-notes normalization in merge_readings; minute flooring in transform; WR-04 date-ambiguity guard; docstrings updated
- `backend/tests/test_etl.py` - 8 new tests (6 Task-1 rejection/boundary/hygiene tests, 2 Task-3 date-ambiguity tests) in TestTransform/TestParseOmron
- `backend/tests/test_idempotency.py` - 3 new tests (NaN-notes convergence, minute flooring, cross-file same-minute no-duplicate)

## Decisions Made

- Reject-never-round pinned for fractional vitals (plan-specified, D-08 + medical-correctness rationale in the transform docstring)
- ISO 8601 short-circuit added ahead of the dual-parse guard (see deviation below)
- isfinite ordered before the `<= 0` comparison so NaN cannot bypass validation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ISO dates falsely flagged as ambiguous by the plan's dual-parse guard**
- **Found during:** Task 3 (GREEN phase — 6 existing tests broke)
- **Issue:** The plan assumed "If both agree (ISO dates ...)" — but `pd.to_datetime("2025-03-01", dayfirst=True)` returns 2025-01-03 (dateutil misreads Y-M-D as Y-D-M under the dayfirst hint), so the guard rejected every ISO text date used throughout the suite
- **Fix:** Added an ISO-first short-circuit: `pd.to_datetime(text, format="ISO8601", errors="coerce")` — ISO is unambiguous by definition and bypasses the guard; slash formats fall through to the dual parse exactly as planned
- **Files modified:** backend/app/etl.py
- **Commit:** d5ac9bd (folded into the Task 3 GREEN commit)

Environment note (not a deviation): the plan's double-seed verification required `alembic upgrade head` first — dev.db was empty in this checkout. This is the seeder's documented precondition (seed.py docstring, README Setup).

## Known Stubs

None. No hardcoded empty values, placeholders, or unwired data paths introduced.

## Threat Flags

None new. Plan threat register fully mitigated:
- T-01-08-01 (DoS): one malformed cell can no longer abort the file — the Phase 5 upload route inherits a transform that cannot 500 on one bad cell
- T-01-08-02 (Tampering): no silent truncation/rounding across an AHA boundary — non-integer vitals rejected
- T-1-04 (Info disclosure): new reasons ("not a whole number", "not a finite number") never echo values; hygiene test extended
- T-01-08-03 (Tampering): ambiguous dates rejected (NaT → RejectedRow), never guessed

## Next Phase Readiness

- Verification Gap 1 (the phase's only code blocker) is closed with regression tests pinning every behavior; no existing test weakened or deleted
- Gap 2 (DATA-04 real-data seeding) remains the documented human action (01-VERIFICATION.md Human Verification #1) — untouched by design; when data/ lands, also re-evaluate the WR-04 guard against the real date format (pin `format=`) and the minute-flooring against the golden-master CSV (D-01 process)
- Phase 2 API and Phase 5 upload inherit an ETL that rejects-and-reports instead of crashing or guessing

## Self-Check: PASSED

All 3 modified files exist on disk; all 6 task commits (63e8801, 3ab9f91, 74ff6d6, 7294f3d, 02c771c, d5ac9bd) present in git history; full suite green (79 passed, 7 skipped); double-seed idempotency observed live (0/0/132).

---
*Phase: 01-data-foundation*
*Completed: 2026-07-14*
