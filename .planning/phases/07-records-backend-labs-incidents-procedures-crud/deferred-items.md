# Deferred Items — Phase 07 Plan 01

Out-of-scope discoveries logged during execution (not fixed, per deviation-rules scope boundary).

## 1. Pre-existing ruff-format violation in `backend/app/main.py`

- **Found during:** Task 2 verification (`ruff format --check`)
- **Detail:** `ruff format --diff app/main.py` wants a blank line inserted before `@app.get("/health")` (missing second blank line between the CORS `add_middleware(...)` call and the `/health` route decorator). This formatting gap predates this plan's edits — `git diff app/main.py` confirms the two hunks this plan touched (the router import line and the three new `include_router` calls) are unrelated to the flagged line.
- **Action taken:** None — out of scope for this plan (scope boundary: only fix issues directly caused by this task's changes). `ruff check` (lint) passes cleanly; only `ruff format` (whitespace) flags it.
- **Recommendation:** A future formatting-only pass (or the next plan touching `main.py`) can run `ruff format app/main.py` to fix it.
