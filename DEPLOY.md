# Deploying a Second (Demo) Instance

This document is the literal, step-by-step instruction sequence for standing up a second,
**isolated** "guest demo" deployment (D-01): a separate Railway project, a separate Vercel
project, and a fresh Postgres database — never shared-DB row-tagging. It runs the exact same
codebase as Chris's real deployment, distinguished only by new environment variables.

**⚠️ MANUAL — not executed or verified in this environment.** No Railway/Vercel CLI access
exists in the environment that authored this document, so nothing below was actually run or
confirmed end-to-end (matches `19-VALIDATION.md`'s `human_needed` flag). This is transparency
about a real gap, not a gap being silently skipped — the user must follow these steps in the
real Railway/Vercel dashboards and confirm the result.

## Env var inventory

Names below are the same names already documented in `backend/.env.example` — this table adds
the second column and does not duplicate literal secret values. Set every "Demo deployment"
value only in the new Railway/Vercel projects' own dashboards, never in git.

| Var | Chris's real deployment | Demo deployment |
|-----|--------------------------|------------------|
| `DATABASE_URL` | Railway-injected (real Postgres) | Railway-injected — a **new** Postgres plugin in the new project |
| `ANTHROPIC_API_KEY` | (inert today, AGENT-01) | Same value or empty — `/agent` degrades identically either way |
| `SITE_PASSWORD` | real shared password | a new, distinct guest password |
| `SITE_USERNAME` | **unset** (today's login behavior, byte-for-byte) | a new guest username |
| `TOKEN_SECRET` | existing real secret | a **freshly generated, distinct** secret — see MUST below |
| `CORS_ORIGINS` | `["https://<real-app>.vercel.app"]` | `["https://<demo-app>.vercel.app"]` — the demo Vercel URL, not the real one |
| `VITE_API_URL` (frontend, set in Vercel) | real Railway backend URL | demo Railway backend URL |

**MUST: `TOKEN_SECRET` must be freshly generated for the demo deployment, never copied from
Chris's real one.**

```bash
python -c "import secrets;print(secrets.token_urlsafe(32))"
```

Reusing Chris's real `TOKEN_SECRET` across two independent deployments means a forged Bearer
token from one deployment would also be valid on the other — the same reasoning `config.py`'s
own boot-time guard (`_reject_dev_token_secret_in_deployment`) already enforces for the
insecure dev default: a shared-password gate backed by a shared or weak signing secret is
decorative, not real security.

## Literal step sequence

1. **Railway dashboard** → New Project → Deploy from GitHub repo → select this repo.
2. Set the new service's **Root Directory** to `backend` (Settings tab). **Before assuming
   either `railway.json` is authoritative:** `backend/railway.json` and the root-level
   `railway.json` are byte-identical today, and neither file alone proves which one the
   *existing* service actually reads — that depends on a Root Directory setting configured in
   the Railway dashboard, not in git. Check the existing service's Settings → Root Directory
   value first, and mirror it for the new service.
3. Add a **Postgres plugin** to the new project — this auto-provisions `DATABASE_URL`; you do
   not set it by hand.
4. In the Variables tab, set `SITE_PASSWORD`, `SITE_USERNAME`, `TOKEN_SECRET`, `CORS_ORIGINS`.
   `CORS_ORIGINS` has a circular dependency with the Vercel URL from step 6 — either deploy the
   backend first with a placeholder value and fix it after the frontend URL is known, or deploy
   the frontend first and come back. Either order works, since Railway restarts on every
   variable change.
5. Deploy. `start.sh` runs `alembic upgrade head`, then — because `SITE_USERNAME` is now set —
   auto-seeds readings/labs/incidents/procedures from the committed synthetic fixtures, then
   starts uvicorn. See "How the demo deployment self-populates" below.
6. **Vercel dashboard** → Add New → Project → import the same GitHub repo again → set Root
   Directory to `frontend` → set `VITE_API_URL` to the Railway backend URL from step 5 → Deploy.
7. Visit the demo Vercel URL, log in with the guest username/password set in step 4, and
   confirm the "Guest Demo · Synthetic Data" badge is visible and the dashboard is populated.

## How the demo deployment self-populates

`start.sh` gates a `python -m app.seed` call behind `SITE_USERNAME` being non-empty — the same
single flag that also turns on username-required login, the write-route 403 guest guard, and
the `/health` `demo` flag. Chris's real deployment never sets `SITE_USERNAME`, so this seed
branch is dead code there, permanently, with no second flag to remember to leave unset. The
seed is idempotent per table, so it is safe to run on every redeploy. In the normal path the
user's only manual task is "set the env vars and redeploy" — running `python -m app.seed` by
hand is documented as a fallback only, never required.
