---
phase: 14
name: Unified Show Panel and Combined Timeline
source: client change request (Chris), 2026-09-12 meeting
status: decisions-locked
design_contract: https://claude.ai/code/artifact/d8f16a7b-6247-4117-af57-24cd31f11602
---

# Phase 14 Context — Unified Show Panel and Combined Timeline

## Origin

Direct client request from Chris, relayed verbatim:

> "We've gotta figure out some sort of way to turn on and off the different things that we're
> looking at… Might be nice if any data sets were clickable so that we could say, let's say,
> **only see the blood pressures and pulses** versus the hospital stays — and/or mix the hospital
> stays and only the pulses."

Three asks are buried in that sentence. One already works; two are impossible today:

| Ask | Today | Status |
|-----|-------|--------|
| "mix the hospital stays and only the pulses" | Pulse Trend hero + incidents overlay on | Already works |
| "only see the blood pressures **and** pulses" | `bp_timeline` and `pulse_trend` are mutually-exclusive hero charts | **Impossible** |
| "versus the hospital stays" (events alone) | Overlays only render *on top of* a vitals chart | **Impossible** |

Root cause: the dashboard runs two different control models side by side and Chris reads them as
one. The chart deck is radio-select (`activeChart`); the overlay row is multi-select
(`overlayDatasets`). His instinct that "any data sets" should be clickable is correct; the app
doesn't honour it.

## What this reverses

`09-CONTEXT.md` locked the opposite: OVERLAY-03's toggle set was reinterpreted as **event-types
only** (labs/incidents/procedures), with "BP Timeline and Pulse Trend stay today's two separate
hero charts, **no new combined-metric chart**."

That was a defensible scope call in Phase 9. It is not what the client wants. Recorded here
explicitly so nobody rediscovers the Phase 9 decision mid-build and assumes this phase missed it.

## Locked decisions

- **D-01 — One combined timeline.** A single time-series chart replaces the hero/mini rotation for
  the two vitals. Every series is an independent checkbox. Approved over the smaller
  "keep 4 charts, restyle the toggles" alternative, which would not deliver either missing ask.
- **D-02 — Five checkboxes, BP welded.** Blood Pressure (systolic + diastolic together), Pulse,
  Labs, Incidents, Procedures. Systolic/diastolic are NOT split: Chris said "blood *pressures*" as
  one thing, it is how BP is read clinically, and it keeps the voice vocabulary at five tokens
  instead of six-plus with "systolic"/"diastolic" to mis-transcribe. Splitting later is an extra
  box, not a redesign.
- **D-03 — Dual axis.** mmHg on the left (fixed clinical domain [40, 220], existing D-05 lock),
  bpm on the right (fixed [30, 120]). Left axis hidden when BP is off; right axis hidden when Pulse
  is off. Never auto-fit.
- **D-04 — Bands and reference lines follow their series.** AHA category bands render only when
  Blood Pressure is on (they are BP context). The 60 bpm bradycardia `ReferenceLine` renders only
  when Pulse is on.
- **D-05 — No vitals checked → dated event list.** The chart is replaced by a plain dated list of
  whatever event types are checked, not an axis with nothing plotted on it. This is the literal
  answer to "versus the hospital stays".
- **D-06 — Nothing checked → guided prompt.** A pick-something prompt with a one-tap "show
  everything". Never a blank panel. Reuses the existing `EmptyState` language.
- **D-07 — Incidents keeps the label "Incidents".** The dataset holds falls and seizures as well as
  hospitalizations (`IncidentFields.tsx` placeholder: "e.g. Fall, Hospitalization, Seizure"), so a
  box labelled "Hospital stays" would mislabel a fall. Chris's own phrase keeps working by voice —
  `prompt.py` already maps "hospital stays" and "hospitalizations" to `incidents`.
  **Reversible in one word if Chris asks to see his phrase on screen.**
- **D-08 — BP Categories and AM vs PM stay separate.** They are summaries of the filtered range,
  not time series; there is no honest way to overlay them. Reached by voice or a small view
  switcher. The Show checkboxes do not apply there and the panel must say so rather than silently
  doing nothing (same honesty as today's `OverlayToggle` "doesn't apply here" note).
- **D-09 — Labs stay as date markers.** Lab results carry numeric values and could be trend lines,
  but that is a materially larger feature. Markers for now; logged as the obvious next request.
- **D-10 — First-load default:** Blood Pressure on, Pulse on, all three event types off. Same
  default for caregivers — one shared view is simpler to support by phone. Existing localStorage
  persistence means this governs a new device only.

## Blocker found during design review

**`PulseTrend.tsx:121` strokes the pulse line with `var(--line-systolic)`** — the same colour as
systolic. Invisible today because the two charts never coexist; on a combined chart the two series
would be indistinguishable.

Required: a new `--line-pulse` token in **both** themes, a contrast case added to
`frontend/src/tests/contrast.test.ts` (which currently covers brass/hazard/panel only, not the line
colours), and a **dashed stroke** on pulse so the series survives colour-blindness and greyscale.
The candidate rust hue must be checked against `--color-hazard` so it does not read as an alarm.

## Agent schema gap

Chris's own example — "**only** see the blood pressures **and** pulses" — is a *two-dataset,
exclusive* command. `ToggleDataset` (`backend/app/agent/schemas.py:135`) takes exactly one dataset
plus an explicit on/off state, single-valued by a deliberate Phase 9 decision. It cannot express
that sentence. This is the first example the client gave, so it is not an edge case.

Resolution:
- Keep `toggle_dataset` for additive commands ("show my pulse").
- Add a **`show_only`** action carrying a *list* of datasets — everything named goes on, everything
  else goes off. Trigger words: "only", "just", "nothing but".
- Grow `DatasetToken` from three to five: `blood_pressure`, `pulse`, `labs`, `incidents`,
  `procedures`.
- Propagate through `schemas.py`, `prompt.py`, `service.py`, `copy.py`, the frontend
  `AppliedFilters` mirror in `api/types.ts`, `voiceCommands.ts`, and the guide's
  "What Can I Say" section.

## Accessibility floor (unchanged, non-negotiable)

- Real `<input type="checkbox">` with the label inside a ≥48px target — matches Chris's stated
  "like a check box" mental model, replacing the current `aria-pressed` button treatment.
- No hover-only state, no drag, no precise pointing.
- Tab reaches every box; Space toggles.
- Series distinguished by **stroke pattern and glyph as well as colour** — solid BP, dashed pulse,
  ◆ ▲ ■ event markers. Nothing depends on colour alone.
- Live `aria-live="polite"` selection sentence, mirroring the existing D-20 filter sentence.
- New colour tokens get contrast cases in both themes.

## Out of scope

- Splitting systolic/diastolic into separate boxes (D-02).
- Labs as trend lines (D-09).
- Any change to ETL, database schema, or records CRUD. This phase is presentation plus command
  vocabulary only.
- Funding the Anthropic API key. The agent is still inert in production (AGENT-01, $0 balance), so
  the new voice vocabulary can be built and unit-tested but not demonstrated live.

## Known risks

- **Dual axes can imply a correlation** between BP and pulse that is not there. Mitigated by the
  dashed pulse stroke and clearly labelled axes; watch at the first visual checkpoint.
- **Marker density.** Three event types at once over a long range will crowd on a phone; the
  existing `isDotCrowded` helper in `lib/chartData.ts` is the precedent to extend.
- **Blast radius.** `FilterBar`, `OverlayToggle`, `ChartDeck`, and `store/filters.ts` all change
  together, plus the backend agent package. This is phase-sized, not a quick task.
