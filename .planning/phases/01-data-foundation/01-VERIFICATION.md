---
phase: 01-data-foundation
verified: 2026-07-13T08:10:00Z
status: gaps_found
score: 16/18 must-haves verified
overrides_applied: 0
gaps:
  - truth: "transform rejects bad rows with per-row reasons (D-08) without aborting the file, and never silently changes a medical category"
    status: failed
    reason: "Validation gate and coercion disagree: _validate_row accepts any positive float, but the derive loop coerces with int(raw). Text-decimal vitals ('118.5', 'inf') pass validation then raise unhandled ValueError, aborting the ENTIRE file — empirically reproduced against current code (violates locked D-08). Separately, native float 129.9 is silently floor-truncated to 129 and classified 'Elevated' when rounding gives 130 -> 'Stage 1' — empirically reproduced (violates the 'derived medical categorizations must be correct' project constraint). Same root cause, same fix site. (Review CR-01 + WR-02.)"
    artifacts:
      - path: "backend/app/etl.py"
        issue: "_validate_row (lines ~186-191) validates via float(val); derive loop (lines ~237-239) coerces via int(row[...]) on the raw value — any float-parseable non-integer crashes transform; any native non-integer float is truncated across category boundaries"
    missing:
      - "Reject non-integer vitals in _validate_row (float(num).is_integer() check) OR coerce via int(float(...)) with documented rounding — validation and coercion must agree"
      - "Add math.isfinite(num) so 'inf'/'nan' strings are rejected, not accepted-then-crashed"
      - "Regression test: a row with systolic '118.5' is rejected as a RejectedRow while remaining rows survive (D-08 holds)"
      - "Boundary tests for non-integer vitals (129.9, 89.5) pinning the chosen reject/round behavior"
  - truth: "Database contains all 132 real readings (Feb 22 – Jun 13, 2025) with derived fields matching bp_data_cleaned.csv in a golden-master diff (DATA-04, SC1)"
    status: failed
    reason: "Real data files (data/ OMRON export + bp_data_cleaned.csv) are not on this machine — user explicitly chose 'skip' at the 01-01 checkpoint. The mechanism is complete and verified: seeder ran end-to-end against the synthetic fallback (132 added, then 0/132 unchanged on re-run), golden-master test is skipif-guarded (7 skips). Evidence for the real-data criterion cannot exist until the files land."
    artifacts:
      - path: "backend/app/seed.py"
        issue: "Real-data branch untestable on this machine (data/ empty); synthetic fallback branch verified working"
      - path: "backend/tests/test_golden_master.py"
        issue: "Skips with reason 'real data not present (gitignored)' — 7 skipped; LABEL_MAP provisional (A3 open)"
    missing:
      - "User drops the real OMRON export and bp_data_cleaned.csv into data/, runs python -m app.seed, and the golden-master test passes (or divergences are recorded in EXCLUDED_ROWS per D-01)"
human_verification:
  - test: "Place the real OMRON export (.xlsx) and bp_data_cleaned.csv into data/, run `cd backend && python -m app.seed`, then `python -m pytest tests/test_golden_master.py -v`"
    expected: "Seed summary reports added=132 (then 0/132 unchanged on re-run); golden-master diff passes on all six derived columns or divergences are investigated and registered in EXCLUDED_ROWS"
    why_human: "The real health data files are deliberately absent from this machine and the repo (privacy by design, user chose 'skip'); no automated check can supply them"
---

# Phase 01: Data Foundation Verification Report

**Phase Goal:** Chris's real data lives in a correctly-derived, duplicate-proof database — and never in the public repo
**Verified:** 2026-07-13
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

