---
name: CardioStream
description: A calm, high-contrast nautical dashboard for one C4 quadriplegic patient's blood-pressure and pulse data, built to be driven entirely by voice.
colors:
  foam: "#F2F7F5"
  sky: "#E2EDF2"
  ink: "#14213D"
  terracotta: "#B94927"
  terracotta-text: "#FFFFFF"
  focus: "#1D4E89"
  line-systolic: "#1D3557"
  line-diastolic: "#26707D"
  ref-bradycardia: "#4A6B8A"
  cat-hypotension: "#4A6B8A"
  cat-normal: "#2F7D5C"
  cat-elevated: "#8F6A00"
  cat-stage1: "#B34700"
  cat-stage2: "#B3261E"
  cat-crisis: "#7F1D1D"
  cat-chip-text: "#FFFFFF"
  overlay-labs: "#6A3FA0"
  overlay-incidents: "#A32672"
  overlay-procedures: "#5C6B1E"
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
  xl: "12px"
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
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.terracotta-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
  button-chrome:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "48px"
  button-icon:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "48px"
    width: "48px"
  input-field:
    backgroundColor: "{colors.foam}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "48px"
  card-surface:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: CardioStream

## Overview

**Creative North Star: "Airy Nautical"** (its dark-mode complement is named, just as deliberately, **"Night Sea"**)

CardioStream is a two-tone sea-and-sky surface — Foam and Sky in the light theme, deepening to near-black water in Night Sea — with a single warm signal color, Terracotta, allowed to interrupt it. That restraint is not incidental: the system's own locked decisions state that warmth comes from the accent color alone, never from typographic voice or editorial copy, which is explicitly rejected as a source of personality here. The dashboard's job is to be read correctly and operated confidently by someone who cannot point a mouse or grip a stylus — legibility and calm outrank charm at every choice point.

The nautical motif (a sailboat mark, a wave-curve divider under the header) is confirmed decorative-only: it never sits behind data, and it is never the thing a user has to interpret. What the system does ask the eye to interpret — the six-step clinical color scale, the three overlay-dataset hues, the reserved Terracotta — is treated as information, not decoration, and is locked accordingly.

**Key Characteristics:**
- One reserved accent (Terracotta) carries all of the system's visual warmth and marks every primary action and pressed/active state; nothing else is ever accent-filled.
- A dedicated focus color, distinct from the accent, so a keyboard or switch-access focus ring never blends into an accent-filled control.
- Six locked clinical BP-category colors and three locked overlay-dataset colors that encode medical/data meaning and are never adjusted for taste.
- Flat, edge-to-edge full-width bands (header, command bar, filter bar) at zero elevation, punctuated by discrete elevated "islands" — stat tiles, dialogs, tooltips — that alone use the system's one ambient shadow.
- Every state change reads as a word + icon + color triad, never color alone; all motion is gated behind `motion-safe:`/`motion-reduce:` pairs.

## Colors

The palette is deliberately narrow: two neutral surfaces, one ink, one reserved accent, one separate focus color — plus three families of locked, data-encoding hues that exist to be read correctly, not to be pretty.

### Primary
- **Terracotta** (`#B94927` light / `#DA6F4E` dark): the system's one reserved accent. Used only for primary-action buttons (submit, "Show all data", "Apply", "Send", "Log out" confirm) and for the pressed/active fill of toggle and filter controls. Its hue (14°) was chosen specifically to clear every clinical/overlay token's hue-collision box in both themes — accent and data color are never allowed to be confused for each other. Paired with **Terracotta Text** (`#FFFFFF` light / `#0B1626` dark) for on-accent text.

