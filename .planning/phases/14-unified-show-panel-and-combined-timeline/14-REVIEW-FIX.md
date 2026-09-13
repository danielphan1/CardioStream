---
phase: 14
artifact: REVIEW-FIX
date: 2026-09-12
findings_addressed: 5 of 5 (4 from review + 1 found while fixing)
status: all fixed and verified
---

# Phase 14 Review Fixes

All four `14-REVIEW.md` findings fixed, plus a fifth the regression tests surfaced during the fix.

| ID | Severity | Fix | Verified by |
|----|----------|-----|-------------|
| CR-01 | Critical | `regionNeedsReadings` guard in `App.tsx` | live browser, both directions |
| CR-02 | Warning | `eventsAreTheChart` suppression in `App.tsx` | live browser |
| CR-03 | Warning | removed duplicate `<h2>` in `NothingSelected` | `ChartDeck.test.tsx` |
| WR-01 | Warning | `showAllData()` restores defaults; button uses `showOnlyDatasets` | `filters.test.ts`, `ChartDeck.test.tsx` |
| WR-02 | Minor | dedicated phrase for the empty selection | `agent.ts` execution |

---

## CR-01 — events-only view unreachable on a zero-reading range

`App.tsx` now computes `regionNeedsReadings` and only diverts to `EmptyState` when the chart
region actually consumes readings:

```tsx
const regionNeedsReadings = chartView !== "timeline" || hasVitals(visibleDatasets);
} else if ((readings.data ?? []).length === 0 && regionNeedsReadings) {
```

**Live verification, both directions** — this is the important part, because the bug lived in a
branch the unit tests never reach:

| Setup | Before | After |
|---|---|---|
| Events-only, Jan 2024 (no readings) | readings EmptyState, events hidden | headings `["Events", "Readings"]`, event region present, no EmptyState |
| Both vitals on, Jan 2024 (no readings) | EmptyState | **still** EmptyState — `"No readings match these filters"` |

The second row matters as much as the first: the fix had to stay narrow, not blanket-disable a
guard that is still correct whenever a vitals series is on.

## CR-02 — duplicate event rendering

`OverlayEventsList` is suppressed when the chart slot has itself become the event list:

```tsx
const eventsAreTheChart = chartView === "timeline" && !hasVitals(visibleDatasets);
```

Live: `"Overlaid events"` heading count went from 1 to 0 in the events-only state, while the
"Events" region stayed. No other state changed — the list still renders whenever markers are drawn.

## CR-03 — duplicate heading (found while fixing, not in the original review)

Writing `ChartDeck.test.tsx` surfaced a defect neither the review pass nor the live walkthrough
caught: `ChartDeck` renders `<h2>{title}</h2>` for the region *and* `NothingSelected` rendered its
own `<h2>Nothing selected</h2>`. The same text appeared twice, stacked, and was announced twice.

`getByRole("heading", { name: "Nothing selected" })` failed with "Found multiple elements" —
the test found it before a human would have. Removed the inner heading; `EventTimelineList` and
`CombinedTimeline` already leave the heading to the parent, so this restores consistency.

Worth noting as evidence for writing the routing test at all: the branch had been rendered on
screen during verification and the duplication was not noticed by eye.

## WR-01 — `showAllData()` semantics

Split the two intents that had been sharing one action:

- `showAllData()` — "show all data" / "start over" / `reset` — clears filters and returns datasets
  to the shipped default (blood pressure + pulse on, events off). Subtractive, matching D-11.
- The D-06 "Show everything" button — calls `showOnlyDatasets(DATASET_KEYS)`, turning all five on
  **without** discarding a date range the user deliberately set.

Each action now does what its name says. Covered by two new store tests and two new ChartDeck
tests (including the explicit assertion that the button leaves `datePreset: "30d"` intact).

## WR-02 — "Showing nothing"

`datasetsPhrase` returns `null` for an empty selection and `composeConfirmation` short-circuits to
`"Nothing selected — pick a dataset to see it"` rather than `"Showing nothing, all data"`. This
string is spoken by TTS to a user whose primary channel is audio, so the phrasing is the feature.

---

## Verification

| Check | Result |
|-------|--------|
| Frontend tests | **475 passed**, 37 files (was 468/36 — +7, +1 file) |
| Backend tests | 278 passed (1 pre-existing `.env` failure, unrelated) |
| `tsc -b --noEmit` | clean |
| `oxlint` | clean |
| Live: events-only on empty range | events render, no EmptyState |
| Live: vitals on empty range | EmptyState still correct |
| Live: duplicate events list | gone |

New file `ChartDeck.test.tsx` (6 tests) locks all four routing branches plus the WR-01 button
contract. It is the suite that caught CR-03, and it closes the gap the review identified: the
routing logic itself had no direct test before.
