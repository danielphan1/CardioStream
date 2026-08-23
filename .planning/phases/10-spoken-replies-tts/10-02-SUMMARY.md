---
phase: 10-spoken-replies-tts
plan: 02
subsystem: ui
tags: [zustand, web-speech-api, speechsynthesis, tts, localstorage, vitest]

# Dependency graph
requires:
  - phase: 10-spoken-replies-tts (Plan 10-01)
    provides: backend AppliedFilters.speechEnabled field (byte-identical mirror target) and ToggleSpeech agent schema
provides:
  - "useSpeech zustand store: enabled/isSpeaking/primed state + initSpeech/setEnabled/toggleEnabled/primeSpeech/speak/cancelForBackground actions"
  - "fakeSpeechSynthesis.ts jsdom test double for window.speechSynthesis/SpeechSynthesisUtterance"
  - "AppliedFilters.speechEnabled wire-contract field in frontend/src/api/types.ts"
  - "main.tsx bootstrap: useSpeech.getState().initSpeech() before first paint"
affects: [10-03-command-bar-speaking-state, 10-04-use-voice-command-mic-pause, 10-05-header-toggle-agent-integration, 10-06-real-device-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-concern zustand store (persisted toggle + ephemeral playback controller) mirroring store/agentStatus.ts's 'written from two entry points, read identically everywhere' shape"
    - "Monotonic module-level seq counter guarding onstart/onend/onerror against stale events from a superseded/cancelled async operation (mirrors useVoiceCommand.ts's seqRef pattern, now also used for SpeechSynthesisUtterance lifecycle)"
    - "primed as zustand store state (not a bare module-level let) specifically to keep per-test-file reset isolation, deviating from RESEARCH.md's illustrative skeleton"

key-files:
  created:
    - frontend/src/store/speech.ts
    - frontend/src/store/speech.test.ts
    - frontend/src/tests/fakeSpeechSynthesis.ts
  modified:
    - frontend/src/api/types.ts
    - frontend/src/main.tsx

key-decisions:
  - "primed tracked as zustand store state, not a module-level let (per plan's explicit deviation from RESEARCH.md's skeleton) — prevents cross-test-file flakiness since Vitest keeps one module instance per file"
  - "isSpeechSynthesisSupported() is a small independent local helper, deliberately NOT sharing logic with lib/voice.ts's isSpeechSupported() (which checks the recognizer) — Firefox has speechSynthesis without SpeechRecognition"
  - "Kept a strong module-level reference to the in-flight SpeechSynthesisUtterance for its lifetime (Pitfall 5 GC risk), cleared only once onend/onerror fires"

patterns-established:
  - "Speech playback controller pattern: cancel-before-speak + monotonic seq guard, reusable for any future single-utterance-at-a-time browser API wrapper"

requirements-completed: [TTS-02, TTS-03]

# Metrics
duration: ~12min
completed: 2026-08-22
---

# Phase 10 Plan 02: Speech Store & Wire Contract Summary

**`useSpeech` zustand store (persisted mute toggle + cancel-before-speak SpeechSynthesis controller with a monotonic seq guard against Safari's unreliable onend/onerror) plus the `AppliedFilters.speechEnabled` wire-contract field and `main.tsx` bootstrap call that Plans 10-03/10-04/10-05 will build against.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `store/speech.ts` implements the full TTS-02/TTS-03 contract: on-by-default persisted mute toggle (`localStorage["hv-speech"]`, guarded try/catch matching `store/theme.ts`'s exact pattern), and an ephemeral `isSpeaking`/`primed` playback controller with `speak()`, `primeSpeech()`, and `cancelForBackground()`.
- `speak()` unconditionally calls `speechSynthesis.cancel()` before every new utterance (TTS-03), and a monotonic `seq` counter guards `onstart`/`onend`/`onerror` so a stale event from a cancelled/superseded utterance can never resurrect `isSpeaking` (Pitfall 2 — Safari's unreliable cancel/end semantics).
- `fakeSpeechSynthesis.ts` provides a full jsdom test double (`FakeUtterance` + `fakeSpeechSynthesis` + `installFakeSpeechSynthesis()`), mirroring `tests/fakeRecognition.ts`'s instance-registry + `emit*()` driver conventions exactly.
- `speech.test.ts` — 21 tests covering every behavior in the plan's `<behavior>` block, including an explicit seq-guard regression test (stale `onend` from a superseded first utterance must not flip `isSpeaking` back to `false` after a second utterance has already started).
- `AppliedFilters.speechEnabled` added to `frontend/src/api/types.ts`, byte-identical shape (`"on" | "off" | null`) to every sibling optional-nullable-literal field, matching backend Plan 10-01's field.
- `main.tsx` now calls `useSpeech.getState().initSpeech()` immediately after `useTheme.getState().initTheme()` and before `createRoot(...).render(...)`, so the persisted mute preference (or the safe on-by-default) applies before first paint.

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED → GREEN protocol per `tdd="true"`):

1. **Task 1 (RED): failing test + test double** - `240e544` (test)
2. **Task 1 (GREEN): store/speech.ts implementation** - `c7f2c10` (feat)
3. **Task 2: Wire contract — api/types.ts + main.tsx bootstrap** - `c0b35b0` (feat)

## TDD Gate Compliance

- RED gate: `240e544 test(10-02): add failing test for speech store` — confirmed failing via a temporary `mv store/speech.ts store/speech.ts.bak` + `npx vitest run`, which produced an unresolved-import error (import target did not exist).
- GREEN gate: `c7f2c10 feat(10-02): implement speech store` — implementation restored, all 21 `speech.test.ts` assertions pass.
- REFACTOR gate: not needed — implementation was clean on first pass, no follow-up cleanup commit required.

Gate sequence verified via `git log --oneline`: `test(...)` precedes `feat(...)`, both present.

## Files Created/Modified
- `frontend/src/tests/fakeSpeechSynthesis.ts` - `FakeUtterance` class (static instance registry, `emitStart`/`emitEnd`/`emitError` drivers) + `fakeSpeechSynthesis` (`vi.fn()`-based `speak`/`cancel`/`getVoices`) + `installFakeSpeechSynthesis()` — jsdom test double for the Web Speech Synthesis API
- `frontend/src/store/speech.ts` - `useSpeech` zustand store: `enabled`/`isSpeaking`/`primed` state, `initSpeech`/`setEnabled`/`toggleEnabled`/`primeSpeech`/`speak`/`cancelForBackground` actions
- `frontend/src/store/speech.test.ts` - 21 unit tests covering persistence, cancel-before-speak, the seq-guard regression, primeSpeech once-only behavior, and cancelForBackground's synchronous silence + late-event suppression
- `frontend/src/api/types.ts` - added `speechEnabled?: "on" | "off" | null;` to `AppliedFilters`
- `frontend/src/main.tsx` - added `useSpeech` import and `initSpeech()` bootstrap call before first paint

## Decisions Made
- Followed the plan's explicit instruction to track `primed` as zustand store state rather than a module-level `let` (deviating from RESEARCH.md's illustrative skeleton) — avoids order-dependent test flakiness since Vitest keeps one module instance per test file.
- Kept `seq` as a module-level `let` (per plan) since no test needs to reset an absolute value, only relative newest-wins ordering.
- Spoken text parameter is never logged anywhere in `speech.ts`, extending the existing SEC-03/T-04-04 transcript-never-logged precedent to TTS.

