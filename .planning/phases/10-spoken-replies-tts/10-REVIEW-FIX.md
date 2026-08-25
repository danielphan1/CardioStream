---
phase: 10-spoken-replies-tts
fixed_at: 2026-08-25T20:53:00Z
review_path: .planning/phases/10-spoken-replies-tts/10-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-08-25T20:53:00Z
**Source review:** .planning/phases/10-spoken-replies-tts/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (fix_scope: critical_warning — 0 critical, 6 warning; 2 info findings out of scope, not attempted)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### WR-01: Wake-word-only final speech result leaves the UI frozen in "triggered" with stale text

**Files modified:** `frontend/src/hooks/useVoiceCommand.ts`
**Commit:** fe8e12d
**Applied fix:** In `handleResult`, the `command === ""` branch (final result that
re-parses to an empty command after wake-word stripping) now clears `interim`
and resets `voiceState` back to `"listening"` before returning, instead of
returning immediately and leaving the bar stuck showing the stale partial
transcript. Verified via `tsc --noEmit` (no errors).

### WR-02: "Voice paused" copy has two diverged strings; the hook's version is unreachable

**Files modified:** `frontend/src/components/CommandBar.tsx`, `frontend/src/components/CommandBar.test.tsx`
**Commit:** 18856f8
**Applied fix:** Removed the locally-defined `VOICE_PAUSED_COPY` constant in
`CommandBar.tsx`; the paused branch now renders `voiceMessage` (the hook's
`message`, sourced from `useVoiceCommand.ts`'s `PAUSED_COPY`), making the hook
the single source of truth for this copy. Updated the one test
(`CommandBar.test.tsx`) that asserted the old locally-defined string to expect
the hook's copy instead. Verified via `tsc --noEmit` (no errors) and
`vitest run src/components/CommandBar.test.tsx` (21/21 passed).

### WR-03: An empty/whitespace-only clarifying question renders as a completely silent, invisible state

**Files modified:** `backend/app/agent/service.py`
**Commit:** 7649b02
**Applied fix:** In `interpret()`'s `Clarification` branch, `question` now
falls back to a fixed prompt ("Which chart or time range did you mean?") when
`result.question.strip()` is empty, so the frontend's aria-live confirmation
block (gated on `lineText !== ""`) can never be silently skipped. Verified via
`ast.parse` and `pytest tests/test_agent_service.py` (11/11 passed).

### WR-04: Every exception handler in the agent service discards the exception, leaving no diagnostic trail

**Files modified:** `backend/app/agent/service.py`
**Commit:** 8cac424
**Applied fix:** `call_claude()`'s `except APIError` and `except ValidationError`
handlers now bind the exception (`as exc`) and interpolate it into the warning
log message. The top-level `except Exception` backstop in `interpret()` now
uses `logger.exception(...)` (captures type/message/traceback) instead of a
fixed `logger.warning(...)` string. No transcript text or API key is logged in
either case. Verified via `ast.parse` and `pytest tests/test_agent_service.py`
(11/11 passed).

### WR-05: `speak()` doesn't check tab visibility before starting playback

**Files modified:** `frontend/src/store/speech.ts`
**Commit:** 931bf38
**Applied fix:** Added a `document.hidden` guard at the top of `speak()` (after
the existing `enabled`/empty-text/support guards, before the `cancel()` +
`speak()` calls) so a reply that resolves while the tab is already
backgrounded can no longer start audio. Verified via `tsc --noEmit` (no
errors) and `vitest run src/store/speech.test.ts` (21/21 passed).

### WR-06: Mute/unmute and overlay-toggle confirmations don't describe the action that was taken

**Files modified:** `backend/app/agent/copy.py`, `backend/app/agent/service.py`
**Commit:** 26def5a
**Applied fix:** Chose the "dedicated server-side message" option from the
review's two alternatives (lower architectural churn than teaching
`composeConfirmation()` about toggle deltas, and reuses the exact mechanism
already in place for the D-16 stats-bar pointer — both `CommandBar.onApplied`
and `useVoiceCommand.handleSuccess` already append a non-empty `reply.message`
after the composed echo). Added `toggle_speech_message()` and
`toggle_dataset_message()` fixed-template copy functions to `copy.py`
(mirroring the existing `medical_refusal()` pattern), and wired
`_apply_toggle_speech`/`_apply_toggle_dataset` in `service.py` to use them
instead of `message=""`. On unmute specifically, this confirmation is now
audible (spoken) since `speak()` no longer no-ops once `enabled` is true
again. Verified via `ast.parse` and the full backend suite:
`pytest tests/` (257 passed, 7 skipped, 0 failed).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-08-25T20:53:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
