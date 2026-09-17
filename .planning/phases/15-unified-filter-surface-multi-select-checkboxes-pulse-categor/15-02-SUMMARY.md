---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 02
subsystem: api
tags: [pydantic, fastapi, claude-agent, structured-outputs, dashboard-filters]

# Dependency graph
requires: []
provides:
  - "DashboardCommand/AppliedFilters wire schema: list-typed bp_category/pulse_category/time_of_day with sibling *_all clear flags"
  - "PULSE_TOKEN_TO_LABEL map + PulseCategoryToken/TimeOfDayToken closed vocabularies"
  - "_apply_command three-way branch pattern (all-flag wins > list > carry-over) for list-typed filter groups"
  - "SYSTEM_PROMPT vocabulary for four-bucket time-of-day, pulse category, and the *_all clear-signal mechanism"
  - "am_pm fully retired from the agent surface (schema, service, prompt, tests, eval fixtures)"
affects: [15-03, 15-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling *_all: bool = False clear-flag per list-typed filter group, precedence over any co-present list value"
    - "dict.fromkeys(...) de-dup + token-to-label list comprehension for wire-token -> canonical-label mapping"

key-files:
  created: []
  modified:
    - backend/app/agent/schemas.py
    - backend/app/agent/service.py
    - backend/app/agent/prompt.py
    - backend/tests/test_agent_schemas.py
    - backend/tests/test_agent_service.py
    - backend/tests/test_agent_route.py
    - backend/tests/test_agent_fixtures.py
    - backend/tests/fixtures/agent_utterances.json

key-decisions:
  - "PD-01 (from plan frontmatter, applied verbatim): the clear-to-all mechanism is a sibling *_all: bool = False flag per group, not an overloaded 'all' list element. When both a list and the matching *_all flag are present, *_all wins and maps to the empty-list clear state."
  - "Time-of-day tokens get no TOKEN_TO_LABEL dict (str.capitalize() is sufficient for the four single-word labels) — deliberately inconsistent with BP/PULSE, documented inline so it doesn't read as an oversight."
  - "Pulled forward one test edit from Task 3 into Task 2 (Rule 3 auto-fix): Task 2's own <verify> command runs the full test_agent_service.py file, which still referenced the retired am_pm field until Task 3's scheduled fix — fixed test_command_carries_datasets_and_filters_together immediately so Task 2's verify actually passed green, rather than leaving a known-red test in the tree between commits."

requirements-completed: [PH15-06]

# Metrics
duration: ~25min
completed: 2026-09-17
---

# Phase 15 Plan 02: Agent Wire Schema Multi-Category Conversion Summary

**Converted the Claude-facing `DashboardCommand`/`AppliedFilters` wire schema from single-valued `bp_category`/`am_pm` to list-typed `bp_category`/`pulse_category`/`time_of_day` with sibling `*_all` clear flags, retiring `am_pm` entirely from the agent surface.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-17T15:41:09Z
- **Tasks:** 3/3 completed
- **Files modified:** 8

## Accomplishments

- `DashboardCommand`/`AppliedFilters` now express "Stage 1 and Stage 2" as one multi-value filter command instead of forcing single-category selection
- New `pulse_category` (bradycardia/normal/tachycardia) and four-bucket `time_of_day` (morning/afternoon/evening/night) filters, replacing the coarser two-bucket `am_pm`
- Explicit `*_all: true` clear-to-all signal per filter group, distinct from "field unmentioned → carry over" (D-13's existing carry-over semantics untouched)
- `am_pm` and `AMPM_TOKEN_TO_LABEL` fully removed from `backend/app/agent/`; zero remaining references in the agent module or its tests (confirmed by grep)
- System prompt rewritten to teach the new vocabulary plus the `*_all` clear-signal mechanism and the "name two values in one breath → list them" routing rule
- Offline 43-fixture eval JSON converted to the new list-typed/`timeOfDay` shape so a future live run (once AGENT-01 billing is funded) exercises the real schema

## Task Commits

1. **Task 1: Convert DashboardCommand/AppliedFilters to list-typed categories + _all flags** - `f10fbf0` (feat)
2. **Task 2: Wire _apply_command to the new schema + rewrite prompt.py vocabulary** - `0b4c1b5` (feat)
3. **Task 3: Propagate through service/route/eval-fixture tests** - `293b571` (test)

_No refactor commit needed — no post-green cleanup required for any task._

## Files Created/Modified

- `backend/app/agent/schemas.py` - `BPCategoryToken` drops `"all"`; new `PulseCategoryToken`/`TimeOfDayToken`; `DashboardCommand`/`AppliedFilters` gain list-typed `bp_category`/`pulse_category`/`time_of_day` + `*_all` flags; `am_pm`/`amPm`/`AMPM_TOKEN_TO_LABEL` deleted; new `PULSE_TOKEN_TO_LABEL`
- `backend/app/agent/service.py` - `_apply_command`'s three-way branch per filter group (`*_all` wins > list mapped+de-duped > carry-over); `AMPM_TOKEN_TO_LABEL` import removed, `PULSE_TOKEN_TO_LABEL` added
- `backend/app/agent/prompt.py` - four-bucket time-of-day section, new pulse-category section, updated worked command example, new "name two values in one breath" routing rule
- `backend/tests/test_agent_schemas.py` - deleted 2 am_pm-only tests, updated 3 tests for list shapes, added 2 new tests (list-parse-and-lowercase, `*_all` independence/defaults)
- `backend/tests/test_agent_service.py` - updated the canonical combo-utterance test to use `bp_category`, added 3 new applied-filter mapping tests
- `backend/tests/test_agent_route.py` - `test_applied_reply_echoes_filters` uses `bpCategory` list instead of `amPm`
- `backend/tests/test_agent_fixtures.py` - `amPm` expect-block swapped for `timeOfDay`, new `pulseCategory` expect-block added
- `backend/tests/fixtures/agent_utterances.json` - 9 stale `amPm`/scalar-`bpCategory` sites converted to `timeOfDay`/list-`bpCategory`; still 43 entries, valid JSON

## Decisions Made

- PD-01 applied verbatim per the plan's own planner decision: sibling `*_all: bool = False` flags, `*_all` takes precedence over a co-present list value, documented in `_apply_command`'s code comment.
- Time-of-day intentionally has no `TIME_OF_DAY_TOKEN_TO_LABEL` dict — `str.capitalize()` covers all four single-word labels; a comment in `schemas.py` flags this as deliberate, not an inconsistency oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pulled forward one Task 3 test edit into Task 2**
- **Found during:** Task 2 verification (`pytest tests/test_agent_schemas.py tests/test_agent_service.py`)
- **Issue:** Task 2's own `<verify>` command runs the full `test_agent_service.py` file, but `test_command_carries_datasets_and_filters_together` still stubbed `"am_pm": "am"` and asserted `reply.filters.amPm == "AM"` — both retired by Task 1/2's schema changes. This is explicitly assigned to Task 3's `<action>` in the plan, but its presence blocked Task 2's own verify from passing.
- **Fix:** Applied exactly the edit the plan already specified for Task 3 (stub `"bp_category": ["stage_1", "stage_2"]`, assert `reply.filters.bpCategory == ["Stage 1", "Stage 2"]`) as part of Task 2's commit, so Task 2 ends in a fully green state. Task 3 did not redo this edit — it added the three genuinely-new tests and the route/fixtures work.
- **Files modified:** backend/tests/test_agent_service.py
- **Verification:** `pytest tests/test_agent_schemas.py tests/test_agent_service.py -x -v` → 72 passed
- **Committed in:** `0b4c1b5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking / plan-sequencing)
**Impact on plan:** Zero scope creep — the exact edit was already prescribed by the plan for Task 3; only its timing moved earlier by one task to keep every commit green. Task 3's commit contains no overlapping change.

## Issues Encountered

- The worktree had no `.venv` (per STATE.md's 260913-fdm note on worktree-isolated backend work) and the main repo's editable install would otherwise shadow it via a meta-path finder. Created a fresh `backend/.venv` in the worktree, installed `-e ".[dev]"`, and confirmed `app.deps.__file__` resolved inside the worktree before trusting any test result.

## Grep Verification

- `grep -rn "AMPM_TOKEN_TO_LABEL\|amPm\|\bam_pm\b" backend/app/agent/ backend/tests/test_agent_*.py` → one hit: `test_agent_route.py:48`'s `_reading()` helper constructs a `Reading` DB row and sets its unrelated ETL-derived `am_pm` column (used by `/readings?am_pm=` and out of this plan's scope entirely — the `Reading` model's `am_pm` field is untouched by this plan and remains a legitimate, separate concept). Zero hits against the actual retired agent token vocabulary.
- `pytest` (full backend suite): 312 passed, 7 skipped (golden master), 43 deselected (`@pytest.mark.live`, no `ANTHROPIC_API_KEY` — expected per AGENT-01).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The wire contract this plan built (`DashboardCommand`/`AppliedFilters` list-typed `bp_category`/`pulse_category`/`time_of_day` + `*_all` flags) is what plans 15-03 (frontend `AppliedFilters` TS type) and 15-04 (store shape) must mirror exactly — field names, list semantics, and the `*_all` clear-to-empty-list convention are all locked here.
- No blockers. The live 43-fixture eval remains blocked on AGENT-01 (no Anthropic API credits) — unchanged by this plan, and the fixture JSON is now shaped correctly for whenever that eval runs.

---
*Phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor*
*Completed: 2026-09-17*
