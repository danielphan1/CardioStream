---
name: CardioStream
description: A calm, high-contrast nautical dashboard for one C4 quadriplegic patient's blood-pressure and pulse data, built to be driven entirely by voice.
colors:
  deck: "#EDF3F9"
  mist: "#FFFFFF"
  depth: "#0B2034"
  accent: "#1278AE"
  accent-text: "#FFFFFF"
  sky: "#8FD3F4"
  hairline: "#5E7E99"
  signal: "#8A5620"
  hazard: "#9C2B22"
  hazard-text: "#FFFFFF"
  panel: "#0E3356"
  panel-text: "#F2F8FD"
  accent-on-panel: "#8FD3F4"
  accent-on-panel-text: "#0B2034"
  line-systolic: "#1E3A5F"
  line-diastolic: "#AC40BF"
  line-pulse: "#9E4A24"
  ref-bradycardia: "#3E6E8E"
  cat-hypotension: "#3E6E8E"
  cat-normal: "#2B7A5B"
  cat-elevated: "#866A00"
  cat-stage1: "#B5591C"
  cat-stage2: "#A33323"
  cat-crisis: "#7A1F1A"
  cat-chip-text: "#FFFFFF"
  overlay-labs: "#6B4A9E"
  overlay-incidents: "#9C2E6E"
  overlay-procedures: "#5B6B2A"
  overlay-chip-text: "#FFFFFF"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Atkinson Hyperlegible, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  lg: "8px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.depth}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
  button-chrome:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.depth}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "48px"
  button-icon:
    backgroundColor: "{colors.deck}"
    textColor: "{colors.depth}"
    rounded: "{rounded.xl}"
    height: "48px"
    width: "48px"
  input-field:
    backgroundColor: "{colors.deck}"
    textColor: "{colors.depth}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "48px"
  card-surface:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.depth}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: CardioStream

## Overview

**Creative North Star: "Open Water"** (its dark-mode complement is **"Deep Watch"**)

CardioStream is a blue-tinted sea with white islands floating on it. The page
is never the lightest thing on screen — cards are — so every unit of content
lifts rather than sinks, and the eye finds structure without a single heavy
line. One sail-blue accent marks what can be acted on; one brighter sky blue
carries the system's graphics; one brass focus ring stays deliberately outside
both so a focused control is never mistaken for a pressed one.

The restraint is not decoration. The dashboard's job is to be read correctly
and operated confidently by someone who cannot point a mouse or grip a stylus —
legibility and calm outrank charm at every choice point.

The nautical motif (a sailboat mark, a wave-curve divider) is decorative-only:
it never sits behind data, and is never the thing a user has to interpret. What
the system does ask the eye to interpret — the six-step clinical scale, the
three overlay hues, the chart series — is information, and is locked.

**Key Characteristics:**
- A tinted canvas with WHITE elevated cards on it; the light theme inverts the
  usual page-lighter-than-card relationship on purpose.
- Boundaries are 1px blue-grey hairlines, never heavy ink outlines — thinner,
  but never fainter than WCAG 1.4.11's 3:1, which is what separates this from
  the borderless dashboards it takes its cues from.
- One reserved accent (Sail Blue) for primary actions and pressed states; one
  graphic-only Sky that is never a text-bearing fill on a light surface.
- Six locked clinical colors and three locked overlay hues that encode medical
  meaning and are never adjusted for taste.
- Every state change reads as a word + icon + color triad, never color alone;
  all motion is gated behind `motion-safe:`/`motion-reduce:` pairs.

## Colors

Two neutral surfaces, one ink, one accent, one graphic sky, one hairline, one
separate focus color — plus three families of locked, data-encoding hues that
exist to be read correctly, not to be pretty.

Every value below was derived with the project's own `wcag-contrast` and is
mirrored literal-for-literal by `frontend/src/tests/contrast.test.ts`. That
test is the gate: a palette edit that regresses any floor fails there rather
than shipping.

### Primary
- **Sail Blue** (`#1278AE` light / `#56C2EC` dark): the one reserved accent —
  primary actions and pressed/active states. White text on it scores 4.86:1;
  it scores 4.35:1 on the canvas and 4.86:1 on a white card.
- **Sky** (`#8FD3F4`, non-inverting): graphic only — the active rail pill, KPI
  accents, and anything drawn on the dark panel. **Never a text-bearing fill on
  a light surface**: it is 1.47:1 against the canvas, so such a button would
  have no visible edge. This is the token that carries the system's brightness.
