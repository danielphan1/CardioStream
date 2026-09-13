---
phase: 14
artifact: REVIEW
depth: standard
date: 2026-09-12
scope: 44 files changed across commits fb302b7..ac38121 (frontend + backend)
findings: 4 (1 critical, 1 warning, 2 minor)
---

# Phase 14 Code Review

Review of the Phase 14 diff. Findings are ranked by user impact and each was confirmed by
execution, not by reading alone.

---

## CR-01 — CRITICAL: the events-only view is unreachable whenever the filtered range has no readings

**`frontend/src/App.tsx:175`**

```tsx
} else if ((readings.data ?? []).length === 0) {
  chartRegion = <EmptyState … />;   // short-circuits before ChartDeck
}
```

That guard is correct for the app Phase 14 replaced, where the chart region *always* needed
blood-pressure readings. It is now wrong: with no vitals selected the region needs **events**, not
readings, and this branch runs first.

**Failure scenario.** Chris unticks Blood Pressure and Pulse, ticks Incidents, and sets a date
range with no BP readings in it — say a hospital stay week where nobody took his blood pressure.
He asked to see the hospital stay. He gets "No readings match these filters" and no events at all.
This is precisely the "versus the hospital stays" case the phase exists to deliver, and it fails
exactly when it matters most: the periods with missing vitals are the interesting ones.

The same branch also swallows the D-06 nothing-selected prompt, so unticking everything on an
empty range shows readings-empty copy instead of the recovery button.

**Why the tests missed it.** `ChartDeck` is unit-tested directly with readings supplied, and the
live walkthrough used the full seeded range (132 readings), so the guard upstream never fired. The
bug lives in the *caller*, in a branch that predates the phase.

**Fix:** only divert to `EmptyState` when the region actually needs readings.

---

## CR-02 — WARNING: events render twice when no vitals are selected

**`frontend/src/App.tsx:249`**

With no vitals on, the chart slot renders `EventTimelineList` under the heading "Events", and
`OverlayEventsList` renders the same rows immediately below under "Overlaid events". Confirmed
live — the page carried headings `["Events", "Readings", "Overlaid events"]` with identical data.

`OverlayEventsList` exists as the accessible equivalent of the chart's *markers* (OVERLAY-06). When
there are no markers because there is no chart, it is duplicating the thing that replaced it. For a
screen-reader user this is worse than visual noise: the same events are announced twice under two
different headings.

**Fix:** suppress `OverlayEventsList` in exactly the case where the chart slot has become the event
list. No other state changes.

---

## WR-01 — WARNING: `showAllData()` quietly changed what "start over" means

**`frontend/src/store/filters.ts`**

`showAllData()` now switches **all five** datasets on. Previously it set the three overlays to
`false`. The agent's `reset` action — "show all data", "start over", "reset", "everything" — routes
here, so those utterances now turn on labs, incidents, and procedure markers.

That conflates two different intents. Clearing filters is subtractive ("stop hiding things");
turning on three marker sets is additive ("show me more things"). D-11 documented this action as
the former. A caregiver saying "start over" after a confusing session gets a *busier* screen than
the default the app ships with, which is the opposite of starting over.

I introduced this to back the D-06 "Show everything" button, which does legitimately want all five
on. Two intents, one action.

**Fix:** `showAllData()` returns to the documented default (blood pressure + pulse on, events off,
filters cleared). The empty-state button calls `showOnlyDatasets` with all five instead, so each
action means what its name says.

---

## WR-02 — MINOR: the spoken confirmation says "Showing nothing"

**`frontend/src/lib/agent.ts`**

With every box unticked, `composeConfirmation` produces:

> `Showing nothing, all data`

Verified by execution. It is grammatical but reads as a glitch, and this string is spoken aloud by
TTS to a user whose primary channel is audio. Reachable any time the last box is unticked.

**Fix:** a dedicated phrase for the empty selection.

---

## Checked and found sound

- **Dual-axis binding.** Both `YAxis` mounted with `hide`; markers bound to the visible axis. The
  marker-axis bug was caught during execution and is locked by a parameterised regression test.
- **Persistence migration.** Exercised against a genuine pre-Phase-14 localStorage blob in the
  browser, not just fixtures. Rejects garbage, survives a throwing `localStorage` in both directions.
- **`showOnly` ordering.** Applied after the additive paths, so a delta carrying both ends in the
  exclusive state requested. `reset` + `showOnly` also resolves correctly.
- **Trust boundary.** Only closed-union `AppliedFilters` fields reach store actions; nothing
  model-authored is executed. The empty-`datasets` guard is enforced server-side where the schema
  cannot express `minItems`.
- **`hasOtherCommand`** remains explicitly enumerated (not `Object.keys`), so guide auto-close still
  works despite FastAPI serializing every null key — and both new fields were added to it.
- **Accessibility floor.** Real checkboxes in ≥48px targets, never disabled, dual-encoded
  (stroke/glyph + text), contrast-tested in both themes.
- **No dead code.** `variant`/mini branches removed outright rather than left unreachable;
  `OverlayToggle`, `BPTimeline`, `PulseTrend` deleted with their stale references updated.

## Not covered by this review

Live voice behaviour against a real model — the agent is inert (AGENT-01). The command vocabulary
is reviewed as code and covered by unit + parity tests only.
