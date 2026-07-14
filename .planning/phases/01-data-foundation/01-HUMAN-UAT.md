---
status: partial
phase: 01-data-foundation
source: [01-VERIFICATION.md]
started: 2026-07-14T04:15:00Z
updated: 2026-07-14T05:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-data landing + golden master (DATA-04 / SC1)

expected: Place the real OMRON export (.xlsx) and `bp_data_cleaned.csv` into `data/`, run `cd backend && python -m alembic upgrade head && python -m app.seed`, then `python -m pytest tests/test_golden_master.py -v`. Seed summary reports added=132 (re-run: 0 added / 132 unchanged); golden-master diff passes on all six derived columns, or divergences are investigated and registered in `EXCLUDED_ROWS` per D-01. Note: minute-flooring (WR-03 fix) means second-precision datetimes in the real CSV go through the D-01 divergence process; pin `format=` per the FORMAT NOTE in etl.py when the real export lands.
result: [partial — 2026-07-14] Real OMRON export landed in data/. Real format diverged from the assumed format (unit-suffixed headers 'Systolic (mmHg)', '-' placeholder notes) — all 132 rows initially rejected; fixed test-first in parse_omron (commits ddf62be RED, ba289d2 GREEN; suite 83 passed). Seed on fresh migrated DB: run 1 added=132 rejected=0 latest=2025-06-13 09:21; run 2 added=0 unchanged=132 (idempotency proven). All 6 BP categories present, range 2025-02-22 -> 2025-06-13. REMAINING: bp_data_cleaned.csv is not available (user confirmed 2026-07-14: "I don't have it") — golden-master diff blocked indefinitely (7 skipped). Derived-field correctness is covered instead by the 83-test suite (AHA/hypotension boundary matrix, MAP, AM/PM, pulse categories) plus category spot-checks on the seeded real data. The skipif-guarded test remains in place and will run automatically if the file ever lands.

## Summary

total: 1
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps
