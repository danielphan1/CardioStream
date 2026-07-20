---
phase: 03-agent-via-text-input
plan: 01
subsystem: backend-agent
tags: [agent, schemas, resolver, prompt, copy, structured-outputs, pydantic]
requires:
  - "app.deps.BPCategory (canonical labels)"
  - "frontend/src/lib/dates.ts resolveFilters (parity target)"
provides:
  - "app.agent.schemas: AgentOutput closed union + AgentRequest/AgentReply/AppliedFilters + token→label maps"
  - "app.agent.resolver: resolve_date_range + n_day_range (API-05 symbolic resolution)"
  - "app.agent.prompt: SYSTEM_PROMPT + build_messages (D-09..D-16, D-12 one-turn memory)"
  - "app.agent.copy: fixed refusal/didn't-catch/data-question templates (VOICE-09)"
  - "config.anthropic_api_key setting (SEC-02, keyless boot)"
affects:
  - "backend/pyproject.toml (anthropic + slowapi deps, live marker)"
tech-stack:
  added: [anthropic==0.117.*, slowapi==0.1.*]
  patterns:
    - "Constraint-free Claude-facing schema + service-layer clamp (Pitfall 3)"
    - "Recursive lowercase token normalizer against enum-capitalization drift (Pitfall 2)"
    - "Symbolic date tokens resolved server-side, anchored to latest reading, never the wall clock (Pitfall 4)"
    - "Fixed server-side safety copy, never model prose (VOICE-09)"
key-files:
  created:
    - backend/app/agent/__init__.py
    - backend/app/agent/schemas.py
    - backend/app/agent/resolver.py
    - backend/app/agent/prompt.py
    - backend/app/agent/copy.py
    - backend/tests/test_agent_schemas.py
    - backend/tests/test_agent_resolver.py
  modified:
    - backend/pyproject.toml
    - backend/app/config.py
decisions:
  - "InvalidRange is an Exception (raised) rather than a sentinel — the service layer will catch it and map to an unclear reply"
  - "Month-range year rollback applies whenever the resolved start is after the anchor, per plan A5 (single-year dataset)"
  - "ResolvedDates is a frozen dataclass exposing either date_preset OR custom_from/custom_to"
metrics:
  tasks: 3
  files: 9
  completed: 2026-07-20
---

# Phase 3 Plan 01: Backend Agent Foundation Summary

Backend agent foundation — a constraint-free Claude-facing structured-outputs union, a symbolic date resolver mirroring the frontend `resolveFilters` arithmetic, a static injection-safe system prompt with one-turn clarification memory, and fixed server-side safety copy — all unit-tested and booting keyless.

## What Was Built

- **`schemas.py`** — Two model families. The Claude-facing `AgentOutput` is a closed, constraint-free Literal-tagged union (five result variants; no `ge`/`le`, no `min_length`, no discriminated unions) so structured outputs cannot emit anything outside the vocabulary (API-04, D-14). A `mode="before"` normalizer recursively lowercases every string token (including nested `date_range` dicts) except the free-text `question` (Pitfall 2). The API-facing `AgentRequest`/`AgentReply`/`AppliedFilters`/`CustomRange` use ordinary Pydantic with bounds (`text` ≤ 500, `from` alias). `BP_TOKEN_TO_LABEL`/`AMPM_TOKEN_TO_LABEL` are the single wire-token→canonical-label translation point.
- **`resolver.py`** — `resolve_date_range` + `n_day_range` reproduce the frontend anchor arithmetic exactly (`anchor − (N−1) .. anchor`, inclusive; presets for 7/30/90/all, concrete `customRange` otherwise). Month-range year inference/rollback and cross-year ends; absolute-range earliest/latest fallbacks; `InvalidRange` for garbage. Never reads the wall clock (API-05, D-15, Pitfall 4).
- **`prompt.py`** — Static `SYSTEM_PROMPT` (never interpolated with user text — injection hygiene) encoding D-09/D-10/D-11/D-13/D-14/D-16 routing and symbolic-date-only rules; `build_messages` assembles the D-12 one-turn clarification memory.
- **`copy.py`** — Fixed `UNCLEAR_MESSAGE` (embeds 2 example commands), `UNAVAILABLE_MESSAGE`, medical-refusal templates + `CHART_PHRASES`, and the verbatim `DATA_QUESTION_MESSAGE` (VOICE-09, D-10/D-11/D-16).
- **`config.py`** — `anthropic_api_key: str = ""` (keyless boot, SEC-02, Pitfall 9) + `.env` loading via `SettingsConfigDict`.
- **`pyproject.toml`** — `anthropic==0.117.*` + `slowapi==0.1.*`; registered `live` pytest marker with `addopts = "-m 'not live'"`.

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Deps, settings, two schema families | c33e9b7 |
| 2 | Symbolic date resolver + parity tests | 038b1e6 |
| 3 | System prompt, message builder, fixed copy | bb6c1b6 |

## Verification

- `python -m pytest -q` (keyless, no `ANTHROPIC_API_KEY`): **169 passed, 7 skipped**
- `python -m pytest tests/test_agent_schemas.py`: 32 passed; `tests/test_agent_resolver.py`: 22 passed
- Resolver parity trio matches `dates.test.ts` exactly: 30d→(2025-05-15, 2025-06-13), 7d→(2025-06-07, 2025-06-13), 90d→(2025-03-16, 2025-06-13)
- `python -c "import anthropic, slowapi"` exits 0
- `grep -c "ge=\|le=\|discriminator" app/agent/schemas.py` → 0 (Claude-facing schema provably constraint-free)
- `pytest -m live --collect-only` → no live tests collected (marker registered; live suite lands in 03-03)
- `ruff check` on all new files: clean

## Deviations from Plan

None — plan executed as written. Two small mechanical adjustments were required to satisfy the plan's own acceptance greps: the `schemas.py` and `resolver.py` module docstrings were reworded so the literal strings `discriminator=`, `date.today`, and `datetime.now` do not appear in source (the acceptance/source-hygiene checks scan the whole file, not just code). No behavior change.

## Environment Note

The worktree had no `.venv`; the project's main-repo venv (`backend/.venv`, Python 3.12) was reused with `PYTHONPATH` pointed at the worktree so `app` resolves to the worktree sources. `anthropic` and `slowapi` were installed into that venv per Task 1. Tests were run keyless with `env -u ANTHROPIC_API_KEY`.

## Self-Check: PASSED

- All 7 created files present; both modified files updated.
- Commits c33e9b7, 038b1e6, bb6c1b6 exist in the branch history.
