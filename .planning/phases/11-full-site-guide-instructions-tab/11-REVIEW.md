---
phase: 11-full-site-guide-instructions-tab
reviewed: 2026-08-26T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/app/agent/copy.py
  - backend/app/agent/prompt.py
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/tests/test_agent_schemas.py
  - backend/tests/test_agent_service.py
  - frontend/src/App.tsx
  - frontend/src/api/types.ts
  - frontend/src/components/CommandBar.tsx
  - frontend/src/components/GuideOverlay.test.tsx
  - frontend/src/components/GuideOverlay.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/lib/agent.test.ts
  - frontend/src/lib/agent.ts
  - frontend/src/lib/voiceCommands.test.ts
  - frontend/src/lib/voiceCommands.ts
  - frontend/src/store/guide.test.ts
  - frontend/src/store/guide.ts
  - frontend/src/tests/setup.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This phase adds the full-site guide overlay: a new `ToggleGuide` command
variant end-to-end (prompt → schema → service → copy → wire types →
`applyAgentFilters`), the `GuideOverlay` component itself, the shared
`voiceCommands.ts` reference list, and the Header "Guide" toggle button. The
backend half is careful and consistent — the new `toggle_guide` action mirrors
`toggle_speech`/`toggle_dataset` exactly, token casing/validation/tests all
line up, and the closed-union/never-echo-model-text invariants are preserved.

