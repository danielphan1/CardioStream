---
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
plan: 07
subsystem: infra
tags: [deployment, railway, vercel, documentation]

# Dependency graph
requires:
  - phase: 19-01
    provides: SITE_USERNAME env var + guest auth field (referenced in the env-var inventory table)
  - phase: 19-02
    provides: write-route 403 guest guard (referenced in the deploy doc's "how it behaves" framing)
  - phase: 19-04
    provides: boot-time auto-seed in start.sh gated on SITE_USERNAME, and the current backend/.env.example wording this doc extends
provides:
  - DEPLOY.md — literal 7-step Railway + Vercel instruction sequence for standing up the isolated guest demo deployment
  - Env-var inventory table (DATABASE_URL, ANTHROPIC_API_KEY, SITE_PASSWORD, SITE_USERNAME, TOKEN_SECRET, CORS_ORIGINS, VITE_API_URL) contrasting Chris's real deployment vs the demo deployment
  - Explicit MUST-freshly-generate warning for TOKEN_SECRET, echoing config.py's existing boot-time guard
  - README.md pointer section ("Deploying a Second (Demo) Instance") linking to DEPLOY.md
affects: [deployment, ops-runbook]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: [DEPLOY.md]
  modified: [README.md]

key-decisions:
  - "DEPLOY.md states plainly, in a prominent callout, that its steps were never executed or verified end-to-end in this environment (no Railway/Vercel CLI access) — matches 19-VALIDATION.md's human_needed flag; transparency rather than a silently skipped verification."
  - "Env-var table references backend/.env.example as the authoritative name list instead of duplicating literal placeholder values, keeping one source of truth."
  - "TOKEN_SECRET warning echoes config.py's _reject_dev_token_secret_in_deployment boot guard's own reasoning (shared/weak signing secret makes a password gate decorative) rather than inventing new phrasing."

patterns-established: []

requirements-completed: [D-01, D-02]

# Metrics
duration: ~10min
completed: 2026-09-16
---

# Phase 19 Plan 07: Write DEPLOY.md Summary

**Literal 7-step Railway + Vercel second-deployment runbook (DEPLOY.md) with an env-var inventory table, a MUST-freshly-generate TOKEN_SECRET warning, and an explicit unverified-in-this-environment callout, linked from README.md.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-09-16T08:11:30Z
- **Tasks:** 1
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `DEPLOY.md` documents the full literal second-deployment sequence: Railway New Project → Root Directory → Postgres plugin → env vars → deploy → Vercel New Project → visit + verify, as a numbered 7-step list.
- Env-var inventory table covers all 7 relevant vars (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `SITE_PASSWORD`, `SITE_USERNAME`, `TOKEN_SECRET`, `CORS_ORIGINS`, `VITE_API_URL`), contrasting Chris's real deployment against the demo deployment.
- Explicit `TOKEN_SECRET` MUST-freshly-generate warning, in the same warning voice as `config.py`'s existing `_reject_dev_token_secret_in_deployment` boot guard.
- Pitfall 6 (byte-identical `railway.json` files, ambiguous which one the existing service reads) called out as a pre-flight check before configuring the new service.
- README.md gained a short "Deploying a Second (Demo) Instance" section, inserted after "Synthetic sample" and before "Privacy," pointing to DEPLOY.md.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write DEPLOY.md + link it from README.md** - `6036e27` (docs)

_No plan-metadata commit yet — final metadata commit happens after this SUMMARY.md is written (see final_commit step)._

## Files Created/Modified
- `DEPLOY.md` - New file: intro + isolation statement, MANUAL/unverified callout, env-var inventory table, 7-step literal instruction sequence, "How the demo deployment self-populates" explanation
- `README.md` - Added "Deploying a Second (Demo) Instance" section linking to DEPLOY.md

## Decisions Made
- Referenced `backend/.env.example` as the single source of truth for env var names rather than re-listing literal placeholder values in DEPLOY.md, avoiding two documents drifting out of sync.
- Matched `DEPLOY.md`'s markdown style (plain fenced bash blocks, one-line explanation above each, no prose padding) to `README.md`'s existing "Setup"/"Seeding"/"Synthetic sample" sections for consistency, per the plan's explicit style instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. This worktree's branch base had drifted from an unrelated prior session (a favicon-restyle quick task chain) rather than the expected phase-19 tracking commit; corrected via the mandatory `<worktree_branch_check>` reset step before any plan work began, per that step's own instructions — not a deviation from this plan's task list.

## User Setup Required

None for this plan's own scope — but the deliverable itself is a manual runbook. See `DEPLOY.md` for the actual Railway/Vercel dashboard steps the user must perform to realize D-01 (the second deployment does not exist yet; this plan only produces the instructions for creating it).

## Next Phase Readiness

D-01 and D-02 are closed at the documentation level: the literal instructions, env-var inventory, and transparency callout all exist and are discoverable from README.md. Standing up the actual second deployment remains an out-of-band manual action for the user (per `19-VALIDATION.md`'s `human_needed` flag) — no further code or planning work is blocked on that happening.

---
*Phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: DEPLOY.md
- FOUND: .planning/phases/19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u/19-07-SUMMARY.md
- FOUND: commit 6036e27 (task commit)
- FOUND: commit 254528d (summary commit)
