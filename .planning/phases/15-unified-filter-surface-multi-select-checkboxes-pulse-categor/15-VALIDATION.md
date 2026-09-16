---
phase: 15
slug: unified-filter-surface-multi-select-checkboxes-pulse-categor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: pytest 9.x (`backend/pyproject.toml`, `-m 'not live'` default) · Frontend: Vitest 4.x (`frontend/package.json`, use `--run` for non-interactive) |
| **Config file** | `backend/pyproject.toml`, `frontend/vite.config.ts` |
| **Quick run command** | Backend: `cd backend && pytest tests/test_api_readings.py tests/test_categories.py -x` · Frontend: `cd frontend && npx vitest run src/store/filters.test.ts src/lib/agent.test.ts` |
| **Full suite command** | Backend: `cd backend && pytest` · Frontend: `cd frontend && npm test -- --run` |
| **Estimated runtime** | ~30s backend, ~20s frontend (existing suite sizes) |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick-run command scoped to the file(s) touched.
- **After every plan wave:** Run both full suites (`pytest` + `npm test -- --run`).
- **Before `/gsd-verify-work`:** Full suite must be green, plus a manual accessibility spot-check (no automated Recharts a11y test exists in this suite — colored-chip checkboxes for BP/Pulse Category need a keyboard-nav/contrast confirm per CLAUDE.md's non-negotiable floor).
- **Max feedback latency:** ~30s (existing suite sizes; no new slow infra introduced).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-TBD | TBD | TBD | PH15-01 | V5 | FilterBar AM/PM(dropped)/BP Category render as checkboxes, multi-select | component/unit | `npx vitest run src/components/FilterBar.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-02 | V5 | `pulse_category` filters `/readings`/`/stats/summary` via `IN` | integration | `pytest tests/test_api_readings.py -k pulse_category -x` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-03 | — | `time_of_day` boundary function classifies hours correctly, including midnight wrap | unit | `pytest tests/test_derivations.py -k time_of_day -x` (placement per planner) | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-03b | V5 | `time_of_day` query filter returns correct rows across the midnight boundary | integration | `pytest tests/test_api_readings.py -k time_of_day -x` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-04 | — | v2→v3 localStorage migration preserves a single prior BP-category selection (no `amPm` migration needed — dropped per resolved Open Question 1) | unit | `npx vitest run src/store/filters.test.ts -t "v2 → v3"` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-05 | V5 | Empty selection in any filter group == no restriction (zero-or-all); empty list must NOT compile to always-false `.in_([])` | integration | `pytest tests/test_api_readings.py -k empty_selection -x` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-05b | V5 | `IN` clause with 2+ values ORs correctly within a group | integration | `pytest tests/test_api_readings.py -k combine -x` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-06 | V5 | Agent schema accepts list-typed `bp_category`/`pulse_category`/`time_of_day`, case-insensitive | unit | `pytest tests/test_agent_schemas.py -k bp_category -x` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-07 | — | `composeConfirmation` produces grammatically correct multi-select suffixes | unit | `npx vitest run src/lib/agent.test.ts -t composeConfirmation` | ❌ Wave 0 | ⬜ pending |
| 15-TBD | TBD | TBD | PH15-08 | V5 | Omitted `list[X] \| None` query param resolves to `None` (all), not `[]` (none) — first regression test for the IN-clause conversion, per Research Open Question 3 | integration | `pytest tests/test_api_readings.py -k no_param_returns_all -x` | ❌ Wave 0 | ⬜ pending |

*Task IDs/plan/wave columns are TBD — filled in by the planner once tasks are assigned to plans/waves.*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/FilterBar.test.tsx` — does not exist today; `FilterBar.tsx` is currently only exercised indirectly via `smoke.test.tsx`. This phase rewrites most of the component's interactive surface, so direct component tests are warranted.
- [ ] Backend time-of-day boundary unit tests — new coverage; exact file placement (sibling to `derivations.py` vs. inline in `deps.py`'s test file) is a plan-time decision (Research Focus Answer 5).
- [ ] `test_api_readings.py` extensions for `IN`-clause OR-within-group, empty-selection-means-all, and midnight-wrap time-of-day behavior — no framework gap, just new test cases extending existing patterns.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Colored-chip checkbox keyboard nav + contrast (BP Category, Pulse Category) | Accessibility floor (CLAUDE.md) | No automated Recharts/chip a11y test exists in this suite | Tab through FilterBar in both themes; confirm visible focus ring and ≥3:1 contrast on chip fill vs. background per existing `contrast.test.ts` convention |
| Voice round-trip for new `pulse_category`/`time_of_day` tokens | AGENT-01 (no live API credits) | Agent is inert in production; cannot be exercised against a real model this session | Re-run once billing is funded — add to the existing 43-fixture eval backlog per STATE.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
