---
phase: 05-upload-auth-gate-deployment
plan: 06
subsystem: deployment
tags: [deployment, railway, vercel, cors, postgres, railpack]
requirements: [DEPL-01, SEC-03]
status: complete
---

# 05-06 Summary — Ship to Railway + Vercel

## Outcome

The app is live on the public internet, end-to-end verified:

- **Frontend (Vercel):** https://health-dashboard-nine-omega.vercel.app
- **Backend (Railway):** https://health-dashboard-production-2c53.up.railway.app
- **Database:** Railway PostgreSQL 18.4, private networking, migrated on deploy (start-empty).

## Task 1 — Seed decision (checkpoint:decision)

**Decision: start-empty.** Production Postgres starts with no readings; the first
caregiver upload populates it. No seeder run. Consequence for Plan 07: the smoke
checklist must order **upload BEFORE view-charts** (dashboard shows the empty state
until data lands).

## Task 2 — Deploy config (auto)

- `railway.json` (repo root) + `backend/railway.json` — Railpack builder + start command.
- `backend/.env.example` — documented 5-var inventory, placeholders only, no secrets.

## Task 3 — Provision + deploy (checkpoint:human-action) — DONE

Railway (backend + private Postgres) and Vercel (frontend) provisioned by the user;
env vars set in the dashboards. Verified live:

| Check | Result |
|-------|--------|
| `/docs` | 200 (stable, 5/5) |
| `/readings` without token | 401 (gate enforcing, SEC-01) |
| `POST /auth` correct password | 200 + signed token |
| `/readings`, `/stats/summary` with token | 200 |
| CORS preflight from Vercel origin | 200 + `access-control-allow-origin` echo |
| CORS from disallowed origin | 400 (blocked) |
| Postgres | connected + migrated, private networking, no public proxy (SEC-03) |

Frontend serves `<title>Chris's Health Dashboard</title>`; bundle has
`VITE_API_URL` baked to the Railway origin; LoginGate loads publicly (Vercel
Deployment Protection disabled so the app's own gate is the gate).

## Deviations — deployment-config fixes committed directly to main

Railpack (v0.32) surfaced several environment issues not anticipated in the plan.
Each was fixed and committed under `05-06`:

1. `ca7d141` — added `backend/railway.json` so the start command is found when
   Railway **Root Directory = `backend`** (repo-root config alone was not scoped in).
2. `ceb2791` → `b6369d9` → `8eff799` → `f87c3ae` — the start command evolved to a
   robust `backend/start.sh` after discovering: bare `alembic`/`uvicorn` aren't on
   PATH; the mise `python` has no `alembic.__main__`; and **Railpack did not
   pip-install the PEP 621 setuptools pyproject at all**. Final fix: add
   `backend/requirements.txt` (mirrors pyproject runtime deps) so Railpack installs
   dependencies, and `start.sh` locates the interpreter that can import
   `alembic.config`+`uvicorn`, runs `alembic upgrade head`, then `uvicorn` on `$PORT`.

Config-side gotchas confirmed live: the psycopg3 `DATABASE_URL` normalizer (Plan 02)
let the app boot on Railway's `postgresql://`; `CORS_ORIGINS` MUST be a JSON array
(a bare string crashes boot — observed and corrected in prod).

## Env vars set in Railway (not in git)

`DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SITE_PASSWORD`, `TOKEN_SECRET`,
`CORS_ORIGINS=["https://health-dashboard-nine-omega.vercel.app"]`. `ANTHROPIC_API_KEY`
optional (agent degrades to "unavailable" if unset) — confirm before relying on voice.

## Requirements

- **DEPL-01** — Vercel + Railway via env vars, CORS allow-list ✅
- **SEC-03** — Postgres private, migrations ran on deploy ✅

## Self-Check: PASSED