### Neutral
- **Foam** (`#F2F7F5` light / `#0B1626` dark): the page background — the dominant surface, ~60% of any screen.
- **Sky** (`#E2EDF2` light / `#13233A` dark): cards, panels, chart containers, and the filter/command bar surfaces — the secondary surface, ~30%.
- **Ink** (`#14213D` light / `#E8F1EF` dark): all text, icons, and the 2px borders used throughout — never a separate "border gray."
- **Focus** (`#1D4E89` light / `#8FC1D4` dark): the 3px `:focus-visible` ring color, sitewide. Deliberately its own token, not a reuse of Terracotta — since the Phase 12 accent swap, focus and accent visibly diverge for the first time in dark mode, so a focused control is never mistaken for a pressed one.

### Clinical Categories (locked — data, not decoration)
Six-step AHA blood-pressure classification, used identically for filter chips, category bars, and timeline bands. Never touched for aesthetic reasons; hue/lightness were hand-verified to clear a 10°/10pp collision box against Terracotta and against each other in both themes.
- **Hypotension** — `#4A6B8A` light / `#8FB3D1` dark
- **Normal** — `#2F7D5C` light / `#63C68F` dark
- **Elevated** — `#8F6A00` light / `#E0B84E` dark
- **Stage 1** — `#B34700` light / `#EE9B57` dark
- **Stage 2** — `#B3261E` light / `#EF7B70` dark
- **Hypertensive Crisis** — `#7F1D1D` light / `#F2564D` dark
- Chip text on any of the above: `#FFFFFF` light / `#0B1626` dark.

### Overlay Datasets (locked)
Three marker colors for the labs/incidents/procedures overlay layer, chosen from violet/magenta/olive hue families specifically to sit outside every clinical and chart-line hue range so they can never be misread as a BP category.
- **Labs** — `#6A3FA0` light / `#C9A6EA` dark
- **Incidents** — `#A32672` light / `#F0A8D0` dark
- **Procedures** — `#5C6B1E` light / `#C9D48A` dark
- Overlay chip text: `#FFFFFF` light / `#0B1626` dark.

### Chart Series (locked)
- **Systolic line** — `#1D3557` light / `#A8CBEA` dark
- **Diastolic line** — `#26707D` light / `#6FC7C4` dark
- **Bradycardia reference line** (60 bpm threshold) — `#4A6B8A` light / `#8FB3D1` dark

### Named Rules
**The Single Source Rule.** Every color used anywhere in the app is a CSS custom property declared once, for both themes, in `index.css`. Components consume `var(--...)` and never hardcode a hex value or invent a new one inline.

**The One Signal Rule.** Terracotta is the only color allowed to mean "act here" or "this is active." A control that isn't a primary action or a pressed state stays Ink-on-Sky, no matter how important it feels.

**The Data-Is-Locked Rule.** Clinical, overlay, and chart-series colors are medical/data identity, not palette decoration. A redesign may touch Foam, Sky, Ink, Terracotta, or Focus; it does not touch these three families without a deliberate, documented decision.

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

Full-width, edge-to-edge horizontal bands (header, command bar, filter bar, overlay toggle) stack vertically with no page-level max-width above them; content below sits in a single centered column, `max-width: 1280px`, with responsive gutters (`16px` mobile → `32px` medium → `64px` extra-large) and a `32px` (`2xl`... `xl`) vertical rhythm between sections.

The stat tiles use a responsive grid — 1 column on mobile, 2 at the small breakpoint, 4 at large — so the four vitals never crowd on a phone-width screen. Everywhere else, layout is `flex` with `flex-wrap`, letting filter/toggle rows reflow onto additional lines rather than truncating or requiring horizontal scroll — no control is ever clipped off-screen.

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

The system is flat by default and lifts selectively. The one shadow token, `--shadow-elevation`, marks a small set of "island" surfaces sitting on the flat Foam/Sky sea: stat tiles, the empty-state card, chart tooltips, the agent-unavailable banner, the logout confirmation dialog, and the overlay-toggle buttons. The full-width command bands — header, command bar, filter bar — stay perfectly flush at zero elevation; they are the sea itself, not objects floating on it.

