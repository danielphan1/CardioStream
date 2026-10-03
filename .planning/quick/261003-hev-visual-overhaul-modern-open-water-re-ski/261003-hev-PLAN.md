---
phase: quick-261003-hev
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements:
  - ACC-CONTRAST          # CLAUDE.md non-negotiable: high contrast; contrast.test.ts is the gate
  - ACC-48PX              # >=48px click targets
  - ACC-18PX              # >=18px body text
  - ACC-NO-HOVER          # no hover-only / drag / precise-pointing affordances
  - DESIGN-SINGLE-SOURCE  # every colour a var() in index.css, no hex in components
  - DATA-LOCKED           # the 6 clinical + 3 overlay + 3 series colours are medical identity
files_modified:
  - frontend/src/index.css
  - frontend/src/tests/contrast.test.ts
  - frontend/src/components/*.tsx   # mechanical border/surface sweep
  - DESIGN.md
---

# Quick Task 261003-hev: "Open Water" — modern re-skin of the whole frontend

## Problem

The user wants the site to look modern, in the idiom of two reference dashboards
they supplied (a light analytics dashboard and a light medical dashboard), while
keeping the nautical identity. Their one explicit colour steer: **brighter, sky
blue** accents.

Today's look is Phase 13 "Slack Water": a near-white/grey-green canvas, grey-green
card surfaces, a teal accent, and — the single most dated element — **2px near-black
borders on every control and card** (47 occurrences across 20 files). The references
have no heavy borders at all: they get their structure from white cards floating on a
tinted canvas with soft shadows.

## Decisions (locked before planning; do not revisit)

1. **Layout does not move.** The user said they like the layout. Same shells, same
   order, same components. Surfaces change, positions do not.
2. **Clinical colours do not move.** The six AHA BP categories, the three overlay
   hues and the three vitals series keep their exact hexes — they encode medical
   meaning and are contrast-gated. (DESIGN.md's Data-Is-Locked Rule.)
3. **Accent split, because a bright sky blue cannot be a button fill on a near-white
   page** — it fails WCAG 1.4.11's 3:1 non-text floor (#8FD3F4 vs the canvas is
   1.47:1). Derived and verified with the project's own `wcag-contrast`:
   - `--color-accent` **#1278AE** "sail blue" — buttons, pressed states. White text
     4.86:1, vs canvas 4.35:1, vs white card 4.86:1.
   - `--color-sky` **#8FD3F4** — NEW, graphic-only: chart gradient fills, the active
     rail pill, KPI accents, the dark panel's controls. Never a text-bearing fill on
     a light surface.
   - `--color-accent-on-panel` **#8FD3F4** + `-text` **#0B2034** — NEW non-inverting
     pair (same precedent as `--color-signal-on-panel`). The deep accent only scores
     2.66:1 on the new richer navy panel; sky scores 7.86:1 there and puts the
     brightest blue in the app's signature component.
4. **Borders get thinner and bluer, not removed.** `--color-hairline` **#5E7E99**
   clears 3:1 on both the canvas (3.82) and white cards (4.27), so the boundary still
   satisfies WCAG 1.4.11 at 1px. Removing boundaries entirely, as the references do,
   would fail the project's own floor.
5. **The dashed-disabled rule survives.** `border-2 border-dashed` stays 2px — it is
   a deliberate signal, not chrome.

## Palette (light "Open Water" / dark "Deep Watch")

| token | light | dark | note |
|---|---|---|---|
| `--color-deck` | `#EDF3F9` | `#071624` | page: soft blue tint (was near-white grey-green) |
| `--color-mist` | `#FFFFFF` | `#102A42` | cards: **white**, elevated (was grey-green) |
| `--color-depth` | `#0B2034` | `#E7EEF2` | ink, deep navy |
| `--color-accent` | `#1278AE` | `#56C2EC` | sail blue |
| `--color-sky` | `#8FD3F4` | `#8FD3F4` | NEW, graphic only, non-inverting |
| `--color-hairline` | `#5E7E99` | `#6D90AD` | NEW, 1px boundaries |
| `--color-panel` | `#0E3356` | `#04101C` | dark feature panel, richer blue |
| `--color-signal` | `#8A5620` | `#D9A356` | focus ring stays brass — nautical, and never collapses into the blue accent |

## Tasks

### T1 — token layer

- action: rewrite `:root` / `.dark` surface+accent tokens in `index.css` to the table
  above; add `--color-sky`, `--color-hairline`, `--color-accent-on-panel(-text)`,
  `--color-grid` (hairline at low alpha for chart grids). Bump `@theme`
  `--radius-xl` 14px -> 18px (repaints all 63 `rounded-xl` call sites at once) and
  soften `--shadow-elevation` to the references' wide, low-opacity diffusion.
- verify: `npx vitest run src/tests/contrast` green after T2.
- done: no component touched yet; the whole app already reads blue.

### T2 — contrast gate

- action: update `contrast.test.ts`'s LIGHT/DARK literal mirrors; add assertions for
  the three new tokens (hairline vs deck and vs mist >= 3; accent-on-panel text on
  fill >= 4.5; accent-on-panel vs panel >= 3).
- verify: `npx vitest run src/tests/contrast`.
- done: the gate mirrors index.css exactly and every floor still passes.

### T3 — hairline sweep

- action: mechanical swap of `border-2 border-[var(--color-depth)]` ->
  `border border-[var(--color-hairline)]` across components. Explicitly PRESERVED:
  `border-2 border-[var(--color-accent)]` (pressed), `border-2 border-dashed`
  (disabled), the spinner's `border-2 border-[var(--color-panel-text)]`, and
  `border-2 border-[var(--cat-normal)]` (listening).
- verify: `npm test`, `npx tsc --noEmit`, `npm run lint`.
- done: no near-black boundary remains on an idle control.

### T4 — the vitals strip becomes four floating cards

- action: `StatsStrip` renders four white elevated cards on the tinted canvas instead
  of one flat strip, each with its label, value and min-max range. Keeps the existing
  sr-only announced strings verbatim (the 16.1 Copywriting Contract) and the ~70px
  height work from commit 470eb7b.
- verify: `npx vitest run src/components/StatsStrip`.
- done: four cards, same four numbers, same order, same announcements.

### T5 — charts in the reference idiom

- action: gradient area fills under the timeline series (`<linearGradient>` from the
  series colour at ~0.28 to transparent), rounded bar caps on the category and AM/PM
  charts, hairline grid via `--color-grid`, and the chart card's own white surface.
  Series stroke colours unchanged (locked).
- verify: `npm test`; live screenshot.
- done: charts read as the references' while every clinical hue is untouched.

### T6 — chrome

- action: `LeftRail` active destination becomes a sky-tinted pill; `AssistantPopup`'s
  Send/mic use the on-panel sky pair; `SlimTopBar` and `FilterTriggerRow` pick up the
  hairline+white treatment.
- verify: full suite + tsc + lint, then a live desktop and mobile pass.
- done: one coherent surface language from login to readings.

### T7 — DESIGN.md

- action: DESIGN.md still documents the retired "Airy Nautical"/terracotta world and
  was already stale against Phase 13. Rewrite its colour, elevation and shape sections
  to "Open Water" so the next session does not design against a dead palette.
- done: DESIGN.md matches index.css.

## Must not break

- `contrast.test.ts` — every floor, both themes.
- The six clinical hues, three overlay hues, three series hues: byte-identical.
- 758-test suite; the 48px target floor; the 18px type floor.
- `data-surface="panel"` focus-ring scoping.
