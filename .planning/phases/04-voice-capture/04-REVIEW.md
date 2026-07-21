---
phase: 04-voice-capture
reviewed: 2026-07-21T18:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - frontend/src/lib/voice.ts
  - frontend/src/lib/voice.test.ts
  - frontend/src/lib/agent-parity.test.ts
  - frontend/src/tests/fakeRecognition.ts
  - frontend/src/types/speech.d.ts
  - frontend/src/hooks/useVoiceCommand.ts
  - frontend/src/hooks/useVoiceCommand.test.ts
  - frontend/src/components/CommandBar.tsx
  - frontend/src/components/CommandBar.test.tsx
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: resolved
resolution:
  fixed: [CR-01, WR-01, WR-02]
  deferred_info: [IN-01, IN-02, IN-03]
  fix_commits: [3d847a0, e3a40fd, 2a046c8]
  note: "All Critical/Warning findings fixed with regression tests (144 tests green, tsc clean). Info findings left as documented follow-ups."
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-21T18:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 4 voice-capture layer: the pure helpers (`lib/voice.ts`), the recognizer-lifecycle hook (`useVoiceCommand.ts`), and the `CommandBar` UI, plus their tests and the `FakeRecognition`/ambient-types scaffolding. The security posture on the render path is genuinely good — raw recognizer error strings and transcripts are never rendered or logged, only fixed friendly copy reaches the DOM, and store mutation is confined to `applyAgentFilters` behind a seq guard. Accessibility is largely honored (≥48px targets, color+word+icon triads, `motion-safe:` with static fallbacks).

However, the two highest-risk surfaces the scope flagged — the visibility guard and the newest-wins seq guard around the session lifecycle — both leak. One is a privacy defect that contradicts the code's own stated invariant ("never listen in the background") and CLAUDE.md's non-negotiable privacy constraint; the other lets a late reply mutate the store and resurrect the UI after the user has explicitly stopped. The wake-word gate also matches on substrings, undermining the first trust boundary that keeps room speech off the network.

## Critical Issues

### CR-01: Active recognizer is not aborted when the tab is hidden — audio keeps streaming in the background

**File:** `frontend/src/hooks/useVoiceCommand.ts:241-264` (handler at 242-255)
**Issue:** The `onVisibility` handler's hidden branch only calls `clearRestartTimer()` and returns. It never stops the *currently running* recognizer. The `onend`/`scheduleRestart` guards only prevent *future restarts* while hidden — they do nothing to an in-progress session. On desktop Chrome/Edge the recognizer is constructed with `continuous = supportsContinuous()` (true off-iOS) and does **not** auto-stop on silence, so hiding the tab (switching tabs/apps) leaves the microphone hot and audio flowing to the browser's speech backend indefinitely, with the app's visible `LISTENING` indicator no longer on screen. This directly contradicts the file's own comments ("Pitfall 2: never listen in the background", "no background listening", threat T-04-05) and CLAUDE.md's non-negotiable privacy constraint for sensitive health data. The existing test at lines 247-264 only covers the case where `onend` has *already* fired while hidden — it never exercises an actively-listening recognizer at hide time, so CI is green while the leak is live.
**Fix:** Abort the recognizer when the tab hides; the foreground branch already resumes via `start()`, and `onend` won't restart while hidden.
```ts
function onVisibility() {
  const hidden = typeof document !== "undefined" && document.hidden;
  if (hidden) {
    clearRestartTimer();
    recRef.current?.abort(); // stop the live session — do not listen in the background
    return;
  }
  if (armedRef.current && !lastErrorFatalRef.current) {
    try {
      recRef.current?.start(); // foreground again → resume honestly
    } catch {
      /* InvalidStateError: already running → no-op */
    }
  }
}
```
Add a test that emits no `onend`, sets `document.hidden = true`, dispatches `visibilitychange`, and asserts `rec.abort` was called.

## Warnings

### WR-01: `stop()` (and `enterPaused()`) do not invalidate the in-flight seq — a late reply mutates the store and resurrects "listening" after an explicit stop

