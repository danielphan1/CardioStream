---
phase: 10-spoken-replies-tts
plan: 01
subsystem: api
tags: [pydantic, fastapi, structured-outputs, anthropic, agent-schema]

# Dependency graph
requires:
  - phase: 09-overlay-datasets
    provides: "ToggleDataset closed-union pattern (schema + service dispatch + prompt vocabulary) this plan mirrors byte-for-byte"
provides:
  - "ToggleSpeech Pydantic model — Claude-facing structured-output union member for the toggle_speech command"
  - "AppliedFilters.speechEnabled field — server-composed reply surface for the mute/unmute state"
  - "_apply_toggle_speech() + interpret() dispatch branch mapping ToggleSpeech -> AppliedFilters"
  - "SYSTEM_PROMPT toggle_speech vocabulary paragraph teaching the model mute/unmute synonyms"
affects: [10-02, 10-03, 10-04, 10-05, 10-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-union command extension: new BaseModel + union member + AppliedFilters field + service dispatch + prompt vocabulary, zero changes to _lower_tokens/_lower_value (generic recursive normalizer already covers any new variant shape)"

key-files:
  created: []
  modified:
    - backend/app/agent/schemas.py
    - backend/app/agent/service.py
    - backend/app/agent/prompt.py
    - backend/tests/test_agent_schemas.py
    - backend/tests/test_agent_service.py

key-decisions:
  - "ToggleSpeech has no dataset discriminator (unlike ToggleDataset) — there is only one toggleable concept (speech on/off), matching D-01"
  - "message=\"\" on the applied reply — frontend composes the confirmation from the post-merge store, server never authors it, consistent with every other toggle/command reply"

patterns-established:
  - "Seventh closed-union member added via the same five touch-points as the six prior variants: BaseModel class, AgentOutput.result union, AppliedFilters field, service.py dispatch function + isinstance branch, SYSTEM_PROMPT vocabulary paragraph"

requirements-completed: [TTS-02]

# Metrics
duration: 5min
completed: 2026-08-23
---

# Phase 10 Plan 01: Backend ToggleSpeech Command Summary

**Seventh closed-union `AgentOutput` member (`ToggleSpeech`) lets Claude route mute/unmute utterances to `AppliedFilters.speechEnabled`, mirroring the Phase 9 `ToggleDataset` pattern exactly minus the dataset discriminator.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-23T03:45:00Z (approx, first commit 2026-08-22T20:45:50-07:00)
- **Completed:** 2026-08-23T03:47:19Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `ToggleSpeech(BaseModel)` added to `backend/app/agent/schemas.py` as the seventh `AgentOutput.result` union member — exactly two fields (`action: Literal["toggle_speech"]`, `state: Literal["on", "off"]`), no dataset discriminator
- `AppliedFilters.speechEnabled: Literal["on", "off"] | None = None` field added for the server-composed reply surface
- `_apply_toggle_speech()` + `interpret()` dispatch branch in `service.py` map a parsed `ToggleSpeech` result to `AppliedFilters(speechEnabled=...)`, immediately after the existing `ToggleDataset` branch, without touching the circuit breaker
- `SYSTEM_PROMPT` gained a "Spoken-reply toggle" vocabulary paragraph (verbatim from 10-RESEARCH.md) teaching the model mute/unmute synonyms as a distinct action from `toggle_dataset`
- Full backend test suite green: 257 passed, 7 skipped (pre-existing, unrelated), 35 deselected

## Task Commits

Each task was committed atomically:

1. **Task 1: schemas.py — ToggleSpeech + AgentOutput union + AppliedFilters extension** - `12caa8c` (feat)
2. **Task 2: service.py dispatch branch + prompt.py vocabulary paragraph** - `b7af9a9` (feat)
3. **Task 3: Extend test_agent_schemas.py + test_agent_service.py** - `3692216` (test)

## Files Created/Modified
- `backend/app/agent/schemas.py` - `ToggleSpeech` model, `AgentOutput.result` union +1 member, `AppliedFilters.speechEnabled` field
- `backend/app/agent/service.py` - `ToggleSpeech` import, `_apply_toggle_speech()`, `interpret()` isinstance dispatch branch
- `backend/app/agent/prompt.py` - "Spoken-reply toggle" vocabulary paragraph in `SYSTEM_PROMPT`
- `backend/tests/test_agent_schemas.py` - `test_toggle_speech_variant_parses`, `test_toggle_speech_case_drift_normalizes`, `test_system_prompt_enumerates_toggle_speech_token`
- `backend/tests/test_agent_service.py` - `test_toggle_speech_maps_to_applied_filters_and_marks_reachable`

## Decisions Made
- None beyond what was already locked in the plan (D-01) — `ToggleSpeech` intentionally omits a dataset discriminator since speech is a single toggleable concept, unlike the three-dataset `ToggleDataset`.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and verification commands from the plan passed on first attempt; no auto-fixes were needed.

## Issues Encountered

None. One environment note: the worktree had no local Python virtualenv with `pydantic`/`pytest` installed, so verification commands ran against the main repo's existing `backend/.venv` (read-only interpreter invocation only — no writes to that directory). This is an execution-environment detail, not a code change, and does not affect the committed diff.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend half of TTS-02 (voice/text-reachable mute toggle) is complete: `ToggleSpeech` round-trips through structured outputs, `interpret()` dispatches it correctly, and the system prompt teaches the vocabulary.
- Plan 10-05 owns the click half (`Header.tsx` button) and the frontend `store/speech.ts` — this plan's `AppliedFilters.speechEnabled` field is the wire contract those plans will consume.
- No blockers for downstream plans in this wave.

---
*Phase: 10-spoken-replies-tts*
*Completed: 2026-08-23*
