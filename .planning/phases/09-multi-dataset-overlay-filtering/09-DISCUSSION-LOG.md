# Phase 9: Multi-Dataset Overlay & Filtering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 9-Multi-Dataset Overlay & Filtering
**Areas discussed:** Overlay chart architecture, Voice toggle grammar, Overlay marker look & feel, Default state & reset behavior

---

## Overlay chart architecture

**Question 1:** When Chris turns on both "BP" and "pulse" together, what should happen on screen?

| Option | Description | Selected |
|--------|-------------|----------|
| BP/pulse aren't real toggle items | Reinterpret the requirement: BP Timeline/Pulse Trend stay as today's two separate hero charts; the real overlay set is the 3 event types plotted on whichever is active | ✓ |
| BP/pulse become real multi-metric toggles | Merge both lines onto one shared dual-axis timeline, event markers layer on top | |
| BP/pulse pick which chart is the base, not merge | A voice-driven alternate chart switcher, still separately-labeled toggle buttons | |

**User's choice:** BP/pulse aren't real toggle items (Recommended)
**Notes:** Matches ROADMAP.md's own success-criterion example ("hospital-stay marker plotted directly on the BP timeline"); no new chart component needed.

**Question 2:** Should overlay markers also appear on ChartDeck's small preview cards, or hero chart only?

| Option | Description | Selected |
|--------|-------------|----------|
| Hero chart only | Markers only on the big active chart; previews stay clean/decorative | ✓ |
| Hero and preview cards both | More visually consistent but previews get busier with uninspectable markers | |

**User's choice:** Hero chart only (Recommended)
**Notes:** Preview cards are `pointer-events-none` with no tooltip today (Pitfall 8) — markers there would just be noise.

---

## Voice toggle grammar

**Question 1:** How should Chris turn overlay layers on/off by voice — one dataset per command, or can one sentence name several at once?

| Option | Description | Selected |
|--------|-------------|----------|
| One dataset per command | "Add incidents", "turn off labs" — incremental, builds up combination over turns | ✓ |
| One sentence can set a whole combination | "Show incidents and procedures" in one command — needs a list-typed schema field | |
| Support both phrasings | Most flexible, largest schema/parsing surface | |

**User's choice:** One dataset per command (Recommended)
**Notes:** Matches every existing agent command field (chart, bp_category, am_pm are all single-valued); resolves the research-flagged toggle_dataset schema-shape open question in favor of single-valued, avoiding the untested list-typed structured-outputs question.

**Question 2:** Should each command set an explicit ON/OFF state, or flip current state?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit ON/OFF | "Show incidents" always ON, "hide incidents" always OFF — idempotent | ✓ |
| Flip current state | "Toggle incidents" flips whatever it is — shorter but riskier | |

**User's choice:** Explicit ON/OFF (Recommended)
**Notes:** Matches the agent's existing explicit-value convention; avoids Chris needing to track current state.

---

## Overlay marker look & feel

**Question 1:** How should Chris/caregivers tell the 3 marker types apart at a glance (not by color alone)?

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct shape + color per type | Each type gets its own marker shape plus color; colorblind-safe | ✓ |
| Same shape, color only + a legend | Simpler to build, but leans on color as primary signal | |
| You decide | No specific preference on shape vs. icon vs. pattern | |

**User's choice:** Distinct shape + color per type (Recommended)
**Notes:** Satisfies OVERLAY-04's non-color-only requirement directly.

**Question 2:** How should an event (no BP/pulse value of its own) translate to a chart position?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-height vertical line at that date | ReferenceLine spans the chart, icon+label at top; unmissable | ✓ |
| Small icon at a fixed height near top/bottom | Less visually dominant, can get crowded | |

**User's choice:** Full-height vertical line at that date (Recommended)
**Notes:** Resolves the research-flagged "overlay accessibility mechanism" open question in favor of a ReferenceLine-based approach over Scatter+accessibilityLayer.

---

## Default state & reset behavior

**Question 1:** Should any overlay layers be on by default at first load?

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing on by default | Matches every other filter's neutral-default convention | ✓ |
| Turn something on by default | e.g. incidents on by default — more useful but inconsistent | |

**User's choice:** Nothing on by default (Recommended)

**Question 2:** Should "show all data"/reset also clear overlay toggles?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset clears overlay too | One predictable "start over" command clears everything | ✓ |
| Reset leaves overlay alone | Overlay stays on until explicitly toggled off, per its "independent concern" framing | |

**User's choice:** Reset clears overlay too (Recommended)

---

## Claude's Discretion

- Exact visual treatment of the "doesn't apply here" indication on BP Categories/AM-PM charts (OVERLAY-05 requires visible indication, not silent no-op; exact styling not locked).
- Exact icon/glyph choice per event type (flask, alert icon, clipboard icon, etc.).
- Whether the overlay toggle row lives inside `FilterBar` or as an adjacent control group.
- Data-fetching hook shape (separate `useLabs`/`useIncidents`/`useProcedures` vs. one combined hook).
- Whether toggling a layer triggers an immediate fetch vs. relying on prefetch (flagged: Phase 8's `useReadings.ts` staleTime caveat needs re-examination, not the user's decision).
- Whether a lightweight hover/focus tooltip on a marker is added beyond the accessible list (must stop short of OVERLAY-07's deferred full detail panel).

## Deferred Ideas

- Click/focus a marker for a full non-hover detail panel (OVERLAY-07) — already tracked as v2 in REQUIREMENTS.md.
- A combined multi-metric chart merging BP and pulse onto one shared timeline — explicitly considered and rejected in favor of keeping the two charts separate (see Overlay chart architecture, Question 1).
- Cross-dataset statistical correlation — already out of scope per REQUIREMENTS.md.
