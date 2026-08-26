---
phase: 11-full-site-guide-instructions-tab
plan: 01
subsystem: api
tags: [pydantic, fastapi, structured-outputs, voice-agent]

# Dependency graph
requires:
  - phase: 10-spoken-replies-tts
    provides: "ToggleSpeech closed-union precedent (structural template for ToggleGuide)"
provides:
  - "ToggleGuide Pydantic model — eighth AgentOutput.result union member (open/closed vocabulary)"
  - "AppliedFilters.guideOpen field — server-composed filter delta the frontend store applies"
  - "toggle_guide_message() fixed confirmation copy (Opening/Closing the guide)"
  - "interpret() isinstance(result, ToggleGuide) dispatch branch -> _apply_toggle_guide()"
  - "SYSTEM_PROMPT site-guide-overlay vocabulary paragraph (open/close only, no deep-link tokens)"
affects: [11-04-header-guide-button, 11-05-app-guide-mount]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-union voice command extension: new Literal-tagged BaseModel + union member + AppliedFilters field + _apply_* dispatch fn + SYSTEM_PROMPT paragraph, mirroring the ToggleSpeech/ToggleDataset precedent exactly (zero new validator/architecture code)"

key-files:
  created: []
  modified:
    - backend/app/agent/schemas.py
    - backend/app/agent/copy.py
    - backend/app/agent/prompt.py
    - backend/app/agent/service.py
    - backend/tests/test_agent_schemas.py
    - backend/tests/test_agent_service.py

key-decisions:
  - "ToggleGuide vocabulary is open/closed (not on/off) to match the overlay's own visibility semantics, per D-05"
  - "SYSTEM_PROMPT paragraph teaches open/close ONLY — no section-name/deep-link vocabulary — per D-06 scope boundary, reserving section-jump behavior for a future GUIDE-05 v2"

patterns-established:
  - "Eighth closed-union touch-point added with zero changes to _lower_tokens/_lower_value — the generic recursive normalizer already covers any new Literal-tagged variant"

requirements-completed: [GUIDE-03]

# Metrics
duration: 2min
completed: 2026-08-26
---

# Phase 11 Plan 01: Backend toggle_guide Voice/Text Command Summary

**Backend half of the `toggle_guide` voice/text command — an eighth closed-union `AgentOutput.result` member (`open`/`closed` vocabulary), `AppliedFilters.guideOpen`, server-composed confirmation copy, `interpret()` dispatch, and `SYSTEM_PROMPT` vocabulary, structurally mirroring the Phase 10 `ToggleSpeech` precedent.**

## Performance

- **Duration:** ~2 min (task execution; commits span 17:55:20–17:56:48 local)
- **Started:** 2026-08-26T00:55:00Z (approx.)
- **Completed:** 2026-08-26T00:57:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `ToggleGuide(BaseModel)` added as the eighth `AgentOutput.result` union member — `action: Literal["toggle_guide"]`, `state: Literal["open", "closed"]`, zero new validator code (existing `_lower_tokens`/`_lower_value` normalize it generically)
- `AppliedFilters.guideOpen: Literal["open", "closed"] | None` added — the store-facing filter delta the frontend applies
- `toggle_guide_message(state)` fixed confirmation copy in `copy.py` ("Opening the guide." / "Closing the guide.")
- `interpret()` gains an `isinstance(result, ToggleGuide)` branch dispatching to `_apply_toggle_guide()`, positioned immediately after the `ToggleSpeech` branch and before `DataQuestion`
- `SYSTEM_PROMPT` gains a new "Site guide overlay" paragraph teaching exactly the open/close vocabulary (open the guide / show me the guide / how do I use this / help -> open; close the guide / hide the guide / close help -> closed) — no section-name or deep-link vocabulary, per D-06
- Full test coverage: variant parse, case-drift normalization (`Toggle_Guide`/`CLOSED` -> `toggle_guide`/`closed`), `SYSTEM_PROMPT` token presence, and `interpret()`'s dispatch-to-`AppliedFilters` mapping (breaker stays untouched — `_last_outcome is True`)

## Task Commits

Each task was committed atomically:

1. **Task 1: schemas.py — ToggleGuide + AgentOutput union + AppliedFilters extension; copy.py — toggle_guide_message** - `d42bb7b` (feat)
2. **Task 2: service.py dispatch branch + prompt.py vocabulary paragraph** - `76c2fe5` (feat)
3. **Task 3: Extend test_agent_schemas.py + test_agent_service.py** - `27a5aab` (test)

_Plan metadata commit deferred — worktree mode; orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified
- `backend/app/agent/schemas.py` - `ToggleGuide` model, `AgentOutput.result` union extension, `AppliedFilters.guideOpen` field
- `backend/app/agent/copy.py` - `toggle_guide_message(state)` fixed confirmation copy
- `backend/app/agent/service.py` - schema/copy imports extended, `_apply_toggle_guide()`, `interpret()` dispatch branch
- `backend/app/agent/prompt.py` - "Site guide overlay" vocabulary paragraph in `SYSTEM_PROMPT`
- `backend/tests/test_agent_schemas.py` - `test_toggle_guide_variant_parses`, `test_toggle_guide_case_drift_normalizes`, `test_system_prompt_enumerates_toggle_guide_token`
- `backend/tests/test_agent_service.py` - `test_toggle_guide_maps_to_applied_filters_and_marks_reachable`

## Decisions Made
None beyond what the plan specified — D-05 (open/closed vocabulary, mirroring `ToggleSpeech` structurally) and D-06 (open/close-only prompt scope, no deep-link vocabulary) were plan-level decisions executed as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The worktree's `backend/.venv` was absent (worktrees don't carry their own virtualenv); verification and test commands were run via the main checkout's `backend/.venv/bin/python3` interpreter against the worktree's source tree — no code or file-location change, purely a tooling path adjustment for running checks inside a git worktree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ToggleGuide` round-trips through `AgentOutput`/`interpret()` end-to-end and is ready for the frontend half: Plan 11-04 (Header guide button, click path) and Plan 11-05 (App.tsx mounting the guide so it never unmounts the live voice session) both depend on `AppliedFilters.guideOpen` as their command-store contract.
- Full backend suite green: `cd backend && python -m pytest` → 261 passed, 7 skipped (pre-existing, unrelated), 35 deselected (pre-existing, unrelated).
- No blockers.

---
*Phase: 11-full-site-guide-instructions-tab*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: `.planning/phases/11-full-site-guide-instructions-tab/11-01-SUMMARY.md`
- FOUND: commit `d42bb7b` (Task 1)
- FOUND: commit `76c2fe5` (Task 2)
- FOUND: commit `27a5aab` (Task 3)
- FOUND: commit `d10b22b` (docs: SUMMARY.md)
