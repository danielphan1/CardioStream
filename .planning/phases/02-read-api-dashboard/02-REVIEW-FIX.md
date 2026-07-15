---
phase: 02-read-api-dashboard
fixed_at: 2026-07-15T08:26:00Z
review_path: .planning/phases/02-read-api-dashboard/02-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-07-15T08:26:00Z
**Source review:** .planning/phases/02-read-api-dashboard/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (fix_scope: critical_warning — IN-01 through IN-06 out of scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `end_date=9999-12-31` causes unhandled OverflowError → 500 on both endpoints

**Files modified:** `backend/app/deps.py`, `backend/tests/test_api_readings.py`, `backend/tests/test_api_stats.py`
**Commit:** 4552448
**Applied fix:** Replaced `end_date + timedelta(days=1)` with an end-of-day comparison (`Reading.datetime_ <= datetime.combine(self.end_date, datetime.max.time())`), which preserves inclusive end-date semantics (stored readings have second precision) and cannot overflow at `date.max`. Removed the now-unused `timedelta` import and updated the pinned-invariant docstring. Added regression tests hitting both endpoints with `end_date=9999-12-31` expecting 200 (`test_end_date_at_date_max_returns_200` in both test files). Full backend suite: 115 passed, 7 skipped — including the pre-existing Pitfall-4 inclusive-boundary test (23:15 reading ON end_date still kept).

### WR-02: Network failures bypass the `ApiError` contract in the API client

**Files modified:** `frontend/src/api/client.ts`
**Commit:** 1410c76
**Applied fix:** Wrapped `fetch` in try/catch throwing `ApiError(0, path)` for network/CORS failures (status 0 sentinel), and wrapped `res.json()` in try/catch throwing `ApiError(res.status, path)` for 2xx responses with unparseable bodies. All failure modes now honor the module's `instanceof ApiError` contract. Verified with `tsc -b` (clean) and vitest (1 passed).

### WR-03: Unguarded `localStorage` access at bootstrap can blank the entire app

**Files modified:** `frontend/src/store/theme.ts`
**Commit:** b390a15
**Applied fix:** Introduced guarded helpers `readStoredTheme()` (returns `"light"` when `localStorage` access throws) and `storeTheme()` (swallows persistence failures — theme still applies for the session), and switched `initTheme`/`toggleTheme` to use them instead of direct `localStorage` calls. The review also cited `frontend/src/main.tsx:14`, but no change was needed there: with `initTheme` unable to throw, the top-level bootstrap call is safe as-is. Verified with `tsc -b` (clean) and vitest (1 passed).

## Verification

- Backend: `python -m pytest` in `backend/` — 115 passed, 7 skipped (includes 2 new WR-01 regression tests).
- Frontend: `tsc -b` clean; `vitest --run` — 1 passed.
- Each fix committed atomically; working tree left clean.

---

_Fixed: 2026-07-15T08:26:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
