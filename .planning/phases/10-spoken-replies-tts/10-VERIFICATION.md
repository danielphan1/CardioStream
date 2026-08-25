---
phase: 10-spoken-replies-tts
verified: 2026-08-25T20:29:42Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 10: Spoken Replies (TTS) Verification Report

**Phase Goal:** The dashboard speaks its confirmation aloud, closing the hands-free loop so Chris doesn't need to look at the screen to know a command worked.
**Verified:** 2026-08-25T20:29:42Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped 1:1 to ROADMAP.md Phase 10 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After a voice/agent command, the dashboard speaks the same confirmation text shown on screen; manual click/keyboard filter changes never trigger speech | ✓ VERIFIED | `CommandBar.tsx:113-121` builds `msg` via `composeConfirmation()`, calls `setMessage(msg)` AND `useSpeech.getState().speak(msg)` — the identical string, only inside `onApplied`. `useVoiceCommand.ts:144-150` does the same for the voice path. `grep -rn "\.speak(" src/` (excluding tests/store) returns exactly these 2 call sites — no other file (including `FilterBar.tsx`) imports `useSpeech`, confirmed via `grep -rln "useSpeech" src/` → only `main.tsx`, `Header.tsx`, `CommandBar.tsx`, `useVoiceCommand.ts`, `lib/agent.ts`, `store/speech.ts`. |
| 2 | Spoken replies are on by default; Chris or a caregiver can reach a mute/quiet toggle by voice or click, and the setting persists across sessions | ✓ VERIFIED | `store/speech.ts:82` defaults `enabled: true`. `Header.tsx:188-200` renders a "Voice Replies: On/Off" button (icon+text, `aria-pressed`, `min-h-12`, byte-identical className to the Theme toggle) wired to `toggleEnabled`. Backend `ToggleSpeech` (schemas.py:143-149) + `_apply_toggle_speech`/`interpret()` dispatch (service.py:218-258) + `SYSTEM_PROMPT` "Spoken-reply toggle" paragraph (prompt.py:49-53) route voice commands to `AppliedFilters.speechEnabled`; `lib/agent.ts:84-85` fans that out to `useSpeech.getState().setEnabled(...)`. Persistence: `storeEnabled()`/`readStoredEnabled()` guarded try/catch against `localStorage["hv-speech"]`, applied via `initSpeech()` in `main.tsx:18` before first paint. Real-device persistence-across-reload confirmed in 10-06 human sign-off. |
| 3 | Only one utterance ever plays at a time — a new confirmation cancels and replaces any reply still speaking | ✓ VERIFIED | `speech.ts:speak()` unconditionally calls `window.speechSynthesis.cancel()` (line 113) before constructing/speaking a new utterance, guarded by a monotonic `seq` counter (lines 110, 118, 123) so a stale `onend`/`onerror` from a superseded utterance can never resurrect `isSpeaking`. `speech.test.ts` has an explicit seq-guard regression test (verified passing). Real-device "two rapid commands → only second heard, no overlap" confirmed in 10-06 sign-off. |
| 4 | The mic pauses listening while the dashboard is speaking and resumes right after, so the assistant never mishears its own voice as a new command | ✓ VERIFIED | `useVoiceCommand.ts:259-275` — a new `useEffect` subscribed to `useSpeech((s) => s.isSpeaking)`, gated by `armedRef.current` (never touches an unarmed/text-only session, Pitfall 3 regression-tested): on rising edge, `abort()`s the recognizer and sets `VoiceState` to `"speaking"`; on falling edge, `start()`s the recognizer again and returns to `"listening"`. `onend` gained a `speakingRef.current` early-return guard (line 226) so the TTS-driven `abort()` never races the natural restart loop (Pitfall 4). 5 dedicated test cases pass (`useVoiceCommand.test.ts`). Real-device confirmation in 10-06. |
| 5 | Spoken replies work correctly on both Chrome/Edge and Safari/iOS, verified on a real device | ✓ VERIFIED | Plan 10-06 is a `checkpoint:human-verify gate="blocking"` task; `10-06-SUMMARY.md` records the user typed "approved" after walking through all 12 verification steps across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device (gesture-unlock persistence A5, proactive-cancel-on-backgrounding A6, mic pause/resume, no-overlap, mute persistence). Per task instructions this is treated as a genuine passed human verification, not a gap. `REQUIREMENTS.md` confirms TTS-05 marked `[x]` only after this sign-off (not prematurely by an earlier plan — corrected in commit `677fdcd`). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/agent/schemas.py` | `ToggleSpeech` model, `AgentOutput.result` 7th union member, `AppliedFilters.speechEnabled` | ✓ VERIFIED | Lines 143-149 (`ToggleSpeech`), 152-163 (union), 228 (`AppliedFilters.speechEnabled: Literal["on","off"] \| None`) |
| `backend/app/agent/service.py` | `_apply_toggle_speech()` + `interpret()` dispatch branch | ✓ VERIFIED | Lines 218-220 (function), 257-258 (dispatch), positioned immediately after `ToggleDataset` branch |
| `backend/app/agent/prompt.py` | Spoken-reply toggle vocabulary paragraph | ✓ VERIFIED | Lines 49-53, contains `toggle_speech`, positioned after "Overlay data toggles" |
| `frontend/src/store/speech.ts` | `useSpeech` store: enabled/isSpeaking/primed + 6 actions | ✓ VERIFIED | 137 lines; all 6 actions present (`initSpeech`, `setEnabled`, `toggleEnabled`, `primeSpeech`, `speak`, `cancelForBackground`); zero `console.log`; ≥2 `speechSynthesis.cancel()` call sites |
| `frontend/src/tests/fakeSpeechSynthesis.ts` | `FakeUtterance`/`fakeSpeechSynthesis`/`installFakeSpeechSynthesis` test double | ✓ VERIFIED | File exists, imported and used by 3 downstream test files |
| `frontend/src/store/speech.test.ts` | Full unit coverage | ✓ VERIFIED | 196 lines, 35 `expect()` assertions, all passing (part of 75/75 relevant suite run) |
| `frontend/src/api/types.ts` | `AppliedFilters.speechEnabled` field | ✓ VERIFIED | Line 167: `speechEnabled?: "on" \| "off" \| null;` — byte-shape-identical to backend |
| `frontend/src/main.tsx` | `initSpeech()` bootstrap before first paint | ✓ VERIFIED | Line 18, after `initTheme()`, before `createRoot(...).render(...)` |
| `frontend/src/components/CommandBar.tsx` | `speak()`/`primeSpeech()` call sites, "Speaking…" indicator, `sessionOpen`/`lineText` extended | ✓ VERIFIED | Lines 121 (`speak(msg)` in `onApplied`), 175 & 241 (`primeSpeech()` in `onSubmit`/`onMicClick`), 192 (`sessionOpen` includes `"speaking"`), 228-232 (`lineText` blank for `"speaking"`), 309-317 (Speaking… block) |
| `frontend/src/hooks/useVoiceCommand.ts` | `"speaking"` VoiceState, `speakingRef`, pause/resume effect, `onend` guard, `onVisibility` cancel, `speak()` call | ✓ VERIFIED | Lines 42 (VoiceState), 91 (speakingRef), 150 (speak call), 226 (onend guard), 259-275 (pause/resume effect), 285 (cancelForBackground) |
| `frontend/src/components/Header.tsx` | Voice Replies toggle button | ✓ VERIFIED | Lines 188-200, className byte-identical to Theme toggle's, `aria-pressed={speechEnabled}` |
| `frontend/src/lib/agent.ts` | `applyAgentFilters`'s `speechEnabled != null` branch | ✓ VERIFIED | Lines 84-85, does not touch `touched`/`PulseField` set (confirmed by reading the surrounding block) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `service.py` | `schemas.py` | `isinstance(result, ToggleSpeech)` dispatch | ✓ WIRED | `service.py:257` |
| `store/speech.ts` | browser `speechSynthesis` | `speechSynthesis.cancel()` before every speak | ✓ WIRED | Lines 113, 133 |
| `main.tsx` | `store/speech.ts` | `useSpeech.getState().initSpeech()` before render | ✓ WIRED | `main.tsx:18` |
| `CommandBar.tsx` | `store/speech.ts` | `useSpeech.getState().speak(msg)` in `onApplied` | ✓ WIRED | `CommandBar.tsx:121` |
| `CommandBar.tsx` | `store/speech.ts` | `useSpeech.getState().primeSpeech()` in `onSubmit`/`onMicClick` | ✓ WIRED | `CommandBar.tsx:175, 241` |
| `useVoiceCommand.ts` | `store/speech.ts` | `useSpeech((s) => s.isSpeaking)` driving pause/resume | ✓ WIRED | `useVoiceCommand.ts:74`, effect at 259-275 |
| `useVoiceCommand.ts` | `store/speech.ts` | `useSpeech.getState().speak(msg)` in `handleSuccess` | ✓ WIRED | `useVoiceCommand.ts:150` |
| `useVoiceCommand.ts` | `store/speech.ts` | `cancelForBackground()` in `onVisibility` hidden branch | ✓ WIRED | `useVoiceCommand.ts:285` |
| `Header.tsx` | `store/speech.ts` | `useSpeech((s) => s.toggleEnabled)` on click | ✓ WIRED | `Header.tsx:127, 190` |
| `lib/agent.ts` | `store/speech.ts` | `setEnabled(f.speechEnabled === "on")` | ✓ WIRED | `lib/agent.ts:85` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CommandBar.tsx` Speaking… indicator | `isSpeaking` | `useSpeech((s) => s.isSpeaking)`, flipped by real `SpeechSynthesisUtterance.onstart`/`onend`/`onerror` browser events inside `speak()` | Yes — driven by native browser event callbacks, not a hardcoded/static value; verified via `FakeUtterance.emitStart()/emitEnd()` test-double simulation in unit tests and human-confirmed real-device audio playback in 10-06 | ✓ FLOWING |
| `Header.tsx` Voice Replies toggle | `speechEnabled` | `useSpeech((s) => s.enabled)`, sourced from `localStorage["hv-speech"]` via `initSpeech()` or live `setEnabled()` calls | Yes — reads real persisted state, not hardcoded | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend full suite green | `cd backend && .venv/bin/python -m pytest -q` | `257 passed, 7 skipped, 35 deselected` | ✓ PASS |
| Frontend full suite green | `cd frontend && npx vitest run` | `25 files, 299 tests passed` | ✓ PASS |
| Frontend TS compiles clean | `cd frontend && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Phase-10-specific test files green | `npx vitest run src/store/speech.test.ts src/components/CommandBar.test.tsx src/hooks/useVoiceCommand.test.ts src/lib/agent.test.ts` | `4 files, 75 tests passed` | ✓ PASS |
| `window.speechSynthesis` actual audio playback | N/A — no jsdom implementation exists (documented project constraint) | Delegated to Plan 10-06's real-device human checkpoint | ? SKIP (by design, already human-verified) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and no PLAN/SUMMARY for Phase 10 references a probe script — this project does not use the probe pattern. Step 7c: **SKIPPED (no probes declared or discovered)**.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| TTS-01 | 10-03, 10-04 | Dashboard speaks the same confirmation text shown visually, applied-only | ✓ SATISFIED | `CommandBar.tsx:121`, `useVoiceCommand.ts:150`, both speak the exact `msg` also passed to `setMessage` |
| TTS-02 | 10-01, 10-02, 10-05 | On by default, prominent/persisted/voice-reachable mute toggle | ✓ SATISFIED | `speech.ts:82` default true; `Header.tsx` click toggle; `ToggleSpeech` backend command; persisted via `localStorage["hv-speech"]` |
| TTS-03 | 10-02, 10-03 | Only one utterance plays at a time, cancel-before-speak | ✓ SATISFIED | `speech.ts:113` unconditional `cancel()` + seq guard; real-device confirmed in 10-06 |
| TTS-04 | 10-04 | Mic pauses during TTS, resumes after | ✓ SATISFIED | `useVoiceCommand.ts:259-275` armed-gated pause/resume effect; real-device confirmed in 10-06 |
| TTS-05 | 10-03, 10-04, 10-06 | Works on Chrome/Edge + Safari/iOS, verified on real device | ✓ SATISFIED | Plan 10-06 human checkpoint, "approved" sign-off recorded in `10-06-SUMMARY.md`, `REQUIREMENTS.md` updated only post-sign-off |

No orphaned requirements — `REQUIREMENTS.md`'s Phase 10 rows (TTS-01 through TTS-05) exactly match the `requirements:` fields declared across the six plans; all five are claimed and satisfied.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 17 files modified by Phase 10 (`grep` scan across all `key-files` from every SUMMARY). No stub returns (`return null`/`return {}`/empty handlers) found in the speech/voice/agent-fanout code paths reviewed.

A prior code review (`10-REVIEW.md`, 2026-08-25) found 0 Critical, 6 Warning, 2 Info findings across this same file set. None invalidate a must-have truth above; two are worth carrying forward as non-blocking quality debt directly touching this phase's feature surface:

| File | Finding | Severity | Impact on must-haves |
|------|---------|----------|----------------------|
| `frontend/src/store/speech.ts:107-129` | `speak()` has no tab-visibility guard — an `/agent` reply that resolves *while the tab is already backgrounded* (i.e., after the one-shot `visibilitychange` handler already fired) will still start audio | ⚠️ Warning (WR-05) | Does not fail SC3/SC4 as worded (those cover mid-utterance backgrounding and mic pause/resume, both verified); narrow edge case, not exercised by the 10-06 manual script |
| `frontend/src/lib/agent.ts` / `backend/app/agent/service.py` | Mute/unmute and overlay-toggle confirmations return `message=""` server-side and `composeConfirmation()` has no awareness of `speechEnabled`/overlay deltas — so the spoken/on-screen text after a voice "mute/unmute" command describes the unrelated current chart view, not the toggle action itself | ⚠️ Warning (WR-06) | Does not fail SC1 (same text is spoken as shown — the *identical string* rule holds) or SC2 (the toggle state itself changes correctly by voice, tested); it is a content-accuracy/UX gap given the project's "operable entirely by voice" core value — recommended follow-up, not a Phase 10 blocker |

The remaining 4 Warnings (WR-01 stuck-UI on a wake-word-only final result, WR-02 diverged "paused" copy strings, WR-03 empty-clarify-question silent state, WR-04 swallowed exception diagnostics) and 2 Info findings touch pre-existing voice-recognition/agent-error-handling code paths outside this phase's TTS-01–TTS-05 scope and do not affect any Phase 10 must-have.

### Human Verification Required

None outstanding. Plan 10-06's mandatory real-device checkpoint (the one behavior in this phase with no automated/jsdom test path — `window.speechSynthesis` is not implemented in jsdom) was already executed and signed off ("approved") across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device, per `10-06-SUMMARY.md`. Per the verification task's explicit instruction, this is treated as a genuine completed human verification, not a pending item.

### Gaps Summary

No gaps found. All 5 roadmap Success Criteria are independently verified in the codebase (not merely claimed in SUMMARY.md): both automated suites are fully green (257 backend, 299 frontend tests), `tsc --noEmit` is clean, every artifact declared across the 6 plans exists/is substantive/is wired, all key links resolve to real call sites, and the one behavior requiring real-device testing was already human-verified and signed off in Plan 10-06. Two non-blocking Warning-level findings from the code review (WR-05 tab-visibility edge case, WR-06 generic toggle confirmation copy) are documented above as recommended follow-up work, not phase-blocking gaps.

---

*Verified: 2026-08-25T20:29:42Z*
*Verifier: Claude (gsd-verifier)*
