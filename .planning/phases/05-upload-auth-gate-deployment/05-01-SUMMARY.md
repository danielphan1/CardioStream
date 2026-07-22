---
phase: 05-upload-auth-gate-deployment
plan: 01
subsystem: backend
tags: [dependencies, auth, testing, supply-chain]
requires: []
provides:
  - "itsdangerous, python-multipart, psycopg[binary] installed and importable in backend venv"
  - "client fixture verify_token no-op override (survives Plan 02 enforcement flip)"
affects:
  - "backend/pyproject.toml"
  - "backend/tests/conftest.py"
tech-stack:
  added:
    - "itsdangerous==2.2.* (signed-token password gate — Plan 02)"
    - "python-multipart==0.0.* (FastAPI UploadFile parsing — Plan 03)"
    - "psycopg[binary]==3.3.* (Railway Postgres driver — deployment)"
  patterns:
    - "app.dependency_overrides[verify_token] mirrors the established get_db override discipline in the client fixture"
key-files:
  created: []
  modified:
    - "backend/pyproject.toml"
    - "backend/tests/conftest.py"
decisions:
  - "Overrode verify_token to a no-op NOW (harmless while stub is still a no-op) so Plan 02's enforcement flip does not regress the readings/stats/agent suites"
  - "app/auth.py left untouched — the stub stays a no-op until Plan 02, per plan scope"
metrics:
  duration: "~4 min"
  completed: "2026-07-22"
  tasks: 2
  files-changed: 2
requirements: [SEC-01, API-03]
---

# Phase 5 Plan 01: Wave-0 Backend Dependency & Test Foundation Summary

Added the three CLAUDE.md-locked backend packages (`itsdangerous`, `python-multipart`, `psycopg[binary]`) and pre-empted Phase 5's highest-risk landmine by overriding `verify_token` to a no-op in the shared `client` fixture — so when Plan 02 flips the auth stub to real enforcement, the existing gated-route test suites stay green.

## What Was Built

- **Three new backend dependencies** pinned in `backend/pyproject.toml` `[project].dependencies`:
  - `itsdangerous==2.2.*` — signed timestamped tokens for the shared-password gate (Plan 02)
  - `python-multipart==0.0.*` — FastAPI `UploadFile` parsing for the file-upload route (Plan 03)
  - `psycopg[binary]==3.3.*` — current-generation Postgres driver for Railway deployment (SQLite dev needs no driver)
- **`client` fixture hardening** in `backend/tests/conftest.py`: added `from app.auth import verify_token` and `app.dependency_overrides[verify_token] = lambda: None`, mirroring the existing `get_db` override. This is harmless today (the stub is still a no-op) and is what keeps the `/readings`, `/stats`, and `/agent` test files green after Plan 02 flips the stub to real enforcement.

## Task Breakdown

| Task | Type | Outcome | Commit |
| ---- | ---- | ------- | ------ |
| 1 | checkpoint:human-verify (blocking-human) | Package legitimacy gate — all three packages pre-approved by human against canonical PyPI/GitHub sources and CLAUDE.md STACK; recorded as PASSED | (gate, no code) |
| 2 | auto | Added 3 deps, created worktree venv, `pip install -e .[dev]`, verified imports (`itsdangerous`, `multipart`, `psycopg`), overrode `verify_token`, ran full suite green | 90158e0 |

## Verification

- `python -c "import itsdangerous, multipart, psycopg"` exits 0 (note: PyPI distribution `python-multipart` imports as module `multipart`).
- `pyproject.toml` `[project].dependencies` contains `itsdangerous`, `python-multipart`, and `psycopg[binary]`.
- `backend/tests/conftest.py` contains `app.dependency_overrides[verify_token] = lambda: None` inside the `client` fixture.
- Full `pytest -q`: **181 passed, 7 skipped, 35 deselected** (live-marked). Existing suite unaffected.

## Deviations from Plan

**Environment note (not a deviation to plan intent):** The plan's verify step referenced "the existing venv," but `.venv/` is gitignored and therefore absent in this parallel worktree. Created a fresh `python3.12 -m venv .venv` in `backend/` and ran `pip install -e .[dev]` to validate the changes in isolation. The venv is gitignored and is not part of the commit — only `pyproject.toml` and `conftest.py` changed. No package substitution occurred; all three packages installed by their exact CLAUDE.md-named identifiers.

Otherwise the plan executed exactly as written. No Rule 1-4 deviations. `app/auth.py` was intentionally not touched (stub stays a no-op until Plan 02).

## Notes for Downstream Plans

- **Plan 02 (auth enforcement):** Flip `app/auth.py::verify_token` to itsdangerous signed-token verification. The `client` fixture override added here means the existing 3 API test files will not regress. Any NEW test that must assert real auth behavior should not use the `client` fixture (or should clear/re-set the override locally).
- **Plan 03 (upload):** `python-multipart` (module `multipart`) is installed and importable for `UploadFile`.
- **Deployment:** `psycopg[binary]` is installed for the `postgresql+psycopg://` Railway URL.

## Self-Check: PASSED

- FOUND: backend/pyproject.toml (contains itsdangerous, python-multipart, psycopg[binary])
- FOUND: backend/tests/conftest.py (contains verify_token override)
- FOUND: commit 90158e0
