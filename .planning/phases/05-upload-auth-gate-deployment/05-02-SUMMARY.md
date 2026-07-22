---
phase: 05-upload-auth-gate-deployment
plan: 02
subsystem: backend-auth
tags: [auth, security, itsdangerous, slowapi, config]
requires:
  - "verify_token router-level seam (Phase 2) + conftest no-op override (Plan 05-01)"
  - "slowapi limiter instance in app.routers.agent"
provides:
  - "Enforcing verify_token (itsdangerous signed Bearer, 401 not 403, non-expiring)"
  - "Ungated rate-limited POST /auth issuing the signed token"
  - "Settings.site_password / Settings.token_secret + DATABASE_URL psycopg3 normalizer"
  - "app.auth._serializer shared signer (dumps on issue, loads on verify)"
affects:
  - "backend/app/routers/upload.py (future gated route inherits the same gate)"
  - "frontend Bearer-header client (future plan consumes /auth token)"
tech-stack:
  added: ["itsdangerous 2.2 (URLSafeTimedSerializer)"]
  patterns: ["manual Authorization header parse -> 401", "hmac.compare_digest constant-time compare", "shared single slowapi limiter"]
key-files:
  created:
    - backend/app/routers/auth.py
    - backend/tests/test_auth_upload.py
  modified:
    - backend/app/config.py
    - backend/app/auth.py
    - backend/app/main.py
decisions:
  - "verify_token parses the header manually (not HTTPBearer) to return 401, never 403 (SC2/D-13, Pitfall 4)"
  - "loads() called with no max_age -> token never expires (D-02)"
  - "DATABASE_URL normalized postgresql:// -> postgresql+psycopg:// at one config point (covers app engine + Alembic, Pitfall 2)"
  - "/auth reuses the single agent-router limiter instance so app.state.limiter stays one object"
metrics:
  duration: "~15 min"
  completed: "2026-07-22"
  tasks: 3
  files: 5
---

# Phase 5 Plan 02: Auth Gate Enforcement Summary

Turned the auth seam live: `verify_token` now enforces an itsdangerous signed Bearer token (manual header parse returning 401, non-expiring), backed by an ungated rate-limited `POST /auth` password-check route and the config fields (`site_password`, `token_secret`) plus the two deployment gotchas (psycopg3 `DATABASE_URL` normalizer, CORS JSON-array env note). Full backend suite green (194 passed) with enforcement active.

## What Was Built

- **Task 1 — Settings extensions (`backend/app/config.py`):** added `site_password: str = ""` (keyless local/test boot) and `token_secret: str = "dev-insecure-secret"` (dev default; prod overrides). Added a `@field_validator("database_url")` `_use_psycopg3` classmethod rewriting a leading `postgresql://` to `postgresql+psycopg://` (one point fixes both the app engine and Alembic — Pitfall 2). Documented the `CORS_ORIGINS` JSON-array env-parsing requirement in a code comment (Pitfall 3). Commit `b552b2a`.
- **Task 2 — Enforcing `verify_token` (`backend/app/auth.py`):** replaced the no-op body with a manual `Authorization: Bearer` parse (missing/malformed → 401), added the module-level `_serializer()` helper (`URLSafeTimedSerializer(token_secret, salt="auth-gate")`) that `/auth` imports, and calls `loads()` with **no `max_age`** (D-02 non-expiring); `itsdangerous.BadData` → the same opaque 401. Deliberately not `HTTPBearer` (which returns 403). Commits `d23296b` + `19afcd5` (ruff format).
- **Task 3 — Ungated `/auth` route (`backend/app/routers/auth.py`, `backend/app/main.py`):** new `router` with `AuthRequest{password}`/`AuthResponse{token}`, `@router.post("/auth")` above `@limiter.limit("5/minute")` with `request: Request` first (slowapi order rules, Pitfall 5), reusing the single agent-router `limiter`. `hmac.compare_digest` constant-time compare (never `==`); issue via `_serializer().dumps("authorized")`; nothing about the candidate password is logged. Wired into `main.py` **without** `Depends(verify_token)` (ungated — it issues the token). Commit `c12089e`.

## Tests

New `backend/tests/test_auth_upload.py` exercises the **real** dependency via a local `real_gate_client` fixture (only `get_db` overridden, `verify_token` left live), separate from the conftest `client` fixture that disables the gate:

- config: new-field defaults, `postgresql://`→psycopg3 normalize, sqlite/already-normalized pass-through, `_serializer` sign/verify round-trip.
- verify_token: missing header → 401, non-`Bearer` header → 401, tampered token → 401, valid token → 200.
- /auth: correct password → token → gated `/readings` 200 (end-to-end); wrong password → 401; ungated reachability; 6th request/minute → 429.

Verification: `cd backend && .venv/bin/pytest -q` → **194 passed, 7 skipped**. The 3 pre-existing API test files stay green via the Plan 05-01 conftest override. `ruff check` clean on all touched files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ruff-format follow-up commit on `auth.py`**
- **Found during:** Task 3 (running `ruff format` before committing new files).
- **Issue:** `auth.py` (committed in Task 2) had an `HTTPException` call the formatter collapsed to one line; leaving it would fail a format hook and left the tree dirty.
- **Fix:** Applied `ruff format` and committed the whitespace-only change separately.
- **Files modified:** `backend/app/auth.py`
- **Commit:** `19afcd5`

Otherwise the plan executed as written.

## TDD Gate Compliance

This is a `type: execute` plan with `tdd="true"` tasks landing a single feature across three commits. Tests and implementation were committed together per task (config/serializer tests are RED-first in Task 1 and go green as Task 2 lands, exactly as the plan specifies). No standalone `test(...)` RED commit precedes each `feat(...)`; verification is by the passing suite at each step and the full green suite after Task 3. Threat mitigations T-05-01..T-05-05 (constant-time compare, signature verify, 401-not-403, no password logging) are all covered by named tests.

## Known Stubs

None — this plan replaces the last auth stub (`verify_token`) with a live implementation. (`/upload` remains a separate future plan, out of scope here.)

## Self-Check: PASSED

- Files created exist: `backend/app/routers/auth.py`, `backend/tests/test_auth_upload.py` — FOUND.
- Files modified exist: `backend/app/config.py`, `backend/app/auth.py`, `backend/app/main.py` — FOUND.
- Commits present: `b552b2a`, `d23296b`, `c12089e`, `19afcd5` — FOUND.
