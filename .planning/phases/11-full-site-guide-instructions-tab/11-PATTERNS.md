# Phase 11: Full Site Guide / Instructions Tab - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 10 (7 new, 3 modified-in-place; plus 2 test-file analogs noted per new module)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/agent/schemas.py` (add `ToggleGuide`, register in `AgentOutput`) | model (Pydantic schema, modify-in-place) | request-response | `ToggleDataset`/`ToggleSpeech` in the same file | exact (same file, same shape family) |
| `backend/app/agent/prompt.py` (add vocabulary block, modify-in-place) | config (prompt text, modify-in-place) | request-response | `toggle_speech` block in `SYSTEM_PROMPT` (same file) | exact |
| `backend/app/agent/copy.py` (add `toggle_guide_message`, modify-in-place) | utility (fixed-copy templates, modify-in-place) | transform | `toggle_speech_message`/`toggle_dataset_message` (same file) | exact |
| `backend/app/agent/service.py` (add `_apply_toggle_guide` branch, modify-in-place) | service (interpretation pipeline, modify-in-place) | request-response | `_apply_toggle_speech` (same file) | exact |
| `frontend/src/api/types.ts` (add `guideOpen` field to `AppliedFilters`, modify-in-place) | model (TS type mirror, modify-in-place) | transform | `speechEnabled` field (same file) | exact |
| `frontend/src/store/guide.ts` (new) | store | event-driven | `frontend/src/store/view.ts` (shape) + `frontend/src/store/speech.ts` (`enabled`/`setEnabled` naming convention) | role-match (two blended analogs, see below) |
| `frontend/src/lib/voiceCommands.ts` (new, extraction target of D-08) | utility | transform | `frontend/src/agent/copy.py`'s `EXAMPLE_COMMANDS`-in-TS-form has no direct TS analog; closest is `frontend/src/lib/overlayMeta.ts`-style static exported const/lookup table | role-match |
| `frontend/src/components/GuideOverlay.tsx` (new) | component | request-response (renders static content + reads 2 stores) | `Header.tsx`'s `LogoutConfirmDialog` (closest "overlay mounted alongside dashboard" precedent) + `OverlayToggle.tsx` (chip-row/ToC visual pattern) | role-match (blended) |
| `frontend/src/components/Header.tsx` (add Guide button, modify-in-place) | component | request-response | Theme toggle / Voice Replies toggle buttons (same file) | exact |
| `frontend/src/components/CommandBar.tsx` (replace inline `EXAMPLES` with import, modify-in-place) | component | request-response | itself, pre-extraction (same file) | exact |
| `frontend/src/App.tsx` (mount `<GuideOverlay />`, raise CommandBar band z-index, modify-in-place) | component (composition root) | request-response | `Dashboard()`'s existing CommandBar band `<section className="bg-[var(--color-sky)]">` (same file) | exact |
| `frontend/src/lib/agent.ts` (add `guideOpen` branch to `applyAgentFilters`, modify-in-place) | utility (pure store-fanout) | transform | the `speechEnabled` branch in the same function (same file) | exact |

## Pattern Assignments

### `backend/app/agent/schemas.py` — add `ToggleGuide` (model, request-response)

**Analog:** `ToggleSpeech` (lines 143-150 of the same file) — simplest possible precedent since guide open/close, like speech mute, has no secondary discriminator (no dataset token needed).

**Exact template to copy** (`backend/app/agent/schemas.py:143-150`):
```python
class ToggleSpeech(BaseModel):
    """Spoken-replies mute/unmute — explicit on/off state (D-01), mirrors
    ToggleDataset exactly except there is only one toggleable concept (no
    dataset discriminator): single-valued (never a flip/toggle)."""

    action: Literal["toggle_speech"]
    state: Literal["on", "off"]
```

