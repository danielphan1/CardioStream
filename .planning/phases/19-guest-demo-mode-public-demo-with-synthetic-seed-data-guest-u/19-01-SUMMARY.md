---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 01
subsystem: auth
tags: [fastapi, pydantic-settings, itsdangerous, hmac, pytest, tdd]

requires: []
provides:
  - "Settings.site_username: str = \"\" — single source of truth for guest-demo-deployment detection"
  - "reject_if_demo() dependency in app/auth.py — 403 write-guard, defined but not yet wired to any router"
  - "/auth requires a matching username (constant-time, folded into one opaque 401) whenever SITE_USERNAME is configured"
  - "/health reports demo: bool(site_username)"
affects: [19-02, 19-04, 19-06]

tech-stack:
  added: []
  patterns:
    - "Second independent per-route-attachable auth dependency (reject_if_demo) beside verify_token, rather than a token claim or router-level guard"
    - "Folded user_ok/pass_ok boolean gate collapsing every /auth failure mode into one opaque 401 (no username-enumeration oracle)"

key-files:
  created: []
  modified:
    - backend/app/config.py
    - backend/app/auth.py
    - backend/app/routers/auth.py
    - backend/app/main.py
    - backend/tests/test_auth_upload.py
    - backend/tests/test_health.py

key-decisions:
  - "reject_if_demo never decodes the Bearer token — D-01's separate-deployment isolation model means every valid token on a demo deployment belongs to a guest by construction"
  - "site_username has no boot-time model_validator guard (unlike token_secret) — it only ever drives a 403 read-only guard, not a forged-token risk"

requirements-completed: [D-03, D-10, D-11]

duration: ~10min
completed: 2026-09-16
---

# Phase 19 Plan 01: Auth Foundation (site_username, reject_if_demo, /auth, /health) Summary

**`Settings.site_username` as the single source of truth for guest-demo detection, wired into a folded constant-time `/auth` username+password compare, a new independent `reject_if_demo` 403 write-guard (defined, not yet attached), and a `/health.demo` boolean — full TDD RED/GREEN cycle, zero regressions across 290 backend tests.**

## Performance

- **Duration:** ~10min
- **Started:** 2026-09-16T07:45:00Z (approx, includes fresh-worktree venv provisioning)
- **Completed:** 2026-09-16T07:54:00Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments
- `Settings.site_username` added with an empty default (byte-for-byte backward compatible, D-10) and inline rationale matching `site_password`'s density
- `reject_if_demo()` defined beside `verify_token` in `app/auth.py` — deliberately 403 (never 401), never inspects the token, ready for Plan 19-02 to attach per-route
- `/auth` now requires a matching username whenever `SITE_USERNAME` is configured — folded `user_ok`/`pass_ok` gate collapses wrong-username, wrong-password, and missing-username into the SAME opaque 401 (D-03, D-10); unconfigured `site_username` silently ignores a stray `username` field, preserving today's real-deployment behavior exactly
- `/health` gains `"demo": bool(get_settings().site_username)`, following the existing boolean-or-null-only discipline
- Full TDD RED→GREEN cycle for Tasks 2 and 3 (D-11): new tests observed failing against pre-fix code before implementation, in dedicated `test(...)` commits

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings.site_username field + reject_if_demo dependency** - `16bd519` (feat)
2. **Task 2 (TDD): /auth requires username when configured**
   - RED: `2719a64` (test) — 2 of 4 new tests confirmed failing (wrong-username got 200 instead of 401; missing-username got 200 instead of 401) against pre-fix `AuthRequest`
   - GREEN: `ab75140` (feat) — folded `user_ok`/`pass_ok` compare; all 33 `test_auth_upload.py` tests green
3. **Task 3 (TDD): /health reports demo + patch SimpleNamespace mocks**
   - RED: `66188e2` (test) — 2 new `demo` tests confirmed failing (`KeyError: 'demo'`) against unmodified `main.py`
   - GREEN: `98e38be` (feat) — `"demo": bool(get_settings().site_username)` added; all 9 `test_health.py` tests green

**Plan metadata:** (this commit, made after self-check)

