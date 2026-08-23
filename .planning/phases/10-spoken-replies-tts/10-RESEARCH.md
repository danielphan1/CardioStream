# Phase 10: Spoken Replies (TTS) - Research

**Researched:** 2026-08-23
**Domain:** Web Speech Synthesis API (browser TTS), cross-store React state wiring, iOS Safari audio-unlock quirks
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The mute/quiet toggle voice command is a new action added to the Claude agent's structured-output schema (`AgentOutput` union in `backend/app/agent/schemas.py`), mirroring Phase 9's `ToggleDataset` shape exactly: explicit on/off state (`Literal["on", "off"]`), never a flip/toggle. This keeps `lib/voice.ts`'s documented trust boundary intact ("the server /agent Pydantic structured-outputs validation stays the sole authority" on command intent) and matches the accepted Phase 9 precedent: click works today via the header button; the voice path works once the Anthropic account has billing/credits (same accepted limitation as every other voice command, tracked in PROJECT.md/STATE.md as a known v1.0→v2 blocker, not something Phase 10 needs to solve). Do NOT implement a local/client-side keyword shortcut that bypasses `/agent` — that would be the first command in the app to break the "server is sole authority" invariant.
- Exact voice phrasing ("mute the voice replies" / "turn voice replies back on" / synonyms) is Claude's (the LLM's) job via the system prompt, same as Phase 9's "add incidents"/"show labs" synonym handling — no fixed keyword list to lock here.
- **D-02:** The toggle is a header-right button, in the same control zone as the existing theme toggle in `Header.tsx`, following its exact contract: icon + text label (never icon-only), `aria-pressed`, ≥48px target, inactive-control styling (bordered, not accent-fill).
- **D-03:** Persistence follows `store/theme.ts`'s pattern exactly: a new zustand store (e.g. `store/speech.ts`) with a `localStorage` key, guarded try/catch on both read and write so a blocked/unavailable localStorage degrades to session-only rather than breaking bootstrap. Single-user personal app — no server-side persistence needed.
- **D-04:** The existing `aria-live="polite"` confirmation region in `CommandBar.tsx` keeps firing unconditionally, regardless of the mute/quiet toggle. TTS is a strictly additive hands-free convenience layer on top of it, not a replacement — the mute toggle controls spoken audio only and must never suppress the visual/screen-reader-accessible confirmation text. Resolves the open product decision flagged in STATE.md Blockers ("does TTS coexist with aria-live").
- **D-05:** `CommandBar` gains a new visible "Speaking…" state (mirroring the existing "WORKING…" indicator's word + icon treatment, non-color-only) shown while an utterance is playing, so sighted users understand why the mic is paused. This is a new, distinct UI state — not a reuse of "WORKING…" (which means "waiting on the agent," a different wait than "currently talking").
- **D-06:** Manual clicks/keyboard filter changes never touch TTS playback — only a new `applied` voice/agent reply cancels-and-replaces an in-progress utterance (TTS-03, unchanged). A manual click mid-utterance lets the current speech finish; it does not silence it. One code path (the agent-reply handler) owns all speech start/cancel — the filter store is not a speech trigger source.

### Claude's Discretion

- Exact mute-toggle button label text/icon — **resolved by 10-UI-SPEC.md**: "Voice Replies: On"/"Voice Replies: Off", `Volume2`/`VolumeX` icons.
- Whether spoken text is exactly `composeConfirmation()`'s return value or the full visually-displayed message including any appended D-16 stats-bar-pointer text (`reply.message` when non-empty) — **this research recommends: speak the full visually-displayed `msg` string** (see Architecture Patterns, Pattern 1).
- Exact mic pause/resume mechanics around `SpeechSynthesisUtterance` start/end events (new `VoiceState` value vs. reusing an existing one) and the iOS gesture-unlock strategy — **this research resolves both** (see Architecture Patterns, Pattern 2 and 3).
- Backgrounding/tab-hide behavior for in-progress speech (cancel vs. let finish) — **this research recommends cancel**, diverging slightly from a pure mirror of `useVoiceCommand`'s hold-and-resume pattern, for a documented iOS-specific reason (see Common Pitfalls, Pitfall 6).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (TTS-06 adjustable rate/voice picker was already deferred to v2 by REQUIREMENTS.md before this discussion; not re-raised here.)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TTS-01 | Dashboard speaks the same confirmation text already shown visually (`composeConfirmation()` output) aloud via Web SpeechSynthesis, on applied voice/agent commands only — never new/different content, never triggered by manual click/keyboard filter changes | Architecture Pattern 1 (single trigger surface, exact text = the same `msg` string already rendered); Don't Hand-Roll row 1 |
| TTS-02 | Spoken replies are on by default; a prominent, persisted, voice-reachable mute/quiet toggle lets Chris or caregivers turn them off | `store/speech.ts` skeleton (Code Examples); backend `ToggleSpeech` schema (Code Examples); UI-SPEC already locks visuals |
| TTS-03 | Only one utterance ever plays at a time — cancel-before-speak, never overlapping or queued | Architecture Pattern 1's `speak()` action (unconditional `cancel()` + monotonic seq guard); Pitfall 2 |
| TTS-04 | The live voice-recognition session pauses while the dashboard is speaking and resumes after, so the mic never hears its own confirmation as a new command | Architecture Pattern 2 (mic pause/resume wiring); Pitfall 3, Pitfall 4 |
| TTS-05 | Spoken replies work on both Chrome/Edge and Safari/iOS, including iOS's gesture-unlock and backgrounding-cancel quirks — verified on a real device | Architecture Pattern 3 (gesture priming); Pitfall 1, 5, 6, 7; Validation Architecture (manual-only row) |

</phase_requirements>

## Summary

Phase 10 adds zero new npm packages. `window.speechSynthesis` / `SpeechSynthesisUtterance` is Baseline Widely Available (MDN, since September 2018) and the project already has an established, deliberate precedent for this exact situation: Phase 4 rejected the `react-speech-recognition` wrapper library listed in CLAUDE.md's stack table in favor of a hand-rolled ~280-line custom hook over the raw `webkitSpeechRecognition` API (`frontend/src/hooks/useVoiceCommand.ts`, `frontend/src/lib/voice.ts`), specifically because CLAUDE.md's real constraint is "Web Speech API," not a specific library. TTS should follow the identical pattern: a small store wrapping the raw Web Speech **Synthesis** API, no library.

The core technical risk is not the API surface (it's tiny: `speak()`, `cancel()`, a handful of utterance events) — it's three well-documented cross-browser quirks that interact with this project's existing recognizer lifecycle: (1) Safari does not reliably fire `onend` after `cancel()` (some implementations fire `onerror` instead, or nothing) — this project already has a proven fix pattern for exactly this class of bug (the monotonic `seqRef` "newest wins" guard already used in `useVoiceCommand.ts` for agent replies); (2) iOS Safari requires speech synthesis to be unlocked by a real user gesture once per page session, mirroring the same constraint the recognizer's `start()` already has to work around (D-01's existing "MUST run inside the caregiver tap" comment); (3) the mic-pause-during-speech mechanic must not disarm the recognizer's existing explicit-stop-only invariant (D-13), and — a genuinely new finding from this research — **must not accidentally start the mic for a caregiver who only ever uses the text box and never taps the mic button**, since the pause/resume effect is naturally keyed off `isSpeaking` transitions that fire for every applied reply, voice-triggered or not.

A separately notable finding: because the spoken confirmation is always a short, single sentence (REQUIREMENTS.md explicitly excludes TTS reading full tables/long lists), the well-documented Chrome-desktop "15-second speechSynthesis halt" bug and its `pause()`/`resume()` keepalive workaround are **not applicable to this phase** — building that defensive machinery would be scope creep for a use case that never approaches the 15-second threshold.

**Primary recommendation:** Build one new zustand store (`frontend/src/store/speech.ts`) combining the D-03 persisted mute toggle with an ephemeral `isSpeaking` + imperative `speak()` controller (mirroring `store/agentStatus.ts`'s "written from two entry points, read identically everywhere" shape), wrap the raw `SpeechSynthesisUtterance` API directly (no library), extend `useVoiceCommand.ts`'s existing recognizer-lifecycle refs with a `speakingRef` gated by `armedRef`, and add one new backend `ToggleSpeech` Pydantic model that is a byte-for-byte structural mirror of `ToggleDataset`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Speak the confirmation text aloud | Browser / Client | — | `window.speechSynthesis` is a browser-only API; no server involvement possible or needed |
| Decide *whether* to speak (mute state) | Browser / Client | — | Pure UI preference, persisted to `localStorage`; never touches the server (mirrors the theme toggle) |
| Decide *what* to speak (the confirmation text) | Browser / Client | API / Backend (indirectly) | The text is `composeConfirmation()`'s output, computed client-side from server-composed `AppliedFilters` — the backend never authors spoken (or visual) confirmation prose, per the existing `message=""` convention in `service.py` |
| Mute/unmute **voice command** intent classification | API / Backend | — | Mirrors every other voice command: the `/agent` Claude call is the sole authority on command intent (D-01); the client never locally pattern-matches "mute" as a keyword |
| Mic pause/resume during playback | Browser / Client | — | Lives entirely inside `useVoiceCommand.ts`'s existing recognizer-ref lifecycle; no new component or server surface |
| iOS gesture-unlock priming | Browser / Client | — | Must run synchronously inside an existing click handler (`onMicClick`/`onSubmit`); no backend involvement |

## Standard Stack

### Core

No new runtime dependencies. This phase uses only the browser-native Web Speech Synthesis API, already implicitly in scope under CLAUDE.md's fixed "Web Speech API" constraint (the same constraint that already governs the existing `useVoiceCommand.ts`/`voice.ts` recognition code).

| API | Support | Purpose | Why Standard |
|-----|---------|---------|--------------|
| `window.speechSynthesis` / `SpeechSynthesisUtterance` | Baseline Widely Available since September 2018 (MDN) [CITED: developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis] | Text-to-speech playback | Native browser API, zero bundle cost, matches the project's existing raw-API precedent for the recognizer half of Web Speech |

### Supporting

None. `lucide-react` (`Volume2`, `VolumeX`) is already an installed dependency (v1.24.0) — both icons verified present at that version:

```
frontend/node_modules/lucide-react/dist/esm/icons/volume-2.mjs
frontend/node_modules/lucide-react/dist/esm/icons/volume-x.mjs
```
[VERIFIED: local node_modules inspection, 2026-08-23]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `window.speechSynthesis` custom store (~60-90 LOC) | `react-speech-kit`, `use-speech-synthesis`, `react-text-to-speech`-style npm wrappers | These wrappers add a dependency for a ~5-method API surface this project already knows how to wrap (see `useVoiceCommand.ts` precedent for the recognition half); none of them solve the two genuinely hard problems here (iOS gesture-unlock timing, cross-store mic-pause wiring) — those are app-specific integration work no library does for you. Rejected for the same reason `react-speech-recognition` was rejected in Phase 4 despite being CLAUDE.md's nominal recommendation. |
| One combined `store/speech.ts` (toggle + playback controller) | Two separate stores (`store/speechPrefs.ts` persisted toggle + `store/speechPlayback.ts` ephemeral controller) | A single file is recommended: both concerns are read by the same two consumers (`CommandBar`, `useVoiceCommand`) and the `speak()` action needs to read `enabled` internally anyway to no-op when muted — splitting them buys no isolation benefit and adds an import for no reason. `store/agentStatus.ts`'s own docstring explicitly argues against "two independent stores OR'd together" for the same class of problem. |

**Installation:** None required — this phase adds zero `package.json` entries.

**Version verification:** N/A (no packages to verify against a registry). Backend: no new Python dependency either — `ToggleSpeech` is a plain Pydantic model added to an existing file, using the pattern already present.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Both the frontend (raw `window.speechSynthesis`) and backend (a new Pydantic model in an existing file) changes use only already-installed dependencies (`zustand`, `lucide-react`, `pydantic`). The Package Legitimacy Gate protocol is skipped by its own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
 ┌─────────────────────────────┐        ┌──────────────────────────────┐
 │   CommandBar.tsx (text path)│        │ useVoiceCommand.ts (voice path)│
 │   onSubmit → mutate(/agent) │        │  handleResult → mutate(/agent) │
 └──────────────┬──────────────┘        └───────────────┬────────────────┘
                │  onSuccess(reply)                      │  handleSuccess(reply, seq)
                ▼                                        ▼
        case reply.kind === "applied"            case reply.kind === "applied"
        applyAgentFilters(reply.filters)          applyAgentFilters(reply.filters)
        msg = composeConfirmation(...) + ptr      msg = composeConfirmation(...) + ptr
        setMessage(msg)  ─── (existing,           setMessage(msg)  ─── (existing,
          D-04 aria-live, unconditional)             D-04 aria-live, unconditional)
                │                                        │
                └──────────────┬─────────────────────────┘
                               ▼
                 useSpeech.getState().speak(msg)   ◄── NEW, single call added
                               │                        at BOTH call sites
                               ▼
        ┌───────────────────────────────────────────────────┐
        │  store/speech.ts — the ONE speech controller       │
        │  enabled? → no-op if muted (D-04 still fires above)│
        │  cancel() (always, TTS-03) → speak(new utterance)  │
        │  seq++ guards stale onend/onerror (Safari quirk)   │
        │  isSpeaking: false→true (onstart), true→false      │
        │  (onend/onerror, seq-checked)                      │
        └───────────────────┬─────────────────────────────────┘
                            │ isSpeaking (zustand subscription)
              ┌─────────────┴──────────────┐
              ▼                             ▼
   CommandBar.tsx renders          useVoiceCommand.ts's effect:
   "Speaking…" indicator            armedRef.current? →
   (D-05, 3rd conditional             true: abort() recognizer,
    block, no aria-live)                    VoiceState "speaking"
                                       isSpeaking→false: start()
                                             recognizer again,
                                             VoiceState "listening"
                                     false (text-only user, mic
                                       never armed): NO-OP —
                                       recognizer untouched
```

A reader can trace TTS-01 end to end: an applied reply (from either input path) composes the exact same on-screen `msg` string it always did, then hands that same string to one shared `speak()` action; `speak()`'s own internal `enabled` check is what TTS-02's mute toggle controls; the `isSpeaking` flag it publishes is what both TTS-03's UI feedback and TTS-04's mic pause key off of.

### Recommended Project Structure

```
frontend/src/
├── store/
│   └── speech.ts          # NEW — persisted mute toggle + isSpeaking/speak() controller
├── hooks/
│   └── useVoiceCommand.ts # MODIFIED — new "speaking" VoiceState, speakingRef,
│                           #   armed-gated pause/resume effect, visibilitychange
│                           #   extended to also cancel in-flight speech
├── components/
│   ├── CommandBar.tsx     # MODIFIED — speak(msg) call in onApplied, primeSpeech()
│                           #   in onSubmit, new "Speaking…" block (UI-SPEC locked)
│   └── Header.tsx         # MODIFIED — new Voice Replies toggle button (UI-SPEC locked)
├── lib/
│   ├── agent.ts           # MODIFIED — applyAgentFilters() gains a speechEnabled branch
│   └── voice.ts           # MODIFIED (optional) — isSpeechSynthesisSupported() helper,
│                           #   mirroring isSpeechSupported()'s pattern but independent
│                           #   (Firefox supports synthesis even though it lacks recognition)
├── api/
│   └── types.ts           # MODIFIED — AppliedFilters gains speechEnabled?: "on"|"off"|null
└── tests/
    └── fakeSpeechSynthesis.ts  # NEW — test double mirroring tests/fakeRecognition.ts

backend/app/agent/
├── schemas.py              # MODIFIED — ToggleSpeech model + AgentOutput union + AppliedFilters field
├── service.py              # MODIFIED — _apply_toggle_speech() + interpret() branch
└── prompt.py               # MODIFIED — mute/unmute vocabulary block in SYSTEM_PROMPT
```

### Pattern 1: One shared `speak()` action, called from both existing `applied` branches

**What:** `store/speech.ts` exposes an imperative `speak(text: string)` action. Both `CommandBar.onApplied` and `useVoiceCommand.handleSuccess`'s `case "applied"` branch call it with the **exact same `msg` string** they already compute for `setMessage(msg)` — not a re-derivation, not a bare `composeConfirmation()` call. This resolves CONTEXT.md's open discretion item directly: TTS-01 says "speaks the same confirmation text already shown visually," and the text already shown visually is `msg` (which is `composeConfirmation()` plus the appended D-16 stats-bar pointer when `reply.message` is non-empty) — not `composeConfirmation()` alone. Passing the identical variable also means there is no divergent branch to maintain.

**When to use:** Only inside the `case "applied"` branch of both existing switch statements — never from `clarify`/`refuse`/`unclear`/`unavailable` (which already have separate, unchanged `setMessage` calls), and never from any `useFilters` mutation triggered by a manual click (D-06, TTS-01).

**Example:**
```ts
// CommandBar.tsx — onApplied (existing function, one new line)
function onApplied(reply: AgentReply) {
  applyAgentFilters(reply.filters ?? {});
  let msg = composeConfirmation(useFilters.getState(), latestReading);
  if (reply.message.trim() !== "") msg += " " + reply.message;
  setMessage(msg);
  setStatus("confirmed");
  setText("");
  setClarifyContext(null);
  useSpeech.getState().speak(msg); // NEW — TTS-01
}
```
```ts
// useVoiceCommand.ts — handleSuccess's "applied" case (one new line)
case "applied": {
  applyAgentFilters(reply.filters ?? {});
  let msg = composeConfirmation(useFilters.getState(), latestReadingRef.current);
  if (reply.message.trim() !== "") msg += " " + reply.message;
  setMessage(msg);
  useSpeech.getState().speak(msg); // NEW — TTS-01
  break;
}
```

### Pattern 2: Mic pause/resume gated on `armedRef`, keyed off `isSpeaking`, never disarming the session

**What:** `useVoiceCommand.ts` adds `"speaking"` to `VoiceState` (a new, distinct value — `"paused"` stays reserved for D-14's fatal error state per CONTEXT.md) and a `speakingRef` ref. A `useEffect` reads `useSpeech`'s `isSpeaking` boolean and, **only when `armedRef.current` is true** (a voice session is genuinely open), aborts the recognizer on the rising edge and restarts it on the falling edge — without ever touching `armedRef` itself, so D-13's explicit-stop-only invariant is preserved and the caregiver never needs to re-tap the mic after a spoken reply.

**The `armedRef` gate is the load-bearing new insight here:** without it, a text-only caregiver who has never tapped the mic button (voice session `"off"`, `armedRef.current === false`) would have their microphone silently activated the first time they get a spoken reply from a *typed* command — because the effect fires on every `isSpeaking` transition regardless of input path. Gating on `armedRef.current` scopes the whole mechanic to exactly the case TTS-04 describes ("the mic never mishears its own voice") — which can only happen if the mic was already listening.

**When to use:** Inside `useVoiceCommand.ts` only. `CommandBar.tsx` never touches the recognizer directly (existing separation of concerns, unchanged).

**Example:**
```ts
// useVoiceCommand.ts — new imports/state
import { useSpeech } from "../store/speech";

export type VoiceState =
  | "off" | "listening" | "triggered" | "working" | "speaking" | "paused";
//                                                    ^^^^^^^^^ NEW

// ...inside useVoiceCommand(), alongside the other refs:
const speakingRef = useRef(false);
const isSpeaking = useSpeech((s) => s.isSpeaking);

useEffect(() => {
  if (isSpeaking === speakingRef.current) return; // no-op on re-render, only real transitions
  speakingRef.current = isSpeaking;
  if (!armedRef.current) return; // text-only user — never touch an inactive/absent recognizer
  if (isSpeaking) {
    clearRestartTimer(); // suppress any pending backoff restart (see onend guard below too)
    setVoiceState("speaking");
    recRef.current?.abort(); // fires onend; the guard below prevents a restart race
  } else {
    setVoiceState("listening");
    try {
      recRef.current?.start(); // resume right after speech ends (TTS-04)
    } catch {
      /* InvalidStateError: already running -> no-op (existing Pitfall 5 convention) */
    }
  }
}, [isSpeaking]);

// existing onend handler — ONE new line (the speakingRef guard)
rec.onend = () => {
  if (!armedRef.current) return;
  if (speakingRef.current) return; // NEW — TTS owns the resume; suppress the natural restart loop
  if (lastErrorFatalRef.current) { enterPaused(); return; }
  if (typeof document !== "undefined" && document.hidden) return;
  scheduleRestart();
};
```

Also extend `sessionOpen` in `CommandBar.tsx` to include `"speaking"` so a mic tap during a TTS-driven pause correctly calls `stop()` (closing the whole session) instead of attempting a redundant `start()`:
```ts
const sessionOpen =
  voiceState === "listening" ||
  voiceState === "triggered" ||
  voiceState === "working" ||
  voiceState === "speaking"; // NEW
```

No change is needed to the mic-icon ternary (`voiceState === "paused" ? <MicOff/> : <Mic/>`) — because `"speaking"` is a distinct value from `"paused"`, it already renders `<Mic/>`, satisfying UI-SPEC's icon-prohibition requirement with zero additional code.

### Pattern 3: iOS gesture-unlock priming, mirroring the recognizer's existing user-gesture requirement

**What:** iOS Safari (and Chrome since M71's autoplay-policy tightening) silently drops `speechSynthesis.speak()` calls that are not the result of a user gesture — but once *any* `speak()` call has succeeded inside a real gesture, the page is "unlocked" for the rest of the session and later async calls (from a `fetch` callback, exactly this app's shape) work fine [CITED, multiple community sources corroborating the same mechanism — see Sources]. This is architecturally identical to the reason `recRef.current.start()` already "MUST run inside the caregiver tap" per the existing D-01 comment in `useVoiceCommand.ts`.

**When to use:** `primeSpeech()` must be called synchronously inside **two** existing click handlers, each already a real user gesture, guarded to fire only once per page load:
1. `CommandBar.onMicClick`'s `start()` branch — covers voice-first users.
2. `CommandBar.onSubmit` — covers text-only users who never tap the mic (Firefox users, or caregivers who exclusively type). Without this second call site, a text-only iOS Safari user would never unlock synthesis and TTS-05 would silently fail for them.

**Example:**
```ts
// store/speech.ts
let primed = false;

primeSpeech: () => {
  if (primed || !isSpeechSynthesisSupported()) return;
  primed = true;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
  } catch {
    /* unsupported/blocked — TTS silently stays off; aria-live still fires (D-04) */
  }
},
```
```ts
// CommandBar.tsx
function onMicClick() {
  if (sessionOpen) stop();
  else {
    useSpeech.getState().primeSpeech(); // NEW — same tap as the recognizer's own gesture
    start();
  }
}

function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  useSpeech.getState().primeSpeech(); // NEW — covers the text-only path
  const trimmed = text.trim();
  if (trimmed === "") return;
  setStatus("working");
  mutate({ text: trimmed, context: clarifyContext }, { onSuccess, onError });
}
```

### Anti-Patterns to Avoid

- **Building a Chrome 15-second keepalive (`pause()`/`resume()` every ~14s):** This is a real, well-documented bug (Chromium issue tracked for over a decade), but it only manifests on long text passages. This phase's spoken text is always a single short confirmation sentence, well under the threshold. Building the keepalive interval anyway is unnecessary complexity for a scenario REQUIREMENTS.md explicitly excludes ("TTS reading full data tables or long lists aloud").
- **Building `getVoices()`/`onvoiceschanged` voice-selection logic:** TTS-06 (adjustable voice/rate picker) is explicitly deferred to v2. Using the engine's default voice needs no `getVoices()` call at all — skip this race condition entirely rather than defensively coding around it for an unused feature.
- **Disabling the text input / Send button while `isSpeaking`:** Only `anyWorking` (the existing agent round-trip state) should disable the input. TTS-04 only requires the *mic* to pause — a caregiver must still be able to type and submit a new command while a previous reply is being spoken (that new command's `applied` reply will itself call `speak()`, which cancels the current utterance per TTS-03, by design).
- **Reusing `PAUSED_COPY`/`VOICE_PAUSED_COPY` or the `MicOff` icon for the speaking sub-state:** UI-SPEC explicitly locks this — that copy/icon means "tap required to resume" (D-14 fatal state), which is false for an auto-resuming TTS pause.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preventing overlapping utterances | A manual "is something speaking" boolean check before every `speak()` call, scattered at call sites | Unconditional `speechSynthesis.cancel()` immediately before every `speak()` inside the ONE shared store action | `cancel()` is a documented safe no-op when nothing is speaking [CITED: MDN SpeechSynthesis.cancel()] — centralizing it in one action makes TTS-03 true by construction, not by discipline at every call site |
| Detecting "did this utterance actually finish, or was it cancelled out from under me" | Trusting a single global `speechSynthesis.speaking` boolean, polled or read synchronously | A monotonic `seq` counter incremented on every `speak()` call, checked inside `onstart`/`onend`/`onerror` before mutating `isSpeaking` | This project already has the identical proven pattern for the identical class of race (`seqRef` in `useVoiceCommand.ts` for agent replies) — reuse the idiom rather than inventing a new one |
| Cross-browser voice-loading race conditions | `getVoices()` + `onvoiceschanged` polyfill logic | Nothing — don't call `getVoices()` at all | Out of scope this phase (TTS-06 deferred); the engine's default voice requires no voice enumeration |

**Key insight:** The two genuinely hard problems in this phase (Safari's inconsistent `cancel()`→`onend` firing, and iOS's gesture-unlock timing) don't have library solutions — they're integration-specific to how *this app's* recognizer and TTS interact. The project's own prior Phase 4 work already proved out the general shape of both fixes (a seq guard, and gesture-scoped priming); Phase 10 reuses those shapes rather than inventing new ones or reaching for an npm package that wouldn't solve either problem anyway.

## Common Pitfalls

### Pitfall 1: iOS Safari drops `speak()` silently outside a user gesture
**What goes wrong:** The first `speechSynthesis.speak()` call of a page session, if not triggered synchronously inside a click/tap/keypress handler, is silently ignored on iOS Safari — no error, no event fires, nothing happens.
**Why it happens:** Safari (and Chrome since M71) requires "sticky user activation" to unlock audio-producing APIs; this app's real TTS triggers (`onApplied`/`handleSuccess`) fire asynchronously after a network round-trip, well outside any gesture window.
**How to avoid:** Prime with an empty/whitespace utterance synchronously inside `onMicClick` and `onSubmit` (Pattern 3) — the unlock is page-session-scoped, so one successful primed call covers every later async `speak()` call for the rest of the session.
**Warning signs:** TTS works fine in Chrome desktop testing but silently does nothing on a real iPhone — this exact split is the signature of a missed gesture-unlock.

### Pitfall 2: Safari doesn't reliably fire `onend` after `cancel()`
**What goes wrong:** When `cancel()` truncates an in-progress utterance to start a new one (the TTS-03 cancel-and-replace flow), some browsers fire `onerror` (with an error like `"canceled"`/`"interrupted"`) instead of `onend`, and Safari specifically has been observed not firing `end` reliably after `cancel()` at all [MEDIUM confidence, WebSearch-aggregated community source, not independently reproduced in this session — see Sources].
**Why it happens:** The spec leaves cancellation-vs-completion event semantics loosely defined; implementations diverge.
**How to avoid:** Listen to **both** `onend` and `onerror` as "this utterance is done" signals, and guard both with the monotonic `seq` check (Pattern 1's `finish()` helper) so a late/duplicate event from a *cancelled* utterance can never flip `isSpeaking` to `false` after a *newer* utterance has already started speaking.
**Warning signs:** The "Speaking…" indicator flickers off mid-sentence, or gets stuck permanently `true` after a rapid double-command in Safari testing.

### Pitfall 3: The mic-pause effect must not fire for users who never armed the recognizer
**What goes wrong:** If the `isSpeaking`-driven pause/resume effect in `useVoiceCommand.ts` isn't gated on `armedRef.current`, a text-only caregiver (mic button never tapped, or on Firefox where the mic button doesn't even render) would have `recRef.current?.start()` called on their behalf the first time a *typed* command produces a spoken reply — silently turning on microphone listening for a user who never asked for voice input.
**Why it happens:** The effect naturally keys off a global `isSpeaking` boolean that flips on every applied reply regardless of which input path triggered it (Pattern 1 wires both call sites to the same `speak()` action).
**How to avoid:** Gate the entire pause/resume effect behind `if (!armedRef.current) return;` (Pattern 2) — this scopes the mechanic to exactly TTS-04's actual concern (an *already-listening* mic mishearing itself).
**Warning signs:** A code review or test where `renderVoice()` is never `start()`-ed, yet `FakeRecognition.instances` grows after a text-path `speak()` call, would catch this immediately.

### Pitfall 4: A pending recognizer restart can race the TTS-driven abort
**What goes wrong:** `useVoiceCommand`'s existing `scheduleRestart()` backoff timer could fire (and call `recRef.current.start()`) in the small window between the TTS `abort()` call and the utterance actually finishing, re-arming the mic mid-speech.
**Why it happens:** `onend` fires as a side effect of `.abort()` itself; without a guard, the existing `onend` handler would treat that as "recognizer stopped, please restart" and schedule a new restart.
**How to avoid:** Two layers, both shown in Pattern 2: (1) `clearRestartTimer()` immediately when entering the speaking state, and (2) a `speakingRef.current` check inside `onend` itself (`if (speakingRef.current) return;`) so the abort-triggered `onend` never reaches `scheduleRestart()` in the first place.
**Warning signs:** Intermittent "the mic seems to restart itself half a second into a spoken reply" behavior, likely only reproducible under specific timing (hard to catch without the guard explicitly tested).

### Pitfall 5: Utterance objects can be garbage-collected mid-speech if not referenced
**What goes wrong:** If the `SpeechSynthesisUtterance` instance created inside `speak()` is only referenced by a local variable that falls out of scope (e.g., not retained anywhere after the function returns), some browser implementations have been observed to garbage-collect it before `onend` fires, silently dropping the event [MEDIUM confidence, community-documented; see Sources].
**Why it happens:** The synthesis engine holds a weak or indirect reference in some implementations; JS-side GC isn't guaranteed to keep the object alive just because `speak()` was called with it.
**How to avoid:** Keep a reference to the current utterance for its lifetime — e.g., store it in a module-level variable or a zustand-store-held ref inside `store/speech.ts`'s closure (the `mySeq`/handler-closure pattern shown in Pattern 1's Code Example already does this implicitly by keeping `utter` alive via its own event-handler closures, but be deliberate about not letting anything reassign/drop that reference before `onend`/`onerror` fires).
**Warning signs:** Utterances that work reliably in short manual tests but occasionally fail to fire `onend` under load/rapid succession — hard to reproduce, so build the safe pattern in from the start rather than debugging it later.

### Pitfall 6: iOS Safari's synthesis engine can get permanently stuck if backgrounded mid-utterance
**What goes wrong:** A documented Apple Developer Forums bug describes `speechSynthesis` becoming completely unresponsive — no further utterances play, `onend` never fires for the interrupted one — after the tab/app is backgrounded while speaking, requiring a full page reload to recover [MEDIUM confidence, Apple Developer Forums thread, not independently reproduced this session — see Sources].
**Why it happens:** iOS Safari's media/audio subsystem behaves unpredictably across backgrounding transitions; this is a platform bug, not something app code can fully prevent.
**How to avoid:** Diverge slightly from a pure mirror of `useVoiceCommand`'s existing visibilitychange handling (which holds-and-resumes the recognizer): for speech, proactively call `speechSynthesis.cancel()` **and** force `isSpeaking: false` in the store the moment `document.hidden` becomes true — don't wait for (and don't trust) `onend`/`onerror` to ever fire once backgrounded. This is the one place CONTEXT.md's "mirror unless research surfaces an iOS-specific reason to diverge" escape clause applies. The simplest integration point: extend `useVoiceCommand.ts`'s existing `onVisibility` handler to also call `useSpeech.getState().cancelForBackground()` at the top (one new line, co-located with the recognizer's existing hide-handling), rather than adding a second global `visibilitychange` listener.
**Warning signs:** "Speaking…" indicator stuck on indefinitely after switching apps mid-reply on a real iPhone — this is exactly success criterion 5's real-device check, and this pitfall is precisely why it can't be skipped.

### Pitfall 7: The Chrome-desktop 15-second halt bug does not apply here, but don't build for it anyway
**What goes wrong (if you build the workaround unnecessarily):** Adding a `pause()`/`resume()` keepalive `setInterval` for utterances that never approach 15 seconds adds a timer to clean up, a new failure mode (the interval firing after the utterance already ended, or during a cancel-and-replace), and no benefit.
**Why it happens:** This is a widely-cited, real bug (Chromium issue tracker, 2016, still open) that shows up prominently in TTS research, tempting over-engineering.
**How to avoid:** Don't build it. Confirm in code review that spoken text is always the short `composeConfirmation()`-derived sentence (never a table/list per REQUIREMENTS.md's explicit exclusion), and skip the keepalive entirely.
**Warning signs:** N/A (this is a "don't build" pitfall, not a runtime symptom to watch for) — flagging it here purely so the planner doesn't include unnecessary keepalive-timer tasks.

## Code Examples

### Backend: `ToggleSpeech` schema, mirroring `ToggleDataset` exactly

```python
# backend/app/agent/schemas.py — add alongside ToggleDataset

class ToggleSpeech(BaseModel):
    """Spoken-replies mute/unmute — explicit on/off state (D-01), mirrors
    ToggleDataset exactly: single-valued (never a flip/toggle)."""

    action: Literal["toggle_speech"]
    state: Literal["on", "off"]


class AgentOutput(BaseModel):
    result: (
        DashboardCommand
        | DataQuestion
        | Clarification
        | MedicalRefusal
        | Unintelligible
        | ToggleDataset
        | ToggleSpeech  # NEW
    )
    # ... _lower_tokens validator unchanged, already handles any dict shape
```

```python
# backend/app/agent/schemas.py — AppliedFilters gains one field

class AppliedFilters(BaseModel):
    # ... existing fields unchanged ...
    overlayDataset: DatasetToken | None = None
    overlayState: Literal["on", "off"] | None = None
    speechEnabled: Literal["on", "off"] | None = None  # NEW
    reset: bool = False
```

```python
# backend/app/agent/service.py — new mapper + interpret() branch, mirroring
# _apply_toggle_dataset() exactly

def _apply_toggle_speech(cmd: ToggleSpeech) -> AgentReply:
    """Map a ToggleSpeech result to an applied reply (D-01)."""
    filters = AppliedFilters(speechEnabled=cmd.state)
    return AgentReply(kind="applied", filters=filters, message="", context=None)

# inside interpret(), alongside the existing ToggleDataset check:
if isinstance(result, ToggleSpeech):
    return _apply_toggle_speech(result)
```

```python
# backend/app/agent/prompt.py — new vocabulary block in SYSTEM_PROMPT, placed
# near the existing "Overlay data toggles" block

Spoken-reply toggle (use exactly this action, never toggle_dataset):
- "mute the voice replies", "turn off voice replies", "stop talking",
  "quiet" -> toggle_speech with state = off.
- "turn on voice replies", "unmute voice replies", "start talking again"
  -> toggle_speech with state = on.
```

### Frontend: `AppliedFilters` type + `applyAgentFilters` routing

```ts
// frontend/src/api/types.ts — one new optional field
export type AppliedFilters = {
  // ... existing fields unchanged ...
  overlayDataset?: OverlayDataset | null;
  overlayState?: "on" | "off" | null;
  speechEnabled?: "on" | "off" | null; // NEW
  reset?: boolean;
};
```

```ts
// frontend/src/lib/agent.ts — applyAgentFilters() gains one branch. Note this
// is the ONE place server-composed AppliedFilters fields fan out to ANY
// store (not just useFilters) — extending it here, rather than adding a
// second call site in CommandBar/useVoiceCommand, keeps the existing
// "single-surface rule" doc comment in useVoiceCommand.ts true.
import { useSpeech } from "../store/speech";

export function applyAgentFilters(f: AppliedFilters): PulseField[] {
  const s = useFilters.getState();
  const touched = new Set<PulseField>();
  // ... existing reset/activeChart/datePreset/... branches unchanged ...

  if (f.speechEnabled != null) {
    useSpeech.getState().setEnabled(f.speechEnabled === "on"); // NEW — no PulseField;
    // the Voice Replies toggle isn't one of FilterBar's five highlighted groups.
  }

  const fields = [...touched];
  useAgentPulse.getState().mark(fields);
  return fields;
}
```

### Frontend: `store/speech.ts` (new file, full skeleton)

```ts
// frontend/src/store/speech.ts
// zustand speech store (D-01..D-06, TTS-01..05) — two concerns in one file,
// mirroring store/agentStatus.ts's "written from multiple entry points, read
// identically everywhere" shape:
//   1. `enabled` — persisted on/off preference (D-02/D-03), templated on
//      store/theme.ts's guarded localStorage read/write.
//   2. `isSpeaking` + `speak()`/`primeSpeech()`/`cancelForBackground()` — the
//      ephemeral utterance-lifecycle controller CommandBar's "Speaking…"
//      indicator and useVoiceCommand's mic-pause effect both subscribe to.
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

const STORAGE_KEY = "hv-speech";

function readStoredEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "on"; // default ON (TTS-02)
  } catch {
    return true;
  }
}

function storeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* persistence unavailable — this session still applies (theme.ts parity) */
  }
}

function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let primed = false; // module-level: page-session-scoped, not store state
let seq = 0; // monotonic guard for stale onend/onerror events (Pitfall 2)

interface SpeechState {
  enabled: boolean;
  isSpeaking: boolean;
  initSpeech: () => void;
  setEnabled: (enabled: boolean) => void; // used by applyAgentFilters (agent-driven)
  toggleEnabled: () => void; // used by the header button (click-driven)
  primeSpeech: () => void;
  speak: (text: string) => void;
  cancelForBackground: () => void;
}

export const useSpeech = create<SpeechState>((set, get) => ({
  enabled: true,
  isSpeaking: false,

  initSpeech: () => set({ enabled: readStoredEnabled() }),

  setEnabled: (enabled) => {
    storeEnabled(enabled);
    if (!enabled) get().cancelForBackground(); // muting silences immediately
    set({ enabled });
  },

  toggleEnabled: () => get().setEnabled(!get().enabled),

  primeSpeech: () => {
    if (primed || !isSpeechSynthesisSupported()) return;
    primed = true;
    try {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    } catch {
      /* unsupported/blocked — TTS silently stays off; aria-live still fires (D-04) */
    }
  },

  speak: (text) => {
    if (!get().enabled) return; // TTS-02: muted — D-04's aria-live already fired separately
    if (!isSpeechSynthesisSupported() || text.trim() === "") return;
    const mySeq = ++seq;
    window.speechSynthesis.cancel(); // TTS-03: always cancel first (safe no-op if idle)
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    const finish = () => {
      if (mySeq !== seq) return; // stale event from a cancelled utterance (Pitfall 2)
      set({ isSpeaking: false });
    };
    utter.onstart = () => {
      if (mySeq !== seq) return;
      set({ isSpeaking: true });
    };
    utter.onend = finish;
    utter.onerror = finish; // Safari may fire error, not end, after cancel() (Pitfall 2)
    window.speechSynthesis.speak(utter);
  },

  cancelForBackground: () => {
    seq++; // supersede any in-flight onend/onerror (Pitfall 6)
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    set({ isSpeaking: false });
  },
}));
```

```ts
// frontend/src/main.tsx — one new line, alongside the existing theme init
import { useSpeech } from './store/speech'
useSpeech.getState().initSpeech()
```

### Frontend: test double for jsdom (mirrors `tests/fakeRecognition.ts` exactly)

```ts
// frontend/src/tests/fakeSpeechSynthesis.ts
// jsdom has no SpeechSynthesis/SpeechSynthesisUtterance — this fake mirrors
// FakeRecognition's shape/conventions so store/speech.test.ts and
// useVoiceCommand.test.ts can drive synthetic onstart/onend/onerror events.

