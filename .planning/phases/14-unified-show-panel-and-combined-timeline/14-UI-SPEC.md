---
phase: 14
artifact: UI-SPEC
status: locked
source: client-approved design contract (artifact d8f16a7b), 14-CONTEXT.md D-01..D-10
---

# Phase 14 UI Design Contract — Show Panel & Combined Timeline

Implementation-level contract. The visual/product argument lives in the client-approved design
contract; this file pins the exact tokens, classes, states, and copy the executor must use so
nothing is re-derived at build time.

## 1. Component inventory

| Component | Fate |
|-----------|------|
| `OverlayToggle.tsx` | **Deleted.** Replaced by `ShowPanel.tsx`. |
| `FilterBar.tsx` | **Kept**, unchanged in scope — date presets, AM/PM, BP category. It never owned chart selection. |
| `ChartDeck.tsx` | **Rewritten.** Hero/mini rotation gone; renders one view per `chartView`. |
| `ShowPanel.tsx` | **New.** Five checkboxes + live sentence + not-applicable note. |
| `ChartViewSwitcher.tsx` | **New.** Three-way single-select: Timeline · BP Categories · AM vs PM. |
| `CombinedTimeline.tsx` | **New.** Dual-axis chart. Supersedes `BPTimeline`/`PulseTrend` as the hero. |
| `EventTimelineList.tsx` | **New.** Dated event list rendered in the chart slot when no vitals are checked. |
| `BPTimeline.tsx` / `PulseTrend.tsx` | **Deleted.** Their band, marker, and end-label machinery moves into `CombinedTimeline`. |
| `CategoryBars.tsx` / `AmPmComparison.tsx` | **Kept**, now reached through the view switcher; `variant` prop collapses to hero-only. |
| `OverlayEventsList.tsx` | **Kept**, keyed off `visibleDatasets` instead of `overlayDatasets`. |

## 2. ShowPanel

### Layout
Peer sibling of `FilterBar` inside the existing controls cluster in `App.tsx` — same
`<section className="bg-[var(--color-mist)] p-4">` shell `OverlayToggle` uses today, so the
Phase 13 surface language is unchanged.

Row order is fixed and never sorts: **Blood Pressure · Pulse · Labs · Incidents · Procedures.**
Vitals first, events second, matching the reading order of the chart itself.

### Checkbox control
A real `<input type="checkbox">` inside a `<label>`; the whole label is the target.

```
min-h-12 flex items-center gap-3 rounded-xl px-4 pl-3.5 text-label
bg-[var(--color-mist)] text-[var(--color-depth)]
border-2 border-[var(--color-depth)] shadow-[var(--shadow-elevation)]
```

- The `<input>` is **not** `sr-only` and **not** `appearance-none` without a replacement —
  it renders as a visible 26px box with `accent-[var(--color-brass)]`, so the checked state is
  a real checkmark, not a colour-fill the user has to interpret.
- Checked state adds the series key swatch at full opacity; unchecked shows it at the same
  size but hollow (`border-2`, transparent fill). **Never** dim the whole control — Phase 13's
  quick-task `260827-kir` removed exactly that anti-pattern from `OverlayToggle`, and
  DESIGN.md's disabled-state rule is dashed-border-only.
- `:focus-visible` keeps the global 3px `--color-signal` ring; do not override.

### Series key
Each checkbox carries the mark the chart uses, so the panel doubles as the legend:

| Box | Key glyph | Colour token |
|-----|-----------|--------------|
| Blood Pressure | 20×4px solid bar | `--line-systolic` |
| Pulse | 20×4px **dashed** bar | `--line-pulse` |
| Labs | `◆` | `--overlay-labs` |
| Incidents | `▲` | `--overlay-incidents` |
| Procedures | `■` | `--overlay-procedures` |

Glyphs are `aria-hidden="true"` — the label text carries the meaning.

### Live sentence (D-20 pattern)
`<p aria-live="polite" className="mt-4 text-[18px] text-[var(--color-depth)]">`

| State | Copy |
|-------|------|
| Some checked | `Showing blood pressure, pulse and incidents.` |
| Events only | `Showing incidents — no vitals selected, so these are listed by date.` |
| None checked | `Nothing selected — pick a dataset to see it.` |

Joiner is Oxford-free two-item (`a and b`) / comma series with `and` before the last —
reuse the existing `joinWithOr` shape in `lib/overlayEvents.ts` as the precedent, with `and`.

### Not-applicable note (OVERLAY-05 carry-over)
When `chartView !== "timeline"`, render below the boxes:

> `These datasets show on the Timeline — switch back to see them.`

