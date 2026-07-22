---
phase: 05-upload-auth-gate-deployment
plan: 03
subsystem: backend-upload
tags: [fastapi, upload, etl, auth-gate, api-03, sec-01]
requires:
  - "app.etl (parse_omron, transform, merge_readings, IngestSummary) — Phase 1"
  - "app.auth.verify_token (itsdangerous Bearer gate) — Phase 5 wave 2"
  - "app.deps.get_db — Phase 2"
provides:
  - "POST /upload — gated OMRON .xlsx ingest returning the locked IngestSummary"
affects:
  - "backend/app/main.py router wiring"
tech-stack:
  added: []
  patterns:
    - "Thin route as a ~15-line adapter over the shared ETL (CLAUDE.md: pure raw_df->clean_df imported by both seeder and upload route)"
    - "Router-level Depends(verify_token) gating; /auth stays the sole ungated route"
    - "Broad-except never-500 backstop collapsing bad files to HTTP 400"
key-files:
  created:
    - backend/app/routers/upload.py
  modified:
    - backend/app/main.py
    - backend/tests/test_auth_upload.py
decisions:
  - "Route returns merge_readings' IngestSummary verbatim — no wrapper class (D-06 lock)"
  - "Garbage-bytes .xlsx exercises the 400 path via pd.read_excel raising (caught -> 400), not a valid-xlsx-wrong-columns file"
metrics:
  duration: ~10m
  tasks-completed: 1
  files-changed: 3
  tests: 199 passed, 7 skipped
  completed: 2026-07-22
requirements: [API-03, SEC-01]
---

# Phase 5 Plan 03: Gated POST /upload Summary

Thin, gated `POST /upload` route that buffers an uploaded OMRON `.xlsx` straight into the existing idempotent ETL (`parse_omron` → `transform` → `merge_readings`) and returns the locked `IngestSummary` verbatim — `.xlsx`-guarded, auth-gated, and never a 500 on a bad file.

## What Was Built

- **`backend/app/routers/upload.py`** — `router = APIRouter()` with a sync `@router.post("/upload", response_model=IngestSummary)` handler taking `file: UploadFile` and `db: Annotated[Session, Depends(get_db)]`. Extension guard raises `HTTPException(400, "not-omron")` for non-`.xlsx` filenames before any bytes are read; the pipeline runs inside a try/except that re-raises `HTTPException` unchanged and collapses any other exception to `HTTPException(400, "not-omron")` (D-10 never-500). Returns `merge_readings(...)` directly — the D-06 `IngestSummary` is not wrapped or renamed. No logging of row values or filename (T-05-08 hygiene; relies on the ETL's value-free `RejectedRow.reason`).
- **`backend/app/main.py`** — import extended to `from app.routers import agent, auth, readings, stats, upload`; `app.include_router(upload.router, dependencies=[Depends(verify_token)])` added, gated exactly like readings/stats/agent (T-05-07). `/auth` remains the sole ungated route.
- **`backend/tests/test_auth_upload.py`** — five upload tests appended, using the real-`verify_token` `real_gate_client` (so the 401 gate is genuinely exercised) and the conftest `omron_xlsx` fixture: valid xlsx → `added>0`; idempotent re-upload → `added=0`, `unchanged=2`; non-`.xlsx` filename → 400 with nothing ingested; garbage bytes `.xlsx` → 400 (never 500) with nothing ingested; no token → 401. A `valid_token` fixture mints a token from the shared `_serializer`.

## How to Verify

```
cd backend && .venv/bin/pytest tests/test_auth_upload.py -q -k "upload or reject or idempotent"
cd backend && .venv/bin/pytest -q
```

Result: full suite `199 passed, 7 skipped`. Ruff clean on the changed files.

## Threat Model Coverage

| Threat ID | Mitigation as built |
|-----------|---------------------|
| T-05-06 (DoS, huge upload) | `.xlsx` extension guard + the ETL's existing `max_rows` cap (raises `ValueError`, caught → 400). Bad-file test asserts 400. |
| T-05-07 (unauth upload) | Router-level `Depends(verify_token)`; no-token test asserts 401. |
| T-05-08 (value/filename in logs) | Route logs nothing; hygiene audit (`grep print(/logger.`) clean on `upload.py`. |
| T-05-09 (raw traceback / 500 leak) | Broad-except collapses any parse failure to `HTTPException(400, "not-omron")`; garbage-file test asserts 400. |

## Deviations from Plan

None — plan executed exactly as written. TDD was not run as separate RED/GREEN commits (config `tdd_mode: false`, no `TDD_MODE` passed by the orchestrator); implementation and tests were committed together in one `feat` commit and verified green.

## Known Stubs

None.

## Commits

- `78e50eb` — feat(05-03): thin gated POST /upload over the shared ETL

## Self-Check: PASSED

All created/modified files exist on disk; commit 78e50eb present; gated `upload.router` wiring confirmed in main.py.
