# Phase 5: Upload, Auth Gate & Deployment - Research

**Researched:** 2026-07-21
**Domain:** FastAPI signed-token auth + multipart upload; React login gate + client routing; Vercel/Railway split deployment; privacy hardening
**Confidence:** HIGH (stack is locked and installed/verifiable; deployment gotchas cross-verified against current Railway/Vercel docs)

## Summary

Phase 5 flips four already-designed seams into their live form and ships the app. The backend already contains the entire hard part: `parse_omron`/`transform`/`merge_readings` (the upload ETL, tested and idempotent), the `verify_token` router-level enforcement seam, the `Settings`/`get_settings()` config pattern, and the slowapi `limiter` wiring. The frontend already has the typed `client.ts` fetch wrapper, the zustand store pattern (theme/filters), and a single-view `App.tsx`. Nothing here is a rewrite — it is: (1) replace the `verify_token` no-op body with itsdangerous verification; (2) add an ungated `/auth` password-check route that issues a signed token; (3) add a thin `/upload` `UploadFile` route that calls the existing ETL; (4) add a full-screen login gate + a view-swapped upload page + a Bearer header in `client.ts`; (5) deploy Vercel (frontend) + Railway (backend + Postgres) with env-var config and a CORS allow-list; (6) a hybrid curl+human smoke test.

Three backend packages named in CLAUDE.md are **not yet installed and not in `pyproject.toml`**: `itsdangerous`, `python-multipart`, and `psycopg[binary]`. All three must be added to `[project].dependencies`. The single highest-risk landmine is not a library — it is that **all three existing API test files (`test_api_readings.py`, `test_api_stats.py`, `test_agent_route.py`) call gated routes with no token**; the moment `verify_token` enforces, every one of them returns 401 and the suite goes red. The `client` fixture in `conftest.py` must override `verify_token` to a no-op, and a *new* dedicated auth test module must exercise the real dependency.

**Primary recommendation:** Use `itsdangerous.URLSafeTimedSerializer` with `loads(token)` called **without `max_age`** (signed, timestamp embedded for future flexibility, but non-expiring per D-02); compare the password with `hmac.compare_digest`; parse the `Authorization` header manually (not FastAPI `HTTPBearer`, which returns 403 not the SC2-mandated 401). For routing (D-05), use a **minimal zustand view-state swap** — no new dependency, no Vercel SPA-rewrite gotcha, and the login gate already wraps everything so a real `/upload` URL buys nothing. Normalize `DATABASE_URL` from `postgresql://` to `postgresql+psycopg://` in `config.py` (one point fixes both the app engine and Alembic).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login / Password Gate (SEC-01)**
- **D-01:** Full-screen login page. Nothing renders until the password is entered — a centered nautical-themed card (password field + big "Enter" button). No dashboard chrome or data leaks before auth; no blur-overlay (risks flashing real data if the auth check is slow).
- **D-02:** Token persists until manual logout. The itsdangerous signed Bearer token (localStorage per CLAUDE.md §3) does **not** auto-expire — caregiver logs in once on Chris's device and it stays unlocked for daily hands-free use. Deliberate accessibility-over-hardening tradeoff for a single-patient personal site.
- **D-03:** A manual logout control MUST exist (consequence of D-02). Logout clears the stored token and returns to the full-screen login. Placement: header (D-06).
- **D-04:** Login is a caregiver-only, keyboard-entry action — NOT voice-operable and NOT part of the ACC-03 "operable by voice" surface. A normal password `<input>` is fine.

**Upload Surface & Access (DASH-10)**
- **D-05:** Dedicated upload route/page (e.g. `/upload`). Introduces lightweight client-side routing — none exists today (single `App.tsx`, no router). A separate caregiver screen keeps Chris's voice dashboard uncluttered and prevents accidental upload triggers during a voice session.
- **D-06:** Discreet caregiver controls in the header: a modest "Upload" link and a "Log out" button in a header corner — always reachable, out of the way of the large voice/chart UI.
- **D-07:** Relaxed accessibility on the caregiver-only upload screen. A standard OS file-picker button is acceptable; the ≥48px / no-precision-pointing / voice-operable non-negotiables exist for Chris's daily dashboard, not this occasional admin upload. Upload screen should still be large, high-contrast, readable, but is exempt from "no precision pointing / voice-reachable".

**Upload Flow & Errors (API-03)**
- **D-08:** Immediate idempotent ingest, then show the summary — no preview/confirm step. Safe because the ETL merge is idempotent (DATA-03): re-uploading the same file is a visible no-op. Response is the locked `IngestSummary` shape (added / updated / unchanged / rejected / total / latest).
- **D-09:** Result summary reads as plain-language sentences — e.g. "Added 12 new readings. 3 were already on file. 0 skipped. Your data now goes through June 13." Big, readable text. (Not numeric stat-tiles.)
- **D-10:** Friendly per-row reject reporting + clear bad-file rejection. "3 rows couldn't be read" with an **optional expandable** list (ETL returns per-row `RejectedRow` reasons). A non-OMRON / unparseable file gets "This doesn't look like an OMRON export" and **ingests nothing**. Never a raw traceback, status code, or 500.

**Deployment & Smoke Test (DEPL-01, DEPL-02, SEC-03)**
- **D-11:** Railway for backend + Postgres (over Render). Stays warm, bundles Postgres with `DATABASE_URL` injected, ~$5/mo Hobby. Frontend on Vercel.
- **D-12:** Platform-provided URLs for the MVP (`*.vercel.app` + `*.railway.app`). No DNS/cert setup now; custom domain addable later via `CORS_ORIGINS` + env update without code changes.
- **D-13:** Hybrid smoke test. Automated `curl` checks prove **every** route (`/readings`, `/stats/summary`, `/agent`, `/upload`) returns **401 without a valid Bearer token**. A short human checklist covers the rest on the live site — log in, view all charts, issue a voice/text command that updates the dashboard, upload a file. No full Playwright E2E.
- **D-14:** SEC-03 verification is part of this phase: confirm no analytics/trackers/third-party embeds anywhere, the Postgres DB is not publicly reachable (Railway private networking), and platform logs contain **no** blood-pressure values or transcripts.

