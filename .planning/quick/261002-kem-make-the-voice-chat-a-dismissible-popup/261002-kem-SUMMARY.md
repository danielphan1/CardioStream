---
phase: quick-261002-kem
plan: 01
subsystem: frontend
tags: [assistant, voice, disclosure, accessibility, focus-management, zustand, localstorage]
dependency-graph:
  requires:
    - phase: 16.1
      provides: useDismissable, the shell's measured top band and the left rail this popup replaces a band in
  provides: [dismissible-assistant-popup, assistant-store, dismissable-focus-on-open-fix]
  affects: [any future surface that uses useDismissable, any future work on the shell's top band]
tech-stack:
  added: []
  patterns:
    - "The assistant card is hidden, never unmounted: the live SpeechRecognition session dies with CommandBar"
    - "A disclosure that can mount already open must not move focus on mount, only on a real closed->open transition"
key-files:
  created:
    - frontend/src/store/assistant.ts
    - frontend/src/components/AssistantPopup.tsx
    - frontend/src/components/AssistantPopup.test.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/main.tsx
    - frontend/src/components/CommandBar.tsx
    - frontend/src/hooks/useDismissable.ts
    - frontend/src/hooks/useDismissable.test.ts
    - frontend/src/components/NavPanel.test.tsx
    - frontend/src/components/FilterSurface.test.tsx
    - frontend/src/tests/smoke.test.tsx
decisions:
  - "One commit, not four: the hook fix and the three test rewrites are what keep the tree green, so splitting them would have published a red commit (the 260930-n7i never-red rule)"
  - "Kept the Close copy as the one-word `Close` per the 16.1 Copywriting Contract instead of renaming the assistant's to `Close assistant`; the smoke test's query was scoped to the guide region instead"
metrics:
  duration: ~35min (resumed session)
  completed: 2026-10-03
---

# Quick Task 261002-kem: Make the AI voice chat a dismissible popup Summary

The Command Bar (mic, text input, live transcript, reply, agent-status banner) no
longer occupies a permanent band at the top of the dashboard and readings views. It
now lives in a floating card anchored above a persistent bottom-right `Assistant`
trigger, dismissible, and the dismissal persists across reloads.

## What Was Done

**T1 — `store/assistant.ts`** — `open` / `setOpen` / `toggleOpen` mirroring
`store/guide.ts`, plus the repo's hand-rolled localStorage persistence
(`theme.ts` / `speech.ts` / `auth.ts` / `filters.ts`), key `hv-assistant-open`,
both directions try/catch-guarded. `initAssistant()` runs from `main.tsx` before
first paint, so a dismissed popup never flashes open. Defaults to OPEN when nothing
is stored, so a first visit behaves as the old pinned band did.

**T2 — `components/AssistantPopup.tsx`** — `fixed bottom-4 right-4 z-[60]`,
`flex-col-reverse` so the trigger is first in the DOM but paints below the card.
The card is **hidden, never unmounted**: `CommandBar` owns the live
`SpeechRecognition` session, and the primary user (C4 quadriplegic, no reliable
pointer) cannot tap the trigger to restart one. A disclosure, not a modal — no
`aria-modal`, no focus trap, per `useDismissable`'s header.

**T3 — wake-word auto-open** — one effect in `CommandBar` calls
`useAssistant.getState().setOpen(true)` on the `triggered` voice state, so a
hands-free command never resolves inside a hidden card (ACC-VOICE-PRIMARY).

**T4 — `App.tsx` swap** — the Command Bar `<section>` is gone from the measured
top band; `<AssistantPopup>` renders as a sibling of `<main>` (never inert), gated
on the same `showCommandBar` prop. `useClearanceHeight` reports the smaller band on
its own, so every overlay offset followed without further change.

## Deviations from Plan

**One real deviation, and it was a bug the plan could not have predicted.** The
plan's T2 said to reuse `useDismissable`. Doing so surfaced *two* focus defects in
that hook, fixed here:

1. **The one the plan implied.** `AssistantPopup` is the hook's first consumer that
   can mount already open (its dismissal is persisted), and the hook focused its
   Close button on mount — stealing focus on page load. Fixed by requiring a real
   `closed -> open` transition.
2. **A latent, pre-existing bug the first fix exposed.** `mounted` is seeded from
   `open` and otherwise set from an effect, so on a real `closed -> open`
   transition the consumer still renders `null` for the commit in which `open`
   flips. `closeButtonRef.current` was therefore null when the focus effect ran, and
   `focus()` was a **silent no-op for every consumer in the app**. Focus only ever
   landed on Close for a surface that mounted already open — the one path no caller
   takes. The effect now also keys on `mounted`, so focus lands on the next commit,
   when the panel's DOM exists.

The three tests that "covered" this (NavPanel ×1, FilterSurface ×2) all mounted
their panel already open, which is why the bug survived 16.1. They now open by
transition, matching `App.tsx` and `FilterTriggerRow`. The `smoke.test.tsx` guide
case was scoped to the guide's own `region`, since two disclosures can now be open
at once and `Close` alone is ambiguous.

## Verification

```
npm test        -> 49 files, 758 passed, 0 failed
npx tsc --noEmit -> exit 0
npm run lint     -> exit 0 (oxlint, no findings)
```

Live, against the running dev server (localhost:5174, real backend on :8000):

- Popup renders open on first load, card above the trigger, no horizontal overflow.
- Assistant `Close` -> card gains `hidden`, `aria-expanded=false`,
  `hv-assistant-open=false` written, **`section[aria-label="Command bar"]` still in
  the DOM** (the recognizer survives), focus returns to the trigger.
- Trigger re-open -> card visible, focus lands on the card's Close, stored value
  back to `true`.
- **The hook fix confirmed in production, not just in tests:** clicking `Filters`
  now lands focus on the popover's Close (`activeIsInFiltersPopover: true`); Escape
  closes it and restores focus to `filters-trigger-button`. Both were broken before
  this commit.

## Known Stubs

None.

## Threat Flags

None. UI state only, deliberately outside `store/filters.ts` so model output can
never reach it (SEC-NO-MODEL-STATE); `lib/agent.ts` untouched.

## Follow-ups

1. **One Escape closes two surfaces.** The assistant's Escape handler is a window
   listener, as every disclosure's is, so pressing Escape to dismiss the Filters
   popover also dismisses the assistant. Recoverable (the recognizer stays alive,
   the wake word re-opens the card), but it is new behavior — the old band could not
   be dismissed at all. Options: guard the assistant's `onClose` on
   `panel.contains(document.activeElement)` (standard "Escape dismisses the focused
   disclosure", but then Escape no longer closes the assistant from anywhere), or
   have `AppShell` tell the popup when another overlay owns the Escape. A product
   call, deliberately not made here.
2. **Two `Close` buttons can now be on screen at once** (the assistant's and
   whichever overlay is open). The 16.1 Copywriting Contract mandates the one-word
   `Close` for every disclosure dismiss control, which assumed they were mutually
   exclusive. Worth revisiting the contract rather than quietly diverging.

## Human Verification Still Outstanding

- **Narrow viewport / real device.** The browser window would not resize below
  ~1647px in this session, so the sub-640px layout was not seen live. Worth one look
  on a phone at whether the fixed bottom-right trigger covers anything at the bottom
  of the Readings table or the Add Record form.
- **Wake-word re-open on real hardware.** Covered by `AssistantPopup.test.tsx` with
  the fake recognizer; the live path still needs a real utterance (and the agent
  itself remains inert in prod — AGENT-01, no API credits).

## Self-Check: PASSED

- FOUND: `frontend/src/store/assistant.ts`, `AssistantPopup.tsx`, `AssistantPopup.test.tsx` (created)
- FOUND: commit `087f334` in `git log --oneline`
- FOUND: 758/758 frontend tests green, tsc and oxlint clean
