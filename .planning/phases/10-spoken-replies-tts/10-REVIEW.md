---
phase: 10-spoken-replies-tts
reviewed: 2026-08-25T20:25:12Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - backend/app/agent/prompt.py
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/tests/test_agent_schemas.py
  - backend/tests/test_agent_service.py
  - frontend/src/api/types.ts
  - frontend/src/components/CommandBar.test.tsx
  - frontend/src/components/CommandBar.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/hooks/useVoiceCommand.test.ts
  - frontend/src/hooks/useVoiceCommand.ts
  - frontend/src/lib/agent.test.ts
  - frontend/src/lib/agent.ts
  - frontend/src/main.tsx
  - frontend/src/store/speech.test.ts
  - frontend/src/store/speech.ts
  - frontend/src/tests/fakeSpeechSynthesis.ts
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-25T20:25:12Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the spoken-replies (TTS) feature end to end: the backend `toggle_speech`
agent command (prompt/schemas/service) and the frontend speech store, the
`useVoiceCommand` mic/TTS coordination hook, `CommandBar`'s text-and-voice
rendering, and `Header`'s mute toggle, plus their unit tests.

No hardcoded secrets, injection, XSS, or crash-level defects were found — the
"never raw model text/never raw error" and "server composes all copy" invariants
documented throughout the code hold up under inspection, and the seq-guard /
circuit-breaker mechanics are sound. The Python side degrades gracefully for
every Claude-side failure mode without ever raising past `interpret()`.

The issues found are all edge-case correctness and quality gaps, several with a
real (if narrow) user-facing effect: a UI-freezing edge case in the wake-word
final-result handler, a "paused" copy string that has already drifted into two
different values (one of which is dead code), an LLM-authored clarifying
question that can render as a completely blank/silent state, and toggle
confirmations (mute/unmute, overlay) that don't actually describe the action
that was just taken — notable given this project's "operable entirely by voice"
core value. None of these require raw error text to leak or allow the server to
5xx; they degrade to confusing-but-safe UI states.

## Warnings

### WR-01: Wake-word-only final speech result leaves the UI frozen in "triggered" with stale text