All evidence below is from direct codebase inspection, test execution, and empirical reproduction — SUMMARY claims were cross-checked, not trusted.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | (SC1) DB contains all 132 real readings with derived fields matching bp_data_cleaned.csv golden-master | ✗ FAILED | data/ is empty (user 'skip' at 01-01); golden-master skips 7 tests. Mechanism verified via synthetic path. See Gap 2 + override suggestion below |
| 2 | (SC2) Re-running ETL on same/overlapping export adds zero duplicates | ✓ VERIFIED | Empirical: seeded temp DB twice — run 1: added=132; run 2: added=0, unchanged=132, total=132. `test_double_ingest_adds_zero_rows`, `test_overlapping_export_upserts` pass. WR-03 caveat noted below |
| 3 | (SC3) Test suite passes: AHA+hypotension boundaries, brady/tachy boundaries, MAP, AM/PM, double-ingest idempotency | ✓ VERIFIED | `pytest -q`: 68 passed, 7 skipped (golden-master only), 0.36s. Boundary matrix in test_categories.py, MAP/AM-PM in test_derivations.py, idempotency in test_idempotency.py |
| 4 | (SC4) Public repo contains no real health data; committed synthetic sample works for development | ✓ VERIFIED | `git check-ignore data/ *.db` passes; `git ls-files data/` empty; full-history file scan shows only `backend/sample_data/omron_sample.xlsx` (synthetic); sample seeds 132 rows through the full pipeline |
| 5 | (SC5) Alembic migrations create readings + empty future tables; timestamps naive local | ✓ VERIFIED | Empirical: `alembic upgrade head` on fresh DB → tables `readings, lab_results, incidents, procedures`; `test_datetimes_naive_roundtrip` passes; no timezone anywhere in models.py |
| 6 | data/ invisible to git BEFORE any real data lands (01-01) | ✓ VERIFIED | `.gitignore:2 data/`, `.gitignore:5 *.db`; check-ignore exit 0 |
| 7 | Backend imports cleanly with pinned deps in Py 3.12 venv (01-01) | ✓ VERIFIED | Full test suite executed from `.venv`; pyproject.toml pins verified |
| 8 | Two readings with same datetime raise IntegrityError (01-02) | ✓ VERIFIED | `test_unique_constraint_safety_net` passes; `uq_readings_datetime` in models.py + migration |
| 9 | classify_bp: AHA table, D-02 hypotension gate first, D-03 severity-max, all boundaries (01-03) | ✓ VERIFIED | 29 boundary tests pass; review independently traced every threshold (Crisis >180/>120, Stage 2 ≥140/≥90, Stage 1 ≥130/≥80, Elevated 120–129 systolic-only, hypotension short-circuit) |
| 10 | classify_pulse: Bradycardia <60, Normal 60–100 inclusive, Tachycardia >100 (01-03) | ✓ VERIFIED | Boundary tests at 59/60/100/101 pass |
| 11 | MAP, pulse pressure, AM/PM match pinned formulas/rounding (01-03) | ✓ VERIFIED | test_derivations.py passes; MAP=(sbp+2·dbp)/3 rounded to 1 decimal confirmed in seeded rows (e.g. 113/69 → 83.7) |
| 12 | parse_omron reads OMRON .xlsx into normalized frame with naive datetime (01-04) | ✓ VERIFIED | Seeder parsed the committed sample end-to-end; naive-dtype tests pass |
| 13 | transform derives via app.derivations, D-07 dedupe last-wins, D-08 rejects bad rows WITHOUT aborting the file (01-04) | ✗ FAILED | Empirically reproduced: `transform` with systolic `"118.5"` → `ValueError: invalid literal for int() with base 10: '118.5'` — entire file aborted. Also 129.9 → stored 129 → 'Elevated' instead of Stage 1. See Gap 1 |
| 14 | No timezone-aware value anywhere in pipeline output (DATA-05) | ✓ VERIFIED | Naive roundtrip test passes; grep for timezone/tzinfo in app modules: none (only docstring) |
| 15 | Committed synthetic sample: 132 rows, Feb–Jun 2025 character, every BP category, byte-reproducible (01-05) | ✓ VERIFIED | test_sample.py 7 tests pass; seeded DB shows all 6 BP categories present; generator imports classify_bp/classify_pulse (no threshold duplication) |
| 16 | Double ingest adds zero; changed values upsert; D-06 IngestSummary shape (01-06) | ✓ VERIFIED | 9 idempotency tests pass + empirical double-seed. IngestSummary fields added/updated/unchanged/rejected/total/latest confirmed in seeder output. WR-01 caveat noted below |
| 17 | python -m app.seed loads via full ETL; synthetic fallback on fresh clone (01-07) | ✓ VERIFIED | Empirical: seeder selected `sample_data/omron_sample.xlsx`, printed D-06 summary, 132 rows in DB with zero NULL derived columns. Real-data branch folded into Truth 1 |
| 18 | Git history contains no real health data; README documents seed + privacy (01-07) | ✓ VERIFIED | History scan clean; README.md:28 `cd backend && python -m app.seed`; Privacy section present |