- **Accent-on-Panel** (`#8FD3F4` fill / `#0B2034` text, both non-inverting):
  the accent INSIDE the always-dark feature panel. Sail Blue is only 2.66:1
  there, under the floor; this pair scores 7.86:1 with 10.07:1 text on it.

### Neutral
- **Deck** (`#EDF3F9` light / `#071624` dark): the page — a soft blue tint, and
  deliberately NOT the lightest surface in the light theme.
- **Mist** (`#FFFFFF` light / `#0D2234` dark): cards, panels, chart containers.
  The dark value has a hard ceiling: Phase 16 draws raw vitals lines at 0.85
  opacity over it, and a lighter card drops the dark diastolic under 3:1.
- **Depth** (`#0B2034` light / `#E7EEF2` dark): all text and icons. No longer a
  border color — that is Hairline's job now.
- **Hairline** (`#5E7E99` light / `#6D90AD` dark): every 1px boundary. 3.82:1
  on deck and 4.27:1 on white mist, so thinning the old 2px ink borders did not
  cost compliance.
- **Signal** (`#8A5620` light / `#D9A356` dark): the 3px `:focus-visible` ring.
  Brass, and deliberately outside the blue family — a focused control must
  never read as a pressed one. `--color-signal-on-panel` (`#D9A356`, both
  themes) is its non-inverting counterpart inside the dark panel.

### Clinical Categories (locked — data, not decoration)
Unchanged from Phase 13, and not to be touched for aesthetic reasons:
Hypotension `#3E6E8E`, Normal `#2B7A5B`, Elevated `#866A00`, Stage 1 `#B5591C`,
Stage 2 `#A33323`, Hypertensive Crisis `#7A1F1A` (light); the dark set and the
six 12%-over-deck selected-chip tints live in `index.css`. Chip text is
`#FFFFFF` light / `#0A121F` dark.

Timeline bands draw these hues at `--band-opacity` (0.10 light / 0.14 dark) —
applied to the Recharts `<path>`, NOT the `<g>` layer, because a presentation
attribute on the child beats an inherited value from the parent. Setting it on
the layer is how the bands silently rendered at 50% for three phases.

### Overlay Datasets (locked)
Labs `#6B4A9E`, Incidents `#9C2E6E`, Procedures `#5B6B2A` (light) — violet,
magenta and olive families, chosen to sit outside every clinical and chart-line
hue so they can never be misread as a BP category.

### Chart Series (locked)
Systolic `#1E3A5F`, Diastolic `#AC40BF`, Pulse `#9E4A24` (light). Pulse also
draws DASHED: its luminance ratio against systolic is 1.89:1, so the stroke
pattern, not the hue, is what separates that pair in greyscale.

### Named Rules
**The Single Source Rule.** Every color is a CSS custom property declared once,
for both themes, in `index.css`. Components consume `var(--...)` and never
hardcode a hex value or invent one inline.

**The One Signal Rule.** Sail Blue is the only color allowed to mean "act here"
or "this is active." A control that isn't a primary action or a pressed state
stays Depth-on-Mist, no matter how important it feels.

**The Sky-Is-Not-A-Button Rule.** Sky may fill a shape only where something
else carries the 3:1 — a dark ground beneath it, or a hairline around it. The
moment it becomes a button fill on a light surface, the control loses its edge.

**The Data-Is-Locked Rule.** Clinical, overlay, and chart-series colors are
medical/data identity, not palette decoration. A redesign may touch Deck, Mist,
Depth, Accent, Sky, Hairline, or Signal; it does not touch these three families
without a deliberate, documented decision.


## Typography

**Body & Display Font:** Atkinson Hyperlegible (with `system-ui, -apple-system, "Segoe UI", sans-serif` fallback) — a typeface designed for low-vision and dyslexic readability, shipped in exactly two static weights (400, 700; no 600/semibold file exists, so no synthesized "medium" weight is ever introduced).

**Character:** One typeface, one weight pair, four sizes. There is no display/body font split — the same face carries the 32px hero number and the 18px body copy, so hierarchy comes from size and weight alone, never from a second, more "expressive" family.

