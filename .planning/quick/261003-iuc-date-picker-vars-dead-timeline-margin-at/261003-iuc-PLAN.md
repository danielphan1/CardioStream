---
quick_id: 261003-iuc
slug: date-picker-vars-dead-timeline-margin-at
date: 2026-10-03
subsystem: frontend
status: planned
---

# Quick 261003-iuc: date-picker variables, timeline margin, timeline gradients

Three follow-ups found while finally verifying the frontend at 390px (via a
same-origin iframe — the window resize that two previous sessions blamed on
Chrome was actually no-oping because the tab was hidden).

## Task 1 — react-day-picker custom properties are dead (accessibility)

`components/rdpSizing.ts` sets six `--rdp-*` custom properties, but they are
spread onto a **wrapper div**. react-day-picker declares those same properties
on `.rdp-root` itself (`node_modules/react-day-picker/src/style.css:2-17`), and
a declaration on the element beats an inherited value from an ancestor. Every
override is therefore silently discarded:

| | rdpSizing claims | actually renders |
|---|---|---|
| day button | 48x48px | 42x42px |
| `--rdp-accent-color` | `var(--color-accent)` #1278AE | `blue` (#0000FF) |
| `--rdp-today-color` | (unset -> inherits accent) | `blue` |

42px is under CLAUDE.md's non-negotiable >=48px target floor, and this affects
every width, not just mobile. Same mechanism as the `.chart-band` fill-opacity
bug found in 261003-hev: a rule on the child beating an inherited value.

**Fix:** move `style={rdpSizing}` from the wrapper onto `<DayPicker>`, which
forwards `props.style` to the root element (`dist/esm/DayPicker.js:219`), in
both call sites — `DateRangePicker.tsx:94` and `records/SingleDateField.tsx:35`.
Add `--rdp-today-color`. Add a regression test that asserts the vars land on
`.rdp-root`, since this failure is invisible to every existing test.

## Task 2 — timeline plot area collapses at phone width

`charts/CombinedTimeline.tsx:278` hardcodes `margin={{ right: 112 }}` to fit the
widest end-label pill ("Diastolic"). At 390px the chart SVG is 318px, so
318 - 112 (margin) - 60 (left axis) - 60 (right axis) = **86px of plot**.

**Fix:** derive the right margin from the `width` the component already
measures via `useElementWidth`. Below the threshold, drop the end-label pills
and render a compact series key instead — the pills are the only thing
identifying the three lines, so they cannot just be removed.

## Task 3 — gradient area fills under the timeline lines

Deferred from 261003-hev on the grounds that a gradient over the six clinical
bands is mud, and that it would require converting `LineChart` to
`ComposedChart`. Now requested explicitly, with the bands at their correct 10%.

Constraint: must not weaken the contrast `contrast.test.ts` protects, and must
not disturb the band/line stacking order.

## Verification

- `npm test`, `npx tsc --noEmit`, `npm run lint` all green
- day button measures >=48px and accent resolves to #1278AE in a real DOM
- timeline plot area materially wider at 390px