export class FakeUtterance {
  static instances: FakeUtterance[] = [];

  text: string;
  lang = "";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
    FakeUtterance.instances.push(this);
  }

  emitStart(): void {
    this.onstart?.();
  }
  emitEnd(): void {
    this.onend?.();
  }
  emitError(): void {
    this.onerror?.();
  }
}

export const fakeSpeechSynthesis = {
  speak: vi.fn((u: FakeUtterance) => void u),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
};

/** Install both globals, resetting the instance registry. */
export function installFakeSpeechSynthesis(): void {
  FakeUtterance.instances = [];
  fakeSpeechSynthesis.speak.mockClear();
  fakeSpeechSynthesis.cancel.mockClear();
  (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
    FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
  (window as { speechSynthesis?: unknown }).speechSynthesis = fakeSpeechSynthesis;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Chrome autoplay allowed `speak()` without a gesture | `speak()` requires user activation, same as `<audio>`/`<video>` autoplay | Chrome M71 (~2018) [MEDIUM confidence, community-documented] | Confirms the priming strategy (Pattern 3) is required, not optional, on Chrome too — not purely an iOS Safari quirk |

**Deprecated/outdated:** None specific to this API — `speechSynthesis`/`SpeechSynthesisUtterance` have been stable, unchanged interfaces since Baseline-widely-available status in 2018; no migration concerns.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Spoken text should be the full visually-displayed `msg` (composeConfirmation + appended D-16 pointer), not bare `composeConfirmation()` | Architecture Pattern 1 | Low — if wrong, a one-line change (pass `composeConfirmation()`'s return value alone instead of `msg`) at both call sites; no architectural rework |
| A2 | Muting mid-utterance (toggling the header button off) should silence immediately (`cancelForBackground()` called from `setEnabled(false)`) rather than let the current sentence finish | Code Examples, `store/speech.ts` `setEnabled` | Low — cosmetic UX choice; CONTEXT.md/UI-SPEC didn't lock this either way; easy to flip to "let it finish" by removing one line |
| A3 | Safari's `cancel()`→`onend` unreliability and the "utterance GC'd mid-speech" bug are real in current (2026) Safari/iOS versions | Pitfall 2, Pitfall 5 | Medium — these are WebSearch-aggregated community reports (Coder's Block, talkrapp.com), not independently reproduced this session or confirmed against a current Safari changelog; the defensive code (seq guard, keeping a reference) is cheap insurance either way and causes no harm if the underlying bugs have since been fixed |
| A4 | The Apple Developer Forums "speechSynthesis gets stuck after backgrounding" bug still applies to current iOS Safari | Pitfall 6 | Medium — if the platform bug has been fixed, the proactive-cancel-on-hide behavior is merely unnecessary defensiveness (no functional harm), so risk is low even if the assumption is stale |
| A5 | An empty/whitespace `SpeechSynthesisUtterance` reliably unlocks iOS Safari's synthesis engine for the rest of the page session | Pattern 3 | Medium — this is the single highest-value technical bet in this research; if it doesn't hold on the real target device, TTS-05 fails outright for iOS. This is exactly why success criterion 5 mandates real-device verification — treat the priming code as a hypothesis to validate on first real-device test, not a guarantee |
| A6 | A `keydown`/form-submit triggered by pressing Enter (not clicking Send) still counts as a sufficient "user gesture" for iOS Safari's synthesis unlock | Pattern 3, Open Questions | Low-Medium — if untrue, an Enter-only user on iOS would need to also click Send once (or tap the mic) before TTS works; flagged as an Open Question for real-device testing |

## Open Questions (RESOLVED)

1. **Does pressing Enter to submit (vs. clicking the Send button) count as a sufficient user gesture for iOS Safari's `speechSynthesis` unlock?**
   - What we know: Both are handled by the same `onSubmit` form handler in `CommandBar.tsx`, and general browser autoplay-policy documentation treats trusted `keydown`/`submit` events as carrying the same "sticky activation" as a click.
   - What's unclear: Whether iOS Safari's *specific* synthesis-unlock gate (as opposed to `<audio>`/`<video>` autoplay) makes the same distinction — not independently verified this session.
   - Recommendation: No code change needed either way (priming already fires from `onSubmit` regardless of trigger source); just include this in the mandatory real-device test pass for TTS-05 (test: type + press Enter only, never click Send or tap mic, then verify TTS speaks).
   - RESOLVED: No code change required. Folded into 10-06-PLAN.md's manual real-device verification steps 4 and 10 (Enter-vs-Send gesture parity is exercised as part of the mandatory TTS-05 real-device pass).

2. **Should stopping the mic session (tapping the mic button) also cancel any in-progress speech?**
   - What we know: D-06 locks that *manual filter clicks* never touch TTS playback; it does not explicitly address the mic stop button, which is voice-control-specific (not a filter action).
   - What's unclear: Whether a caregiver tapping "Stop voice control" mid-utterance expects the reply to also go silent, or to keep playing to completion.
   - Recommendation: Default to *not* cancelling (let it finish) — stopping voice input isn't the same intent as "be quiet," and the dedicated mute toggle already exists for that; this is a one-line, low-risk decision to revisit if user feedback disagrees.
   - RESOLVED: Recommendation adopted as-is — 10-04-PLAN.md's mic-stop path does not call the speech-cancel path; in-progress speech is left to finish. No code or plan change needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `window.speechSynthesis` (Chrome/Edge desktop) | TTS-01–05 | ✓ | Baseline since 2018 | — |
| `window.speechSynthesis` (Safari desktop 14.1+) | TTS-05 | ✓ | Baseline since 2018 | — |
| `window.speechSynthesis` (iOS Safari) | TTS-05 | ✓ (supported since early iOS Safari versions) | Baseline since 2018 | — |
| `window.speechSynthesis` (Firefox) | Bonus, not required | ✓ | Supported, unlike Firefox's lack of `SpeechRecognition` | Feature-detected independently via a new `isSpeechSynthesisSupported()` helper — do NOT reuse `isSpeechSupported()` (the recognizer's check), since Firefox users can get TTS on typed commands even though they have no mic button |
| Real iOS Safari device for manual verification | TTS-05 success criterion | Not verifiable from this environment | — | None — this is explicitly a manual/human-verification requirement per REQUIREMENTS.md and CLAUDE.md's "voice input must work on ... Safari/iOS ... Chris's primary device is undecided" |

**Missing dependencies with no fallback:**
- A real Safari/iOS device for the mandatory manual verification pass (TTS-05, success criterion 5) — no code-only substitute exists; jsdom does not implement the Web Speech API at all, so even the automated test suite (below) cannot exercise real Safari behavior.

**Missing dependencies with fallback:**
- None beyond the above — all browser API surfaces needed are broadly available (Baseline Widely Available).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (frontend), pytest 9.x (backend) |
| Config file | `frontend/vite.config.ts` (`test` block, `environment: 'jsdom'`, `setupFiles: './src/tests/setup.ts'`); `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd frontend && npx vitest run src/store/speech.test.ts src/hooks/useVoiceCommand.test.ts src/components/CommandBar.test.tsx` / `cd backend && python -m pytest tests/test_agent_schemas.py tests/test_agent_service.py -x` |
| Full suite command | `cd frontend && npm test -- --run` / `cd backend && python -m pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TTS-01 | `speak()` is called with the exact on-screen `msg` on an `applied` reply from BOTH input paths; never called for `clarify`/`refuse`/`unclear`/`unavailable`; never called from a manual `useFilters` mutation | unit + integration | `npx vitest run src/store/speech.test.ts src/components/CommandBar.test.tsx src/hooks/useVoiceCommand.test.ts` | ❌ Wave 0 (new `store/speech.test.ts`; extend existing `CommandBar.test.tsx`/`useVoiceCommand.test.ts`) |
| TTS-02 | `enabled` defaults `true`; persists to `localStorage["hv-speech"]`; guarded read/write degrades gracefully; backend `toggle_speech` schema round-trips | unit | `npx vitest run src/store/speech.test.ts`; `python -m pytest tests/test_agent_schemas.py -k toggle_speech tests/test_agent_service.py -k toggle_speech` | ❌ Wave 0 |
| TTS-03 | `cancel()` called before every `speak()`; a stale `onend`/`onerror` from a superseded utterance never flips `isSpeaking` false after a newer one started (seq guard) | unit | `npx vitest run src/store/speech.test.ts` | ❌ Wave 0 |
| TTS-04 | `isSpeaking: false→true` aborts the recognizer (when `armed`) and sets `VoiceState "speaking"`; `true→false` restarts it and returns to `"listening"`; NO recognizer interaction when `armed === false` (text-only path) | unit | `npx vitest run src/hooks/useVoiceCommand.test.ts` | ❌ Wave 0 (extend existing file using the `FakeRecognition` double already present, plus the new `fakeSpeechSynthesis.ts` double to drive `isSpeaking` transitions via `useSpeech.setState(...)`) |
| TTS-05 | Cross-browser real-device behavior (gesture unlock, backgrounding) | manual only | N/A — `human_needed` | N/A — jsdom cannot implement `speechSynthesis`; this requirement is manual-verification-only by nature, matching this project's existing precedent for live-model/live-device checks (03-VERIFICATION, 03-HUMAN-UAT) |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test files>` (frontend); `python -m pytest tests/test_agent_schemas.py tests/test_agent_service.py -x` (backend, when touched)
- **Per wave merge:** `npm test -- --run` (frontend full suite); `python -m pytest` (backend full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, PLUS a manual real-device pass (Chrome/Edge desktop, Safari desktop, and — critically — a real iOS Safari device) covering: mute toggle persistence across a reload, cancel-and-replace with two rapid commands, mic pause/resume audible correctness, and app-backgrounding mid-utterance.

### Wave 0 Gaps
- [ ] `frontend/src/tests/fakeSpeechSynthesis.ts` — new test double (Code Examples), mirrors `fakeRecognition.ts`'s conventions
- [ ] `frontend/src/store/speech.test.ts` — new file; covers TTS-02/TTS-03 (persistence, cancel-before-speak, seq guard) using the fake above
- [ ] Extend `frontend/src/hooks/useVoiceCommand.test.ts` — add a describe block for the `isSpeaking`-driven pause/resume effect (TTS-04), including the `armedRef`-gate regression test (Pitfall 3) as an explicit test case
- [ ] Extend `frontend/src/components/CommandBar.test.tsx` — assert `speak()`/`useSpeech` is invoked on an `applied` reply and not on other reply kinds (TTS-01); assert the new "Speaking…" block renders/doesn't render per `isSpeaking`
- [ ] `backend/tests/test_agent_schemas.py` — extend with `test_toggle_speech_variant_parses()` and a case-drift-normalizes test, mirroring the existing `test_toggle_dataset_variant_parses()`/`test_toggle_dataset_case_drift_normalizes()` pattern (lines 80, 125 in the existing file)
- [ ] `backend/tests/test_agent_service.py` — extend with `test_toggle_speech_maps_to_applied_filters_and_marks_reachable()`, mirroring the existing `test_toggle_dataset_maps_to_applied_filters_and_marks_reachable()` (line 163)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — `/agent` already sits behind the existing Bearer-token gate (SEC-01); this phase adds no new route |
| V3 Session Management | No | No session/token changes |
| V4 Access Control | No | No new authorization surface — the new `toggle_speech` action reuses the identical `/agent` route and Bearer dependency every other command already uses |
| V5 Input Validation | Yes | `ToggleSpeech.state` is a closed `Literal["on", "off"]` — structurally identical to `ToggleDataset.state`, so Claude's structured-outputs constrained sampling makes any other value impossible to emit (same guarantee already relied on project-wide, API-04) |
| V6 Cryptography | No | Not applicable — no new secrets, tokens, or cryptographic material |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model-authored text reaching `speechSynthesis.speak()` unescaped | Tampering / Information Disclosure | Not a risk here: TTS-01 locks spoken text to the frontend-composed `msg` (client-derived from server-composed `AppliedFilters` + the existing fixed/template `reply.message` copy in `copy.py`) — never raw Claude prose (mirrors the existing API-04 invariant that "model text never passes through" beyond `Clarification.question`, which this phase does not touch) |
| A malicious/compromised page abusing `speechSynthesis` for unwanted audio (browser-level concern) | Denial of Service (UX) | Out of this app's control surface — the browser's own gesture-unlock requirement (Pitfall 1) is itself the platform's mitigation; this phase's `speak()` never fires without either a primed gesture or an already-applied, authenticated `/agent` reply |
| Excess console/log exposure of spoken text | Information Disclosure | Existing project convention (SEC-03/T-04-04: transcripts never logged) extends naturally — `store/speech.ts`'s `speak()` should not `console.log` the text parameter; nothing in the recommended code above does |

## Sources

### Primary (HIGH confidence)
- MDN `SpeechSynthesis` — https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis — methods (`speak`/`cancel`/`pause`/`resume`/`getVoices`), `voiceschanged` event, Baseline Widely Available since September 2018
- MDN `SpeechSynthesisUtterance` — https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance — constructor, properties, all seven events (`start`/`end`/`error`/`pause`/`resume`/`boundary`/`mark`)
- Local codebase inspection: `frontend/src/hooks/useVoiceCommand.ts`, `frontend/src/lib/voice.ts`, `frontend/src/lib/agent.ts`, `frontend/src/store/theme.ts`, `frontend/src/store/agentStatus.ts`, `frontend/src/components/{Header,CommandBar}.tsx`, `frontend/src/tests/fakeRecognition.ts`, `backend/app/agent/{schemas,service,prompt,copy}.py`, `backend/tests/test_agent_{schemas,service}.py` — direct source of every recommended pattern
- Local `node_modules` inspection confirming `lucide-react` v1.24.0 ships `volume-2.mjs`/`volume-x.mjs`

### Secondary (MEDIUM confidence)
- Coder's Block, "JavaScript Text to Speech and Its Many Quirks" — https://codersblock.com/blog/javascript-text-to-speech-and-its-many-quirks/ — Safari `end`-after-`cancel()` unreliability, `onvoiceschanged` guidance, cross-browser property quirks
- talkrapp.com, "Lessons Learned Using the javascript speechSynthesis API" — https://talkrapp.com/speechSynthesis.html — utterance garbage-collection-before-`onend` bug, Chrome M71 autoplay-restriction note, iOS voice-availability quirks
- Caktus Group, "The Halting Problem" (Nov 2025) — https://www.caktusgroup.com/blog/2025/11/03/the-halting-problem/ — corroborates the Chrome 15-second halt bug and `pause()`/`resume()`-every-14s workaround as still relevant as of late 2025 for long text (confirmed not applicable to this phase's short-utterance use case)
- Chromium issue tracker — https://bugs.chromium.org/p/chromium/issues/detail?id=679437 — "Speech Synthesis stops abruptly after about 15 seconds," corroborating the above
- Apple Developer Forums — https://developer.apple.com/forums/thread/49875 — "Text To Speech API Not Working on iOS Safari," backgrounding-causes-permanent-failure reports
- Community sources on iOS gesture-unlock timing (aggregated via WebSearch; multiple independent sources converge on "first speak() call must be gesture-synchronous; later async calls then work") — no single authoritative Apple/WebKit doc found and cited directly; treated as MEDIUM confidence and flagged in the Assumptions Log (A5) for mandatory real-device confirmation

### Tertiary (LOW confidence)
- None retained — all WebSearch findings above were cross-checked against at least one independent secondary source before inclusion; anything single-sourced and unverifiable was excluded rather than presented as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; the API itself is MDN-documented Baseline Widely Available, and the "no library, raw wrapper" architectural choice is directly precedented by this project's own Phase 4 decision (verified by reading the actual installed `package.json`, which confirms `react-speech-recognition` was never actually added despite CLAUDE.md nominally recommending it)
- Architecture: HIGH — every pattern (shared `speak()` surface, `armedRef`-gated pause/resume, gesture priming, seq-guarded completion events) is either a direct mirror of an existing, working pattern already in this codebase, or a documented browser-vendor requirement
- Pitfalls: MEDIUM — the two iOS-specific bugs (Pitfall 5 GC-before-onend, Pitfall 6 stuck-after-backgrounding) and the gesture-unlock timing details (A5, A6) rest on community-aggregated WebSearch sources rather than an official WebKit/Apple changelog; the defensive code recommended for all of them is low-cost even if the underlying bugs have since been fixed, but success criterion 5's mandatory real-device pass is the actual ground truth this research cannot substitute for

**Research date:** 2026-08-23
**Valid until:** 2026-09-22 (30 days — the core API is stable/unchanging, but iOS Safari-specific quirks are worth re-checking if this phase's execution slips past a major Safari point release)