```css
:root {
  --shadow-elevation: 0 4px 10px -2px rgba(20, 33, 61, 0.12),
                       0 2px 4px -2px rgba(20, 33, 61, 0.08);
}
.dark {
  /* a flat black shadow reads as invisible on #0B1626/#13233A, so dark mode
     pairs a low-opacity black shadow with a 1px light hairline to fake an
     edge-highlight instead */
  --shadow-elevation: 0 4px 10px -2px rgba(0, 0, 0, 0.5),
                       0 0 0 1px rgba(232, 241, 239, 0.06);
}
```

### Shadow Vocabulary
- **Elevation** (`box-shadow: var(--shadow-elevation)`): the only shadow in the system. One depth, applied or not applied — there is no elevation *scale* (no low/medium/high tiers).

### Named Rules
**The Flat-Sea Rule.** Command and filter surfaces never cast a shadow — only discrete card-like "islands" do. If a new surface is a control band spanning the full width, it stays flat; if it's a self-contained card or dialog, it gets the one elevation token.

## Shapes

Three corner radii, keyed to what they sit on, plus a 2px Ink border used as the system's default "outline" identity for anything that isn't accent-filled.

- **`lg` (8px):** secondary header chrome — theme toggle, Voice Replies toggle, Guide toggle, Upload/Add Record/Log out controls. The smaller radius is a deliberate, quiet distinction from the app's primary interactive surfaces.
- **`xl` (12px):** the default for everything else interactive or containing — cards, dialogs, tooltips, inputs, and every FilterBar/CommandBar/OverlayToggle button. Bumped up from 8px in the Phase 12 visual refresh for a slightly softer, more contemporary feel; this is the radius to reach for on any new surface.
- **`full` (9999px):** reserved for information-bearing chips only — the six BP-category chips and the small round legend dot next to each category's percentage. A pill shape marks "this is a piece of data," never a generic action.

Borders are consistently `2px solid` Ink, used as the un-filled/inactive state's entire visual identity (no separate gray "border" token exists). A `2px dashed` Ink border is reserved specifically for a disabled/unavailable action (e.g. "Apply" before a valid date range is entered) — dashing, not dimming, is how the system says "not ready yet."

### Named Rules
**The Dashed-Border Rule.** A disabled or not-yet-valid action gets a 2px *dashed* Ink border, not a lowered-opacity solid one. The border style itself carries the "not ready" meaning.

## Components

Buttons, cards, and inputs share one language: thick 2px Ink outlines when inactive, solid Terracotta fill when primary or pressed, bold Label-size (20px/700) text, and — with the sole exception of the six discreet caregiver-utility controls in the header — a firm 48×48px minimum. Nothing here uses hover states as a meaningful signal; every interaction is a tap/click/keypress, since the primary user cannot reliably hover a pointer.

### Buttons
- **Primary** (`button-primary`): Terracotta fill, Terracotta-Text text, `xl` radius, 48px min height, `24px` horizontal padding, Label typography. The only accent-filled surface in the app — submit actions, "Show all data," "Apply," "Send," and the destructive-adjacent "Log out" confirm (there being no true destructive/delete actions in the product yet).
- **Secondary / Filter** (`button-secondary`): Sky fill, Ink text, 2px Ink border, `xl` radius, 48px min height. The inactive state for every FilterBar/OverlayToggle button; flips to the Primary treatment (plus a 2px Terracotta border) when `aria-pressed="true"`.
- **Header Chrome** (`button-chrome`): visually identical to Secondary but at `lg` (8px) radius instead of `xl` — the quiet tell that these are utility controls (theme, Guide, Upload, Log out), never primary actions, and are never accent-filled even when toggled on.
- **Icon-only** (`button-icon`): the mic button — Foam fill, Ink border and icon, 48×48px square, `xl` radius. The one icon-only control in the app, justified by a real `aria-label` that swaps with state ("Start voice control" / "Stop voice control").
- **Category chip** (pill, not in the frontmatter component set because its fill is per-category data, not a fixed brand token): `full` radius, solid clinical-category color, white/near-black chip text per theme, a 3px Ink ring (`box-shadow`, not `outline`) marking the active selection so `:focus-visible`'s own outline stays independently visible.
- **Disabled / not-ready:** 2px *dashed* Ink border, Sky fill, `cursor-not-allowed`, `aria-disabled="true"` — never a dimmed/low-opacity solid button.

