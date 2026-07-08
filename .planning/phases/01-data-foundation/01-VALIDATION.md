---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pytest -x -q` |
| **Full suite command** | `pytest -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest -x -q`
- **After every plan wave:** Run `pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (populated by planner) | — | — | DATA-01..08 | — | — | unit | `pytest -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_derivations.py` — stubs for BP category, pulse category, MAP, AM/PM (DATA-04, DATA-05)
- [ ] `tests/test_ingest.py` — stubs for idempotency / duplicate-proof ingest (DATA-03, DATA-06)
- [ ] `tests/conftest.py` — shared fixtures (synthetic sample data)
- [ ] `pytest` install — no framework detected in repo yet

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real data files absent from git | DATA-08 | Requires human confirmation that gitignored real files never entered history | `git log --all --name-only \| grep -i` real filenames; inspect `.gitignore` |
| Golden-master diff vs `bp_data_cleaned.csv` | DATA-01 | Depends on real data files landing locally (not in repo); test auto-skips when absent | Place real files in `data/`, run `pytest -q` and confirm golden-master test executed (not skipped) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
