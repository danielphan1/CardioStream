---
phase: 04-voice-capture
plan: 02
subsystem: voice
tags: [web-speech-api, speechrecognition, react-hook, restart-loop, seq-guard, zustand, vitest]

# Dependency graph
requires:
  - phase: 04-voice-capture
    provides: "lib/voice.ts pure helpers (extractCommand/classifyError/computeBackoff/capability) + FakeRecognition test double + ambient SpeechRecognition types"
  - phase: 03-agent-text
    provides: "useAgent().mutate, applyAgentFilters single mutation surface, composeConfirmation, AgentReply closed union"
  - phase: 02-dashboard
    provides: "zustand useFilters store (the render target)"
provides:
  - "useVoiceCommand hook: singleton recognizer lifecycle, wake-word-gated capture, stripped interim transcript, monotonic newest-wins seq guard, invisible onend/onerror restart loop with backoff, fatal→paused fallback, visibility guards — exposing a stable VoiceState contract"
  - "VoiceState union (off | listening | triggered | working | paused) for the Wave 3 CommandBar"
affects: [04-03-voice-ui, voice-capture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Construct-once recognizer held in useRef; event handlers bound at construction read live values via refs so they never close over stale state"
    - "Newest-wins seq guard: capturedSeq !== seqRef.current returns BEFORE any store touch, dropping superseded late replies (D-05)"
    - "Explicit onend/onerror restart loop over the raw recognizer (CLAUDE.md escape hatch) instead of the library abstraction — classifyError gates recoverable-vs-fatal, computeBackoff spaces restarts"
    - "Fixed friendly copy only for every client-visible failure (RATE_LIMIT/OFFLINE/PAUSED); raw recognizer/API error strings never render (VOICE-07); transcript never logged (SEC-03)"

key-files:
  created:
    - frontend/src/hooks/useVoiceCommand.ts
    - frontend/src/hooks/useVoiceCommand.test.ts
  modified: []

key-decisions:
  - "One long-lived recognizer started inside the caregiver tap (D-01 gesture), kept armed across silence auto-stops via the onend restart loop (D-02/D-12) — never recreated per listen (avoids the iOS re-permission chime / user-gesture loss)"
  - "Store mutation routes ONLY through applyAgentFilters; the command reuses useAgent().mutate — zero new fetch, zero direct setState (VOICE-08, single-surface rule)"
  - "Fatal recognizer errors enter paused with armed=false so onend cannot relaunch; supported stays true (session closed until a fresh start()) (D-14)"
  - "consecutiveRestarts resets to 0 on any real final result so backoff returns to base after productive speech"
  - "Visibility guard: visibilitychange/focus hold the loop while document.hidden and resume honestly on foreground — no background listening (T-04-05)"

requirements-completed: [VOICE-01, VOICE-02]

# Metrics
duration: 8min
completed: 2026-07-21
---

# Phase 4 Plan 02: useVoiceCommand Hook Summary

**A single long-lived webkitSpeechRecognition instance behind one testable hook: wake-word-gated command capture with a stripped live transcript, a monotonic newest-wins seq guard that drops superseded late replies, and an invisible onend/onerror restart loop (classifyError + computeBackoff) that survives silence auto-stops, refuses to loop on fatal errors (paused per D-14), pauses when backgrounded, and tears down cleanly — all proven against FakeRecognition in CI.**

## Performance

- **Duration:** ~8 min (resumed session)
- **Completed:** 2026-07-21
- **Tasks:** 2
- **Files modified:** 2 (2 created)

## Accomplishments
- `useVoiceCommand.ts` contains ALL recognizer volatility so the Wave 3 UI only renders a `VoiceState`: one recognizer constructed once in `start()` (D-01 gesture), wake-word gating + stripped interim via `extractCommand` (D-02/D-10), final command submitted through the shared `useAgent().mutate` (VOICE-08), and a monotonic `seqRef` newest-wins guard (D-05).
- Restart resilience: an explicit `onend`/`onerror` loop invisibly relaunches with `computeBackoff` while armed and recoverable (D-12); fatal errors enter `paused` without relaunching (D-14); explicit `stop()` leaves the session off (D-13); `InvalidStateError` from `rec.start()` is swallowed (Pitfall 5); `visibilitychange`/`focus` guards hold the loop while backgrounded and resume on return (Pitfall 2).
- 12 FakeRecognition-driven tests cover session/singleton, wake-word gate, interim strip, final submit, newest-wins, unsupported fallback, recoverable restart, fatal→paused, onend-while-stopped, backoff growth+reset, and the visibility hold/resume — full frontend suite 132 green, `tsc -b` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hook core — singleton recognizer, wake-word gating, submit path, newest-wins seq guard** - `fb77bd7` (feat)
2. **Task 2: Restart resilience — onend/onerror loop, classifyError + backoff, fatal→paused, visibility guards** - `65c48f2` (feat)

## Files Created/Modified
- `frontend/src/hooks/useVoiceCommand.ts` - the hook: `VoiceState` contract, singleton recognizer + refs, `handleResult` (gate/strip/submit), `handleSuccess`/`handleError` (seq-guarded store mutation + fixed copy), `enterPaused`/`scheduleRestart`, `onerror`/`onend` restart loop, `start`/`stop`, and the visibility-listener + teardown effect.
- `frontend/src/hooks/useVoiceCommand.test.ts` - 12 cases against `installFakeRecognition()` + `emitResult`/`emitError`, mocking only `postAgent` (real `useAgent`, real `QueryClientProvider`, real stores reset per test); fake timers drive the backoff assertions; never-resolving-promise trick holds a command in-flight for newest-wins.

## Decisions Made
- One recognizer, started once inside the tap and kept armed across auto-stops (never recreated) — the D-01/D-12 core.
- Single mutation surface: reuse `useAgent().mutate` + `applyAgentFilters`; zero new fetch, zero direct `setState`.
- Fatal → `paused` with `armed=false` (onend can't relaunch); `supported` stays true until a fresh `start()`.
- `consecutiveRestarts` resets on any real final result; visibility guard prevents background listening.

## Deviations from Plan

### Process deviation (resumed session)

**1. [Resume] Task 1 committed as a single `feat` commit rather than the TDD RED→GREEN split**
- **Found during:** Resume of an interrupted execution — Task 1's hook and tests were already fully written and green on disk (untracked) when this executor started.
- **Issue:** The strict `tdd="true"` RED-then-GREEN commit sequence cannot be reconstructed for already-authored files.
- **Resolution:** Verified Task 1 green (`npx vitest run src/hooks/useVoiceCommand.test.ts` = 7 passed) and `tsc -b` clean, then committed the existing work as one atomic `feat(04-02)` commit (`fb77bd7`). Task 2 was implemented fresh in this session and committed separately (`65c48f2`). No behavior change; the gate order is documented here per the resume instruction.
- **Files modified:** frontend/src/hooks/useVoiceCommand.ts, frontend/src/hooks/useVoiceCommand.test.ts

---

**Total deviations:** 1 process (resume-driven commit shape).
**Impact on plan:** None on delivered behavior — every acceptance criterion for both tasks passes.

## TDD Gate Compliance

Task 1 was resumed with files already written, so no `test(...)` RED commit precedes its `feat(...)` GREEN commit; both tasks landed as `feat(04-02)` commits. Task 2's tests and implementation were authored together and verified green (12/12 in-file, 132/132 suite). This is an accepted consequence of resuming an interrupted `tdd="true"` plan (see Deviations).

## Issues Encountered
None beyond the resume context. Full suite green on first run of the combined Task 1 + Task 2 code.

## Threat Surface Notes
- T-04-01/02 (tampering): the hook sends only `extractCommand` output as a plain string to the SAME `useAgent().mutate` the text box uses — it never constructs `AppliedFilters` from raw speech; the server structured-outputs validation stays the authority.
- T-04-03 (DoS/cost): `computeBackoff` caps restart frequency; the seq guard drops superseded applies.
- T-04-04 (info disclosure): only fixed friendly copy (RATE_LIMIT/OFFLINE/PAUSED) renders; no transcript logging.
- T-04-05 (always-hot mic): explicit-stop-only session with `abort()` on `stop()`/unmount, and the visibility guard pauses when hidden — no background listening.

No new security surface beyond the plan's `<threat_model>`.

## Known Stubs
None — the hook is fully wired to the real mutation and store. The `message`/`state`/`interim` contract is consumed by the Wave 3 CommandBar (04-03).

## Next Phase Readiness
- Wave 3 (04-03) can build the CommandBar mic UI purely against the `VoiceState` contract (`off`/`listening`/`triggered`/`working`/`paused`), calling `start()` from the tap handler (satisfies the D-01 user gesture) and `stop()` to end the session; render `interim` (green live transcript) and `message` (fixed friendly copy).
- The recognizer restart loop, seq guard, and visibility guards are fully unit-covered in CI via FakeRecognition ahead of the real-iOS checkpoint (STATE.md Phase 4 blocker) — that on-device test remains the phase's #1 device risk.

## Self-Check: PASSED

---
*Phase: 04-voice-capture*
*Completed: 2026-07-21*
