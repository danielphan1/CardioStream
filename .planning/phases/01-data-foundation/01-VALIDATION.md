---
phase: 1
slug: data-foundation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
updated: 2026-07-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]` — created in plan 01-01 (Wave 1) |
| **Quick run command** | `cd backend && .venv/bin/python -m pytest tests -x -q` |
| **Full suite command** | `cd backend && .venv/bin/python -m pytest tests -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && .venv/bin/python -m pytest tests -x -q`
- **After every plan wave:** Run `cd backend && .venv/bin/python -m pytest tests -q` + `git status --porcelain | grep -c data/` must be 0
- **Before `/gsd-verify-work`:** Full suite must be green (golden-master executed, not skipped, on the dev machine)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | DATA-08 | T-1-01 | data/ invisible to git before real files land | smoke (CLI) | `git check-ignore -q data/probe.txt` after probe touch | ✅ CLI-only | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | DATA-08 | T-1-SC | only audited pinned packages installed | smoke (CLI) | venv import check (`python -c "import pandas, ...; from app.db import engine"`) | ✅ CLI-only | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | DATA-08 | T-1-01 | real files present locally, still ignored | checkpoint + CLI | `git status --porcelain \| grep -c 'data/'` == 0 | ✅ CLI-only | ⬜ pending |
| 01-02-T1 | 01-02 | 2 | DATA-03, DATA-05 | T-1-04 | duplicate datetime insert raises IntegrityError; naive DateTime | unit (inline) | model import + duplicate-insert script (see plan verify) | ✅ inline | ⬜ pending |
| 01-02-T2 | 01-02 | 2 | DATA-06 | T-1-03 | migration 0001 creates readings + named uq constraint | smoke | `DATABASE_URL=sqlite:////tmp/mig1.db alembic upgrade head` + inspect | ✅ CLI-only | ⬜ pending |
| 01-02-T3 | 01-02 | 2 | DATA-06 | T-1-03 | 4 tables from migrations match models | integration | `pytest tests/test_migrations.py -x -q` | ❌ created in-task | ⬜ pending |
| 01-03-T1 | 01-03 | 2 | DATA-02, DATA-07 | T-1-05 | boundary matrix committed RED | unit (RED) | `pytest tests/test_categories.py tests/test_derivations.py -q` (expect fail) | ❌ created in-task | ⬜ pending |
| 01-03-T2 | 01-03 | 2 | DATA-01, DATA-02 | T-1-05 | classifier green vs full matrix | unit (GREEN) | `pytest tests/test_categories.py tests/test_derivations.py -q` | ❌ created in-task | ⬜ pending |
| 01-04-T1 | 01-04 | 3 | DATA-01 | — | real format pinned (A1/A2 retired) | manual+fixtures | conftest fixture presence check | ❌ created in-task | ⬜ pending |
| 01-04-T2 | 01-04 | 3 | DATA-01, DATA-05 | T-1-06 | naive datetimes, coerce fallback, max_rows guard | unit | `pytest tests/test_etl.py -q -k parse` | ❌ created in-task | ⬜ pending |
| 01-04-T3 | 01-04 | 3 | DATA-01, DATA-07 | T-1-07, T-1-04 | D-07 dedupe surfaced, D-08 reject w/ hygienic reasons | unit | `pytest tests/test_etl.py tests/test_categories.py tests/test_derivations.py -q` | ❌ created in-task | ⬜ pending |
| 01-05-T1 | 01-05 | 3 | DATA-08 | T-1-01 | generator never reads data/; deterministic | smoke | double-run hash compare + script run | ✅ CLI-only | ⬜ pending |
| 01-05-T2 | 01-05 | 3 | DATA-08 | T-1-01 | sample committed, character pinned | unit | `pytest tests/test_sample.py -x -q` + `git ls-files --error-unmatch` | ❌ created in-task | ⬜ pending |
| 01-06-T1 | 01-06 | 4 | DATA-03 | T-1-09 | D-05 upsert + D-06 counts, one transaction | integration | `pytest tests/test_idempotency.py -q` (subset) | ❌ created in-task | ⬜ pending |
| 01-06-T2 | 01-06 | 4 | DATA-03, DATA-05, DATA-07 | T-1-09 | double-ingest zero rows; constraint backstop; naive round-trip | integration | `pytest tests/test_idempotency.py -x -q` | ❌ created in-task | ⬜ pending |
| 01-07-T1 | 01-07 | 5 | DATA-04 | T-1-04 | seed twice → count unchanged; no PHI in stdout | smoke | `alembic upgrade head && python -m app.seed` ×2 + count assert | ✅ CLI-only | ⬜ pending |
| 01-07-T2 | 01-07 | 5 | DATA-01, DATA-04 | T-1-09 | derived cols match golden master (D-01 protocol) | integration (skipif) | `pytest tests/test_golden_master.py -v -q` | ❌ created in-task | ⬜ pending |
| 01-07-T3 | 01-07 | 5 | DATA-08 | T-1-01 | full history free of data/ paths | smoke | `git log --all --name-only` grep audit | ✅ CLI-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Covered inside the plans themselves (greenfield — infra and tests are created in-task, each with an `<automated>` verify):

- [x] `backend/pyproject.toml` + pytest install → plan 01-01 Task 2 (Wave 1, before any test-bearing plan)
- [x] `backend/tests/__init__.py` scaffold → plan 01-01 Task 2
- [x] `backend/tests/conftest.py` (sample/df fixtures) → plan 01-04 Task 1; DB fixtures → plan 01-06 Task 1
- [x] `tests/test_categories.py`, `test_derivations.py` → plan 01-03 (RED-first)
- [x] `tests/test_etl.py` → plan 01-04; `tests/test_idempotency.py` → plan 01-06; `tests/test_migrations.py` → plan 01-02; `tests/test_sample.py` → plan 01-05; `tests/test_golden_master.py` → plan 01-07

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real data files landed in data/ | DATA-04, D-13 | Claude cannot obtain Chris's health data | Plan 01-01 Task 3 checkpoint (human-action); reply "done"/"skip" |
| Real files never entered git history | DATA-08 | Final human-visible audit of full history | Plan 01-07 Task 3: `git log --all --name-only` grep audit — automated command, human reviews SUMMARY evidence |
| Golden-master executed (not skipped) | DATA-01, DATA-04 | Depends on gitignored local files | Plan 01-07 Task 2: confirm pytest -v shows PASSED, not SKIPPED, on the dev machine |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests created in-plan, RED-first where TDD)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-populated 2026-07-08; execute-phase updates Status column per task
