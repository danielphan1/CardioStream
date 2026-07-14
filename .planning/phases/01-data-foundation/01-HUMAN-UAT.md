---
status: partial
phase: 01-data-foundation
source: [01-VERIFICATION.md]
started: 2026-07-14T04:15:00Z
updated: 2026-07-14T04:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-data landing + golden master (DATA-04 / SC1)

expected: Place the real OMRON export (.xlsx) and `bp_data_cleaned.csv` into `data/`, run `cd backend && python -m alembic upgrade head && python -m app.seed`, then `python -m pytest tests/test_golden_master.py -v`. Seed summary reports added=132 (re-run: 0 added / 132 unchanged); golden-master diff passes on all six derived columns, or divergences are investigated and registered in `EXCLUDED_ROWS` per D-01. Note: minute-flooring (WR-03 fix) means second-precision datetimes in the real CSV go through the D-01 divergence process; pin `format=` per the FORMAT NOTE in etl.py when the real export lands.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