## Files Created/Modified
- `backend/app/config.py` — `Settings.site_username: str = ""` added directly below `site_password`
- `backend/app/auth.py` — `reject_if_demo()` added directly after `verify_token`
- `backend/app/routers/auth.py` — `AuthRequest.username`, folded `user_ok`/`pass_ok` compare replacing the single-secret check
- `backend/app/main.py` — `health()` return dict gains `"demo"` key + docstring update
- `backend/tests/test_auth_upload.py` — `demo_credentials` fixture + 4 new tests
- `backend/tests/test_health.py` — 2 existing `SimpleNamespace` call sites patched with `site_username=""`, 2 new `demo` tests

## Decisions Made
- Followed the plan's exact folded-boolean `/auth` compare shape and `reject_if_demo`'s "never touch the token" design — no deviation from the researched architecture.
- No boot-time `model_validator` added for `site_username` (plan explicitly said not to — it's a read-only write-guard flag, not a forged-token risk like `token_secret`).

## Deviations from Plan

### Auto-fixed Issues (environment)

**1. [Rule 3 - Blocking] Fresh worktree had no `.venv`**
- **Found during:** Pre-Task-1 baseline verification
- **Issue:** This worktree was created without a Python virtualenv (STATE.md's known worktree-isolation pitfall — a bare `import fastapi` failed, and the main repo's `.venv` lives outside this worktree, unreachable per sandbox path rules).
- **Fix:** Ran `python3 -m venv backend/.venv` inside the worktree, then `pip install -e ".[dev]"` from `backend/pyproject.toml`. Verified `app.deps.__file__` resolved to the worktree's own source (not a meta-path-finder shadow of the main repo), per the STATE.md warning about editable-install shadowing.
- **Files modified:** none (`.venv/` is gitignored, confirmed via `git check-ignore`)
- **Verification:** Baseline suite ran green (36/36 in the two target files) before any code changes.

### Documentation-only Issues

**2. [Rule 1-adjacent - stale plan detail] Task 3's "three SimpleNamespace call sites" was actually two**
- **Found during:** Task 3 (patching `test_health.py`)
- **Issue:** The plan's `<read_first>`/`<action>` text and acceptance criterion (`grep -c "site_username=\"\"" ... >= 3`) both assumed three `SimpleNamespace(anthropic_api_key=...)` construction sites in `test_health.py`. Grepping the actual file found exactly two (lines 32 and 43 pre-edit).
- **Fix:** Patched both real occurrences with `site_username=""`; did not fabricate a third. The plan's own `<behavior>` block correctly described the substantive requirement ("the three pre-existing SimpleNamespace-based tests... continue to pass") which is satisfied — there are only two such tests, and both pass with zero `AttributeError`.
- **Files modified:** `backend/tests/test_health.py`
- **Verification:** `grep -c 'site_username=""' backend/tests/test_health.py` → 2 (not ≥3 as the stale threshold predicted); full `test_health.py` suite green, 0 `AttributeError`s.

---

**Total deviations:** 1 environment fix (Rule 3, no code change), 1 documentation-only plan-vs-reality mismatch (non-blocking, matches the precedent set in Phase 12-08's own miscalibrated-threshold note in STATE.md).
**Impact on plan:** None on scope or correctness — all acceptance criteria that reflect actual codebase state are satisfied; the one numeric threshold that assumed stale file contents is the only miss, and it does not affect behavior.

## Issues Encountered
None beyond the two items documented above.

## User Setup Required
None - no external service configuration required. (Plan 19-04's boot-time auto-seed and Railway/Vercel env-var setup are out of scope for this plan.)

## Next Phase Readiness
- `Settings.site_username` is live and ready for Plan 19-02 (write-route guard: attach `reject_if_demo` per-route to the 4 mutating handlers), Plan 19-04 (boot-time auto-seed gated on this same field), and Plan 19-06 (frontend demo badge/hidden-UI reading `/health.demo`).
- `reject_if_demo` is defined but intentionally NOT wired into any router yet — Plan 19-02 owns that per the threat model's T-19-01-05 "mitigate (staged)" disposition.
- Full backend suite: 290 passed, 7 skipped (pre-existing, unrelated), 0 failed.

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: `.planning/phases/19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u/19-01-SUMMARY.md`
- FOUND: 16bd519, 2719a64, ab75140, 66188e2, 98e38be (all task commits present in `git log`)
