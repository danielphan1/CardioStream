---
phase: 10-spoken-replies-tts
plan: 04
subsystem: voice
tags: [react, zustand, web-speech-api, speech-synthesis, vitest, tts]

# Dependency graph
requires:
  - phase: 10-spoken-replies-tts (plan 02)
    provides: "useSpeech zustand store (enabled/isSpeaking/primed, speak()/primeSpeech()/cancelForBackground()), FakeUtterance/installFakeSpeechSynthesis test double"
provides:
  - "'speaking' VoiceState value in useVoiceCommand.ts, a peer of 'paused' (D-14 fatal state stays untouched)"
  - "armedRef-gated mic pause/resume effect keyed off useSpeech's isSpeaking (TTS-04)"
  - "onend guard (speakingRef) preventing the natural restart loop from racing a TTS-driven abort (Pitfall 4)"
  - "handleSuccess's applied case calling useSpeech.getState().speak(msg) with the exact echoed confirmation (TTS-01)"
  - "onVisibility's hidden branch proactively calling cancelForBackground() before the existing recognizer abort (Pitfall 6)"
affects: [10-05, 10-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "armedRef-gated store-subscription effect: an effect that reacts to a cross-cutting global store signal (isSpeaking) but is a no-op unless a local ref (armedRef) confirms the feature's precondition is genuinely active — prevents a shared trigger source (TTS) from silently activating a mechanism (the mic) for a user on a different input path (text-only)"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useVoiceCommand.ts
    - frontend/src/hooks/useVoiceCommand.test.ts

key-decisions:
  - "Mic pause/resume effect never assigns to armedRef — only stop() may set it false, preserving D-13's explicit-stop-only invariant exactly as researched"
  - "onend gained a speakingRef guard positioned between the existing !armedRef.current and lastErrorFatalRef.current checks, matching the exact guard order specified in the plan and research Pattern 2"

requirements-completed: [TTS-01, TTS-04, TTS-05]

# Metrics
duration: ~20min
completed: 2026-08-25
---

# Phase 10 Plan 04: Voice-Path TTS Wiring & Mic Pause/Resume Summary

**Wired `useVoiceCommand.ts`'s applied-reply handler to `useSpeech.getState().speak()` and added an `armedRef`-gated `isSpeaking` effect that pauses/resumes the recognizer around TTS playback, closing the hands-free confirmation loop for the voice input path.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-25T19:52:35Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments

- Added a new `"speaking"` `VoiceState` member (distinct from the existing D-14 `"paused"` fatal state) that renders while TTS is playing during a live voice session
- New `armedRef`-gated `useEffect` subscribed to `useSpeech((s) => s.isSpeaking)`: aborts the recognizer and enters `"speaking"` on the rising edge, restarts the recognizer and returns to `"listening"` on the falling edge — completely inert for a text-only caregiver who never armed the mic (Pitfall 3)
- `onend` gained a `speakingRef.current` early-return guard (positioned between the existing `!armedRef.current` and `lastErrorFatalRef.current` checks) so the TTS-driven `abort()`'s `onend` event never reaches `scheduleRestart()` and races the pause/resume effect's own resume (Pitfall 4)
- `handleSuccess`'s `"applied"` case now calls `useSpeech.getState().speak(msg)` with the exact same string passed to `setMessage(msg)`, immediately after it (TTS-01, voice path)
- `onVisibility`'s `hidden` branch now calls `useSpeech.getState().cancelForBackground()` as its first line, before the existing `clearRestartTimer()`/`abort()` calls — proactively cancels in-flight speech rather than trusting `onend`/`onerror` to ever fire on a backgrounded iOS Safari tab (Pitfall 6)
- 5 new test cases plus one extended assertion in `useVoiceCommand.test.ts` cover all of the above end to end against the real `useSpeech` store, `FakeRecognition`, and `FakeUtterance`/`installFakeSpeechSynthesis` test doubles

## Task Commits

Each task was committed atomically:

1. **Task 1: useVoiceCommand.ts — speaking VoiceState, mic pause/resume, backgrounding cancel** - `eac9629` (feat)
2. **Task 2: Extend useVoiceCommand.test.ts for TTS-01/TTS-04 wiring** - `e2202b2` (test)

_Note: worktree mode — the plan-completion metadata commit (SUMMARY.md) is committed separately below per the parallel-executor protocol; STATE.md/ROADMAP.md are updated centrally by the orchestrator after merge._

## Files Created/Modified

- `frontend/src/hooks/useVoiceCommand.ts` - Added `"speaking"` `VoiceState`, `speakingRef`, the `isSpeaking` subscription and armed-gated pause/resume effect, the `onend` `speakingRef` guard, `handleSuccess`'s `speak(msg)` call, and `onVisibility`'s `cancelForBackground()` call
- `frontend/src/hooks/useVoiceCommand.test.ts` - Extended the final-submit test with a TTS-01 spoken-text assertion; added a new "mic pause/resume during speech (TTS-04)" describe block with 5 cases covering the armed pause/resume cycle, the Pitfall 3 unarmed-recognizer regression, the Pitfall 4 onend-race suppression, and the Pitfall 6 backgrounding cancel

## Decisions Made

- Followed the plan's exact code shape verbatim (Pattern 2 from `10-RESEARCH.md`) rather than introducing any new abstraction — the effect reuses the file's existing `clearRestartTimer`/`setVoiceState`/try-catch-`InvalidStateError` conventions with no new helper functions
- Test 3 ("never touches an unarmed/absent recognizer") asserts `FakeRecognition.instances` has length 0 rather than merely checking an uncalled method, per the plan's explicit acceptance criterion — this proves the recognizer constructor itself was never invoked, not just that a stray method call was avoided

## Deviations from Plan

None — plan executed exactly as written. `node_modules` was not present in this git worktree (fresh worktree checkout does not carry installed dependencies); ran `npm ci` in `frontend/` before `tsc`/`vitest` could run. This is routine worktree setup, not a plan deviation — no source files were affected and `node_modules` is gitignored.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`useVoiceCommand.ts`'s voice path now speaks its confirmations and correctly pauses/resumes the mic around them, matching Plan 10-03's `CommandBar.onApplied` text-path wiring (both are the only two `speak()` call sites, per D-06). `frontend/src/components/CommandBar.tsx`'s `sessionOpen` ternary is expected to be extended to include `"speaking"` (per `10-RESEARCH.md` Pattern 2) — that file is outside this plan's `files_modified` scope (owned by sibling Plan 10-03 in the same wave); confirm at merge time that `sessionOpen` covers the new state so a mic tap during a TTS-driven pause correctly calls `stop()` rather than a redundant `start()`.

Full verification passed: `npx tsc --noEmit` clean; `npx vitest run src/hooks/useVoiceCommand.test.ts` — 21/21 passed; full frontend suite (`npx vitest run`) — 295/295 passed across 25 files, confirming no regressions in sibling voice/speech files.

---
*Phase: 10-spoken-replies-tts*
*Completed: 2026-08-25*
