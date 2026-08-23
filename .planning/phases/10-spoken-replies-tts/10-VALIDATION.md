---
phase: 10
slug: spoken-replies-tts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (frontend), pytest 9.x (backend) |
| **Config file** | `frontend/vite.config.ts` (`test` block, `environment: 'jsdom'`, `setupFiles: './src/tests/setup.ts'`); `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd frontend && npx vitest run src/store/speech.test.ts src/hooks/useVoiceCommand.test.ts src/components/CommandBar.test.tsx` / `cd backend && python -m pytest tests/test_agent_schemas.py tests/test_agent_service.py -x` |
| **Full suite command** | `cd frontend && npm test -- --run` / `cd backend && python -m pytest` |
| **Estimated runtime** | ~15 seconds (frontend quick), ~45 seconds (full suite both) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command scoped to changed test files (frontend) or `tests/test_agent_schemas.py tests/test_agent_service.py -x` when backend schema/service files change
- **After every plan wave:** Run `npm test -- --run` (frontend full suite) and `python -m pytest` (backend full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, PLUS a manual real-device pass (Chrome/Edge desktop, Safari desktop, and a real iOS Safari device)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-W0-01 | 01 | 0 | TTS-01/02/03/04 | — | N/A (test infra) | unit | `npx vitest run src/tests/fakeSpeechSynthesis.ts` (imports only) | ❌ W0 | ⬜ pending |
| 10-01-xx | 01 | 1 | TTS-02 | — | `enabled` defaults `true`; persists to `localStorage["hv-speech"]`; guarded read/write | unit | `npx vitest run src/store/speech.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-xx | 01 | 1 | TTS-03 | — | `cancel()` called before every `speak()`; stale `onend`/`onerror` from a superseded utterance never flips `isSpeaking` false (seq guard) | unit | `npx vitest run src/store/speech.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-xx | 02 | 1 | TTS-01 | — | `speak()` called with exact on-screen `msg` on `applied` reply from BOTH input paths; never on `clarify`/`refuse`/`unclear`/`unavailable`; never on manual `useFilters` mutation | unit + integration | `npx vitest run src/components/CommandBar.test.tsx` | ❌ W0 (extend existing) | ⬜ pending |
| 10-03-xx | 03 | 2 | TTS-04 | T-04 (own-voice mishear) | `isSpeaking: false→true` aborts recognizer (when `armed`) and sets `VoiceState "speaking"`; `true→false` restarts it, returns to `"listening"`; NO recognizer interaction when `armed === false` | unit | `npx vitest run src/hooks/useVoiceCommand.test.ts` | ❌ W0 (extend existing) | ⬜ pending |
| 10-04-xx | 04 | 1 | TTS-02 (backend) | V5 Input Validation | `ToggleSpeech.state` is closed `Literal["on","off"]`; round-trips through `AppliedFilters.speechEnabled` | unit | `python -m pytest tests/test_agent_schemas.py -k toggle_speech tests/test_agent_service.py -k toggle_speech` | ❌ W0 (extend existing) | ⬜ pending |
| 10-05-manual | — | — | TTS-05 | — | Cross-browser real-device behavior (gesture unlock, cancel-and-replace, mic pause/resume, backgrounding) | manual | N/A — `human_needed` | N/A — jsdom cannot implement `speechSynthesis` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs (10-0N-0M) are assigned by the planner; this table maps requirements to test surfaces, not final task numbering.*

---

## Wave 0 Requirements

- [ ] `frontend/src/tests/fakeSpeechSynthesis.ts` — new test double mirroring `frontend/src/tests/fakeRecognition.ts`'s conventions (stub `speak`/`cancel`/`getVoices`, dispatch `start`/`end`/`error` events, expose call log for assertions)
- [ ] `frontend/src/store/speech.test.ts` — new file; covers TTS-02/TTS-03 (persistence, cancel-before-speak, seq guard) using the fake above
- [ ] Extend `frontend/src/hooks/useVoiceCommand.test.ts` — add a describe block for the `isSpeaking`-driven pause/resume effect (TTS-04), including the `armedRef`-gate regression test (text-only users must never have the mic silently activated) as an explicit test case
- [ ] Extend `frontend/src/components/CommandBar.test.tsx` — assert `speak()`/`useSpeech` invoked on an `applied` reply and not on other reply kinds (TTS-01); assert the new "Speaking…" block renders/doesn't render per `isSpeaking`
- [ ] `backend/tests/test_agent_schemas.py` — extend with `test_toggle_speech_variant_parses()` and a case-drift-normalizes test, mirroring the existing `test_toggle_dataset_variant_parses()`/`test_toggle_dataset_case_drift_normalizes()` pattern
- [ ] `backend/tests/test_agent_service.py` — extend with `test_toggle_speech_maps_to_applied_filters_and_marks_reachable()`, mirroring the existing `test_toggle_dataset_maps_to_applied_filters_and_marks_reachable()`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-browser TTS playback correctness (voice actually audible, correct text) | TTS-05 | jsdom does not implement `speechSynthesis`; only a real speech engine can confirm audio actually plays | On Chrome/Edge desktop, Safari desktop, and a real iOS Safari device: issue a voice/agent command, confirm the confirmation is spoken aloud with the same text shown on screen |
| iOS gesture-unlock survives the caregiver's single initial tap | TTS-05, TTS-01 | Requires a real iOS Safari WebKit engine; jsdom cannot model the browser's audio-unlock gesture requirement | On a real iOS device: tap the mic (or submit a typed command) once, then issue a second command without any further tap; confirm speech still plays |
| Mic pause/resume is audibly correct (no self-mishearing) | TTS-04 | Requires a live microphone + live speaker on the same device to confirm the recognizer doesn't pick up its own TTS output | On Chrome/Edge and Safari/iOS: speak a command, let the dashboard reply aloud, confirm the mic does not re-trigger on its own voice and resumes listening after the reply ends |
| Backgrounding mid-utterance doesn't permanently break TTS | TTS-05 | iOS Safari's synthesis engine has known backgrounding bugs (Pitfall 6, RESEARCH.md) that only manifest on real hardware | On iOS Safari: background the tab mid-utterance, return to the app, issue a new command, confirm speech still plays (engine not permanently stuck) |
| Cancel-and-replace with two rapid commands | TTS-03 | Automated seq-guard unit tests cover the logic; a real-device pass confirms no audible overlap/garble between utterances | Issue two commands in quick succession; confirm only the second reply is heard, cleanly, with no audio overlap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
