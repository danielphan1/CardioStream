---
phase: quick-261002-kem
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements:
  - ACC-VOICE-PRIMARY      # CLAUDE.md non-negotiable: every primary action reachable by voice
  - ACC-48PX               # CLAUDE.md non-negotiable: >=48px click targets
  - ACC-18PX               # CLAUDE.md non-negotiable: >=18px body text
  - ACC-KEYBOARD           # keyboard navigable fallback; no drag/hover-only/precise pointing
  - DESIGN-SINGLE-SOURCE   # tokens via var(), no hex literals in components
  - SEC-NO-MODEL-STATE     # transient UI state must never be reachable by model output
files_modified:
  - frontend/src/store/assistant.ts            # new
  - frontend/src/components/AssistantPopup.tsx # new
  - frontend/src/components/AssistantPopup.test.tsx # new
  - frontend/src/components/CommandBar.tsx
  - frontend/src/App.tsx
---

# Quick Task 261002-kem: make the AI voice chat a dismissible floating popup

## Problem

The Command Bar (mic + text box + live transcript + reply + agent-status
banner) is mounted as a permanent band inside `AppShell`'s measured top band on
the dashboard and readings views. The user does not want it occupying the top of
every data surface on every visit: it should be a popup that can be exited and
then stays gone.

## Decisions (locked with the user, do not revisit)

1. **Shape** — floating chat widget: a persistent round mic FAB fixed
   bottom-right; the Command Bar lives in a card panel anchored above it with
   its own Close (X).
2. **Dismissal persists** — localStorage, hand-rolled try/catch guards exactly
   as `store/theme.ts` / `store/auth.ts` / `store/filters.ts` do (the repo does
   not use zustand `persist` middleware). Key `hv-assistant-open`. Defaults to
   OPEN when nothing is stored, so a first visit behaves as today.
3. **The mic session survives dismissal** — CommandBar stays MOUNTED while the
   popup is closed, hidden with the `hidden` attribute (out of the a11y tree
   and tab order). Unmounting it would kill the live `SpeechRecognition`
   session, and the primary user (C4 quadriplegic, no reliable pointer) cannot
   tap the FAB to restart it. A wake-word hit therefore re-opens the panel by
   itself.

## Tasks

### T1 — `store/assistant.ts` (new)

- action: zustand store mirroring `store/guide.ts`'s shape
  (`open`/`setOpen`/`toggleOpen`), plus `theme.ts`-style persistence:
  `readPersisted()` at module init (`null` → `true`), `setOpen` writes through
  inside try/catch so a blocked localStorage degrades to session-only.
- verify: `npx vitest run src/store` green.
- done: store exists, UI state only, never mutated from model output
  (SEC-NO-MODEL-STATE — `lib/agent.ts` is not touched).

### T2 — `components/AssistantPopup.tsx` (new)

- action: `fixed bottom-4 right-4 z-[60]` column, sibling of `<main>` so the
  shell's `inert` never reaches it. Holds:
  - the card: `data-surface="panel"`, `bg-[var(--color-panel)]`,
    `w-[min(92vw,480px)]`, `rounded-xl`, `shadow-[var(--shadow-elevation)]`,
    `role="group"` + `aria-label="Assistant"` (a disclosure, NOT a modal — no
    `aria-modal`, no focus trap, per `useDismissable.ts`'s header), a sticky
    Close button wired to `useDismissable`'s `closeButtonRef`, then
    `<CommandBar>` + `<AgentStatusBanner>`;
  - the FAB: `id="assistant-toggle-button"`, `min-h-14 min-w-14`,
    `aria-expanded` + `aria-controls="assistant-panel"`, mic glyph, visible
    text label on the card header rather than the FAB (the mic is the app's one
    documented icon-only control).
  - Reuse `hooks/useDismissable.ts` for Escape-to-close, focus-to-Close on
    open, focus-back-to-FAB on close and the 250ms fade: `hidden={!mounted}`,
    opacity class from `shown`.
- verify: `npx vitest run src/components/AssistantPopup` green.
- done: closed state removes the card from the a11y tree while CommandBar stays
  mounted; every colour is a `var()` token; targets >=48px.

### T3 — CommandBar auto-open on the wake word

- action: one `useEffect` keyed on `voiceState` that calls
  `useAssistant.getState().setOpen(true)` when it becomes `"triggered"`.
- verify: covered by the AssistantPopup test's fake-recognition wake-word case.
- done: a hands-free command pops the panel open so the transcript and reply
  are visible (ACC-VOICE-PRIMARY).

### T4 — `App.tsx` swap

- action: delete the `showCommandBar` `<section>` from the measured top band
  and render `<AssistantPopup />` next to the other out-of-`<main>` surfaces,
  gated on the same `showCommandBar` prop (dashboard + readings only,
  unchanged). Update the band comments that describe the Command Bar as living
  inside it; the `useClearanceHeight` ResizeObserver reports the smaller band
  on its own, so every overlay offset follows.
- verify: `npm run test` (full suite) + `npx tsc --noEmit` + `npm run lint`.
- done: no view renders the Command Bar inline; guide/nav/filter offsets still
  correct.

## Must not break

- `guide-toggle-button` / `menu-trigger-button` focus-restoration ids.
- The band's `z-[60]` sticky behaviour while an overlay is open.
- 748-test suite.