### Hierarchy
- **Display** (700, 2rem / 32px, line-height 1.25): the app title (`Chris's Health Dashboard`) and hero stat values (StatsStrip avg tiles, reading count).
- **Headline** (700, 1.5rem / 24px, line-height 1.25): section headings (dialog titles, empty-state heading, field-set legends).
- **Label** (700, 1.25rem / 20px, line-height 1.25): every button, toggle, filter chip, and form label — the de facto "control" size, used more than any other named size in the codebase.
- **Body** (400, 1.125rem / 18px, line-height 1.5): running copy, table cells, helper/error text — and the accessibility floor: no body text anywhere renders smaller than this.

### Named Rules
**The 18px Floor Rule.** No text in the product renders below 18px. This is a hard accessibility floor (`--text-base`), not a starting point to shrink from on dense screens.

**The Two-Weight Rule.** Only 400 and 700 are used, matching the two static font files actually shipped. Never introduce an intermediate weight — the browser would fake it.

## Layout

A left rail at ≥1024px (a slim top bar with a menu below it) frames a single
content column, `max-width: 1280px`, with responsive gutters (`16px` mobile →
`32px` medium → `64px` extra-large) and a `32px` vertical rhythm between
sections. The Command Bar is no longer a band at all — it lives in the floating
assistant popup.

The four vitals KPI cards use a responsive grid — 2 columns on phones, 4 from
the `lg` breakpoint — so they never crowd on a phone-width screen. Everywhere else, layout is `flex` with `flex-wrap`, letting filter/toggle rows reflow onto additional lines rather than truncating or requiring horizontal scroll — no control is ever clipped off-screen.