### Claude's Discretion
- Exact login-card copy, styling, and the `/auth` password-check endpoint shape (request/response); how the token is signed/serialized with itsdangerous (timestamped vs plain signer — no expiry per D-02).
- The routing mechanism for D-05 (react-router vs a minimal view-state swap) — choose the lightest option that fits the single-page app.
- Exact header placement/styling of the Upload + Log out controls (D-06), within the existing `Header` component.
- Upload file-size limit / accepted extensions, and the exact expandable-details UI for rejected rows (D-10).
- The precise wording of the plain-language summary and error copy (D-09/D-10), non-technical and large-text friendly.
- Railway/Vercel project configuration specifics, build/start commands, and the Postgres migration-on-first-deploy step (Alembic `upgrade head` against the injected `DATABASE_URL`).

### Deferred Ideas (OUT OF SCOPE)
- Custom domain — deferred; addable later via `CORS_ORIGINS` + env, no code change (D-12).
- Password rotation / reset flow — out of scope; rotate `SITE_PASSWORD`/`TOKEN_SECRET` env vars and everyone re-logs in. No in-app reset UI in v1.
- Token expiry / session hardening — considered and declined (D-02).
- Full auth (accounts, roles, magic links) — permanently out of scope per PROJECT.md.
- Fully automated E2E (Playwright) — considered and declined for the smoke test (D-13).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-03 | `POST /upload` accepts an OMRON export file, runs the ETL, returns a result summary (readings added, duplicates skipped, total count, latest reading date) | Thin `UploadFile` route buffers `file.file` into existing `parse_omron → transform → merge_readings`, returns the locked `IngestSummary` (Architecture Pattern 3, Code Example 3). Needs `python-multipart`. |
| DASH-10 | Upload page for caregivers showing the post-upload result summary | View-swapped upload page (Architecture Pattern 4), plain-language summary rendering the `IngestSummary` (D-09), expandable `RejectedRow` list (D-10). |
| SEC-01 | Shared-password gate; Bearer token (not cookies) enforced on every API route including /agent and /upload | Replace `verify_token` body with itsdangerous verification (Code Example 1); router-level `Depends(verify_token)` already covers all three routers; `/upload` router added the same way; `/auth` route ungated (Code Example 2). |
| SEC-03 | No analytics trackers, no third-party data sharing; database not publicly exposed | D-14 verification checklist: grep for trackers (none present today — verified), Railway private networking / no public Postgres proxy, log-hygiene audit. |
| DEPL-01 | Frontend to Vercel; backend + PostgreSQL to Railway, configured via env vars | Deployment section: Railway (Railpack, start command, env inventory, `DATABASE_URL` normalization, Alembic on deploy), Vercel (`VITE_API_URL`, root dir, dist), CORS allow-list. |
| DEPL-02 | End-to-end smoke test on the deployed site: log in, view charts, issue a voice/text command, upload a file | Hybrid smoke test (D-13): automated curl 401-on-every-route script + human live-site checklist (Validation Architecture). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password check + token issuance | API / Backend (`/auth`) | — | The shared secret must never reach the browser bundle; only the backend holds `SITE_PASSWORD`/`TOKEN_SECRET`. |
| Token verification / route gating | API / Backend (`verify_token`) | — | Single enforcement point; the frontend cannot be the security boundary. |
| Token storage + attachment | Browser / Client (`localStorage` + `client.ts`) | — | Bearer-in-localStorage is the locked model (CLAUDE.md §3); the client attaches it per request. |
| Login gate rendering / logout | Frontend (React, `App`/gate wrapper) | — | Pure UI state; nothing renders pre-auth (D-01). |
| File selection + multipart POST | Browser / Client (`FormData` + fetch) | API (parses multipart) | Browser builds the multipart body; backend parses via `python-multipart`. |
| ETL ingest (parse/transform/merge) | API / Backend (existing `etl.py`) | Database (Postgres) | Pure-function ETL already owns this; route is a thin adapter. |
| Persistence / idempotent merge | Database (Postgres prod / SQLite dev) | — | `uq_readings_datetime` constraint + Python merge enforce idempotency. |
| CORS allow-list | API / Backend (CORSMiddleware) | — | Cross-origin Vercel→Railway requires an explicit origin allow-list, no credentials. |
| Static asset serving | CDN / Static (Vercel) | — | Vite `dist` served from Vercel's edge; no third-party CDN (SEC-03). |

## Standard Stack

### Core (already installed / locked)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.139.0 | API framework | `[VERIFIED: pip list]` installed; router-level `Depends` gating + `UploadFile` are first-class. |
| slowapi | 0.1.10 | Rate limiting | `[VERIFIED: pip list]` installed; the shared `limiter` is already wired in `main.py`/`agent.py`; reuse it on `/auth`. |
| SQLAlchemy | 2.0.51 | ORM | `[VERIFIED: pip list]` installed; same models run SQLite (dev) + Postgres (prod). |
| Alembic | 1.18.5 | Migrations | `[VERIFIED: pip list]` installed; `env.py` already reads `get_settings().database_url`. |

### Supporting (MUST ADD — not installed, not in `pyproject.toml`)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| itsdangerous | 2.2.0 | Sign/verify the Bearer token | `[VERIFIED: pip index versions]` latest 2.2.0. Sign a token on `/auth` success; verify in `verify_token`. Named in CLAUDE.md §Supporting Libraries. |
| python-multipart | 0.0.32 | Multipart form parsing for `UploadFile` | `[VERIFIED: pip index versions]` latest 0.0.32. **FastAPI raises at request time without it** for any `UploadFile`/`Form` route. |
| psycopg[binary] | 3.3.x | Postgres driver (prod only) | `[VERIFIED: pip list]` NOT installed. Required for Railway Postgres. SQLAlchemy URL `postgresql+psycopg://`. SQLite dev needs no driver. |

