---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 03
subsystem: testing
tags: [synthetic-data, fixtures, pytest, demo-mode]

# Dependency graph
requires: []
provides:
  - "backend/scripts/generate_demo_records.py — seeded-deterministic generator producing labs/incidents/procedures synthetic demo data"
  - "backend/sample_data/demo_records.json — committed synthetic fixture (8 labs, 5 incidents, 5 procedures)"
  - "backend/tests/test_demo_records_sample.py — character-pinning regression suite"
affects: [19-guest-demo-seeding, guest-demo-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seeded random.Random(SEED) generator mirroring generate_sample.py's discipline (never the global random module state), applied to plain-JSON POST-body-shaped data instead of xlsx"

key-files:
  created:
    - backend/scripts/generate_demo_records.py
    - backend/sample_data/demo_records.json
    - backend/tests/test_demo_records_sample.py
  modified: []

key-decisions:
  - "SEED=20250915 (distinct from generate_sample.py's 20250222) so the two generators are visibly independent"
  - "Hand-picked LAB_DEFS/INCIDENT_DEFS/PROCEDURE_DEFS (test_name/incident_type/outcome + realistic reference ranges), with RNG driving dates, in-range vs out-of-range value selection, and row shuffling — guarantees deterministic field-diversity coverage rather than relying on probabilistic RNG draws to hit it"
  - "No pandas/openpyxl import — labs/incidents/procedures are POST-body-shaped (LabResultCreate/IncidentCreate/ProcedureCreate), never spreadsheet-shaped, so output is plain json.dump, not an xlsx writer"

patterns-established:
  - "Deterministic-fixture-generator pattern: one generate_rows() entry point + assert_character() self-check + main() writing via json.dump(..., default=str), directly reusable for any future synthetic-JSON fixture"

requirements-completed: [D-05, D-06]

# Metrics
duration: 12min
completed: 2026-09-16
---

# Phase 19 Plan 03: Synthetic Demo Records Generator Summary

**Seeded-deterministic generator + committed JSON fixture producing synthetic labs/incidents/procedures data (8/5/5 rows), pinned by a 6-test character-regression suite mirroring `test_sample.py`'s structure.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-16T07:42:00Z
- **Completed:** 2026-09-16T07:54:01Z
- **Tasks:** 2 completed
- **Files modified:** 3 (all created)

## Accomplishments
- `backend/scripts/generate_demo_records.py` generates 8 lab rows (4 distinct `test_name` values, each with a guaranteed in-range AND out-of-range result), 5 incidents (3 distinct `incident_type` values), and 5 procedures (2 distinct `outcome` values) — all deterministic under `SEED=20250915`, verified byte-identical across reruns
- `backend/sample_data/demo_records.json` committed, giving both the hosted guest demo and any local clone a fully populated dashboard across all four data types (readings already had `generate_sample.py`; labs/incidents/procedures previously had none)
- `backend/tests/test_demo_records_sample.py` — 6 one-assertion tests pin table presence, non-emptiness, and field-value diversity; all green

## Task Commits

Each task was committed atomically:

1. **Task 1: generate_demo_records.py — seeded generator** - `fe75a87` (feat)
2. **Task 2: Commit demo_records.json + character-pinning regression test** - `908f1d6` (test)

**Plan metadata:** (pending — committed by orchestrator after wave completion, per worktree isolation)

## Files Created/Modified
- `backend/scripts/generate_demo_records.py` - Seeded generator producing `{"labs": [...], "incidents": [...], "procedures": [...]}`, mirroring `generate_sample.py`'s determinism discipline
- `backend/sample_data/demo_records.json` - Committed synthetic fixture: 8 labs / 5 incidents / 5 procedures, dates within the existing readings sample's span (2025-02-22 to 2025-06-13)
- `backend/tests/test_demo_records_sample.py` - 6-test character-regression suite (table presence, non-emptiness, field diversity, in-range/out-of-range lab coverage)

## Decisions Made
- Guaranteed field-diversity and in-range/out-of-range coverage via explicit hand-picked definition tables (`LAB_DEFS`/`INCIDENT_DEFS`/`PROCEDURE_DEFS`) rather than relying on RNG probability to hit the `assert_character` thresholds by chance — matches `generate_sample.py`'s own hand-picked-edge-rows discipline (`EDGE_BP_ROWS`) rather than inventing a new pattern.
- `_draw_out_of_range` scales its delta to each lab's own `(range_high - range_low)` span and clamps to avoid negative results (e.g. TSH's low bound), rather than using a fixed offset that could produce physiologically nonsensical or accidentally in-range values for a narrow-range test.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Confirmed via the STATE.md-documented worktree pitfall (fresh worktree lacks `.venv`/`backend/.env`, and the main repo's editable `app` install can shadow worktree source) that this plan's files have zero dependency on the `app` package — the generator and test both use only `json`/`random`/stdlib `pathlib`, so pytest was run against the main repo's `.venv` (which has `pytest` installed; the worktree's default `python3` does not) with no risk of executing stale `app` source, since no `app` import occurs anywhere in this plan's new files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `backend/sample_data/demo_records.json` is ready to be wired into the guest-demo seeding path by a later plan in this phase (D-05/D-06 satisfied at the fixture level; seeding/loading into the demo DB is out of this plan's scope).
- No blockers.

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*