## Deviations from Plan

None — plan executed exactly as written. One self-caught fix during acceptance-criteria verification (not a deviation from plan intent, just a wording adjustment to satisfy a literal grep check):

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comment accidentally matched the "no console.log" grep acceptance check**
- **Found during:** Task 1 acceptance-criteria verification (`grep -c "console.log" frontend/src/store/speech.ts` returned 1, not 0)
- **Issue:** A doc comment read `// NOTE: never console.log \`text\` ...` — the literal substring `console.log` appeared in a comment explaining the constraint, tripping the acceptance check even though no actual `console.log` call exists in the file.
- **Fix:** Reworded the comment to `// NOTE: never log the \`text\` parameter ...` (same intent, no longer matches the literal string).
- **Files modified:** `frontend/src/store/speech.ts`
- **Verification:** `grep -c "console.log" frontend/src/store/speech.ts` now returns `0`; full test suite re-run, still 21/21 passing.
- **Committed in:** `c7f2c10` (part of Task 1 GREEN commit — caught before commit, not a follow-up fix)

---

**Total deviations:** 1 auto-fixed (1 bug/self-caught wording fix)
**Impact on plan:** Cosmetic comment wording only — no behavior change. No scope creep.

## Issues Encountered
- Worktree had no `node_modules` installed for the frontend (fresh worktree checkout, `package-lock.json` present but dependencies not yet materialized). Ran `npm ci` in `frontend/` before the first test run — a standard, expected worktree-setup step, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `useSpeech` is ready for Plans 10-03 (CommandBar `speak()` calls + "Speaking…" state), 10-04 (`useVoiceCommand` mic-pause/resume around `isSpeaking`), and 10-05 (Header mute toggle button + agent-driven `setEnabled` wiring) to import directly — action names, persistence default, and defensive guards (seq guard, primed-as-state, utterance GC reference) are locked and unit-tested.
- `fakeSpeechSynthesis.ts` is ready for reuse by `useVoiceCommand.test.ts` (Plan 10-04) for testing the mic-pause/resume interaction with `isSpeaking` transitions.
- `AppliedFilters.speechEnabled` is now wire-compatible with the backend's Plan 10-01 field; Plan 10-05's agent-driven mute toggle can consume it directly.
- No blockers. Full frontend suite (25 files, 290 tests) passes after these changes; `tsc --noEmit` is clean.

---
*Phase: 10-spoken-replies-tts*
*Completed: 2026-08-22*

## Self-Check: PASSED

All created/modified files verified present on disk (`frontend/src/store/speech.ts`, `frontend/src/store/speech.test.ts`, `frontend/src/tests/fakeSpeechSynthesis.ts`, `frontend/src/api/types.ts`, `frontend/src/main.tsx`, this SUMMARY.md). All commit hashes (`240e544`, `c7f2c10`, `c0b35b0`, `ed85b31`) verified present in `git log --oneline --all`.
