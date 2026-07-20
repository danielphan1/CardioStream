---
phase: 03-agent-via-text-input
plan: 03
subsystem: backend-agent
tags: [agent, service, route, slowapi, cors, structured-outputs, fixtures, live-eval]
requires:
  - "app.agent.schemas (AgentOutput union, AgentReply/AppliedFilters/ClarifyContext/CustomRange, token→label maps — 03-01)"
  - "app.agent.resolver (resolve_date_range, ResolvedDates, InvalidRange — 03-01)"
  - "app.agent.prompt (SYSTEM_PROMPT, build_messages — 03-01)"
  - "app.agent.copy (fixed refusal/unclear/unavailable/data-question templates — 03-01)"
  - "app.deps.get_db + app.models.Reading (unfiltered date anchors)"
provides:
  - "app.agent.service: interpret() pipeline + call_claude + lazy keyless-safe _get_client + Interpreter alias"
  - "app.routers.agent: POST /agent (slowapi 20/min, get_interpreter dependency, DB date anchors, never-500 backstop)"
  - "app.main: CORS GET+POST, slowapi limiter + 429 handler, agent router include behind verify_token"
  - "backend/tests/test_agent_route.py: 12 deterministic route tests via fake interpreter"
  - "backend/tests/fixtures/agent_utterances.json + test_agent_fixtures.py: 35-utterance live eval suite (SC4)"
affects:
  - "backend/app/main.py (CORS methods/headers widened, slowapi wired, agent router included)"
tech-stack:
  added: []
  patterns:
    - "Guarded structured-outputs call: no-key→APIError/ValidationError→stop_reason→parsed_output, every branch → friendly 200 (Pitfall 5, VOICE-07)"
    - "Dependency-injected interpreter (get_interpreter mirrors get_db) for network-free deterministic route tests (Pattern 3)"
    - "Double never-500 backstop (service except-Exception + route except-Exception)"
    - "Live eval suite double-gated by @pytest.mark.live + skipif-no-key; default runs deselect it"
key-files:
  created:
    - backend/app/agent/service.py
    - backend/app/routers/agent.py
    - backend/tests/test_agent_route.py
    - backend/tests/fixtures/agent_utterances.json
    - backend/tests/test_agent_fixtures.py
  modified:
    - backend/app/main.py
decisions:
  - "get_settings_key() helper isolates the SEC-02 key read so the lazy client stays trivially testable and the key never leaves the Settings boundary"
  - "customRange emitted via CustomRange(from_=...) and serialized by FastAPI response_model with the wire alias 'from' (default by_alias)"
  - "Fixture suite is 35 entries (target 30–34 +1) — the extra relative-adjustment-rejection entry (D-14) rounds out the SC4 coverage"
metrics:
  tasks: 3
  files: 6
  completed: 2026-07-20
---

# Phase 3 Plan 03: Agent Route + Interpretation Service Summary

`POST /agent` is live: a guarded `claude-haiku-4-5` structured-outputs call whose five result variants are re-mapped to server-composed `AgentReply`s with fixed copy, dates resolved server-side against real DB min/max anchors, behind a 20/minute slowapi limit and the `verify_token` router stub — every model-side failure collapsing to a friendly 200, proven by 12 network-free route tests plus a 35-utterance live eval suite wired for the 03-05 gate.

## What Was Built