**Import-name note:** the PyPI package is `python-multipart`; FastAPI imports it as the module `multipart`. Install the hyphenated distribution name.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `URLSafeTimedSerializer` (no `max_age`) | `URLSafeSerializer` (no timestamp) | Both non-expiring. Timed variant embeds a timestamp so a future expiry policy needs no token-format change — strictly more flexible at zero cost. **Recommend Timed.** |
| Manual `Authorization` header parse | FastAPI `HTTPBearer` security scheme | `HTTPBearer(auto_error=True)` returns **403** on missing creds; SC2 mandates **401**. `auto_error=False` still requires manual handling. Manual `Header` parse is simplest and guarantees 401. |
| zustand view-state swap (routing) | react-router v7 | react-router adds a dependency **and** requires a Vercel SPA rewrite (`vercel.json`) to avoid 404-on-refresh. View-swap needs neither and the login gate already wraps everything. **Recommend view-swap.** |
| itsdangerous | PyJWT | Overkill — no claims/expiry needed for one shared secret (CLAUDE.md, D-02). |

**Installation:**
```bash
# Backend — add to pyproject.toml [project].dependencies, then reinstall:
#   "itsdangerous==2.2.*",
#   "python-multipart==0.0.*",
#   "psycopg[binary]==3.3.*",
cd backend && .venv/bin/pip install -e .
# Frontend — NO new dependency required (view-state routing).
```

## Package Legitimacy Audit

> slopcheck was unavailable at research time (`pip install slopcheck` not resolvable in this sandbox). All three packages are canonical, named verbatim in CLAUDE.md's locked STACK, and confirmed present on PyPI via `pip index versions`. Per protocol, the planner SHOULD still gate the install behind a `checkpoint:human-verify` task — though the risk here is near-zero (all three are decade-old, ubiquitous packages that FastAPI/SQLAlchemy themselves depend on ecosystem-wide).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| itsdangerous | PyPI | 13+ yrs | very high (Flask/Starlette dep) | github.com/pallets/itsdangerous | unavailable → `[ASSUMED]` | Approved (canonical, CLAUDE.md-named) |
| python-multipart | PyPI | 12+ yrs | very high (FastAPI dep) | github.com/Kludex/python-multipart | unavailable → `[ASSUMED]` | Approved (canonical, FastAPI `[standard]` extra) |
| psycopg[binary] | PyPI | current-gen driver | very high | github.com/psycopg/psycopg | unavailable → `[ASSUMED]` | Approved (canonical, CLAUDE.md-named) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────── Vercel (CDN/static) ───────────────────────────┐
                    │  Vite dist (React 19)                                                       │
   Caregiver ──────▶│  ┌───────────────┐  token in localStorage   ┌──────────────────────────┐  │
   (types pwd)      │  │  LoginGate     │──────────────┐          │  App (dashboard) + Upload │  │
                    │  │ (D-01 full     │              │          │  view (view-state swap)   │  │
                    │  │  screen)       │◀─── 401 ──────┼──────────│  Header: Upload / Log out │  │
                    │  └───────┬────────┘  clear token  │          └───────────┬──────────────┘  │
                    │          │ POST /auth {password}   │ Bearer header on      │ FormData(file) │
                    └──────────┼─────────────────────────┼───────────────────────┼───────────────┘
                               │  (ungated)              │  every request        │ POST /upload
                               ▼                         ▼                       ▼
        ┌──────────────────────────────── Railway (backend + DB) ───────────────────────────────┐
        │  FastAPI (uvicorn)                                                                       │
        │  ┌─────────────┐   ok    ┌──────────────────────────────────────────────────────────┐  │
        │  │ /auth route │────────▶│ CORSMiddleware (allow-list: Vercel origin, no creds)      │  │
        │  │ hmac.compare│  signed │                                                            │  │
        │  │ _digest     │  token  │  Depends(verify_token)  ── itsdangerous.loads() ──▶ 401?  │  │
        │  │ slowapi 5/m │         │        │ (router-level on readings/stats/agent/upload)     │  │
        │  └─────────────┘         │        ▼                                                   │  │
        │                          │  /readings  /stats  /agent      /upload                    │  │
        │                          │                                    │ file.file             │  │
        │                          │                                    ▼                       │  │
        │                          │             parse_omron → transform → merge_readings       │  │
        │                          └───────────────────────────────────────────┬──────────────┘  │
        │                                                                       ▼                  │
        │                          Postgres (private networking, NOT public — SEC-03)             │
        └────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additive only)
```
backend/app/
├── auth.py                 # verify_token body replaced (itsdangerous); + serializer helper
├── config.py               # + site_password, token_secret, cors_origins parsing, DATABASE_URL normalize
├── routers/
│   ├── auth.py             # NEW — ungated POST /auth (password → token), slowapi-limited
│   └── upload.py           # NEW — gated POST /upload (UploadFile → ETL → IngestSummary)
├── main.py                 # + include auth.router (no deps) + upload.router (Depends(verify_token))
└── tests/
    └── test_auth_upload.py # NEW — real verify_token dependency, /auth, /upload
frontend/src/
├── store/auth.ts           # NEW — zustand token store (mirrors store/theme.ts)
├── store/view.ts           # NEW — zustand view swap ("dashboard" | "upload")  (or fold into auth)
├── components/
│   ├── LoginGate.tsx       # NEW — full-screen card (D-01)
│   └── UploadPage.tsx      # NEW — file picker + summary/reject rendering (D-09/D-10)
├── components/Header.tsx   # + Upload link + Log out button (D-06)
├── api/client.ts           # + Bearer header, + postFile(), + 401→logout
└── App.tsx                 # + gate wrapper + view switch
backend/pyproject.toml      # + itsdangerous, python-multipart, psycopg[binary]
frontend/vercel.json        # only if react-router chosen (NOT needed for view-swap)
railway.json (optional)     # builder RAILPACK + startCommand (or set in dashboard)
```

### Pattern 1: itsdangerous non-expiring signed Bearer token (D-02)
**What:** A `URLSafeTimedSerializer` signs a constant payload with `TOKEN_SECRET`. Verification calls `loads()` **without `max_age`** → signature is checked, timestamp is ignored → never auto-expires.
**When to use:** The single shared-password gate. No per-user claims needed.
```python
# Source: itsdangerous 2.2 docs (pallets/itsdangerous) [CITED: itsdangerous.palletsprojects.com]
from itsdangerous import URLSafeTimedSerializer, BadData

def get_serializer() -> URLSafeTimedSerializer:
    # salt namespaces the signature so this token can never be confused with
    # any other itsdangerous use of the same secret.
    return URLSafeTimedSerializer(get_settings().token_secret, salt="auth-gate")

# issue (on /auth success): serializer.dumps("authorized")  -> URL-safe string
# verify: serializer.loads(token)  # NO max_age -> non-expiring (D-02); raises BadData on tamper
```