### Cards / Containers (`card-surface`)
- **Corner style:** `xl` (12px).
- **Background:** Sky.
- **Shadow:** the one Elevation token (see Elevation & Depth) — every card gets it; the flat command/filter bands never do.
- **Border:** none by default; dialogs and the click-persistent chart tooltip add a 2px Ink border on top of the shadow for a firmer edge against the page.
- **Internal padding:** `24px` is the default (stat tiles, dialogs); the empty state uses `32px` for its more ceremonial, centered moment; the chart tooltip uses a tighter `16px` since it's transient and data-dense.

### Inputs / Fields (`input-field`)
- **Style:** Foam fill (one step lighter/different from the Sky card it usually sits inside — inputs are never Sky-on-Sky), 2px Ink border, `xl` radius, 48px min height, Body-size (18px) text.
- **Labels:** Label typography (20px/700), stacked above the field (`flex-col`, `4px` gap) — never placeholder-as-label.
- **Focus:** the sitewide 3px Focus-colored ring, `2px` offset — identical treatment to every other interactive element, no special input-focus style.
- **Error:** inline text below the field, `role="alert"`, Body weight (never bold, so it doesn't visually compete with the Label above it) — never a red border or red text; errors read by word ("Enter a date like 2025-06-13"), not by color.

### Navigation / Header
No dedicated nav component — the header is a single flex row (logo mark + title, left; theme/voice/guide/view/logout controls, right) with a decorative wave-curve SVG divider (Sky-colored, flips with theme) beneath it. All header-right controls use the Header Chrome button style and are always icon + text, never icon-only.

### Signature Component: The Command Bar
The full-width text-and-voice input between the header and filter bar is the app's one truly distinctive component: a single `aria-live` region resolves, one at a time, the rotating example placeholder, the live voice transcript (in the Normal-category green, `--cat-normal`, reused here as the sole "listening" indicator color outside the clinical palette), the "Working…" spinner, and the applied confirmation — never more than one of these visible at once. The whole bar gains a 2px ring (Terracotta while working, green and `motion-safe:animate-pulse` while listening) so its state is legible before a word is read.

## Do's and Don'ts

### Do:
- **Do** keep Terracotta to its reserved list — primary actions and pressed/active states only.
- **Do** pair every state change with a word and/or icon, never color alone (the app's own hue-collision math treats this as a backstop, not decoration).
- **Do** hold every interactive target to 48×48px minimum, unless it's one of the six explicitly documented discreet header-utility controls.
- **Do** gate any new motion behind `motion-safe:`/`motion-reduce:` pairs, with a static fallback (a ring, not a spin) for the reduced-motion case.
- **Do** reach for `xl` (12px) radius on any new card, dialog, button, or input; reserve `lg` (8px) for header-chrome-style secondary controls and `full` for data-bearing chips only.
- **Do** treat a disabled action with a dashed border, not a dimmed one.

### Don't:
- **Don't** touch the six clinical BP-category colors, the three overlay-dataset colors, or the chart-line colors for aesthetic reasons — they are locked medical/data identity.
- **Don't** add a hover-only, drag, or precise-pointing interaction anywhere — the primary user cannot reliably operate a pointer.
- **Don't** introduce a third font weight — only 400 and 700 ship as static files for Atkinson Hyperlegible; a synthesized weight is a regression, not an enhancement.
- **Don't** let the Focus ring and Terracotta accent collapse into the same color again — they were deliberately separated in dark mode so a focused control and a pressed control are never visually confused.
- **Don't** hardcode a hex value in a component. Every color is a `var(--...)` custom property declared once in `index.css` for both themes.
