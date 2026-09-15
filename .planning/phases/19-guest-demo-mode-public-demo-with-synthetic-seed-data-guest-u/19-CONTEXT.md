# Phase 19: Guest Demo Mode - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A visitor to the portfolio project can reach a working, isolated, read-only demo of the dashboard —
its own guest username+password (distinct from Chris's real shared-password gate), synthetic data
covering all four data types (readings, labs, incidents, procedures), explorable by click or voice
exactly like the real site — without any risk of ever seeing or touching Chris's real health data.
This phase delivers the CODE and CONFIG that make such a deployment possible plus the exact
deploy/install steps; the agent running this phase has no Railway/Vercel CLI access in this
environment, so it cannot stand the second deployment up itself.

</domain>

<decisions>
## Implementation Decisions

### Isolation model (locked)
- **D-01:** A SEPARATE deployment — a second Railway backend service + second Vercel frontend
  project — pointed at its own fresh demo Postgres DB. NOT shared-DB row-tagging. Same codebase,
  new env vars only. This was explicitly chosen over a shared-DB "demo-flagged rows" approach
  specifically to avoid the extra schema/query-filtering surface area where a missed filter could
  leak Chris's real data into a guest's view.
- **D-02:** Because the executing agent has no Railway/Vercel CLI access, the phase's deliverable is
  code + config + literal step-by-step instructions (env vars to set, migration + seed commands to
  run) for the user to execute in the Railway/Vercel dashboards themselves — not a live deployment.

### Guest access is read-only (locked)
- **D-03:** Guests can use everything read/query-oriented: all GET routes and the `/agent`
  voice-command endpoint (confirmed during investigation that `/agent` only drives dashboard view
  state — `DashboardCommand`/`ToggleDataset`/`ShowOnly`/`ToggleSpeech`/`ToggleGuide`/etc. — and never
  mutates a health record; see `backend/app/agent/schemas.py`). The 4 mutating routes (`POST /upload`,
  `POST /labs`, `POST /incidents`, `POST /procedures`) must reject a guest token with a friendly 403,
  never a 500, never a distinct-looking error from any other rejection.
- **D-04 (defaulted — not explicitly re-confirmed this round, but nothing in discussion contradicts
  it):** In demo mode, hide the write-oriented UI entirely — the upload control and the
  labs/incidents/procedures "add record" forms/entry points don't render at all for a guest — rather
  than showing them and surfacing the 403 on submit. A guest should never be shown a control that
  exists only to reject them. This was presented as the recommended option in discussion and the
  user's answer redirected to a different (also now-locked) concern below without objecting to it.

### Demo data must cover all four tables, not just readings (locked — this round's key addition)
- **D-05:** The existing synthetic-data pipeline (`backend/scripts/generate_sample.py` →
  `backend/sample_data/omron_sample.xlsx`, consumed by `backend/app/seed.py` via the real ETL path)
  covers `readings` ONLY. The user explicitly asked to extend this: **synthetic demo data for labs,
  incidents, and procedures must also exist, committed in the repo**, so that both (a) the hosted
  guest demo and (b) anyone who clones the repo and runs a local install/seed see a fully populated
  dashboard across every data type — not a dashboard where three of four record types are empty.
  User's own words: "Lets provide demo lab, incidents, and procedures in the github repo for people
  to install and test." This reframes the demo as serving two audiences — the hosted guest URL AND
  a self-serve local install — both need the same complete synthetic dataset.
- **D-06:** Follow the same synthetic-data discipline already established for readings
  (`generate_sample.py`'s header comment: "THIS FILE PRODUCES SYNTHETIC DEMO DATA ONLY", seeded
  deterministic RNG, byte-identical repeated runs, no dependency on the gitignored real `data/`
  directory) for whatever generates the labs/incidents/procedures synthetic rows. Values should be
  plausible/varied enough to exercise each resource's real fields and the dashboard's rendering of
  them, not placeholder junk.
- **D-07:** Because seeding is a one-time CLI action (`python -m app.seed`) rather than something
  that runs per-request, and guests are read-only (D-03), there is no data-drift/reset problem to
  solve — the seeded demo dataset stays exactly as seeded for the deployment's lifetime. No reset
  mechanism is in scope.

### Demo indicator (locked)
- **D-08:** A persistent, small, calm visual badge indicates guest/demo mode — e.g. in the header,
  reading something like "Guest Demo · Synthetic Data" — so a visitor (and anyone who screenshots or
  shares the demo) never mistakes fabricated numbers for a real person's health data. Style/wording
  specifics are Claude's discretion (see below) but the badge itself, its persistence, and its
  presence in demo mode only are locked.

### Auth/config mechanism shape (proposed during investigation, not yet explicitly blessed by the
user — flagged for the researcher/planner to validate, not to re-litigate from scratch)
- The shape that fell out of investigating `backend/app/config.py` / `backend/app/routers/auth.py`:
  add ONE new optional `site_username` setting. When unset (Chris's real deployment), behavior is
  byte-for-byte unchanged — password-only login (current `LoginGate.tsx`), all 4 write routes fully
  open. When set (the demo deployment), `/auth` requires a matching username too, AND the same
  single env var drives (a) the write-route 403 guard, (b) the frontend hiding write UI (D-04), and
  (c) the demo badge (D-08) — one env var is the single source of truth for "this is the demo," not
  a second separate `DEMO_MODE` flag that could drift out of sync with it. The frontend would need a
  way to know it's in demo mode without a build-time branch (e.g. surface a boolean off the existing
  ungated `/health` endpoint) — this keeps ONE frontend codebase serving both deployments via runtime
  detection, config only. This mechanism is a strong candidate, not a mandate — the researcher/planner
  should confirm it's still the right shape once they're in the code, and should feel free to adjust
  if something cleaner falls out (e.g. if verify_token's router-level-only attachment, noted in
  `backend/app/main.py`'s own docstring as a pinned decision, makes per-route guarding awkward).

### Credential values
- **D-09:** No literal guest username/password value is being fixed by this discussion or committed
  to git — same pattern as the existing `SITE_PASSWORD` (`backend/.env.example` documents the env var
  name with a placeholder; the real value is set only in the target deployment's dashboard). The
  guest credentials are just another `.env` value in that same established pattern.

### Security patterns to carry forward (from the most recent auth-gate hardening — see canonical
refs — these are constraints on HOW to implement, already learned the hard way in this codebase)
- **D-10:** Any new credential compare (a guest username check) MUST fail closed on
  empty/unconfigured (an unset value must never match), MUST compare constant-time on utf-8 BYTES
  (not `str`, which raises `TypeError` on non-ASCII input via `hmac.compare_digest`), and MUST NOT
  ever appear in a logged error — `Settings.model_config` already sets `hide_input_in_errors=True`
  for exactly this reason and that must keep covering any new field added to `Settings`.
- **D-11:** Any new tests touching `Settings`/`/auth` MUST follow the established `conftest.py`
  module-level ambient-`.env` isolation (env vars neutralized at collection time, not via an autouse
  fixture — fixtures run too late because `app/db.py` calls `get_settings()` at import time). A
  regression test must be observed FAILING against the pre-fix code first (this codebase's existing
  fail-first convention for security tests).

### Claude's Discretion
- Exact badge wording/placement/styling (D-08) within the existing nautical-minimalist theme tokens
  (`frontend/src/index.css`) — cosmetic detail.
- Exact literal env var name(s) (e.g. `SITE_USERNAME` vs `DEMO_USERNAME`) and whether the mechanism
  is exactly the single-env-var shape sketched above or something the researcher/planner judges
  cleaner once in the code — see the flagged section above.
- Exact shape/volume of the synthetic labs/incidents/procedures generator (D-05/D-06) — e.g. whether
  it's a new script mirroring `generate_sample.py`'s pattern, or an extension of it — implementation
  detail, not a locked product decision, as long as the discipline in D-06 holds.
- Exact content/depth of the deploy instructions (D-02) — where they live (README section vs a new
  DEPLOY.md vs `.env.example` comments) is implementation detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing auth gate (the system this phase extends)
- `backend/app/config.py` — `Settings` (pydantic-settings), the `site_password`/`token_secret`
  pattern, the boot-time `_reject_dev_token_secret_in_deployment` validator, `hide_input_in_errors`
- `backend/app/routers/auth.py` — `POST /auth`: fail-closed constant-time password check, rate
  limiting (`5/minute`), token issuance
- `backend/app/auth.py` — `verify_token` dependency, itsdangerous serializer, router-level (not
  per-route) attachment
- `backend/app/main.py` — router wiring, CORS config, `/health` (the one other ungated route)
- `backend/.env.example` — documented env var template pattern to extend

### Most recent security hardening on this exact surface (read in full — D-10/D-11 above summarize it)
- `.planning/quick/260913-gcv-fix-4-verified-auth-gate-and-test-isolat/260913-gcv-SUMMARY.md` —
  fail-closed-on-misconfiguration, utf-8-bytes compare, TOKEN_SECRET boot guard, conftest isolation,
  fail-first test convention, and the `.env.*`-but-not-`.env.example` gitignore pattern

### Mutating routes to guard (D-03)
- `backend/app/routers/upload.py` — `POST /upload`
- `backend/app/routers/labs.py` — `POST /labs`
- `backend/app/routers/incidents.py` — `POST /incidents`
- `backend/app/routers/procedures.py` — `POST /procedures`
- `backend/app/agent/schemas.py` — confirms `/agent`'s command set is view-only (no mutation)

### Existing synthetic demo-data pipeline to extend (D-05/D-06)
- `backend/scripts/generate_sample.py` — the pattern to mirror: seeded deterministic RNG, explicit
  "SYNTHETIC DEMO DATA ONLY" framing, category-coverage assertions against
  `app.derivations.classify_bp`/`classify_pulse`, byte-identical repeated runs
- `backend/sample_data/omron_sample.xlsx` — the committed output `generate_sample.py` produces
- `backend/app/seed.py` — `python -m app.seed`, the CLI seeder; `resolve_source()`'s real-data vs
  sample fallback (D-12 in its own docstring) is exactly why a demo deployment's empty `data/` dir
  already does the right thing for readings with zero changes

### Frontend auth surface to extend
- `frontend/src/components/LoginGate.tsx` — the password-only login form to add a conditional
  username field to
- `frontend/src/store/auth.ts` — zustand token store (`useAuth`), localStorage persistence pattern
- `frontend/src/api/client.ts` — `postAuth` and the rest of the typed API client

### Deploy config referenced by D-02's instructions
- `backend/railway.json`, `railway.json` (repo root) — existing Railway deploy config to mirror for
  a second service
- `backend/.env.example` — inventory of every env var a deployment needs; the new guest-credential
  var(s) belong here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/routers/auth.py`'s constant-time-compare + fail-closed + rate-limited pattern —
  directly reusable/extensible for a second credential (username) rather than inventing a new
  mechanism.
- `backend/scripts/generate_sample.py`'s seeded-RNG synthetic-data discipline — the template for
  labs/incidents/procedures synthetic data (D-05).
- `backend/app/seed.py`'s ETL-reuse pattern (seeder is a thin wrapper, no logic of its own) — same
  discipline should extend to however labs/incidents/procedures get seeded.
- The existing ungated `/health` endpoint — a natural place to surface a `demo: bool` flag for the
  frontend to detect demo mode at runtime without a build-time branch.

### Established Patterns
- Router-level (not per-route) `Depends(verify_token)` attachment is a PINNED decision per
  `backend/app/main.py`'s own docstring — a new per-route demo-write-guard dependency needs to
  coexist with that, added directly on the 4 POST route functions rather than at router level
  (labs/incidents/procedures routers mix GET+POST, so router-level would incorrectly block GET too).
- Every existing `Settings` field with security weight documents ITS OWN rationale inline (see
  `config.py`'s comments on `site_password`, `token_secret`) — a new field should match that density.
- Boot-time `model_validator` guards (fail loud at construction, not at request time) are this
  codebase's established way to prevent a dangerous misconfiguration from ever going live — worth
  the researcher checking whether the new guest-credential field needs an analogous guard.

### Integration Points
- `/auth` (ungated route) — extend `AuthRequest`/the compare logic for an optional username.
- `app.main`'s router `dependencies=[Depends(verify_token)]` wiring — where a demo-write-guard
  dependency would additionally attach, per-route only.
- `LoginGate.tsx` — conditional username field, driven by a runtime flag (not a build-time env
  branch) per the mechanism sketched in `<decisions>`.
- `Header.tsx` (or wherever site chrome lives) — the demo badge (D-08).
- Wherever the upload button and the three "add record" entry points render — need a demo-mode
  hide (D-04).

</code_context>

<specifics>
## Specific Ideas

- Badge copy direction: something calm like "Guest Demo · Synthetic Data" — not alarming, consistent
  with the rest of the site's error/notice tone (CLAUDE.md: high contrast, never color-alone,
  friendly copy, no raw status codes surfaced to the user).
- The user's own framing for the demo-data ask: "Lets provide demo lab, incidents, and procedures in
  the github repo for people to install and test" — this is as much about a clonable local install
  experience as it is about the hosted guest URL; keep both audiences in mind when planning the
  synthetic-data deliverable and the deploy/install docs.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The data-drift/reset question raised during initial
investigation resolved itself via D-03/D-07 — read-only guests can't drift a dataset — so it isn't a
deferred idea, it's a closed question.)

</deferred>

---

*Phase: 19-Guest Demo Mode*
*Context gathered: 2026-09-15*
