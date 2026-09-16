# Phase 19: Guest Demo Mode - Research

**Researched:** 2026-09-15
**Domain:** Auth-gate extension (FastAPI/Pydantic-settings), second-deployment mechanics (Railway/Vercel dashboards), synthetic data generation (Python/stdlib), runtime frontend feature-flagging (React/TanStack Query)
**Confidence:** HIGH (existing-code mechanics, verified by direct reading) / MEDIUM (Railway/Vercel current dashboard UX, verified by external search, not hands-on — no CLI access in this environment)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Isolation model (locked)**
- **D-01:** A SEPARATE deployment — a second Railway backend service + second Vercel frontend
  project — pointed at its own fresh demo Postgres DB. NOT shared-DB row-tagging. Same codebase,
  new env vars only. Chosen specifically to avoid the extra schema/query-filtering surface area
  where a missed filter could leak Chris's real data into a guest's view.
- **D-02:** Because the executing agent has no Railway/Vercel CLI access, the phase's deliverable
  is code + config + literal step-by-step instructions (env vars to set, migration + seed commands
  to run) for the user to execute in the Railway/Vercel dashboards themselves — not a live
  deployment.

**Guest access is read-only (locked)**
- **D-03:** Guests can use everything read/query-oriented: all GET routes and the `/agent`
  voice-command endpoint (confirmed: `/agent` only drives dashboard view state, never mutates a
  health record — see `backend/app/agent/schemas.py`). The 4 mutating routes (`POST /upload`,
  `POST /labs`, `POST /incidents`, `POST /procedures`) must reject a guest token with a friendly
  403, never a 500, never a distinct-looking error from any other rejection.
- **D-04 (defaulted):** In demo mode, hide the write-oriented UI entirely — the upload control and
  the labs/incidents/procedures "add record" forms/entry points don't render at all for a guest —
  rather than showing them and surfacing the 403 on submit.

**Demo data must cover all four tables, not just readings (locked)**
- **D-05:** The existing synthetic-data pipeline (`backend/scripts/generate_sample.py` →
  `backend/sample_data/omron_sample.xlsx`, consumed by `backend/app/seed.py`) covers `readings`
  ONLY. Synthetic demo data for labs, incidents, and procedures must also exist, committed in the
  repo, so that both (a) the hosted guest demo and (b) anyone who clones the repo and runs a local
  install/seed see a fully populated dashboard across every data type. User's own words: "Lets
  provide demo lab, incidents, and procedures in the github repo for people to install and test."
- **D-06:** Follow the same synthetic-data discipline already established for readings (seeded
  deterministic RNG, byte-identical repeated runs, no dependency on the gitignored real `data/`
  directory, explicit "SYNTHETIC DEMO DATA ONLY" framing) for whatever generates the
  labs/incidents/procedures synthetic rows. Values should be plausible/varied, not placeholder junk.
- **D-07:** Because seeding is a one-time action and guests are read-only, there is no
  data-drift/reset problem to solve. No reset mechanism is in scope.