**File:** `frontend/src/hooks/useVoiceCommand.ts:174-198`
**Issue:** `handleResult` sets `interim`/`voiceState="triggered"` whenever an
interim (non-final) result strips down to a non-empty command:
```ts
if (!result.isFinal) {
  setInterim(command);
  setVoiceState("triggered");
  return;
}
if (command === "") return; // wake word only → nothing to submit
```
If the SAME utterance's *final* result later re-parses to an empty command
(speech engines commonly revise/shrink interim transcripts by the time they
finalize — e.g. interim `"dashboard show"` → final `"dashboard"`), the
`command === ""` branch returns immediately without clearing `interim` or
resetting `voiceState` back to `"listening"`. Because `CommandBar` renders
`interim` verbatim while `voiceState === "triggered"`, the bar is left
permanently showing the stale partial transcript — nothing else in the hook
clears it (subsequent wake-word-less room speech is silently ignored by the
`command == null` guard above it, which also doesn't touch `interim`/`state`).
This is a real, reachable "stuck UI" bug, not merely theoretical: the
`command === ""` branch is only reachable via `result.isFinal === true`, and
nothing guarantees the immediately-preceding interim update (if any) was also
empty.
**Fix:**
```ts
if (command === "") {
  setInterim("");
  setVoiceState("listening"); // wake word only → nothing to submit, don't get stuck
  return;
}
```

### WR-02: "Voice paused" copy has two diverged strings; the hook's version is unreachable

**File:** `frontend/src/hooks/useVoiceCommand.ts:53-54,109-115` and `frontend/src/components/CommandBar.tsx:56-60,225-227`
**Issue:** `useVoiceCommand.ts` defines and sets:
```ts
const PAUSED_COPY = "Voice is paused — tap the mic to start listening again.";
...
function enterPaused() { ...; setMessage(PAUSED_COPY); }
```
but `CommandBar.tsx` defines a *separate* constant and uses it instead of the
hook's `voiceMessage` for this exact branch — the only place in the whole
line-rendering `if/else` chain where the hook's `message` is bypassed in favor
of a locally-defined string:
```ts
const VOICE_PAUSED_COPY = "Voice paused — tap to resume";
...
} else if (voiceState === "paused") {
  lineText = VOICE_PAUSED_COPY; // D-14 fixed copy
  lineGlyph = "micoff";
}
```
The two strings have already drifted apart in wording, and `PAUSED_COPY` is
therefore dead as far as the only consumer of this hook is concerned (verified
by inspection — no other file imports `useVoiceCommand`'s `message`/`voiceMessage`
for the paused case). The only test coverage for this value
(`useVoiceCommand.test.ts`) asserts a loose `/paused/i` regex, so it doesn't
catch the divergence or the fact the string never reaches the DOM.
**Fix:** Pick one source of truth. Simplest: delete `VOICE_PAUSED_COPY` in
`CommandBar.tsx` and render `voiceMessage` for the paused branch (it is always
non-empty once `enterPaused()` has run):
```ts
} else if (voiceState === "paused") {
  lineText = voiceMessage;
  lineGlyph = "micoff";
}
```

### WR-03: An empty/whitespace-only clarifying question renders as a completely silent, invisible state

**File:** `backend/app/agent/schemas.py:114-119`, `backend/app/agent/service.py:264-274`, `frontend/src/components/CommandBar.tsx:324-344`
**Issue:** `Clarification.question` is a Claude-facing field deliberately given
no `min_length` (per the module's documented structured-outputs constraint:
"no min-length ... a soft clamp would become a hard parse error"). `interpret()`
then does:
```python
question = result.question.strip()
...
return AgentReply(kind="clarify", message=question, ...)
```
If Claude ever emits an empty or whitespace-only `question` (nothing in the
schema prevents it), `message` becomes `""`. On the frontend, the aria-live
confirmation block is gated on `lineText !== ""`:
```tsx
{!anyWorking && lineText !== "" && (
  <p aria-live="polite" ...> ... </p>
)}
```
so the entire block — including the `"?"` marker glyph — fails to render.
The app is left in `status === "clarify"` (awaiting a follow-up answer) with
*zero* visible or audible indication anything is happening — a true dead end
for a voice-only user who can't see the screen to notice nothing rendered.
**Fix:** Add a safe fallback in the server (cheapest, single choke point):
```python
question = result.question.strip() or "Which chart or time range did you mean?"
```

### WR-04: Every exception handler in the agent service discards the exception, leaving no diagnostic trail

**File:** `backend/app/agent/service.py:159-169`, `backend/app/agent/service.py:286-288`
**Issue:** All three catch sites log a fixed string only, never the exception
itself:
```python
except APIError:
    _record_outcome(False)
    logger.warning("Claude call failed for /agent; degrading to unavailable reply")
    return None, False
except ValidationError:
    logger.warning("Claude response failed schema validation; degrading to unclear reply")
    return None, True
...
except Exception:  # noqa: BLE001 — absolute never-500 backstop (VOICE-07)
    logger.warning("Unexpected error interpreting /agent input; degrading to unclear reply")
    return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
```
The top-level catch-all in particular is meant to be a backstop for genuinely
*unexpected* bugs (a new result variant not handled, an attribute error, a
future refactor mistake) — but with no exception type, message, or traceback
logged, such a bug becomes permanently invisible in production: it just quietly
returns "unclear" forever with no way to diagnose it from logs. The
`ValidationError` case is the most costly to lose: it's precisely the signal
this module's case-normalization layer exists to protect against (new forms of
Claude schema drift), and none of that detail is ever recorded.
**Fix:**
```python
except APIError as exc:
    _record_outcome(False)
    logger.warning("Claude call failed for /agent; degrading to unavailable reply: %s", exc)
    return None, False
except ValidationError as exc:
    logger.warning("Claude response failed schema validation; degrading to unclear reply: %s", exc)
    return None, True
...
except Exception:
    logger.exception("Unexpected error interpreting /agent input; degrading to unclear reply")
    return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
```
(Neither user transcript text nor the API key needs to be included — only the
exception's own type/message/traceback, which is safe to log per SEC-02/T-04-04.)

### WR-05: `speak()` doesn't check tab visibility before starting playback

**File:** `frontend/src/store/speech.ts:107-129`
**Issue:** Background-tab protection is implemented reactively, in
`useVoiceCommand.ts`'s `visibilitychange` handler (`cancelForBackground()` on
`document.hidden`). `speak()` itself has no such guard:
```ts
speak: (text) => {
    if (!get().enabled || text.trim() === "") return;
    if (!isSpeechSynthesisSupported()) return;
    const mySeq = ++seq;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    ...
    window.speechSynthesis.speak(utter);
},
```
If an `/agent` reply resolves *while the tab is already backgrounded* (i.e.
after the one-shot `visibilitychange` cancellation already fired and nothing
re-fires it), `speak()` will still queue and start audio in the hidden tab —
`CommandBar.onApplied`/`useVoiceCommand.handleSuccess` call `speak()`
unconditionally on every "applied" reply, with no visibility check anywhere on
that path either.
**Fix:**
```ts
speak: (text) => {
    if (!get().enabled || text.trim() === "") return;
    if (!isSpeechSynthesisSupported()) return;
    if (typeof document !== "undefined" && document.hidden) return; // never start audio in a backgrounded tab
    ...
},
```

