# Phase 4: Voice Capture - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 8 (3 new source, 1 modified source, 4 test/helper files)
**Analogs found:** 8 / 8 (2 exact, 4 role-match, 2 partial — recognizer lifecycle has no analog)

This phase is ~80% reuse. The entire command path (`postAgent` → `useAgent` → `applyAgentFilters` → `composeConfirmation` → zustand store) already exists and is consumed **unchanged** (VOICE-08 by design). The only genuinely new code is a browser-recognizer lifecycle hook + pure helpers, and UI added to the existing `CommandBar`. Every new file has a close in-repo analog **except** the raw `webkitSpeechRecognition` lifecycle loop (Pattern 2 in RESEARCH), which is novel to the codebase — copy structure from `useAgent.ts` for the mutation wiring but follow RESEARCH §Architecture Patterns for the recognizer state machine.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/lib/voice.ts` (NEW) | utility | transform | `frontend/src/lib/agent.ts` | exact (pure, unit-tested helpers) |
| `frontend/src/hooks/useVoiceCommand.ts` (NEW) | hook | streaming / event-driven | `frontend/src/hooks/useAgent.ts` (mutation wiring) + `CommandBar.tsx` (call-site orchestration) | partial (lifecycle loop has no analog) |
| `frontend/src/components/CommandBar.tsx` (MODIFIED) | component | request-response | itself + `frontend/src/components/FilterBar.tsx` (motion-safe pulse) | exact (extend in place) |
| `frontend/src/lib/voice.test.ts` (NEW) | test | transform | `frontend/src/lib/agent.test.ts` | exact (pure-helper unit test) |
| `frontend/src/hooks/useVoiceCommand.test.ts` (NEW) | test | event-driven | `frontend/src/components/CommandBar.test.tsx` (mock injection) | role-match |
| `frontend/src/lib/agent-parity.test.ts` (NEW) | test | transform | `frontend/src/lib/agent.test.ts` (real-store enumeration) | role-match |
| `frontend/src/tests/fakeRecognition.ts` (NEW helper) | test-util | event-driven | `frontend/src/tests/setup.ts` (test-global setup) | partial (RESEARCH §Code Examples provides the shape) |
| `frontend/src/components/CommandBar.test.tsx` (MODIFIED) | test | request-response | itself | exact (extend in place) |

**Cross-check target (read-only, not modified):** `backend/app/agent/schemas.py` — `ChartToken`, `BPCategoryToken`, `AppliedFilters` literals must stay verbatim-equal to the frontend unions the parity test enumerates. No new command vocabulary is added (D-15).

**No new runtime dependency.** RESEARCH recommends the custom hook over `react-speech-recognition`; `package.json` is NOT modified on the recommended path.

## Pattern Assignments

### `frontend/src/lib/voice.ts` (utility, transform)

**Analog:** `frontend/src/lib/agent.ts` — the established home for pure, backend-free, unit-tested helpers that the hook and components consume unchanged. Keep `WAKE_WORD`, `extractCommand`/`stripWakeWord`, `classifyError`, `isIOS`, and the backoff schedule here as pure functions so they test without a DOM (RESEARCH §Recommended Structure).

**Imports/module-doc pattern** — `agent.ts` lines 1-13 show the convention: a header comment stating the trust boundary + which decisions it satisfies, then type-only imports from `../api/types`. Mirror this. `voice.ts` needs no zustand import (it is logic-only; the hook wires it to the store).

**Pure-function + named-const pattern** (`agent.ts` lines 79-84, 88-94): module-level `const` maps and small pure functions with a doc comment citing the deciding requirement. Follow verbatim for `WAKE_WORD` (D-04 single named constant) and `extractCommand` (D-02/D-03/D-10). RESEARCH §Pattern 3 gives the exact `extractCommand` body; RESEARCH §Pattern 2 gives `classifyError`; RESEARCH §Code Examples gives `isIOS`/feature-detect.

**Present-value discipline to imitate** (`agent.ts` lines 51-72): note the `!= null` guard ("`all` is a valid present value, so truthiness would be wrong"). The same care applies to `extractCommand` returning `""` vs `null` — untriggered → `null` (ignore), triggered-but-empty → distinct from a real command.

---

### `frontend/src/hooks/useVoiceCommand.ts` (hook, streaming / event-driven)

**Analog (mutation wiring):** `frontend/src/hooks/useAgent.ts` — the whole file is 10 lines:
```typescript
import { useMutation } from "@tanstack/react-query";
import { postAgent } from "../api/client";
export function useAgent() {
  return useMutation({ mutationFn: postAgent });
}
```
The voice hook does NOT re-wrap `postAgent`; it **calls the existing `useAgent().mutate`** and supplies the captured command string, exactly as `CommandBar.onSubmit` does today.

**Analog (dispatch + reply handling):** `frontend/src/components/CommandBar.tsx` lines 136-143 (`onSubmit`) and 85-97 (`onApplied`) are the template for what happens when a command fires:
```typescript
function onSubmit(e) {
  const trimmed = text.trim();
  if (trimmed === "") return;
  setStatus("working");
  mutate({ text: trimmed, context: clarifyContext }, { onSuccess, onError });
}
```
Voice replaces `text.trim()` with `extractCommand(finalTranscript)` and reuses the SAME `mutate(...)` call, `onSuccess`, `onApplied`, and `onError`. **`applyAgentFilters` (agent.ts line 38) is the ONLY store mutation surface** — the voice hook must route through it, never touch `useFilters.setState` directly (RESEARCH Anti-Pattern; agent.ts doc lines 1-7).

**NEWEST-WINS seq guard (D-05) — NO in-repo analog, follow RESEARCH §Pitfall 7:** the codebase has no cancellation guard today (single text submit can't race). Add an explicit monotonic ref counter: capture `seq = ++current` at dispatch, and in `onSuccess` `if (seq !== current) return;` **before** calling `applyAgentFilters`. Do NOT rely on TanStack's latest-invocation observer state for correctness.

**RECOGNIZER LIFECYCLE (D-12 restart loop) — NO in-repo analog:** this is the novel surface. Follow RESEARCH §Pattern 1 (singleton `new (window.SpeechRecognition ?? window.webkitSpeechRecognition)()`, `continuous`/`interimResults`/`lang`), §Pattern 2 (`onend`/`onerror` restart with `classifyError` + backoff + `try/catch` around `start()` for `InvalidStateError`), and §Pitfalls 1-8. The initial `rec.start()` MUST be called synchronously inside the caregiver's tap handler (D-01 user gesture). Use `useRef` for the recognizer instance and the `armed`/`seq` flags so handlers stay stable across renders.

**Cleanup convention** (`CommandBar.tsx` lines 77-83, `FilterBar.tsx` lines 66-71): every `setInterval`/`setTimeout`/subscription returns a teardown from `useEffect`. Apply to the restart timer, `visibilitychange`/`focus` listeners (Pitfall 2), and `rec.abort()` on unmount.

---

### `frontend/src/components/CommandBar.tsx` (component, request-response) — MODIFIED IN PLACE

**Analog:** itself. Extend the existing `Status` state machine (`"idle" | "working" | "confirmed" | "clarify" | "error"`, line 34) with voice sub-states; do NOT add a second component (D-06).

**Existing form row to extend** (lines 158-175): the mic `<button>` joins the SAME `flex flex-wrap items-center gap-3` row alongside the input and Send button. Copy the ≥48px + token pattern from the Send button (line 168-174):
```tsx
<button type="submit" disabled={working}
  className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)] disabled:opacity-70">
  Send