**Demo indicator (locked)**
- **D-08:** A persistent, small, calm visual badge indicates guest/demo mode (e.g. "Guest Demo ·
  Synthetic Data") so nobody mistakes fabricated numbers for a real person's health data.
  Style/wording specifics are Claude's discretion; the badge's presence, persistence, and
  demo-mode-only visibility are locked.

**Auth/config mechanism shape (proposed during investigation — validated below, not re-litigated)**
- ONE new optional `site_username` setting. Unset (Chris's real deployment): behavior byte-for-byte
  unchanged. Set (the demo deployment): `/auth` requires a matching username too, AND the same
  single env var drives (a) the write-route 403 guard, (b) the frontend hiding write UI (D-04), and
  (c) the demo badge (D-08) — one env var is the single source of truth for "this is the demo,"
  never a second, independently-set flag that could drift out of sync.

**Credential values**
- **D-09:** No literal guest username/password value is fixed by this discussion or committed to
  git — same pattern as `SITE_PASSWORD` (`.env.example` documents the env var name with a
  placeholder only).

**Security patterns to carry forward (constraints on HOW to implement)**
- **D-10:** Any new credential compare MUST fail closed on empty/unconfigured, MUST compare
  constant-time on utf-8 BYTES (not `str`), and MUST NOT ever appear in a logged error
  (`hide_input_in_errors=True` must keep covering any new `Settings` field).
- **D-11:** Any new tests touching `Settings`/`/auth` MUST follow the established `conftest.py`
  module-level ambient-`.env` isolation and the fail-first test convention (observe the regression
  test FAIL against pre-fix code first).

### Claude's Discretion
- Exact badge wording/placement/styling (D-08) — already resolved by `19-UI-SPEC.md`.
- Exact literal env var name(s) and whether the mechanism is exactly the single-env-var shape
  sketched above, or something cleaner once in the code.
- Exact shape/volume of the synthetic labs/incidents/procedures generator (D-05/D-06).
- Exact content/depth of the deploy instructions (D-02) — README section vs a new DEPLOY.md vs
  `.env.example` comments is implementation detail.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. The data-drift/reset question resolved itself via
D-03/D-07 (read-only guests can't drift a dataset) rather than being deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

No formal `REQUIREMENTS.md` exists for this ad hoc, client-driven phase (2026-09-15, "add a working
demo version that people who are viewing can use"). `19-CONTEXT.md`'s locked decisions D-01 through
D-11 are the authoritative requirement set, per the orchestrator's framing.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Separate Railway service + Vercel project + fresh Postgres, no shared-DB tagging | "Second-Deployment Mechanics" — literal Railway/Vercel dashboard flow confirmed via WebSearch; no schema/migration change needed (labs/incidents/procedures tables already migrated empty in v1) |
| D-02 | Code + config + literal deploy instructions only (no live deploy by this agent) | "Second-Deployment Mechanics" gives the exact env-var inventory and step sequence; see Code Examples for a boot-time auto-seed mechanism that removes the need for dashboard shell/CLI access entirely |
| D-03 | 4 mutating routes reject guest with 403; GET + `/agent` stay open | "Auth Mechanism Shape" — confirmed `/agent`'s command set is 100% view-state (no mutation path, `backend/app/agent/schemas.py`); per-route (not router-level) guard design given labs/incidents/procedures routers mix GET+POST |
| D-04 | Hide write UI entirely in demo mode | Satisfied by `19-UI-SPEC.md`'s Header.tsx conditional; research confirms no other route reaches UploadPage/AddRecordPage (`store/view.ts` is plain in-memory, no router) |
| D-05/D-06 | Synthetic labs/incidents/procedures data, committed, seeded-RNG discipline | "Synthetic Data Extension" — field shapes read from `models.py`/`schemas.py`; no ETL exists for these 3 tables (direct ORM insert, not xlsx), so the generator is simpler than `generate_sample.py`, not an xlsx clone |
| D-07 | No reset mechanism needed | Confirmed — read-only guests, idempotent seed |
| D-08 | Demo badge | Fully specified in `19-UI-SPEC.md`; research confirms the `demo: bool` source field |
| D-09 | No literal credential value committed | `.env.example` extension pattern confirmed |
| D-10 | Fail-closed, constant-time-bytes compare, no secret in logs | "Security Domain" + Code Examples mirror `routers/auth.py`'s existing pattern exactly |
| D-11 | Fail-first tests, conftest module-level isolation | "Validation Architecture" — exact new/extended test files enumerated |
| Auth mechanism shape (unconfirmed) | `site_username` single source of truth | "Auth Mechanism Shape" section below — validated against live code, refined (write-guard doesn't need to decode the token at all — see rationale) |
| Frontend demo detection (unconfirmed) | Runtime flag off `/health`, no build-time branch | "Frontend Runtime Detection" section below — recommends a plain `useEffect` fetch instead of the UI-SPEC's literal `useHealth()` suggestion, to avoid breaking 5 existing test call sites; documents the tradeoff explicitly |
</phase_requirements>

## Summary

This phase is three separable problems wearing one badge: (1) a small, well-contained auth
extension to an already-hardened gate, (2) a synthetic-data generation problem for three tables
that have never had synthetic data because they've never had an ETL — they're POST-body-shaped,
not spreadsheet-shaped, so the "mirror `generate_sample.py`" instruction from CONTEXT.md needs
translation, not literal imitation — and (3) a deploy-mechanics documentation problem with no
existing precedent in this repo (there is no README/DEPLOY section on Railway/Vercel deployment at
all today).

The auth mechanism CONTEXT.md sketched is confirmed correct and can be simplified further than
proposed: because isolation is achieved via **separate deployments** (D-01), the write-route guard
never needs to decode identity from the Bearer token. `verify_token` stays completely untouched.
The new guard is a second, independent, per-route dependency that reads exactly one thing —
`bool(get_settings().site_username)` — and 403s unconditionally when true, because on the demo
deployment *every* successfully authenticated caller is, by construction, a guest. This removes an
entire class of token-payload-design decisions from scope.

The deploy-mechanics gap turns out to have a clean solution that avoids the "no CLI/shell access"
problem for the *user* as well as this agent: gate a boot-time auto-seed step in `start.sh` behind
the same `SITE_USERNAME` env var, idempotent per table (skip if already populated). The user's whole
manual task becomes "set 5 env vars in two dashboards and redeploy" — no shell, no `railway run`,
no manual seed command required, though the manual path is also documented as a fallback.

The frontend integration point flagged by `19-UI-SPEC.md` (pre-auth `/health` fetch vs. the locked
"no fetch before login" test) is real and slightly bigger than the UI-SPEC's own note suggests: it's
not just one assertion, it's also 5 other `render(<LoginGate />)` calls in the same test file that
have no `QueryClientProvider` ancestor and would throw if `LoginGate` called the existing
`useHealth()` TanStack Query hook directly. This research recommends a plain `useEffect` fetch via
the raw `getHealth()` client function instead — same single-source-of-truth runtime detection,
smaller test blast radius.

**Primary recommendation:** Add `Settings.site_username: str = ""` (config.py), a second,
independent `reject_if_demo` dependency attached per-route to the 4 mutating handlers (not
`verify_token`, not router-level), extend `/auth` and `/health` minimally, generate a single
committed JSON fixture for labs/incidents/procedures consumed by an extended `app/seed.py`, and gate
a boot-time auto-seed in `start.sh` behind `SITE_USERNAME` so the second deployment is
self-populating on first boot with zero shell access required.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Guest username+password check | API / Backend | — | Extends `/auth`'s existing constant-time compare; no client-side credential logic (mirrors the existing password-only gate) |
| Write-route 403 guard | API / Backend | — | Pure Settings read + per-route `Depends()`; never touches the token, never touches the DB |
| Demo-mode detection (badge, hidden write UI, conditional login field) | Browser / Client | API / Backend (source of truth) | SPA with no SSR tier — React reads a boolean surfaced by the backend's `/health`; the backend Settings value is the only place "is this the demo" is decided |
| Synthetic labs/incidents/procedures data | Database / Storage | API / Backend (CLI seeder) | The data itself lives in Postgres/SQLite; `app/seed.py` (backend code, CLI-invoked) is the only write path — no runtime API generates it |
| Deployment isolation (separate service/DB/project) | Infrastructure (Railway/Vercel project boundary — outside the 5-tier model) | Database / Storage | Not a runtime app capability; a provisioning decision. Full isolation is best achieved with a **second Railway project** (not a second service inside the existing project), since Railway's private networking is scoped per-project — a second service in the *same* project would share that network scope with Chris's real Postgres even though credentials differ |

## Auth Mechanism Shape (validated + refined)

Confirmed by reading `backend/app/config.py`, `backend/app/routers/auth.py`, `backend/app/auth.py`,
`backend/app/main.py` directly.

**Current state (unchanged by this phase):**
- `Settings.site_password: str = ""` — the one shared secret. `/auth` compares it constant-time on
  utf-8 bytes, fails closed on empty (per the 260913-gcv hardening), issues a signed
  `itsdangerous` token whose PAYLOAD IS LITERALLY THE STRING `"authorized"` — it carries **zero**
  identity or role information today.
- `verify_token` (in `app/auth.py`) is attached at **router-level only** via
  `dependencies=[Depends(verify_token)]` in `app/main.py` — this is documented in `main.py`'s own
  docstring as a pinned decision. It validates the signature only; it never inspects payload content
  beyond "does this decode/verify."
- `labs.py`, `incidents.py`, and `procedures.py` routers each carry **both** a `GET` and a `POST`
  route in the same `APIRouter()` — so a router-level guard would incorrectly block the `GET`
  routes too. `upload.py`'s router has only the one `POST` route, but for consistency the same
  per-operation attachment pattern should be used there as well (no special case for one router).

**Key simplification found in this session (not in CONTEXT.md's sketch):** because D-01 mandates a
*separate deployment* rather than shared-DB row-tagging, there is no scenario where a single running
process must distinguish "this particular caller is a guest" from "this particular caller is
Chris/a caregiver" — on the demo deployment, **every** valid token belongs to a guest, because
that's the only kind of account that deployment issues. This means:

- The write-guard dependency does **not** need to decode, inspect, or add a claim to the Bearer
  token payload at all. `_serializer().dumps("authorized")` in `routers/auth.py` stays byte-for-byte
  unchanged.
- The guard is a pure `Settings` read: `if get_settings().site_username: raise HTTPException(403, ...)`.
- This keeps `verify_token` (and its own pinned "401, never 403" docstring/invariant) completely
  untouched — the new guard is a **second, independent** dependency, deliberately returning **403**
  (not 401), which is the first 403 this codebase emits. Flag this explicitly in code comments so a
  future reader doesn't "fix" it to match `verify_token`'s 401 convention — they mean different
  things (401 = not authenticated at all; 403 = authenticated, but this deployment forbids writes).

**Dependency ordering:** FastAPI resolves router-level `dependencies=[...]` before route-decorator-
level ones for a given operation in current versions (0.139.x) — in practice this means an
unauthenticated caller on the demo deployment still gets 401 (no token → `verify_token` fires
first), and only an authenticated demo caller attempting a write gets 403. This ordering is
consistent with FastAPI's dependency-injection model but is not something officially pinned in the
public API contract — **write a test asserting the order** (401 with no token even against a
write route on the demo deployment; 403 with a valid token) rather than relying on it silently.
[ASSUMED — training-knowledge on FastAPI dependency resolution order, not verified against the
0.139.x changelog this session]

**`/auth` extension:**
```python
class AuthRequest(BaseModel):
    password: str
    username: str | None = None  # only required/checked when site_username is configured
```
Compare logic (constant-time bytes, matching D-10 exactly):
```python
configured_user = get_settings().site_username
configured_pass = get_settings().site_password
user_ok = (
    not configured_user
    or hmac.compare_digest((body.username or "").encode("utf-8"), configured_user.encode("utf-8"))
)
pass_ok = bool(configured_pass) and hmac.compare_digest(
    body.password.encode("utf-8"), configured_pass.encode("utf-8")
)
if not (user_ok and pass_ok):
    raise HTTPException(status_code=401, detail="unauthorized")  # same opaque 401, both directions
```
This naturally fails closed: if `site_username` is set and `body.username` is missing/wrong,
`compare_digest` returns `False` (different content/length) — no special-case branch needed. The
existing "opaque 401, no hint which field" discipline (never say which credential was wrong) is
preserved automatically by folding both checks into one boolean.

**`/health` extension:**
```python
"demo": bool(get_settings().site_username),
```
Add alongside `status`, `agent_configured`, `agent_reachable`. **This field is not a secret** — it's
already how the frontend detects the read-only mode it's operating in.

## Second-Deployment Mechanics (D-01/D-02)

No existing precedent in this repo — `README.md` documents local dev setup only; there is no
Railway/Vercel deployment section anywhere in git today (`.env.example`'s "Railway note" comments
are the closest thing that exists). This phase is the first time deploy mechanics get written down
at all.

**Confirmed via WebSearch (current Railway/Vercel dashboard docs, MEDIUM confidence — no hands-on
verification possible in this environment):**

- **Railway**: importing the same GitHub repo again creates a new project; each service within a
  project gets its own "Root Directory" setting in the dashboard (Settings tab) — this repo's
  existing service presumably already has Root Directory = `backend` given `backend/railway.json`
  and the root-level `railway.json` are byte-identical (the root copy looks vestigial/unused if
  Root Directory is set; worth the planner confirming which one Railway is actually reading before
  assuming either can be deleted). A **new Railway project** (not a second service inside the
  existing project) is the safer isolation boundary — Railway's private networking
  (`postgres.railway.internal`) is scoped per-project, so a second service in the *same* project
  would sit on the same private network as Chris's real Postgres even though it would use different
  connection credentials. [MEDIUM — WebSearch verified against docs.railway.com, not hands-on]
- **Vercel**: importing the same GitHub repo again creates a genuinely separate Project with its own
  URL, its own env vars, and its own independent deploys — exactly matching "second Vercel frontend
  project" in D-01's own wording. Root Directory is set to `frontend` in the new project's settings,
  identically to (presumably) how the existing project is configured. [MEDIUM — same caveat]
- Sources: [Railway monorepo deploy guide](https://docs.railway.com/guides/deploying-a-monorepo),
  [Railway services docs](https://docs.railway.com/services),
  [Vercel monorepo docs](https://vercel.com/docs/monorepos),
  [Vercel Academy — deploy both apps](https://vercel.com/academy/production-monorepos/deploy-both-apps)

**No schema/migration change is required for this phase.** `lab_results`, `incidents`, and
`procedures` tables already exist in every migration history (`models.py`'s own comment: "Future
tables (DATA-06): migrated but intentionally EMPTY in v1"). A fresh demo Postgres DB gets the full
schema for free from `alembic upgrade head`, which `start.sh` already runs on every boot.

**Env var inventory for the second deployment** (extends `backend/.env.example`'s existing
documented set — same names, different values, set only in the Railway dashboard, never in git):

| Var | Chris's real deployment | Demo deployment |
|-----|--------------------------|------------------|
| `DATABASE_URL` | Railway-injected (real Postgres) | Railway-injected (fresh demo Postgres — a **new** Postgres plugin in the new project) |
| `ANTHROPIC_API_KEY` | (inert today, AGENT-01) | Same value or empty — `/agent` degrades identically either way; no reason to spend real credits on demo traffic if/when funded |
| `SITE_PASSWORD` | real shared password | a new, distinct guest password |
| `SITE_USERNAME` | **unset** (new field; empty = today's behavior, byte-for-byte) | a new guest username |
| `TOKEN_SECRET` | existing real secret | a **freshly generated, distinct** secret (`python -c "import secrets;print(secrets.token_urlsafe(32))"`) — never reuse Chris's real one across deployments |
| `CORS_ORIGINS` | `["https://<real-app>.vercel.app"]` | `["https://<demo-app>.vercel.app"]` — the demo Vercel URL, not the real one |
| `VITE_API_URL` (frontend, Vercel dashboard) | real Railway backend URL | demo Railway backend URL |

**Boot-time auto-seed (recommended — removes the CLI/shell-access problem entirely):** see Code
Examples below. Gate a `python -m app.seed` invocation inside `start.sh` behind
`SITE_USERNAME` being non-empty, so it **only ever runs on the demo deployment** — Chris's real
deployment never sets `SITE_USERNAME`, so this code path is dead there, permanently, with no second
flag to remember to unset. Idempotent per table (skip if already populated) so it's safe to leave
running on every redeploy.

**Literal instruction sequence for the user (to live in the deploy doc, D-02):**
1. Railway dashboard: New Project → Deploy from GitHub repo → select this repo.
2. Set the service's Root Directory to `backend` (Settings tab).
3. Add a Postgres plugin to the new project (provisions `DATABASE_URL` automatically).
4. Set `SITE_PASSWORD`, `SITE_USERNAME`, `TOKEN_SECRET`, `CORS_ORIGINS` (Variables tab) — leave
   `CORS_ORIGINS` pointing at the demo Vercel URL from step 6 (circular dependency: deploy the
   backend first with a placeholder, or deploy the frontend first and come back — either order
   works since Railway restarts on every variable change).
5. Deploy. `start.sh` runs migrations, then (because `SITE_USERNAME` is set) seeds all four tables,
   then starts uvicorn.
6. Vercel dashboard: Add New → Project → import the same GitHub repo again → set Root Directory to
   `frontend` → set `VITE_API_URL` to the Railway URL from step 5 → Deploy.
7. Visit the demo Vercel URL, log in with the guest username/password from step 4, confirm the badge
   and populated dashboard.

## Standard Stack

No new external dependencies are required for this phase.

### Core (all already installed, existing project stack)
| Library | Version | Purpose | Why no new dependency |
|---------|---------|---------|------------------------|
| `hmac` (stdlib) | Python 3.12 stdlib | Constant-time credential compare | Already used in `routers/auth.py`; the guest-username compare reuses the exact same call shape |
| `pydantic-settings` | 2.14.x (installed) | New `site_username` field | Same `Settings` class, one more field |
| `itsdangerous` | 2.2.x (installed) | Bearer token signing | Unchanged — the guest guard never touches token payload |
| `json` (stdlib) | Python 3.12 stdlib | Synthetic labs/incidents/procedures fixture format | These 3 tables have no ETL/xlsx format to mirror (see Synthetic Data Extension below) — a plain committed JSON fixture is the simplest correct format, no `openpyxl`/`pandas` round-trip needed for data that was never spreadsheet-shaped |
| `random` (stdlib) | Python 3.12 stdlib | Seeded deterministic generator | Mirrors `generate_sample.py`'s `random.Random(SEED)` discipline exactly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain committed JSON fixture for labs/incidents/procedures | An `.xlsx`/CSV mirroring `generate_sample.py`'s format | Rejected — these tables are created via `POST` body (Pydantic `*Create` schemas), never via a spreadsheet import; inventing a spreadsheet format for them would add complexity (an ETL-shaped parser) for data that was never spreadsheet-shaped, with zero benefit |
| Boot-time auto-seed gated on `SITE_USERNAME` | A separate `SEED_DEMO_ON_BOOT` env var | Rejected — a second, independently-set flag is exactly the drift risk CONTEXT.md's mechanism note warns against; deriving auto-seed from the SAME flag that already means "this is the demo" has zero drift surface |
| A second Railway **project** for the demo backend | A second **service** inside Chris's existing Railway project | The service-in-same-project route is technically simpler (one dashboard) but shares the project's private network scope with Chris's real Postgres; a separate project is the stronger isolation boundary matching D-01's stated intent |

**Installation:** none — no `pip install` / `npm install` needed for this phase.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new external packages.** Every mechanism above reuses
already-installed dependencies (`hmac`, `json`, `random` from stdlib; `pydantic-settings`,
`itsdangerous` already in `backend/pyproject.toml`). The Package Legitimacy Gate (slopcheck, registry
verification) is skipped per its own scope note ("Required whenever this phase installs external
packages") — none do.

## Project Constraints (from CLAUDE.md)

- **Fixed stack** — PostgreSQL/SQLite, FastAPI, React (Vite), itsdangerous Bearer tokens, Railway +
  Vercel. This phase's second deployment must use the identical stack, not a lighter-weight
  alternative for "just a demo" — confirmed nothing in this research suggests otherwise.
- **Security: Claude agent returns JSON only, validated with Pydantic; never execute raw model
  output.** Unaffected — this phase touches zero agent code paths (`/agent`'s command schema is
  unchanged, confirmed view-only).
- **Security: API keys/secrets live in environment variables, never in frontend code; all Claude
  calls go through the backend.** The new `SITE_USERNAME`/guest `SITE_PASSWORD`/`TOKEN_SECRET` for
  the demo deployment follow this exactly — set in Railway dashboard only, `.env.example` documents
  names/placeholders only (D-09).
- **Privacy: no analytics trackers, no third-party data sharing, DB not publicly exposed,
  shared-password gate before the deployed site.** The demo deployment gets its OWN gate (D-01) —
  satisfies this constraint for a second audience without weakening it for the first.
- **Accessibility (non-negotiable): ≥48px targets, ≥18px body fonts, high contrast, voice-operable
  for primary actions, no drag/hover-only/precise-pointing.** Fully specified and locked by
  `19-UI-SPEC.md` for every new UI surface in this phase (badge, username field).
- **Quality: tests required for ETL derivations / BP category boundaries.** Not directly triggered
  — labs/incidents/procedures have no derived/computed columns (unlike `Reading.bp_category` etc.),
  so no new derivation logic needs unit tests. The synthetic data generator itself does need a
  regression test (mirroring `test_sample.py`'s character-pinning pattern), covered in Validation
  Architecture below.
- **Compatibility: voice input on Chrome/Edge and Safari/iOS.** Unaffected — `LoginGate` is already
  explicitly exempt from the voice-operable rule (the password never travels the voice path,
  restated in `19-UI-SPEC.md`); the guest username field inherits that same exemption.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────┐        ┌─────────────────────────┐
                     │   Chris's real deploy    │        │    Guest demo deploy    │
                     │ (Vercel project #1)      │        │  (Vercel project #2)    │
                     └───────────┬───────────────┘        └───────────┬─────────────┘
                                 │ VITE_API_URL=real                  │ VITE_API_URL=demo
                                 ▼                                    ▼
                     ┌─────────────────────────┐        ┌─────────────────────────┐
                     │ Railway backend #1       │        │ Railway backend #2      │
                     │ SITE_USERNAME unset      │        │ SITE_USERNAME set       │
                     └───────────┬───────────────┘        └───────────┬─────────────┘
                                 │                                    │
              POST /auth ─────► compare password only     compare username + password
                                 │                                    │
              GET /health ────► {demo:false, ...}          {demo:true, ...}
                                 │                                    │
      POST /upload,/labs, ────► verify_token → 200          verify_token → reject_if_demo → 403
      /incidents,/procedures     (writes real DB)            (never reaches the DB)
                                 │                                    │
              GET /readings, ──► verify_token → 200 ─┐    verify_token → 200 ─┐
              /labs,/incidents,                       │                        │
              /procedures, /agent                     │                        │
                                 ▼                     ▼                        ▼
                     ┌─────────────────────────┐        ┌─────────────────────────┐
                     │  Real Postgres (prod)    │        │  Demo Postgres (fresh)  │
                     │  seeded via /upload only  │        │ auto-seeded on boot via │
                     │                           │        │ python -m app.seed      │
                     │                           │        │ (SITE_USERNAME gate,    │
                     │                           │        │  idempotent per table)  │
                     └─────────────────────────┘        └─────────────────────────┘
```

A visitor's request never crosses deployment boundaries — there is no code path where a guest
token could be presented to Chris's real backend or vice versa, because the two are different
processes with different `TOKEN_SECRET` values (an itsdangerous signature from one deployment
fails verification on the other automatically, with zero extra code).

### Recommended File Changes
```
backend/
├── app/
│   ├── config.py            # + site_username field
│   ├── auth.py               # + reject_if_demo dependency (verify_token untouched)
│   ├── routers/auth.py       # AuthRequest.username; extended compare
│   ├── main.py                # /health + "demo": bool(...); per-route guard wiring
│   └── seed.py                # + seed_records() for labs/incidents/procedures, idempotent
├── scripts/
│   └── generate_demo_records.py   # new — seeded-RNG generator (mirrors generate_sample.py's discipline)
├── sample_data/
│   └── demo_records.json          # new — committed synthetic fixture (labs/incidents/procedures)
├── start.sh                        # + boot-time auto-seed gated on SITE_USERNAME
├── .env.example                    # + SITE_USERNAME entry
└── tests/
    ├── test_demo_guard.py          # new — write-route 403 coverage
    ├── test_auth_upload.py         # extend — username-required flows
    ├── test_health.py               # extend — demo field + fix existing SimpleNamespace mocks
    └── test_demo_records_sample.py  # new — mirrors test_sample.py's character-pinning pattern

frontend/src/
├── api/
│   ├── types.ts               # HealthStatus + demo: boolean
│   └── client.ts               # postAuth(password, username?)
├── components/
│   ├── LoginGate.tsx           # per 19-UI-SPEC.md — demoMode via plain fetch, not useHealth()
│   ├── LoginGate.test.tsx      # extend — fetchMock assertion + demoMode tests
│   └── Header.tsx               # per 19-UI-SPEC.md — badge + hidden write buttons
├── hooks/
│   └── useHealth.test.ts       # extend helper — add demo: false default
└── components/
    └── AgentStatusBanner.test.tsx  # extend helper — add demo: false default

DEPLOY.md (new, repo root)      # literal second-deployment instructions (D-02)
```

### Pattern: Per-route (not router-level) demo-write-guard
**What:** A second `Depends()` attached directly on the 4 `@router.post(...)` decorators, alongside
(not instead of) the router-level `Depends(verify_token)`.
**When to use:** Exactly here — `labs.py`/`incidents.py`/`procedures.py` mix `GET` and `POST` in one
router, so a router-level guard would incorrectly reject reads too.
**Example:**
```python
# app/auth.py — co-located with verify_token, same file, same shape
def reject_if_demo() -> None:
    """403 (never 401) when this deployment is guest-mode (SITE_USERNAME configured).

    Deliberately does NOT inspect the caller's token — on a demo deployment every
    valid token belongs to a guest by construction (D-01's separate-deployment
    isolation model), so there is nothing to distinguish per-request.
    """
    if get_settings().site_username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest accounts can't make changes to this demo.",
        )

# app/routers/labs.py
@router.post("/labs", response_model=LabResultOut, dependencies=[Depends(reject_if_demo)])
def create_lab(...):
    ...
```

### Pattern: Boot-time idempotent auto-seed
**What:** `start.sh` invokes `python -m app.seed` automatically, gated on the same env var that
means "this is the demo deployment" — no separate flag, no manual shell step.
**When to use:** Any deployment (like this one) where the user has no CLI access to the target
platform but the seed step must run exactly once (in effect) per environment.
**Example:** see Code Examples below.

### Anti-Patterns to Avoid
- **Encoding a role/claim into the itsdangerous token payload.** Unnecessary complexity given D-01's
  separate-deployment isolation — there's only one kind of account per deployment. Don't add this.
- **A second, independently-set env var for "is this the demo."** Exactly the drift risk CONTEXT.md
  flags; derive every demo-mode decision (write-guard, badge, auto-seed, `/health` field) from
  `SITE_USERNAME` alone.
- **Unconditionally auto-seeding on every boot regardless of deployment.** Would silently inject 132
  synthetic readings (plus labs/incidents/procedures) into Chris's real production database the
  moment anyone ever set an unrelated env var that happened to trigger a redeploy — gate strictly on
  `SITE_USERNAME`, never on "boot happened."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Guest identity distinction inside a single process | A role claim inside the Bearer token, a second "is-guest" lookup table, session state | A pure `Settings`-level boolean (`site_username` truthy) read fresh per-request via `get_settings()` | D-01's separate-deployment isolation already does the identity separation at the infrastructure level — building token-level identity duplicates work the deployment boundary already does for free |
| Deploy-mechanics documentation format | A bespoke YAML/JSON deploy manifest, an IaC tool (Terraform/Pulumi) for a 2-service hobby deployment | Plain markdown literal step list (D-02's own framing: "literal deploy/install steps") | Two dashboard-configured services is well inside the range where a markdown checklist is faster to write, faster to follow, and easier for a non-engineer user to execute than any IaC tooling; nothing in this stack (Railway Hobby / Vercel free/pro tier) exposes a declarative config API this project already uses |
| Synthetic data idempotency guard | A migration-tracked "seed version" table, a checksum-based re-seed detector | `if session.query(Model).count() > 0: skip` per table | The dataset is fixed and static (D-07 — no reset in scope); a simple non-empty check is sufficient and matches the existing `merge_readings`/`UniqueConstraint` idempotency precedent in spirit without needing a matching unique-constraint (these 3 tables have none, and adding one purely for seed idempotency would be schema change for zero product benefit) |

**Key insight:** The single biggest complexity-avoidance in this phase is recognizing that D-01's
"separate deployment" decision does almost all of the isolation work already — most of the naive
"guest demo mode" implementations one might reach for (row-level tenancy, JWT claims, feature-flag
services) exist to solve a *shared-runtime* multi-tenancy problem that this phase's own locked
architecture explicitly opted out of.

## Common Pitfalls

### Pitfall 1: Leaving boot-time auto-seed ungated would corrupt Chris's real database
**What goes wrong:** If the `start.sh` auto-seed step ran unconditionally (or behind a flag someone
forgets to unset), `python -m app.seed`'s `resolve_source()` falls back to the committed synthetic
sample whenever the gitignored `data/` directory is absent — which it always is in a fresh Railway
container, including Chris's REAL production container (which gets its real readings via the
`/upload` route, never via `python -m app.seed`). Running the seeder there would silently merge 132
fake synthetic readings into Chris's real dashboard.
**Why it happens:** `resolve_source()`'s real-vs-sample fallback (D-12 in its own docstring) was
designed for local dev convenience, not with an "auto-run on every prod boot" caller in mind.
**How to avoid:** Gate the `start.sh` auto-seed strictly on `SITE_USERNAME` being non-empty — the
exact same variable that already means "this is the demo deployment," never a second flag.
**Warning signs:** A code review or test that finds ANY path where `python -m app.seed` can run
without `SITE_USERNAME` also being checked is a regression here.

### Pitfall 2: Existing frontend test mocks will silently break when `HealthStatus` gains `demo`
**What goes wrong:** `frontend/src/hooks/useHealth.test.ts` and
`frontend/src/components/AgentStatusBanner.test.tsx` both build a `health()` helper —
`{ status: "ok", agent_configured: true, agent_reachable: true, ...overrides }` — that is typed
against (or passed where TypeScript infers) `HealthStatus`. Adding `demo: boolean` as a
**required** field to that type makes `tsc -b` (part of `npm run build`) fail at both helper
definitions until `demo: false` is added to each.
**Why it happens:** Easy to add the field to `api/types.ts` and the LoginGate/Header consumers
without grepping for every existing object literal typed against the old shape.
**How to avoid:** `grep -rn "agent_configured" frontend/src` before touching `types.ts`; update both
helpers in the same commit.
**Warning signs:** `tsc -b` failing on files this phase didn't intend to touch.

### Pitfall 3: The equivalent backend test-mock break is easy to miss too
**What goes wrong:** `backend/tests/test_health.py` has three tests that `monkeypatch.setattr(main,
"get_settings", lambda: SimpleNamespace(anthropic_api_key=...))` — a `SimpleNamespace` with only
one attribute set. The moment `health()` in `main.py` reads `get_settings().site_username`, these
tests raise `AttributeError` (Python doesn't error on `SimpleNamespace` attribute access until the
attribute is actually read, so this fails at test-run time, not at written-code time).
**Why it happens:** Same root cause as Pitfall 2 — a partial mock object that predates the field
being added.
**How to avoid:** Add `site_username=""` to all three `SimpleNamespace(...)` constructions in
`test_health.py` in the same commit that adds the field to `health()`'s response.
**Warning signs:** `pytest tests/test_health.py` failing with `AttributeError: 'SimpleNamespace'
object has no attribute 'site_username'`.

### Pitfall 4: `render(<LoginGate />)` without `QueryClientProvider` breaks if `useHealth()` is reused literally
**What goes wrong:** `LoginGate.test.tsx` has 5 separate `render(<LoginGate />)` calls (the
"keyboard ritual" describe block) with no `QueryClientProvider` ancestor — only the "App auth gate"
describe block wraps in one. If `LoginGate.tsx` calls the existing `useHealth()` hook (a TanStack
Query `useQuery`) directly, per the UI-SPEC's literal suggested mechanism, all 5 of those renders
throw "No QueryClient set, use QueryClientProvider to set one."
**Why it happens:** `useHealth()` was designed for `AgentStatusBanner`, always mounted deep inside
the already-`QueryClientProvider`-wrapped `Dashboard`/`App` tree; `LoginGate` is rendered standalone
in several existing unit tests.
**How to avoid:** This research recommends `LoginGate` fetch `/health` via a plain `useEffect` +
`getHealth()` (the raw client function, not the query hook) instead — avoids the
`QueryClientProvider` dependency entirely, at the cost of not sharing TanStack Query's caching (a
non-issue here: it's a single pre-auth fetch, never re-triggered). If the planner instead follows
the UI-SPEC's literal `useHealth()` suggestion, all 5 bare `render(<LoginGate />)` calls need
wrapping in a `QueryClientProvider` test helper — a larger, valid, but avoidable diff.
**Warning signs:** `npx vitest run src/components/LoginGate.test.tsx` failing with the QueryClient
error message on any of the 5 "keyboard ritual" tests.

### Pitfall 5: The pre-auth `/health` fetch weakens (does not break) the T-05-10 "no data leak" test
**What goes wrong:** `LoginGate.test.tsx`'s `"renders ONLY the LoginGate and fires NO data fetch when
no token exists"` test currently asserts `expect(fetchMock).not.toHaveBeenCalled()`. Any pre-auth
fetch — `/health` included — breaks this literal assertion even though `/health` carries zero PHI
and is already an ungated, unauthenticated-safe route.
**Why it happens:** The test was written before demo mode existed, when "zero fetches" and "zero
PHI leak" were equivalent statements. They're no longer equivalent once one ungated, PHI-free route
needs to be called pre-auth.
**How to avoid:** Update the assertion to the *actual* invariant being protected — e.g.
`expect(fetchMock).toHaveBeenCalledTimes(1)` and assert the one call's URL contains `/health`, never
`/readings` or any other PHI-bearing path. Per D-11, this is a locked-test change and needs its own
fail-first regression coverage (assert the OLD test would have failed against code that also fetches
`/readings` pre-auth, to prove the new assertion still catches a real leak).
**Warning signs:** A future PR that adds a second pre-auth fetch to a PHI-bearing route and the test
suite stays green — the assertion needs to stay specific to `/health`, not degrade to "at least one
fetch happened."

### Pitfall 6: Root `railway.json` vs `backend/railway.json` — confirm which one the second service reads
**What goes wrong:** Both files are byte-identical today. Setting up a second Railway service by
"copy what the first one does" without first confirming whether Railway's existing service actually
has a Root Directory override (making the root-level file vestigial) risks either (a) the new
service reading the wrong build config, or (b) genuinely duplicated, drift-prone config being
maintained in two places going forward.
**Why it happens:** Nothing in the repo states explicitly which file is authoritative for the
existing deployment.
**How to avoid:** Before or during the manual dashboard setup (D-02), the user should check the
existing Railway service's Settings → Root Directory value, and set the Root Directory identically
for the new service rather than relying on file duplication.
**Warning signs:** N/A — this is a one-time setup verification, not a code-testable condition.

## Code Examples

### `start.sh` — boot-time idempotent auto-seed, gated on `SITE_USERNAME`
```bash
echo "start.sh: running database migrations (alembic upgrade head)..."
"$PYTHON" -m alembic upgrade head

# Demo deployments set SITE_USERNAME (the single source of truth for "this is
# the guest demo," shared with the write-route guard and the /health flag).
# python -m app.seed is idempotent per table (readings via the existing
# merge_readings UniqueConstraint; labs/incidents/procedures via a skip-if-
# non-empty guard — see app/seed.py), so it is safe to run on every boot.
# Chris's real deployment never sets SITE_USERNAME, so this branch is dead
# code there — no second flag to remember to leave unset.
if [ -n "${SITE_USERNAME:-}" ]; then
  echo "start.sh: SITE_USERNAME is set (demo deployment) — seeding demo data..."
  "$PYTHON" -m app.seed || echo "start.sh: WARNING seed step failed (continuing boot)"
fi

echo "start.sh: starting uvicorn on port ${PORT:-8000}..."
exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
```

### `app/seed.py` — extended `main()` (idempotent per-table, runs for BOTH audiences named in D-05)
```python
def seed_records(session: Session) -> dict[str, int]:
    """Idempotently seed labs/incidents/procedures from the committed fixture.

    Skips any table that already has rows — safe to call on every boot and
    every local `python -m app.seed` run alike (D-07: no reset needed, so
    "already populated" is a terminal state, not a signal to diff/update).
    """
    import json

    fixture = json.loads((_BACKEND_DIR / "sample_data" / "demo_records.json").read_text())
    counts = {}
    for model, key in [(LabResult, "labs"), (Incident, "incidents"), (Procedure, "procedures")]:
        if session.query(model).count() > 0:
            counts[key] = 0
            continue
        rows = [model(**row) for row in fixture[key]]
        session.add_all(rows)
        counts[key] = len(rows)
    session.commit()
    return counts
```
Note: `Incident`'s constructor takes `datetime_`, not `datetime` (see `routers/incidents.py`'s own
comment on this exact mismatch) — the fixture's JSON keys and the `model(**row)` call must account
for this the same way `create_incident` does, field-by-field, not a blind `**row` for that one model.

### `app/auth.py` — the new guard, co-located with `verify_token`
```python
def reject_if_demo() -> None:
    """403 on the 4 mutating routes when SITE_USERNAME is configured (D-03).

    Deliberately 403, not 401 — verify_token already proved this caller has a
    VALID token (401 territory); this deployment simply forbids writes to
    anyone, regardless of token validity, because it issues no other kind.
    Never inspects the token itself — see 19-RESEARCH.md "Auth Mechanism
    Shape" for why a separate-deployment isolation model makes that
    unnecessary here.
    """
    if get_settings().site_username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest accounts can't make changes to this demo.",
        )
```

### `frontend/src/components/LoginGate.tsx` — demo-mode detection without `useHealth()`
```tsx
const [demoMode, setDemoMode] = useState(false);
useEffect(() => {
  getHealth()
    .then((h) => setDemoMode(h.demo))
    .catch(() => {
      /* ungated route; a failure here just means "assume real deployment" —
         the form still works, worst case the username field doesn't show */
    });
}, []);
```
`getHealth()` is the existing raw client function in `api/client.ts` — no new fetch wrapper needed,
just a new call site that bypasses the `useHealth()` hook's TanStack Query wrapping (see Pitfall 4).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | This is a greenfield feature area in this codebase — no prior "demo mode" or multi-deployment pattern exists to deprecate |

**Deprecated/outdated:** None found relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FastAPI 0.139.x resolves router-level `dependencies=[...]` before route-decorator-level dependencies for the same operation, so `verify_token` (401) fires before `reject_if_demo` (403) | Auth Mechanism Shape | If wrong, a demo-deployment caller with no token at all could theoretically see a 403 before a 401 on a write route — cosmetically wrong (still blocked either way) but worth a dedicated test rather than trusting this ordering silently |
| A2 | Railway's private networking (`postgres.railway.internal`) is scoped per-PROJECT, not per-account, making a second service inside Chris's existing project share network reachability to his real Postgres | Standard Stack / Second-Deployment Mechanics | If wrong (e.g., it's actually per-account-scoped and a new project offers no additional isolation), the "use a new project, not a new service" recommendation is over-cautious but still strictly safer — no downside to following it even if the extra isolation turns out to be unnecessary |
| A3 | Railway's dashboard does not offer a pure in-browser one-off shell/command runner without the `railway` CLI being installed somewhere (verified ambiguous in this session's WebSearch) | Second-Deployment Mechanics | This is exactly why the boot-time auto-seed (gated on `SITE_USERNAME`) is the PRIMARY recommendation rather than "open a shell and run the seed command" — if Railway's dashboard shell turns out to be more accessible than this research found, the manual path is still documented as a fallback, so being wrong here costs nothing |

## Open Questions (RESOLVED)

1. **Which `railway.json` (root vs `backend/`) does the existing production service actually read?**
   - What we know: the two files are byte-identical today.
   - What's unclear: whether Railway's existing service has an explicit Root Directory override
     (making the root-level copy vestigial) or reads the root-level file directly.
   - Recommendation: the user should check the existing service's Settings → Root Directory in the
     Railway dashboard before configuring the second service, per Pitfall 6. Not blocking — either
     answer leads to the same "set Root Directory = backend for the new service" instruction.

2. **Exact literal guest username/password values.**
   - What we know: D-09 explicitly defers these to the user, matching `SITE_PASSWORD`'s existing
     pattern — not something research or planning should invent.
   - What's unclear: nothing — this is by design, not a gap.
   - Recommendation: `.env.example` documents the var names with placeholders only; the plan should
     not hardcode a suggested value anywhere, including in the deploy doc's example commands.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Railway CLI | Standing up the second backend service | ✗ (confirmed — `command -v railway` empty) | — | Dashboard-only instructions (D-02's own framing); boot-time auto-seed removes the need for `railway run`/shell access specifically |
| Vercel CLI | Standing up the second frontend project | ✗ (confirmed — `command -v vercel` empty) | — | Dashboard-only instructions, same as above |
| `psql` | Verifying the fresh demo Postgres DB directly | ✗ (confirmed) | — | Not needed — `/health` and the seeded dashboard itself are sufficient verification once deployed; not required for this phase's code/config deliverable |

**Missing dependencies with no fallback:** None — every missing tool has a documented,
dashboard-only or code-level fallback above.

**Missing dependencies with fallback:** Railway CLI, Vercel CLI, `psql` — all three are
verification/convenience tools only; this phase's actual deliverable (code, config, and a literal
instruction document) does not require any of them to exist in this environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 9.x (`backend/pyproject.toml` `[tool.pytest.ini_options]`, `testpaths = ["tests"]`) |
| Frontend framework | Vitest 4.x (`frontend/vite.config.ts` `test: {...}`, jsdom environment) |
| Backend quick run | `cd backend && python -m pytest tests -q -k "demo or auth or health"` |
| Frontend quick run | `cd frontend && npx vitest run src/components/LoginGate.test.tsx src/components/Header.test.tsx` |
| Backend full suite | `cd backend && python -m pytest tests -q` |
| Frontend full suite | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| D-03 | 4 write routes 403 on demo deployment; GET+`/agent` unaffected | integration | `pytest tests/test_demo_guard.py -x` | ❌ Wave 0 |
| D-03 (ordering) | No-token write on demo deployment → 401, not 403 (A1) | integration | `pytest tests/test_demo_guard.py::test_missing_token_still_401_on_demo -x` | ❌ Wave 0 |
| Auth mechanism | `/auth` requires username when `site_username` set; wrong/missing username → same opaque 401 | integration, fail-first (D-11) | `pytest tests/test_auth_upload.py -x` (extend) | ✅ (extend) |
| Auth mechanism | `/health` reports `demo: bool(site_username)`, never leaks the value | unit | `pytest tests/test_health.py -x` (extend) | ✅ (extend, also fixes Pitfall 3) |
| D-05/D-06 | Committed `demo_records.json` covers realistic field shapes for all 3 tables, deterministic regen | unit, character-pinning | `pytest tests/test_demo_records_sample.py -x` | ❌ Wave 0 |
| Boot-time seed | `seed_records()` skips tables that already have rows (idempotent) | unit | `pytest tests/test_seed.py -x` | ❌ Wave 0 (no `test_seed.py` exists today at all) |
| D-04 | Header hides Upload/Add Record buttons and shows the badge when `demoMode` | component | `npx vitest run src/components/Header.test.tsx` | ❌ Wave 0 (no `Header.test.tsx` exists today) |
| D-04/UI-SPEC | LoginGate shows username field + demo copy when `demoMode`; unchanged when not | component | `npx vitest run src/components/LoginGate.test.tsx` (extend) | ✅ (extend) |
| Pitfall 5 | Pre-auth fetch stays scoped to `/health` only, never a PHI-bearing route | component, fail-first (D-11) | `npx vitest run src/components/LoginGate.test.tsx -t "no data leak"` | ✅ (extend existing test) |
| Pitfall 2 | `HealthStatus` type change doesn't silently break existing mocks | type-check | `cd frontend && tsc -b --noEmit` | ✅ (existing tsc config, no new file) |

### Sampling Rate
- **Per task commit:** the relevant quick-run command above (backend `-k` filter or frontend
  targeted file).
- **Per wave merge:** full suite both sides (`pytest tests -q` and `npx vitest run`), plus
  `tsc -b --noEmit` explicitly (Pitfall 2 is a compile-time failure, not a test failure — a full
  `npm run build` or `tsc -b` step must run, not just `vitest`).
- **Phase gate:** Full suite green both sides before `/gsd-verify-work`; the deploy instructions
  themselves are `human_needed` (no CLI access to verify a live Railway/Vercel deploy from this
  environment) — flag this explicitly in the plan's verification section rather than silently
  skipping it.

### Wave 0 Gaps
- [ ] `backend/tests/test_demo_guard.py` — write-route 403 coverage + auth-ordering assertion
- [ ] `backend/tests/test_demo_records_sample.py` — mirrors `test_sample.py`'s character-pinning
      pattern for the new `demo_records.json` fixture
- [ ] `backend/tests/test_seed.py` — did not exist before this phase at all; needs at least the new
      `seed_records()` idempotency behavior covered (no framework install needed — pytest already
      configured)
- [ ] `frontend/src/components/Header.test.tsx` — did not exist before this phase; needs badge +
      hidden-buttons coverage
- [ ] Fixture: `backend/sample_data/demo_records.json` — the committed synthetic data itself, not a
      test file, but a Wave 0 prerequisite for `test_demo_records_sample.py` and `test_seed.py` alike

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Extends the existing constant-time `hmac.compare_digest` password gate with a second, equally constant-time username compare; both fail closed on empty/unconfigured (D-10) |
| V3 Session Management | no change | Bearer token issuance/verification (`itsdangerous`) is completely untouched by this phase — no new session semantics introduced |
| V4 Access Control | yes | The core of this phase — a new per-route authorization guard (`reject_if_demo`) enforcing "read-only for this deployment," independent of and additional to authentication (`verify_token`) |
| V5 Input Validation | yes (unchanged) | `AuthRequest.username: str | None` is a plain Pydantic field; no new validation surface beyond what already exists for `password` |
| V6 Cryptography | no change | No new cryptographic primitive — reuses `hmac.compare_digest` and the existing `itsdangerous` signer verbatim |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Guest write bypass (a crafted/replayed token attempts a mutating route on the demo deployment) | Elevation of Privilege | `reject_if_demo` fires unconditionally whenever `site_username` is configured — independent of token content, so there is no token shape that bypasses it |
| Username-enumeration via distinct error messages | Information Disclosure | Both the missing-username and wrong-password cases collapse into the SAME opaque 401 `detail: "unauthorized"` — exact continuation of the existing D-10-equivalent pattern already in `routers/auth.py` |
| `SITE_USERNAME`/`SITE_PASSWORD`/`TOKEN_SECRET` leaking into boot logs on a validation failure | Information Disclosure | `Settings.model_config`'s existing `hide_input_in_errors=True` already covers any NEW field added to the same `Settings` class with zero extra code — confirmed by reading `config.py` directly |
| Accidental cross-deployment credential reuse (demo `TOKEN_SECRET` == Chris's real one) | Spoofing | Purely an operational discipline (the deploy instructions must explicitly say "generate a NEW secret, do not copy Chris's") — no code can enforce this across two independent Railway projects; call it out explicitly in the deploy doc as a MUST, in the same voice as the existing `_reject_dev_token_secret_in_deployment` boot guard's own warning |
| Boot-time auto-seed silently corrupting the wrong database | Tampering (self-inflicted, not adversarial) | Gated strictly on `SITE_USERNAME` (see Pitfall 1) — this is the single highest-consequence new risk introduced by this phase's own recommended mechanism, and it fails toward "does nothing" (dead code on Chris's deployment) rather than "does something dangerous" if the gate is ever accidentally removed |

## Sources

### Primary (HIGH confidence — direct repo reads this session)
- `backend/app/config.py`, `backend/app/routers/auth.py`, `backend/app/auth.py`,
  `backend/app/main.py` — current auth-gate mechanics, pinned invariants, boot-time guards
- `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/agent/schemas.py` — table shapes,
  Create-schema field sets, confirmation that `/agent`'s command vocabulary is 100% view-state
- `backend/app/routers/{labs,incidents,procedures,upload}.py` — router structure (GET+POST mixed),
  confirming per-route (not router-level) guard placement is required
- `backend/app/seed.py`, `backend/scripts/generate_sample.py`, `backend/sample_data/omron_sample.xlsx`,
  `backend/tests/test_sample.py` — existing synthetic-data discipline and its test-pinning pattern
- `backend/start.sh`, `backend/railway.json`, `railway.json` (root), `backend/.env.example` — deploy
  mechanics as currently configured
- `frontend/src/components/LoginGate.tsx`, `LoginGate.test.tsx`, `frontend/src/store/auth.ts`,
  `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/hooks/useHealth.ts`,
  `frontend/src/hooks/useHealth.test.ts`, `frontend/src/components/AgentStatusBanner.test.tsx`,
  `frontend/src/components/Header.tsx`, `frontend/src/App.tsx` — frontend auth/health integration
  points and their exact existing test-mock shapes
- `backend/tests/conftest.py`, `backend/tests/test_auth_upload.py`, `backend/tests/test_health.py` —
  established test-isolation and fail-first conventions (D-11) to mirror
- `.planning/quick/260913-gcv-fix-4-verified-auth-gate-and-test-isolat/260913-gcv-SUMMARY.md` — the
  most recent hardening pass on this exact surface, read in full
- `README.md` (repo root) — confirmed no existing Railway/Vercel deploy documentation anywhere

### Secondary (MEDIUM confidence — WebSearch, cross-referenced against official docs)
- [Railway — Deploying a Monorepo](https://docs.railway.com/guides/deploying-a-monorepo) — per-service Root Directory configuration
- [Railway — Services](https://docs.railway.com/services) — service/project structure
- [Railway — CLI](https://docs.railway.com/cli), [railway ssh](https://docs.railway.com/cli/ssh) — dashboard vs. CLI-based one-off command execution (ambiguous — see A3)
- [Vercel — Using Monorepos](https://vercel.com/docs/monorepos) — multiple projects from one repo
- [Vercel Academy — Deploy Both Apps](https://vercel.com/academy/production-monorepos/deploy-both-apps) — per-project Root Directory + env vars

### Tertiary (LOW confidence)
- None used as the basis for any recommendation in this document — all WebSearch findings above were
  cross-referenced against official `docs.railway.com`/`vercel.com` content before being cited.

## Metadata

**Confidence breakdown:**
- Auth mechanism / write-guard design: HIGH — derived directly from reading the live code, no
  external dependency, mirrors an already-hardened, already-tested pattern in this exact codebase.
- Synthetic data extension shape: HIGH — table/schema shapes read directly; the "no ETL exists for
  these 3 tables" finding is a direct code observation, not an inference.
- Second-deployment mechanics (Railway/Vercel dashboard flow): MEDIUM — current as of this session's
  WebSearch, cross-referenced against official docs, but not hands-on verified (no CLI/dashboard
  access in this environment) — flagged explicitly as `human_needed` verification in Validation
  Architecture.
- Frontend test-breakage findings (Pitfalls 2–5): HIGH — found by direct `grep`/read of the actual
  test files, not inferred.

**Research date:** 2026-09-15
**Valid until:** ~30 days for the code-level findings (stable, internal); ~14 days for the
Railway/Vercel dashboard-flow claims specifically, since hosting-platform dashboard UX changes
faster than this project's own code — re-verify the literal click-path in the deploy doc against
the live dashboards at execution time regardless of this research's age.
