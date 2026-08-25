---
phase: 10-spoken-replies-tts
audited: 2026-08-25
auditor: gsd-security-auditor
threats_total: 12
threats_closed: 12
threats_open: 0
asvs_level: not-configured
block_on: high
status: SECURED
---

# Phase 10: Spoken Replies (TTS) — Security Audit

Verifies every threat declared across Plans 10-01 through 10-06's `<threat_model>` blocks is
actually mitigated in the implemented code (not merely documented as intent). No
`## Threat Flags` section was present in any of the six SUMMARY.md files — the threat register
was fully authored at plan time, and the executor did not discover any new attack surface during
implementation requiring a flag.

## Threat Verification

| Threat ID | Category | Component | Disposition | Verification Method | Evidence | Status |
|-----------|----------|-----------|-------------|----------------------|----------|--------|
| T-10-01 | Tampering | `ToggleSpeech.state` | mitigate | grep + type check + passing test | `backend/app/agent/schemas.py:148-149` — `class ToggleSpeech(BaseModel): action: Literal["toggle_speech"]; state: Literal["on", "off"]`. Closed union member confirmed at `AgentOutput.result` (`schemas.py:155-163`). Tested by `backend/tests/test_agent_schemas.py::test_toggle_speech_variant_parses` and `::test_toggle_speech_case_drift_normalizes` — both pass (`.venv/bin/python -m pytest tests/test_agent_schemas.py tests/test_agent_service.py -q` → 49 passed). | CLOSED |
| T-10-02 | Information Disclosure | `AppliedFilters.speechEnabled` | accept | Accepted-risk entry present in this document (below) | `backend/app/agent/schemas.py:228` — `speechEnabled: Literal["on", "off"] | None = None`, a closed 2-value enum, no free text. | CLOSED |
| T-10-03 | Tampering (prompt injection) | `prompt.py` SYSTEM_PROMPT | accept | Accepted-risk entry present in this document (below); structural verification | `backend/app/agent/prompt.py:16-82` — `SYSTEM_PROMPT` is a bare triple-quoted module constant with zero `.format()`/f-string/`%`-interpolation. `build_messages()` (lines 85-93) places all user/transcript text exclusively into `user`/`assistant` role message dicts, never into `system=`. `service.py:157` passes `system=SYSTEM_PROMPT` unmodified to `messages.parse`. | CLOSED |
| T-10-04 | Information Disclosure | `speech.ts` `speak()`'s `text` parameter | mitigate | grep for `console.*` across all Phase 10 frontend files | `grep -c "console\." frontend/src/store/speech.ts frontend/src/components/CommandBar.tsx frontend/src/hooks/useVoiceCommand.ts frontend/src/lib/agent.ts frontend/src/components/Header.tsx` → 0 matches in all five files. `text` only reaches `new SpeechSynthesisUtterance(text)` (`speech.ts:115`) and the browser's native synthesis API. | CLOSED |
| T-10-05 | Tampering | `localStorage["hv-speech"]` | accept | Accepted-risk entry present in this document (below); code confirms only-"off"-trusted logic | `frontend/src/store/speech.ts:22-30` — `readStoredEnabled()`: `localStorage.getItem(STORAGE_KEY) === "off" ? false : true`, wrapped in try/catch defaulting to `true`. Any tampered/garbage value defaults to the safe "on" state. | CLOSED |
| T-10-06 | Denial of Service (UX) — overlapping/queued audio | `speech.ts speak()` | mitigate | grep for unconditional cancel-before-speak + passing seq-guard regression test | `frontend/src/store/speech.ts:114` — `window.speechSynthesis.cancel();` called unconditionally as the first synthesis action inside `speak()`, before constructing the new utterance. `grep -c "speechSynthesis.cancel()" frontend/src/store/speech.ts` = 2 (speak() + cancelForBackground()). Regression-tested: `frontend/src/store/speech.test.ts:140` `it("seq guard: a stale onend from a superseded utterance never flips isSpeaking back to false (Pitfall 2)")` — part of the 75/75 passing frontend suite (`npx vitest run src/store/speech.test.ts ...` → 75 passed). Single call-site discipline verified: `CommandBar.tsx:122` and `useVoiceCommand.ts:150` are the only two `speak()` call sites in the whole frontend (D-06 structural invariant), both gated to the `applied` reply kind only. | CLOSED |
| T-10-07 | Tampering | Model-authored text reaching `speak()` | accept | Accepted-risk entry present in this document (below); traced data flow | `CommandBar.tsx:114-122` and `useVoiceCommand.ts:144-150` both call `speak(msg)` where `msg` is built by `composeConfirmation(useFilters.getState(), ...)` (a pure frontend function over post-apply store state, `lib/agent.ts:120-151`) plus, only for the two toggle commands, a fixed server-templated string (`copy.py:72-85`, never raw Claude prose — model output for those two variants is the closed `Literal["on","off"]`/dataset token, not free text). `Clarification.question` (the one Claude-authored string that ever reaches the client) is never passed to `speak()` — only rendered as an escaped DOM text node (`CommandBar.tsx` clarify branch just calls `setMessage`, never `speak`). | CLOSED |
| T-10-08 | Denial of Service (UX) — mic self-mishearing feedback loop | isSpeaking pause/resume effect | mitigate | grep + passing dedicated test | `frontend/src/hooks/useVoiceCommand.ts:263-279` — effect aborts `recRef.current?.abort()` on the rising edge of `isSpeaking`, before any TTS audio could be captured by the recognizer; gated by `if (!armedRef.current) return;` (line 266). Tested: `useVoiceCommand.test.ts` describe block `"useVoiceCommand mic pause/resume during speech (TTS-04)"` (line 386), case `"aborts the recognizer and enters 'speaking' when isSpeaking flips true while armed"` — part of the passing 75-test frontend suite. | CLOSED |
| T-10-09 | Denial of Service (UX) — mic silently activated for opted-out user | isSpeaking effect firing for text-only submit | mitigate | grep + passing dedicated regression test | `frontend/src/hooks/useVoiceCommand.ts:266` — `if (!armedRef.current) return;` early exit before any recognizer touch. Regression-tested: `useVoiceCommand.test.ts` case `"never touches an unarmed/absent recognizer (Pitfall 3 regression)"` (asserts `FakeRecognition.instances` has length 0 — the recognizer constructor itself was never invoked, not merely an uncalled method) — passing. | CLOSED |
| T-10-10 | Repudiation / stuck state — iOS backgrounding | `onVisibility` handler | mitigate | grep + passing dedicated test | `frontend/src/hooks/useVoiceCommand.ts:289` — `useSpeech.getState().cancelForBackground();` is the first line inside the `if (hidden)` branch, called proactively before `clearRestartTimer()`/`recRef.current?.abort()`. `cancelForBackground()` itself (`speech.ts:132-137`) synchronously forces `isSpeaking: false` without waiting for `onend`/`onerror`. Additionally hardened post-plan by code-review fix WR-05: `speech.ts:110` — `speak()` itself now also checks `document.hidden` before ever starting playback (belt-and-suspenders beyond the reactive `visibilitychange` handler this threat's mitigation plan cites). Tested: `useVoiceCommand.test.ts` case `"cancels in-flight speech when the tab backgrounds mid-utterance (Pitfall 6)"` — passing. | CLOSED |
| T-10-11 | Tampering | `applyAgentFilters`'s speechEnabled branch | accept | Accepted-risk entry present in this document (below); code confirms discipline reuse | `frontend/src/lib/agent.ts:84-88` — `if (f.speechEnabled != null) { useSpeech.getState().setEnabled(f.speechEnabled === "on"); }`, the identical `!= null` present-value-delta style used by every other `AppliedFilters` field in the same function; the value's only possible origin is the backend's validated `Literal["on","off"]` (T-10-01). Tested: `frontend/src/lib/agent.test.ts` — "speechEnabled reaches useSpeech.setEnabled without touching the pulse" — passing. | CLOSED |
| T-10-12 | none | Manual verification only (Plan 10-06) | accept | Accepted-risk entry present in this document (below); human sign-off record | `.planning/phases/10-spoken-replies-tts/10-06-SUMMARY.md` — "Confirmed spoken replies audibly play the correct confirmation text on all three required environments" + "User confirmed all verification steps passed across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device on first pass." `.planning/REQUIREMENTS.md` TTS-03/TTS-05 marked complete only after this checkpoint (not prematurely, per the plan's own explicit "held to `[ ]` until sign-off" discipline). | CLOSED |

## Accepted Risks Log

The following threats carry an `accept` disposition per their originating PLAN.md `<threat_model>`
block. Recorded here per the auditor's accept-disposition verification requirement — an `accept`
threat is CLOSED only when its accepted-risk entry exists in this log, which it now does.

- **T-10-02** (`AppliedFilters.speechEnabled` information disclosure) — Accepted: the field is a
  closed 2-value `Literal["on","off"]` enum, structurally incapable of carrying free-text
  leakage; mirrors the already-accepted `overlayDataset`/`overlayState` disposition from Phase 9.
- **T-10-03** (SYSTEM_PROMPT prompt-injection tampering) — Accepted: `SYSTEM_PROMPT` is a static
  module constant, never interpolated with user or database content — a pre-existing,
  unmodified project invariant this phase does not touch.
- **T-10-05** (`localStorage["hv-speech"]` tampering) — Accepted: single-user personal app;
  a spoofed value has no security-relevant consequence (worst case, TTS defaults to on/off
  incorrectly for one page load) and only the literal string `"off"` is ever trusted — anything
  else, including adversarial garbage, safely defaults to on. Identical risk profile to the
  pre-existing `theme.ts` `hv-theme` key.
- **T-10-07** (model-authored text reaching `speak()`) — Accepted (already mitigated upstream):
  the spoken string is always the frontend-composed `composeConfirmation()` output (plus, for
  the two toggle commands, fixed server-template copy from `copy.py`) — never raw, unvalidated
  Claude prose. This is the pre-existing API-04 invariant, unchanged by this phase.
- **T-10-11** (`applyAgentFilters`'s speechEnabled branch tampering) — Accepted: reuses the
  identical `!= null` present-value-delta discipline already applied to every other
  `AppliedFilters` field on the single fan-out surface; the value's only possible origin is an
  already-validated backend `Literal["on","off"]` enum (T-10-01).
- **T-10-12** (manual-verification-only, no new code) — Accepted: pure real-hardware
  confirmation of already-reviewed code; human sign-off recorded in
  `10-06-SUMMARY.md` and `.planning/REQUIREMENTS.md`.

## Unregistered Flags

None. No SUMMARY.md file across Plans 10-01 through 10-06 contains a `## Threat Flags` section,
confirming no new attack surface was discovered by the executor during implementation beyond
what the threat register already covers.

**Note (non-blocking, informational):** The independent code-review pass (`10-REVIEW.md`,
6 warnings, all fixed per `10-REVIEW-FIX.md`, commits `fe8e12d`/`18856f8`/`7649b02`/`8cac424`/
`931bf38`/`26def5a`) surfaced one finding with a real security-adjacent dimension — WR-05,
`speak()` had no tab-visibility guard of its own and could start audio in an already-backgrounded
tab even after the reactive `visibilitychange` handler's one-shot cancellation had already fired.
This is a hardening of T-10-10's mitigation (background-audio DoS/UX), not a new/separate threat
category, and it is already fixed in the codebase (`frontend/src/store/speech.ts:110`, verified
above). No SECURITY.md action required; noted here for audit-trail completeness.

## Summary

All 12 threats declared across Phase 10's six plans resolve to CLOSED:
- 6 `mitigate` threats (T-10-01, T-10-04, T-10-06, T-10-08, T-10-09, T-10-10) — each verified by
  a direct code citation AND a passing, purpose-built automated test exercising that exact
  behavior (not just static code presence).
- 6 `accept` threats (T-10-02, T-10-03, T-10-05, T-10-07, T-10-11, T-10-12) — each verified
  against this document's Accepted Risks Log, now populated.
- 0 `transfer` threats declared in this phase.
- 0 unregistered flags.

Both automated suites are green as of this audit:
- Backend: `.venv/bin/python -m pytest tests/test_agent_schemas.py tests/test_agent_service.py -q` → 49 passed
- Frontend: `npx vitest run src/store/speech.test.ts src/hooks/useVoiceCommand.test.ts src/components/CommandBar.test.tsx src/lib/agent.test.ts` → 75 passed (4 files)

No implementation files were modified during this audit.
