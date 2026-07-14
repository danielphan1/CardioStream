---
phase: 01-data-foundation
verified: 2026-07-14T04:30:00Z
status: human_needed
score: 24/25 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 16/18
  gaps_closed:
    - "transform rejects bad rows with per-row reasons (D-08) without aborting the file, and never silently changes a medical category — validation gate and coercion now agree by construction (CR-01 + WR-02), plus WR-01/WR-03/WR-04 warnings fixed alongside"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Place the real OMRON export (.xlsx) and bp_data_cleaned.csv into data/, run `cd backend && python -m alembic upgrade head && python -m app.seed`, then `python -m pytest tests/test_golden_master.py -v`"
    expected: "Seed summary reports added=132 (then 0/132 unchanged on re-run); golden-master diff passes on all six derived columns, or divergences are investigated and registered in EXCLUDED_ROWS per D-01. Note: transform now floors stored datetimes to minute precision (WR-03 fix) — if the real CSV carries second-precision DateTimes, investigate that divergence under the D-01 process; also pin an explicit format= in _coerce_date/_coerce_time per the FORMAT NOTE (A1/A2)"
    why_human: "The real health data files are deliberately absent from this machine and the repo (privacy by design; user chose 'skip' at the 01-01 checkpoint); no automated check can supply them (DATA-04 / SC1)"
---

# Phase 01: Data Foundation Verification Report (Re-Verification)

**Phase Goal:** Chris's real data lives in a correctly-derived, duplicate-proof database — and never in the public repo
**Verified:** 2026-07-14
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 01-08 (commits 63e8801..d5ac9bd)

## Re-Verification Summary

