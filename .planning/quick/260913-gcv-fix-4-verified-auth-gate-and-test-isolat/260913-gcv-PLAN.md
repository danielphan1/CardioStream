---
quick_id: 260913-gcv
type: execute
wave: 1
depends_on: []
autonomous: false
files_modified:
  - backend/tests/conftest.py
  - backend/tests/test_auth_upload.py
  - backend/app/routers/auth.py
  - backend/app/config.py
  - backend/.env            # gitignored, local machine only — see Task 3
must_haves:
  truths:
    - "A deploy that forgets SITE_PASSWORD cannot issue a token (fails CLOSED)."
    - "A non-ASCII password returns a clean 401, never a 500."
    - "A deploy with SITE_PASSWORD set but TOKEN_SECRET left at the public dev default refuses to boot."
    - "backend/ pytest is deterministic with the developer's real backend/.env present on disk."
    - "Correct password still issues a token; that token still unlocks gated routes."
  artifacts:
    - path: "backend/tests/conftest.py"
      provides: "Module-level ambient-.env isolation for the whole suite"
      contains: "env_file"
    - path: "backend/app/routers/auth.py"
      provides: "Fail-closed, bytes-comparing password check"
    - path: "backend/app/config.py"
      provides: "Boot-time TOKEN_SECRET model_validator"
      contains: "model_validator"
  key_links:
    - from: "backend/tests/conftest.py"
      to: "app.config.Settings.model_config"
      via: "module-level mutation, before any test module import"
      pattern: "Settings\\.model_config"
---

<objective>
Fix four verified defects in the shared-password gate and the backend test suite. Three of
them make the gate — the only thing protecting one real person's health data — fail OPEN on
misconfiguration; the fourth makes the test suite read the developer's real secrets.

