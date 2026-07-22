# Phase 5: Upload, Auth Gate & Deployment - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The MVP goes live: caregivers add new health data through the site, and the finished app runs on the public internet behind a shared password with zero health-data exposure. Delivers API-03 (`POST /upload`), DASH-10 (caregiver upload page), SEC-01 (shared-password Bearer gate enforced on every route), SEC-03 (no analytics / DB not publicly reachable), DEPL-01 (Vercel + Railway deploy), DEPL-02 (end-to-end smoke test on the live site).

**In scope:** turn the `verify_token` router-level stub into real itsdangerous signed-token verification; a `/auth`-style password-check endpoint that issues the token; a full-screen login gate on the frontend; a dedicated caregiver upload page wired to `POST /upload` (which reuses the existing ETL); split Vercel (frontend) + Railway (backend + Postgres) deployment with env-var config and a CORS allow-list for the Vercel origin; a hybrid smoke test.

**Out of scope (belongs elsewhere / already decided):** full auth (accounts, roles, magic links) — single shared password only per PROJECT.md; any change to the agent command schema, charts, or voice layer (Phases 2–4, reused as-is); the `IngestSummary` shape (locked in Phase 1, D-06); voice data entry ("log a reading") — post-MVP; custom domain (deferred, see below).
</domain>

<decisions>
## Implementation Decisions

