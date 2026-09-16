---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
verified: 2026-09-16T18:52:24Z
status: human_needed
score: 23/23 code-level must-haves verified
overrides_applied: 0
human_verification:
  - test: "Stand up the actual second Railway backend service + second Vercel frontend project, each pointed at a fresh demo Postgres DB, following DEPLOY.md's literal steps"
    expected: "The demo Vercel URL loads, a guest logs in with the configured SITE_USERNAME/SITE_PASSWORD, the dashboard shows the 'Guest Demo · Synthetic Data' badge and a fully populated dashboard (readings, labs, incidents, procedures) via the boot-time auto-seed, voice/click interaction works normally, and any write attempt (upload, add lab/incident/procedure) returns a friendly 403"
    why_human: "The executing agent has no Railway/Vercel CLI access in this environment (D-02, locked at context-gathering) — this was pre-declared as a Manual-Only Verification in 19-VALIDATION.md before execution began, not discovered as a gap afterward. All code/config that makes this deployment possible is verified below; only the actual dashboard click-through (provisioning a Postgres DB, setting env vars, confirming the live URL) requires a human with dashboard access."
---

# Phase 19: Guest Demo Mode — Verification Report

**Phase Goal:** A visitor to the portfolio project can log into a separate, isolated demo deployment
with a guest username+password (distinct from Chris's real shared-password gate), explore the
dashboard against synthetic seed data by click or voice, and cannot write to it — the 4 mutating
routes (upload, labs, incidents, procedures) reject guest tokens with a friendly 403; all GET routes
and the /agent voice-command endpoint stay fully usable.

**Verified:** 2026-09-16T18:52:24Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Method

ROADMAP.md's `success_criteria` array is empty for this phase (goal stated in prose only), so
must-haves were pulled from all 7 PLAN.md frontmatter blocks (the phase's own contract) and verified
directly against the current codebase — not against SUMMARY.md's claims. For every claim below, the
actual file was read and, where automatable, the actual test suite was executed in this session
(not trusted from a prior run):

- `cd backend && .venv/bin/python -m pytest tests -q` → **308 passed, 7 skipped, 0 failed**
- `cd backend && .venv/bin/python -m pytest tests/test_demo_guard.py tests/test_seed.py tests/test_demo_records_sample.py tests/test_auth_upload.py tests/test_health.py -v` → **60/60 passed**
- `cd backend && .venv/bin/python scripts/generate_demo_records.py` run twice → byte-identical output, `git diff` on the committed fixture clean
- `cd frontend && npx tsc -b --noEmit` → **0 errors**
- `cd frontend && npx vitest run` → **493/493 passed, 38/38 files**
- `bash -n backend/start.sh` → syntax valid
- Direct `grep`/`Read` of every file the 7 plans claim to have modified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unset `SITE_USERNAME` → byte-for-byte unchanged: `/auth` password-only, `/health.demo == false` | ✓ VERIFIED | `test_auth_unconfigured_site_password_issues_no_token`, `test_auth_real_deployment_ignores_stray_username_field`, `test_health_reports_demo_false_when_keyless` all pass |
| 2 | `SITE_USERNAME` set → `/auth` requires matching username AND password; every mismatch → identical opaque 401 | ✓ VERIFIED | `backend/app/routers/auth.py` folded `user_ok`/`pass_ok` gate; `test_auth_demo_correct_user_and_pass_...`, `test_auth_demo_wrong_username_same_opaque_401`, `test_auth_demo_missing_username_401` pass |
| 3 | `reject_if_demo()` is an independent 403 dependency that never inspects the Bearer token | ✓ VERIFIED | `backend/app/auth.py:49-67` — signature takes 0 params, only reads `get_settings().site_username` |
| 4 | Demo deployment + valid token → 403 on `POST /upload`, `/labs`, `/incidents`, `/procedures`, never 500, same message | ✓ VERIFIED | All 4 routers carry `dependencies=[Depends(reject_if_demo)]` on the POST decorator only; `test_labs_post_403_under_demo_mode` et al. pass, all assert identical `detail` string |
| 5 | GET routes and `POST /agent` fully unaffected on a demo deployment | ✓ VERIFIED | `test_get_routes_unaffected_under_demo_mode`, `test_agent_endpoint_returns_200_under_demo_mode` pass; `grep -c reject_if_demo backend/app/routers/agent.py` = 0 |
| 6 | Unauthenticated caller on a demo deployment → 401, never 403 (verify_token fires before reject_if_demo) | ✓ VERIFIED | `test_missing_token_still_401_on_demo` passes |
| 7 | Committed synthetic data exists for labs, incidents, AND procedures | ✓ VERIFIED | `backend/sample_data/demo_records.json` — 8 labs / 5 incidents / 5 procedures |
| 8 | Generator is seeded-deterministic — byte-identical reruns | ✓ VERIFIED | Ran `generate_demo_records.py` twice in this session; `diff` clean; `git diff --stat` on the committed file clean |
| 9 | Generator never reads Chris's real (gitignored) data | ✓ VERIFIED | `grep` confirms no `pandas`/`openpyxl` import, no `data/` directory reference; only `random`+`json` stdlib |
| 10 | Synthetic rows are varied enough (multiple test_name/incident_type/outcome, in/out-of-range labs) | ✓ VERIFIED | `test_labs_covers_multiple_test_names`, `test_labs_has_in_range_and_out_of_range_results`, `test_incidents_covers_multiple_types`, `test_procedures_covers_multiple_outcomes` all pass |
| 11 | `seed_records()` idempotently populates labs/incidents/procedures — populated table left untouched | ✓ VERIFIED | `test_seed_records_is_idempotent_on_second_call` passes; code reads existing row count per table before inserting |
| 12 | `python -m app.seed` (the real entry point) populates all FOUR tables from an empty, migrated DB | ✓ VERIFIED | `test_main_via_actual_entry_point_populates_all_four_tables` runs a genuine subprocess against a fresh Alembic-migrated SQLite file and passes |
| 13 | A fresh demo deployment self-populates on boot with zero shell/CLI access, gated on `SITE_USERNAME` | ✓ VERIFIED | `backend/start.sh:53-56` — `if [ -n "${SITE_USERNAME:-}" ]; then ... app.seed`; `bash -n` passes |
| 14 | Chris's real deployment never auto-seeds (dead code, no second flag) | ✓ VERIFIED | Same single gate variable everywhere (`site_username`/`SITE_USERNAME`) — no second flag exists anywhere in the diff |
| 15 | No literal guest credential committed anywhere | ✓ VERIFIED | `backend/.env.example` — `SITE_USERNAME=choose-a-guest-username` placeholder only |
| 16 | `HealthStatus.demo` is a required boolean field on the frontend | ✓ VERIFIED | `frontend/src/api/types.ts:215-220` |
| 17 | `postAuth` accepts an optional username, passed through unconditionally | ✓ VERIFIED | `frontend/src/api/client.ts:149-154` |
| 18 | Existing `HealthStatus` test-mock call sites updated, `tsc -b` clean | ✓ VERIFIED | `tsc -b --noEmit` exits 0; `useHealth.test.ts`/`AgentStatusBanner.test.tsx` both patched with `demo: false` |
| 19 | Guest sees a Username field above Password; submit sends both to `postAuth` | ✓ VERIFIED | `frontend/src/components/LoginGate.tsx:86-105`, `:49`; `LoginGate.test.tsx` demo-mode tests pass |
| 20 | Persistent "Guest Demo · Synthetic Data" badge shown when `demoMode` true, nothing extra when false | ✓ VERIFIED | `frontend/src/components/Header.tsx:173-181`; `Header.test.tsx` badge-shown/hidden tests pass |
| 21 | Guest never sees Upload or Add Record buttons — they don't render, no 403-on-click surprise | ✓ VERIFIED | `Header.tsx:254`, `:264` — each button individually wrapped in `{!demoMode && (...)}` |
| 22 | Chris's real deployment is visually/behaviorally unchanged (no username field, no badge, both write buttons present) | ✓ VERIFIED | `demoMode` defaults `false`; every pre-existing LoginGate/Header test (unmodified assertions) still passes |
| 23 | LoginGate's one pre-auth fetch stays scoped to `/health` only (no PHI leak pre-auth) | ✓ VERIFIED | `LoginGate.test.tsx` fail-first regression: `fetchMock.mock.calls.every((c) => String(c[0]).includes("/health"))` passes |
| 24 | Literal, step-by-step instructions exist for standing up a second, isolated deployment | ✓ VERIFIED | `DEPLOY.md` — 7 numbered steps, mentions Railway (10×) and Vercel (9×) |
| 25 | Document is explicit that its steps are MANUAL and unverified end-to-end in this environment | ✓ VERIFIED | `DEPLOY.md` prominent callout: "⚠️ MANUAL — not executed or verified in this environment..." |
| 26 | Env-var inventory names `SITE_USERNAME`, `SITE_PASSWORD`, `TOKEN_SECRET`, `CORS_ORIGINS`, `DATABASE_URL`, `VITE_API_URL`, warns `TOKEN_SECRET` must be freshly generated | ✓ VERIFIED | All 6 vars present in `DEPLOY.md`'s table; "MUST"/"freshly generat[ed]" warning present |
| 27 | `README.md` points to `DEPLOY.md` | ✓ VERIFIED | `README.md:60-63`, new "Deploying a Second (Demo) Instance" section |

**Score:** 27/27 code-level truths verified. One additional truth embedded in the phase goal itself —
**an actual second deployment exists and a guest can literally log into it** — is NOT independently
verifiable in this environment and is listed under Human Verification below (pre-declared as
`human_needed` in `19-VALIDATION.md` before execution began, not a gap discovered now).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/config.py` | `Settings.site_username: str = ""` | ✓ VERIFIED | Line 59, positioned directly after `site_password` |
| `backend/app/auth.py` | `reject_if_demo()` beside `verify_token` | ✓ VERIFIED | Lines 49-67, 403 not 401, no token param |
| `backend/app/routers/auth.py` | `AuthRequest.username` + folded compare | ✓ VERIFIED | Lines 40, 61-70 |
| `backend/app/main.py` | `/health` gains `"demo": bool(...)` | ✓ VERIFIED | Line 71 |
| `backend/tests/test_demo_guard.py` | 403 + ordering + agent-unaffected coverage | ✓ VERIFIED | 8 tests, all pass, min_lines exceeded |
| `backend/scripts/generate_demo_records.py` | seeded-RNG generator | ✓ VERIFIED | `SEED`/`random.Random(SEED)`, no pandas/openpyxl |
| `backend/sample_data/demo_records.json` | committed synthetic fixture | ✓ VERIFIED | 8/5/5 rows, byte-identical regen |
| `backend/tests/test_demo_records_sample.py` | character-pinning regression | ✓ VERIFIED | 6 tests, all pass |
| `backend/app/seed.py` | `seed_records(session)`, mandatory `main()` wiring | ✓ VERIFIED | Lines 58-142; `counts = seed_records(session)` inside `main()`, non-fatal try/except |
| `backend/tests/test_seed.py` | idempotency + subprocess entry-point test | ✓ VERIFIED | 4 tests, all pass, including genuine subprocess run |
| `backend/start.sh` | boot-time auto-seed gated on `SITE_USERNAME` | ✓ VERIFIED | Lines 46-56 |
| `backend/.env.example` | `SITE_USERNAME=` placeholder only | ✓ VERIFIED | Lines 30-39 |
| `frontend/src/api/types.ts` | `HealthStatus.demo: boolean` | ✓ VERIFIED | Line 219 |
| `frontend/src/api/client.ts` | `postAuth(password, username?)` | ✓ VERIFIED | Lines 149-154 |
| `frontend/src/components/LoginGate.tsx` | conditional Username field + `getHealth()` | ✓ VERIFIED | Full file read, matches UI-SPEC markup |
| `frontend/src/components/Header.tsx` | badge + hidden write buttons | ✓ VERIFIED | Lines 142, 173-181, 254, 264 |
| `frontend/src/components/Header.test.tsx` | new — badge + hidden-buttons coverage | ✓ VERIFIED | New file, ≥5 `it()` blocks, all pass |
| `DEPLOY.md` | literal second-deployment instructions | ✓ VERIFIED | 75 lines, 7-step sequence, env-var table, manual callout |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `routers/auth.py auth()` | `config.py Settings.site_username` | `get_settings().site_username` in folded compare | ✓ WIRED | Line 61 |
| `main.py health()` | `config.py Settings.site_username` | `bool(get_settings().site_username)` | ✓ WIRED | Line 71 |
| `routers/labs.py create_lab` | `auth.py reject_if_demo` | `dependencies=[Depends(reject_if_demo)]` on POST only | ✓ WIRED | Confirmed on POST decorator, absent from GET |
| `routers/incidents.py create_incident` | `auth.py reject_if_demo` | same pattern | ✓ WIRED | Confirmed |
| `routers/procedures.py create_procedure` | `auth.py reject_if_demo` | same pattern | ✓ WIRED | Confirmed |
| `routers/upload.py upload` | `auth.py reject_if_demo` | same pattern | ✓ WIRED | Confirmed |
| `start.sh` | `app/seed.py main()` | `python -m app.seed`, gated on `SITE_USERNAME` | ✓ WIRED | Lines 53-56 |
| `app/seed.py main()` | `app/seed.py seed_records()` | mandatory non-fatal call | ✓ WIRED | Line 130, inside `main()`'s body, not gated on any flag `main()` doesn't already have |
| `app/seed.py seed_records` | `sample_data/demo_records.json` | `json.loads` at call time | ✓ WIRED | Line 74 |
| `LoginGate.tsx` | `api/client.ts getHealth` | `useEffect(() => getHealth()...)` | ✓ WIRED | Lines 36-40 |
| `LoginGate.tsx` | `api/client.ts postAuth` | `postAuth(password, demoMode ? username : undefined)` | ✓ WIRED | Line 49 |
| `Header.tsx` | `hooks/useHealth.ts` | `useHealth().data?.demo` | ✓ WIRED | Line 142 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `Header.tsx` badge/button visibility | `demoMode` | `useHealth()` → `GET /health` → `bool(get_settings().site_username)` | Real env-driven boolean, not hardcoded | ✓ FLOWING |
| `LoginGate.tsx` username field visibility | `demoMode` | `getHealth()` → same `/health` endpoint | Real env-driven boolean | ✓ FLOWING |
| 4 write-route 403 guard | `site_username` | `get_settings().site_username` (env var, cached via `lru_cache`, cleared in tests) | Real config value, not stubbed | ✓ FLOWING |
| Boot-time auto-seed | `demo_records.json` rows | Committed JSON fixture read at `seed_records()` call time | Real committed data, not empty/stub | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend suite green | `cd backend && .venv/bin/python -m pytest tests -q` | 308 passed, 7 skipped, 0 failed | ✓ PASS |
| Phase-19 backend test files green | `pytest tests/test_demo_guard.py tests/test_seed.py tests/test_demo_records_sample.py tests/test_auth_upload.py tests/test_health.py -v` | 60/60 passed | ✓ PASS |
| Generator determinism | `python scripts/generate_demo_records.py` run twice + diff | byte-identical, `git diff` clean | ✓ PASS |
| Frontend type-check | `npx tsc -b --noEmit` | 0 errors | ✓ PASS |
| Full frontend suite green | `npx vitest run` | 493/493 passed, 38/38 files | ✓ PASS |
| `start.sh` syntax | `bash -n backend/start.sh` | exits 0 | ✓ PASS |
| Live second deployment reachable | N/A — requires Railway/Vercel dashboard access | not run | ? SKIP → routed to Human Verification |

### Requirements Coverage

This project tracks phase-level decisions inline in `19-CONTEXT.md` (D-01 through D-11) rather than
a global `.planning/REQUIREMENTS.md` file — confirmed: no `.planning/REQUIREMENTS.md` exists in this
repo. The phase's roadmap-level requirement citation is "Client-driven request (2026-09-15), 'add a
working demo version that people who are viewing can use'" — satisfied at the code/config/docs level
per the truths table above. Cross-referencing every `D-XX` ID declared across the 7 plans' `requirements:` frontmatter fields against `19-CONTEXT.md`'s decision log:

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| D-01 | 19-07 | Separate Railway + Vercel deployment, isolated fresh Postgres DB | ✓ SATISFIED (code/docs) | `DEPLOY.md` documents the isolation model; actual deployment is `human_needed` |
| D-02 | 19-07 | No CLI access → deliverable is code+config+literal instructions | ✓ SATISFIED | `DEPLOY.md` explicit MANUAL callout |
| D-03 | 19-01, 19-02 | Guests read/query-only; 4 write routes 403 | ✓ SATISFIED | Truths 4-6 |
| D-04 | 19-06 | Hide write UI entirely, no 403-on-click surprise | ✓ SATISFIED | Truths 19-22 |
| D-05 | 19-03, 19-04 | Synthetic data for labs/incidents/procedures, committed | ✓ SATISFIED | Truths 7, 10-12 |
| D-06 | 19-03 | Same seeded-RNG discipline as `generate_sample.py` | ✓ SATISFIED | Truths 8-9 |
| D-07 | 19-04 | No reset mechanism — idempotent, terminal-state seeding | ✓ SATISFIED | Truth 11 |
| D-08 | 19-06 | Persistent demo badge | ✓ SATISFIED | Truth 20 |
| D-09 | 19-04, 19-07 | No literal guest credential committed | ✓ SATISFIED | Truth 15, DEPLOY.md env table |
| D-10 | 19-01 | Fail-closed, constant-time compare, never logged | ✓ SATISFIED | `hmac.compare_digest` on utf-8 bytes, `hide_input_in_errors=True` inherited |
| D-11 | 19-01–19-06 | Fail-first (RED→GREEN) test convention | ✓ SATISFIED | Every plan's SUMMARY documents RED commits observed failing before GREEN; git log confirms `test(...)` commits preceding `feat(...)` commits throughout |

No orphaned requirement IDs found — every `D-XX` cited in a plan's frontmatter is defined in
`19-CONTEXT.md` and every `D-XX` defined there is claimed by at least one plan.

### Anti-Patterns Found

None. Scanned every file modified across all 7 plans (`config.py`, `auth.py`, `routers/auth.py`,
`main.py`, the 4 write routers, `seed.py`, `start.sh`, `.env.example`,
`generate_demo_records.py`, `types.ts`, `client.ts`, `LoginGate.tsx`, `Header.tsx`, `DEPLOY.md`,
`README.md`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" —
zero matches. No stub returns, no hardcoded-empty data flowing to render, no console.log-only
handlers.

### Human Verification Required

### 1. Stand up and confirm the actual second (demo) deployment

**Test:** Follow `DEPLOY.md`'s 7-step sequence in the real Railway and Vercel dashboards: create a
new Railway project from this repo (Root Directory `backend`), add a Postgres plugin, set
`SITE_PASSWORD`/`SITE_USERNAME`/`TOKEN_SECRET`/`CORS_ORIGINS`, deploy; create a new Vercel project
(Root Directory `frontend`), set `VITE_API_URL` to the new Railway backend URL, deploy. Visit the
demo Vercel URL.

**Expected:** The login screen shows a Username field above Password; logging in with the configured
guest credentials succeeds; the header shows the "Guest Demo · Synthetic Data" badge; the dashboard is
populated with synthetic readings, labs, incidents, and procedures (auto-seeded on first boot); voice
and click navigation both work; attempting to upload a file or add a lab/incident/procedure record
returns a friendly 403 (and, per D-04, the Upload/Add Record buttons never even render); Chris's real
deployment, visited separately, is completely unaffected (no badge, no username field, write buttons
present).

**Why human:** The executing agent has no Railway/Vercel CLI access in this environment. This was
declared a Manual-Only Verification in `19-VALIDATION.md` at planning time (D-01/D-02), before any
code was written — not a gap discovered during this verification pass. Every piece of code and
config that makes this deployment possible has been verified above (27/27 code-level truths); the
remaining step is purely operational (provisioning cloud resources) and requires dashboard access
this environment does not have.

### Gaps Summary

No code-level gaps. All 27 must-haves drawn from the 7 plans' frontmatter are verified directly
against the current codebase, with the full backend (308 tests) and frontend (493 tests) suites
re-run in this session and passing, `tsc -b --noEmit` clean, and the synthetic-data generator's
determinism re-confirmed empirically. The single open item — actually provisioning the second
Railway/Vercel deployment and confirming it end-to-end — was scoped as manual/human-required from the
start of planning (D-02) because the executing environment has no cloud dashboard access; it is not a
shortfall in the phase's execution, and `DEPLOY.md` gives the developer everything needed to close it.

---

*Verified: 2026-09-16T18:52:24Z*
*Verifier: Claude (gsd-verifier)*
