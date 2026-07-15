---
phase: 02-read-api-dashboard
reviewed: 2026-07-15T08:10:54Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - backend/app/auth.py
  - backend/app/config.py
  - backend/app/deps.py
  - backend/app/main.py
  - backend/app/routers/__init__.py
  - backend/app/routers/readings.py
  - backend/app/routers/stats.py
  - backend/app/schemas.py
  - backend/pyproject.toml
  - backend/tests/conftest.py
  - backend/tests/test_api_readings.py
  - backend/tests/test_api_stats.py
  - frontend/.env.development
  - frontend/index.html
  - frontend/package.json
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/index.css
  - frontend/src/main.tsx
  - frontend/src/store/theme.ts
  - frontend/src/tests/setup.ts
  - frontend/src/tests/smoke.test.tsx
  - frontend/vite.config.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-15T08:10:54Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the Phase 2 read API (FastAPI: `/readings`, `/stats/summary`, shared `ReadingFilters`, auth stub, CORS) and the frontend scaffold (Vite/React/Tailwind tokens, theme store, typed API client). Backend test suite (30 tests) was executed and passes. Cross-checked schemas against `app/models.py` (attribute vs column names) and canonical BP labels against `app/derivations.py` — the Pydantic alias bridging, inclusive end-date semantics, zero-filled category list, and unfiltered `latest_reading` are all implemented correctly and pinned by tests. The `verify_token` no-op stub and open endpoints are a documented, accepted threat (T-02-03) for this phase and are not re-flagged.

Three warnings were found, one of them empirically confirmed: a well-formed query (`end_date=9999-12-31`) produces an unhandled `OverflowError` and a 500 on both endpoints, violating the project's own "422, never 500" contract. The other two are frontend robustness gaps: the API client's `ApiError` contract silently excludes network failures, and the theme bootstrap can white-screen the app when `localStorage` access throws. No hardcoded secrets, no injection surface (all queries are parameterized via the ORM), no third-party scripts or CDN references (fonts are self-hosted per SEC-03).

## Warnings

### WR-01: `end_date=9999-12-31` causes unhandled OverflowError → 500 on both endpoints

**File:** `backend/app/deps.py:69`
**Issue:** The inclusive-end-date implementation computes `self.end_date + timedelta(days=1)`. When a client sends `end_date=9999-12-31` (a syntactically valid ISO date that FastAPI parses successfully into `date.max`), the addition raises `OverflowError: date value out of range`, producing an HTTP 500 from both `GET /readings` and `GET /stats/summary`. **Confirmed by direct reproduction against the app** (both endpoints returned 500). This violates the pinned invariant stated in `test_api_readings.py` ("invalid enum / malformed date -> 422, never 500") and in `stats.py`'s docstring ("no division errors, no 500s"). Because the endpoints are unauthenticated this phase and Phase 3's agent will construct these params from model output (untrusted input per CLAUDE.md), the boundary must not be reachable.
**Fix:** Compare inclusively without date arithmetic — use the end of day instead of the start of the next day:

```python
if self.end_date:  # inclusive end date — Pitfall 4, safe at date.max
    stmt = stmt.where(
        Reading.datetime_ <= datetime.combine(self.end_date, datetime.max.time())
    )
```

(`datetime.max.time()` is `23:59:59.999999`; stored readings have second precision, so `<=` end-of-day preserves the inclusive semantics with no overflow.) Alternatively, guard `self.end_date < date.max` and short-circuit. Add a regression test with `end_date=9999-12-31` expecting 200.

### WR-02: Network failures bypass the `ApiError` contract in the API client

**File:** `frontend/src/api/client.ts:27-29`
**Issue:** The module contract (lines 2-3) states "Failures throw ApiError — the UI renders UI-SPEC error copy … and NEVER surfaces raw status text, codes, or stack traces." But `ApiError` is only thrown for non-2xx HTTP responses. The two most likely failure modes for this app — backend unreachable (Railway cold start, offline iPad) and CORS rejection — cause `fetch` to reject with a raw `TypeError: Failed to fetch`, and a malformed body makes `res.json()` throw a `SyntaxError`. Downstream error handling keyed on `instanceof ApiError` (the stated plan) will miss exactly the failures Chris is most likely to hit, risking raw browser error text or unhandled-rejection states in the UI.
**Fix:**

