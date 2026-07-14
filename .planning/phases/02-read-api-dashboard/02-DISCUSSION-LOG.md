# Phase 2: Read API & Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 2-Read API & Dashboard
**Areas discussed:** Chart presentation, Visual style & colors, Filter controls, Stats strip & table

**Session note:** Discussion was paused after three areas via `/gsd-pause-work` and resumed the same day via `/gsd-resume-work`; the final area (Stats strip & table) was completed on resume.

---

## Area selection (project-wide directive surfaced here)

User selected **all four** proposed gray areas and added freeform:

> "This is not going to be like the Tableau prototype. This will be a stand-alone project. For the rest of the creation of this project, do not consider Tableau as an example."

Captured as project-wide decision D-01 — overrides DASH-11's "matching Tableau styling" wording and the roadmap's success-criterion phrasing; the four chart types remain.

---

## Chart presentation

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time (Recommended) | One large chart with big switcher buttons; maps to voice | |
| All four in a grid | 2×2 dashboard, smaller charts | |
| One large + mini previews | Active chart large, others as clickable thumbnails | ✓ |

**User's choice:** One large + mini previews — with rotation: clicking a mini swaps it into the hero slot and the former hero becomes a mini.

| Option | Description | Selected |
|--------|-------------|----------|
| BP Timeline (Recommended) | Core dataset, most-asked question | ✓ |
| Pulse Trend | 60 bpm line, narrower story | |
| BP Categories | Distribution summary | |
| AM vs PM | Drill-down view | |

**User's choice:** BP Timeline as default hero.

| Option | Description | Selected |
|--------|-------------|----------|
| Live mini charts (Recommended) | Real Recharts renders updating with filters | ✓ |
| Simplified sparklines | Static shapes suggesting chart type | |
| Icon + title cards | Labeled buttons, no data | |

**User's choice:** Live mini charts.

| Option | Description | Selected |
|--------|-------------|----------|
| Row below the hero (Recommended) | Hero full width; minis strip underneath | ✓ |
| Column beside the hero | Minis stacked right, narrower hero | |
| You decide | Planner/UI phase picks | |

**User's choice:** Row below the hero.

| Option | Description | Selected |
|--------|-------------|----------|
| Quick animated swap (Recommended) | ~200–300ms move/scale, reduced-motion fallback | ✓ |
| Instant swap | No animation | |
| You decide | Either acceptable | |

**User's choice:** Quick animated swap.

| Option | Description | Selected |
|--------|-------------|----------|
| Click/tap + keyboard (Recommended) | Generous hit areas + accessibilityLayer arrows; persistent large tooltip | ✓ |
| Fixed detail panel | Permanent large-text panel, costs space | |
| No point inspection | Trends only; values in table/stats | |

**User's choice:** Click/tap + keyboard.

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle tinted zones (Recommended) | Low-opacity bands with edge labels | ✓ |
| Bold colored bands | Unmissable but drowns data lines | |
| Toggle-able bands | Off by default with toggle | |

**User's choice:** Subtle tinted zones.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed clinical range (Recommended) | BP ~40–220, pulse ~30–120; stable positions | ✓ |
| Auto-fit with padding | Efficient, but readings move between filters | |
| Hybrid floor/ceiling | Auto-fit with clinical minimum window | |

**User's choice:** Fixed clinical range.

| Option | Description | Selected |
|--------|-------------|----------|
| Count + percent (Recommended) | "Stage 1 — 34 readings (26%)" | ✓ |
| Count only | Raw number per category | |
| Percent only | Share per category | |

**User's choice:** Count + percent (BP Categories bar labels).

| Option | Description | Selected |
|--------|-------------|----------|
| Dots on lines (Recommended) | Marker per reading; discrete data made visible; tap targets | ✓ |
| Smooth lines only | Cleaner, implies continuity | |
| Dots only when zoomed in | Adaptive markers on short ranges | |

**User's choice:** Dots on lines.

| Option | Description | Selected |
|--------|-------------|----------|
| Direct line labels (Recommended) | "Systolic"/"Diastolic" at line ends in line color | ✓ |
| Legend above the chart | Standard swatch legend | |
| Both | Labels + legend | |

**User's choice:** Direct line labels.

| Option | Description | Selected |
|--------|-------------|----------|
| Message + guidance (Recommended) | Why empty, newest-reading date, "Show all data" button | ✓ |
| Auto-widen the range | Silent fallback, second-guesses user | |
| Simple empty message | Minimal, no next step | |

