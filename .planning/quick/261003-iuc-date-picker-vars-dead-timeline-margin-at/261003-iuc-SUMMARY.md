---
phase: quick-261003-iuc
plan: 01
subsystem: frontend
status: complete
tags: [accessibility, react-day-picker, css-custom-properties, recharts, responsive, charts]
dependency-graph:
  requires:
    - phase: quick-261003-hev
      provides: the "Open Water" palette these fixes restore the date picker into
    - phase: 16.1
      provides: the rail-and-popover shell verified at 390px here
  provides: ["48px date-picker targets", "--rdp-today-color", "COMPACT_WIDTH_PX responsive chart margin", "SeriesKey", "gradient area fills"]
  affects: [DateRangePicker, SingleDateField, CombinedTimeline, any future chart work]
tech-stack:
  added: []
  patterns:
    - "A library's CSS custom properties must be set ON the element the library declares them on — a declaration on the element beats an inherited value from an ancestor"
    - "Verify browser-visual claims only when document.visibilityState is 'visible'; hidden tabs no-op resizes and freeze requestAnimationFrame"
    - "A same-origin iframe gives a true narrow viewport without fighting the window's minimum width"
key-files:
  created:
    - frontend/src/tests/rdpSizing.test.tsx
    - frontend/src/components/charts/CombinedTimelineCompact.test.tsx
  modified:
    - frontend/src/components/rdpSizing.ts
    - frontend/src/components/DateRangePicker.tsx
    - frontend/src/components/records/SingleDateField.tsx
    - frontend/src/components/charts/CombinedTimeline.tsx
decisions:
  - "The series key renders ABOVE the chart, not below: below, it lands at the bottom of the scroll and the fixed Assistant button covers the last entry at maximum scroll, so 'Pulse' could never be read at 390px"
  - "Gradient areas follow the RAW series, never the trend — rollingAverage leaves the first six points null, so a trend-keyed Area starts mid-chart and drops a hard vertical edge to the axis (a grey slab, not a gradient)"
  - "AREA_PEAK_OPACITY 0.14, and the areas paint before the lines, so no series' contrast against its ground changes and contrast.test.ts needed no edit"
  - "COMPACT_WIDTH_PX gates on the measured CARD width, not a media query — the card and the viewport diverge above the 1280px content cap, same reasoning as the existing isDotCrowded"
  - "compact is false while width is 0, so the full-width layout is what renders before the first ResizeObserver tick and in jsdom"
metrics:
  duration: ~65min
  completed: 2026-10-03
---

# Quick 261003-iuc: date-picker variables, timeline margin, timeline gradients

Three follow-ups from finally verifying the frontend at 390px.

## The verification harness came first, because the old one was lying

Two previous sessions recorded that "Chrome refused to resize below ~1647px",
leaving the phone layout unverified. That was never a Chrome minimum-width
rule. `document.visibilityState` was `"hidden"` for the automated tab, and a
hidden tab silently no-ops `resize_window` **and never fires
`requestAnimationFrame`**.

The second half of that matters more than the first. Screenshots are captured
over CDP and succeed on a hidden tab, so the image looks authoritative while
the page behind it is frozen. Two things looked like serious bugs and were not:

- **`GuideOverlay` appeared permanently invisible.** Its double-rAF `shown`
  flip never ran, so it sat at `opacity-0` with the class list reading
  `opacity-100`. Reported as broken, then retracted.
- **The timeline rendered blank.** Recharts' draw-in animation is rAF-driven.

Both render correctly once the tab is visible. The phone layout itself was
verified by loading the app into a **same-origin iframe** at 390x820, which
gives a true viewport for media queries regardless of the window — worth
keeping as the narrow-width technique.

## Task 1 — every react-day-picker variable was dead (the real bug)

`rdpSizing` spreads six `--rdp-*` custom properties, but it was spread onto a
**wrapper div**. react-day-picker declares all six on `.rdp-root` itself, and a
declaration on an element beats a value inherited from an ancestor, so the
whole object was discarded:

| | rdpSizing claimed | actually rendered |
|---|---|---|
| day button | 48x48px | **42x42px** |
| `--rdp-accent-color` | `#1278AE` | **`blue` (#0000FF)** |
| `--rdp-today-color` | — | **`blue`** |

42px is under CLAUDE.md's non-negotiable >=48px floor, and it affected the
Dates filter *and* every Add Record form, at every width — not a mobile-only
issue. This is the same mechanism as the `.chart-band` fill-opacity bug found
in 261003-hev: the rule has to name the element that actually paints.

`DayPicker` forwards `props.style` to its root, so the fix is to spread there.
Verified live: 48.0x48.0 and `rgb(18, 120, 174)` on both today and the chevrons.

The new `rdpSizing.test.tsx` asserts the variables land on `.rdp-root` — jsdom
has no layout, so it guards the mechanism, which is the part that regressed and
the part no existing test could see. Confirmed failing (3 assertions) against
the old code before being kept.

## Task 2 — the timeline plot collapsed to 86px at phone width

`margin={{ right: 112 }}` is sized for the widest end-label pill. At 390px the
chart is 318px, so `318 - 112 - 60 - 60` left **86px** of drawable plot: two
x-axis ticks and a vertical smear of dots.

Below `COMPACT_WIDTH_PX` (520) of measured card width the pills come off and the
margin drops to 12 — **86px -> 186px**, four ticks, confirmed by the x-axis line
running `x1=60` to `x2=246`. The pills are the only thing naming the three
series, so `SeriesKey` replaces them, mirroring the dash pattern rather than
just the hue (the dash, not the colour, is what separates pulse from systolic
in greyscale and under colour-vision deficiency).

## Task 3 — gradient area fills

Deferred from 261003-hev; built now that the bands sit at their correct 10%.
`LineChart` becomes `ComposedChart` to carry the `Area`s.

The first attempt keyed the areas to the trend series and produced a hard-edged
grey slab from the midpoint — `rollingAverage` leaves the first six points null,
so the Area began mid-chart and dropped straight to the axis. Keying them to the
raw series spans the whole domain and reads as intended.

## Verification

```
npm test          -> 52 files, 784 passed, 0 failed  (was 774; +10 new)
npx tsc --noEmit  -> exit 0
npm run lint      -> exit 0 (one pre-existing GreetingHeader fast-refresh warning)
```

Live, with the tab actually visible, in **both themes**: date cells measure
48.0x48.0 with the accent resolving to `#1278AE`; the timeline draws six line
curves plus three area fills; at 390px via the iframe the plot is 186px and the
key names all three series clear of the Assistant button.

## Deviations from Plan

None.

## Known Stubs

None.

## Threat Flags

None — presentation only. No data path, no auth surface, no new dependency.

## Human Verification Still Outstanding

- **Login and the Guide's own content** were re-skinned by 261003-hev's token
  sweep but still have not been eyeballed individually.
- **Band-label chips crowd the data at 390px** — "Normal", "Hypotension" and the
  Bradycardia label overlap points and each other. Pre-existing, untouched here,
  and the obvious next narrow-width item.
- **A real phone**, as opposed to a 390px iframe in a desktop Chrome.

## Self-Check: PASSED

- FOUND: 3 commits on main (plan, day-picker fix, timeline work)
- FOUND: 784/784 tests, tsc 0, lint 0
- FOUND: 48.0x48.0 day cells and #1278AE accent measured in the live DOM
- FOUND: timeline x-axis line x1=60 x2=246 at a 318px chart (186px plot)