### WR-06: Mute/unmute and overlay-toggle confirmations don't describe the action that was taken

**File:** `frontend/src/lib/agent.ts:120-151`, `backend/app/agent/service.py:210-223`
**Issue:** `_apply_toggle_speech`/`_apply_toggle_dataset` both intentionally
return `message=""` (documented: "the frontend composes the confirmation, the
server never authors it"), relying on `composeConfirmation()` for the
on-screen/spoken echo. But `composeConfirmation()`'s signature and template
only ever describe the chart/date/am-pm/category view:
```ts
export function composeConfirmation(
  state: { activeChart: ChartId; datePreset: DatePreset; customRange: ...; amPm: ...; bpCategory: ... },
  _latestReading: string | null,
): string { ... "Showing {chartPhrase}, {rangePhrase}{ampmSuffix}{categorySuffix}" ... }
```
It has no awareness of `speechEnabled`/`overlayDataset`/`overlayState`. So a
user who says "mute the voice replies" or "turn on voice replies" — or "show
incidents" — gets back a confirmation that just re-describes the current,
*unrelated* dashboard view (e.g. "Showing blood pressure, all data"), never
anything acknowledging the toggle itself. For "unmute" this message is also the
one that gets spoken aloud (`speak()` runs after `setEnabled(true)`), so a
voice-only user turning speech back on hears an unrelated view description
instead of confirmation that the unmute worked. This directly touches this
project's stated core value ("every feature must be operable by voice") since
there is no audible/legible confirmation of the toggle action itself.
**Fix:** Either compose a dedicated message server-side for these two command
kinds (e.g. `message="Voice replies are now off."` / `"Now showing incidents."`)
instead of `""`, or extend `composeConfirmation`/its caller to special-case
`reply.filters.speechEnabled` and `overlayDataset`/`overlayState` deltas.

## Info

### IN-01: Dead fatal-error branch inside `onend`

**File:** `frontend/src/hooks/useVoiceCommand.ts:224-233`
**Issue:**
```ts
rec.onend = () => {
    if (!armedRef.current) return; // caregiver tapped stop → stay off (D-13)
    if (speakingRef.current) return; // TTS owns the resume — suppress the natural restart loop (Pitfall 4)
    if (lastErrorFatalRef.current) {
      enterPaused();
      return;
    }
    ...
};
```
`lastErrorFatalRef.current` is only ever set `true` inside `rec.onerror`'s
fatal branch, and that same branch always calls `enterPaused()` immediately,
which sets `armedRef.current = false`. Since `armedRef.current` and
`lastErrorFatalRef.current` are only ever reset together (in `start()`) and only
ever both flipped together (in `enterPaused()`), by the time `onend` runs the
`!armedRef.current` guard at the top of the function will already have returned
for any case where `lastErrorFatalRef.current` is `true` — the
`if (lastErrorFatalRef.current)` branch inside `onend` can never actually
execute. Confirmed correct behavior is unaffected (the state still reaches
`"paused"` via `onerror`), so this is dead code rather than a functional bug.
**Fix:** Remove the unreachable branch, or add a comment clarifying it exists
only as defense against a hypothetical browser that fires `onend` without
`onerror` having completed first (if that's the real intent, verify it against
`classifyError`'s contract).

### IN-02: `AgentReply.message` and `ClarifyContext.question` use inconsistently-stripped values for the same clarify response

**File:** `backend/app/agent/service.py:264-274`
**Issue:**
```python
if isinstance(result, Clarification):
    question = result.question.strip()
    original = context.original_text if context is not None else text
    return AgentReply(
        kind="clarify",
        message=question,  # STRIPPED
        context=ClarifyContext(original_text=original, question=result.question),  # UNSTRIPPED
    )
```
`message` (shown to the user) is the stripped question, but the same logical
value stored in `context.question` (round-tripped verbatim to Claude as an
`assistant`-role message on the follow-up turn, per `build_messages`) keeps any
leading/trailing whitespace Claude produced. Low practical impact, but it's an
unnecessary inconsistency between two representations of the same value in one
response payload.
**Fix:**
```python
question = result.question.strip()
original = context.original_text if context is not None else text
return AgentReply(
    kind="clarify",
    message=question,
    context=ClarifyContext(original_text=original, question=question),
)
```

---

_Reviewed: 2026-08-25T20:25:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
