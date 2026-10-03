---
phase: quick-261003-hev
plan: 01
subsystem: frontend
status: complete
tags: [design-system, visual-identity, wcag, contrast, tokens, charts, recharts]
dependency-graph:
  requires:
    - phase: 13
      provides: the token architecture this replaces the values inside
    - phase: 16.1
      provides: the rail-and-popover shell this re-skins
  provides: ["Open Water" light / "Deep Watch" dark palette, --color-hairline, --color-sky, --color-accent-on-panel, KPI cards, chart cards]
  affects: [every frontend surface, any future UI work, DESIGN.md]
tech-stack:
  added: []
  patterns:
    - "Boundaries are 1px hairlines that still clear 3:1 — thinner is allowed, fainter is not"
    - "A bright fill that cannot clear 3:1 on its ground is graphic-only, never a button"
    - "Precomputed colour literals (tints, dimmed lines) must be recomputed whenever their ground moves"
key-files:
  created: []
  modified:
    - frontend/src/index.css
    - frontend/src/tests/contrast.test.ts
    - frontend/src/components/StatsStrip.tsx
    - frontend/src/components/ChartDeck.tsx
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/charts/CategoryBars.tsx
    - frontend/src/components/charts/AmPmComparison.tsx
    - DESIGN.md
    - "+17 components in the hairline sweep"
decisions:
  - "Sky blue is graphic-only, not the button colour: #8FD3F4 is 1.47:1 against the canvas, so a sky-filled button would have no visible edge. Buttons use #1278AE; sky carries the brightness in charts, the rail pill and the dark panel."
  - "Added --color-accent-on-panel rather than darkening the panel back: the ordinary accent is 2.66:1 on the new navy, and putting the BRIGHT blue in the signature component is also what the user asked for"
  - "Bars got rounded caps but NOT gradient fills: a fade would lighten every clinical bar against the white card and weaken the contrast the gate protects"
  - "The dark card surface is capped by data, not taste — #102A42 dropped the dimmed dark diastolic to 2.82:1, so #0D2234 it is"
  - "Clinical, overlay and chart-series hues are byte-identical; only their grounds moved"
  - "Second pass: WCAG 1.4.11's 3:1 boundary rule governs INTERACTIVE components, so static cards may drop their borders entirely while controls keep theirs — over-applying it to containers is what kept the first pass looking outlined"
  - "Second pass: --color-muted at regular weight for labels/ranges/utilities; full ink and 700 reserved for values and headings"
metrics:
  duration: ~70min
  completed: 2026-10-03
---

# Quick Task 261003-hev: "Open Water" — modern re-skin of the whole frontend

The user asked for the site to look modern in the idiom of two reference
dashboards they supplied, while keeping the nautical identity, with one
explicit colour steer: **brighter, sky blue**.

## What Was Done

**The token layer** (`52d672c`). A blue-tinted canvas with WHITE elevated cards
on it — the light theme now deliberately inverts which of deck/mist is lighter,
so cards lift off the page instead of sinking into it. Wider, softer shadow.
Radius 14px → 18px, which repaints all 63 `rounded-xl` call sites at once.

**The hairline sweep** (`427faef`). The single most dated element of the old
look was a 2px near-black border on every idle control and card — 47 of them.
All now 1px `--color-hairline`, across 17 components plus the four sites whose
border colour is computed. The dashed-disabled rule, the pressed-accent border,
the selected chip's category border and the spinner ring were each preserved
deliberately.

**Surfaces** (`3b45014`). Four vitals KPI cards, a chart card, Send rewired to
the on-panel token, rounded bar caps.

**DESIGN.md** (`a2c111c`). Rewritten — it still documented the pre-Phase-13
terracotta world and had been lying about the codebase for two phases.

## The palette, and why it is what it is

Every value was derived with the project's own `wcag-contrast`, not picked by
eye, because `contrast.test.ts` mirrors the hexes literal-for-literal.

The user's steer and the accessibility floor collide head-on: **a bright sky
blue cannot be a button fill on a near-white page.** `#8FD3F4` is 1.47:1
against the canvas — such a button has no visible edge, failing WCAG 1.4.11.
Resolved by splitting the role rather than compromising either side:

| token | value | role |
|---|---|---|
| `--color-accent` | `#1278AE` | buttons, pressed states. White text 4.86:1 |
| `--color-sky` | `#8FD3F4` | graphic only — chart accents, rail pill, dark panel |
| `--color-accent-on-panel` | `#8FD3F4` + `#0B2034` text | Send, inside the dark panel: 7.86:1 there |
| `--color-hairline` | `#5E7E99` | 1px boundaries. 3.82:1 on deck, 4.27:1 on white |

