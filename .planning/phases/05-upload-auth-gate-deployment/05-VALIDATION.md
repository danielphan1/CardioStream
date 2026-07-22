---
phase: 05
slug: upload-auth-gate-deployment
status: draft
nyquist_compliant: true
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
| 05-02 T2 | 05-02 | 2 | SEC-01 | T-05-04 | Real `verify_token` returns 401 without a valid Bearer token (missing/malformed/tampered → 401; valid → passes); never 403 | unit | `cd backend && .venv/bin/pytest tests/test_auth_upload.py -q -k "requires_token or valid_token or verify"` | ❌ W0 | ⬜ pending |
| 05-02 T3 | 05-02 | 2 | SEC-01 | T-05-01 | Ungated `/auth`: wrong password → 401, correct password → token → gated route 200; `5/minute` rate limit | unit | `cd backend && .venv/bin/pytest tests/test_auth_upload.py -q -k "auth or rate_limit"` | ❌ W0 | ⬜ pending |
| 05-03 T1 | 05-03 | 3 | API-03 | T-05-07 | `POST /upload` returns the locked IngestSummary; re-upload is a no-op; non-OMRON → 400; no token → 401 | unit | `cd backend && .venv/bin/pytest tests/test_auth_upload.py -q -k "upload or reject or idempotent"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs map to the generated PLAN.md tasks (`{phase}-{plan} T{task#}`). `File Exists ❌ W0` = `backend/tests/test_auth_upload.py` is created during Wave 0 / early execution, then extended by the mapped tasks. Status stays `pending` until Wave 0 runs.*

---

## Wave 0 Requirements

- [ ] `backend/tests/conftest.py` — override `verify_token` in the shared `client` fixture so existing gated-route tests (readings/stats/agent) keep passing once enforcement is live (Plan 05-01 Task 2)
- [ ] `backend/tests/test_auth_upload.py` — new tests for the real `verify_token` dependency (401 without token, 200 with valid token) and the `POST /upload` route (IngestSummary shape, idempotent re-upload, non-OMRON rejection) (started Plan 05-02 Task 1; extended by 05-02 T2/T3 and 05-03 T1)
- [ ] Add `itsdangerous`, `python-multipart`, `psycopg[binary]` to `backend/pyproject.toml` (Plan 05-01 Task 2)

*Existing pytest + vitest infrastructure covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Log in on the live site, view all charts, issue a voice/text command that updates the dashboard, upload a file | DEPL-02 | Voice / Web Speech API cannot be driven headlessly (Phase 4 precedent) | Follow the human smoke checklist against the deployed Vercel + Railway URLs (Plan 05-07 Task 2) |
| No analytics/trackers; DB not publicly reachable; platform logs contain no health values or transcripts | SEC-03 | Requires inspection of the live deployment, network panel, and platform log output | Inspect Vercel/Railway dashboards + browser network panel per D-14 checklist (Plan 05-07 Task 3) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist contract approved at plan time (map finalized against generated task IDs). Wave 0 executes at runtime — `wave_0_complete` stays `false` until then.
</content>