**File:** `frontend/src/hooks/useVoiceCommand.ts:124-155, 229-235, 99-104`
**Issue:** The newest-wins guard keys on `seqRef.current`, which is only bumped in `handleResult` on a final submit (line 171). Neither `stop()` nor `enterPaused()` bumps it. So if the caregiver taps stop (or a fatal error pauses the session) during the ~1s round-trip of a voice command that is in `"working"`, the in-flight `handleSuccess` still passes `capturedSeq === seqRef.current` and runs to completion: it calls `applyAgentFilters(...)` (mutating the filter store after the user stopped) and `setVoiceState("listening")` — flipping the bar back to the green LISTENING pulse even though `armedRef` is false and the recognizer has been `abort()`ed. The result is a zombie UI (shows LISTENING while nothing is listening) plus an unexpected filter change post-stop. No test covers stop/pause during the working window.
**Fix:** Treat stop/pause as a supersede event by advancing the seq so any outstanding reply is dropped before it touches the store or state:
```ts
function enterPaused() {
  armedRef.current = false;
  seqRef.current++;        // drop any in-flight reply (D-05)
  clearRestartTimer();
  setVoiceState("paused");
  setMessage(PAUSED_COPY);
}

function stop() {
  armedRef.current = false;
  seqRef.current++;        // drop any in-flight reply (D-05)
  clearRestartTimer();
  setVoiceState("off");
  setInterim("");
  recRef.current?.abort();
}
```

### WR-02: Wake-word gate matches substrings — "dashboards"/"the dashboard for…" leak room speech to the network

**File:** `frontend/src/lib/voice.ts:31-39`
**Issue:** `extractCommand` uses `lower.indexOf(WAKE_WORD)`, an unanchored substring match. Any final transcript merely *containing* the letters "dashboard" triggers a send: "dashboards are down" → strips to `"s are down"` and is dispatched to `/agent`; "did you see the dashboard for pulse" → `"for pulse"` is dispatched. This defeats the primary trust boundary the module documents (T-04-01: "the FIRST filter that keeps room speech off the network") and incurs unnecessary Claude API calls (cost / T-04-03). It also fires mid-sentence rather than only on an intentional wake word.
**Fix:** Require word boundaries around the trigger so "dashboards"/"dashboarding" no longer match, while still allowing the trailing comma/space strip:
```ts
export function extractCommand(transcript: string): string | null {
  const m = new RegExp(`\\b${WAKE_WORD}\\b`, "i").exec(transcript);
  if (m == null) return null; // untriggered → ignore (D-02)
  return transcript
    .slice(m.index + WAKE_WORD.length)
    .replace(/^[\s,.:;-]+/, "")
    .trim();
}
```
(If `WAKE_WORD` may later contain regex metacharacters, escape it first.)

## Info

### IN-01: An interim result arriving during "working" reverts the state machine to "triggered"

**File:** `frontend/src/hooks/useVoiceCommand.ts:157-181`
**Issue:** After a final result submits (`state = "working"`), the recognizer can still emit further interim results if the user keeps speaking. `handleResult` unconditionally routes any non-final wake-word result to `setInterim(...) / setVoiceState("triggered")`, flipping the bar out of the WORKING state (losing the spinner/word) while the request is still in flight. Harmless once the reply lands (it resets to `"listening"`), but causes a visible flicker.
**Fix:** Ignore interim results while a command is in flight, e.g. guard the interim branch with a `working`/pending flag, or only accept interims when `state !== "working"`.

### IN-02: Live interim transcript streams into `aria-live="polite"` — noisy for screen readers

**File:** `frontend/src/components/CommandBar.tsx:194-197, 283-302`
**Issue:** During `"triggered"`, every interim update rewrites `lineText` inside the single `aria-live="polite"` region, so a screen reader re-announces the partial transcript on each word. The primary user relies on assistive tech; word-by-word re-announcement of the streaming transcript is fatiguing.
**Fix:** Consider rendering the live interim in a region that is not announced (e.g. `aria-live="off"` for the streaming transcript) and reserve the polite live region for the settled confirmation/hint, or debounce announcements.

### IN-03: Verify contrast of `--cat-normal` used as 18px body text

**File:** `frontend/src/components/CommandBar.tsx:203, 286-288`
**Issue:** The armed hint and live transcript render green (`text-[var(--cat-normal)]`) as 18px text. Category greens are commonly tuned for fills/rings, not text, and may fall below the 4.5:1 contrast CLAUDE.md requires for high-contrast legibility "across a room." Token values weren't in scope to resolve here.
**Fix:** Confirm `--cat-normal` on the `--color-foam`/`--color-sky` background meets ≥4.5:1 as text; if not, use an ink/darker token for the text and keep green for the ring/icon only (the icon + word already carry meaning, so this does not break the color+word+icon triad).

---

_Reviewed: 2026-07-21T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
