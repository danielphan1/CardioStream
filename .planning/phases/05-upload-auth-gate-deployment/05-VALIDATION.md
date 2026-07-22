---
phase: 05
slug: upload-auth-gate-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x (backend) / vitest 4.x (frontend) |
| **Config file** | backend `pyproject.toml` / frontend `vitest.config.ts` |
| **Quick run command** | `cd backend && pytest -q` |
| **Full suite command** | `cd backend && pytest && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest -q`
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | SEC-01 | T-05-01 | Every gated route returns 401 without a valid Bearer token | unit | `cd backend && pytest tests/test_auth_upload.py -q` | ❌ W0 | ⬜ pending |
| TBD | — | — | API-03 | — | `POST /upload` returns locked IngestSummary; re-upload is a no-op | unit | `cd backend && pytest tests/test_auth_upload.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*This map is finalized by the planner/executor against the generated PLAN.md task IDs.*

---

## Wave 0 Requirements

- [ ] `backend/tests/conftest.py` — override `verify_token` in the shared `client` fixture so existing gated-route tests (readings/stats/agent) keep passing once enforcement is live
- [ ] `backend/tests/test_auth_upload.py` — new tests for the real `verify_token` dependency (401 without token, 200 with valid token) and the `POST /upload` route (IngestSummary shape, idempotent re-upload, non-OMRON rejection)
- [ ] Add `itsdangerous`, `python-multipart`, `psycopg[binary]` to `backend/pyproject.toml`

*Existing pytest + vitest infrastructure covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Log in on the live site, view all charts, issue a voice/text command that updates the dashboard, upload a file | DEPL-02 | Voice / Web Speech API cannot be driven headlessly (Phase 4 precedent) | Follow the human smoke checklist against the deployed Vercel + Railway URLs |
| No analytics/trackers; DB not publicly reachable; platform logs contain no health values or transcripts | SEC-03 | Requires inspection of the live deployment, network panel, and platform log output | Inspect Vercel/Railway dashboards + browser network panel per D-14 checklist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