**User's choice:** Message + guidance (empty state).

---

## Visual style & colors

**Freeform direction (given at the more-questions gate of the charts area):**

> "The theme should be naval like (meaning sail boats, ocean, water, etc.) The color should be ocean like colors, but aiming towards minimalistic colors such as pastel colors and navy."

| Option | Description | Selected |
|--------|-------------|----------|
| Pastels as canvas only (Recommended) | Pastels on surfaces; navy/deep tones carry text, data, interactive | ✓ |
| Pastels everywhere, darkened | Pastel-adjacent data colors passing contrast | |
| Navy-dominant | "Night sea" navy surfaces, pastel accents | |

**User's choice:** Pastels as canvas only.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep clinical semantics (Recommended) | Green→red severity tuned to palette; blue-grey Hypotension | ✓ |
| Full ocean recolor | Severity as ocean ramp — loses red=danger | |
| Hybrid | Ocean for calm categories, warning colors for Stage 2/Crisis | |

**User's choice:** Keep clinical semantics.

| Option | Description | Selected |
|--------|-------------|----------|
| Light, airy nautical (Recommended) | Pale foam/sky + navy | |
| Dark 'night sea' | Navy-black + light text + pastel accents | |
| Both with a toggle | Ship light and dark with large toggle | ✓ |

**User's choice:** Both with a toggle.

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle motifs (Recommended) | Header mark, wave dividers, themed empty states; clean charts | ✓ |
| Palette only | Colors carry the whole theme | |
| Fully illustrated | Sailboats and wave backgrounds throughout | |

**User's choice:** Subtle motifs.

---

## Filter controls

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented button row (Recommended) | Four large buttons, active filled navy, 1:1 voice mapping | ✓ |
| Dropdown select | Compact, hides state | |
| You decide | Planner picks | |

**User's choice:** Segmented button row (date presets).

| Option | Description | Selected |
|--------|-------------|----------|
| Large month/day pickers (Recommended) | From/To fields, oversized calendar ≥48px cells + typed entry | ✓ |
| Typed dates only | Text inputs with forgiving parsing | |
| Month-chip shortcuts | Big chips per month with data | |

**User's choice:** Large month/day pickers (custom range).

| Option | Description | Selected |
|--------|-------------|----------|
| Button groups, single-select (Recommended) | [All\|AM\|PM] segments; category chips, tap to isolate | ✓ |
| Multi-select categories | Independent chip toggles | |
| Dropdowns for both | Compact selects | |

**User's choice:** Button groups, single-select (AM/PM + category).

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal bar above hero (Recommended) | Between header and hero; reads like a sentence | ✓ |
| Collapsible side panel | Drawer; hides state when closed | |
| Below the hero chart | Chart first, controls pushed down | |

**User's choice:** Horizontal bar above hero.

---

## Stats strip & table

| Option | Description | Selected |
|--------|-------------|----------|
| Key numbers only (Recommended) | Avg BP, avg pulse, count, top category | |
| Everything from /stats/summary | Full API-02 payload as tiles | ✓ |
| Two-row hybrid | Headline tiles + slim min/max row | |

**User's choice:** Everything from /stats/summary.

| Option | Description | Selected |
|--------|-------------|----------|
| Between filters and hero (Recommended) | Filter → numbers → chart | ✓ |
| Below hero, above minis | Chart first, numbers as supporting band | |
| Side panel next to hero | Vertical stat column beside hero | |

**User's choice:** Between filters and hero.

| Option | Description | Selected |
|--------|-------------|----------|
| Show more button (Recommended) | Newest 20 + giant "Show 20 more" | ✓ |
| Scroll within the table | Fixed-height scrollable body | |
| Classic pagination | Page number controls | |

**User's choice:** Show more button.

| Option | Description | Selected |
|--------|-------------|----------|
| Vitals + colored chips (Recommended) | Date, Time, AM/PM, "128 / 74", Pulse, category chip; notes when present | ✓ |
| Every DB column | All fields incl. MAP, pulse pressure | |
| Compact + expandable rows | Minimal columns + tap-to-expand detail | |

**User's choice:** Vitals + colored chips.

---

## Claude's Discretion

Exact palette hex values (contrast-validated), fixed-axis bounds, tooltip layout, animation easing, wave-divider implementation, "Show more" increment mechanics, API JSON shapes and validation details, zustand store internals, below-the-fold arrangement of table and remaining content, responsive breakpoints.

## Deferred Ideas

None — discussion stayed within phase scope.