### Login / Password Gate (SEC-01)
- **D-01:** **Full-screen login page.** Nothing renders until the password is entered — a simple centered nautical-themed card (password field + big "Enter" button). No dashboard chrome or data leaks before auth; no blur-overlay approach (which risks flashing real data if the auth check is slow).
- **D-02:** **Token persists until manual logout.** The itsdangerous signed Bearer token (localStorage per CLAUDE.md §3) does **not** auto-expire — the caregiver logs in once on Chris's device and it stays unlocked for daily hands-free use, since Chris cannot re-enter the password himself. This is a deliberate accessibility-over-hardening tradeoff for a single-patient personal site.
- **D-03:** **A manual logout control MUST exist** (a direct consequence of D-02's no-expiry token). Logout clears the stored token and returns to the full-screen login. Placement: header (see D-05).
- **D-04:** **Login is a caregiver-only, keyboard-entry action — NOT voice-operable and NOT part of the ACC-03 "operable by voice" surface.** The caregiver types the shared password (they already tap the mic to start each session); the secret never travels the voice path. A normal password `<input>` is fine here.

### Upload Surface & Access (DASH-10)
- **D-05:** **Dedicated upload route/page** (e.g. `/upload`). Introduces lightweight client-side routing — **none exists today** (the app is a single `App.tsx` view with no router). A separate caregiver screen keeps Chris's hands-free voice dashboard uncluttered and prevents accidental upload triggers during a voice session.
- **D-06:** **Discreet caregiver controls in the header:** a modest "Upload" link and a "Log out" button in a header corner — always reachable for caregivers, visually out of the way of the large voice/chart UI.
- **D-07:** **Relaxed accessibility on the caregiver-only upload screen.** A standard OS file-picker button is acceptable here; caregivers use a mouse/trackpad. The ≥48px / no-precision-pointing / voice-operable non-negotiables exist for **Chris's daily dashboard**, not this occasional admin upload. The upload screen should still be large, high-contrast, and readable, but it is explicitly exempt from the "no precision pointing / voice-reachable" rules. (This scoping is a deliberate exception to the project-wide accessibility constraint, justified because Chris never operates upload.)

### Upload Flow & Errors (API-03)
- **D-08:** **Immediate idempotent ingest, then show the summary** — no preview/confirm step. Safe because the ETL merge is idempotent (DATA-03): re-uploading the same file is a visible no-op, so there is nothing to "undo". The response is the locked `IngestSummary` shape (added / updated / unchanged / rejected / total / latest).
- **D-09:** **Result summary reads as plain-language sentences**, matching the dashboard's friendly non-technical copy voice — e.g. "Added 12 new readings. 3 were already on file. 0 skipped. Your data now goes through June 13." Big, readable text. (Not numeric stat-tiles.)
- **D-10:** **Friendly per-row reject reporting + clear bad-file rejection.** "3 rows couldn't be read" with an **optional expandable** list of which rows and why (the ETL already returns per-row `RejectedRow` reasons). A non-OMRON / unparseable file gets a plain "This doesn't look like an OMRON export" and **ingests nothing**. Never a raw traceback, status code, or 500 — consistent with the project-wide friendly-error discipline (`ApiError` never surfaces raw text).

### Deployment & Smoke Test (DEPL-01, DEPL-02, SEC-03)
- **D-11:** **Railway** for backend + Postgres (confirmed over Render). Stays warm (no cold-start on Chris's first request), bundles Postgres with `DATABASE_URL` injected, ~$5/mo Hobby. Frontend on **Vercel**. (CLAUDE.md §4.)
- **D-12:** **Platform-provided URLs for the MVP** (`*.vercel.app` + `*.railway.app`). No DNS/cert setup now; a custom domain can be added later via `CORS_ORIGINS` + env update without code changes. Custom domain is **deferred** (see below).
- **D-13:** **Hybrid smoke test.** Automated `curl` checks prove **every** route (`/readings`, `/stats/summary`, `/agent`, `/upload`) returns **401 without a valid Bearer token** (roadmap SC2 is explicitly "curl-verified"). A short **human checklist** covers the rest on the live site — log in, view all charts, issue a voice/text command that updates the dashboard, upload a file — because voice/mic cannot be driven headlessly (consistent with Phase 4's real-device verification approach). No full Playwright E2E.
- **D-14:** **SEC-03 verification is part of this phase:** confirm no analytics/trackers/third-party embeds anywhere, the Postgres DB is not publicly reachable (Railway private networking / no public bind), and platform logs contain **no** blood-pressure values or transcripts (the `IngestSummary` and agent code already forbid logging health values — verify this holds end-to-end in prod logging).

### Claude's Discretion
- Exact login-card copy, styling, and the `/auth` password-check endpoint shape (request/response); how the token is signed/serialized with itsdangerous (timestamped signer vs plain signer — no expiry per D-02).
- The routing mechanism for D-05 (react-router vs a minimal view-state swap) — planner/researcher chooses the lightest option that fits the single-page app.
- Exact header placement/styling of the Upload + Log out controls (D-06), within the existing `Header` component.
- Upload file-size limit / accepted extensions, and the exact expandable-details UI for rejected rows (D-10).
- The precise wording of the plain-language summary and error copy (D-09/D-10), kept non-technical and large-text friendly.
- Railway/Vercel project configuration specifics, build/start commands, and the Postgres migration-on-first-deploy step (Alembic `upgrade head` against the injected `DATABASE_URL`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 5: Upload, Auth Gate & Deployment" — goal and the 5 success criteria (incl. "curl-verified" 401 on every route, re-upload no-op, CORS allow-list, live-site E2E, no health values in platform logs).
- `.planning/REQUIREMENTS.md` — API-03, DASH-10, SEC-01, SEC-03, DEPL-01, DEPL-02 exact wording; SEC-02 (already complete) for the key-custody contract that must stay intact.
- `.planning/PROJECT.md` — privacy constraints (no analytics ever, DB not publicly exposed, shared-password gate), Out of Scope list (full auth explicitly excluded).

### Stack & deployment ground rules (load first)
- `CLAUDE.md` §"3. Password gate: signed Bearer token, NOT cross-site cookies" — the locked auth model: itsdangerous signed token in localStorage, **not** cookies (Safari ITP / cross-origin Vercel↔Railway blocking rationale).
- `CLAUDE.md` §"4. CORS + deployment (Railway recommended over Render)" — env var list (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `SITE_PASSWORD`, `TOKEN_SECRET`, `CORS_ORIGINS`), start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, no `allow_credentials`, Railway-over-Render (spin-down cold-start) reasoning, `postgresql+psycopg://` URL.
- `CLAUDE.md` §"Supporting Libraries" — `itsdangerous 2.2.x` (sign timestamped token, verify in a FastAPI dependency), `python-multipart` (FastAPI `UploadFile`), `slowapi` (rate-limit `/auth` against brute force).

### Reuse contracts (existing code Phase 5 plugs into — do NOT fork)
- `backend/app/auth.py` — the `verify_token` no-op stub; its body is replaced with itsdangerous verification. Routes never change because it attaches at **router level** in `main.py`.
- `backend/app/main.py` — router-level `dependencies=[Depends(verify_token)]` on all three routers (the single enforcement point) + the locked CORS middleware wiring (explicit origins, GET+POST, no credentials, no wildcard). The `/auth` router must be added and must be **reachable without a token** (it issues the token).
- `backend/app/config.py` — `Settings` (pydantic-settings, cached `get_settings()`); extend with `site_password`, `token_secret`, and populate `cors_origins` from env for prod. Follow the existing empty-default/keyless-boot pattern.
- `backend/app/etl.py` — `parse_omron(path_or_buffer)` → `transform(raw_df)` → `merge_readings(session, clean_df, rejected)`; the upload route reuses these exactly (pure-function ETL designed for both seeder and upload). `IngestSummary` (added/updated/unchanged/rejected/total/latest) is the **locked `POST /upload` response** — do not deviate (Phase 1 D-06; "never blood-pressure values" T-1-04). `RejectedRow` carries per-row reasons for D-10.
- `backend/app/deps.py` — `get_db` session dependency (route modules must never import `SessionLocal` directly) and `ReadingFilters`.
- `frontend/src/api/client.ts` — the typed fetch wrapper (`getJson`/`postJson`, `ApiError` three-branch discipline, `VITE_API_URL` base). Add the `Authorization: Bearer <token>` header here and a 401→re-login handling path; raw errors never render.
- `frontend/src/App.tsx` + `frontend/src/components/Header.tsx` — single-view app (no router yet); the login gate wraps this and the Upload/Log-out controls live in `Header`.

### Prior-phase decisions this builds on
- `.planning/phases/02-read-api-dashboard/02-CONTEXT.md` — nautical theme + two-theme tokens (login card and upload page inherit these), guided-empty-state friendly-copy precedent, "auth dependency designed now, enforced in Phase 5, never a retrofit".
- `.planning/phases/03-agent-via-text-input/03-CONTEXT.md` — SEC-02 key-custody, friendly non-technical error copy pattern (upload errors follow it).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`backend/app/etl.py` pure-function pipeline** (`parse_omron`/`transform`/`merge_readings` + `IngestSummary`/`RejectedRow`) — the entire upload backend logic already exists and is tested; `POST /upload` is a thin `UploadFile` → buffer → these functions → return `IngestSummary` wrapper. No new ETL.
- **`backend/app/auth.py` `verify_token` + router-level attach in `main.py`** — the enforcement seam is already in place; Phase 5 flips one function body. No per-route changes.
- **`backend/app/config.py` `Settings`/`get_settings()`** — extend with `site_password`, `token_secret`; existing keyless-boot pattern is the template for optional/required env handling.
- **`frontend/src/api/client.ts`** — `postJson` handles POST + `ApiError`; extend for multipart upload and to attach the Bearer header globally.
- **Two-theme nautical design tokens + friendly-copy conventions** (Phase 2) — login card, upload page, and summary/error copy inherit these; no new design system.

### Established Patterns
- **Router-level auth dependency is the single enforcement point** — never add per-route auth; replace `verify_token`'s body only. The `/auth` (token-issuing) route is the sole exception and must sit outside the gated routers.
- **Naive local datetimes end-to-end (DATA-05)** — upload/ingest and the `latest` field in `IngestSummary` introduce no timezone conversion.
- **No health values in logs (T-1-04) / `ApiError` never surfaces raw text** — upload errors and prod logging must honor this; D-14 verifies it in production.
- **Portable SQLAlchemy 2.0 types** — same models run on SQLite (dev) and Postgres (prod); first prod deploy runs Alembic `upgrade head` against the injected `DATABASE_URL`.

### Integration Points
- New `/auth` router in `backend/app/routers/` (issues token; ungated) + new `/upload` router (gated, reuses ETL) added to `main.py`.
- Frontend gains a login gate wrapping `App`, a new `/upload` route/view, and header Upload/Log-out controls; `client.ts` attaches the Bearer token and handles 401→re-login.
- Deploy: Vercel (frontend, `VITE_API_URL` → Railway URL) + Railway (backend + Postgres, all secrets via env); `CORS_ORIGINS` set to the Vercel origin.
</code_context>

<specifics>
## Specific Ideas

- Login is deliberately a **caregiver ritual**, mirroring the existing "caregiver taps the mic to start a session" model (Phase 4 D-01) — one human sets things up, then Chris operates hands-free. Login and mic-tap are the two caregiver-initiated bookends.
- Result-summary voice, verbatim style the user endorsed: "Added 12 new readings. 3 were already on file. 0 skipped. Your data now goes through June 13."
- Bad-file rejection copy, plain and non-technical: "This doesn't look like an OMRON export" — and nothing is ingested.
- The header carries the only two caregiver-admin affordances (Upload, Log out), kept small so Chris's chart/voice UI stays dominant.
</specifics>

<deferred>
## Deferred Ideas

- **Custom domain** (e.g. chrishealth.app) — deferred to keep the MVP on platform URLs; addable later via `CORS_ORIGINS` + env with no code change (D-12).
- **Password rotation / reset flow** — out of scope for a single shared password; if the secret ever leaks, rotate `SITE_PASSWORD`/`TOKEN_SECRET` env vars and everyone re-logs in. No in-app reset UI in v1.
- **Token expiry / session hardening** — considered and declined (D-02, no-expiry for Chris's accessibility); revisit only if device-theft risk changes.
- **Full auth (accounts, roles, magic links)** — permanently out of scope per PROJECT.md (single-patient personal site).
- **Fully automated E2E (Playwright)** — considered and declined for the smoke test (D-13); voice can't be driven headlessly and it's heavy tooling for a single-user MVP.

</deferred>

---

*Phase: 5-upload-auth-gate-deployment*
*Context gathered: 2026-07-21*