The most serious problem is on the frontend: wrapping the `Header` in `inert`
while the guide is open (to keep it out of the tab order per GUIDE-03/04)
also inertifies the very "Guide" button the keyboard/screen-reader user just
activated to open it, which drops focus with no announcement and no
restoration. This directly undermines the "keyboard navigable as fallback"
accessibility requirement for the primary way most users will discover and
open this brand-new feature. A second, independent bug in `GuideOverlay`'s
own "Jump to a section" links (no `scroll-margin-top` against the sticky
Close bar) means the guide's own internal navigation hides the very content
it just jumped to. One pre-existing bug in `service.py`'s clarification
handling (not part of this phase's diff, but present in a reviewed file) is
also included below for completeness.

## Critical Issues

### CR-01: Opening the guide via the Header button drops keyboard/screen-reader focus

**File:** `frontend/src/App.tsx:205-207` (also `268-270`, `290-292`), triggered by `frontend/src/components/Header.tsx:212-218`

**Issue:** `Header`'s "Guide" button calls `toggleGuide` (`onClick={toggleGuide}`,
Header.tsx:214), which flips `useGuide`'s `open` to `true` in the same click/
keydown handler. On the very next render, `App.tsx` wraps `Header` in
`<div inert={guideOpen} ref={headerRef}>` (Dashboard, UploadView, and
RecordsView all do this). Because the "Guide" button that was just activated
lives *inside* that now-`inert` div, the browser removes it from the
focusable/accessibility tree in the same commit — for a keyboard user
(Tab + Enter/Space) or a screen-reader user (activate-via-AT), this blurs the
active element with no explicit destination, dropping focus to `<body>`.
There is no compensating focus-management code anywhere in `GuideOverlay` (no
`useEffect` moves focus into the newly-opened content), so the user gets no
signal that anything happened — the guide opens visually, but keyboard/AT
focus is lost. `CommandBar` and the `main` region deliberately stay reachable
(per the file's own extensive GUIDE-03/04 comments), but the very trigger
control for the feature was missed. This is 100% reproducible for every
keyboard/AT-driven guide-open in every view (Dashboard, Upload, Records) since
the Guide button is the only way to open the guide outside of a voice/typed
command, and per CLAUDE.md accessibility is explicitly non-negotiable
("keyboard navigable as fallback... the primary user cannot use standard
input devices").

**Fix:** Move focus into the guide when it opens (mirrors the existing
`LogoutConfirmDialog` pattern in `Header.tsx` that already focuses its Cancel
button on mount), e.g. in `GuideOverlay.tsx`:
```tsx
const closeButtonRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (open) closeButtonRef.current?.focus();
}, [open]);

// ...
<button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} ...>
```
This sidesteps the `inert`-induced blur entirely by deliberately placing
focus somewhere sensible the instant the overlay appears, rather than relying
on whatever the browser does when the trigger's ancestor becomes inert.

## Warnings

### WR-01: Clarification memory stores the wrong (and potentially invalid) question text

**File:** `backend/app/agent/service.py:303-319`

**Issue:** In `interpret()`'s `Clarification` branch:
```python
question = (
    result.question.strip() or "Which chart or time range did you mean?"
)
original = context.original_text if context is not None else text
return AgentReply(
    kind="clarify",
    message=question,  # sanitized/fallback text shown to the user
    context=ClarifyContext(original_text=original, question=result.question),  # RAW text stored
)
```
`context.question` is built from `result.question` (the raw, unstripped
value straight from the model) instead of the sanitized `question` local
variable that was just computed specifically to handle the empty/whitespace
case. Two consequences: (1) if `result.question` is empty/whitespace, the
user sees the friendly fallback message, but the *stored* context (replayed
as the assistant's turn via `build_messages()` on the next request, prompt.py
`build_messages`) is empty — the conversational memory sent to Claude no
longer matches what was actually shown to the user. (2) `ClarifyContext.question`
has `max_length=500` (schemas.py:207) while the Claude-facing
`Clarification.question` has no such bound (deliberately, per the module's
own Pitfall-3 rationale) — if Claude ever emits a question longer than 500
characters, constructing `ClarifyContext(...)` raises a `ValidationError`
that is swallowed by `interpret()`'s outer `except Exception` backstop
(line 331), silently downgrading a legitimate, already-computed clarifying
question into a generic "I didn't catch that" reply. Neither case crashes the
service (the outer backstop prevents a 500), but both are real, silent
correctness regressions in the D-12 one-turn clarification flow.

**Fix:** Use the already-sanitized variable for both fields:
```python
return AgentReply(
    kind="clarify",
    message=question,
    context=ClarifyContext(original_text=original, question=question),
)
```

### WR-02: "Jump to a section" links render target headings behind the sticky Close bar

**File:** `frontend/src/components/GuideOverlay.tsx:78-87, 122-138`

**Issue:** The Close button bar is `sticky top-0` *inside* the same
`overflow-y-auto` scroll container as the section content (lines 78-87). The
"Jump to a section" nav (lines 122-138) renders plain `<a href="#id">` links
with no `scroll-margin-top` (Tailwind `scroll-mt-*`) on the target
`<section id="...">` elements. Clicking one of these links triggers the
browser's default `scrollIntoView` behavior, which aligns the target
section's top edge with the scroll container's own top (y=0) — but that
region is permanently covered by the sticky Close bar (and, while the guide
is open on the Dashboard, additionally by the sticky `CommandBar` band at an
even higher z-index, `z-[60]` vs. the overlay's `z-50` in `App.tsx:214`).
The `paddingTop` calculation (`GuideOverlay.tsx:109-116`) only compensates
for the *initial* scroll position (scrollTop 0) before any jump; it does not
apply per-section, so every jump-to-section click after the first hides the
target heading (and often several lines of body copy) behind the Close bar.
This is the guide's own internal navigation breaking on the guide meant to
teach navigation.

**Fix:** Add a `scroll-mt-*` utility (or inline `scrollMarginTop` matching
`CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER`) to every jump target:
```tsx
<section id="command-bar" className="scroll-mt-20">
```
(repeat for all nine `<section id="...">` elements), or compute the value
from `CLOSE_BAR_HEIGHT`/`CLEARANCE_BUFFER` in a shared style object so it
can't drift from the constants already defined for the initial-load case.

### WR-03: No focus restoration when the guide closes

**File:** `frontend/src/components/GuideOverlay.tsx:54-70`

**Issue:** When `open` flips to `false` (via the Close button, Escape, or an
agent `toggle_guide` command), `GuideOverlay` returns `null` — its DOM
subtree, including whatever element currently holds focus (typically the
Close button), is removed in the same render. Unlike `LogoutConfirmDialog`
in `Header.tsx` (which explicitly restores focus to the "Log out" button via
`logoutButtonRef.current?.focus()` in `closeDialog()`), `GuideOverlay` has no
equivalent restoration, so focus silently falls back to `<body>` on every
close. Combined with CR-01, a keyboard/AT user who manages to reach the
guide's Close button has no reliable path back to a known focus position
afterward either.

**Fix:** Track the element that had focus when the guide opened and restore
it on close, e.g.:
```tsx
const lastFocusedRef = useRef<HTMLElement | null>(null);
useEffect(() => {
  if (open) {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
  } else {
    lastFocusedRef.current?.focus();
  }
}, [open]);
```

## Info

### IN-01: Guide button JSX formatting inconsistent with sibling buttons

**File:** `frontend/src/components/Header.tsx:212-218`

**Issue:** The new Guide button collapses its icon and label onto one line
(`<BookOpen aria-hidden="true" size={24} />Guide</button>`) whereas the
Theme and Voice Replies buttons immediately above it each put the icon,
label, and closing tag on their own indented lines. Purely cosmetic (the
`gap-2` flex class still renders correct spacing), but it stands out as an
inconsistency in an otherwise uniform block of near-identical buttons.

**Fix:**
```tsx
<button ... >
  <BookOpen aria-hidden="true" size={24} />
  Guide
</button>
```

### IN-02: Guide copy references a button label that doesn't match the real UI text

**File:** `frontend/src/components/GuideOverlay.tsx:214-217`

**Issue:** The "Voice Replies" section says: `Tap the "Voice Replies" button
in the header`, but the actual rendered button label
(`Header.tsx:203`) is `"Voice Replies: On"` / `"Voice Replies: Off"` — never
just `"Voice Replies"`. A user scanning the header for an exact-text match
("Voice Replies" verbatim) could plausibly hesitate.

**Fix:** Either update the guide copy to `Tap the "Voice Replies" button
(it also shows On/Off)` or keep the button's accessible name stable and
reference it generically without implying an exact string match.

### IN-03: `_lower_value` docstring overstates its own recursion limit

**File:** `backend/app/agent/schemas.py:187-195`

**Issue:** The docstring says the helper handles "one level of nested dict,"
but the implementation (`if isinstance(val, dict): return {k: _lower_value(k, sub) for k, sub in val.items()}`)
is actually fully recursive — it will keep descending into arbitrarily
nested dicts, not just one level. Harmless today (none of the current
Claude-facing schemas nest more than one level), but the comment will
mislead a future maintainer reasoning about what happens if a deeper schema
is added.

**Fix:** Update the comment to say "recursively lowercases nested dict
values" rather than "one level," or add an explicit depth guard if a single
level was actually intended.

### IN-04: `call_claude`'s no-client branch has misleading reachability semantics

**File:** `backend/app/agent/service.py:148-151`

**Issue:** `call_claude()` opens with:
```python
client = _get_client()
if client is None:
    return None, True  # defensive fallback only — interpret()'s own earlier
    # guard already returns before call_claude() is reached in this case.
```
Returning `reachable=True` for a "no client available" outcome is backwards
from every other guard in this function (breaker-open, `APIError`, etc. all
correctly return `False`/leave the breaker alone). It's explicitly documented
as unreachable given the current single caller (`interpret()` already checks
`_get_client() is None` first), so it's not exploitable today, but if this
function ever gains a second caller that skips that earlier guard, it would
silently report the agent as "reachable" while a network call never
happened.

**Fix:** If the branch is truly meant to be defensive/unreachable, prefer
failing loudly (`raise AssertionError("unreachable: ...")`) over returning a
plausible-looking-but-wrong `(None, True)` tuple, or at minimum return
`(None, False)` so an accidental future call site doesn't get a false
"reachable" signal.

---

_Reviewed: 2026-08-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
