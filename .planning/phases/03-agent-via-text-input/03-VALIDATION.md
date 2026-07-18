---
phase: 3
slug: agent-via-text-input
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x (backend), vitest 4.x (frontend) |
| **Config file** | backend/pyproject.toml, frontend/vite.config.ts |
| **Quick run command** | `cd backend && pytest -m "not live" -q` / `cd frontend && npx vitest run` |
| **Full suite command** | `cd backend && pytest -m "not live"` && `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the affected side (backend pytest / frontend vitest)
- **After every plan wave:** Run both full suite commands
- **Before `/gsd-verify-work`:** Full suite must be green; live fixture suite (`pytest -m live`) run once with a real key as phase-gate evidence
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by planner)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_agent_*.py` — stubs for API-04, API-05, VOICE-06–09
- [ ] Dependency-injected interpreter fixture (mirrors existing `get_db` override in `backend/tests/conftest.py`) so route tests never hit the live API
- [ ] `@pytest.mark.live` marker registered; default runs exclude it (`-m "not live"`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live fixture suite (~30 utterances incl. garbled) against real Claude | API-04, VOICE-07, VOICE-09 | Needs ANTHROPIC_API_KEY (not in env); non-deterministic model output | Set key in backend/.env, run `pytest -m live`, review pass rate |
| Command bar UX (working state, confirmation, pulse highlight) | VOICE-06, VOICE-08 | Visual/interaction quality | Type commands in dev server, observe bar states and filter highlights |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