So the brightest blue lands in the signature component and all over the charts,
while the controls that carry text stay legible.

## Second pass — composition, after the user said it still did not look like the photos

The first pass changed the palette and kept the composition. The user's verdict
was that it still did not look like the references, and that was correct: what
those two photos share is not a hue. It is light-weight muted type, borderless
cards, a greeting that leads the page, and one dark feature tile. Commit
`8942947` does those:

- **`--color-muted`** (`#4A6480` light / `#9DB4C9` dark, both ≥4.5:1 on BOTH
  grounds): labels, ranges and rail utilities sit a step back at regular weight
  while only values and headings hold full ink and 700. Every line at 20px/700
  navy is what made the old dashboard read as a wall of bold text. Hierarchy,
  not low-contrast styling — every value still clears AA.
- **Cards lost their borders.** WCAG 1.4.11's 3:1 boundary rule governs
  *interactive* components; applying it to static containers too is what kept
  the first pass looking outlined rather than floating. Controls keep hairlines.
- **A greeting header leads the page**, above the filter cluster. It reads the
  stats query itself — same key, served from cache, no extra request — so it can
  sit in the shell without threading props. No controls, so nothing new to reach
  by voice.
- **The Readings tile is now the dark navy feature card**, reference 1's "Status
  Summary" idiom in the stat row. It was already the odd cell out, being the one
  readout with no min–max.
- **Rail nav rows lost their boxes.** A column of outlined buttons is what made
  the rail read like a stack of form controls.
- **Band opacity 0.10 → 0.06 light** (0.14 → 0.10 dark).

One thing was tried and reverted: floating the rail on a shadow instead of an
edge. It broke the documented Flat-Sea Rule and LeftRail's own test, and the
edge was never the problem — the buttons inside it were.

## Deviations from Plan

**The gradient area fills under the timeline lines were not built.** The plan
listed them; the timeline already draws six full-width clinical bands behind
its series, and a gradient fill on top of a coloured band is mud. Gradients
would also have required converting `LineChart` to `ComposedChart`, destabilising
a heavily-tested component for a worse-looking result. The reference's gradient
character is carried by the card treatment and the rounded bars instead. Flagged
rather than silently dropped — say the word and the timeline can get them.

## Bug found by looking at the page rather than by testing

**The timeline's clinical bands have been painting at 50% opacity — five times
the documented 10% — since Phase 13.** `index.css` set `fill-opacity` via a
`.chart-band` class rule whose comment claims "a class rule wins over the SVG
presentation attribute." True, but only for the element the class is ON:
`.chart-band` lands on the Recharts `<g>` layer while `fill-opacity="0.5"` sits
on the `<path>` inside it, and a presentation attribute on the child beats an
inherited value from the parent. The selector now names the painted element.

This was the single loudest thing on the dashboard and the reason the chart
never looked calm. No test could have caught it — both the class and the
variable were exactly as specified; only the paint was wrong.

## Verification

```
npm test          -> 49 files, 765 passed, 0 failed
npx tsc --noEmit  -> exit 0
npm run lint      -> exit 0
```

`contrast.test.ts` carries 99 assertions across both themes, including four new
hairline floors and a guard that fails if `--color-accent` ever becomes legal on
the panel again. Two sets of precomputed literals were recomputed rather than
left stale: the six category tints (12% over deck) and the six dimmed vitals
lines (0.85 over deck/mist), since both grounds moved.

Live, against the dev server, in both themes and on Dashboard + Readings: no
retired colour survives anywhere in the DOM, no interactive target is under
48px, no horizontal overflow, body background resolves to the new canvas.

## Known Stubs

None.

## Threat Flags

None — presentation only. No data path, no auth surface, no new dependency.

## Human Verification Still Outstanding

- **Narrow viewport.** Chrome again refused to resize below ~1647px in this
  session, so the phone layout of the KPI card grid (2 columns) and the chart
  card has not been seen live.
- **Login, Upload, Add Record and the Guide** were re-skinned by the token and
  hairline sweep but not individually eyeballed.
- **Whether the user wants the timeline gradients** after seeing the bands at
  their correct 10%.

## Self-Check: PASSED

- FOUND: commits 52d672c, 427faef, 3b45014, a2c111c
- FOUND: 765/765 tests, tsc 0, lint 0
- FOUND: zero occurrences of the retired palette in the live DOM