**Score:** 16/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.gitignore` | Privacy gate: data/, *.db | ✓ VERIFIED | check-ignore proven |
| `backend/pyproject.toml` | Pinned deps + pytest config | ✓ VERIFIED | SDK checks pass |
| `backend/app/config.py` | pydantic-settings, sqlite default | ✓ VERIFIED | Wired to db.py |
| `backend/app/db.py` | Sync engine + sessions | ✓ VERIFIED | create_engine from settings (IN-04 latent import-time binding noted) |
| `backend/app/models.py` | Reading + 3 future tables, UniqueConstraint | ✓ VERIFIED | 40+ lines, naming convention, naive DateTime |
| `backend/alembic/env.py` | target_metadata = Base.metadata, render_as_batch | ✓ VERIFIED | env.py:30 (SDK pattern miss was a regex-escaping false negative — confirmed manually) |
| `backend/alembic/versions/` (2 migrations) | readings + future tables | ✓ VERIFIED | Empirical upgrade head creates all 4 tables |
| `backend/app/derivations.py` | 5 derivation functions, single source of truth | ✓ VERIFIED | All 5 exported; no threshold duplication in etl.py/generator (grep) |
| `backend/app/etl.py` | parse_omron + transform + RejectedRow + merge_readings + IngestSummary | ⚠️ DEFECTIVE | Exists, substantive, wired — but transform's validation/coercion mismatch breaks D-08 (Gap 1) |
| `backend/scripts/generate_sample.py` | Seeded deterministic generator | ✓ VERIFIED | SEED present, imports derivations |
| `backend/sample_data/omron_sample.xlsx` | Committed synthetic sample | ✓ VERIFIED | Only data file in git history; seeds 132 rows |
| `backend/app/seed.py` | `__main__` entry, D-12 source selection | ✓ VERIFIED | Empirically executed twice (IN-03 lock-file glob noted) |
| `backend/tests/*` (7 test modules) | Boundary matrix, ETL, idempotency, migrations, sample, golden-master | ✓ VERIFIED | 68 passed, 7 skipped |
| `README.md` | Seed docs + privacy statement | ✓ VERIFIED | Contains `python -m app.seed` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| app/db.py | app/config.py | engine from settings | ✓ WIRED | SDK pass |
| alembic/env.py | app/models.py | target_metadata = Base.metadata | ✓ WIRED | env.py:30 (manual; SDK regex false negative) |
| alembic/env.py | app/config.py | URL from get_settings | ✓ WIRED | SDK pass |
| tests/test_categories.py | app/derivations.py | direct import | ✓ WIRED | SDK pass |
| app/etl.py | app/derivations.py | transform imports 5 functions | ✓ WIRED | SDK pass + grep: zero classify_* defs in etl.py |
| scripts/generate_sample.py | app/derivations.py | category coverage assertions | ✓ WIRED | SDK pass |
| app/etl.py | app/models.py | merge_readings keyed on Reading.datetime_ | ✓ WIRED | SDK pass; session.merge() absent (grep) |
| app/seed.py | app/etl.py | parse → transform → merge_readings | ✓ WIRED | SDK pass + empirical execution |
| tests/test_golden_master.py | data/bp_data_cleaned.csv | skipif-guarded fixture read | ✓ WIRED | SDK pass (file absent → 7 clean skips, by design) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| seeded DB (readings) | all 9 stored columns | sample xlsx → parse → transform → merge | Yes — 132 rows, 0 NULL derived columns, all 6 BP categories represented, MAP values correct | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Migrations create all tables | `alembic upgrade head` (fresh temp DB) | readings, lab_results, incidents, procedures | ✓ PASS |
| Seed loads sample end-to-end | `python -m app.seed` | added=132, rejected=0, latest=2025-06-13 07:36 | ✓ PASS |
| Double-seed idempotent | `python -m app.seed` (2nd run) | added=0, updated=0, unchanged=132 | ✓ PASS |
| Full test suite | `pytest -q` | 68 passed, 7 skipped | ✓ PASS |
| D-08 survives text-decimal vital | `transform(df with systolic="118.5")` | **ValueError — whole file aborted** | ✗ FAIL |
| Category correct on float vital | `transform(df with systolic=129.9)` | **stored 129 → 'Elevated' (should be 130 → 'Stage 1')** | ✗ FAIL |
| merge converges on NaN notes (direct call) | double `merge_readings` with NaN note | first added=1; second updated=1 forever | ✗ FAIL (warning — full pipeline normalizes notes, path only reachable bypassing transform) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist and none are declared in plans/summaries — N/A.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| DATA-01 | 03, 04, 07 | ETL computes 5 derived fields; single source of truth | ✓ SATISFIED | derivations.py sole threshold owner; grep-verified no duplication; end-to-end flow proven |
| DATA-02 | 03 | AHA + Hypotension BP categories; Brady/Normal/Tachy pulse | ✓ SATISFIED | 29 boundary tests + independent review trace (WR-02 truncation is an ETL input-layer defect, tracked in Gap 1) |
| DATA-03 | 02, 06 | Idempotent ETL, unique datetime constraint | ✓ SATISFIED (with warnings) | Empirical double-seed 0 added; IntegrityError safety net tested. Warnings: WR-01 NaN-notes non-convergence (bypass path), WR-03 minute-vs-second granularity mismatch |
| DATA-04 | 07 | DB seeded with 132 real readings | ✗ BLOCKED | Real files absent (user 'skip'); mechanism complete + verified via synthetic fallback. Gap 2 |
| DATA-05 | 02, 04, 06 | Naive local timestamps end-to-end | ✓ SATISFIED | Naive roundtrip test; no tz anywhere in schema/pipeline |
| DATA-06 | 02 | Migrations for empty future tables | ✓ SATISFIED | Empirical: 3 future tables created, empty |
| DATA-07 | 03, 04, 06 | Tests: BP/pulse boundaries, MAP, AM/PM, idempotency | ✓ SATISFIED | All five test areas present and passing (missing D-08 regression for text-decimals noted in Gap 1) |
| DATA-08 | 01, 05, 07 | No real health data in repo; synthetic sample | ✓ SATISFIED | History scan clean; gitignore proven; sample committed and functional |

No orphaned requirements: all 8 phase requirement IDs are claimed by at least one plan and accounted for above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| backend/app/etl.py | ~186-191 vs ~237-239 | Validation gate (float) disagrees with coercion (int on raw) — file-aborting crash on valid-per-gate input | 🛑 Blocker | Violates locked D-08; Phase 5 upload becomes an unhandled 500; seeder dies on one bad cell (Gap 1) |
| backend/app/etl.py | ~237-239 | Silent `int()` floor-truncation of float vitals across medical category boundaries | 🛑 Blocker (grouped w/ above) | 129.9 → 'Elevated' instead of 'Stage 1' — medical categorization correctness constraint (Gap 1) |
| backend/app/etl.py | ~319 | Dead-code None guard (`row.notes if row.notes is not None else None`) — intended NaN normalization is a no-op | ⚠️ Warning | Merge never converges on NaN notes if transform is bypassed (empirically reproduced) |
| backend/app/etl.py | 227 vs 312+ | D-07 duplicate = same minute intra-file, but merge key + unique constraint are second-precision | ⚠️ Warning | Cross-file same-minute/different-second reading is ADDED as a second row — duplicate by the pipeline's own definition |
| backend/app/etl.py | 72, 86 | Text-date fallback with default month-first inference, no format/dayfirst | ⚠️ Warning | Ambiguous real-export dates would be silently misread; resolve when real export lands (A1/A2 open) |
| backend/app/seed.py | 44 | Glob matches Excel lock files (`~$*.xlsx`) | ℹ️ Info | Seeder crashes opaquely if export open in Excel |
| backend/app/db.py | 8 | Engine bound at import from cached settings | ℹ️ Info | Latent Phase 5 startup-ordering trap |
| backend/scripts/generate_sample.py | 160-184 | Bare `assert` for D-10 guarantees | ℹ️ Info | Vanishes under `python -O`; test_sample.py re-checks committed file |

No TBD/FIXME/XXX/TODO/HACK/placeholder markers in any phase-modified file (grep clean).

### Human Verification Required

#### 1. Real-data landing + golden master (DATA-04 / SC1)

**Test:** Place the real OMRON export and `bp_data_cleaned.csv` into `data/`, run `cd backend && python -m app.seed`, then `python -m pytest tests/test_golden_master.py -v`.
**Expected:** added=132 (re-run: 0 added / 132 unchanged); golden-master diff passes on all six derived columns, or divergences are investigated and registered in `EXCLUDED_ROWS` per D-01.
**Why human:** The real health files are deliberately kept off this machine and out of the repo (privacy by design; user chose 'skip' at the 01-01 checkpoint). No automated check can supply them.

### Gaps Summary

**Gap 1 (blocker, fix in code):** `backend/app/etl.py` `transform` violates the locked D-08 invariant — its validation gate accepts any positive float, but the derive loop coerces the raw value with `int()`. Two empirically reproduced consequences: (a) a text-decimal vital like `"118.5"` (or `"inf"`) passes validation and then crashes the ENTIRE transform with an unhandled `ValueError` — one bad cell aborts the whole file, which becomes an unhandled 500 on Phase 5 upload and kills a full seed run; (b) a native float `129.9` is silently floor-truncated to `129` and classified **Elevated** when rounding gives `130` → **Stage 1** — a direct violation of the project's "derived medical categorizations must be correct" constraint. Both share one root cause (validation/coercion mismatch) and one fix site: make `_validate_row` reject non-integer/non-finite vitals (or coerce through the validated float with documented rounding), plus regression tests. This is Review CR-01 + WR-02.

**Gap 2 (blocked on user, not on code):** DATA-04 / Success Criterion 1 — the database on this machine contains 132 *synthetic* readings, not the 132 real readings, because the user explicitly deferred supplying the real files at the 01-01 checkpoint. Every mechanical prerequisite is verified working (seeder, idempotent merge, skipif-guarded golden master with divergence register). This gap closes by human action, not by re-planning code.

**This second gap looks intentional.** To accept the deviation and verify DATA-04 out-of-band when the files land, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "Database contains all 132 real readings with derived fields matching bp_data_cleaned.csv in a golden-master diff"
    reason: "Real data files deliberately absent from this machine (user 'skip' at 01-01 checkpoint); seeding mechanism + idempotency fully verified via synthetic fallback; golden-master test ships skipif-guarded and will run when data/ lands"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

**Warnings not blocking the goal (recommend addressing alongside Gap 1, same file):** WR-01 (no-op NaN-notes guard in `merge_readings` — idempotency silently breaks on any path that bypasses `transform`'s normalization), WR-03 (minute-granularity D-07 dedupe vs second-granularity merge key/unique constraint — a cumulative export re-stamping seconds would insert what the pipeline itself defines as a duplicate), WR-04 (ambiguous text-date parsing — pin `format=` when the real export lands).

---

_Verified: 2026-07-13_
_Verifier: Claude (gsd-verifier)_
