---
phase: 09-multi-dataset-overlay-filtering
plan: 01
subsystem: api
tags: [pydantic, fastapi, structured-outputs, claude-haiku, agent-schema]

# Dependency graph
requires:
  - phase: 03-agent-via-text-input
    provides: The closed-union AgentOutput/interpret() pattern this plan extends with a sixth member
  - phase: 07-records-backend
    provides: labs/incidents/procedures resources this plan's ToggleDataset dataset tokens name
provides:
  - "ToggleDataset closed-union schema member (D-03/D-04: single dataset, explicit on/off)"
  - "interpret() dispatch branch mapping ToggleDataset to AppliedFilters(overlayDataset, overlayState)"
  - "SYSTEM_PROMPT vocabulary paragraph teaching the model the toggle_dataset command shape"
affects: [09-04-overlay-toggle-ui, 09-agent-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sixth closed-union member added via the same Literal-tag + generic _lower_tokens pattern as the existing five (no new validator code needed)"

key-files:
  created: []
  modified:
    - backend/app/agent/schemas.py
    - backend/app/agent/service.py
    - backend/app/agent/prompt.py
    - backend/tests/test_agent_schemas.py
    - backend/tests/test_agent_service.py

key-decisions:
  - "ToggleDataset is single-valued (one dataset token + explicit on/off state per command), never list-typed or a flip/toggle — matches D-03/D-04 from Phase 9 planning"
  - "message=\"\" on the applied reply follows _apply_command's existing convention: the frontend composes the confirmation, the server never authors it"
  - "reset/D-08 (\"show all data\") stays entirely frontend-only — ToggleDataset has no reset field, no backend handling added"

patterns-established:
  - "Extending the AgentOutput closed union is now a 3-file, 3-test mechanical pattern: add Literal token(s) + BaseModel to schemas.py, add union member + AppliedFilters fields, add _apply_* function + isinstance dispatch branch to service.py, add vocabulary paragraph to prompt.py before Routing rules:"

requirements-completed: [OVERLAY-03]

# Metrics
duration: ~10min
completed: 2026-08-21
---

# Phase 9 Plan 1: Backend `toggle_dataset` Agent Command Summary

**Sixth closed-union member `ToggleDataset` added to `AgentOutput`, with `interpret()` dispatch to `AppliedFilters(overlayDataset, overlayState)` and system-prompt vocabulary — the voice/text half of OVERLAY-03's overlay toggling.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-21
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- `DatasetToken = Literal["labs", "incidents", "procedures"]` and `ToggleDataset(BaseModel)` added to the Claude-facing closed union, following the same lowercase snake_case token discipline as the existing five variants — zero new validator code needed (the generic `_lower_tokens`/`_lower_value` recursion already covers it)
- `AppliedFilters` extended with `overlayDataset`/`overlayState` optional fields
- `interpret()` gained an `isinstance(result, ToggleDataset)` dispatch branch calling a new `_apply_toggle_dataset()`, positioned before the `DataQuestion` branch and after `DashboardCommand` — does not touch the circuit breaker
- `SYSTEM_PROMPT` gained an "Overlay data toggles" vocabulary paragraph (show/add/turn on → `state=on`; hide/remove/turn off → `state=off`; "incidents" also covers "hospital stays"/"hospitalizations"), inserted before the existing "Routing rules:" paragraph
- 4 new tests added (2 schema round-trip/case-drift + 1 prompt-vocabulary + 1 service dispatch); full backend suite green: 253 passed, 7 pre-existing skips, 35 deselected (unrelated live/slow tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: schemas.py — DatasetToken + ToggleDataset + AppliedFilters extension** - `3e3ec8b` (feat)
2. **Task 2: service.py dispatch branch + prompt.py vocabulary paragraph** - `3aeee11` (feat)
3. **Task 3: Extend test_agent_schemas.py + test_agent_service.py** - `0a044d3` (test)

## Files Created/Modified
- `backend/app/agent/schemas.py` - `DatasetToken` Literal, `ToggleDataset` model (sixth `AgentOutput.result` union member), `AppliedFilters.overlayDataset`/`.overlayState` fields
- `backend/app/agent/service.py` - `ToggleDataset` import, `_apply_toggle_dataset()` function, `interpret()` isinstance dispatch branch
- `backend/app/agent/prompt.py` - "Overlay data toggles" vocabulary paragraph in `SYSTEM_PROMPT`, positioned before "Routing rules:"
- `backend/tests/test_agent_schemas.py` - `test_toggle_dataset_variant_parses`, `test_toggle_dataset_case_drift_normalizes`, `test_system_prompt_enumerates_overlay_dataset_tokens`
- `backend/tests/test_agent_service.py` - `test_toggle_dataset_maps_to_applied_filters_and_marks_reachable`

## Decisions Made
- Followed the plan's D-03/D-04 design exactly: `ToggleDataset` is single-valued (one dataset + one explicit on/off state per voice command), never a list or an implicit flip — no scope for ambiguity in what the model can emit
- `message=""` on the `_apply_toggle_dataset()` reply mirrors `_apply_command`'s existing convention (frontend composes the confirmation from the post-merge store)
- No `reset`/D-08 handling added to `ToggleDataset` — "show all data" stays entirely frontend-only per the plan's explicit note

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The backend `.venv` used for verification lives in the main repo checkout (`/Users/dp/Documents/GitHub/Health-Visualizer/backend/.venv`), not inside this worktree — the worktree has no own `.venv`. This is a read-only interpreter reference (site-packages only); no files in the main repo were modified. All test/verification commands were run against the worktree's own source tree via `cd` into this worktree's `backend/` with that interpreter.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The backend `toggle_dataset` command is fully wired: schema, dispatch, and prompt vocabulary all round-trip and are test-covered
- Plan 09-04 (`OverlayToggle.tsx`) can now build the click half of OVERLAY-03 against the same `AppliedFilters.overlayDataset`/`overlayState` fields this plan added
- No blockers for downstream Phase 9 plans

---
*Phase: 09-multi-dataset-overlay-filtering*
*Completed: 2026-08-21*