```ts
export async function getJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  const qs = search.toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`);
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) throw new ApiError(res.status, path);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}
```

### WR-03: Unguarded `localStorage` access at bootstrap can blank the entire app

**File:** `frontend/src/main.tsx:14`, `frontend/src/store/theme.ts:25,30`
**Issue:** `useTheme.getState().initTheme()` runs at module top level, before `createRoot(...).render(...)`. `initTheme` calls `localStorage.getItem` unguarded. In Chromium, when site data/cookies are blocked (enterprise policy, privacy settings), merely accessing `window.localStorage` throws a `SecurityError`; older Safari private-mode throws on `setItem`. If that happens, the exception propagates out of the module evaluation in `main.tsx`, `render` never executes, and the user gets a permanently blank page — the worst possible failure for a user who cannot easily troubleshoot a browser. `toggleTheme`'s `localStorage.setItem` (theme.ts:25) has the same exposure, breaking the toggle mid-session.
**Fix:** Wrap storage access so theme persistence degrades gracefully to the light default:

```ts
function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* persistence unavailable — theme still applies for this session */
  }
}
```

Use these in `initTheme`/`toggleTheme` instead of direct `localStorage` calls.

## Info

### IN-01: Canonical BP labels duplicated in four places with no importable source of truth

**File:** `backend/app/deps.py:30-32`, `backend/app/routers/stats.py:27-29`, `backend/tests/test_api_stats.py:22-24`, `frontend/src/api/types.ts:7-13`
**Issue:** `deps.py` says labels "MUST match derivations.py verbatim" and `stats.py` calls them "verbatim canonical labels from app.derivations" — but `app/derivations.py` exposes no public canonical list (its `_SEVERITY` is private and omits "Hypotension"), so each site re-types the six strings. A future label change in `derivations.py` would drift silently: `bp_category` filters would 422 or return empty, and the zero-filled category list would stop matching stored rows, with no test catching the divergence at the source.
**Fix:** Export `CANONICAL_BP_CATEGORIES: tuple[str, ...]` (clinical order) from `app/derivations.py`; build `deps.BPCategory` and `stats.CLINICAL_ORDER` from it, and add one test asserting the classifier's outputs are a subset of the exported list.

### IN-02: `CORS_ORIGINS` env var requires JSON-array syntax — deploy-time footgun

**File:** `backend/app/config.py:18`
**Issue:** `cors_origins: list[str]` means pydantic-settings will parse the `CORS_ORIGINS` env var as JSON. The natural deploy-time value (`CORS_ORIGINS=https://app.vercel.app` or a comma-separated pair) raises a `SettingsError` at startup; only `CORS_ORIGINS='["https://app.vercel.app"]'` works. Not a bug today (default is used in dev), but it will surface as a confusing crash at Phase-6 deploy.
**Fix:** Add a `field_validator(mode="before")` that splits a plain comma-separated string into a list, or document the required JSON syntax in the deploy runbook.

### IN-03: `httpx` is a runtime dependency but is only used by the test client

**File:** `backend/pyproject.toml:15`
**Issue:** `httpx==0.28.*` sits in `[project.dependencies]`, but nothing in `app/` imports it — it exists solely so `fastapi.testclient.TestClient` works in the test suite. Production installs pull an unused HTTP client.
**Fix:** Move `httpx` to the `dev` optional-dependency group alongside `pytest`.

### IN-04: API base URL silently falls back to `localhost:8000` in production builds

**File:** `frontend/src/api/client.ts:6`
**Issue:** `const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"` — if the Vercel build omits `VITE_API_URL`, the deployed site silently targets `localhost` and every request fails with a generic error. A misconfiguration that fails loudly at build time is easier to catch than one that ships.
**Fix:** In production mode, throw (or log prominently) when the var is missing: `if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) throw new Error("VITE_API_URL not configured")`, keeping the localhost fallback for dev only.

### IN-05: Backend response schema is looser than the frontend type contract

**File:** `backend/app/schemas.py:35-37` vs `frontend/src/api/types.ts:21-22`
**Issue:** `ReadingOut.am_pm`, `bp_category`, and `pulse_category` are plain `str`, while `types.ts` declares `am_pm: "AM" | "PM"` and `bp_category: BPCategory`. If a bad row ever lands in the DB (e.g., pre-derivation import), the backend serves it unchallenged and the frontend's compile-time guarantees are fiction at runtime. Low risk given ETL owns writes, but the response model is the natural enforcement point.
**Fix:** Type the fields as `Literal["AM", "PM"]` and the `BPCategory` literal (reusing the export suggested in IN-01) so a corrupt row fails loudly at serialization instead of leaking downstream.

### IN-06: Lint tooling deviates from the documented stack (oxlint vs ESLint)

**File:** `frontend/package.json:9`, `frontend/.oxlintrc.json`
**Issue:** CLAUDE.md's stack table specifies "ESLint 10.x + typescript-eslint" (the Vite `react-ts` scaffold); the implementation uses `oxlint` instead. oxlint is functional and the config enables rules-of-hooks, so this is not a defect — but it is an undocumented deviation from the locked stack document, and oxlint's rule coverage is narrower than typescript-eslint's type-aware rules.
**Fix:** Either record the substitution as a convention decision (CLAUDE.md Conventions section / phase summary) or swap to the documented ESLint setup for consistency.

---

_Reviewed: 2026-07-15T08:10:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