**Spacing scale** (multiples of 4px; the project's working vocabulary, not a new scale):

| Token | Value | Typical use |
|---|---|---|
| `xs` | 4px | icon gaps, inline padding |
| `sm` | 8px | compact element spacing, chip gaps |
| `md` | 16px | default element spacing, card gutters |
| `lg` | 24px | section padding, card internal padding |
| `xl` | 32px | layout gaps, generous section padding |
| `2xl` | 48px | major section breaks — **also the accessibility click-target floor** |
| `3xl` | 64px | page-level side gutters at wide viewports |

### Named Rules
**The No-Off-Screen Rule.** Interactive rows wrap (`flex-wrap`) rather than scroll or clip. A caregiver using a phone one-handed never has to scroll sideways to find a control.

## Elevation & Depth

The system lifts by default now. White cards on a tinted canvas are the primary
structural device, and `--shadow-elevation` is what makes them read as floating
rather than merely lighter: a wide, low-opacity diffusion
(`0 14px 34px -10px` plus a tight `0 3px 8px -3px`), not a tight drop shadow.

Elevated: the four vitals KPI cards, the chart card, the readings card, the
empty state, dialogs, chart tooltips, the agent-status banner, the assistant
popup. Flat: the slim top bar and the left rail, which are chrome — they frame
the sea rather than float on it.

```css
:root {
  --shadow-elevation: 0 14px 34px -10px rgba(11, 32, 52, 0.16),
                       0 3px 8px -3px rgba(11, 32, 52, 0.08);
}
.dark {
  /* a shadow is nearly invisible on #071624, so dark mode pairs it with a
     1px light hairline to fake an edge-highlight instead */
  --shadow-elevation: 0 14px 34px -10px rgba(0, 0, 0, 0.55),
                       0 0 0 1px rgba(231, 238, 242, 0.06);
}
```

### Named Rules
**The Lift Rule.** A self-contained unit of content gets a card: white fill,
`xl` radius, 1px hairline, one elevation token. Chrome that frames the page
(rail, top bar) stays flat and uses a hairline edge instead.

## Shapes

- **`lg` (8px):** secondary chrome — the rail's utility controls. The smaller
  radius is the quiet tell that these are utilities, not primary surfaces.
- **`xl` (18px):** the default for everything else — cards, dialogs, tooltips,
  inputs, and every filter/command/view button. Raised from 14px in the "Open
  Water" re-skin; this is the radius to reach for on any new surface.
- **`full` (9999px):** information-bearing chips and the assistant trigger.

Boundaries are `1px solid` Hairline. Two exceptions, each carrying meaning
rather than chrome: a `2px` accent border plus a `2px` inset accent ring marks
an OPEN disclosure, and a `2px dashed` Depth border marks a disabled or
not-yet-valid action.

### Named Rules
**The Dashed-Border Rule.** A disabled action gets a 2px *dashed* border, not a
lowered-opacity solid one. The border style itself carries "not ready", so it
must stay thick enough to read as dashed even though idle borders are now 1px.

**The Hairline Rule.** A thinner border is allowed; a fainter one is not. Any
new boundary color must clear 3:1 against both the canvas and a white card, and
`contrast.test.ts` is where that is proven.

## Components

Buttons, cards and inputs share one language: a 1px hairline when idle, a solid
Sail Blue fill when primary or pressed, bold Label-size (20px/700) text, and a
firm 48×48px minimum. Nothing uses hover as a meaningful signal — every
interaction is a tap, click or keypress, because the primary user cannot
reliably hover a pointer.

### Buttons
- **Primary** (`button-primary`): Sail Blue fill, white text, `xl` radius, 48px
  min height, Label typography. The only accent-filled surface in the app.
- **Secondary / Filter** (`button-secondary`): Mist fill, Depth text, 1px
  hairline, `xl` radius, 48px min height; flips to the Primary treatment when
  `aria-pressed="true"`.
- **Rail chrome**: as Secondary but at `lg` radius — never accent-filled even
  when toggled on, since the accent fill is reserved for the selected
  destination.
- **Icon-only** (`button-icon`): the mic. The one icon-only control in the app,
  justified by a real `aria-label` that swaps with state.
- **Inside the dark panel:** Send and the working ring use Accent-on-Panel; the
  field uses a translucent panel-text fill rather than a light surface color.
- **Category chip** (pill): a 12%-over-deck tint fill with a 2px border in the
  category's own hue when selected.

### Cards / Containers (`card-surface`)
`xl` radius, Mist (white) fill, 1px hairline, one elevation token, 16px padding
on phones and 24px from `md` up. The KPI cards use 16px/12px, tighter because
four of them share a row.

### Vitals KPI card
Three stacked line boxes: a 20px symbol plus the vital's name, the average at
Display size, then the min–max range (U+2013, no words) with the min/max WORDS
in a visually-hidden span. A null vital renders an em dash in both value
positions — never 0, never blank.

### Charts
Each chart lives in its own card with its heading. Bars have rounded caps and
SOLID locked fills — a gradient fade would lighten a clinical bar against the
white card and weaken the contrast the gate protects. The timeline's bands are
its backdrop; there is no separate grid.

### Inputs / Fields (`input-field`)
Deck fill (one step different from the white card it sits inside — inputs are
never white-on-white), 1px hairline, `xl` radius, 48px min height, 18px text.
Labels stacked above, never placeholder-as-label. Errors are inline text with
`role="alert"`, read by word, never by color alone.

### Signature Component: The Assistant
The floating mic + text + transcript panel, bottom-right, in the app's one dark
feature panel. One `aria-live` region resolves the rotating placeholder, the
live transcript, the working spinner and the applied confirmation — never more
than one at a time. The card is hidden, never unmounted, so the live speech
session survives being dismissed.


## Do's and Don'ts

### Do:
- **Do** keep Sail Blue to its reserved list — primary actions and pressed/active states only, and keep Sky off any light-surface button fill.
- **Do** pair every state change with a word and/or icon, never color alone (the app's own hue-collision math treats this as a backstop, not decoration).
- **Do** hold every interactive target to 48×48px minimum.
- **Do** gate any new motion behind `motion-safe:`/`motion-reduce:` pairs, with a static fallback (a ring, not a spin) for the reduced-motion case.
- **Do** reach for `xl` (18px) radius on any new card, dialog, button, or input; reserve `lg` (8px) for rail-utility controls and `full` for data-bearing chips only.
- **Do** treat a disabled action with a dashed border, not a dimmed one.

### Don't:
- **Don't** touch the six clinical BP-category colors, the three overlay-dataset colors, or the chart-line colors for aesthetic reasons — they are locked medical/data identity.
- **Don't** add a hover-only, drag, or precise-pointing interaction anywhere — the primary user cannot reliably operate a pointer.
- **Don't** introduce a third font weight — only 400 and 700 ship as static files for Atkinson Hyperlegible; a synthesized weight is a regression, not an enhancement.
- **Don't** let the brass Focus ring drift into the blue family — it is deliberately outside it so a focused control and a pressed control are never visually confused.
- **Don't** hardcode a hex value in a component. Every color is a `var(--...)` custom property declared once in `index.css` for both themes.
