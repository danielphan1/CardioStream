# SECURITY.md — Phase 4: Voice Capture

**Audited:** 2026-07-21
**Phase:** 04 — voice-capture (plans 04-01, 04-02, 04-03)
**ASVS Level:** unset (default) | **block_on:** high
**Result:** SECURED — 6/6 threats closed

This file records the verification of every declared threat mitigation in the
Phase 4 `<threat_model>` blocks against the implemented code. Implementation
files were treated as read-only; this audit produced no code changes.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-04-01 | Tampering | mitigate | CLOSED | `frontend/src/lib/voice.ts:31-43` (`extractCommand` returns a plain string, never `AppliedFilters`); `frontend/src/hooks/useVoiceCommand.ts:160-181` (only `extractCommand` output sent via `mutateRef.current({ text: command, context: null })`, the shared `useAgent().mutate` from `:66`); `grep postAgent` in hook = 0 (no re-wrapped fetch). Store writes route only through server-composed `applyAgentFilters(reply.filters)` (`:129`, `:139`). |
| T-04-02 | Tampering / EoP | mitigate | CLOSED | `frontend/src/hooks/useVoiceCommand.ts:125-149` (`handleSuccess` switches on the closed `AgentReply.kind` union; applies only `reply.filters` through `applyAgentFilters`, executes nothing model-authored). `applyAgentFilters` (`frontend/src/lib/agent.ts:38-77`) consumes only closed TS-union `AppliedFilters` fields; unknown fields ignored by construction. No `eval`/dynamic execution present. |
| T-04-03 | DoS / cost | mitigate | CLOSED | `frontend/src/lib/voice.ts:111-114` (`computeBackoff` hard-caps restart delay at `BACKOFF_CAP_MS = 2000`); `frontend/src/hooks/useVoiceCommand.ts:109-122` (`scheduleRestart` uses it, single pending timer); seq guard drops superseded applies at `:126` (`capturedSeq !== seqRef.current` returns before any store touch); server 429 mapped to fixed copy at `:151-156`. |
| T-04-04 | Info Disclosure | mitigate | CLOSED | Only fixed friendly copy renders: `RATE_LIMIT_COPY`/`OFFLINE_COPY`/`PAUSED_COPY` (`useVoiceCommand.ts:43-50`) and `RATE_LIMIT_COPY`/`OFFLINE_COPY`/`VOICE_PAUSED_COPY` (`CommandBar.tsx:50-58`). No raw `event.error`/`ApiError` string reaches the DOM (`grep .error` in CommandBar = none; `onerror` at `useVoiceCommand.ts:199-204` never stores the raw string). No `console.*` in `voice.ts`, `useVoiceCommand.ts`, or `CommandBar.tsx` (grep = NONE) → transcript never logged (SEC-03). Transcript is display-only (`CommandBar.tsx:194-206`). |
| T-04-05 | Info Disclosure | mitigate | CLOSED | Explicit-stop-only session: `stop()` sets `armed=false` and calls `recRef.current?.abort()` (`useVoiceCommand.ts:230-237`, D-13). Visibility guard aborts the live session when `document.hidden` (`:243-258`, abort at `:248`) and tears down on unmount (`:261-266`, abort at `:265`) — no background listening. Visible LISTENING state (color+word+icon triad) rendered at `CommandBar.tsx:181-206` / mic aria-label swap at `:236` (D-07). Real-device checkpoint (04-03 Task 3) confirmed no covert listening after stop. |
| T-04-SC | Tampering (supply chain) | **accept** | CLOSED | Accepted risk logged below. `frontend/package.json` contains ZERO new voice-recognition runtime packages: no `react-speech-recognition`, no `regenerator-runtime` (grep = NONE). Native `webkitSpeechRecognition` used via `getSpeechRecognitionCtor` (`voice.ts:87-90`); `lucide-react` (Mic/MicOff glyphs) was already an audited Phase 2 dependency. |

---

## Accepted Risks Log

### T-04-SC — Supply-chain (npm installs) — ACCEPTED

**Disposition:** accept (declared in 04-01 and 04-03 `<threat_model>` blocks).

**Rationale:** The voice layer adds ZERO new runtime dependencies. It is built on
the browser-native `webkitSpeechRecognition` API plus reuse of the existing
`lucide-react` icon package (audited in Phase 2). `frontend/package.json` was
verified to contain no `react-speech-recognition` and no `regenerator-runtime`.

**Residual risk:** None introduced by this phase — the accepted risk is the
standing supply-chain exposure of already-present, previously-audited packages.

**Condition for revisiting:** Per 04-RESEARCH §Package Legitimacy Audit, if a
future wrapper-based fallback (e.g. `react-speech-recognition`) is chosen, a
blocking `checkpoint:human-verify` is required before any install.

---

## Unregistered Flags

None. Neither 04-01, 04-02, nor 04-03 SUMMARY carries a `## Threat Flags`
section; each instead carries a "Threat Surface Notes" section explicitly
stating "No new security surface beyond the plan's `<threat_model>`." All threat
surface maps to the six registered threat IDs above.

---

## Auditor Notes

- Seq-guard completeness verified across ALL store-mutating entry points: both
  `stop()` (`useVoiceCommand.ts:232`) and `enterPaused()` (`:101`) increment
  `seqRef` so any in-flight reply is superseded and dropped at `handleSuccess`
  `:126` / `handleError` `:152` before touching the store.
- The voice command path and the text-box path both obtain `mutate` from the
  same `useAgent()` hook (hook `:66`; `CommandBar.tsx:72`), confirming voice
  reuses the identical server-validated `/agent` pipeline (VOICE-08).
- Server-side authority (Pydantic structured-outputs, `AgentRequest.text`
  max_length, 429 handling) is a Phase 3 control relied on by T-04-01/02/03 and
  is out of scope for this frontend audit.
