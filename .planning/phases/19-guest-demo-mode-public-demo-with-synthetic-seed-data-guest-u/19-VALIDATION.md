---
phase: 19
slug: guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
status: reviewed
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-15
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 9.x (`backend/pyproject.toml` `[tool.pytest.ini_options]`, `testpaths = ["tests"]`) |
| **Framework (frontend)** | Vitest 4.x (`frontend/vite.config.ts` `test: {...}`, jsdom environment) |
| **Config file** | `backend/pyproject.toml` / `frontend/vite.config.ts` — both already configured, no Wave 0 install needed |
| **Quick run command (backend)** | `cd backend && python -m pytest tests -q -k "demo or auth or health"` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run src/components/LoginGate.test.tsx src/components/Header.test.tsx` |
| **Full suite command (backend)** | `cd backend && python -m pytest tests -q` |
| **Full suite command (frontend)** | `cd frontend && npx vitest run && tsc -b --noEmit` |
| **Estimated runtime** | ~20s backend, ~15s frontend |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick-run command above (backend `-k` filter or frontend targeted file).
- **After every plan wave:** Run both full suite commands, including `tsc -b --noEmit` explicitly — Pitfall 2 (a `HealthStatus` type change breaking existing mocks) is a compile-time failure, not a test failure, so `vitest run` alone will not catch it.
- **Before `/gsd-verify-work`:** Full suite must be green both sides. The live Railway/Vercel second-deployment steps themselves are `human_needed` (no CLI access in this environment to verify a real deploy) — flag this explicitly in plan verification sections rather than silently skipping it.
- **Max feedback latency:** ~35 seconds (backend + frontend full suites combined)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1 | 19-02 | 2 | D-03 | write-guard | 4 write routes (`POST /upload`, `/labs`, `/incidents`, `/procedures`) 403 on demo deployment; GET routes + `/agent` unaffected | integration | `pytest tests/test_demo_guard.py -x` | ✅ created | ✅ done |
| Task 1 | 19-02 | 2 | D-03 (ordering) | write-guard | No-token write on demo deployment → 401, not 403 (guard must not leak "demo" state ahead of auth) | integration | `pytest tests/test_demo_guard.py::test_missing_token_still_401_on_demo -x` | ✅ created | ✅ done |
| Task 2 | 19-01 | 1 | auth mechanism | credential-compare | `/auth` requires username when `site_username` set; wrong/missing username → same opaque 401 as wrong password (D-10) | integration, fail-first (D-11) | `pytest tests/test_auth_upload.py -x` (extend) | ✅ extended | ✅ done |
| Task 3 | 19-01 | 1 | auth mechanism | info-leak | `/health` reports `demo: bool(site_username)`, never leaks the literal username/password value (D-10 `hide_input_in_errors`) | unit | `pytest tests/test_health.py -x` (extend) | ✅ extended | ✅ done |
| Task 2 | 19-03 | 1 | D-05/D-06 | — | Committed `demo_records.json` covers realistic field shapes for labs/incidents/procedures, deterministic regen (seeded RNG, byte-identical) | unit, character-pinning | `pytest tests/test_demo_records_sample.py -x` | ✅ created | ✅ done |
| Task 1 | 19-04 | 2 | boot-time seed | idempotency | `seed_records()` skips tables that already have rows — safe to run on every boot; `python -m app.seed` (the actual entry point) populates all four tables end-to-end | unit, integration (subprocess) | `pytest tests/test_seed.py -x` | ✅ created | ✅ done |
| Task 2 | 19-06 | 2 | D-04 | UI hide | Header hides Upload/Add Record buttons and shows the demo badge when `demoMode` is true; unchanged when false | component | `npx vitest run src/components/Header.test.tsx` | ✅ created | ✅ done |
| Task 1 | 19-06 | 2 | D-04 / UI-SPEC | UI reveal | LoginGate shows username field + demo copy when `demoMode`; byte-identical to current behavior when not | component | `npx vitest run src/components/LoginGate.test.tsx` (extend) | ✅ extended | ✅ done |
| Task 1 | 19-06 | 2 | Pitfall 5 | data-scope | Pre-auth `/health` fetch never expands to a PHI-bearing route | component, fail-first (D-11) | `npx vitest run src/components/LoginGate.test.tsx -t "no data leak"` | ✅ extended | ✅ done |
| Task 1/2 | 19-05 | 1 | Pitfall 2 | type-safety | `HealthStatus` type change (`demo: boolean`) doesn't silently break existing test mocks | type-check | `cd frontend && tsc -b --noEmit` | ✅ existing config | ✅ done |

*Task ID / Plan / Wave columns are populated from the finalized PLAN.md files — the Requirement → Command mapping above was pre-populated from RESEARCH.md so plan authors did not have to re-derive it.*

---

## Wave 0 Requirements

- [x] `backend/tests/test_demo_guard.py` — write-route 403 coverage + auth-ordering assertion (401 before 403); created by Plan 19-02
- [x] `backend/tests/test_demo_records_sample.py` — mirrors `test_sample.py`'s character-pinning pattern for the new `demo_records.json` fixture; created by Plan 19-03
- [x] `backend/tests/test_seed.py` — did not exist before this phase; needs at least `seed_records()` idempotency covered (no framework install needed, pytest already configured); created by Plan 19-04
- [x] `frontend/src/components/Header.test.tsx` — did not exist before this phase; needs badge + hidden-buttons coverage; created by Plan 19-06
- [x] `backend/sample_data/demo_records.json` — not a test file, but a Wave 0 prerequisite fixture for `test_demo_records_sample.py` and `test_seed.py` alike; created by Plan 19-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Second Railway backend service + second Vercel frontend project stood up and reachable, each pointed at its own fresh demo Postgres DB | D-01, D-02 | No Railway/Vercel CLI access in this environment — the phase delivers code + config + literal instructions, not a live deployment | Follow the deploy instructions produced by this phase in both dashboards; confirm the demo URL loads, logs in with guest credentials, and that write actions 403 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING (❌) references above
- [x] No watch-mode flags
- [x] Feedback latency < 35s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-09-16
