# Phase 4: Voice Capture - Research

**Researched:** 2026-07-20
**Domain:** Browser Web Speech API (`webkitSpeechRecognition`) — continuous listening, wake-word gating, cross-browser (Chrome/Edge desktop + Safari/iOS) reliability, feeding the existing `/agent` pipeline
**Confidence:** MEDIUM-HIGH (implementation patterns HIGH; real-iOS behavior MEDIUM — must be device-verified, per STATE.md blocker)

## Summary

This phase adds a voice layer on top of a fully-built text pipeline. The entire command path — `postAgent` → `useAgent` → `applyAgentFilters` → `composeConfirmation` → zustand store — already exists, is unit-tested, and is reused **unchanged** (VOICE-08 was designed for exactly this). The only new surface is: capture speech via the browser's `SpeechRecognition`, gate it behind a wake word, stream a transcript into the existing `CommandBar`, and feed the captured command string into the existing mutation. No backend change, no new command vocabulary, no store redesign.

The single hard problem is **Safari/iOS reliability** (the project's documented #1 risk). iOS Safari ignores `continuous = true`, auto-stops on silence, and the community consensus is that a self-restarting `onend` loop is the only workable pattern — but it is fragile (page-background death, buffer clogging, restart thrash, permission re-prompts). Chrome desktop/Edge honor `continuous = true` but Chrome-on-Android beeps on every restart. This variability is why the phase needs its own hook with explicit lifecycle control rather than leaning on a wrapper's opaque restart abstraction.

**Primary recommendation:** Build a **~120–150 LOC custom hook over raw `webkitSpeechRecognition`** (a single long-lived recognizer instance + explicit `onend`/`onerror` restart loop with error classification and backoff), NOT `react-speech-recognition`. Rationale below (§Standard Stack). This keeps zero new runtime dependencies, sidesteps the `regeneratorRuntime`-under-Vite gotcha, gives full control over the exact behaviors the CONTEXT locks (invisible restart, wake-word gating with interim-after-trigger, word stripping, visibility guards), and — critically — makes the whole thing unit-testable by injecting a fake `SpeechRecognition` global. Protect the store with an explicit **monotonic request-sequence guard** (D-05 newest-wins), not TanStack's internal state. Prove VOICE-05/ACC-03 with an **enumeration parity test** that asserts every mutating action on the zustand filter store is reachable through the `/agent` command schema.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOICE-01 | Mic capture via Web Speech API on Chrome/Edge + Safari/iOS (webkit-prefixed, restart-loop handling) | §Architecture Pattern 1 (recognizer lifecycle), Pattern 2 (onend restart loop + error classification), §Common Pitfalls 1–5 |
| VOICE-02 | Continuous session — one caregiver tap, then hands-free multi-command | §Pattern 1 (single tap satisfies user-gesture; programmatic restarts survive), §Pitfall 6 (user-gesture requirement) |
| VOICE-03 | Unmissable listening/processing/stopped indicator | §Pattern 4 (command-bar-as-indicator, color+word+icon, reduced-motion), reuses Phase 2 `motion-safe` + tokens |
| VOICE-04 | Live transcript while listening | §Pattern 3 (interim vs final; transcript shown only post-trigger, word stripped) |
| VOICE-05 | Voice can switch charts + apply any UI filter; schema/UI in lockstep | §Don't Hand-Roll (reuse `/agent` schema), §Validation Architecture (parity/enumeration test) |
| ACC-03 | Every primary action operable by voice | Same parity test as VOICE-05 — proves no filter is voice-unreachable |
</phase_requirements>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Caregiver taps mic once to open the session (satisfies Web Speech user-gesture requirement); Chris then issues many commands hands-free until caregiver taps again to stop.
- **D-02:** Trigger-word gated. Only speech beginning with the trigger word is a command; room chatter without the word is ignored and never mutates the dashboard. (Chosen over auto-submit-on-pause for robustness in a shared home.)
- **D-03:** A speech pause ends the command. Everything from trigger word to the next pause (final result) is the command; the trigger word is stripped before sending to `/agent`.
- **D-04:** Trigger word is a single named constant (`WAKE_WORD`, default `"dashboard"`), changeable in one place. Final word choice deferred to real-device testing (single-word false-trigger rate is a known unknown).
- **D-05:** Newest command wins. A new triggered command arriving mid-round-trip cancels the in-flight one; **a stale-response guard must ensure a cancelled command never applies late to the filter store** (the store is the single mutation surface).
- **D-06:** The whole command bar transforms to signal state — one element is input + transcript + state + confirmation. No separate banner/orb.
- **D-07:** Three states encoded by color + word + icon/motion together (never color alone): 🟢 pulse LISTENING / 🟠 spinner WORKING… / ⚪ mic TAP TO SPEAK. Legible across the room.
- **D-08:** Visual only — no audio cues.
- **D-09:** Pulse/spinner animations honor `prefers-reduced-motion` with a static fallback.
- **D-10:** Transcript shows only after the trigger fires. Armed-but-untriggered shows a hint: `LISTENING — say "dashboard…"`. Once triggered, interim streams live (command only, word stripped), then pause submits.
- **D-11:** Bar lifecycle: armed hint → streaming interim (green) → WORKING (amber, spinner) → confirmation text replaces the transcript in the same spot.
- **D-12:** Invisible auto-restart. On `onend`/recoverable errors the recognizer restarts under the hood, indicator stays LISTENING. **Research must classify recoverable vs fatal errors and apply backoff.**
- **D-13:** Explicit stop only — no inactivity timeout. Session runs until caregiver taps mic to stop.
- **D-14:** Hard-failure fallback: on unrecoverable failure the bar shows `⚪ Voice paused — tap to resume` and the text input box stays fully usable (VOICE-08 fallback).
- **D-15:** No new command vocabulary. Voice feeds the exact same `/agent` structured-outputs schema. Phase must include a lockstep check that every filter reachable in the manual UI is reachable by command.

### Claude's Discretion
- Exact mic-button placement/size within the command bar (subject to ≥48px + accessibility), first-run permission-prompt copy, and the precise pause-duration threshold for end-of-command — implementation details for the planner, informed by research.

### Deferred Ideas (OUT OF SCOPE)
- Voice replies (SpeechSynthesis) — post-MVP.
- Voice data entry ("log a reading") — post-MVP.
- Relative/stateful command adjustments ("zoom out", "go back further") — carried from Phase 3.
- Audio cues (chime on trigger, error tone) — declined for v1 (D-08).
- Long inactivity timeout — declined (D-13, explicit-stop-only).

## Project Constraints (from CLAUDE.md)

- **Fixed constraint is the Web Speech API, not the wrapper library.** react-speech-recognition is a lean and the raw-`webkitSpeechRecognition` custom hook is an explicitly sanctioned escape hatch. `browserSupportsContinuousListening` capability check is called out.
- **Compatibility mandatory:** voice must work on Chrome/Edge AND Safari/iOS (webkit-prefixed). Chris's primary device is undecided.
- **Accessibility non-negotiable:** ≥48px targets, ≥18px body text, high contrast, keyboard navigable fallback, no drag/hover-only/precise-pointing. No color-only signaling.
- **`prefers-reduced-motion`** must be honored (Phase 2 convention: `motion-safe:` utilities + static fallback).
- **Two-theme design tokens** — indicator colors/motion must use existing CSS-var tokens, not hard-coded colors.
- **All Claude calls go through the backend `/agent`** — voice never touches Anthropic directly (already satisfied: voice reuses `postAgent`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mic capture / recognition | Browser (Web Speech API) | — | `webkitSpeechRecognition` is a browser-native API; no server involvement |
| Recognizer lifecycle (start/stop/restart/backoff) | Browser (custom hook) | — | Continuous-session state is pure client concern; nothing to persist |
| Wake-word gating + word stripping | Browser (custom hook) | — | Filtering room speech before it ever becomes a command is client-side; keeps non-commands off the network entirely |
| Intent parsing (command string → filter delta) | API/Backend (`/agent`) | — | Already built Phase 3; Claude call must stay server-side (key security); voice supplies only a string |
| Newest-wins concurrency / stale-response guard | Browser (custom hook / call site) | — | Guards the client-side store mutation boundary; TanStack state is per-observer client state |
| Store mutation (`applyAgentFilters`) | Browser (zustand, single surface) | — | Established: store is the sole mutation surface; voice must route through it, never mutate charts directly |
| State indicator + transcript UI | Browser (React / CommandBar) | — | Pure presentation on the existing bar |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser `SpeechRecognition` / `webkitSpeechRecognition` | Native | Speech capture + interim/final transcription | The fixed project constraint (CLAUDE.md); no install; webkit-prefixed on Safari/Chrome |
| Custom `useVoiceCommand` hook | ~120–150 LOC new code | Recognizer lifecycle, wake-word gating, restart loop, seq guard | **Recommended over a wrapper** — see decision below |
| (reused, already installed) `@tanstack/react-query` `^5.101.2` | 5.x | Mutation over `postAgent` (unchanged) | Voice calls the same `useAgent().mutate` |
| (reused) `zustand` `^5.0.14` | 5.x | Filter store — the single mutation surface | `applyAgentFilters` reused verbatim |

### The one real decision: custom hook vs `react-speech-recognition@4.0.1`

**Recommendation: custom hook over raw `webkitSpeechRecognition`. Confidence: MEDIUM-HIGH.**

`react-speech-recognition@4.0.1` `[VERIFIED: npm registry — v4.0.1, published 2025-04-29, only runtime dep lodash.debounce, peerDep react>=16.8]`. It provides `transcript`/`interimTranscript`/`finalTranscript`, `listening`, `resetTranscript`, `browserSupportsSpeechRecognition`, `browserSupportsContinuousListening`, `isMicrophoneAvailable`, webkit-prefix handling, and a `commands` array with wake-word/`matchInterim` support. `[CITED: github.com/JamesBrill/react-speech-recognition]`

Why the custom hook wins **for this phase's exact locked needs**:

1. **The hard part is the restart loop, and the wrapper doesn't own it the way you need.** D-12 requires *invisible* auto-restart with **error classification** (recoverable vs fatal) and **backoff** to avoid Chrome-Android beep thrash and tight `no-speech` loops. The library exposes `browserSupportsContinuousListening` but its README does not detail Safari auto-stop/restart, and layering your own backoff + visibility guards + priming on top means fighting its internal state machine. `[CITED: github.com/JamesBrill/react-speech-recognition README — no Safari restart detail]`
2. **`regeneratorRuntime` gotcha avoided entirely.** The library's documented Vite/webpack troubleshooting (`npm i regenerator-runtime`, import in entry) is a known friction point. A hand-written hook uses native async and never hits it. `[CITED: library README troubleshooting section]`
3. **Wake-word gating with interim-after-trigger + word stripping (D-02/D-03/D-10) is bespoke.** The library's `commands` API fires callbacks on match — but the CONTEXT wants: ignore everything until the wake word appears, then **stream the interim transcript (word stripped)** into the bar, then submit on the final result. That is transcript-parsing logic you write regardless of the wrapper; owning the recognizer directly is simpler than adapting `commands`/`matchInterim`.
4. **Testability.** `SpeechRecognition` does not exist in jsdom. A custom hook lets you inject `window.SpeechRecognition = FakeRecognition` and synthetically fire `onresult`/`onend`/`onerror` to unit-test gating, stripping, restart, backoff, and the seq guard (see §Validation Architecture). Testing through the library adds an opaque layer.
5. **Zero new runtime dependency** — aligns with CLAUDE.md ("the fixed constraint is Web Speech API, not the wrapper") and keeps the dependency surface minimal.

**When the wrapper would be better:** if the team wanted the fastest possible spike with no custom lifecycle needs, or wanted the built-in Azure polyfill for Firefox. Neither applies — Firefox is explicitly a text-input-fallback case (VOICE-08), not a voice target.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useVoiceCommand` hook | `react-speech-recognition@4.0.1` | Faster to start, gives capability flags for free; but you still hand-write wake-word/strip/backoff logic, fight its restart abstraction on Safari, inherit the `regeneratorRuntime` gotcha, and lose easy mockability. Keep as a **documented reference/fallback** if the raw recognizer fights real iOS. |
| Web Speech API | Cloud STT (Whisper, Azure, Deepgram) | Higher accuracy + true continuous, but violates the fixed-stack constraint, adds cost/latency/privacy exposure for sensitive health context, and needs server audio streaming. Out of scope. |

**Installation:** None required for the recommended path (native browser API + reuse of installed deps). If the wrapper fallback is chosen: `npm install react-speech-recognition@4.0.1` (and possibly `regenerator-runtime@0.14.1` imported once in `main.tsx`).

## Package Legitimacy Audit

> slopcheck could not be installed in this environment ("slopcheck unavailable"). Per the graceful-degradation protocol, the one optional package below is tagged `[ASSUMED]` and — if the wrapper fallback path is taken — the planner should gate its install behind a `checkpoint:human-verify` task. The **recommended path installs nothing**, so this audit is informational only.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-speech-recognition | npm | published 2025-04-29 (v4.0.1) | ~200k/week (199,967 last week) `[VERIFIED: api.npmjs.org]` | github.com/JamesBrill/react-speech-recognition | unavailable → `[ASSUMED]` | Optional/fallback only — not installed on recommended path. No `postinstall` script (verified empty). |
| regenerator-runtime | npm | v0.14.1 | very high | github.com/facebook/regenerator | unavailable → `[ASSUMED]` | Only if wrapper path hits the `regeneratorRuntime` error; not needed on recommended path |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Recommended path net new packages:** **zero.**

## Architecture Patterns

### System Architecture Diagram

```
 Caregiver TAP (user gesture, D-01)
        │
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │  useVoiceCommand hook (browser, new)                      │
 │                                                           │
 │  recognizer = new webkitSpeechRecognition()  (singleton)  │
 │    .continuous = supportsContinuous (true desktop Chrome) │
 │    .interimResults = true                                 │
 │    .lang = "en-US"                                        │
 │                                                           │
 │  onresult ──► accumulate interim+final                    │
 │      │                                                    │
 │      ▼                                                    │
 │  WAKE-WORD GATE (D-02):                                   │
 │    text starts with WAKE_WORD?  ── no ──► ignore (room    │
 │      │ yes                                   speech)      │
 │      ▼                                                    │
 │    strip WAKE_WORD (D-03) ──► interim → bar transcript    │
 │      │                          (green, D-10)             │
 │      ▼ (final result = pause, D-03)                       │
 │    captured command string                                │
 │      │                                                    │
 │      ▼                                                    │
 │    seq = ++currentSeq   (D-05 newest-wins stamp)          │
 │                                                           │
 │  onend / onerror(recoverable) ──► BACKOFF ──► start()     │
 │      (D-12 invisible restart, indicator stays LISTENING)  │
 │  onerror(fatal) ──► stop, indicator = "Voice paused" (D-14)│
 └───────────────────────────┬───────────────────────────────┘
                             │ command string + seq
                             ▼
        useAgent().mutate({ text, context })   (REUSED unchanged)
                             │
                             ▼  onSuccess(reply)
             ┌───────────────────────────────┐
             │  STALE-RESPONSE GUARD (D-05):  │
             │  seq === currentSeq ? ── no ──►│ DROP (never touch store)
             │      │ yes                      │
             └──────┼────────────────────────┘
                    ▼
        applyAgentFilters(reply.filters)   →  zustand store (single surface)
        composeConfirmation(...)           →  bar confirmation text (D-11)
                    │
                    ▼
        CommandBar re-renders: charts switch, confirmation replaces transcript
```

The primary use case (Chris says "dashboard, show blood pressure last 30 days" → charts switch) traces top-to-bottom by following the arrows.

### Recommended Structure

```
frontend/src/
├── hooks/
│   ├── useAgent.ts               # EXISTING — reused unchanged
│   └── useVoiceCommand.ts        # NEW — recognizer lifecycle + gating + seq guard
├── lib/
│   ├── agent.ts                  # EXISTING — applyAgentFilters/composeConfirmation reused
│   ├── voice.ts                  # NEW — pure helpers: WAKE_WORD const, stripWakeWord(),
│   │                             #        classifyError(), isIOS(), backoff schedule
│   └── voice.test.ts             # NEW — unit tests for the pure helpers
├── components/
│   ├── CommandBar.tsx            # EXTENDED — mic button + voice state on the same bar
│   └── VoiceIndicator*.tsx       # NEW (or inline) — color+word+icon state (D-07)
└── store/filters.ts              # EXISTING — the parity target for VOICE-05/ACC-03
```

Keep the **wake-word constant, stripping, error classification, iOS detection, and backoff schedule as pure functions in `lib/voice.ts`** so they are unit-tested without a DOM. The hook orchestrates; the pure functions do the logic.

### Pattern 1: Single long-lived recognizer, started by the caregiver tap

```typescript
// Source: composed from CLAUDE.md §2 + lilting.ch iOS tips + MDN SpeechRecognition
// One instance created once (singleton) — prevents the iOS system chime on
// every re-create, and keeps handlers stable. [CITED: lilting.ch/en/articles/ios-webspeech-api-tips]
const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
const rec = new Ctor();
rec.continuous = supportsContinuous;   // true on desktop Chrome/Edge; iOS ignores it
rec.interimResults = true;             // needed for live transcript (D-10)
rec.lang = "en-US";
// The caregiver's tap is the user gesture (D-01). rec.start() must be called
// synchronously in the tap handler the FIRST time; programmatic restarts within
// the same session generally work without a fresh gesture. [ASSUMED — verify on iOS]
```

### Pattern 2: The restart loop with error classification + backoff (the #1 risk)

```typescript
// Recoverable vs fatal classification. [CITED: MDN SpeechRecognitionErrorEvent;
// community consensus from webreflection/lilting]. Verify exact iOS behavior on device.
function classifyError(e: string): "recoverable" | "fatal" {
  switch (e) {
    case "no-speech":          // silence timeout — the COMMON iOS/desktop case
    case "aborted":            // often self-induced by our stop()/restart churn
    case "network":            // transient connectivity blip
      return "recoverable";
    case "not-allowed":        // permission denied/revoked — needs a new user gesture
    case "service-not-allowed":
    case "audio-capture":      // no mic hardware
    case "language-not-supported":
    case "bad-grammar":
      return "fatal";
    default:
      return "recoverable";    // be lenient; a stuck loop is caught by the backoff cap
  }
}

// onend fires on EVERY stop, including iOS silence auto-stop. If the session is
// still armed and the last error wasn't fatal, restart after a backoff. (D-12)
rec.onend = () => {
  if (!armed) return;                 // caregiver tapped stop → let it end (D-13)
  if (lastErrorFatal) { enterPaused(); return; }   // D-14 fallback
  const delay = backoff();            // e.g. 200ms base, grow on rapid repeats, cap ~2s
  restartTimer = setTimeout(() => { try { rec.start(); } catch { /* InvalidState: already running */ } }, delay);
};
```

- **Backoff:** base ~200ms `[CITED: lilting.ch — 200ms restart delay]`; increase (e.g. exponential to a ~1.5–2s cap) if `onend` fires again within a short window without any speech, to prevent tight `no-speech` loops and to space out the Chrome-Android restart beep. Reset the backoff to base after a successful final result.
- **Restart-loop exhaustion** (e.g. N restarts in T seconds with zero results, or repeated fatal-adjacent errors) → treat as unrecoverable → D-14 paused state.
- **`start()` throws `InvalidStateError`** if the recognizer is already running — always wrap `start()` in try/catch and treat "already started" as a no-op. `[CITED: MDN — start() InvalidStateError]`

### Pattern 3: Wake-word gating with interim streaming + stripping

```typescript
// Source: derived from CONTEXT D-02/D-03/D-10 + react-speech-recognition matchInterim concept
export const WAKE_WORD = "dashboard";  // D-04 single named constant

// Match the wake word on the (lower-cased, punctuation-tolerant) transcript.
// Only after it appears do we start streaming/capturing. Everything before is
// room speech and is dropped (D-02). Strip the word before send (D-03).
function extractCommand(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  const idx = lower.indexOf(WAKE_WORD);
  if (idx === -1) return null;                       // untriggered → ignore
  return transcript.slice(idx + WAKE_WORD.length)
                   .replace(/^[\s,.:;-]+/, "")        // strip trailing comma/space
                   .trim();
}
// interim results → show extractCommand(interim) in the bar, green (D-10).
// final result (pause) → submit extractCommand(final) if non-empty (D-03).
```

- **Single-word false-trigger rate is a genuine unknown** (D-04) — `"dashboard"` is a reasonable default (low collision with casual speech, distinct phonemes). Consider matching on the *final* result for submission but allowing interim for the live display, to reduce mis-fires from partial homophones. Final word choice is a UAT decision.

### Pattern 4: The command bar AS the state indicator (D-06/D-07/D-09)

The existing `CommandBar` already has a `Status` state machine (`idle`/`working`/`confirmed`/`clarify`/`error`) with an `aria-live="polite"` region and a working spinner. Extend it — do not add a second component:

```tsx
// Reuse Phase 2 convention: motion-safe utilities + static fallback (FilterBar D-08 precedent).
// Never color-alone: each state pairs a COLOR + WORD + ICON (D-07).
//  armed:      🟢 ring + "LISTENING — say \"dashboard…\""   + motion-safe:animate-pulse
//  triggered:  🟢 + live interim transcript (green)
//  working:    🟠 ring + "WORKING…"                          + motion-safe:animate-spin
//  paused:     ⚪ + "Voice paused — tap to resume"            (static, D-14)
// Under prefers-reduced-motion the pulse/spin collapse to a solid ring / static glyph (D-09).
```

Use the existing CSS-var tokens (`--color-accent`, etc.), the ≥48px / ≥18px accessibility budget, and route confirmation through the existing `aria-live` region so the transcript→WORKING→confirmation transitions announce correctly.

### Anti-Patterns to Avoid

- **Re-creating the recognizer per listen** — triggers the iOS chime and drops state. Use a singleton. `[CITED: lilting.ch]`
- **Trusting `continuous = true` on iOS** — it is ignored; you MUST implement the `onend` restart loop. `[CITED: webreflection/medium, apple forums]`
- **Mutating charts/store directly from the voice hook** — everything must go through `applyAgentFilters` (established single-surface rule).
- **Relying on TanStack's internal "latest invocation" behavior for correctness** — implement an explicit seq guard (§Pitfall 7).
- **Rendering the transcript before the wake word fires** — violates D-10; also leaks room speech onto the screen.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Intent parsing (string → filter delta) | A local command parser / regex vocabulary | The existing `/agent` endpoint (Phase 3), reused unchanged | D-15: no new vocabulary; Claude + Pydantic already handle synonyms, dates, categories, refusals |
| Store mutation | Direct `useFilters.setState` from voice | `applyAgentFilters()` from `lib/agent.ts` | Single mutation surface; reset/carry-over semantics + D-08 pulse already correct |
| Confirmation text | Speaking model text back | `composeConfirmation()` (deterministic, POST-apply) | VOICE-06; never echo untrusted model text |
| Network call | New fetch/mutation for voice | `useAgent().mutate` over `postAgent` | VOICE-08 designed one code path; text + voice share it |
| Cross-browser prefix + capability check | Ad-hoc UA sniffing everywhere | `window.SpeechRecognition ?? window.webkitSpeechRecognition` once; feature-detect `continuous` support | Centralize in the hook |

**Key insight:** ~80% of "voice" in this phase is already built. The genuinely new code is a browser-recognizer lifecycle wrapper plus UI on the existing bar. Resist re-solving intent/mutation/confirmation.

## Common Pitfalls

### Pitfall 1: iOS Safari ignores `continuous` and auto-stops on silence
**What goes wrong:** After a few seconds of silence the recognizer stops; without a restart loop the session dies and Chris is stranded (he can't re-tap — D-13).
**Why:** iOS Web Speech has no real continuous mode; `continuous=true` is a no-op. `[CITED: webreflection/medium, apple forums, lilting]`
**How to avoid:** `onend` restart loop (Pattern 2), indicator stays LISTENING (D-12). **Must be verified on a real iPhone early in the phase** (STATE.md blocker).
**Warning signs:** Works in desktop Chrome, "stops after ~5s" only on iOS.

### Pitfall 2: Recognition dies when the page backgrounds / loses focus (iOS)
**What goes wrong:** Locking the screen or switching apps kills recognition; the restart loop then thrashes or errors.
**Why:** iOS suspends the audio session in background. `[CITED: lilting.ch — visibilitychange/focus guards]`
**How to avoid:** Add `visibilitychange`/`focus` listeners; pause the restart loop when hidden, resume (and show the paused-or-listening state honestly) when visible.

### Pitfall 3: Chrome-on-Android beeps on every mic restart
**What goes wrong:** If an Android device is the target, each `onend`→restart plays the OS mic chime — noisy, especially with a tight loop.
**Why:** OS-level, not controllable from the browser. `[CITED: react-speech-recognition README]`
**How to avoid:** Backoff to space restarts; on desktop Chrome prefer real `continuous=true` (no loop needed). Document as a known UX caveat if Android becomes primary.

### Pitfall 4: `regeneratorRuntime is not defined` under Vite (wrapper path only)
**What goes wrong:** `react-speech-recognition` can reference `regeneratorRuntime`, undefined in some Vite builds.
**How to avoid:** Recommended custom-hook path avoids it entirely. If using the wrapper: `npm i regenerator-runtime@0.14.1` and `import "regenerator-runtime/runtime"` once in `main.tsx`. `[CITED: library README]`

### Pitfall 5: `start()` throws `InvalidStateError` when already listening
**What goes wrong:** A restart timer fires while the recognizer is still running → uncaught exception → loop breaks.
**How to avoid:** Always `try/catch` around `start()`; treat the error as a no-op. Guard restarts with an `armed` + `isRunning` flag. `[CITED: MDN start()]`

### Pitfall 6: Losing the user-gesture requirement on restart
**What goes wrong:** Some browsers require a user gesture to start recognition; a purely programmatic restart *after* a fatal permission error won't work.
**Why:** Autoplay/permission policy.
**How to avoid:** Initial start is inside the tap handler (D-01). Within an open session, programmatic restarts generally succeed `[ASSUMED — verify on iOS]`. After a `not-allowed`/`service-not-allowed` fatal error, enter D-14 paused state that requires a fresh tap.

### Pitfall 7: A cancelled/stale command applies late to the store (D-05)
**What goes wrong:** Chris says two commands quickly; the first Claude round-trip resolves *after* the second and overwrites the store — the dashboard ends on the wrong view.
**Why:** `useAgent().mutate` fires per call; the mutate-level `onSuccess` for an earlier invocation can still resolve late. Do NOT rely on TanStack's "only returns latest invocation" observer state for correctness — that governs the hook's returned `data`, not which `onSuccess` callbacks run. `[CITED: TanStack Query v5 docs — mutation side effects / cancellation discussions #1551]`
**How to avoid:** **Explicit monotonic sequence guard.** Keep a module/ref counter; increment and capture on each voice dispatch; in `onSuccess`, compare captured vs current and **drop (return without calling `applyAgentFilters`)** if stale. Optionally also pass an `AbortSignal` into `postAgent`/`fetch` to actually cancel the in-flight request and save Claude cost (TanStack has "no built-in mutation cancel," so cancellation must be wired via `AbortController` in the mutation fn). The seq guard is the correctness mechanism; the AbortController is a cost optimization.
**Warning signs:** Flaky "wrong final view" only under rapid double commands — inherently a test case (see §Validation Architecture).

### Pitfall 8: Interim transcript is unstable / duplicated
**What goes wrong:** Interim results mutate wildly; on iOS the single result string grows unbounded.
**Why:** Interim results are provisional; iOS accumulates. `[CITED: webreflection/medium]`
**How to avoid:** Render interim only for display (D-10), always re-derive from `extractCommand(latest)`; submit only on the **final** result; `resetTranscript` equivalent after each submit.

## Code Examples

### Feature detection + capability check

```typescript
// Source: MDN + CLAUDE.md §2 (browserSupportsContinuousListening intent)
const SR = window.SpeechRecognition ?? (window as any).webkitSpeechRecognition;
const supported = !!SR;                       // Firefox → false → text-only (VOICE-08)
const isIOS = /iP(hone|ad|od)/.test(navigator.platform)
           || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
const supportsContinuous = !isIOS;            // desktop Chrome/Edge honor it; iOS does not
```

### Injecting a fake recognizer for tests (jsdom has none)

```typescript
// Source: standard vitest DOM-global injection pattern
class FakeRecognition {
  continuous = false; interimResults = false; lang = "";
  onresult: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  // helpers the test drives:
  emitResult(transcript: string, isFinal: boolean) {
    this.onresult?.({ results: [Object.assign([{ transcript }], { isFinal })], resultIndex: 0 });
  }
  emitError(error: string) { this.onerror?.({ error }); }
}
// beforeEach: (window as any).webkitSpeechRecognition = FakeRecognition;
```

This makes wake-word gating, stripping, restart-on-`onend`, backoff, error classification, and the seq guard fully unit-testable without a real mic.

## Runtime State Inventory

Not applicable — this is an additive greenfield feature phase (new hook + UI on an existing bar), not a rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry an old identifier that this phase changes. **None — verified by scope review of CONTEXT.md (all items are new code + reuse of unchanged Phase 3 primitives).**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `continuous=true` everywhere | Feature-detect; `onend` restart loop on iOS | Long-standing iOS gap | Must code the loop, not trust the flag |
| Prompt-and-parse voice commands | Server-side structured-outputs `/agent` (already built) | Phase 3 | Voice supplies a string only |
| react-speech-recognition as default | Native API + thin custom hook for full lifecycle control | This phase's assessment | Zero deps, testable, controls the restart loop |

**Deprecated/outdated:** Firefox has no usable `SpeechRecognition` → intentionally falls back to text input (VOICE-08), not a bug.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Programmatic `rec.start()` restarts within an open session succeed on iOS without a fresh user gesture (initial tap suffices) | Pattern 1/Pitfall 6 | HIGH — if false, the invisible-restart model (D-12) fails on iOS and the whole hands-free premise breaks; **primary device test** |
| A2 | `no-speech`, `aborted`, `network` are the recoverable errors; `not-allowed`/`service-not-allowed`/`audio-capture` are fatal | Pattern 2 | MEDIUM — misclassifying a fatal error as recoverable causes an infinite restart loop; caught by the backoff cap but degrades UX |
| A3 | `"dashboard"` has an acceptably low single-word false-trigger rate | Pattern 3 / D-04 | MEDIUM — high false-trigger rate means room speech mutates the dashboard; mitigated by the single-constant design (swap in one place) + UAT |
| A4 | ~200ms base / ~2s cap backoff avoids tight loops while feeling continuous | Pattern 2 | LOW — tunable at implementation; observable on device |
| A5 | iOS detection via platform/userAgent heuristic is reliable enough to pick `supportsContinuous` | Code Examples | LOW — worst case desktop uses the loop too (works, slightly noisier restart) |
| A6 | The mutate-level `onSuccess` of a superseded voice command can still fire late (hence the seq guard is required) | Pitfall 7 | LOW — if TanStack already suppressed it, the guard is merely redundant/harmless |

## Open Questions (RESOLVED)

*All three are dispositioned below; the plans implement each recommendation. Q1 is genuinely device-only and is routed to the blocking `checkpoint:human-verify` in 04-03 Task 3 (SC1/SC5) — "resolved" here means the planning disposition is settled, not that the device result is in.*

1. **Does the iOS restart loop actually survive a 10-minute session with long silences?** (SC5)
   - Known: iOS auto-stops on silence; the `onend` loop is the community-standard workaround.
   - Unclear: whether repeated restarts eventually hit a permission re-prompt, buffer clog, or background-suspend on a real device.
   - Recommendation: dedicate the **first plan of the phase** to a minimal on-device spike (tap → say a command → go silent 60s → say another) on a real iPhone before building the full UI. This is the STATE.md blocker made concrete.
   - **RESOLVED:** device-only, no CI substitute — routed to the blocking on-device checkpoint (04-03 Task 3) executing 04-IOS-TEST-CHECKLIST.md steps 2–3. The full restart loop is unit-covered in CI via `FakeRecognition` ahead of the device test.

2. **Final wake-word choice.**
   - Known: `"dashboard"` is a reasonable default; single named constant makes it swappable.
   - Unclear: real false-trigger rate in Chris's home.
   - Recommendation: ship `"dashboard"`, treat the constant as a UAT tuning knob.
   - **RESOLVED:** ship `WAKE_WORD = "dashboard"` as a single named constant (D-04), implemented in 04-01 (`lib/voice.ts`); false-trigger rate is a UAT tuning knob recorded at the device checkpoint.

3. **Pause-duration threshold for end-of-command.**
   - Known: the `final` result *is* the pause signal from the recognizer; no manual timer needed on most engines.
   - Unclear: whether iOS emits `isFinal` promptly or needs a supplementary silence timer.
   - Recommendation: rely on `isFinal` first; add a fallback silence timer only if device testing shows finals are slow.
   - **RESOLVED:** rely on `isFinal` (no manual silence timer) — reflected in 04-02/04-03; a fallback timer is added only if the device checkpoint shows finals are slow on iOS.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browser `webkitSpeechRecognition` | VOICE-01 capture | Runtime (browser) | native | Text input (VOICE-08) on Firefox/unsupported |
| Node 22 / Vite 8 / Vitest 4 toolchain | Build + tests | ✓ (from package.json) | vite ^8.1.1, vitest ^4.1.10 | — |
| jsdom | Unit tests | ✓ | ^29.1.1 | — |
| **A real iOS device (iPhone, current Safari)** | SC1/SC5 restart-loop + 10-min session verification | ✗ (not automatable) | — | **No fallback — manual human test required** |
| A real Android device (optional) | Chrome-Android beep UX check | ✗ | — | Document caveat only if Android becomes target |

**Missing dependencies with no fallback:**
- **Real iPhone for the restart-loop / 10-minute continuous-session criteria.** These CANNOT be validated in CI — the planner must include a `checkpoint:human-verify` on-device task (ideally early, as a de-risking spike). This is the phase's defining constraint.

**Missing dependencies with fallback:**
- Firefox voice → text input fallback (already built, VOICE-08).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16 + jsdom |
| Config file | `frontend/vite.config.ts` (`test:` block) + `frontend/src/tests/setup.ts` |
| Quick run command | `cd frontend && npx vitest run src/lib/voice.test.ts src/hooks/useVoiceCommand.test.ts` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | webkit prefix + capability detection returns a recognizer; unsupported → text fallback flag | unit (fake global) | `npx vitest run src/lib/voice.test.ts` | ❌ Wave 0 |
| VOICE-01 | `onend` while armed + recoverable error → `start()` called again after backoff | unit (fake recognizer) | `npx vitest run src/hooks/useVoiceCommand.test.ts -t restart` | ❌ Wave 0 |
| VOICE-01 | fatal error (`not-allowed`) → NO restart, enters paused state (D-14) | unit | `... -t fatal` | ❌ Wave 0 |
| VOICE-02 | one `startSession()` → recognizer starts once; stays armed across `onend` | unit | `... -t session` | ❌ Wave 0 |
| VOICE-02/SC5 | **10-min continuous session with silence** | **manual, real iOS** | human-verify checkpoint | N/A |
| VOICE-01/SC1 | **restart-on-onend verified on a real iPhone** | **manual, real iOS** | human-verify checkpoint | N/A |
| VOICE-03 | bar renders color+word+icon per state; static under `prefers-reduced-motion` | component (RTL) | `npx vitest run src/components/CommandBar.test.tsx -t indicator` | ⚠️ extend existing |
| VOICE-04 | interim result post-trigger → transcript shown, word stripped; untriggered → hidden | unit + component | `... -t transcript` | ❌ Wave 0 |
| D-02 | speech without wake word never calls `mutate` | unit (fake recognizer) | `... -t "wake word gate"` | ❌ Wave 0 |
| D-03 | final result submits stripped command; trigger word removed | unit | `src/lib/voice.test.ts -t strip` | ❌ Wave 0 |
| D-05 | superseded command's late `onSuccess` does NOT call `applyAgentFilters` (seq guard) | unit/component | `... -t "newest wins"` | ❌ Wave 0 |
| VOICE-05/ACC-03 | **every mutating filter-store action is reachable via `/agent` schema** (parity) | unit (enumeration) | `npx vitest run src/lib/agent-parity.test.ts` | ❌ Wave 0 |

### The VOICE-05 / ACC-03 lockstep parity test (how to prove it)

The zustand store (`store/filters.ts`) has exactly these mutating actions: `setActiveChart`, `setDatePreset`, `setCustomRange`, `setAmPm`, `setBpCategory`, `showAllData`. The `AppliedFilters` wire type (`api/types.ts`) has fields: `activeChart`, `datePreset`, `customRange`, `amPm`, `bpCategory`, `reset`. Prove reachability by asserting a **1:1 mapping** between them:

```typescript
// src/lib/agent-parity.test.ts — fails if a UI filter has no command path (ACC-03)
// or a command field has no store effect (dead vocabulary).
const STORE_ACTIONS = ["setActiveChart","setDatePreset","setCustomRange","setAmPm","setBpCategory","showAllData"] as const;
const APPLIED_FIELDS = ["activeChart","datePreset","customRange","amPm","bpCategory","reset"] as const;
// map each store action to the AppliedFilters field applyAgentFilters uses for it,
// and assert applyAgentFilters({<field>}) actually mutates the corresponding store slice.
it("every filter-store action is reachable through applyAgentFilters", () => {
  // e.g. applyAgentFilters({ activeChart: "pulse_trend" }) → store.activeChart === "pulse_trend"
  //      applyAgentFilters({ reset: true }) → showAllData() defaults
  // Enumerate ChartId, BPCategory, datePreset unions and assert each concrete value applies.
});
```

Extend it to enumerate the **full unions** (`ChartId` × 4, `BPCategory` × 6, `datePreset` × 4, `amPm` × 3) so adding a chart/category/preset in the future without a command path breaks the build. This is a compile-plus-runtime guardrail that keeps schema and UI in lockstep (D-15). Cross-check against the backend `ChartToken`/`BPCategoryToken` literals in `backend/app/agent/schemas.py` (they must stay verbatim-equal to the frontend unions).

### Sampling Rate

- **Per task commit:** `npx vitest run <touched test files>` (fast, targeted).
- **Per wave merge:** `cd frontend && npx vitest run` (full frontend suite green).
- **Phase gate:** full suite green + **manual real-iOS checkpoint passed** (restart loop + 10-min session) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `frontend/src/lib/voice.ts` + `voice.test.ts` — WAKE_WORD, `stripWakeWord`/`extractCommand`, `classifyError`, `isIOS`, backoff (covers VOICE-01, D-02, D-03)
- [ ] `frontend/src/hooks/useVoiceCommand.ts` + `useVoiceCommand.test.ts` — lifecycle, restart loop, seq guard, with the FakeRecognition harness (covers VOICE-01, VOICE-02, D-05, D-12)
- [ ] `frontend/src/lib/agent-parity.test.ts` — the VOICE-05/ACC-03 enumeration test
- [ ] Extend `frontend/src/components/CommandBar.test.tsx` — voice states, transcript, reduced-motion (VOICE-03, VOICE-04)
- [ ] Shared `FakeRecognition` test helper (place in `src/tests/` for reuse)
- [ ] Framework install: none — Vitest/jsdom/RTL already present.
- [ ] **Manual test script** (checklist doc) for the real-iOS checkpoint — not a code file but a required phase artifact.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (this phase) | Auth gate is Phase 5 (SEC-01); voice adds no auth surface |
| V3 Session Management | no | No new sessions/tokens introduced by voice |
| V4 Access Control | no | No new endpoints; reuses `/agent` |
| V5 Input Validation | **yes** | The transcript is **untrusted user input** → already bounded by `AgentRequest.text` (`min_length=1, max_length=500`) and parsed only via structured-outputs Pydantic on the backend. Voice must not bypass this: it sends a plain string to the same `postAgent`; never construct `AppliedFilters` client-side from raw speech. |
| V6 Cryptography | no | No crypto in this phase |
| V7 Error Handling / Logging | **yes** | VOICE-07 discipline already enforced in `CommandBar` (fixed friendly copy; raw `ApiError` never rendered). Voice errors (mic/permission/restart-exhausted) must render only the D-14 friendly copy, never raw error strings. |
| Privacy (project constraint) | **yes** | Audio is processed by the browser's speech service (Chrome sends audio to Google; iOS to Apple). This is inherent to the Web Speech API and unavoidable within the fixed stack. Health-command *text* still only reaches your own backend. No transcripts to third-party analytics (SEC-03). Do not log transcripts. |

### Known Threat Patterns for browser voice + reused `/agent`

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/garbage transcript injected as command | Tampering | Server-side Pydantic structured-outputs validation (built Phase 3); voice sends a string, never a pre-built filter delta |
| Prompt-injection via spoken text ("ignore instructions…") | Tampering / EoP | Model output is closed-union structured output; even a hostile transcript can only yield a valid `AgentOutput`; ranges clamped server-side. Descriptive-only agent (VOICE-09). |
| DoS / cost via rapid repeated commands | DoS | `text` length cap; existing 429 handling + friendly copy; backoff limits restart-driven request storms; seq guard prevents redundant applies |
| Leaking raw errors / transcripts to the UI or logs | Info Disclosure | VOICE-07 fixed copy (already enforced); do not console.log transcripts in production |
| Always-hot mic privacy | Info Disclosure | Explicit stop (D-13) + visible LISTENING indicator (D-07); no background listening beyond the session |

## Sources

### Primary (HIGH confidence)
- npm registry (2026-07-20) — `react-speech-recognition@4.0.1` published 2025-04-29, dep `lodash.debounce` only, peerDep react>=16.8, ~200k weekly downloads, no `postinstall` — verified via `npm view` / `api.npmjs.org`.
- Existing codebase (read directly): `CommandBar.tsx`, `useAgent.ts`, `lib/agent.ts`, `api/types.ts`, `api/client.ts`, `store/filters.ts`, `backend/app/agent/schemas.py`, `vite.config.ts`, existing test files — HIGH (ground truth for the reuse contract and parity test).
- MDN — `SpeechRecognition` / `SpeechRecognitionErrorEvent` error event + `start()` InvalidStateError — HIGH for API shape, MEDIUM for the full error-value list (page didn't enumerate all; classification cross-checked with community sources).

### Secondary (MEDIUM confidence)
- github.com/JamesBrill/react-speech-recognition README — `browserSupportsContinuousListening`, Chrome-Android beep, `regeneratorRuntime` troubleshooting, commands/`matchInterim` API.
- lilting.ch/en/articles/ios-webspeech-api-tips — iOS stabilization: singleton, mic warm-up, 200ms restart backoff, visibilitychange guards, priming.
- webreflection.medium.com "Taming the Web Speech API" — iOS single-growing-result behavior, continuous unreliability.
- TanStack Query v5 docs + discussions #1551/#8666 — no native mutation cancel; AbortController pattern; latest-invocation observer behavior.

### Tertiary (LOW confidence — flagged for device validation)
- Apple Developer Forums / discussions.apple.com threads on iOS 15/17 SpeechRecognition instability — corroborating anecdotes; exact current-iOS behavior must be device-tested (A1).

## Metadata

**Confidence breakdown:**
- Standard stack (custom hook vs wrapper): HIGH — decision is grounded in the exact locked needs + verified package facts.
- Reuse contract (agent pipeline, store, parity test): HIGH — read directly from the codebase.
- Architecture patterns (gating, restart loop, seq guard): MEDIUM-HIGH — patterns are well-established; exact backoff/error-classification tuning is device-dependent.
- iOS runtime behavior (A1, restart loop survival, 10-min session): MEDIUM — community-consistent but MUST be verified on a real iPhone (STATE.md blocker); no CI substitute.

**Research date:** 2026-07-20
**Valid until:** ~2026-08-20 for library/version facts; the iOS behavioral findings should be re-confirmed against whatever iOS version is on Chris's actual device at implementation time.