`aria-live="polite"`. **Visible indicator only, never a functional gate** — the boxes stay
enabled and clickable so a caregiver can pre-set them (D-01's original lock, carried forward).

### Agent pulse
`PulseField` gains `"datasets"` and keeps `"chart"` for the view switcher. Same 1500ms
`motion-safe:animate-pulse` + static `ring-2 ring-[var(--color-brass)]` fallback that
`FilterBar`/`OverlayToggle` already use.

## 3. ChartViewSwitcher

Three `aria-pressed` buttons in a `role="group" aria-label="Chart view"`, reusing `FilterBar`'s
exact `activeClass`/`inactiveClass` pair (brass fill active, mist + depth border inactive).
Labels: `Timeline`, `BP Categories`, `AM vs PM`. Sits directly above the chart region.

## 4. CombinedTimeline

### Axes
| Axis | `yAxisId` | Orientation | Domain | Ticks |
|------|-----------|-------------|--------|-------|
| mmHg | `"mmHg"` | left | `[40, 220]` **fixed** | `40, 90, 120, 130, 140, 180, 220` |
| bpm | `"bpm"` | right | `[30, 120]` **fixed** | `30, 60, 90, 120` |

Both `<YAxis>` elements are **always mounted**; visibility is controlled with `hide`. This is
load-bearing: Recharts resolves `yAxisId` against mounted axes, so unmounting an axis while any
`ReferenceLine` still references it drops the marker silently. Never auto-fit either domain
(D-05 carry-over, DASH-06).

X axis unchanged from `BPTimeline`: `type="number"`, `scale="time"`, `domain={["dataMin","dataMax"]}`.

### Series
| Series | Axis | Stroke | Pattern |
|--------|------|--------|---------|
| Systolic | mmHg | `var(--line-systolic)` | solid, width 3 |
| Diastolic | mmHg | `var(--line-diastolic)` | solid, width 3 |
| Pulse | bpm | `var(--line-pulse)` | **dashed `9 5`**, width 3 |

The dash is not decoration — it is the non-colour differentiator required by the accessibility
floor, and the reason pulse stays legible against systolic in greyscale.

### Conditional chrome
- **AHA category bands** render only when Blood Pressure is checked, bound to `yAxisId="mmHg"`.
  Band-label chips keep the two-`ReferenceArea` split and explicit `zIndex={DefaultZIndexes.axis}`
  from `BPTimeline` — that fix (`260828-4nj`) was hard-won; do not collapse it back to one element.
- **60 bpm bradycardia `ReferenceLine`** renders only when Pulse is checked, bound to `yAxisId="bpm"`.
- **Event markers** are vertical `ReferenceLine`s bound to `yAxisId="mmHg"` unconditionally (safe
  because both axes are always mounted), keeping glyph + colour from `OVERLAY_META`.
- **Line-end labels** render for whichever vital series are on.

### Empty / degenerate states
| Condition | Render |
|-----------|--------|
| No vitals, ≥1 event type | `EventTimelineList` **instead of** the chart (D-05) |
| Nothing checked | Prompt card: `Nothing selected` + `Show everything` button (D-06) |
| Vitals on, zero readings in range | Existing `EmptyState` (unchanged) |

## 5. EventTimelineList

Rows of `date · glyph · what happened · detail`, newest first, reusing `mergeOverlayEvents`
output verbatim. Grid `96px 24px 1fr auto`, collapsing to `88px 20px 1fr` below 640px with the
detail wrapping to its own line — mirrors the `ReadingsTable` mobile reflow from `260827-2v2`.
Row min-height 48px. Not interactive in this phase (marker detail panels are v2 / OVERLAY-07).

## 6. New colour token

```css
/* light */ --line-pulse: #9E4A24;
/* dark  */ --line-pulse: #E3A07C;
```

Rust, deliberately warmer and lighter than `--color-hazard` (`#9C2B22` / `#E2685A`) so it does
not read as an alarm, and far from `--line-systolic` navy and `--line-diastolic` teal.

**Required verification before the token is considered done:**
1. `contrast.test.ts` gains cases for `--line-pulse` against `--color-deck` and `--color-mist`
   in **both** themes at the 3:1 non-text UI floor (WCAG 1.4.11). The suite currently covers
   brass/hazard/panel only — line colours have never been contrast-tested.
2. Same cases added for `--line-systolic` and `--line-diastolic` while the harness is open;
   they carry the same floor and were never covered.

If the rust fails 3:1 in either theme, darken (light) / lighten (dark) along the same hue rather
than switching hue families — the hue is chosen to avoid four existing collisions.

## 7. Accessibility floor (non-negotiable, unchanged)

- Real checkbox semantics; label inside a ≥48px target.
- No hover-only affordance, no drag, no precise pointing.
- Tab reaches every control; Space toggles a checkbox; the view switcher is arrow-key-free
  `aria-pressed` buttons matching existing `FilterBar` behaviour.
- Every distinction encoded twice: colour **and** (stroke pattern | glyph | text).
- `aria-live="polite"` on the selection sentence and the not-applicable note.
- Body text ≥18px; control labels use the `text-label` token (20px/600).
- `motion-safe:` gates every animation; `motion-reduce` renders instantly.

## 8. Copy contract

| Surface | Locked string |
|---------|---------------|
| Panel heading | `Show` |
| Not-applicable note | `These datasets show on the Timeline — switch back to see them.` |
| Nothing-selected sentence | `Nothing selected — pick a dataset to see it.` |
| Nothing-selected button | `Show everything` |
| Events-only suffix | ` — no vitals selected, so these are listed by date.` |
| View switcher labels | `Timeline` · `BP Categories` · `AM vs PM` |
| Checkbox labels | `Blood Pressure` · `Pulse` · `Labs` · `Incidents` · `Procedures` |

`Incidents` keeps its clinical label (D-07) — the dataset holds falls and seizures as well as
hospital stays. Chris's phrase stays reachable by voice, not by relabelling the box.