Purpose: CLAUDE.md Privacy constraint ("shared-password gate before the deployed site — health
data is sensitive") and Security constraint. A misconfigured deploy must fail CLOSED, loudly.
Output: 3 hardened backend files, 1 isolated conftest, and regression tests that each provably
fail against today's code.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@backend/app/routers/auth.py
@backend/app/config.py
@backend/app/auth.py
@backend/tests/conftest.py
@backend/tests/test_auth_upload.py
</context>

<preflight>
All four findings were REPRODUCED end-to-end before this plan was written. **Do not re-audit,
re-derive, or re-litigate them.** The fix for Finding 3 is a locked user decision — the user
explicitly considered and rejected both an `ENVIRONMENT` flag and a runtime-401 variant.

Run every command from `backend/`. The interpreter is `backend/.venv/bin/python`
(bare `python` is not on PATH in this shell); `pytest` = `.venv/bin/python -m pytest`,
`ruff` = `.venv/bin/ruff`.

**Baseline, measured on this machine just now — reproduce it before changing anything:**

```
.venv/bin/python -m pytest -q     # 1 failed, 278 passed, 7 skipped, 43 deselected
.venv/bin/ruff check .            # All checks passed!
```

The 1 failure is `test_auth_upload.py::test_config_new_fields_default_keyless` — that IS
Finding 4. If your baseline differs, stop and report.

**Facts already established by measurement — trust these, they cost real time to find:**

1. `backend/.env` on this machine contains `SITE_PASSWORD=dev-local-test` AND
   `TOKEN_SECRET=dev-insecure-secret`. It is therefore *itself* the exact misconfiguration
   Finding 3's validator is designed to reject. This drives both the task ordering and Task 3.
2. `app/db.py:8` calls `get_settings()` at **module import time**, and
   `tests/test_auth_upload.py` imports `app.routers.agent` → `app.deps` → `app.db` at module
   scope. So `Settings()` is constructed during pytest **collection**, before any fixture runs.
   → An autouse *fixture* is too late to isolate the env. The isolation must execute at
   `conftest.py` **module level** (conftest is fully imported before any test module).
   → And once Task 3's validator exists, an un-isolated ambient `.env` does not fail one test;
   it errors out **collection of the entire suite**.
3. `Settings.model_config["env_file"] = None` neutralizes the dotenv source for bare
   `Settings()` calls, and `monkeypatch.setenv` still wins afterward (verified both directions).
4. `app/models.py` imports only stdlib + sqlalchemy — it does NOT touch `app.config`. So
   `conftest.py`'s existing top-of-file imports are safe; the isolation block can sit *after*
   the import block with no `E402`.
5. `SITE_PASSWORD` appears in exactly one test fixture (`auth_password`,
   `test_auth_upload.py:126-136`). No other test sets it. `test_migrations.py` sets only
   `DATABASE_URL`.

**Task order deviates from the suggestion in the request — isolation is Task 1, not Task 2.**
Justification: fact 2 above. Finding 1's regression test asserts behavior when SITE_PASSWORD is
*unconfigured*, but on this machine `.env` configures it, and `monkeypatch.delenv` does NOT
help (measured: `Settings().site_password` is still `'dev-local-test'` after delenv, because
the dotenv source is still live). Landing isolation first lets that test express its intent
honestly via the real default instead of a synthetic empty-string env var, and gives a
deterministic suite before any behavior changes.
</preflight>

<tasks>

<task type="auto">
  <name>Task 1: Isolate the test suite from the ambient backend/.env (Finding 4)</name>
  <files>backend/tests/conftest.py</files>
  <action>
Add a module-level isolation block to `backend/tests/conftest.py`, placed AFTER the existing
import block (so ruff `E402` never fires) and BEFORE the first fixture. It must: import
`Settings` and `get_settings` from `app.config`; set `Settings.model_config["env_file"] = None`
to neutralize the dotenv source for every bare `Settings()` / `get_settings()` in the suite;
`os.environ.pop(...)` the three ambient secrets `SITE_PASSWORD`, `TOKEN_SECRET`,
`ANTHROPIC_API_KEY` (defensive — covers a developer who exports them in the shell, not just
`.env`); and call `get_settings.cache_clear()`. Add `import os` to the import block.

Do NOT scrub `DATABASE_URL` or `CORS_ORIGINS`: `test_migrations.py` sets its own `DATABASE_URL`
per-test and `.env`'s value is byte-identical to the code default, so scrubbing them buys
nothing and risks surprising a passing test.

Do NOT make this an autouse fixture — see preflight fact 2, a fixture runs too late.
Do NOT teach `app/config.py` about pytest; production code stays test-unaware.

Comment the block with WHY it is module-level (collection-time `Settings()` construction via
`app.db`), so nobody later "tidies" it into a fixture and silently reopens the hole.

Ordering with `monkeypatch`: this block runs once at import; `monkeypatch.setenv` in
`auth_password` / `test_migrations.py` runs per-test and takes precedence over the (now
neutralized) file source. Verified in both directions — no conflict.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; .venv/bin/python -m pytest -q tests/test_auth_upload.py::test_config_new_fields_default_keyless tests/test_migrations.py tests/test_health.py</automated>
  </verify>
  <done>
`test_config_new_fields_default_keyless` PASSES with `backend/.env` still present on disk
(confirm the file is there: `ls -l backend/.env`). `test_migrations.py` and `test_health.py`
still pass. Full suite is `0 failed, 278 passed`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fail closed on empty SITE_PASSWORD + 401 on non-ASCII (Findings 1 &amp; 2)</name>
  <files>backend/app/routers/auth.py, backend/tests/test_auth_upload.py</files>
  <action>
**Write the two regression tests FIRST, and prove each one fails, before touching
`routers/auth.py`.** A security regression test that passes against the unfixed code is not a
pass — it is a defect in the test. Fix the test, do not proceed.

Add to `tests/test_auth_upload.py` (near the existing `/auth` route tests):

- *Finding 1 regression* — with SITE_PASSWORD unconfigured (`monkeypatch.delenv("SITE_PASSWORD",
  raising=False)` + `get_settings.cache_clear()`; after Task 1 this genuinely yields `""`),
  `POST /auth {"password": ""}` via `real_gate_client` must return **401** with
  `detail == "unauthorized"`, and the body must carry no `token` key. Expected pre-fix
  observation: **200 with a working token**.
- *Finding 2 regression* — with the `auth_password` fixture active,
  `POST /auth {"password": "pässwörd"}` must return **401**. Expected pre-fix observation: the
  route raises `TypeError: comparing strings with non-ASCII characters is not supported`, and
  because `TestClient` re-raises server exceptions by default this surfaces as a test **ERROR**,
  not a 500 response. That error IS the fail-first signal — record it and move on; do not
  "fix" the test by wrapping it in `pytest.raises`.

Record both pre-fix observations in the summary.

Then fix `backend/app/routers/auth.py`'s single check (line 40). Two changes, one `if`:
  1. Refuse outright when the configured `site_password` is empty — no token is issued, ever.
  2. Compare `utf-8`-encoded **bytes** on both sides, not `str`. `hmac.compare_digest` accepts
     bytes and stays constant-time.
Both failure modes raise the SAME opaque `HTTPException(401, detail="unauthorized")` already
used for a wrong password — never a distinct message, never a hint about which one tripped.

Preserve every pinned invariant in the module docstring: `/auth` stays ungated, the decorator
order (`@router.post` above `@limiter.limit`) and the `request: Request` first parameter stay
exactly as they are, and nothing about the candidate password is ever logged. Extend the
docstring to state the new fail-closed rule.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; .venv/bin/python -m pytest -q tests/test_auth_upload.py</automated>
  </verify>
  <done>
Both new tests were observed FAILING before the fix and PASS after. The 4 pre-existing `/auth`
tests (correct password → token → gated 200, wrong password → 401, ungated, 6th request → 429)
all still pass unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 3: Refuse to boot on the public default TOKEN_SECRET (Finding 3)</name>
  <files>backend/app/config.py, backend/tests/test_auth_upload.py, backend/.env</files>
  <action>
**Locked user decision — implement exactly this shape. Do not propose alternatives.**

Write the regression test FIRST and prove it fails. In `tests/test_auth_upload.py`, alongside
the other config tests: `Settings(site_password="anything")` (dev default `token_secret`) must
raise `pydantic.ValidationError`, and `str(excinfo.value)` must contain both `"TOKEN_SECRET"`
and `"secrets.token_urlsafe(32)"`. Expected pre-fix observation: **no exception raised** →
`DID NOT RAISE`. Add two companion tests proving the keyless path survives:
`Settings()` (both defaults) constructs fine, and `Settings(site_password="x",
token_secret="a-real-secret")` constructs fine.

Then in `backend/app/config.py` add a pydantic `@model_validator(mode="after")` on `Settings`
that raises when `site_password` is non-empty AND `token_secret` is still
`"dev-insecure-secret"` — i.e. a real deployment that forgot the secret. The message must name
`TOKEN_SECRET` and include the generator command
`python -c "import secrets;print(secrets.token_urlsafe(32))"`. Extract the dev default into a
module-level constant so the validator and the field default cannot drift apart.

**KEEP the `"dev-insecure-secret"` default itself** — keyless local/test boot depends on it, and
Task 1's isolated suite constructs `Settings()` with no `site_password`, which the validator
must not touch. Under no circumstances weaken the validator to make a test pass.

Then fix the two fallout sites:

1. **`auth_password` fixture** (`test_auth_upload.py:126-136`) — it sets `SITE_PASSWORD` and
   leaves `TOKEN_SECRET` at the default, so `Settings()` now raises mid-request. Add
   `monkeypatch.setenv("TOKEN_SECRET", ...)` with any non-default value. This is the CORRECT
   change: a test must not lean on an insecure default. Grep `tests/` for other `SITE_PASSWORD`
   setters and fix any you find — measurement says this fixture is the only one, but confirm it
   yourself rather than trusting that.
2. **`backend/.env` on this machine** — it sets `SITE_PASSWORD=dev-local-test` with
   `TOKEN_SECRET=dev-insecure-secret`, so after this validator lands the real app will refuse to
   boot locally (`uvicorn`, `alembic`, anything importing `app.db`). That is the validator doing
   its job, not a bug. Regenerate the local value with the documented command and write it into
   `backend/.env` (gitignored — local machine only, never committed, and `.env.example` already
   documents the requirement so it needs no edit). Then prove the app still boots:
   `.venv/bin/python -c "import app.main"` must exit 0.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; .venv/bin/python -c "import app.main" &amp;&amp; .venv/bin/python -m pytest -q &amp;&amp; .venv/bin/ruff check .</automated>
  </verify>
  <done>
The forgery-guard test was observed as `DID NOT RAISE` before the fix and passes after. Keyless
`Settings()` still constructs. `import app.main` exits 0. Full suite: 0 failed, ≥281 passed,
7 skipped. `ruff check .` clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
All four defects fixed: `/auth` now fails closed on an unset SITE_PASSWORD and returns a clean
401 on a non-ASCII password; `Settings` refuses to construct when a real deployment forgot
TOKEN_SECRET; the backend suite no longer reads the developer's real `backend/.env`.
  </what-built>
  <how-to-verify>
1. `backend/.env` was edited on this machine (TOKEN_SECRET regenerated). It is gitignored —
   confirm `git status` shows it untracked/ignored and that NO secret value appears in the diff
   or the commit message.
2. If this app is deployed to Railway: **`TOKEN_SECRET` must be set in the Railway service
   variables before the next deploy**, or the service will now refuse to boot. That is the
   intended fail-closed behavior, but it is a deploy-time action only you can take. Confirm it
   is set, or confirm you accept the boot failure until you set it.
3. `cd frontend && npx vitest run` → still 475 passing, zero files under `frontend/` touched.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| public internet → `POST /auth` | Untrusted password candidate; the only door into the gate |
| deploy environment → `Settings` | Operator-supplied config; a missing var previously failed OPEN |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-GCV-01 | Spoofing | `routers/auth.py` password compare | mitigate | Refuse to issue a token when `site_password` is empty (Task 2) |
| T-GCV-02 | Denial of Service / Info disclosure | `routers/auth.py` | mitigate | utf-8 byte compare — no uncaught `TypeError`, no stack trace to the client (Task 2) |
| T-GCV-03 | Spoofing | `app/auth.py` token signature | mitigate | Boot-time validator rejects the public dev `TOKEN_SECRET` in a configured deployment (Task 3) |
| T-GCV-04 | Information disclosure | backend test suite | mitigate | Suite no longer reads the real `.env`, so a real `ANTHROPIC_API_KEY` / password never enters a test run (Task 1) |
| T-GCV-05 | Information disclosure | `backend/.env` edit | accept | File is gitignored; checkpoint verifies no secret reaches the diff or commit message |
| T-GCV-SC | Tampering | dependency installs | n/a | Zero new dependencies — `hmac`, `os`, and `pydantic.model_validator` are all already in use |
</threat_model>

<verification>
From `backend/`:
- `.venv/bin/python -m pytest -q` → **0 failed**, ≥281 passed, 7 skipped, 43 deselected, WITH
  `backend/.env` present on disk (`ls -l backend/.env` to prove it).
- `.venv/bin/ruff check .` → All checks passed.
- `.venv/bin/python -c "import app.main"` → exit 0.

From `frontend/`:
- `npx vitest run` → 475 passing. Zero files under `frontend/` modified (`git status`).
</verification>

<success_criteria>
- Each of the 3 security regression tests was observed FAILING against the unfixed code, and
  the pre-fix observation is recorded in the summary. (Finding 2's pre-fix signal is a
  `TypeError` **error**, not a 401/500 assertion failure — that counts.)
- Happy path unchanged: correct password → token → that token unlocks `GET /readings`.
- Keyless local/dev boot still works: bare `Settings()` constructs with no env at all.
- The `auth_password` fixture sets an explicit `TOKEN_SECRET`; the validator was NOT weakened.
- `backend/.env` regenerated locally, nothing secret committed.
</success_criteria>

<output>
Write `.planning/quick/260913-gcv-fix-4-verified-auth-gate-and-test-isolat/260913-gcv-SUMMARY.md`.
Include, verbatim, the three pre-fix failure observations. Also update STATE.md Blockers: the
`.env` leak entry (`test_config_new_fields_default_keyless` fails locally) is now CLOSED by
Task 1 — remove it rather than leaving it to be rediscovered.
</output>
