---
phase: 01-data-foundation
plan: 03
subsystem: etl
tags: [python, medical-derivations, tdd, aha-classification]

# Dependency graph
requires:
  - phase: 01-data-foundation
    plan: 01
    provides: "backend/ scaffold, pinned deps, backend/tests/ pytest tree"
provides:
  - "backend/app/derivations.py — single source of truth for all five derivations (DATA-01): classify_bp, classify_pulse, compute_map, compute_pulse_pressure, derive_am_pm"
  - "Canonical BP labels pinned: Hypotension, Normal, Elevated, Stage 1, Stage 2, Hypertensive Crisis"
  - "Canonical pulse labels pinned: Bradycardia, Normal, Tachycardia"
  - "MAP convention pinned: (sbp + 2*dbp)/3 rounded to 1 decimal, returned as float (golden-master diffs with atol=0.05)"
  - "Full boundary test matrix green: 29 tests covering every RESEARCH matrix value"
affects: [01-04, 01-05, 01-07, etl, phase-2-api, phase-2-charts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derivation functions (no pandas/sqlalchemy/IO) — plain ints/datetimes in, str/float/int out; importable by transform, generator, and tests alike"
    - "D-03 severity-max via ordered _SEVERITY list + max(key=_SEVERITY.index) after independent systolic/diastolic ladder classification"
    - "TDD RED/GREEN: boundary matrix committed as failing spec before implementation"

key-files:
  created:
    - backend/app/derivations.py
    - backend/tests/test_categories.py
    - backend/tests/test_derivations.py
  modified: []

key-decisions:
  - "Canonical labels pinned exactly as: 'Hypotension', 'Normal', 'Elevated', 'Stage 1', 'Stage 2', 'Hypertensive Crisis' (BP) and 'Bradycardia', 'Normal', 'Tachycardia' (pulse) — golden-master label-map (01-07) handles any CSV spelling drift per D-01"
  - "MAP rounding pinned: round to 1 decimal, float return — tests use pytest.approx(abs=0.05); revisit only if real CSV inspection (01-07) reveals a different convention"
  - "Hypotension gate precedence pinned by explicit test: classify_bp(200, 55) == 'Hypotension' — golden-master mismatch on such rows is a D-01 investigate event, not a code bug"

patterns-established:
  - "Categories computed in derivations.py and ONLY there (DATA-01) — 01-04/01-05/01-07 must import, never recompute"
  - "Boundary tests parametrized so failures name the exact threshold tuple"

requirements-completed: [DATA-01, DATA-02, DATA-07]

# Metrics
duration: 6min
completed: 2026-07-09
---

# Phase 01 Plan 03: Medical Derivation Module (TDD) Summary

**Pure derivations module built test-first: verified AHA BP ladder with D-02 hypotension gate and D-03 severity-max, D-04 pulse categories, MAP (1-decimal float), pulse pressure (int), AM/PM (noon=PM, naive datetimes) — 29 boundary tests green**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-09T02:48:21Z
- **Completed:** 2026-07-09T02:54:00Z
- **Tasks:** 2/2 (RED + GREEN)
- **Files modified:** 3

## Accomplishments

- RED (f84a979): complete failing boundary suite — every tuple from the RESEARCH §Boundary test matrix parametrized, including the precedence pin (200,55)→Hypotension and the strict-Crisis pins (181,100)/(150,121)→Hypertensive Crisis vs (180,100)/(150,120)→Stage 2; suite failed with ModuleNotFoundError as required
- GREEN (e5227a3): `backend/app/derivations.py` — five pure functions, 29/29 tests pass, zero test modifications
- Purity verified: `grep -c "import pandas\|import sqlalchemy" backend/app/derivations.py` → 0; no DB, no I/O
- Module docstring states DATA-01 exclusivity, canonical labels, AHA source (heart.org + 2025 AHA/ACC guideline doi:10.1161/HYP.0000000000000249), and D-01..D-04 citations

## Pinned Conventions (consumed by 01-04, 01-05, 01-07, Phase 2)

| Item | Value |
|------|-------|
| BP labels | `"Hypotension"`, `"Normal"`, `"Elevated"`, `"Stage 1"`, `"Stage 2"`, `"Hypertensive Crisis"` |
| Pulse labels | `"Bradycardia"`, `"Normal"`, `"Tachycardia"` |
| MAP | `round((sbp + 2*dbp) / 3, 1)` — float, 1 decimal; diff with atol=0.05 |
| Pulse pressure | `sbp - dbp` — int |
| AM/PM | `"AM" if dt.hour < 12 else "PM"` — noon exactly is PM; naive datetimes only (DATA-05) |
| Hypotension gate | `sbp < 90 or dbp < 60`, checked BEFORE the ladder (200/55 → Hypotension) |
| Crisis | strictly `>180` systolic / `>120` diastolic |

## Task Commits

1. **Task 1: RED — failing boundary tests** - `f84a979` (test)
2. **Task 2: GREEN — implement app/derivations.py** - `e5227a3` (feat)

No REFACTOR commit — GREEN implementation was already clean (ordered severity list, private ladder helpers).

## Files Created/Modified

- `backend/app/derivations.py` - Five pure derivation functions + DATA-01 docstring (98 lines)
- `backend/tests/test_categories.py` - Parametrized BP (18 cases) + pulse (4 cases) boundary matrix
- `backend/tests/test_derivations.py` - MAP approx tests, pulse-pressure int test, 4 AM/PM boundaries with tzinfo-None assertion

## Decisions Made

- Canonical label strings and MAP rounding pinned per plan (see table above) — recorded here because 01-04/01-05/01-07 and Phase 2 consume them verbatim
- Severity-max implemented as `max(sys_cat, dia_cat, key=_SEVERITY.index)` over an ordered list — reproduces the AHA table's and/or logic exactly

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: `test(01-03):` commit f84a979 — suite failed (ModuleNotFoundError) before implementation
- GREEN gate: `feat(01-03):` commit e5227a3 — 29/29 pass; GREEN diff contains only `backend/app/derivations.py` (no test files)
- REFACTOR: not needed

## Issues Encountered

None. Fresh worktree required creating `backend/.venv` (Python 3.12, `pip install -e '.[dev]'`) before running pytest — environment setup, not a deviation.

## Known Stubs

None — module is complete for its purpose; no placeholders or hardcoded empty values.

## Threat Flags

None — pure in-process functions, no new trust boundaries. T-1-05 mitigation delivered: full boundary matrix committed before implementation. T-1-04 upheld: all test values are synthetic AHA-table literals, no real readings.

## Next Phase Readiness

- 01-04 (transform), 01-05 (sample generator), 01-07 (golden-master) can now `from app.derivations import ...` — nothing else may recompute categories
- Golden-master (01-07) must map CSV label spellings onto the canonical set above and diff MAP with atol=0.05

## Self-Check: PASSED

All 3 created files exist on disk; both task commits (f84a979, e5227a3) present in git history; full suite `pytest tests -q` green (29 passed).

---
*Phase: 01-data-foundation*
*Completed: 2026-07-09*