- **`service.py`** — The interpretation pipeline. `_get_client()` lazily constructs and caches an `Anthropic(api_key, timeout=15.0, max_retries=1)` client, returning `None` when the key is empty (keyless boot, Pitfall 9). `call_claude()` runs the exact RESEARCH Code Example 1 call (`messages.parse(model="claude-haiku-4-5", max_tokens=1024, temperature=0, system=SYSTEM_PROMPT, output_format=AgentOutput)`) with the pinned guard order — catch `(APIError, ValidationError)`, reject `stop_reason in ("refusal","max_tokens")`, then return `parsed_output` — every failure yielding `None`. `interpret()` maps the five variants: `DashboardCommand` → `applied` (resolver-driven dates, token→label maps for amPm/bpCategory, `message=""` so the frontend owns the D-07 echo, `InvalidRange`→unclear), `DataQuestion` → `applied` + `DATA_QUESTION_MESSAGE`, `Clarification` → `clarify` (display-only question + one-turn `ClarifyContext` preserving the true original across a repeat), `MedicalRefusal` → `refuse` with fixed `medical_refusal()` copy, `Unintelligible` → `unclear`. A final `except Exception` is the absolute never-500 backstop (logs a warning with no key/payload). `Interpreter` type alias exported for the route.
- **`routers/agent.py`** — Module-level `Limiter(key_func=get_remote_address)`; `get_interpreter()` dependency returning `interpret` (override-able like `get_db`). The `@router.post("/agent")` decorator sits above `@limiter.limit("20/minute")`; the signature declares `request: Request` (Pitfall 6). The body queries BOTH unfiltered anchors (`func.max/min(Reading.datetime_)`), converts to `.date()`, and calls the interpreter inside a route-level `try/except Exception` never-500 backstop.
- **`main.py`** — CORS widened to `allow_methods=["GET","POST"]` + `allow_headers=["Authorization","Content-Type"]` (Pitfall 1 preflight fix); `app.state.limiter` + `RateLimitExceeded`→`_rate_limit_exceeded_handler`; `agent.router` included with `dependencies=[Depends(verify_token)]`.
- **`test_agent_route.py`** — 12 deterministic tests via `app.dependency_overrides[get_interpreter]`, with an autouse `limiter.reset()` fixture so the 20/minute budget never bleeds: applied/clarify/refuse/unclear field round-trips, `customRange` "from" alias, never-500 (raising interpreter → 200 unclear), 422 validation (missing/empty/501-char text), anchor wiring (seeded readings → interpreter receives exact min/max dates), 20→200 / 21st→429 rate limit, and CORS-POST preflight.
- **`fixtures/agent_utterances.json` + `test_agent_fixtures.py`** — 35-entry eval suite (charts, presets/reset, AM/PM combos, categories, symbolic dates, 4 garbled transcripts, 4 medical refusals, data questions, a context-bearing clarify follow-up, gibberish, relative-adjustment rejection). The runner is `@pytest.mark.live` + `skipif(no key)`, parametrized by id, asserting `kind`/`kind_in` + structured filter fields only — never message wording.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | interpret() service — guarded Claude call + variant mapping | 4290773 |
| 2 | /agent route, slowapi, main.py wiring, deterministic route tests | 6895a9f |
| 3 | ~35-utterance fixture suite + live-marked eval runner | a04fc21 |

## Verification

- Keyless `interpret('show my pulse', ...)` → `kind="unclear"` (`UNAVAILABLE_MESSAGE`), no network call — **KEYLESS-OK**
- `python -m pytest -q` (keyless): **181 passed, 7 skipped, 35 deselected** (was 169 passed in 03-01; +12 route tests, +35 live deselected)
- `python -m pytest tests/test_agent_route.py`: 12 passed incl. 21st→429 and never-500
- Live suite: default run collects ZERO from `test_agent_fixtures.py` (35 deselected); `pytest -m live --collect-only` → 35 parametrized tests
- Acceptance greps on `service.py`: `def interpret(`/`def call_claude(`/`def _get_client(` present; `stop_reason` + `APIError, ValidationError` present; `message=""` on applied branch; `temperature=0` present; model string exactly `claude-haiku-4-5`
- `grep -c "message ==" test_agent_fixtures.py` → 0 (asserts intent/fields only)
- SEC-02: the Anthropic key is read only via `get_settings().anthropic_api_key`; it appears in no log line, no response field (verified by inspection); the SDK constructor kwargs `api_key`/`timeout`/`max_retries` confirmed present in anthropic 0.117.0 (A4 resolved)
- `ruff check` on all five new/modified files: clean

## SDK Compatibility Notes (A3, A4 resolved)

- **A4 (client kwargs):** `Anthropic(api_key=, timeout=, max_retries=)` and `messages.parse(..., output_format=AgentOutput)` all verified against the installed anthropic 0.117.0 by signature inspection — the RESEARCH Code Example 1 call shape stands as written, no adaptation needed.
- **A3 (slowapi/FastAPI 0.139 compat):** slowapi 0.1.10 works with the current Starlette — the 20→200/21st→429 route test passes, so the documented ~20-line in-process fallback limiter was NOT needed.

## Deviations from Plan

None — plan executed as written. One in-flight correction with no behavior impact: the first draft of `test_agent_route.py` imported a non-existent `medical_refusal_probe`; the refuse test was fixed to import `medical_refusal` from `app.agent.copy` (the fixed-copy source) before any commit, so no bad state was ever committed.

## Environment Note

The worktree has no `.venv`; the main-repo venv (`backend/.venv`, Python 3.12) was reused with `PYTHONPATH` pointed at the worktree sources, and all deterministic tests run keyless with `env -u ANTHROPIC_API_KEY` — matching 03-01's approach. `anthropic` 0.117.0 and `slowapi` 0.1.10 were already installed in that venv from 03-01. The live fixture suite requires a real `ANTHROPIC_API_KEY` (via `backend/.env` or shell env) and is deferred to the 03-05 phase gate.

## Self-Check: PASSED

- All 5 created files present; `backend/app/main.py` modified.
- Commits 4290773, 6895a9f, a04fc21 exist in branch history.