New sibling class (following D-05's "explicit `Literal["open","closed"]` state, never a flip/toggle" — note CONTEXT.md names the states `open`/`closed`, NOT `on`/`off` like the two precedents, so do not blindly copy `"on"/"off"` here):
```python
class ToggleGuide(BaseModel):
    """Site-guide overlay open/close — explicit state (D-05), mirrors
    ToggleSpeech exactly except the vocabulary is open/closed, not on/off,
    matching the overlay's own visibility semantics."""

    action: Literal["toggle_guide"]
    state: Literal["open", "closed"]
```

**Registration point** — `AgentOutput.result` union (lines 152-163): add `ToggleGuide` as an eighth member, alongside the existing seven, exactly where `ToggleDataset`/`ToggleSpeech` were appended:
```python
class AgentOutput(BaseModel):
    result: (
        DashboardCommand
        | DataQuestion
        | Clarification
        | MedicalRefusal
        | Unintelligible
        | ToggleDataset
        | ToggleSpeech
        | ToggleGuide          # <-- new
    )
```
The `_lower_tokens`/`_lower_value` validator (lines 165-185) is generic over any dict — no change needed; `"open"`/`"closed"` lowercase-normalize automatically like every other token.

**AppliedFilters mirror** (lines 216-229) — add one field next to `speechEnabled`:
```python
    speechEnabled: Literal["on", "off"] | None = None
    guideOpen: Literal["open", "closed"] | None = None   # <-- new, own vocabulary
```

**Test analog:** `backend/tests/test_agent_schemas.py:90-95` (`test_toggle_speech_variant_parses`) — copy this shape for a `test_toggle_guide_variant_parses` test, and mirror `test_toggle_speech_case_drift_normalizes` (line 143) for the lowercase-drift test.

---

### `backend/app/agent/prompt.py` — add guide vocabulary (config, request-response)

**Analog:** the `toggle_speech` teaching block (`backend/app/agent/prompt.py:49-53`):
```python
Spoken-reply toggle (use exactly this action, never toggle_dataset):
- "mute the voice replies", "turn off voice replies", "stop talking",
  "quiet" -> toggle_speech with state = off.
- "turn on voice replies", "unmute voice replies", "start talking again"
  -> toggle_speech with state = on.
```

New block to add immediately after it (mirrors the fixed-vocabulary teaching style — natural-language triggers mapped to exact tokens, per D-05/D-06's "open/close only, no section-jumping"):
```
Site guide overlay (use exactly this action, never any other):
- "open the guide", "show me the guide", "how do I use this", "help" ->
  toggle_guide with state = open.
- "close the guide", "hide the guide", "close help" -> toggle_guide with
  state = closed.
```
Per D-06, do NOT add any section-name vocabulary (e.g. "what can I say") that would imply deep-linking — the action vocabulary stays exactly two states.

**SYSTEM_PROMPT test analog:** `test_system_prompt_enumerates_toggle_speech_token` (`backend/tests/test_agent_schemas.py:275`) — mirror this for a `test_system_prompt_enumerates_toggle_guide_token` assertion (`"toggle_guide" in SYSTEM_PROMPT`).

---

### `backend/app/agent/copy.py` — add `toggle_guide_message` (utility, transform)

**Analog:** `toggle_speech_message` (`backend/app/agent/copy.py:72-76`):
```python
def toggle_speech_message(state: str) -> str:
    """Compose the D-01 mute/unmute confirmation (WR-06) — composeConfirmation()
    only describes chart/date/am-pm/category state, so this is the only place
    that acknowledges the toggle a voice-only user just asked for."""
    return "Voice replies are now on." if state == "on" else "Voice replies are now off."
```

New function (same rationale — `composeConfirmation()` on the frontend has no guide awareness):
```python
def toggle_guide_message(state: str) -> str:
    """Compose the D-05 guide open/close confirmation (WR-06 rationale) —
    composeConfirmation() has no guide awareness, so this is the only place
    that acknowledges the open/close a voice-only user just asked for."""
    return "Opening the guide." if state == "open" else "Closing the guide."
```

---

### `backend/app/agent/service.py` — add `_apply_toggle_guide` (service, request-response)

**Analog:** `_apply_toggle_speech` (`backend/app/agent/service.py:231-243`):
```python
def _apply_toggle_speech(cmd: ToggleSpeech) -> AgentReply:
    """Map a ``ToggleSpeech`` result to an ``applied`` reply (D-01)."""
    filters = AppliedFilters(speechEnabled=cmd.state)
    return AgentReply(
        kind="applied",
        filters=filters,
        message=toggle_speech_message(cmd.state),
        context=None,
    )
```

New sibling:
```python
def _apply_toggle_guide(cmd: ToggleGuide) -> AgentReply:
    """Map a ``ToggleGuide`` result to an ``applied`` reply (D-05)."""
    filters = AppliedFilters(guideOpen=cmd.state)
    return AgentReply(
        kind="applied",
        filters=filters,
        message=toggle_guide_message(cmd.state),
        context=None,
    )
```

**Dispatch point** — `interpret()`'s isinstance chain (`backend/app/agent/service.py:274-278`):
```python
        if isinstance(result, ToggleDataset):
            return _apply_toggle_dataset(result)

        if isinstance(result, ToggleSpeech):
            return _apply_toggle_speech(result)

        if isinstance(result, ToggleGuide):   # <-- new, same position/shape
            return _apply_toggle_guide(result)
```
Also add `ToggleGuide` to the `from app.agent.schemas import (...)` block (line 47-62) and `toggle_guide_message` to the `from app.agent.copy import (...)` block (lines 37-44).

**Test analog:** `backend/tests/test_agent_service.py:179-189` (`test_toggle_speech_maps_to_applied_filters_and_marks_reachable`) — copy verbatim shape:
```python
def test_toggle_speech_maps_to_applied_filters_and_marks_reachable(monkeypatch) -> None:
    parsed_output = AgentOutput(result={"action": "toggle_speech", "state": "off"})
    fake_msg = type("FakeMsg", (), {"stop_reason": "end_turn", "parsed_output": parsed_output})()
    fake = _make_fake_client(lambda **kwargs: fake_msg)
    monkeypatch.setattr(service, "_get_client", lambda: fake())

    reply = service.interpret("mute the voice replies", None, None, None)

    assert reply.kind == "applied"
    assert reply.filters.speechEnabled == "off"
    assert service._last_outcome is True
```

---

### `frontend/src/api/types.ts` — mirror `guideOpen` field (model, transform)

**Analog:** `speechEnabled` field, `frontend/src/api/types.ts:159-169`:
```typescript
export type AppliedFilters = {
  activeChart?: ChartId | null;
  datePreset?: "7d" | "30d" | "90d" | "all" | null;
  customRange?: { from: string; to: string } | null;
  amPm?: "all" | "AM" | "PM" | null;
  bpCategory?: "all" | BPCategory | null;
  overlayDataset?: OverlayDataset | null;
  overlayState?: "on" | "off" | null;
  speechEnabled?: "on" | "off" | null;
  reset?: boolean;
};
```
Add `guideOpen?: "open" | "closed" | null;` — byte-for-byte mirror of the backend `AppliedFilters.guideOpen` Literal (this file is explicitly documented elsewhere as a "byte-for-byte mirror" of the backend model; follow that same discipline).

---

### `frontend/src/store/guide.ts` (new) — store, event-driven

**Two blended analogs** — neither alone is the right shape:

1. **Shape/naming convention** from `frontend/src/store/speech.ts`'s `enabled`/`setEnabled` pair (`frontend/src/store/speech.ts:61-95`, excerpted):
```typescript
interface SpeechState {
  enabled: boolean;
  ...
  setEnabled: (enabled: boolean) => void; // used by the header toggle (click-driven) and the agent's ToggleSpeech action
  toggleEnabled: () => void; // used by the header button
  ...
}

export const useSpeech = create<SpeechState>((set, get) => ({
  enabled: true,
  ...
  setEnabled: (enabled) => {
    storeEnabled(enabled);
    if (!enabled) get().cancelForBackground();
    set({ enabled });
  },
  toggleEnabled: () => get().setEnabled(!get().enabled),
  ...
}));
```

2. **Persistence decision** from `frontend/src/store/view.ts` (whole file, 20 lines) — the guide's open/closed state should almost certainly follow `view.ts`'s EPHEMERAL pattern (no localStorage), not `speech.ts`'s persisted pattern: nothing in CONTEXT.md/UI-SPEC.md asks for the guide to reopen automatically on reload, and D-01 frames it as a per-session overlay, not a durable preference.
```typescript
// zustand view store (D-05) — swaps the two post-auth caregiver surfaces
// ("dashboard" | "upload") with a plain state flip, NOT react-router (no URL
// change, no Vercel rewrite; 05-RESEARCH.md Pattern 4). Ephemeral by design:
// unlike theme/auth there is NO localStorage persistence — a reload always
// returns to the dashboard. UI state ONLY — server data lives in TanStack Query
// (CLAUDE.md separation).
import { create } from "zustand";

export type View = "dashboard" | "upload" | "records";

interface ViewState {
  view: View;
  go: (view: View) => void;
}

export const useView = create<ViewState>((set) => ({
  view: "dashboard",
  go: (view) => set({ view }),
}));
```

**Recommended new-file shape** (blends both — ephemeral like `view.ts`, but `open`/`setOpen`/`toggleOpen` naming like `speech.ts` so `applyAgentFilters` and `Header`'s click-to-toggle button both have an obvious method to call):
```typescript
// zustand guide store (D-01..D-05) — tracks the full-screen site-guide
// overlay's open/closed state. Ephemeral by design (mirrors store/view.ts,
// NOT store/speech.ts's persisted `enabled`): nothing in 11-CONTEXT.md asks
// the guide to reopen on reload. UI state ONLY.
import { create } from "zustand";

interface GuideState {
  open: boolean;
  setOpen: (open: boolean) => void;   // used by the agent's ToggleGuide action
  toggleOpen: () => void;             // used by the Header "Guide" button
}

export const useGuide = create<GuideState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggleOpen: () => get().setOpen(!get().open),
}));
```

**Test analog:** `frontend/src/store/speech.test.ts` and `frontend/src/store/view.ts` have no dedicated `.test.ts` — check `frontend/src/store/agentStatus.test.ts` for the general zustand-store test shape (create → assert initial state → call action → assert new state).

---

### `frontend/src/lib/agent.ts` — add `guideOpen` branch to `applyAgentFilters` (utility, transform)

**Analog:** the `speechEnabled` branch, `frontend/src/lib/agent.ts:84-88`:
```typescript
  if (f.speechEnabled != null) {
    useSpeech.getState().setEnabled(f.speechEnabled === "on");
    // No touched.add(...) — Voice Replies is not one of FilterBar's five
    // highlighted PulseField groups (RESEARCH: no PulseField exists for it).
  }
```
New sibling branch, same file, same function (`applyAgentFilters`, lines 44-93), same `!= null` present-value-delta discipline; per D-07 ("if Chris issues any other dashboard command while the guide is open, the command applies normally AND the guide auto-closes") this branch should run REGARDLESS of whether other filter branches also fired this call — it is independent, not conditional on `f.reset` or any other field:
```typescript
  if (f.guideOpen != null) {
    useGuide.getState().setOpen(f.guideOpen === "open");
    // No touched.add(...) — the guide isn't a FilterBar pulse group either.
  }
```
Also add the import: `import { useGuide } from "../store/guide";` next to the existing `import { useSpeech } from "../store/speech";` (line 15).

**D-07 auto-close note for the planner:** D-07 requires that ANY other dashboard command (chart/date/am_pm/bp_category/reset/toggle_dataset — anything besides an explicit `toggle_guide`) also closes the guide if it's open. That is NOT naturally satisfied by the branch above alone (the branch above only fires when the server explicitly sends `guideOpen`). The planner should decide where this auto-close side effect lives — the two candidate insertion points, both in `applyAgentFilters`, are: (a) unconditionally at the top of the function, closing the guide whenever ANY field other than `guideOpen` is present in `f`, or (b) inside `CommandBar.onApplied`. Option (a) keeps the "server-composed delta fully drives all guide state" invariant intact and matches this file's existing "one function owns the whole fan-out" shape.

---

### `frontend/src/lib/voiceCommands.ts` (new, D-08 extraction target) — utility, transform

**Extraction source:** `frontend/src/components/CommandBar.tsx:43-48` (the `EXAMPLES` array to be pulled out):
```typescript
// Real commands the box teaches by example (D-02). Kept short and concrete so
// the placeholder reads as an invitation, not documentation.
const EXAMPLES = [
  "show my pulse",
  "last 30 days, mornings only",
  "show blood pressure",
  "show all data",
];
```

**Secondary source to fold in / stay consistent with** — `backend/app/agent/copy.py:12-16`'s `EXAMPLE_COMMANDS` (backend-side fixed copy, already overlapping two of the four `EXAMPLES` items):
```python
EXAMPLE_COMMANDS = [
    "show my pulse",
    "last 30 days, mornings only",
    "show all data",
]
```
These two lists currently drift (backend has 3 items, frontend has 4, phrasing/order differs) — this phase's D-08 does not ask to unify backend/frontend, only to make the FRONTEND side one shared, complete, categorized source. Keep `backend/app/agent/copy.py`'s list untouched; do not attempt to import across the Python/TypeScript boundary.

**Required new shape per D-09 (grouped by category) and UI-SPEC's fixed category order** (`11-UI-SPEC.md` Copywriting Contract, "Voice-command category headings"):
```typescript
// Shared voice-command reference (D-08) — the SINGLE source both CommandBar's
// placeholder rotation and GuideOverlay's "What Can I Say" section import
// from. Fixed category order per 11-UI-SPEC.md; one canonical example phrase
// per category plus the fixed "similar phrasings" note (D-10).
export type VoiceCommandCategory = {
  id: string;
  label: string;
  example: string;
};

export const VOICE_COMMAND_CATEGORIES: VoiceCommandCategory[] = [
  { id: "charts", label: "Switching charts", example: "show my pulse" },
  { id: "date-range", label: "Filtering by date", example: "last 30 days" },
  { id: "am-pm", label: "Filtering by AM or PM", example: "mornings only" },
  { id: "bp-category", label: "Filtering by blood pressure category", example: "show stage 2 readings" },
  { id: "overlay", label: "Showing labs, incidents, and procedures", example: "show incidents" },
  { id: "reset", label: "Starting over", example: "show all data" },
  { id: "speech", label: "Voice replies", example: "mute the voice replies" },
  { id: "guide", label: "Opening this guide", example: "open the guide" },
];

export const SIMILAR_PHRASINGS_NOTE =
  "Similar phrasings work too — you don't need the exact words.";

// Flat placeholder-rotation list for CommandBar (D-02) — derived from the
// categorized source above so there is exactly one authored copy.
export const EXAMPLES = VOICE_COMMAND_CATEGORIES.map((c) => c.example);
```

**CommandBar.tsx change** (`frontend/src/components/CommandBar.tsx:22, 43-48`): remove the inline `const EXAMPLES = [...]` block and add `import { EXAMPLES } from "../lib/voiceCommands";` to the existing import block (near line 29's `import { applyAgentFilters, composeConfirmation } from "../lib/agent";`). No other CommandBar logic changes — `exampleIdx`/rotation effect (lines 97-108) and `placeholder` (line 194) consume `EXAMPLES` exactly as before.

**Exact phrase wording is Claude's Discretion** per CONTEXT.md — the category list/order above is fixed by UI-SPEC; individual example phrases (`"show stage 2 readings"` etc.) are illustrative, not locked.

---

### `frontend/src/components/GuideOverlay.tsx` (new) — component, request-response

**Two blended analogs**, per UI-SPEC's own framing ("closest existing analog... even though sized differently"):

**1. Overlay-alongside-dashboard mechanics** from `LogoutConfirmDialog` (`frontend/src/components/Header.tsx:37-120`) — copy the Escape-handling pattern, NOT the focus-trap or `role="dialog"`/`aria-modal` (UI-SPEC explicitly forbids both for the guide — see below):
```tsx
function LogoutConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    // ... Tab-trap logic — DO NOT COPY this part for GuideOverlay (D-04 in
    // UI-SPEC: "nothing outside the guide region may be marked inert or
    // excluded from the tab order" — CommandBar must stay reachable by Tab)
  }
  ...
```
**What to copy:** the `onKeyDown` Escape-closes pattern only (`event.key === "Escape"` → call the close handler), wired via a `useEffect` adding a `window`/`document` keydown listener (since GuideOverlay is NOT a `role="dialog"` with a local `onKeyDown` on a focused container — UI-SPEC D-04 says no focus trap, so Escape must be a global listener while `open` is true, not a bubbling handler scoped to a focused dialog element):
```tsx
useEffect(() => {
  if (!open) return;
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [open, setOpen]);
```

**What NOT to copy:** `role="dialog"`, `aria-modal="true"`, the Tab-trap `querySelectorAll("button")` focus loop, and the dimmed `bg-black/40` backdrop (`className="fixed inset-0 z-50 ... bg-black/40"`, line 77) — UI-SPEC's stacking contract explicitly requires an OPAQUE `--color-foam` background (not dimmed), `role="region"` + `aria-label="Site guide"` (not `role="dialog"`), and no focus confinement (D-03/D-04 require `CommandBar` to stay Tab-reachable while the guide is open).

**2. Chip-row visual pattern** for the Table of Contents from `OverlayToggle.tsx`'s inactive-chip styling (`frontend/src/components/OverlayToggle.tsx:24-30, 68-92`):
```tsx
const inactiveClass =
  "min-h-12 flex items-center gap-2 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
```
UI-SPEC's own ToC snippet (`11-UI-SPEC.md` lines 257-273) already adapts this into an anchor-link chip row — use that snippet verbatim as the ToC implementation; it is the authoritative, already-resolved version of this pattern for Phase 11.

**Mount point / stacking contract** — see `frontend/src/App.tsx` pattern assignment below; this is the load-bearing integration and is spelled out exhaustively in `11-UI-SPEC.md`'s "Overlay stacking/layering" section (lines 144-187) — treat that section as authoritative over any inference from precedent files, since no existing component in this codebase does a raised-stacking-context + opaque-full-bleed-sibling layout.

**Store reads:** `useGuide((s) => s.open)` and `useGuide((s) => s.setOpen)` (new store above).

---

### `frontend/src/components/Header.tsx` — add "Guide" button (component, request-response)

**Analog:** the Voice Replies toggle button, `frontend/src/components/Header.tsx:184-200` (styling contract to copy verbatim, per D-02 and UI-SPEC's own snippet):
```tsx
{/* Voice Replies toggle (D-02, TTS-02) — mute/quiet control for the
    spoken-confirmation feature; styled identically to the Theme
    toggle above (icon + text, aria-pressed, >=48px, bordered sky
    surface, never accent-filled). */}
<button
  type="button"
  onClick={toggleSpeech}
  aria-pressed={speechEnabled}
  className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
>
  {speechEnabled ? (
    <Volume2 aria-hidden="true" size={24} />
  ) : (
    <VolumeX aria-hidden="true" size={24} />
  )}
  {speechEnabled ? "Voice Replies: On" : "Voice Replies: Off"}
</button>
```

**Exact new button** — UI-SPEC already provides the final markup (`11-UI-SPEC.md` lines 196-210), placed "immediately after the Voice Replies toggle and before Upload/Add Record/Log out" (UI-SPEC line 191-192), i.e. right after the block quoted above and before the `{onDashboard ? (...) : (...)}` view-toggle block at line 202:
```tsx
<button
  type="button"
  onClick={() => setGuideOpen((open) => !open)}
  aria-pressed={guideOpen}
  className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
>
  <BookOpen aria-hidden="true" size={24} />
  Guide
</button>
```
Wire `guideOpen`/`setGuideOpen` from the new `useGuide` store (`const guideOpen = useGuide((s) => s.open); const toggleGuide = useGuide((s) => s.toggleOpen);` — use `onClick={toggleGuide}` rather than an inline arrow, matching how `toggleSpeech`/`toggleTheme` are destructured and passed directly at lines 123-127). Add `BookOpen` to the existing `lucide-react` import block (`frontend/src/components/Header.tsx:15-24`) and add `import { useGuide } from "../store/guide";` next to the existing store imports (lines 26-29).

**Reachability across views (planner's discretion per CONTEXT.md, UI-SPEC recommends universal):** `Header` is already mounted unconditionally in `Dashboard()`, `UploadView()`, and `RecordsView()` (`frontend/src/App.tsx:165, 213, 226`) — adding the button inside `Header.tsx` itself, not conditionally, makes it appear on all three views for free, matching UI-SPEC's recommendation.

---

### `frontend/src/App.tsx` — mount `<GuideOverlay />`, raise CommandBar band (composition root, request-response)

**Analog / exact insertion point:** the existing CommandBar band, `frontend/src/App.tsx:166-175`:
```tsx
{/* Command bar (D-01) — full-width sky band under the header, top billing
    for the primary control. Inner div matches main's content-column
    gutters so the input aligns with the dashboard below. Phase 4 mounts
    the mic button into this same bar. */}
<section className="bg-[var(--color-sky)]">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8 xl:px-16">
    <CommandBar latestReading={latestReading} />
    <AgentStatusBanner />
  </div>
</section>
```
Per `11-UI-SPEC.md`'s stacking contract (point 1, lines 151-160): this `<section>` must gain a raised-stacking-context class ONLY while the guide is open (`relative z-[60]` or similar, reading `useGuide`'s `open`), stay unconditionally rendered (never wrapped in `{guideOpen && ...}`), and never change `CommandBar`'s props/behavior.

**New unconditional sibling** (UI-SPEC point 2, lines 161-170): add `<GuideOverlay />` immediately AFTER this `<section>` (i.e., after line 175, before `<main>` at line 178) inside `Dashboard()`'s returned JSX — never wrapping/replacing/conditionally un-rendering the CommandBar band or `<main>`.

**Why NOT the `useView` hard-swap pattern** (`frontend/src/App.tsx:236-243`, the pattern D-01 explicitly rejects for this phase — included here so the planner/executor sees the exact anti-pattern by name):
```tsx
function App() {
  const token = useAuth((s) => s.token);
  const view = useView((s) => s.view);
  if (token === null) return <LoginGate />;
  if (view === "upload") return <UploadView />;
  if (view === "records") return <RecordsView />;
  return <Dashboard />;
}
```
Each `if (...) return <X />` REPLACES the entire returned tree — this is precisely the mechanism that would unmount `CommandBar` (and kill the live recognizer) if the guide were built as a fourth `view` state. `GuideOverlay` must NOT be wired through `useView`/`go()`; it is purely `useGuide`'s own boolean, rendered as an always-mounted sibling gated on CSS visibility/positioning, never on React conditional mounting of the overlay's presence (the overlay COMPONENT can conditionally render nothing when closed — e.g. `if (!open) return null;` inside `GuideOverlay` itself is fine and is the simplest way to satisfy "renders alongside, not replacing" — what must never happen is `CommandBar`/`Dashboard` itself being replaced).

---

## Shared Patterns

### Explicit-state (never toggle/flip) voice actions
**Source:** `backend/app/agent/schemas.py` `ToggleDataset` (134-141) and `ToggleSpeech` (143-150); `backend/app/agent/prompt.py` lines 41-53; `backend/app/agent/service.py` `_apply_toggle_dataset`/`_apply_toggle_speech` (215-243)
**Apply to:** `ToggleGuide` schema, prompt vocabulary, and `_apply_toggle_guide` service branch — every new voice-driven state change in this phase uses an explicit closed-enum `state` field (`open`/`closed`), never a bare flip.
```python
action: Literal["toggle_guide"]
state: Literal["open", "closed"]
```

### Fixed friendly copy, never raw model/error text (VOICE-07)
**Source:** `backend/app/agent/copy.py` (whole file); `frontend/src/components/CommandBar.tsx:52-55` (`RATE_LIMIT_COPY`, `OFFLINE_COPY`)
**Apply to:** `toggle_guide_message`; per `11-UI-SPEC.md`'s Copywriting Contract "Error state" row, the guide's own click-open/close path has no error state at all (no fetch), and the voice-triggered path reuses `CommandBar.tsx`'s EXISTING `RATE_LIMIT_COPY`/`OFFLINE_COPY`/unclear-copy verbatim — no new error copy is authored.

### Present-value-delta fan-out in `applyAgentFilters`
**Source:** `frontend/src/lib/agent.ts:44-93`, specifically the `!= null` guard pattern used for every field
**Apply to:** the new `f.guideOpen != null` branch — same file, same function, same discipline (never `if (f.guideOpen)` — `"closed"` is a valid, truthy-in-JS-but-must-still-branch present value... actually here the value is a string so truthiness isn't the trap, but the `!= null` convention is kept for consistency with every other branch in the function).

### `aria-pressed` + border-not-fill button styling, ≥48px targets, icon+text never icon-only
**Source:** `frontend/src/components/Header.tsx` Theme toggle (170-182) and Voice Replies toggle (188-200)
**Apply to:** the new Header "Guide" button and the `GuideOverlay`'s own Close button (both specified exactly in `11-UI-SPEC.md`) — `min-h-12`, `border-2 border-[var(--color-ink)]`, `bg-[var(--color-sky)]`, `text-[20px] font-bold`, `gap-2`, never `bg-[var(--color-accent)]`.

### Escape-to-close without a focus trap
**Source:** `frontend/src/components/Header.tsx`'s `LogoutConfirmDialog` `handleKeyDown` Escape branch (53-58) — but explicitly WITHOUT its Tab-trap (59-71), `role="dialog"`/`aria-modal` (84-85), or dimmed backdrop (77)
**Apply to:** `GuideOverlay.tsx` — copy only the Escape-closes behavior; `11-UI-SPEC.md` point 4 (lines 175-182) is authoritative on what must differ (`role="region"`, no focus confinement, `CommandBar` stays Tab-reachable).

### Trust boundary — server `/agent` is sole authority, no client-side keyword bypass
**Source:** `frontend/src/lib/voice.ts` module docstring (lines 5-9): *"the server /agent Pydantic structured-outputs validation stays the sole authority (Phase 3)"*; reinforced by CONTEXT.md D-05 citing Phase 10 D-01's explicit warning
**Apply to:** the guide open/close voice path MUST round-trip through `POST /agent` → `ToggleGuide` → `AppliedFilters.guideOpen` → `applyAgentFilters`, exactly like every other voice command. No local keyword-matching shortcut (e.g. sniffing the transcript for "open the guide" client-side) may be added anywhere in `frontend/src/lib/voice.ts`, `useVoiceCommand`, or `CommandBar.tsx`.

## No Analog Found

None — every file in scope has at least a role-match analog in the existing codebase (this phase is entirely additive to well-established Phase 9/10 precedent, per CONTEXT.md's own framing).

## Metadata

**Analog search scope:** `backend/app/agent/` (schemas.py, prompt.py, copy.py, service.py), `backend/tests/` (test_agent_schemas.py, test_agent_service.py), `frontend/src/api/types.ts`, `frontend/src/lib/` (agent.ts, voice.ts), `frontend/src/store/` (view.ts, speech.ts, agentStatus.test.ts), `frontend/src/components/` (Header.tsx, CommandBar.tsx, OverlayToggle.tsx), `frontend/src/App.tsx`
**Files scanned:** 8 read in full + 2 targeted test-file excerpts + 1 grep-located type block
**Pattern extraction date:** 2026-08-25