Previous verification (2026-07-13) scored 16/18 with 2 gaps. Gap 1 (the phase's only code blocker) was targeted by plan 01-08. Every fix was **empirically re-verified against current code** — the prior verification's own reproduction scenarios were re-run in a live probe, not read from the SUMMARY:

| Prior defect (empirically reproduced then) | Current behavior (empirically probed now) | Verdict |
|---|---|---|
| systolic `"118.5"` → unhandled ValueError aborts ENTIRE file | RejectedRow `"systolic: not a whole number"`; sibling row survives; reason does not echo the value | ✓ CLOSED |
| systolic `129.9` → silently truncated to 129/'Elevated' | RejectedRow — never stored truncated or rounded | ✓ CLOSED |
| `"inf"`/`"nan"` text vitals → crash or slip-through | RejectedRow `"…: not a finite number"` (isfinite before positivity) | ✓ CLOSED |
| WR-01: NaN notes → merge counts `updated` forever | Direct `merge_readings` double-call: run 1 added=1, run 2 (0,0,1) | ✓ CLOSED |
| WR-03: same-minute/different-second cross-file re-export inserts duplicate | 08:05:10 then 08:05:40 → second merge (0,0,1), DB count stays 1; stored datetime floored to 08:05:00 | ✓ CLOSED |
| WR-04: `"03/04/2025"` silently guessed month-first | `_coerce_date` returns NaT (dual-parse guard); `"13/04/2025"` → 2025-04-13; ISO dates unchanged | ✓ CLOSED |
| Valid inputs regression | text `"118"` and float `130.0` still accepted; 130 → Stage 1 | ✓ NO REGRESSION |

All 6 claimed task commits plus the summary commit exist in git history (63e8801, 3ab9f91, 74ff6d6, 7294f3d, 02c771c, d5ac9bd, 6e3a5fa — verified via `git cat-file`).

Gap 2 (DATA-04 real-data seeding) is not a code gap: the user explicitly chose 'skip' at the 01-01 checkpoint, and the prior report's own analysis holds — "this gap closes by human action, not by re-planning code." It is classified under Human Verification below; every mechanical prerequisite (seeder, idempotent merge, skipif-guarded golden master with EXCLUDED_ROWS divergence register) is verified working.

## Goal Achievement

### Observable Truths

Original 18 truths — passed items regression-checked, failed item fully re-verified:

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | (SC1) DB contains all 132 real readings with derived fields matching bp_data_cleaned.csv golden-master | ? UNCERTAIN (human-blocked by design) | data/ still empty (`ls data/` → 0 files); golden-master skips 7 tests with reason "real data not present (gitignored)". Mechanism fully verified via synthetic path. See Human Verification |
| 2 | (SC2) Re-running ETL on same/overlapping export adds zero duplicates | ✓ VERIFIED (regression) | Empirical: fresh temp DB, `alembic upgrade head` + seed twice — run 1 added=132/rejected=0; run 2 unchanged=132/total=132. Now STRONGER than before: cross-file same-minute/different-second no longer duplicates (WR-03 fix) |
| 3 | (SC3) Test suite passes: AHA+hypotension boundaries, brady/tachy boundaries, MAP, AM/PM, double-ingest idempotency | ✓ VERIFIED (regression) | `pytest tests/ -q`: **79 passed, 7 skipped** (golden-master only), 0.38s — matches SUMMARY claim, executed live |
| 4 | (SC4) Public repo contains no real health data; committed synthetic sample works | ✓ VERIFIED (regression) | `git check-ignore -v` → `.gitignore:2 data/`, `.gitignore:5 *.db`; `git ls-files data/` empty; history scan for `data/*` and `*.csv` clean; only committed data file is `backend/sample_data/omron_sample.xlsx`; sample seeded 132 rows end-to-end during this verification |
| 5 | (SC5) Alembic migrations create readings + empty future tables; timestamps naive local | ✓ VERIFIED (regression) | Empirical: `alembic upgrade head` on fresh temp DB → tables `readings, lab_results, incidents, procedures`; naive-roundtrip test in passing suite |
| 6 | data/ invisible to git BEFORE any real data lands | ✓ VERIFIED (regression) | check-ignore exit 0, both patterns proven |
| 7 | Backend imports cleanly with pinned deps in Py 3.12 venv | ✓ VERIFIED (regression) | Full suite + probes executed from `.venv` |
| 8 | Two readings with same datetime raise IntegrityError | ✓ VERIFIED (regression) | `test_unique_constraint_safety_net` in passing suite |
| 9 | classify_bp: AHA table, D-02 hypotension gate first, D-03 severity-max, all boundaries | ✓ VERIFIED (regression) | 29 boundary tests in passing suite; fresh 01-REVIEW re-traced thresholds independently |
| 10 | classify_pulse: Bradycardia <60, Normal 60–100 inclusive, Tachycardia >100 | ✓ VERIFIED (regression) | Boundary tests 59/60/100/101 in passing suite |
| 11 | MAP, pulse pressure, AM/PM match pinned formulas/rounding | ✓ VERIFIED (regression) | test_derivations.py in passing suite; seeded DB has 0 NULL derived columns across 132 rows |
| 12 | parse_omron reads OMRON .xlsx into normalized frame with naive datetime | ✓ VERIFIED (regression) | Seeder parsed committed sample end-to-end during this verification |
| 13 | transform derives via app.derivations, D-07 dedupe last-wins, D-08 rejects bad rows WITHOUT aborting the file | ✓ VERIFIED (was FAILED) | **Gap 1 closed.** Empirical probe: `"118.5"` row → RejectedRow, sibling survives, no exception; `129.9` → rejected, never truncated. `_validate_row` gates with `math.isfinite` + `num.is_integer()` (etl.py:212-215); derive loop coerces `int(float(...))` (etl.py:286-288) — gate and coercion agree by construction |
| 14 | No timezone-aware value anywhere in pipeline output (DATA-05) | ✓ VERIFIED (regression) | Naive roundtrip test in passing suite; seeded latest=2025-06-13 07:36:00 naive |
| 15 | Committed synthetic sample: 132 rows, every BP category, byte-reproducible | ✓ VERIFIED (regression) | test_sample.py in passing suite; seeded DB shows 6 distinct bp_category values |
| 16 | Double ingest adds zero; changed values upsert; D-06 IngestSummary shape | ✓ VERIFIED (regression) | 12 idempotency tests (9 prior + 3 new) in passing suite + live double-seed; WR-01 caveat from prior report now FIXED (empirically probed) |
| 17 | python -m app.seed loads via full ETL; synthetic fallback on fresh clone | ✓ VERIFIED (regression) | Empirical: seeder selected sample, D-06 summary printed, 132 rows, 0 NULL derived |
| 18 | Git history contains no real health data; README documents seed + privacy | ✓ VERIFIED (regression) | History scan clean this run; README seed command present (prior verification, unchanged) |

Gap-closure plan 01-08 must-have truths (all fully verified — the failed-item focus of this re-verification):

| #   | Truth (01-08 must_haves) | Status | Evidence |
| --- | ----- | ------ | -------- |
| 19 | transform rejects text-decimal '118.5' as RejectedRow while others survive — one bad cell never aborts the file (D-08) | ✓ VERIFIED | Empirical probe R1 + `test_d08_text_decimal_systolic_rejected_siblings_survive` (test_etl.py:~458) with hygiene assertion `"118.5" not in reason` |
| 20 | transform rejects 'inf'/'nan' text vitals instead of crashing | ✓ VERIFIED | Empirical probe R3: both → RejectedRow "not a finite number"; `test_d08_text_inf_and_nan_vitals_rejected` (test_etl.py:523) |
| 21 | Non-integer vital (129.9) never silently floor-truncated across a category boundary — rejected, never 129/'Elevated' | ✓ VERIFIED | Empirical probe R2; `test_d08_float_systolic_129_9_rejected_never_truncated` (test_etl.py:483), `test_d08_float_diastolic_89_5_rejected` (test_etl.py:504) |
| 22 | merge_readings converges on NaN notes: identical re-ingest counts unchanged, not updated forever (DATA-03) | ✓ VERIFIED | Empirical probe R4 (bypass-transform path, the original WR-01 reproduction): run 2 = (0,0,1); dead guard gone (`grep "row.notes if row.notes is not None"` → 0 matches); `pd.isna(row.notes)` at etl.py:371; `test_nan_notes_merge_converges` (test_idempotency.py:246) |
| 23 | Cross-file re-export with different seconds in same minute does not insert a second row — stored key is minute precision (D-07) | ✓ VERIFIED | Empirical probe R5: 08:05:10 stored as 08:05:00; second file at 08:05:40 → (0,0,1), DB count 1. `floor("min")` appears at etl.py:269 (dedupe compare) AND etl.py:277 (stored key); `test_cross_file_same_minute_different_seconds_no_duplicate` (test_idempotency.py:288) |
| 24 | Ambiguous slash-date '03/04/2025' rejected as unparseable, never silently misread month-first | ✓ VERIFIED | Empirical probe R6: NaT; '13/04/2025' → 2025-04-13; ISO short-circuit at etl.py:80 (documented Rule-1 deviation, sound — dayfirst misreads Y-M-D); `test_parse_ambiguous_slash_date_rejected` (test_etl.py:103) |
| 25 | Full backend test suite passes with new regression tests included | ✓ VERIFIED | Live run: 79 passed, 7 skipped, exit 0 (68 prior + 11 new; no test weakened or deleted — all prior test names still collected) |

**Score:** 24/25 truths verified (1 UNCERTAIN — human-blocked by design, not a code gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/app/etl.py` | Validation gate and coercion that agree; contains `is_integer` | ✓ VERIFIED (was DEFECTIVE) | `math.isfinite` + `is_integer` in `_validate_row`; `int(float(row[...]))` ×3; `pd.isna(row.notes)` in merge; minute-floored stored key; dayfirst guard + ISO8601 short-circuit — all read directly from source |
| `backend/tests/test_etl.py` | D-08 regressions; contains `118.5` | ✓ VERIFIED | 8 new tests present by name; `118.5` at lines 465, 584 + hygiene assertion at 592 |
| `backend/tests/test_idempotency.py` | NaN-notes + same-minute tests; contains `same_minute` | ✓ VERIFIED | All 3 named tests present (lines 246, 278, 288), passing |
| All 14 prior artifacts (gitignore, config, db, models, migrations, derivations, generator, sample, seed, tests, README) | Per initial verification | ✓ VERIFIED (regression) | Suite green, migrations empirically applied, seed empirically run, privacy gate empirically proven this run |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| etl.py::_validate_row | etl.py::transform derive loop | every gate-passed value coercible by `int(float(...))` | ✓ WIRED | Pattern `is_integer` at etl.py:214; coercions at 286-288; empirically proven by probe R7 (text "118" and 130.0 both flow through) |
| tests/test_etl.py | app/etl.py | `from app.etl import` | ✓ WIRED | Tests import and exercise RejectedRow/parse_omron/transform (79 passing) |
| etl.py::transform | models.py::uq_readings_datetime | clean_df datetime floored to minute matching D-07 | ✓ WIRED | Pattern `floor("min")` at etl.py:277; empirically proven by probe R5 (stored 08:05:00, unique constraint granularity now matches) |
| All 9 prior key links (db↔config, env.py↔models, etl↔derivations, seed↔etl, golden-master↔data/) | Per initial verification | ✓ WIRED (regression) | Suite + live seed execution exercise every link |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| seeded DB (readings) | all 9 stored columns | sample xlsx → parse → transform → merge | Yes — 132 rows, 0 NULL derived columns, 6 distinct BP categories, latest=2025-06-13 07:36:00 (minute-floored per WR-03) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Migrations create all tables | `alembic upgrade head` (fresh temp DB) | readings, lab_results, incidents, procedures | ✓ PASS |
| Seed loads sample end-to-end | `python -m app.seed` | added=132, rejected=0, latest=2025-06-13 07:36:00 | ✓ PASS |
| Double-seed idempotent | `python -m app.seed` (2nd run) | added=0, unchanged=132, total=132 | ✓ PASS |
| Full test suite | `pytest tests/ -q` | 79 passed, 7 skipped, exit 0 | ✓ PASS |
| D-08 survives text-decimal vital (prior FAIL) | `transform(df with systolic="118.5")` | RejectedRow, sibling survives, no exception | ✓ PASS |
| Category correct on float vital (prior FAIL) | `transform(df with systolic=129.9)` | RejectedRow — never stored 129/'Elevated' | ✓ PASS |
| merge converges on NaN notes (prior FAIL-warning) | direct double `merge_readings` with NaN note | run 2 = (0,0,1) | ✓ PASS |
| Cross-file same-minute/diff-seconds (prior warning) | transform+merge 08:05:10 then 08:05:40 | (0,0,1), DB count 1 | ✓ PASS |
| Ambiguous slash date (prior warning) | `_coerce_date("03/04/2025")` / `("13/04/2025")` / ISO | NaT / 2025-04-13 / unchanged | ✓ PASS |
| Claimed commits exist | `git cat-file -t` on all 7 hashes | all resolve to commits | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist and none are declared in plans/summaries — N/A. (Ad-hoc empirical probes above were run in the verifier's own process; SUMMARY claims were not taken as evidence.)

### Requirements Coverage

All 8 phase requirement IDs are claimed by at least one plan (01-08 re-claims DATA-01/02/03/07 for the gap closure). No orphaned requirements.

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| DATA-01 | 03, 04, 07, 08 | ETL computes 5 derived fields; single source of truth | ✓ SATISFIED | derivations.py sole threshold owner; end-to-end flow proven; derive loop coercion now defect-free |
| DATA-02 | 03, 08 | AHA + Hypotension BP categories; Brady/Normal/Tachy pulse | ✓ SATISFIED | Boundary suite passing; WR-02 truncation defect (the prior caveat) empirically closed — no vital can silently cross a category boundary |
| DATA-03 | 02, 06, 08 | Idempotent ETL, unique datetime constraint | ✓ SATISFIED | Prior warnings resolved: NaN-notes convergence fixed, minute-granularity key matches D-07 — both empirically probed. Live double-seed 0 added |
| DATA-04 | 07 | DB seeded with 132 real readings | ? NEEDS HUMAN | Real files deliberately absent (user 'skip'); mechanism complete and verified via synthetic fallback. See Human Verification |
| DATA-05 | 02, 04, 06 | Naive local timestamps end-to-end | ✓ SATISFIED | Naive roundtrip test passing; no tz in pipeline |
| DATA-06 | 02 | Migrations for empty future tables | ✓ SATISFIED | Empirical: 3 future tables created, empty, this run |
| DATA-07 | 03, 04, 06, 08 | Tests: BP/pulse boundaries, MAP, AM/PM, idempotency | ✓ SATISFIED | The prior caveat (missing D-08 text-decimal regression) is closed — 11 new regression tests pin every fixed behavior |
| DATA-08 | 01, 05, 07 | No real health data in repo; synthetic sample | ✓ SATISFIED | History scan re-run clean; check-ignore proven; sample committed and functional |

### Anti-Patterns Found

No TBD/FIXME/XXX/TODO/HACK/placeholder markers in any file modified by plan 01-08 (grep clean). The prior blockers in etl.py are gone. Remaining items are from the fresh post-closure code review (01-REVIEW.md, 2026-07-14: 0 critical, 3 warnings, 5 info) — all advisory, none fails a phase must-have:

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| backend/app/etl.py | 202-217 | `bool` is an int subtype — `systolic=True` passes the gate, stored as 1/'Hypotension' | ⚠️ Warning | Review WR-01 (new). Edge case for the Phase 5 caregiver-upload path; OMRON exports don't emit booleans. Address before/with the Phase 5 upload route |
| backend/app/etl.py | 198-218 | No plausibility bounds on vitals (99999 accepted); Numeric(5,1) MAP overflow diverges SQLite vs Postgres | ⚠️ Warning | Review WR-02 (new). Range validation is explicitly designated for local post-parse checks per CLAUDE.md; recommend fixing before Phase 5 upload |
| backend/app/etl.py | 128-139 | max_rows DoS guard runs after full workbook parse | ⚠️ Warning | Review WR-03 (new). Phase 5 route must add a byte-size cap before parse_omron — recorded for the Phase 5 plan |
| backend/app/etl.py | 88 | Month-first probe emits pandas UserWarning per day-first cell | ℹ️ Info | Log noise only; guard is removed when A1/A2 pins format= |
| backend/app/etl.py | 361-409 | No rollback handling around single commit in merge_readings | ℹ️ Info | Phase 5 route must wrap in try/except; seeder's context manager rolls back implicitly |
| backend/tests/test_idempotency.py | 278 | Unused `session` fixture arg in floor test | ℹ️ Info | Hygiene only |
| backend/scripts/generate_sample.py | 160-184 | Bare asserts for D-10 guarantees | ℹ️ Info | Carried from initial verification; test_sample.py independently re-pins |
| backend/app/db.py | 8 | Engine bound at import | ℹ️ Info | Carried; latent Phase 5 startup-ordering note |

### Human Verification Required

#### 1. Real-data landing + golden master (DATA-04 / SC1)

**Test:** Place the real OMRON export (.xlsx) and `bp_data_cleaned.csv` into `data/`, run `cd backend && python -m alembic upgrade head && python -m app.seed`, then `python -m pytest tests/test_golden_master.py -v`.
**Expected:** Seed summary reports added=132 (re-run: 0 added / 132 unchanged); golden-master diff passes on all six derived columns, or divergences are investigated and registered in `EXCLUDED_ROWS` per D-01. Two things to re-evaluate when data lands (documented in the transform docstring and FORMAT NOTE): (a) if the real CSV carries second-precision DateTimes, the minute-flooring divergence goes through the D-01 process; (b) pin an explicit `format=` in `_coerce_date`/`_coerce_time` and remove the WR-04 ambiguity guard.
**Why human:** The real health files are deliberately kept off this machine and out of the repo (privacy by design; user chose 'skip' at the 01-01 checkpoint). No automated check can supply them.

### Gaps Summary

**No code gaps remain.** Gap 1 from the initial verification (D-08 validation/coercion mismatch — the phase's only code blocker) is closed and empirically confirmed: both original reproduction scenarios now behave per D-08, the three companion warnings (WR-01/WR-03/WR-04) are fixed, 11 regression tests pin every behavior, and the full suite passes 79/79 (7 golden-master skips by design). No regressions in any previously-passed truth.

The single remaining item is DATA-04 / Success Criterion 1: the database on this machine holds 132 *synthetic* readings, not the 132 real ones, because the user deferred supplying the real files at the 01-01 checkpoint. Every mechanical prerequisite is verified working. This closes by human action (dropping the files and running the seed + golden master), not by re-planning code — hence status `human_needed`, not `gaps_found`.

Alternatively, to accept the deviation out-of-band and let the phase pass now, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "Database contains all 132 real readings with derived fields matching bp_data_cleaned.csv in a golden-master diff"
    reason: "Real data files deliberately absent from this machine (user 'skip' at 01-01 checkpoint); seeding mechanism + idempotency fully verified via synthetic fallback; golden-master test ships skipif-guarded and will run when data/ lands"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_