### Pattern 2: Constant-time password comparison (timing-attack resistant)
```python
# Source: Python stdlib hmac [CITED: docs.python.org/3/library/hmac.html]
import hmac
def password_ok(candidate: str) -> bool:
    return hmac.compare_digest(candidate, get_settings().site_password)
```
Never use `==` on the secret. `hmac.compare_digest` is stdlib, already available (verified).

### Pattern 3: Thin `/upload` route over the existing ETL (API-03)
**What:** Sync route (`def`, runs in threadpool like the other routes) receives an `UploadFile`, hands `file.file` (a file-like `SpooledTemporaryFile`) straight to `parse_omron`, which already accepts a buffer. Wrap in try/except → friendly non-500 rejection (D-10).
```python
# Source: existing etl.py docstring ("Accepts a filesystem path or a file-like buffer
# (Phase 5 passes UploadFile.file unchanged)") + FastAPI UploadFile docs
@router.post("/upload", response_model=IngestSummary)
def upload(file: UploadFile, db: Annotated[Session, Depends(get_db)]) -> IngestSummary:
    # extension guard (ETL reads .xlsx via openpyxl):
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(400, detail="not-omron")   # frontend maps to friendly copy
    try:
        raw = parse_omron(file.file)          # ValueError if > max_rows (DoS guard, T-1-06)
        clean, rejected = transform(raw)
        return merge_readings(db, clean, rejected)
    except HTTPException:
        raise
    except Exception:                          # never a 500 / raw traceback (D-10)
        raise HTTPException(400, detail="not-omron")
```
**Response is `IngestSummary` verbatim** — do NOT wrap or rename (Phase 1 D-06 lock).

### Pattern 4: zustand view-state routing (D-05, lightest option)
**What:** A tiny store toggles `"dashboard" | "upload"`. Header buttons set it; login gate wraps both. No URL change, no react-router, no Vercel rewrite, no deep-link 404.
```typescript
// Source: mirrors existing frontend/src/store/theme.ts pattern
import { create } from "zustand";
type View = "dashboard" | "upload";
export const useView = create<{ view: View; go: (v: View) => void }>((set) => ({
  view: "dashboard",
  go: (view) => set({ view }),
}));
```
**Why over react-router:** react-router v7 would require a `frontend/vercel.json` rewrite (`{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`) to survive a refresh on `/upload`; the view-swap sidesteps that entirely. If real bookmarkable URLs are later wanted, add react-router + the rewrite then.

### Pattern 5: Bearer header + 401→logout in the existing client wrapper
```typescript
// Source: extends existing frontend/src/api/client.ts (getJson/postJson three-branch ApiError)
import { useAuth } from "../store/auth";
function authHeaders(): Record<string, string> {
  const t = useAuth.getState().token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}
// In getJson/postJson: spread ...authHeaders() into headers.
// After `if (!res.ok)`: if (res.status === 401) useAuth.getState().logout();
//   then throw new ApiError(res.status, path)  — raw text still never renders.

// NEW multipart helper — DO NOT set Content-Type (browser sets the boundary):
export async function postFile<TRes>(path: string, file: File): Promise<TRes> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: "POST", headers: { ...authHeaders() }, body: form });
  } catch { throw new ApiError(0, path); }
  if (res.status === 401) useAuth.getState().logout();
  if (!res.ok) throw new ApiError(res.status, path);
  try { return (await res.json()) as TRes; } catch { throw new ApiError(res.status, path); }
}
```

### Anti-Patterns to Avoid
- **Per-route auth decorators.** The enforcement point is the router-level `Depends(verify_token)` in `main.py` — add `/upload` the same way; never sprinkle auth per-route (established invariant).
- **Setting `Content-Type: multipart/form-data` manually.** Omitting the browser-set boundary breaks the upload. Let `fetch` set it from the `FormData` body.
- **`HTTPBearer(auto_error=True)` for the gate.** Returns 403, not the SC2-required 401.
- **`==` on the password.** Timing-attack vector; use `hmac.compare_digest`.
- **Cookie-based session.** Explicitly forbidden (CLAUDE.md §3 — Safari ITP / cross-origin). localStorage Bearer only.
- **Logging the uploaded file, password, or any vital.** Violates T-1-04 / SEC-03 / D-14. `/auth` and `/upload` must log neither the secret nor row values.
- **`allow_credentials=True` on CORS.** Not needed with Bearer and forbids wildcard origins; keep it off (locked model).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signed/tamper-proof token | Custom HMAC-over-JSON + base64 | `itsdangerous.URLSafeTimedSerializer` | Constant-time signature check, URL-safe encoding, salt namespacing, versioned key support — all solved. |
| Constant-time compare | Loop / `==` | `hmac.compare_digest` | Timing-safe, stdlib, one line. |
| Multipart parsing | Manual body parsing | `python-multipart` via FastAPI `UploadFile` | RFC-7578 boundary parsing, streaming, spooled temp files. |
| OMRON ingest | Re-parse the file in the route | Existing `parse_omron`/`transform`/`merge_readings` | Already tested, idempotent (DATA-03), DoS-guarded, log-hygienic. The route is a 10-line adapter. |
| Rate limiting `/auth` | Custom counter | Existing slowapi `limiter` | Already wired (`app.state.limiter` + 429 handler); reuse the same instance. |
| SPA 404-on-refresh | Custom server fallback | zustand view-swap (or Vercel rewrite if react-router) | View-swap avoids the problem class entirely. |

**Key insight:** Every genuinely hard piece of this phase already exists and is tested. The work is wiring, config, and deployment — not new logic. Resisting the urge to re-implement the ETL or the token scheme is the whole game.

## Runtime State Inventory

