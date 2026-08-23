# Phase 10: Spoken Replies (TTS) - Pattern Map

**Mapped:** 2026-08-22
**Files analyzed:** 14 (5 new, 9 modified)
**Analogs found:** 14 / 14

This phase adds zero new libraries. Every file below either has a
byte-for-byte structural analog already in the codebase (RESEARCH.md and
CONTEXT.md both name the exact analog per file — this document verifies each
one against the real source and extracts the precise excerpts to copy) or is
a small, targeted extension of an existing file whose extension point is
identified below.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/store/speech.ts` (NEW) | store | event-driven | `frontend/src/store/theme.ts` (persistence half) + `frontend/src/store/agentStatus.ts` (multi-entry-point half) | exact (combined) |
| `frontend/src/hooks/useVoiceCommand.ts` (MODIFIED) | hook | event-driven | itself (existing recognizer-lifecycle ref pattern) | exact |
| `frontend/src/components/CommandBar.tsx` (MODIFIED) | component | request-response | itself (existing `onApplied`/status-line pattern) | exact |
| `frontend/src/components/Header.tsx` (MODIFIED) | component | request-response | itself — existing Theme toggle button (lines 157-170) | exact |
| `frontend/src/lib/agent.ts` (MODIFIED) | utility | transform | itself — `applyAgentFilters()` (lines 43-87) | exact |
| `frontend/src/lib/voice.ts` (MODIFIED, optional) | utility | transform | itself — `isSpeechSupported()` (lines 92-95) | exact |
| `frontend/src/api/types.ts` (MODIFIED) | model (TS types) | transform | itself — `AppliedFilters` type (lines 159-168) | exact |
| `frontend/src/main.tsx` (MODIFIED, 1 line) | config | event-driven | itself — `initTheme()` bootstrap call (line 14) | exact |
| `frontend/src/tests/fakeSpeechSynthesis.ts` (NEW) | test | event-driven | `frontend/src/tests/fakeRecognition.ts` | exact |
| `frontend/src/store/speech.test.ts` (NEW) | test | event-driven | `frontend/src/store/agentStatus.test.ts` | exact |
| `backend/app/agent/schemas.py` (MODIFIED) | model (Pydantic) | request-response | itself — `ToggleDataset` (lines 134-141) + `AgentOutput` union (143-153) + `AppliedFilters` (206-218) | exact |
| `backend/app/agent/service.py` (MODIFIED) | service | request-response | itself — `_apply_toggle_dataset()` (209-214) + `interpret()` branch (245-246) | exact |
| `backend/app/agent/prompt.py` (MODIFIED) | config (prompt text) | transform | itself — overlay-toggle vocabulary block (lines 41-47) | exact |
| `backend/tests/test_agent_schemas.py` / `test_agent_service.py` (MODIFIED) | test | request-response | itself — `test_toggle_dataset_*` tests | exact |

## Pattern Assignments

### `frontend/src/store/speech.ts` (NEW — store, event-driven)

**Analogs:** `frontend/src/store/theme.ts` (persisted-toggle half) + `frontend/src/store/agentStatus.ts` (multi-entry-point / "written from two call sites, read identically everywhere" half)

**Imports + module doc-comment pattern** (`theme.ts` lines 1-8):
```ts
// zustand theme store — D-15: manual light/dark toggle via the `.dark` class
// on <html>, persisted to localStorage key "hv-theme".
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "hv-theme";
```

**Guarded localStorage read/write pattern — copy exactly, only the key/values change** (`theme.ts` lines 14-32):
```ts
// localStorage access can throw (Chromium with site data blocked throws
// SecurityError on mere access; older Safari private mode throws on setItem).
// Guard both directions so theme persistence degrades gracefully instead of
// blanking the app at bootstrap (main.tsx calls initTheme before render).
function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* persistence unavailable — theme still applies for this session */
  }
}
```
For `speech.ts`: `readStoredEnabled()` returns `true` (on) as the safe default per TTS-02, not `false` — this is the one semantic inversion versus `theme.ts` (theme defaults to `"light"`, speech defaults to enabled/on). Everything else — try/catch shape, `STORAGE_KEY` const, guarded write with a swallowed-error comment — copies verbatim.

**Store shape + `create<...>((set, get) => ...)` pattern** (`theme.ts` lines 34-53):
```ts
interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "light",
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    applyTheme(next);
    storeTheme(next);
    set({ theme: next });
  },
  initTheme: () => {
    const theme = readStoredTheme();
    applyTheme(theme);
    set({ theme });
  },
}));
```
Mirror this exactly for the `enabled`/`toggleEnabled`/`initSpeech` slice of `speech.ts`.

**Multi-entry-point / "one shared boolean written from ≥2 call sites" doc-comment convention** (`agentStatus.ts` lines 1-16, use as the template for `speech.ts`'s own header comment covering `isSpeaking`):
```ts
// zustand agent-liveness store (Phase 6, D-05/D-07/D-08) — ONE shared
// `unavailable` boolean, written by two entry points, last-write-wins:
//   - reportOutcome(kind): called from CommandBar/useVoiceCommand the moment
//     a real /agent reply lands (D-07's instant clear-or-set).
//   - syncFromHealth(reachable, configured): called from AgentStatusBanner's
//     useHealth() poll effect (D-05/D-08's proactive load + recurring check).
//
// Deliberately NOT two independent stores OR'd together in a consuming
// component (RESEARCH Pattern 4's explicitly-rejected design) — that shape
// has a latent staleness bug...
//
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";
```
For `speech.ts`, `isSpeaking`/`speak()` is written by exactly the same two call sites (`CommandBar.onApplied` and `useVoiceCommand.handleSuccess`), so this exact rationale — "one field, read identically by every consumer regardless of whether the triggering path was voice or text" — transfers directly and should be restated in `speech.ts`'s header comment.

**`getState()`-from-outside-React usage pattern** (`agentStatus.ts` line 26, `reportOutcome` action signature — mirrors how `speak()`/`setEnabled()` will be called imperatively from both `CommandBar.tsx` and `useVoiceCommand.ts`):
```ts
export const useAgentStatus = create<AgentStatusState>((set) => ({
  unavailable: false,
  reportOutcome: (kind) => set({ unavailable: kind === "unavailable" }),
  ...
```
Called at both existing sites exactly like: `useAgentStatus.getState().reportOutcome(reply.kind);` (`CommandBar.tsx` line 125, `useVoiceCommand.ts` line 131) — `speak(msg)` should be invoked identically: `useSpeech.getState().speak(msg);` immediately after each of those two lines.

**Full concrete skeleton to build from** — see RESEARCH.md "Code Examples: Frontend: `store/speech.ts`" (lines 476-578 of `10-RESEARCH.md`) — this is a complete, ready-to-adapt implementation combining both analog patterns above with the seq-guard idiom from `useVoiceCommand.ts` (see below). Treat that research skeleton as the concrete starting point; the excerpts above are the *proof* (from the real files) that every piece of it is a faithful mirror of an existing, working codebase pattern, not an invented shape.

---

### `frontend/src/hooks/useVoiceCommand.ts` (MODIFIED — hook, event-driven)

**Analog:** itself — this file already contains the exact ref/effect idioms the new mic-pause logic needs.

**Monotonic seq-guard idiom to reuse for the speech store's `finish()`/onend/onerror guard** (lines 79, 102, 125-127, 158, 178, 238):
```ts
const seqRef = useRef(0);
...
seqRef.current++; // supersede any in-flight reply so it can't mutate post-pause (D-05)
...
// D-05 newest-wins: a superseded command's late reply must NOT touch the store.
function handleSuccess(reply: AgentReply, capturedSeq: number) {
  if (capturedSeq !== seqRef.current) return; // stale drop BEFORE any store touch
  ...
```
This is the exact idiom RESEARCH.md's `speak()` (module-level `seq`/`mySeq`) copies for Safari's unreliable `cancel()`→`onend` firing (Pitfall 2).

**`VoiceState` union — extension point** (lines 35-40):
```ts
export type VoiceState =
  | "off"
  | "listening"
  | "triggered"
  | "working"
  | "paused";
```
Add `"speaking"` as a new sibling value (never reuse `"paused"`, which is reserved for the D-14 fatal state per CONTEXT.md/RESEARCH.md).

**Ref-based construct-once-handlers pattern to extend** (lines 75-89, `armedRef`/`recRef`/refs-not-state so handlers stay stable):
```ts
const recRef = useRef<SpeechRecognition | null>(null);
const armedRef = useRef(false);
const seqRef = useRef(0);
...
```
Add `speakingRef = useRef(false)` alongside these, following the identical convention.

**`onend` handler — the exact line to extend with the new speaking-guard** (lines 214-222):
```ts
rec.onend = () => {
  if (!armedRef.current) return; // caregiver tapped stop → stay off (D-13)
  if (lastErrorFatalRef.current) {
    enterPaused();
    return;
  }
  if (typeof document !== "undefined" && document.hidden) return; // held hidden
  scheduleRestart();
};
```
Add `if (speakingRef.current) return;` as a new guard line here (RESEARCH Pattern 2, Pitfall 4) — same position/style as the existing three early-return guards.

**`onVisibility` handler — the exact site to extend for Pitfall 6's backgrounding-cancel** (lines 249-264):
```ts
useEffect(() => {
  function onVisibility() {
    const hidden = typeof document !== "undefined" && document.hidden;
    if (hidden) {
      clearRestartTimer(); // background → stop trying to restart
      recRef.current?.abort(); // stop the LIVE session — never listen in the background (T-04-05)
      return;
    }
    if (armedRef.current && !lastErrorFatalRef.current) {
      try {
        recRef.current?.start(); // foreground again → resume the session
      } catch {
        /* InvalidStateError: already running → no-op (Pitfall 5) */
      }
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  ...
```
Add `useSpeech.getState().cancelForBackground();` as the first line inside the `if (hidden)` block — one new line, co-located exactly as RESEARCH.md's Pitfall 6 specifies, rather than a second global listener.

**New effect to add — full pattern already written out in RESEARCH.md Architecture Pattern 2** (`10-RESEARCH.md` lines 220-258) — the `armedRef`-gated `isSpeaking` subscription effect. This is new code, not an extension of existing code, but every primitive it uses (`useRef`, `useEffect([dep])`, `try {...} catch { /* InvalidStateError */ }`, `clearRestartTimer()`) is copied verbatim from patterns already in this same file (see `start()`, lines 190-234, for the identical `try { recRef.current.start() } catch { ... }` idiom at line 229-233).

---

### `frontend/src/components/CommandBar.tsx` (MODIFIED — component, request-response)

**Analog:** itself.

**Exact insertion point 1 — `onApplied`** (lines 107-119):
```ts
function onApplied(reply: AgentReply) {
  // Reset-first then present-value deltas happen inside applyAgentFilters;
  // compose the echo from POST-apply store state, never from model text (D-07).
  applyAgentFilters(reply.filters ?? {});
  let msg = composeConfirmation(useFilters.getState(), latestReading);
  if (reply.message.trim() !== "") {
    msg += " " + reply.message; // D-16 stats-bar pointer, appended verbatim
  }
  setMessage(msg);
  setStatus("confirmed");
  setText(""); // D-03 clears only on an applied command
  setClarifyContext(null);
}
```
Add `useSpeech.getState().speak(msg);` as the last line of this function (TTS-01) — `msg` here is the exact full visually-displayed string (composeConfirmation + D-16 pointer), matching CONTEXT.md's discretion resolution.

**Exact insertion point 2 — `onSubmit`, for iOS gesture-unlock priming** (lines 170-177):
```ts
function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const trimmed = text.trim();
  if (trimmed === "") return; // trimmed-empty → no-op (D-04)
  // D-03: keep text visible, lock the controls, show the Working… state.
  setStatus("working");
  mutate({ text: trimmed, context: clarifyContext }, { onSuccess, onError });
}
```
Add `useSpeech.getState().primeSpeech();` as the first line (before the trimmed-empty check, so even an accidental Enter-press primes synthesis — mirrors RESEARCH Pattern 3).

**Exact insertion point 3 — `onMicClick`** (lines 228-231):
```ts
function onMicClick() {
  if (sessionOpen) stop();
  else start(); // synchronous start inside the tap (D-01 user gesture)
}
```
Add `useSpeech.getState().primeSpeech();` inside the `else` branch, same tap as the recognizer's own gesture requirement (mirrors the existing comment's own rationale).

**Non-color-only status-line triad pattern to copy for the new "Speaking…" block** (lines 200-226, the `lineText`/`lineGreen`/`lineGlyph` state-machine and lines 281-289's existing Working indicator JSX):
```tsx
{anyWorking && (
  <p className="mt-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-ink)]">
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 rounded-full border-2 border-[var(--color-ink)] border-t-transparent motion-safe:animate-spin"
    />
    {voiceWorking ? "WORKING…" : "Working…"}
  </p>
)}
```
The new "Speaking…" block is a **sibling** conditional block (not nested in this one) — exact JSX is locked by `10-UI-SPEC.md` ("CommandBar.tsx — new Speaking… indicator" section): same `mt-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-ink)]` classes, `Volume2` icon with `motion-safe:animate-pulse motion-reduce:animate-none` instead of the spinner's `animate-spin`, word "Speaking…" (not "SPEAKING…" — UI-SPEC explicitly locks single-casing here, unlike the Working indicator's dual casing).

**`sessionOpen` — the exact line to extend** (lines 184-187):
```ts
const sessionOpen =
  voiceState === "listening" ||
  voiceState === "triggered" ||
  voiceState === "working";
```
Add `|| voiceState === "speaking"` (RESEARCH Pattern 2) so a mic tap during a TTS pause closes the whole session instead of a redundant `start()`.

**Import block to extend** (lines 22-32) — add `import { useSpeech } from "../store/speech";` alongside the existing store imports (`useAgentStatus`, `useFilters`).

---

### `frontend/src/components/Header.tsx` (MODIFIED — component, request-response)

**Analog:** itself — the existing Theme toggle button, verbatim template per D-02.

**Exact button markup to copy and adapt** (lines 157-170):
```tsx
{/* Theme toggle (D-15). */}
<button
  type="button"
  onClick={toggleTheme}
  aria-pressed={isDark}
  className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
>
  {isDark ? (
    <Moon aria-hidden="true" size={24} />
  ) : (
    <Sun aria-hidden="true" size={24} />
  )}
  {isDark ? "Dark" : "Light"}
</button>
```
The new Voice Replies toggle is placed immediately after this block (D-02, UI-SPEC "immediately after the Theme toggle and before Upload/Add Record/Log out"), reusing the identical className string verbatim, swapping `Moon`/`Sun` for `Volume2`/`VolumeX` and `toggleTheme`/`isDark` for `toggleEnabled`/`speechEnabled`. Exact final JSX is already locked in `10-UI-SPEC.md` lines 206-228.

**Store-read pattern to mirror** (lines 113-115):
```ts
const theme = useTheme((s) => s.theme);
const toggleTheme = useTheme((s) => s.toggleTheme);
const isDark = theme === "dark";
```
Mirror as `const speechEnabled = useSpeech((s) => s.enabled); const toggleSpeech = useSpeech((s) => s.toggleEnabled);`.

**Import block to extend** (line 15, lucide-react icons; line 17-19, store imports):
```ts
import { ClipboardPlus, LogOut, Moon, Sailboat, Sun, Upload } from "lucide-react";
...
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";
import { useView } from "../store/view";
```
Add `Volume2, VolumeX` to the lucide-react import and `import { useSpeech } from "../store/speech";` alongside the other store imports.

---

### `frontend/src/lib/agent.ts` (MODIFIED — utility, transform)

**Analog:** itself — `applyAgentFilters()`, the single fan-out point for server-composed `AppliedFilters` fields.

**Exact `!= null` present-value-delta branch pattern to copy** (lines 71-82):
```ts
if (f.amPm != null) {
  s.setAmPm(f.amPm);
  touched.add("amPm");
}
if (f.bpCategory != null) {
  s.setBpCategory(f.bpCategory);
  touched.add("bpCategory");
}
if (f.overlayDataset != null && f.overlayState != null) {
  s.setOverlayDataset(f.overlayDataset, f.overlayState === "on");
  touched.add("overlay");
}
```
Add a new `if (f.speechEnabled != null) { useSpeech.getState().setEnabled(f.speechEnabled === "on"); }` branch in this same style — **no `touched.add(...)`** call, since Voice Replies isn't one of the five `PulseField` groups `FilterBar` highlights (`PulseField` type, lines 16-21, stays unchanged).

**Import block to extend** (lines 8-13):
```ts
import { create } from "zustand";

import type { AppliedFilters, BPCategory, ChartId } from "../api/types";
import type { DatePreset } from "./dates";
import { parseDateOnly, presetLabel } from "./dates";
import { useFilters } from "../store/filters";
```
Add `import { useSpeech } from "../store/speech";`.

**Function docstring/trust-boundary comment convention** (lines 37-42) — the new branch inherits this file's existing invariant statement ("only server-composed AppliedFilters fields... reach the store actions here") without needing a new comment block, since it's one more field in the same fan-out function.

---

### `frontend/src/lib/voice.ts` (MODIFIED, optional — utility, transform)

**Analog:** itself — `isSpeechSupported()`, the exact shape for a new, independent `isSpeechSynthesisSupported()` helper.

**Exact pattern to copy** (lines 87-95):
```ts
export function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** True when the browser exposes a SpeechRecognition constructor (VOICE-08). */
export function isSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}
```
**Do not** add the new synthesis-support check to this file, or reuse `isSpeechSupported()` — RESEARCH.md explicitly flags that Firefox supports `speechSynthesis` despite lacking `SpeechRecognition`, so the two checks must stay independent. Either add `isSpeechSynthesisSupported()` as a new standalone function in `voice.ts` (same file, same one-liner-with-typeof-guard style) or keep it local to `store/speech.ts` (RESEARCH.md's skeleton keeps it local — either is acceptable, planner's call).

---

### `frontend/src/api/types.ts` (MODIFIED — model/TS types, transform)

**Analog:** itself — `AppliedFilters` type, exact field to mirror.

**Exact insertion point** (lines 159-168):
```ts
export type AppliedFilters = {
  activeChart?: ChartId | null;
  datePreset?: "7d" | "30d" | "90d" | "all" | null;
  customRange?: { from: string; to: string } | null;
  amPm?: "all" | "AM" | "PM" | null;
  bpCategory?: "all" | BPCategory | null;
  overlayDataset?: OverlayDataset | null;
  overlayState?: "on" | "off" | null;
  reset?: boolean;
};
```
Add `speechEnabled?: "on" | "off" | null;` — same optional-nullable-literal-union shape as `overlayState` immediately above it (byte-for-byte structural mirror, per RESEARCH.md and D-01's "mirrors ToggleDataset's shape exactly" instruction extended to this sibling field).

---

### `frontend/src/main.tsx` (MODIFIED, 1 line — config, event-driven)

**Analog:** itself — the existing `initTheme()` bootstrap call.

**Exact pattern** (lines 9, 14):
```ts
import { useTheme } from './store/theme'
...
// Apply persisted theme before first paint (D-15)
useTheme.getState().initTheme()
```
Add `import { useSpeech } from './store/speech'` and `useSpeech.getState().initSpeech()` immediately after the theme init line, same file, same bootstrap-before-render convention.

---

### `frontend/src/tests/fakeSpeechSynthesis.ts` (NEW — test, event-driven)

**Analog:** `frontend/src/tests/fakeRecognition.ts` — full file, mirror its shape and exported-helper convention exactly.

**Exact class + static-registry + vi.fn() pattern to copy** (lines 7-26):
```ts
export class FakeRecognition {
  static instances: FakeRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";

  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  /** Fire a synthetic onresult with a results-array-shaped payload (interim or final). */
  emitResult(transcript: string, isFinal: boolean): void {
    ...
  }
```

**Exact `installFake*()` helper pattern to copy** (lines 47-52):
```ts
export function installFakeRecognition(): () => FakeRecognition | null {
  FakeRecognition.instances = [];
  (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
    FakeRecognition as unknown as SpeechRecognitionConstructor;
  return () => FakeRecognition.instances.at(-1) ?? null;
}
```
`installFakeSpeechSynthesis()` follows this identically but installs two globals (`window.SpeechSynthesisUtterance` = the fake class, `window.speechSynthesis` = a `vi.fn()`-based object with `speak`/`cancel`/`getVoices`) rather than one. Full skeleton already written in `10-RESEARCH.md` "Code Examples: test double for jsdom" (lines 588-634) — that skeleton is a direct, complete mirror of this analog; use it as-is.

---

### `frontend/src/store/speech.test.ts` (NEW — test, event-driven)

**Analog:** `frontend/src/store/agentStatus.test.ts` — full file, mirror its `setState`-reset-in-`beforeEach` convention.

**Exact pattern to copy** (lines 1-16):
```ts
// Unit tests for the agentStatus zustand store (Phase 6, D-05/D-07/D-08) —
// the store is testable without React via useAgentStatus.getState(). Mirrors
// filters.test.ts's setState-reset-in-beforeEach convention.
import { beforeEach, describe, expect, it } from "vitest";

import { useAgentStatus } from "./agentStatus";

beforeEach(() => {
  useAgentStatus.setState({ unavailable: false });
});

describe("useAgentStatus initial state", () => {
  it("defaults to unavailable: false (no false-positive flash before the first response)", () => {
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });
});
```
`speech.test.ts` mirrors this exactly: `beforeEach` resets `useSpeech.setState({ enabled: true, isSpeaking: false })` plus `installFakeSpeechSynthesis()`, then `describe`/`it` blocks per action (`speak`, `setEnabled`/persistence, `primeSpeech`, `cancelForBackground`), each a plain call + `expect(useSpeech.getState()....)` assertion — no React rendering needed, store tested directly via `getState()`, exactly like this analog.

---

### `backend/app/agent/schemas.py` (MODIFIED — model/Pydantic, request-response)

**Analog:** itself — `ToggleDataset`, byte-for-byte structural template per D-01.

**Exact class to mirror** (lines 134-141):
```python
class ToggleDataset(BaseModel):
    """Overlay data toggle — one dataset token + explicit on/off state (D-03/D-04):
    single-valued (never list-typed) and always explicit (never a flip/toggle)."""

    action: Literal["toggle_dataset"]
    dataset: DatasetToken
    state: Literal["on", "off"]
```
New `ToggleSpeech` has no dataset field (there's only one toggleable concept) — `action: Literal["toggle_speech"]` + `state: Literal["on", "off"]`, otherwise identical shape/docstring convention.

**Exact union to extend** (lines 143-153):
```python
class AgentOutput(BaseModel):
    """The closed union Claude fills via structured outputs (API-04)."""

    result: (
        DashboardCommand
        | DataQuestion
        | Clarification
        | MedicalRefusal
        | Unintelligible
        | ToggleDataset
    )
```
Add `| ToggleSpeech` as the new last member. The `_lower_tokens` validator (lines 155-164) needs no change — it already lowercases any dict shape generically.

**Exact `AppliedFilters` field to mirror** (lines 206-218, specifically the `overlayDataset`/`overlayState` pair at lines 216-217):
```python
class AppliedFilters(BaseModel):
    """Store-shaped filter delta the frontend applies. Canonical labels, not tokens."""

    activeChart: ChartToken | None = None
    datePreset: Literal["7d", "30d", "90d", "all"] | None = None
    customRange: CustomRange | None = None
    amPm: Literal["all", "AM", "PM"] | None = None
    bpCategory: Literal[
        "all", "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
    ] | None = None
    overlayDataset: DatasetToken | None = None
    overlayState: Literal["on", "off"] | None = None
    reset: bool = False
```
Add `speechEnabled: Literal["on", "off"] | None = None` as a new field, same position/style as `overlayState`.

---

### `backend/app/agent/service.py` (MODIFIED — service, request-response)

**Analog:** itself — `_apply_toggle_dataset()` + its `interpret()` branch, byte-for-byte structural template.

**Exact mapper function to mirror** (lines 209-214):
```python
def _apply_toggle_dataset(cmd: ToggleDataset) -> AgentReply:
    """Map a ``ToggleDataset`` result to an ``applied`` reply (D-03/D-04)."""
    filters = AppliedFilters(overlayDataset=cmd.dataset, overlayState=cmd.state)
    # message="" — same convention as _apply_command: the frontend composes the
    # confirmation, the server never authors it.
    return AgentReply(kind="applied", filters=filters, message="", context=None)
```
New `_apply_toggle_speech(cmd: ToggleSpeech) -> AgentReply` follows this exactly: `filters = AppliedFilters(speechEnabled=cmd.state)`, same `message=""` convention/comment, same `return AgentReply(kind="applied", ...)`.

**Exact `interpret()` branch + import list to extend** (lines 45-59 import block; lines 245-246 branch):
```python
from app.agent.schemas import (
    AMPM_TOKEN_TO_LABEL,
    BP_TOKEN_TO_LABEL,
    AgentOutput,
    AgentReply,
    AppliedFilters,
    Clarification,
    ClarifyContext,
    CustomRange,
    DashboardCommand,
    DataQuestion,
    MedicalRefusal,
    ToggleDataset,
    Unintelligible,
)
...
        if isinstance(result, ToggleDataset):
            return _apply_toggle_dataset(result)
```
Add `ToggleSpeech` to the import list (alphabetical, right after `ToggleDataset`... actually before it alphabetically — match existing ordering) and a new `if isinstance(result, ToggleSpeech): return _apply_toggle_speech(result)` branch immediately after the `ToggleDataset` branch, same position/style.

---

### `backend/app/agent/prompt.py` (MODIFIED — config/prompt text, transform)

**Analog:** itself — the existing overlay-toggle vocabulary block, exact style to mirror.

**Exact block to mirror** (lines 41-47):
```
Overlay data toggles (use these exact dataset tokens): labs, incidents,
procedures.
- "show", "add", "turn on", "overlay" a dataset -> toggle_dataset with that
  dataset token and state = on.
- "hide", "remove", "turn off" a dataset -> toggle_dataset with that dataset
  token and state = off.
- "incidents" also covers "hospital stays" and "hospitalizations".
```
New block (RESEARCH.md's exact suggested text, placed near this one in `SYSTEM_PROMPT`):
```
Spoken-reply toggle (use exactly this action, never toggle_dataset):
- "mute the voice replies", "turn off voice replies", "stop talking",
  "quiet" -> toggle_speech with state = off.
- "turn on voice replies", "unmute voice replies", "start talking again"
  -> toggle_speech with state = on.
```

---

### `backend/tests/test_agent_schemas.py` (MODIFIED — test, request-response)

**Analog:** itself — `test_toggle_dataset_variant_parses()` (lines 80-86) and `test_toggle_dataset_case_drift_normalizes()` (lines 125-129 shown, continues to ~132).

**Exact tests to mirror**:
```python
def test_toggle_dataset_variant_parses():
    out = AgentOutput.model_validate(
        {"result": {"action": "toggle_dataset", "dataset": "labs", "state": "on"}}
    )
    assert isinstance(out.result, ToggleDataset)
    assert out.result.dataset == "labs"
    assert out.result.state == "on"
```
```python
def test_toggle_dataset_case_drift_normalizes():
    out = AgentOutput.model_validate(
        {"result": {"action": "Toggle_Dataset", "dataset": "INCIDENTS", "state": "OFF"}}
    )
    assert isinstance(out.result, ToggleDataset)
    ...  # (continues past the read window; asserts lowercased dataset/state)
```
`test_toggle_speech_variant_parses()` and `test_toggle_speech_case_drift_normalizes()` mirror these exactly, minus the `dataset` field. Also extend `test_system_prompt_enumerates_overlay_dataset_tokens()`-style coverage (line 253) with a new assertion that `"toggle_speech"` appears in `SYSTEM_PROMPT`, matching that existing test's convention of checking token presence in the prompt string.

---

### `backend/tests/test_agent_service.py` (MODIFIED — test, request-response)

**Analog:** itself — `test_toggle_dataset_maps_to_applied_filters_and_marks_reachable()` (lines 163-175).

**Exact test to mirror**:
```python
def test_toggle_dataset_maps_to_applied_filters_and_marks_reachable(monkeypatch) -> None:
    parsed_output = AgentOutput(
        result={"action": "toggle_dataset", "dataset": "incidents", "state": "off"}
    )
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": parsed_output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("hide incidents", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.overlayDataset == "incidents"
    assert reply.filters.overlayState == "off"
```
`test_toggle_speech_maps_to_applied_filters_and_marks_reachable()` mirrors this exactly: `result={"action": "toggle_speech", "state": "off"}`, then `assert reply.filters.speechEnabled == "off"`.

## Shared Patterns

### Guarded localStorage read/write (persistence)
**Source:** `frontend/src/store/theme.ts` lines 14-32
**Apply to:** `frontend/src/store/speech.ts`'s `readStoredEnabled()`/`storeEnabled()`
Both directions wrapped in `try { ... } catch { /* degrade gracefully */ }`; read defaults to a safe value on any failure (theme → `"light"`, speech → `true`/on per TTS-02); write silently no-ops on failure — never throws, never blocks bootstrap.

### One shared boolean written from two entry points, read identically everywhere
**Source:** `frontend/src/store/agentStatus.ts` (full file, esp. header comment lines 1-16)
**Apply to:** `frontend/src/store/speech.ts`'s `isSpeaking` field and `speak()` action
Both `CommandBar.onApplied` and `useVoiceCommand.handleSuccess`'s `case "applied"` branch call the exact same store action with the exact same computed `msg` string — no divergent branch, no separate voice/text variant field. This is the same shape `agentStatus.ts` already uses for `reportOutcome()`.

### Monotonic seq-guard against stale async events
**Source:** `frontend/src/hooks/useVoiceCommand.ts` lines 79, 102, 125-127, 158, 178, 238 (`seqRef`, `capturedSeq !== seqRef.current` early-return)
**Apply to:** `store/speech.ts`'s `speak()`/`finish()` (guarding against Safari's unreliable `cancel()`→`onend`/`onerror` firing after a newer utterance has already started, RESEARCH Pitfall 2)

### Non-color-only status triad (word + icon + never color alone)
**Source:** `frontend/src/components/CommandBar.tsx` lines 200-226 (`lineText`/`lineGreen`/`lineGlyph`) and lines 281-289 (existing Working indicator JSX)
**Apply to:** The new "Speaking…" indicator block (D-05) — word "Speaking…" + `Volume2` icon (`aria-hidden`), no color-only signal. Exact JSX locked in `10-UI-SPEC.md`.

### Header-right toggle button contract (icon + text, `aria-pressed`, ≥48px, bordered not accent-filled)
**Source:** `frontend/src/components/Header.tsx` lines 157-170 (Theme toggle)
**Apply to:** The new Voice Replies toggle button — identical `className`, `aria-pressed` attribute, `min-h-12` floor, `border-2 border-[var(--color-ink)] bg-[var(--color-sky)]` surface (never `--color-accent` fill).

### Server-composed filter delta, single fan-out point
**Source:** `frontend/src/lib/agent.ts` `applyAgentFilters()` lines 43-87 (the `!= null` present-value-delta branch style)
**Apply to:** The new `speechEnabled` branch — same function, same style, the ONE place any server-composed `AppliedFilters` field reaches ANY store (not just `useFilters`).

### Claude-facing explicit on/off toggle schema (never a flip)
**Source:** `backend/app/agent/schemas.py` `ToggleDataset` (lines 134-141) + its `AgentOutput` union registration (143-153) + its `AppliedFilters` field pair (216-217) + its `service.py` mapper (209-214) + its `interpret()` branch (245-246)
**Apply to:** The entire backend `ToggleSpeech` implementation — schema, union member, `AppliedFilters` field, mapper function, `interpret()` branch, and system-prompt vocabulary block all mirror `ToggleDataset`'s five touch-points exactly, just without the extra `dataset` discriminator field.

### Test-double-for-jsdom convention (static instance registry + `vi.fn()` + `install*()` helper)
**Source:** `frontend/src/tests/fakeRecognition.ts` (full file)
**Apply to:** `frontend/src/tests/fakeSpeechSynthesis.ts` (NEW) — same static `instances` array, same `vi.fn()`-wrapped methods, same `installFake*()` reset-and-return-getter helper shape.

### Zustand-store-tested-directly-via-getState() (no React render needed)
**Source:** `frontend/src/store/agentStatus.test.ts` (full file, `beforeEach` reset + `describe`/`it` per action)
**Apply to:** `frontend/src/store/speech.test.ts` (NEW).

## No Analog Found

None. Every file in this phase's scope has a direct, verified, byte-for-byte structural analog already in the codebase — this is a continuation phase (Phase 10 on top of Phases 4/6/9's established patterns), not a greenfield surface. Where RESEARCH.md's own Code Examples section provides a complete implementation skeleton (`store/speech.ts`, `fakeSpeechSynthesis.ts`), that skeleton has been verified above against the real analog files it claims to mirror, and each verified correspondence is cited with real line numbers rather than trusted at face value.

## Metadata

**Analog search scope:** `frontend/src/{store,hooks,components,lib,api,tests}/`, `backend/app/agent/`, `backend/tests/` — the complete set of directories RESEARCH.md's "Recommended Project Structure" names for this phase.
**Files scanned:** 14 source files read in full (all ≤ 320 lines; single-pass reads, no re-reads), plus 2 backend test files grepped for exact line numbers before targeted reads.
**Pattern extraction date:** 2026-08-22
