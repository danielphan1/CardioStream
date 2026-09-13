---
status: complete
quick_id: 260913-gcv
date: 2026-09-13
---

# Quick Task 260913-gcv — Summary

> **Provenance note:** the executor wrote its SUMMARY.md inside its worktree and the
> orchestrator removed that worktree before copying the file out. This document is
> reconstructed by the orchestrator from the executor's returned report plus commands
> re-run directly against `main` after the merge. Every number below was re-verified
> post-merge on the main checkout; none is quoted from memory alone. The executor's
> original prose is gone — that loss is the orchestrator's error, recorded here rather
> than hidden.

## What this fixed

Four defects found in a correctness review (the preceding audit, 260913-fdm, was scoped
to over-engineering and explicitly excluded correctness). Three of the four made the
shared-password gate — the only thing protecting one real person's health data — fail
**open** on misconfiguration.

| # | Defect | Fix |
|---|--------|-----|
| 1 | `compare_digest("", "")` is `True` and `site_password` defaults to `""`, so with `SITE_PASSWORD` unset an empty password got a valid token that unlocked every gated route | `/auth` refuses to issue a token when `site_password` is empty — 401, same opaque detail as a wrong password |
| 2 | `hmac.compare_digest` raises `TypeError` on non-ASCII `str`; `/auth` has no never-500 backstop, so an accented password returned 500 instead of 401 | compare utf-8 encoded bytes on both sides; still constant-time |
| 3 | `token_secret` defaulted to `"dev-insecure-secret"`, a value committed to this repo — a deploy that set `SITE_PASSWORD` but forgot `TOKEN_SECRET` could be bypassed with a token forged entirely offline | `Settings` `@model_validator(mode="after")` refuses to boot when `site_password` is set AND `token_secret` is still the dev default |
| 4 | `SettingsConfigDict(env_file=".env")` meant the test suite inherited the developer's real `backend/.env` — green in CI, red locally, and every config-touching test silently ran against ambient real secrets | `conftest.py` neutralizes the env_file and clears the relevant vars at **module level** |

## Fail-first evidence

Each regression test was observed failing against the unfixed code before its fix landed.
A security regression test that passes before the fix is worthless.

| Finding | Pre-fix observation |
|---|---|
| 4 | `AssertionError: assert 'dev-local-test' == ''` |
| 1 | `assert 200 == 401` — the gate handed a valid token to an anonymous caller |
| 2 | `TypeError: comparing strings with non-ASCII characters is not supported` at `app/routers/auth.py:40` — an ERROR, not an assertion failure, because `TestClient` re-raises server exceptions. Deliberately left unwrapped: the point is that it escapes as a 500 |
| 3 | `Failed: DID NOT RAISE ValidationError` |

## Two findings from the executor worth keeping

**1. Task order had to change, and fixture-scope isolation would not have worked.**
`app/db.py:8` calls `get_settings()` at module import, and the test modules reach it during
pytest **collection** — before any fixture runs. So an autouse isolation fixture is too late;
the isolation has to execute at `conftest.py` module level. Relatedly, `monkeypatch.delenv`
does not help, because the dotenv source stays live (measured: `Settings().site_password`
was still `'dev-local-test'` after `delenv`). Isolation therefore landed FIRST, so the suite
was deterministic before config behavior changed.

**2. A naive version of this fix would have leaked the password into deploy logs.**
Pydantic echoes the entire input dict into `ValidationError`, so the new boot failure would
have printed the real `SITE_PASSWORD` into Railway's boot output. The executor added
`hide_input_in_errors=True` to `Settings.model_config` and confirmed empirically:
`'hunter2-REAL-SECRET' in str(e)` was `True` before, `False` after. The locked validator
shape was not touched.

**Baseline correction:** the executor measured `2 failed, 277 passed`, not the planned
`1 failed, 278 passed`. The extra failure was `test_health_ok_and_keyless_in_test_env`,
the same Finding-4 root cause on a second test, surfaced because the synthetic `.env`
set a non-empty `ANTHROPIC_API_KEY` where the real one leaves it empty. Proven, not
assumed (`ANTHROPIC_API_KEY= pytest tests/test_health.py` → 7 passed pre-fix). Task 1
fixed both together.

The validator was never weakened to accommodate a test. The 5 broken tests were fixed by
giving the `auth_password` fixture an explicit `TOKEN_SECRET`; `tests/` was grepped to
confirm that fixture is the only `SITE_PASSWORD` setter.

## Results (re-verified on `main` after merge, with the real `backend/.env` present)

| Gate | Result |
|------|--------|
| backend `pytest -q` | **284 passed, 7 skipped, 43 deselected, 0 failed** (baseline 277 passed) |
| backend `ruff check .` | All checks passed |
| `python -c "import app.main"` | exit 0 (after the local secret rotation below) |
| frontend `npx vitest run` | 475 passed, 37 files — untouched |
| files changed | 4 backend files only; zero under `frontend/` |
| secrets in the diff | none — grep-verified for both the password and the generated secret |

## Commits

- `f6d7345` — Task 1: conftest ambient-`.env` isolation (Finding 4)
- `95fd066` — Task 2: `/auth` fails closed + non-ASCII 401 (Findings 1 & 2)
- `cb614dd` — Task 3: `TOKEN_SECRET` boot validator (Finding 3)
- `3bda83c` — merge to `main`
- `642c2e6` — follow-on: ignore sibling `.env.*` files (see below)

## Follow-on found during close-out

Rotating the local secret meant taking a backup, which surfaced that `.gitignore` covered
`.env` but **not** `.env.bak` / `.env.local` / `.env.prod` — any of them was one `git add .`
away from committing real secrets. Fixed in `642c2e6` with `.env.*` plus a `!.env.example`
negation so the deliberately-tracked placeholder template survives. Verified both
directions: the three sibling names are now ignored, `.env.example` is still trackable.

## Manual follow-ups

- **DONE by the orchestrator:** the local `backend/.env` paired `SITE_PASSWORD=dev-local-test`
  with `TOKEN_SECRET=dev-insecure-secret`, so the new validator refused to boot the local app.
  A fresh secret was generated with `secrets.token_urlsafe(32)` and written to `backend/.env`;
  `import app.main` then exited 0. The temporary backup was deleted, not left on disk.
- **STILL OUTSTANDING — the user's call:** production is confirmed to have both `SITE_PASSWORD`
  and `TOKEN_SECRET` set in Railway, so **the deployed site was never exposed** and the
  validator will not fire there. No deploy action is required. If a *new* environment
  (staging, a rebuilt service) is ever created, `TOKEN_SECRET` must be set before first boot
  or the service will refuse to start — which is the intended behavior.

## Scope note

This was a targeted pass at auth, the ETL, and the agent trust boundary — not an exhaustive
security review. One item was seen and deliberately left unfixed rather than bundled into a
security change: `parse_omron` reads the entire `.xlsx` into memory *before* the 10k-row guard
fires, so that guard does not actually bound memory. It sits behind the auth gate, so it needs
an authenticated caller. Recorded in Blockers.