> This is a deploy/enable phase, not a rename. Included because deployment introduces new runtime state (env vars, a fresh prod DB) even though no strings are being renamed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Prod Postgres starts **empty**. The 132 seed readings (DATA-04) live only in dev SQLite. | Decide + document: run the seeder against prod `DATABASE_URL` once, or accept an empty prod DB that fills via the first caregiver upload. **Planner must make this an explicit task/decision** (not left implicit). |
| Live service config | Railway service env vars (`DATABASE_URL` injected; `ANTHROPIC_API_KEY`, `SITE_PASSWORD`, `TOKEN_SECRET`, `CORS_ORIGINS` set by hand). Vercel env var `VITE_API_URL`. **These live in the platform dashboards, not git.** | Set all 5 backend vars in Railway + `VITE_API_URL` in Vercel. Document the inventory (no secret values) so a redeploy is reproducible. |
| OS-registered state | None (managed platforms; no cron/systemd/Task Scheduler). | None — verified: fully PaaS. |
| Secrets/env vars | `SITE_PASSWORD` + `TOKEN_SECRET` are **new** secrets introduced this phase; `ANTHROPIC_API_KEY` already custody-managed (SEC-02). | Generate a strong `TOKEN_SECRET` (e.g. `python -c "import secrets;print(secrets.token_urlsafe(32))"`), set both in Railway only, never in the frontend bundle or git. Rotating either invalidates all tokens (accepted, deferred rotation flow). |
| Build artifacts | `backend/pyproject.toml` gains 3 deps → the editable install / Railway build must reinstall. Frontend `dist` rebuilt by Vercel. | Add deps, `pip install -e .` locally; Railway rebuilds from `pyproject.toml`. |

**Migration-on-first-deploy:** Alembic `env.py` already reads `get_settings().database_url`, so `alembic upgrade head` against the injected (normalized) Railway URL creates the schema. Run it as part of the deploy (see Deployment section).

## Common Pitfalls

### Pitfall 1: Existing API tests 401 the instant `verify_token` enforces
**What goes wrong:** `test_api_readings.py`, `test_api_stats.py`, `test_agent_route.py` all call gated routes through the `client` fixture with **no `Authorization` header** (verified: e.g. `client.get("/readings")`). Real `verify_token` → every one returns 401 → suite goes red.
**Why it happens:** The tests were written against the Phase 2 no-op stub.
**How to avoid:** In `conftest.py`'s `client` fixture, add `app.dependency_overrides[verify_token] = lambda: None` alongside the existing `get_db` override. Then write a **separate** `test_auth_upload.py` that uses a plain `TestClient(app)` (no verify_token override) to prove real 401/200 behavior. This mirrors the existing `get_interpreter`/`get_db` override discipline.
**Warning signs:** A green local suite that only turns red after the auth task lands — run the full suite immediately after flipping `verify_token`.

### Pitfall 2: `DATABASE_URL` scheme mismatch on Railway (psycopg2 not installed)
**What goes wrong:** Railway injects `postgresql://...`. SQLAlchemy maps bare `postgresql://` to the **psycopg2** dialect, which isn't installed (we use psycopg3) → `ModuleNotFoundError: psycopg2` at boot.
**Why it happens:** `postgresql://` defaults to psycopg2; psycopg3 requires `postgresql+psycopg://`.
**How to avoid:** Normalize in `config.py` at one point (covers both the app engine **and** Alembic, since both read `get_settings().database_url`):
```python
@field_validator("database_url")
@classmethod
def _use_psycopg3(cls, v: str) -> str:
    if v.startswith("postgresql://"):
        return v.replace("postgresql://", "postgresql+psycopg://", 1)
    return v
```
**Warning signs:** Works on SQLite locally, crashes on Railway boot with a psycopg2 import error.

### Pitfall 3: `CORS_ORIGINS` env var won't parse into `list[str]`
**What goes wrong:** pydantic-settings parses a `list[str]` field from env by attempting **JSON** first. Setting `CORS_ORIGINS=https://myapp.vercel.app` (a plain string) raises a JSON-decode `SettingsError` at boot.
**Why it happens:** Complex types (list/dict) in pydantic-settings expect a JSON value from the environment.
**How to avoid:** Either set the env var as JSON — `CORS_ORIGINS=["https://myapp.vercel.app"]` — **or** (cleaner for ops) type the field as `str` and split on commas in a validator, exposing a `cors_origins: list[str]` property. Document whichever the plan picks; the current default `["http://localhost:5173"]` in code is a Python literal, not what the env parser sees.
**Warning signs:** Backend boots locally (uses the code default) but crashes on Railway once `CORS_ORIGINS` is set.

### Pitfall 4: `HTTPBearer` returns 403, breaking the "401 on every route" smoke test
**What goes wrong:** SC2 / D-13 require **401** without a valid token. FastAPI's `HTTPBearer` security scheme returns **403** for a missing `Authorization` header.
**How to avoid:** Parse the header manually with `Header(default=None)` and raise `HTTPException(status_code=401)` for missing/malformed/invalid tokens (see Code Example 1). Explicitly assert 401 (not 403) in the curl smoke test and unit tests.

### Pitfall 5: slowapi `@limiter.limit` silently no-ops on `/auth`
**What goes wrong:** slowapi only fires when the decorator order is right **and** the endpoint signature declares `request: Request`. Miss either and rate limiting silently does nothing — brute-force protection gone.
**Why it happens:** Documented slowapi requirement (already called out in `agent.py`: "the `@router.post` decorator sits ABOVE `@limiter.limit` and the signature declares `request: Request`").
**How to avoid:** Copy the exact shape from `agent.py`. Reuse the **same** `limiter` instance (import from `app.routers.agent` or lift it to a shared module) so `app.state.limiter` stays single. Reset it in tests via `limiter.reset()` (existing fixture pattern).

### Pitfall 6: Multipart upload with a manually-set `Content-Type`
**What goes wrong:** Setting `Content-Type: multipart/form-data` by hand omits the `boundary=...`; the backend can't parse the parts → 400/422.
**How to avoid:** Pass a `FormData` body to `fetch` and set **no** `Content-Type` header (see `postFile`). The browser generates the correct boundary.