</button>
```
Mic button uses `min-h-12 min-w-12` (or `h-14 w-14`, UI-SPEC §Spacing), an ink-bordered `--color-sky`/`--color-foam` surface (NOT accent-filled by default, UI-SPEC §Color), a `lucide-react` `Mic`/`MicOff` glyph, and a **state-dependent `aria-label`** (`"Start voice control"` / `"Stop voice control"`, UI-SPEC §Copywriting) — never a placeholder-derived name.

**Working-ring pattern to reuse** (lines 153-157): the bar already toggles `ring-2 ring-[var(--color-accent)]` for WORKING. Retain it for the voice working state; ADD a green ring for armed/listening:
```tsx
className={`py-4 ${working ? "rounded-lg ring-2 ring-[var(--color-accent)]" : ""}`}
```

**Motion-safe pulse pattern (D-09) — copy from `FilterBar.tsx` lines 75-78:**
```typescript
const pulseClass = (field: PulseField) =>
  pulsing.includes(field)
    ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
    : "";
```
The LISTENING ring uses `motion-safe:animate-pulse` with a static `ring-2` fallback; WORKING reuses the existing spinner. Use `var(--cat-normal)` (green) for LISTENING and `var(--cat-elevated)` (amber) for WORKING rings/transcript (UI-SPEC §Color state table) — never a hardcoded hex.

**Spinner glyph to reuse verbatim** (lines 179-187): the existing hand-rolled border-spinner already covers WORKING…; the voice path reuses it (UI-SPEC §Color allows `Loader2` OR the existing spinner).

**aria-live region to reuse** (lines 193-205): state-word announcements (`LISTENING`/`WORKING…`/`Voice paused`) and the live transcript route through the EXISTING `aria-live="polite"` region. The confirmation still **replaces** the transcript in this one spot (D-11). Icons stay `aria-hidden` (existing MARKER convention, lines 55-61) — color+word+icon triad, never color alone (D-07).

**Fixed friendly-copy discipline to extend** (lines 46-50, 129-134): D-14 hard-failure copy (`"Voice paused — tap to resume"`) joins `RATE_LIMIT_COPY`/`OFFLINE_COPY` as a fixed local string. Raw recognizer error strings NEVER render (VOICE-07 / RESEARCH §Security V7). The text input stays fully usable in the paused state (VOICE-08 fallback, D-14).

---

### `frontend/src/lib/voice.test.ts` (test, transform)

**Analog:** `frontend/src/lib/agent.test.ts` — pure-helper unit tests with a real store where needed.

**Structure to copy** (lines 5-26): `import { beforeEach, describe, expect, it } from "vitest"`, a `beforeEach` that resets any shared state to defaults, table-style `it("does X (D-0N)", ...)` cases naming the deciding decision. For `voice.ts` most helpers are stateless, so no store reset is needed — pure `extractCommand`/`classifyError`/`isIOS` assertions. RESEARCH §Validation Architecture maps the exact cases (wake-word gate, strip, error classification).

---

### `frontend/src/hooks/useVoiceCommand.test.ts` (test, event-driven)

**Analog:** `frontend/src/components/CommandBar.test.tsx` — the established pattern for testing the mutation path with a real store and a single mock at the boundary.

**Mock-only-the-boundary pattern to copy** (CommandBar.test.tsx lines 22-28): keep the real module, replace only the outermost dependency:
```typescript
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, postAgent: vi.fn() };
});
```
Use the SAME approach: real `useAgent`, real `QueryClientProvider` (lines 40-49), real zustand stores reset in `beforeEach` (lines 61-71), `postAgent` mocked. This lets the seq-guard (D-05) and restart-loop assertions run end-to-end against real store effects.

**NEW: `FakeRecognition` global injection** — no in-repo analog; RESEARCH §Code Examples gives the class (`start`/`stop`/`abort` as `vi.fn()`, `emitResult`/`emitError` drivers). Assign `(window as any).webkitSpeechRecognition = FakeRecognition` in `beforeEach`, mirroring how `setup.ts` registers globals. Extract the fake into the shared helper below.

**never-resolving-promise trick to reuse** (CommandBar.test.tsx line 94): `mockPostAgent.mockReturnValue(new Promise<AgentReply>(() => {}))` holds the hook in WORKING to assert in-flight/cancellation behavior for the newest-wins test.

---

### `frontend/src/lib/agent-parity.test.ts` (test, transform) — VOICE-05 / ACC-03 lockstep

**Analog:** `frontend/src/lib/agent.test.ts` — real-store enumeration. RESEARCH §Validation Architecture specifies the exact test.

**Real-store assertion pattern to copy** (agent.test.ts lines 17-25, 47-50): reset `useFilters` in `beforeEach`, call `applyAgentFilters({ <field> })`, assert `useFilters.getState().<slice>` changed. Enumerate the FULL unions so a future chart/category/preset with no command path breaks the build:
- `ChartId` × 4 (`api/types.ts` lines 51-55)
- `BPCategory` × 6 + `"all"` (`api/types.ts` lines 7-13)
- `datePreset` × 4 (`AppliedFilters`, `api/types.ts` line 81)
- `amPm` × 3 (line 82)
- Store actions: `setActiveChart`, `setDatePreset`, `setCustomRange`, `setAmPm`, `setBpCategory`, `showAllData` (`store/filters.ts` lines 24-29)

**Cross-check (read-only):** assert the frontend unions equal `backend/app/agent/schemas.py` `ChartToken` (line 38) and `AppliedFilters` literals (lines 191-197) verbatim — they are the single vocabulary (D-15). A drift here means a filter is voice-unreachable (ACC-03 failure).

---

### `frontend/src/tests/fakeRecognition.ts` (test-util, event-driven) — NEW helper

**Analog:** `frontend/src/tests/setup.ts` (test-global registration convention — thin, single-purpose). The class body itself has no analog; copy it from RESEARCH §Code Examples ("Injecting a fake recognizer for tests"). Place in `src/tests/` for reuse by both `useVoiceCommand.test.ts` and the extended `CommandBar.test.tsx`. Expose `emitResult(transcript, isFinal)` and `emitError(error)` drivers so tests synthetically fire `onresult`/`onend`/`onerror`.

## Shared Patterns

### Store mutation — single surface (applies to: useVoiceCommand.ts, agent-parity.test.ts)
**Source:** `frontend/src/lib/agent.ts` lines 38-77 (`applyAgentFilters`)
The zustand filter store is the SOLE mutation surface. Voice routes every applied command through `applyAgentFilters`, never `useFilters.setState`. The D-05 newest-wins guard must DROP stale replies *before* this call.
```typescript
// agent.ts — reset-first then present-value deltas, from OUTSIDE the React tree:
export function applyAgentFilters(f: AppliedFilters): PulseField[] {
  const s = useFilters.getState();
  if (f.reset) { s.showAllData(); /* ...touch all groups... */ }
  if (f.activeChart != null) { s.setActiveChart(f.activeChart); /* ... */ }
  // ...
}
```

### Reuse the mutation, don't re-wrap it (applies to: useVoiceCommand.ts)
**Source:** `frontend/src/hooks/useAgent.ts` (whole file) + `CommandBar.tsx` lines 136-143
Voice supplies a string to the SAME `useAgent().mutate({ text, context }, { onSuccess, onError })`. No new fetch, no new mutation, no new confirmation (VOICE-08 / RESEARCH §Don't Hand-Roll).

### Fixed friendly copy for every failure (applies to: CommandBar.tsx, useVoiceCommand.ts)
**Source:** `frontend/src/components/CommandBar.tsx` lines 46-50, 129-134
```typescript
const RATE_LIMIT_COPY = "One moment — a lot of commands at once. Try again in a few seconds.";
const OFFLINE_COPY = "Couldn't reach the assistant. The buttons below still work. Try: 'show my pulse'.";
// onError: setMessage(rateLimited ? RATE_LIMIT_COPY : OFFLINE_COPY);
```
Add D-14 `"Voice paused — tap to resume"` as a peer constant. Raw `ApiError`/recognizer error strings NEVER render (VOICE-07, RESEARCH §Security V7). Do NOT `console.log` transcripts (privacy, SEC-03).

### Motion-safe animation with static fallback (applies to: CommandBar.tsx)
**Source:** `frontend/src/components/FilterBar.tsx` lines 60-78 (`pulseClass`)
```typescript
? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
: ""
```
LISTENING pulse and WORKING spin are gated behind `motion-safe:`; under `prefers-reduced-motion` they collapse to a solid ring / static glyph (D-09). Use `var(--cat-normal)` / `var(--cat-elevated)` tokens (UI-SPEC §Color) — zero new colors/hex.

### aria-hidden icon + aria-live text (applies to: CommandBar.tsx)
**Source:** `frontend/src/components/CommandBar.tsx` lines 55-61 (MARKER), 193-205 (live region)
The state WORD is the announced text in `aria-live="polite"`; the glyph is `aria-hidden` visual reinforcement. Color + word + icon together, never color alone (D-07).

### Test the boundary, keep everything else real (applies to: useVoiceCommand.test.ts, CommandBar.test.tsx)
**Source:** `frontend/src/components/CommandBar.test.tsx` lines 22-28, 40-71
Mock only `postAgent`; real `useAgent`, real `QueryClientProvider`, real zustand stores reset in `beforeEach`, real `ApiError` (so `instanceof` works). For voice, inject `FakeRecognition` as the browser-API boundary.

## No Analog Found

Genuinely novel surfaces — follow RESEARCH.md, not an in-repo file:

| File / Concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| `useVoiceCommand.ts` recognizer lifecycle (singleton, `onend`/`onerror` restart loop, `classifyError`, backoff, `visibilitychange` guards, `InvalidStateError` catch) | hook | event-driven / streaming | No existing code touches `webkitSpeechRecognition`; the restart loop is the phase's #1 device-test risk. Copy structure from RESEARCH §Architecture Patterns 1-2 + §Pitfalls 1-8. |
| D-05 monotonic seq / stale-response guard | hook | event-driven | No concurrency race exists in the current single-text-submit path; implement per RESEARCH §Pitfall 7. |
| `FakeRecognition` test-double class body | test-util | event-driven | jsdom has no `SpeechRecognition`; copy from RESEARCH §Code Examples. |
| SpeechRecognition ambient TS types (`window.webkitSpeechRecognition`) | types | — | Not in `vite-env.d.ts` today; the planner may add a minimal ambient declaration (or `as any` cast per RESEARCH examples). |

## Metadata

**Analog search scope:** `frontend/src/{lib,hooks,components,store,api,tests}`, `backend/app/agent/`
**Files scanned:** 15 (read: CommandBar.tsx, useAgent.ts, lib/agent.ts, api/client.ts, api/types.ts, store/filters.ts, FilterBar.tsx §55-92, tests/setup.ts, CommandBar.test.tsx, agent.test.ts §1-50, backend schemas.py, App.tsx grep)
**Pattern extraction date:** 2026-07-21
