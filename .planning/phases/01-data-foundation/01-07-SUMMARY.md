---
phase: 01-data-foundation
plan: 07
subsystem: etl
tags: [python, seeding, golden-master, privacy]

# Dependency graph
requires:
  - phase: 01-data-foundation
    plan: 04
    provides: "parse_omron + transform pure ETL; conftest fixtures"
  - phase: 01-data-foundation
    plan: 05
    provides: "backend/sample_data/omron_sample.xlsx — 132-row synthetic fallback (D-12)"
  - phase: 01-data-foundation
    plan: 06
    provides: "merge_readings idempotent DB merge + D-06 IngestSummary"
provides:
  - "backend/app/seed.py — python -m app.seed entry point (D-16): D-12 source selection, full-ETL seeding, D-06 summary output, exit 1 on empty seed"
  - "backend/tests/test_golden_master.py — skipif-guarded six-column diff vs data/bp_data_cleaned.csv (D-01, D-14) with provisional LABEL_MAP and EXCLUDED_ROWS divergence register"
  - "README.md — Setup / Seeding / Synthetic sample / Privacy documentation (DATA-08 closure)"
affects: [phase-2-api, phase-5-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seeder as thin composition: resolve_source() -> parse_omron -> transform -> merge_readings; zero business logic in the CLI layer (D-14)"
    - "Golden-master as pure-frame comparison: no DB imports anywhere in the test module (grep-verified)"

key-files:
  created:
    - backend/app/seed.py
    - backend/tests/test_golden_master.py
  modified:
    - README.md

key-decisions:
  - "data/ absent in this checkout (01-01 checkpoint resolved 'skip') — seeder verified against the synthetic-sample fallback branch; golden-master ships skipif-guarded and SKIPS with reason 'real data not present (gitignored)'"
  - "LABEL_MAP is provisional (A3 blocker open): identity for canonical labels plus plausible Tableau-era variants; re-verify against the real CSV when it lands"
  - "DATA-04 NOT marked complete: it requires the real 132 readings, which are not on this machine — mechanism is done, evidence pending data/ landing"

patterns-established:
  - "EXCLUDED_ROWS dict (datetime -> reason) as the D-01 documented-divergence register — divergences recorded in-test, classifier never bent to match the CSV"

requirements-completed: [DATA-01]

# Metrics
duration: 8min
completed: 2026-07-13
---

# Phase 01 Plan 07: Seeder + Golden Master + Privacy Closure Summary

**`python -m app.seed` seeds through the full parse→transform→merge pipeline (132 added on run 1, 0/132 unchanged on run 2 from the synthetic fallback — data/ absent per D-12), golden-master test ships skipif-guarded with a provisional LABEL_MAP, and the full-history privacy audit is clean (only the synthetic sample ever committed)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-13T07:44:54Z
- **Completed:** 2026-07-13T07:53:00Z
- **Tasks:** 3/3
- **Files modified:** 3

## Seed Counts (Task 1 evidence — synthetic-sample branch, data/ absent)

| Run | source | added | updated | unchanged | rejected | total | latest |
|-----|--------|-------|---------|-----------|----------|-------|--------|
| 1 | sample: backend/sample_data/omron_sample.xlsx | **132** | 0 | 0 | 0 | 132 | 2025-06-13 07:36:00 |
| 2 | sample: backend/sample_data/omron_sample.xlsx | **0** | **0** | 132 | 0 | 132 | 2025-06-13 07:36:00 |

- Idempotency observed end-to-end: readings count unchanged between runs (132 → 132)
- Post-seed DB check: `select count(*) from readings` = 132
- Zero rejects from the sample (no intra-file duplicates by construction, per 01-05)
- Output contains counts/dates/path only — no systolic/diastolic/pulse values (T-1-04)
- `grep -c "bp_data_cleaned" backend/app/seed.py` = 0 (D-14); no `create_all` — seeder assumes `alembic upgrade head` has run

**Real-data branch NOT exercised:** `data/` does not exist in this checkout (user chose "skip" at the 01-01 checkpoint; blocker carried). When the real export lands in `data/`, `python -m app.seed` will pick it automatically (sorted-first `*.xlsx`) — re-run then to satisfy DATA-04.

## Golden-Master Result (Task 2 — documented skip per plan/RESEARCH Pattern 4)

- All 7 tests **SKIPPED** with reason `real data not present (gitignored)` — `data/bp_data_cleaned.csv` absent
- Test structure verified: module-level `skipif`, six-column scope (DateTime alignment, AM_PM, BP_Category, Pulse_Category, MAP with `atol=0.05`, Pulse_Pressure) — DayOfWeek/WeekNumber/Month explicitly out of scope (Pitfall 8)
- `grep -c "to_sql\|merge_readings\|session" backend/tests/test_golden_master.py` = **0** — pure-frame comparison, CSV never loaded into the DB (D-14)
- **D-01 divergences: none established yet** — `EXCLUDED_ROWS` is empty because no real CSV exists to investigate; the register (datetime → reason) and the investigation protocol are documented in the module docstring. Expected first candidates: wide-pulse-pressure hypotension-gate rows like 200/55 (Pitfall 3)
- **LABEL_MAP is provisional (A3 open):** identity entries pin the canonical spellings; variant entries cover plausible CSV spellings ("Stage 1 Hypertension", "Hypertension Stage 2", "Low", "Crisis", "Low Pulse", "High Pulse"). Unknown spellings will surface as diffs, not silent passes. Re-verify when the real CSV lands
- Full suite: **68 passed, 7 skipped**, exit 0

## Privacy Audit Evidence (Task 3 — DATA-08)

**Check 1 — full-history path grep:**
```
$ git log --all --name-only --format="" | sort -u | grep -Ei "^data/|bp_data_cleaned|omron"
backend/sample_data/omron_sample.xlsx
```
Only match is the permitted synthetic sample. **No path beginning with `data/` appears anywhere in history.**

**Check 2 — gitignore probe:**
```
$ git check-ignore -q data/bp_data_cleaned.csv; echo $?
0
```
Exit 0 — any file placed under `data/` is ignored.

**Check 3 — working-tree status:**
```
$ git status --porcelain | grep -cE 'data/|\.venv|\.db'
0
```
No `data/`, `.venv`, or `.db` entries (only README.md was modified at audit time).

## Accomplishments

- `backend/app/seed.py` (76 lines): `resolve_source()` per D-12 (repo root resolved from `Path(__file__)`, never cwd), full pipeline composition, labeled D-06 summary lines, exit 1 on `total == 0`, no `create_all`
- `backend/tests/test_golden_master.py` (158 lines): skipif guard, LABEL_MAP, EXCLUDED_ROWS register, per-column `assert_series_equal` diffs, row-count-132 and tz-naive assertions
- `README.md`: `## Setup` (venv, `pip install -e '.[dev]'`, `alembic upgrade head`), `## Seeding` (D-16 command, D-12 source selection, summary shape, idempotency note), `## Synthetic sample` (generator command, no-real-data statement), expanded `## Privacy` (gitignored `data/` + `*.db`, log hygiene, heart.org AHA citation + documented Hypotension extension)
- REQUIREMENTS.md: DATA-01 marked complete (full ETL path now exercised end-to-end by the seed command); DATA-08 confirmed complete

## Task Commits

1. **Task 1: python -m app.seed (D-12, D-16)** - `fc3343e` (feat)
2. **Task 2: Golden-master test (D-01, D-14)** - `6c3e275` (test)
3. **Task 3: README + privacy audit (DATA-08)** - `1f09cd1` (docs)

## Files Created/Modified

- `backend/app/seed.py` - CLI seeder entry point; thin wrapper over app.etl
- `backend/tests/test_golden_master.py` - Skipif-guarded golden-master diff vs bp_data_cleaned.csv
- `README.md` - Setup/Seeding/Synthetic sample/Privacy documentation

## Decisions Made

- **DATA-04 left Pending (honest accounting):** the requirement is "seeded with the existing 132 real readings" — the real export is not on this machine, so only the synthetic fallback was seeded. The mechanism (seeder + idempotent merge) is complete and verified; the evidence requires `data/` to be populated. Carried as the phase's open blocker
- Golden-master skip is the plan-sanctioned outcome ("green golden-master **or documented skip**"); the test executes automatically once `data/bp_data_cleaned.csv` and a `data/*.xlsx` export exist
- LABEL_MAP built from documented plausible variants rather than CSV inspection (A3 could not be performed — no CSV); mapping is conservative (unknown labels pass through and diff loudly)

## Deviations from Plan

None - plan executed exactly as written. (Fresh worktree required creating `backend/.venv` — environment setup, not a deviation, consistent with prior plans. The plan's real-data expectations were handled via its own explicit fallback branches: sample-fallback seed counts and documented golden-master skip.)

## Known Stubs

None blocking. Two items are intentionally provisional pending real data (both documented in-file and above): `LABEL_MAP` variant entries (A3 inspection outstanding) and the empty `EXCLUDED_ROWS` register (nothing to investigate until the CSV exists). Neither prevents this plan's goal — the plan explicitly allows "green golden-master (or documented skip)".

## Threat Flags

None new. Plan threat register fully mitigated:
- T-1-01: full-history audit clean (evidence above); gitignore probe exits 0
- T-1-04: seeder prints counts/reasons/dates only — verified in captured output
- T-1-09: D-01 protocol encoded as the EXCLUDED_ROWS register + docstring protocol; classifier untouched

## Next Phase Readiness

- Phase 1 mechanism complete: ETL, idempotent merge, seed command, migrations, synthetic sample, privacy gate all shipped and tested (68 passed)
- **Open blocker (carried):** real OMRON export + `bp_data_cleaned.csv` still absent from `data/`. When they land: (1) re-run `python -m app.seed` (DATA-04 evidence), (2) re-verify parse_omron against the real format (A1/A2), (3) run the golden-master un-skipped and pin LABEL_MAP/MAP atol (A3), (4) record any D-01 divergences in EXCLUDED_ROWS
- Phase 2 API can read the seeded dev DB; Phase 5 upload route reuses the exact parse→transform→merge path the seeder just proved end-to-end

## Self-Check: PASSED

All 3 files exist on disk (seed.py, test_golden_master.py, README.md); all 3 task commits (fc3343e, 6c3e275, 1f09cd1) present in git history; full suite green (68 passed, 7 skipped); seeder idempotency observed live.

---
*Phase: 01-data-foundation*
*Completed: 2026-07-13*