### Pitfall 7: Prod DB empty / seed data missing
**What goes wrong:** The 132 seed readings live in dev SQLite; the fresh Railway Postgres is empty, so the deployed dashboard shows the empty state until a caregiver uploads.
**How to avoid:** Decide explicitly (Runtime State Inventory row 1). If seeding prod, run the seeder once against the normalized prod URL; if not, the smoke test's upload step is what first populates it — make sure the human checklist accounts for that ordering.

### Pitfall 8: Logging leaks a secret or a health value in prod
**What goes wrong:** A stray `print`/logger call in `/auth` (the password) or `/upload` (row values / filename) violates SEC-03 / T-1-04, and shows up in Railway logs.
**How to avoid:** `/auth` logs nothing about the candidate password; `/upload` relies on the ETL's already-hygienic `RejectedRow` (reasons name the field + problem only, never the value). D-14 audit: grep the diff for `print(`/`logger.` in new code and confirm uvicorn access logs don't include bodies (they don't by default).

## Code Examples

### Example 1: `verify_token` real body (replaces the no-op)
```python
# Source: extends existing backend/app/auth.py; itsdangerous 2.2 + FastAPI Header
from fastapi import Header, HTTPException, status
from itsdangerous import URLSafeTimedSerializer, BadData
from app.config import get_settings

def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().token_secret, salt="auth-gate")

def verify_token(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        _serializer().loads(token)          # NO max_age -> non-expiring (D-02)
    except BadData:                          # BadSignature/BadData -> tampered/forged
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return None
```

### Example 2: ungated `/auth` route (issues the token), rate-limited
```python
# Source: mirrors backend/app/routers/agent.py slowapi shape; hmac stdlib
import hmac
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from app.auth import _serializer
from app.config import get_settings
from app.routers.agent import limiter          # reuse the single limiter instance

router = APIRouter()

class AuthRequest(BaseModel):
    password: str
class AuthResponse(BaseModel):
    token: str

@router.post("/auth", response_model=AuthResponse)
@limiter.limit("5/minute")                       # brute-force guard (Pitfall 5 order rules)
def auth(request: Request, body: AuthRequest) -> AuthResponse:
    if not hmac.compare_digest(body.password, get_settings().site_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return AuthResponse(token=_serializer().dumps("authorized"))
```
Wire in `main.py` **without** `verify_token` (it must be reachable to issue the token):
```python
from app.routers import auth, upload
app.include_router(auth.router)                                   # UNGATED
app.include_router(upload.router, dependencies=[Depends(verify_token)])  # gated like the rest
```

### Example 3: `/upload` route — see Architecture Pattern 3 (thin adapter over the ETL).

### Example 4: config additions
```python
# Source: extends backend/app/config.py Settings (keyless-boot pattern preserved)
site_password: str = ""      # empty default keeps local/test boot keyless (like anthropic_api_key)
token_secret: str = "dev-insecure-secret"   # overridden in prod; dev default keeps tests deterministic
# cors_origins already exists as list[str]; see Pitfall 3 for env parsing.
```

### Example 5: automated smoke-test core (D-13, curl)
```bash
# Source: SC2 "curl-verified"; run against the deployed Railway base URL
BASE="https://<app>.railway.app"
for path in /readings /stats/summary /agent /upload; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$path")
  [ "$code" = "401" ] || { echo "FAIL $path -> $code (expected 401)"; exit 1; }
done
# wrong password -> 401
curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth" \
  -H 'Content-Type: application/json' -d '{"password":"wrong"}' | grep -q 401 || exit 1
# correct password -> token, then a gated GET with the token -> 200
TOKEN=$(curl -s -X POST "$BASE/auth" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$SITE_PASSWORD\"}" | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -o /dev/null -w "%{http_code}" "$BASE/readings" -H "Authorization: Bearer $TOKEN" | grep -q 200
echo "PASS"
```
(`/readings`/`/stats` are GET but the ETL/agent are POST; the loop uses POST purely to assert the gate fires before method handling — a 401 precedes any 405. If a route returns 405 instead, switch that line to its real method; the gate still returns 401 first.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Railway Nixpacks builder | **Railpack** builder | Nixpacks deprecated (2025→2026) | New services default to Railpack; set `builder: RAILPACK` in `railway.json` if pinning. FastAPI auto-detected. `[VERIFIED: Railway docs via WebSearch]` |
| `postgresql://` + psycopg2 | `postgresql+psycopg://` + psycopg3 | psycopg3 GA | Must normalize the Railway-injected URL (Pitfall 2). `[VERIFIED: WebSearch + SQLAlchemy docs]` |
| SPA server-side 404 fallback config | Vercel `rewrites` to `/index.html` (only if using a router) | current Vercel | Avoided entirely by view-swap routing. `[CITED: vercel.com/docs rewrites]` |

**Deprecated/outdated:**
- Nixpacks on Railway — superseded by Railpack (still works, but new default is Railpack).
- Cookie sessions / `HTTPBearer` 403 default for this gate — not appropriate here (Pitfalls 4, CLAUDE.md §3).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | psycopg version `3.3.x` is current/compatible | Standard Stack | Low — CLAUDE.md STACK already specifies `psycopg[binary]` 3.3.x; verify exact patch at install with `pip index versions psycopg`. |
| A2 | slopcheck unavailable → 3 packages tagged `[ASSUMED]` | Package Legitimacy Audit | Very low — all three are decade-old ubiquitous packages named in CLAUDE.md; planner may still add a verify checkpoint. |
| A3 | Railway defaults to Railpack and auto-detects FastAPI/uvicorn | Deployment / State of the Art | Low — cross-verified via WebSearch; confirm in the Railway dashboard at deploy; explicit `startCommand` removes any doubt. |
| A4 | The real prod decision is to seed the 132 readings OR start empty | Runtime State Inventory | Medium — affects what the dashboard shows on first live load; **planner must surface this as an explicit decision task**, not assume. |
| A5 | Upload accepts `.xlsx` only (ETL uses `pd.read_excel`/openpyxl) | Architecture Pattern 3 | Low — matches `parse_omron`; if OMRON also exports `.csv`, the extension guard + a `read_csv` branch would be needed, but the ETL today is xlsx-only. Confirm accepted extensions in planning (Claude's discretion D-10). |

## Open Questions

1. **Seed prod DB or start empty?**
   - What we know: dev SQLite has the 132 seed readings; prod Postgres will be empty at first deploy.
   - What's unclear: whether the caregiver expects the historical data present on day one.
   - Recommendation: make it an explicit planning decision (A4). Seeding is a one-time `python -m app.seed` (or equivalent) against the normalized prod URL right after `alembic upgrade head`.

2. **`.csv` OMRON exports?**
   - What we know: `parse_omron` uses `pd.read_excel` (xlsx only).
   - What's unclear: whether the real OMRON export is ever `.csv`.
   - Recommendation: accept `.xlsx` for MVP (matches the ETL); document the extension guard message ("This doesn't look like an OMRON export") as the catch-all for anything else.

3. **Where does the shared `limiter` live?**
   - What we know: it's currently defined in `app/routers/agent.py` and imported by `main.py`.
   - What's unclear: whether importing it into `auth.py` from `agent.py` is acceptable coupling.
   - Recommendation: fine to import from `agent.py` (keeps one instance); or lift `limiter` to a small `app/ratelimit.py` if the planner prefers a neutral home. Either keeps `app.state.limiter` single.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | backend | ✓ | 3.12 | — |
| Node.js | frontend build | ✓ (Vite 8 in repo) | 22 LTS expected | — |
| itsdangerous | token sign/verify | ✗ | — (add 2.2.*) | none — blocking; must install |
| python-multipart | `UploadFile` | ✗ | — (add 0.0.*) | none — blocking; FastAPI errors without it |
| psycopg[binary] | Railway Postgres | ✗ | — (add 3.3.*) | SQLite dev needs none; blocking for prod only |
| Railway account/CLI | backend + DB deploy | external | — | Render paid (equivalent fallback per CLAUDE.md) |
| Vercel account/CLI | frontend deploy | external | — | any static host serving `dist` |

**Missing dependencies with no fallback:** `itsdangerous`, `python-multipart` (install into backend venv + add to `pyproject.toml`). `psycopg[binary]` blocking for prod deploy only.
**Missing dependencies with fallback:** Railway → Render paid; Vercel → any static host.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 9.1.1 (`[VERIFIED: pip list]`), FastAPI `TestClient` (httpx 0.28.1) |
| Framework (frontend) | Vitest 4.1.10 + @testing-library/react (`[VERIFIED: package.json]`) |
| Config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` (`addopts = -m 'not live'`); `frontend/vite.config.ts` `test` block |
| Quick run command | `cd backend && .venv/bin/pytest tests/test_auth_upload.py -x` |
| Full suite command | `cd backend && .venv/bin/pytest` ; `cd frontend && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Every gated route → 401 without a valid Bearer token | unit | `pytest tests/test_auth_upload.py -k "requires_token" -x` | ❌ Wave 0 |
| SEC-01 | `/auth` correct password → signed token; wrong → 401 | unit | `pytest tests/test_auth_upload.py -k "auth" -x` | ❌ Wave 0 |
| SEC-01 | valid token → gated route 200 | unit | `pytest tests/test_auth_upload.py -k "valid_token" -x` | ❌ Wave 0 |
| API-03 | `/upload` xlsx → `IngestSummary`; re-upload → all `unchanged` (idempotent no-op) | unit | `pytest tests/test_auth_upload.py -k "upload" -x` | ❌ Wave 0 |
| API-03 | non-OMRON / bad file → 400 friendly, ingests nothing (never 500) | unit | `pytest tests/test_auth_upload.py -k "reject" -x` | ❌ Wave 0 |
| SEC-01 | `/auth` rate limit → 6th request/min = 429 | unit | `pytest tests/test_auth_upload.py -k "rate_limit" -x` | ❌ Wave 0 |
| DASH-10 | Upload page renders plain-language summary + expandable rejects | component | `npm run test -- UploadPage` | ❌ Wave 0 |
| SEC-01 | LoginGate blocks render until token present; logout clears + returns to gate | component | `npm run test -- LoginGate` | ❌ Wave 0 |
| SEC-01 | `client.ts` attaches Bearer header; 401 → logout | unit | `npm run test -- client` | ❌ Wave 0 |
| DEPL-02 / SC2 | Live: every route 401 without token (curl) | smoke (automated) | `bash scripts/smoke.sh` (Example 5) against Railway URL | ❌ Wave 0 |
| DEPL-02 / SC1,3,4 | Live: log in, view all charts, voice/text command updates dashboard, upload a file | manual-only | human checklist (voice can't be driven headlessly — D-13) | n/a |
| SEC-03 / SC5 | No trackers; DB not public; no health values/transcripts in logs | manual-only + grep | grep diff for trackers/`print`; Railway networking check; log review | n/a |

### Sampling Rate
- **Per task commit:** `pytest tests/test_auth_upload.py -x` (+ the touched frontend `npm run test -- <file>`).
- **Per wave merge:** full `pytest` + `npm run test` (catches the Pitfall 1 regression across the existing 3 API test files).
- **Phase gate:** full suite green + `scripts/smoke.sh` PASS against the live Railway URL + human checklist signed off before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/test_auth_upload.py` — real `verify_token`, `/auth`, `/upload`, rate-limit, idempotent re-upload (covers SEC-01, API-03).
- [ ] `backend/tests/conftest.py` — **edit** the `client` fixture to add `app.dependency_overrides[verify_token] = lambda: None` (Pitfall 1; unblocks the existing 3 API test files).
- [ ] `frontend/src/components/LoginGate.test.tsx`, `UploadPage.test.tsx` — gate + summary/reject rendering.
- [ ] `frontend/src/api/client.test.ts` (or extend existing) — Bearer header + 401→logout.
- [ ] `scripts/smoke.sh` — the D-13 automated curl script (Example 5).
- [ ] No framework install needed — pytest + Vitest already present.

## Security Domain

**ASVS Level 1** (`security_asvs_level: 1`, `security_block_on: high`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Shared-password check via `hmac.compare_digest`; slowapi 5/min brute-force limit on `/auth`. |
| V3 Session Management | yes (deliberately relaxed) | itsdangerous signed Bearer in localStorage, **no expiry** (D-02, documented accessibility tradeoff). Logout = client-side token clear (D-03). |
| V4 Access Control | yes | Single router-level `Depends(verify_token)` gates every data route incl. `/agent` + `/upload`; `/auth` is the sole intentional exception. |
| V5 Input Validation | yes | Pydantic on `/auth` body; `/upload` extension guard + ETL `max_rows` DoS cap + per-row validation (existing); friendly-error mapping never echoes input. |
| V6 Cryptography | yes | itsdangerous HMAC signing — **never hand-rolled**; `TOKEN_SECRET` from env only; timing-safe compare. |
| V7 Error Handling / Logging | yes | Never-500 discipline; no secrets/health values in logs (T-1-04, D-14). |
| V9 Communications | yes | HTTPS enforced by Vercel + Railway (platform TLS); CORS allow-list to the exact Vercel origin, no credentials, no wildcard. |
| V12 Files/Resources | yes | `.xlsx` extension guard, size/row cap; file buffered to a spooled temp, never persisted to disk unmanaged. |

### Known Threat Patterns for FastAPI + React Bearer gate
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password brute force on `/auth` | Spoofing | slowapi 5/min per-IP + constant-time compare (`hmac.compare_digest`). |
| Token forgery/tampering | Spoofing/Tampering | itsdangerous signature (`BadData` → 401); `TOKEN_SECRET` never shipped to client. |
| Timing attack on password | Information Disclosure | `hmac.compare_digest`, never `==`. |
| Upload DoS (huge/malicious file) | Denial of Service | Extension guard + ETL `max_rows` cap + size limit; broad-except → 400, never 500. |
| CORS misconfiguration (data leak to other origins) | Information Disclosure | Explicit `cors_origins` allow-list, no `allow_credentials`, no wildcard (locked). |
| Secret/health-value leakage in logs | Information Disclosure | No logging of password/file/rows; ETL `RejectedRow` reasons value-free (D-14 audit). |
| Public Postgres exposure | Information Disclosure/Tampering | Railway private networking (`postgres.railway.internal`); do NOT enable a public TCP proxy (SEC-03). |
| Missing token returns 403 not 401 (auth bypass illusion) | (correctness/verification) | Manual header parse → explicit 401 (Pitfall 4); smoke test asserts 401. |

## Deployment (DEPL-01) — concrete config

**Railway (backend + Postgres):**
- Provision Postgres → `DATABASE_URL` injected (private `postgres.railway.internal` form; keep it private, do **not** add a public TCP proxy → SEC-03).
- Builder: Railpack (default; Nixpacks deprecated). FastAPI/uvicorn auto-detected.
- Start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` (runs the migration on deploy against the normalized injected URL, then serves). Root dir = `backend`.
- Env vars (values not in git): `ANTHROPIC_API_KEY`, `SITE_PASSWORD`, `TOKEN_SECRET`, `CORS_ORIGINS` (as JSON array or comma-split per Pitfall 3). `DATABASE_URL` injected.
- `pyproject.toml` gains `itsdangerous`, `python-multipart`, `psycopg[binary]` → Railway installs them on build.

**Vercel (frontend):**
- Root directory = `frontend`; build `npm run build`; output `dist` (Vite default — auto-detected).
- Env: `VITE_API_URL=https://<app>.railway.app` (baked at build time — a change requires a rebuild).
- No `vercel.json` needed with view-swap routing. (If react-router is later chosen, add the `/(.*) → /index.html` rewrite.)

**CORS:** set `CORS_ORIGINS` to the exact Vercel production origin (e.g. `https://<app>.vercel.app`). The existing `main.py` middleware already reads `get_settings().cors_origins`, GET+POST, `Authorization`+`Content-Type` headers, no credentials — nothing to change but the env value.

## Sources

### Primary (HIGH confidence)
- Local codebase (read directly): `backend/app/{auth,main,config,deps,etl,db}.py`, `backend/app/routers/{agent,stats}.py`, `backend/tests/{conftest,test_agent_route,test_api_readings}.py`, `backend/pyproject.toml`, `frontend/src/api/client.ts`, `frontend/src/{App,main}.tsx`, `frontend/src/components/Header.tsx`, `frontend/package.json`, `frontend/vite.config.ts` — the reuse contracts and the Pitfall-1 test evidence.
- `pip list` / `pip index versions` (2026-07-21): fastapi 0.139.0, slowapi 0.1.10, sqlalchemy 2.0.51, alembic 1.18.5, pytest 9.1.1 installed; itsdangerous 2.2.0, python-multipart 0.0.32 latest & NOT installed; psycopg NOT installed. HIGH.
- CLAUDE.md §3 (Bearer, not cookies), §4 (CORS + deployment, env var list, start command), §Supporting Libraries (itsdangerous/python-multipart/slowapi). HIGH.
- Python stdlib `hmac.compare_digest` [docs.python.org]. HIGH.

### Secondary (MEDIUM confidence)
- Railway docs / community (WebSearch 2026-07-21): Railpack over deprecated Nixpacks, `DATABASE_URL` injection, private networking, FastAPI start command. MEDIUM-HIGH.
- SQLAlchemy + psycopg3 `postgresql+psycopg://` scheme requirement (WebSearch + SQLAlchemy docs). MEDIUM-HIGH.
- Vercel SPA rewrites for client-side routing (WebSearch, Vercel community/docs). MEDIUM (only relevant if react-router is chosen).

### Tertiary (LOW confidence)
- itsdangerous exact 2.2 API surface (`URLSafeTimedSerializer.dumps/loads`, `BadData`) — from training knowledge, consistent with the pinned 2.2.0; verify signatures at implementation with a quick REPL check. Tagged where used.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against the live venv + PyPI; the three adds are canonical and CLAUDE.md-named.
- Architecture: HIGH — every seam read directly in-repo; the ETL already accepts a buffer by design.
- Pitfalls: HIGH for the test-breakage (verified the 3 files make unauthenticated calls) and the URL/CORS parsing gotchas (cross-verified); MEDIUM on Railway builder specifics (confirm in dashboard at deploy).

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (stack is pinned; Railway/Vercel platform UI may drift — re-confirm builder/start-command at deploy time)
