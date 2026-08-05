---
phase: 05-upload-auth-gate-deployment
plan: 07
subsystem: infra
tags: [smoke-test, curl, auth-gate, railway, vercel, privacy, sec-03, depl-02]

# Dependency graph
requires:
  - phase: 05-upload-auth-gate-deployment (05-06)
    provides: live Railway backend + Vercel frontend, SITE_PASSWORD/TOKEN_SECRET/ANTHROPIC_API_KEY env, private Postgres
provides:
  - Automated live smoke test (scripts/smoke.sh) proving 401-on-every-route + auth round-trip
  - Ungated /health agent_configured probe for diagnosing keyless deploys (deviation)
  - Signed-off DEPL-02 live-site walkthrough and SEC-03 privacy audit
affects: [milestone-v1.0-close, future-deploy-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [live-smoke-curl-with-real-methods, ungated-boolean-health-probe]

key-files:
  created:
    - scripts/smoke.sh
    - backend/tests/test_health.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Each route curled with its REAL method (verify_token is router-level; a method mismatch 405s before the gate)"
  - "Secrets read from env, never argv/logs; password piped via a request-body file so it never appears in process args"
  - "Added an ungated /health {status, agent_configured} boolean probe (deviation) to diagnose a keyless live agent without shell access"

patterns-established:
  - "Live smoke: assert 401 on every gated route (real method) + wrong-pw 401 + correct-pw→token→200"
  - "Health probe returns booleans only — never the key or any part of it (SEC-02)"

requirements-completed: [DEPL-02, SEC-03]

# Metrics
duration: multi-session (human-verify gated)
completed: 2026-08-05
---

# Phase 5: Upload / Auth Gate / Deployment — Plan 07 Summary

**Live MVP verified private and working: automated curl smoke proves the auth gate on every route, the human live-site flow passes, and the SEC-03 audit confirms no trackers, a private DB, and clean logs — closing milestone v1.0.**

## Performance

- **Duration:** multi-session (Task 1 committed 2026-07-23; diagnostic deviation 2026-08-02; human-verify checkpoints signed off 2026-08-04 → 2026-08-05)
- **Tasks:** 3 (1 auto + 2 blocking human-verify)
- **Files modified:** 3

## Accomplishments
- **`scripts/smoke.sh`** — automated live smoke test. Verified **PASS** against the live Railway URL: `GET /readings`, `GET /stats/summary`, `POST /agent`, `POST /upload` each return **401** without a token (curled with their real methods); wrong password → 401; correct password → token → `GET /readings` **200**.
- **DEPL-02 live-site walkthrough** signed off: login gate → all four charts → a command updates the dashboard → sample upload + idempotent re-upload → logout.
- **SEC-03 privacy audit** signed off: **no third-party trackers** (static bundle sweep + live DevTools Network panel), **Postgres not publicly reachable** (Railway private networking, no TCP proxy), and **clean platform logs** (no BP/pulse values, transcripts, passwords, or tokens after exercising login + command + upload-with-a-rejected-row).

## Task Commits

1. **Task 1: scripts/smoke.sh — 401 on every route + auth round-trip** — `39b3449` (test)
2. **Deviation: ungated /health agent_configured probe** — `658cb4f` (feat)
3. **Task 2 (DEPL-02) & Task 3 (SEC-03)** — blocking human-verify checkpoints; no code, signed off by the user

## Files Created/Modified
- `scripts/smoke.sh` — automated curl smoke test (real-method 401s + auth round-trip); reads BASE + SITE_PASSWORD from env, logs no secrets
- `backend/app/main.py` — added ungated `GET /health` → `{status, agent_configured}` (booleans only)
- `backend/tests/test_health.py` — 3 tests for the health probe (full suite green: 202 passed)

## Decisions Made
- Curl each route with its **real** HTTP method — `verify_token` is a router-level dependency, so a method mismatch returns 405 *before* the gate, masking the 401 the check is meant to prove.
- Password is piped through a request-body file (never argv), and the script echoes no secret values — so a live run is safe to paste into logs/CI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking — unblock DEPL-02] Added an ungated `/health` agent_configured probe**
- **Found during:** DEPL-02 verification (the "issue a command that updates the dashboard" step)
- **Issue:** The live agent was **keyless** — the running Railway container had read an empty `ANTHROPIC_API_KEY` at boot (config caches settings at import), so `/agent` degraded to "assistant isn't connected." There was no way to confirm the key state without shell access.
- **Fix:** Added `GET /health` returning `{status, agent_configured}`, where `agent_configured` mirrors the agent's own key gate (True iff a non-empty key was read at boot). Boolean only — never the key or any part of it (SEC-02).
- **Files modified:** `backend/app/main.py`, `backend/tests/test_health.py`
- **Verification:** 3 new tests; full suite green (202 passed). Live probe now returns `{"status":"ok","agent_configured":true}` after the key was set on Railway and the service redeployed.
- **Committed in:** `658cb4f`

---

**Total deviations:** 1 (diagnostic feature added to unblock the DEPL-02 command step)
**Impact on plan:** Scope-adjacent and load-bearing — it surfaced and confirmed the fix for the keyless-agent production blocker. No scope creep beyond the diagnostic.

## Issues Encountered
- **Keyless live agent** (above) — resolved by setting `ANTHROPIC_API_KEY` on Railway and redeploying; confirmed via the `/health` probe.
- **Wrong SITE_PASSWORD on first smoke run** — the first value supplied returned a clean `401` (auth gate working correctly); the correct Railway value produced the full `PASS`.

## User Setup Required
None new. Live env vars (`SITE_PASSWORD`, `TOKEN_SECRET`, `ANTHROPIC_API_KEY`, `CORS_ORIGINS`, `DATABASE_URL`) were set on Railway in Plan 06; this plan verified them.

## Next Phase Readiness
- **Milestone v1.0 is complete** — Phase 5 of 5 done, 29/29 plans. Threats **T-05-20** (auth gate on every route) and **T-05-21** (no trackers / private DB / clean logs) mitigated and verified on the live deployment.
- Ready for `/gsd-complete-milestone` (archive v1.0) and any post-MVP work from PROJECT.md "Out of Scope" (voice replies, data entry by voice, labs/incidents/procedures views).

---
*Phase: 05-upload-auth-gate-deployment*
*Completed: 2026-08-05*
