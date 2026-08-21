# Phase 9: Multi-Dataset Overlay & Filtering - Research

**Researched:** 2026-08-21
**Domain:** React/Recharts chart overlays + FastAPI/Pydantic closed-union agent schema extension
**Confidence:** HIGH

## Summary

Phase 9 adds one new capability to an already-established dashboard: a global, independent
multi-select toggle (labs / incidents / procedures) that plots event markers onto whichever of
the two timeline hero charts (BP Timeline, Pulse Trend) is currently active, reachable by both
click and voice. Every locked design decision (D-01 through D-08) in `09-CONTEXT.md` has a
direct, mechanical implementation path through code that already exists in this repository —
this is an extension of five proven patterns, not new architecture:

1. **Backend agent schema** — add a sixth closed-union member (`ToggleDataset`) to
   `AgentOutput.result`, following the exact `Literal`-token, no-nested-content-prop discipline
   already used by the other five variants in `backend/app/agent/schemas.py`.
2. **Frontend store** — add one new independent field + one new setter action to
   `frontend/src/store/filters.ts`, mirroring its existing single-select fields but shaped as a
   3-key boolean record instead.
3. **Data fetching** — three new TanStack Query read hooks mirroring `useReadings.ts`, gated by
   `enabled` on their own toggle so nothing fetches until first requested.
4. **Chart rendering** — Recharts `ReferenceLine` per event (D-06, locked), reusing the exact
   z-order and numeric-time-axis discipline `BPTimeline.tsx`/`PulseTrend.tsx` already establish
   for `ReferenceArea`/`ReferenceLine`.
5. **Accessibility** — a plain HTML table (OVERLAY-06), templated directly on
   `ReadingsTable.tsx`'s existing accessible-table pattern.

The single highest-value finding from this research is a **grounded pitfall, not a locked
decision**: `LabResult.date`/`Procedure.date` are date-only columns (no time component), while
`Incident.datetime_` has one. The codebase already solved this exact problem for date-only
strings via `lib/dates.ts`'s `parseDateOnly()` (avoids the `new Date("YYYY-MM-DD")` UTC-midnight
off-by-one bug) — overlay marker positioning MUST route lab/procedure dates through
`parseDateOnly()`, never bare `new Date()`, or markers will land on the wrong day in
negative-UTC-offset timezones. This is spelled out in detail under Common Pitfalls.

A second load-bearing finding: `frontend/src/lib/agent-parity.test.ts` **structurally** enumerates
every function-typed key on the `useFilters` store and fails if a new store action isn't also
added to its `CASES` array — the plan MUST include a task to extend this test, not just add the
new store action. See Common Pitfalls.

**Primary recommendation:** One unified `setOverlayDataset(dataset, on)` store action (not three
separate per-type setters) — this maps 1:1 to the locked D-03/D-04 voice-command shape (one
dataset token + explicit on/off per command) and keeps the `agent-parity.test.ts` structural-gate
diff to a single new action, not three.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Overlay chart architecture**
- **D-01:** The multi-select overlay toggle set is the 3 event types only — labs, incidents,
  procedures. REQUIREMENTS.md's OVERLAY-03 wording ("BP, pulse, labs, incidents, procedures") is
  reinterpreted: BP Timeline and Pulse Trend stay exactly as they are today, two separate hero
  charts switched via the existing `activeChart` picker — no new combined-metric chart, no
  dual-axis merge. Event-type markers plot onto whichever of those two charts is currently the
  hero.
- **Locked directly from OVERLAY-03 text (not re-discussed):** overlay toggle state is
  independent of which chart is active — it's a global multi-select, not scoped per-chart.
  Switching from BP Timeline to Pulse Trend does not reset or hide which overlay layers are on.
- **D-02:** Overlay markers render on the hero chart only, never on `ChartDeck`'s small preview
  cards (those stay decorative/`pointer-events-none`, no tooltip, per their existing Pitfall-8
  contract).

**Voice toggle grammar**
- **D-03:** One dataset per voice command (incremental), not a combined multi-dataset utterance.
  "Add incidents", "show labs", "turn off procedures" — each command toggles exactly one dataset.
  The new action's dataset field is single-valued (a `Literal` token) — no list-typed field.
- **D-04:** Each command sets an explicit ON/OFF state, never a flip/toggle. "Show incidents" /
  "add incidents" always turns it ON; "hide incidents" / "remove incidents" always turns it OFF.

**Overlay marker look & feel**
- **D-05:** The 3 marker types are visually distinguishable by shape AND color, not color alone.
- **D-06:** Each event renders as a full-height vertical `ReferenceLine` (NOT a `Scatter` series),
  with a small icon+label at the top. Full detail/accessibility comes from the separate accessible
  list/table (OVERLAY-06), not from `accessibilityLayer` keyboard navigation of a Scatter series.

**Default state & reset behavior**
- **D-07:** No overlay layers are on at first load — matches every other filter's neutral-default
  convention.
- **D-08:** The existing "show all data"/reset voice command and button also clears overlay
  toggles (all 3 off).

### Claude's Discretion

- Exact visual treatment of the "doesn't apply here" indication on BP Categories and AM/PM charts
  (OVERLAY-05 requires *some* visible indication, not silent no-op).
- Exact icon/glyph choice per event type (e.g. a flask for labs, an alert/hospital icon for
  incidents, a clipboard icon for procedures) — visual polish within D-05's shape+color contract.
- Whether the new overlay toggle row lives inside `FilterBar` itself or as an adjacent control
  group.
- Data-fetching shape for overlay data — separate `useLabs`/`useIncidents`/`useProcedures` hooks
  vs. one combined hook.
- Whether toggling a layer on triggers an immediate fetch vs. relying on a prefetch.
- Whether a lightweight hover/focus tooltip on a marker is added on top of the accessible list.

### Deferred Ideas (OUT OF SCOPE)

- Click/focus a marker to see full incident/lab/procedure detail in a non-hover panel (OVERLAY-07)
  — deferred to v2, tracked in REQUIREMENTS.md.
- A combined multi-metric chart merging BP and pulse onto one shared timeline — explicitly
  rejected (D-01).
- Cross-dataset statistical correlation (e.g. auto-detecting "BP spikes near incidents") — out of
  scope per REQUIREMENTS.md/PROJECT.md.
- Edit/delete on labs/incidents/procedures records — Phase 7/8 boundary, unchanged.

</br>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVERLAY-03 | Multi-select toggle controls let Chris and caregivers show any combination of BP, pulse, labs, incidents/hospital stays, and procedures at once, by voice or click — independent of which single chart is active | D-01 reinterprets the toggle SET to the 3 event types (BP/pulse stay the existing `activeChart` picker). Store shape (`overlayDatasets` + `setOverlayDataset`), FilterBar multi-select group pattern, and the new `toggle_dataset` agent action (Architecture Patterns §1–2, Code Examples) directly implement this. |
| OVERLAY-04 | Selected dataset types overlay together on the BP Timeline and Pulse Trend charts rather than living in separate silos; toggle state uses non-color-only encoding (word/icon + `aria-pressed`) | `ReferenceLine`-per-event pattern (Architecture Patterns §4, Code Examples), shape+color icon glyphs (verified lucide-react icons), and the existing `aria-pressed`/word-label FilterBar contract (already proven, reused verbatim). |
| OVERLAY-05 | Overlay controls on the two non-timeline charts (BP Categories, AM/PM) visibly indicate they don't apply there, rather than silently doing nothing | Architecture Patterns §5 — the toggle row reads `activeChart` directly and renders a dimmed/annotated-but-still-interactive state; Common Pitfalls flags why the controls must NOT be `disabled` (D-01's "independent of active chart" requires them to stay settable). |
| OVERLAY-06 | An accessible list/table equivalent of every overlaid event exists so keyboard and screen-reader users get full access to overlay data regardless of chart-marker accessibility limits | `ReadingsTable.tsx` is a direct, verified template (Architecture Patterns §6, Code Examples) — same big-button paging, plain-text-node, no-precision-input contract. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Overlay toggle UI (click) | Frontend Server (SPA component) | — | `FilterBar`-style `role="group"`/`aria-pressed` buttons; pure client component, no SSR in this Vite SPA. |
| Overlay toggle state | Browser / Client (zustand store) | — | UI-only state per CLAUDE.md's separation rule — `store/filters.ts`, not server data. |
| Overlay toggle voice command | API / Backend (agent schema + interpreter) | Browser / Client (store mutation) | Claude's structured output is the classification authority (API-04); the frontend only applies the server-composed `AppliedFilters` delta — never reinterprets model text. |
| Labs/incidents/procedures data | API / Backend (existing `/labs` `/incidents` `/procedures` GET, Phase 7) | Database / Storage (SQLite/Postgres via SQLAlchemy) | Already shipped, Bearer-gated, date-range filterable (`LabFilters`/`IncidentFilters`/`ProcedureFilters`). This phase only adds frontend read hooks — no backend changes to these routes. |
| Overlay marker rendering | Browser / Client (Recharts `ReferenceLine`) | — | Pure presentation; markers are derived from already-fetched TanStack Query data, no new fetch semantics. |
| Overlay accessible list/table | Browser / Client (React component) | — | Same tier as `ReadingsTable.tsx`; no server round-trip beyond the existing GET hooks. |
| "Doesn't apply here" indicator | Browser / Client (component reads `activeChart`) | — | Pure derived UI state — no new server concept. |

## Standard Stack

No new libraries are required. Every capability in this phase is built from dependencies already
locked in `CLAUDE.md` and installed in the repo.

### Core (already installed — reused, not added)
| Library | Version (installed) | Purpose in this phase | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.9.2 `[VERIFIED: package.json]` | `ReferenceLine` markers on BPTimeline/PulseTrend hero charts (D-06) | Already the project's fixed charting library; `ReferenceLine` is a first-class primitive, already used for the 60bpm bradycardia line in `PulseTrend.tsx`. |
| zustand | 5.0.14 `[VERIFIED: package.json]` | New `overlayDatasets` field + `setOverlayDataset` action on the existing `useFilters` store | Matches CONTEXT.md's explicit Integration Point: the new field lives in `store/filters.ts`, not a new store. |
| @tanstack/react-query | 5.101.2 `[VERIFIED: package.json]` | New `useLabs`/`useIncidents`/`useProcedures` read hooks | Direct extension of `useReadings.ts`'s established `useQuery`/`queryKey`/`staleTime` convention. |
| lucide-react | 1.24.0 `[VERIFIED: package.json + node_modules listing]` | Marker/toggle icons: `FlaskConical` (labs), `AlertTriangle` (incidents), `ClipboardList` (procedures) | Already the project's icon library (used in `CommandBar.tsx`'s `Mic`/`MicOff`, `AddRecordPage.tsx`, etc.). All three icon names confirmed present in `node_modules/lucide-react/dist/esm/icons/` at the installed version — `flask-conical.mjs`, `alert-triangle.mjs`, `clipboard-list.mjs`. |
| pydantic | 2.13.x `[VERIFIED: CLAUDE.md/pyproject]` | New `ToggleDataset` closed-union member on `AgentOutput.result` in `backend/app/agent/schemas.py` | Same structured-outputs-safe discipline (`Literal` tokens, no numeric bounds) already governing the other five variants. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One `setOverlayDataset(dataset, on)` store action | Three separate `setLabsOverlay`/`setIncidentsOverlay`/`setProceduresOverlay` actions | Three actions map less cleanly to D-03's single-dataset-per-command grammar and each would need its own entry in `agent-parity.test.ts`'s structural `STORE_ACTIONS` gate — strictly more surface area for zero benefit. Not recommended. |
| Recharts `ReferenceLine` markers (locked, D-06) | Recharts `Scatter` series bound into `accessibilityLayer` | Already considered and explicitly rejected in `09-CONTEXT.md` (D-06) — documented here only for completeness, not re-open. |
| `Literal["on","off"]` token on the new agent action | Plain `bool` field (`on: bool`) | Both are proven-safe with this codebase's structured-outputs setup — `DashboardCommand.reset: bool = False` already round-trips correctly (see `test_agent_schemas.py`). `Literal` is recommended for consistency with every other classification field in the schema (`chart`, `bp_category`, `am_pm` are all string tokens) and reads more naturally in the system prompt's closed-vocabulary style, but `bool` is a legitimate simpler alternative — this is NOT locked by CONTEXT.md, planner's call. |

**Installation:** None — no new packages. See Package Legitimacy Audit below.

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** Every library referenced above is
already present in `frontend/package.json` / the backend's locked `pyproject.toml` dependency set
per `CLAUDE.md`. The Package Legitimacy Gate protocol (slopcheck + registry verification) is
therefore not applicable — there is nothing new to install or audit.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | N/A — no new installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
CLICK PATH                                   VOICE/TEXT PATH
───────────                                   ───────────────
FilterBar-style toggle row                    CommandBar (text) / voice transcript
  (role="group", aria-pressed buttons)                │
        │ onClick(dataset)                            ▼
        ▼                                     POST /agent { text }
useFilters.setOverlayDataset(dataset, on)              │
        │                                              ▼
        │                                     backend/app/routers/agent.py
        │                                              │
        │                                              ▼
        │                                     app/agent/service.py interpret()
        │                                       → call_claude() (messages.parse,
        │                                         output_format=AgentOutput)
        │                                              │
        │                                     result: ToggleDataset(dataset, state)
        │                                              │
        │                                              ▼
        │                                     AppliedFilters(overlayDataset=…,
        │                                                    overlayState=…)
        │                                              │
        │                                              ▼
        │                                     frontend lib/agent.ts
        │                                       applyAgentFilters(filters)
        │                                              │
        └──────────────────────┬───────────────────────┘
                                ▼
                useFilters store: overlayDatasets: { labs, incidents, procedures }
                                │
                                ▼
          useLabs(resolved) / useIncidents(resolved) / useProcedures(resolved)
             (TanStack Query, enabled: overlayDatasets.<type>)
                                │
                                ▼
              GET /labs|/incidents|/procedures?start_date=&end_date=
                 (existing Phase-7 routes, date-range filter only)
                                │
                                ▼
        ChartDeck hero slot (BPTimeline.tsx / PulseTrend.tsx)
          → <ReferenceLine> per event, icon+label, shape+color (D-06)
                                │
                                ▼
        Accessible events list/table (OVERLAY-06) — same data, plain <table>,
          always rendered regardless of which chart is active
```

### Recommended Project Structure (files touched/added, not a new tree)
```
backend/app/agent/
├── schemas.py        # + DatasetToken, ToggleDataset, AppliedFilters.overlayDataset/overlayState
├── prompt.py          # + toggle_dataset routing rules in SYSTEM_PROMPT
└── service.py          # + _apply_toggle_dataset() branch in interpret()

frontend/src/
├── store/filters.ts                    # + overlayDatasets field, setOverlayDataset action
├── lib/agent.ts                        # + overlay branch in applyAgentFilters, new PulseField
├── api/types.ts                        # + AppliedFilters.overlayDataset/overlayState mirror
├── api/client.ts                       # + getLabs/getIncidents/getProcedures
├── hooks/
│   ├── useLabs.ts        (new)         # mirrors useReadings.ts
│   ├── useIncidents.ts   (new)
│   └── useProcedures.ts  (new)
├── components/
│   ├── OverlayToggle.tsx (new, or folded into FilterBar.tsx — planner's call)
│   ├── OverlayEventsList.tsx (new)     # OVERLAY-06 accessible table
│   ├── charts/BPTimeline.tsx           # + overlayEvents prop, ReferenceLine block
│   ├── charts/PulseTrend.tsx           # + overlayEvents prop, ReferenceLine block
│   ├── charts/CategoryBars.tsx         # OVERLAY-05 "doesn't apply" read-only note (if placed per-chart)
│   └── charts/AmPmComparison.tsx       # OVERLAY-05 "doesn't apply" read-only note (if placed per-chart)
└── lib/overlayIcons.ts (new, optional) # shared icon+color map (mirrors lib/palette.ts's role)
```

### Pattern 1: Backend closed-union action addition (schemas.py)

**What:** Add a sixth `AgentOutput.result` member following the exact existing discipline —
lowercase snake_case `Literal` tag, no numeric bounds, single-valued fields only.

**When to use:** Any time the agent vocabulary grows a new command type (this phase's
`toggle_dataset`).

```python
# Source: backend/app/agent/schemas.py (existing file, pattern extrapolated)
DatasetToken = Literal["labs", "incidents", "procedures"]

class ToggleDataset(BaseModel):
    """Explicit on/off for one overlay dataset (D-03: single dataset, D-04: explicit state)."""

    action: Literal["toggle_dataset"]
    dataset: DatasetToken
    state: Literal["on", "off"]

# Extend the closed union:
class AgentOutput(BaseModel):
    result: (
        DashboardCommand
        | DataQuestion
        | Clarification
        | MedicalRefusal
        | Unintelligible
        | ToggleDataset
    )
    # existing `_lower_tokens` validator needs NO change — it recurses generically
    # over every key in the "result" dict regardless of which union member it is,
    # already lowercasing `dataset`/`state` correctly (verified in schemas.py:137-157).
```

`AppliedFilters` needs the matching two new optional fields (mirrors the existing pattern where
every other field is `X | None = None`):

```python
class AppliedFilters(BaseModel):
    activeChart: ChartToken | None = None
    datePreset: Literal["7d", "30d", "90d", "all"] | None = None
    customRange: CustomRange | None = None
    amPm: Literal["all", "AM", "PM"] | None = None
    bpCategory: Literal[...] | None = None
    overlayDataset: DatasetToken | None = None   # NEW
    overlayState: Literal["on", "off"] | None = None  # NEW
    reset: bool = False
```

**`frontend/src/api/types.ts`'s `AppliedFilters` type MUST mirror this byte-identically** — the
codebase's own comment on this file calls it a "byte-identical mirror" contract; a field added on
one side without the other is a silent drift the existing `agent-parity.test.ts` does NOT catch
for this file (it only diffs `ChartToken`/`bpCategory` literal *values*, not the presence of new
field names — see Common Pitfalls).

### Pattern 2: Service-layer interpretation branch (service.py)

**What:** A new `_apply_toggle_dataset` branch in `interpret()`, following the exact shape of
`_apply_command`.

```python
# Source: backend/app/agent/service.py (existing file, pattern extrapolated)
def _apply_toggle_dataset(cmd: ToggleDataset) -> AgentReply:
    filters = AppliedFilters(overlayDataset=cmd.dataset, overlayState=cmd.state)
    return AgentReply(kind="applied", filters=filters, message="", context=None)

# inside interpret(), alongside the existing isinstance checks:
if isinstance(result, ToggleDataset):
    return _apply_toggle_dataset(result)
```

Note `reset` is untouched by this branch — D-08 ("show all data" clears overlay toggles too) is a
**frontend-only** concern: `AppliedFilters(reset=True)` already flows through unchanged; the
frontend's `showAllData()` store action is what needs to also zero out `overlayDatasets` (see
Pattern 3). No backend change needed for D-08.

### Pattern 3: Frontend store field + single unified setter (store/filters.ts)

```typescript
// Source: frontend/src/store/filters.ts (existing file, pattern extrapolated)
export type OverlayDataset = "labs" | "incidents" | "procedures";

interface FilterState {
  // ...existing fields unchanged...
  overlayDatasets: Record<OverlayDataset, boolean>; // independent multi-select (D-01)
  setOverlayDataset: (dataset: OverlayDataset, on: boolean) => void; // D-03/D-04 shape
  // showAllData() below is MODIFIED, not new — must also zero overlayDatasets (D-08)
}

export const useFilters = create<FilterState>((set) => ({
  // ...existing defaults...
  overlayDatasets: { labs: false, incidents: false, procedures: false }, // D-07
  setOverlayDataset: (dataset, on) =>
    set((s) => ({ overlayDatasets: { ...s.overlayDatasets, [dataset]: on } })),
  showAllData: () =>
    set({
      datePreset: "all",
      customRange: { from: null, to: null },
      amPm: "all",
      bpCategory: "all",
      overlayDatasets: { labs: false, incidents: false, procedures: false }, // D-08
    }),
}));
```

### Pattern 4: Overlay markers on the hero charts (ReferenceLine, D-06)

**What:** One `ReferenceLine` per overlaid event, positioned by the same numeric-time x-axis the
`Line` series already use, with a small shape+color icon glyph as the label.

**Critical prerequisite — extend the chart's x-domain to cover overlay events, not just
readings.** `BPTimeline`/`PulseTrend` currently set `domain={["dataMin", "dataMax"]}` computed
ONLY from `toTimePoints(readings)`. An overlay event whose date falls outside the readings'
actual min/max (e.g. an incident on a day with no BP reading, near the edge of the filtered
window) will be silently `discard`ed by `ReferenceLine`'s default `ifOverflow="discard"` — see
Common Pitfalls for the full explanation. The domain calculation must be widened to include
overlay event timestamps whenever any overlay layer is on.

```tsx
// Source: pattern extrapolated from frontend/src/components/charts/PulseTrend.tsx's
// existing ReferenceLine usage (bradycardia line) + BPTimeline.tsx's z-order discipline
import { FlaskConical, AlertTriangle, ClipboardList } from "lucide-react";

type OverlayEvent = {
  id: number;
  ts: number;           // epoch ms — labs/procedures via parseDateOnly(date), incidents via new Date(datetime)
  type: "labs" | "incidents" | "procedures";
  label: string;         // e.g. test_name / incident_type / procedure_name
};

const OVERLAY_META = {
  labs:       { Icon: FlaskConical,  color: "var(--overlay-labs)" },
  incidents:  { Icon: AlertTriangle, color: "var(--overlay-incidents)" },
  procedures: { Icon: ClipboardList, color: "var(--overlay-procedures)" },
} as const;

// Inside the LineChart, AFTER the Line series (so markers sit on top — JSX z-order,
// same Pitfall 7 discipline already documented in BPTimeline.tsx's own comments):
{overlayEvents.map((evt) => {
  const { color } = OVERLAY_META[evt.type];
  return (
    <ReferenceLine
      key={`${evt.type}-${evt.id}`}
      x={evt.ts}
      stroke={color}
      strokeWidth={2}
      ifOverflow="extendDomain"
      // Use the plain label-OBJECT form (value/position/fontSize/fill), NOT a nested
      // <Label content={...}> — see Common Pitfalls re: recharts#2405.
      label={{
        value: SHORT_GLYPH[evt.type],  // e.g. a single distinguishing character/short token
        position: "top",
        fontSize: 14,
        fill: color,
      }}
    />
  );
})}
```

### Pattern 5: "Doesn't apply here" indicator (OVERLAY-05)

**What:** The overlay toggle row reads `activeChart` and switches to a visibly-dimmed style with
explanatory text when the active chart is `bp_categories` or `am_pm_comparison` — **without**
disabling the buttons (they must stay clickable so overlay state can be set ahead of switching
back to a timeline chart, per D-01's "independent of active chart" lock).

```tsx
// Source: pattern extrapolated from frontend/src/components/FilterBar.tsx's existing
// role="group"/aria-pressed contract
const activeChart = useFilters((s) => s.activeChart);
const overlayApplies = activeChart === "bp_timeline" || activeChart === "pulse_trend";

<div role="group" aria-label="Overlay data" className={overlayApplies ? "" : "opacity-60"}>
  {!overlayApplies && (
    <p aria-live="polite" className="text-[18px]">
      Not shown on this chart — switch to Blood Pressure or Pulse to see overlays
    </p>
  )}
  {/* buttons remain interactive regardless of overlayApplies */}
</div>
```

### Pattern 6: Accessible events list/table (OVERLAY-06)

**What:** A plain HTML `<table>` of every currently-overlaid event (across all ON datasets),
independent of which chart is active — directly templated on `ReadingsTable.tsx`'s existing
big-button-paging, no-precision-input, plain-text-node contract (same `caption className="sr-only"`,
`scope="col"` headers, `Show 20 more` pagination pattern).

### Anti-Patterns to Avoid

- **Disabling the overlay toggle buttons on BP Categories/AM/PM** — contradicts D-01's
  "independent of active chart" lock (see Pattern 5).
- **Nested `<Label content={...} />` on `ReferenceLine`** — known-broken in Recharts (see Common
  Pitfalls); use the plain object `label={{ value, position, fontSize, fill }}` form the codebase
  already proves works twice (`BPTimeline.tsx` band labels, `PulseTrend.tsx` bradycardia line).
- **Passing the full `ResolvedFilters` object (including `am_pm`/`bp_category`) into the new
  `useLabs`/`useIncidents`/`useProcedures` `queryKey`** — the backend's `LabFilters`/
  `IncidentFilters`/`ProcedureFilters` only accept `start_date`/`end_date` (Phase 7 D-04); keying
  on the full object causes needless refetches/cache fragmentation on AM/PM or category filter
  changes that have zero effect on this data. Key on `{ start_date, end_date }` only.
- **Bare `new Date(lab.date)` / `new Date(procedure.date)`** — date-only strings parse as UTC
  midnight, not local midnight (see Common Pitfalls). Always `parseDateOnly(...)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon glyphs for the 3 dataset types | Custom inline SVG paths | `lucide-react`'s `FlaskConical`/`AlertTriangle`/`ClipboardList` | Already the project's icon library; all three icons verified present at the installed version; consistent stroke-width/sizing with every other icon on the site. |
| Date-only string → epoch ms | A new ad-hoc `new Date(dateOnlyString)` call | `lib/dates.ts`'s existing `parseDateOnly()` | The exact bug this function was written to prevent (UTC-midnight off-by-one) — re-deriving it inline reintroduces the bug the codebase already fixed once (documented in `lib/agent.ts`'s own "Pitfall 7" comment). |
| Multi-select toggle button semantics | A new component paradigm | The existing `role="group"` + `aria-pressed` pattern (`FilterBar.tsx`) | Multi-select is just N independently-toggleable `aria-pressed` buttons instead of mutually-exclusive ones — no new accessibility pattern needed, the existing one generalizes directly. |
| Agent → store filter delta application | A parallel apply path for `overlayDataset`/`overlayState` | Extending the existing single `applyAgentFilters()` function in `lib/agent.ts` | That function is the SINGLE mutation surface by design (the whole point of `agent-parity.test.ts`'s structural gate) — a second path would be invisible to that test and to the "agent and manual controls read as one system" pulse mechanism. |

**Key insight:** Every piece of this phase is additive to five files that already encode the
exact pattern needed — the risk in this phase is drift from those patterns (a new bespoke toggle
component, a second date-parsing helper, a parallel filter-apply path), not missing library
capability.

## Common Pitfalls

### Pitfall 1: Date-only fields parse as UTC midnight, not local midnight

**What goes wrong:** `LabResult.date` and `Procedure.date` are `Date` (not `DateTime`) columns —
`"2025-06-03"` with no time component. `new Date("2025-06-03")` in every JS engine parses
date-only ISO strings as **UTC midnight**, which is the PREVIOUS calendar day in any
negative-UTC-offset timezone (all of the Americas). `Incident.datetime_` does NOT have this
problem — it's a full `DateTime` column and the existing DATA-05 naive-local convention already
handles it correctly via plain `new Date(iso)`.

**Why it happens:** ECMAScript's `Date` constructor treats date-only strings as UTC per spec,
but datetime strings (with a time component) as local time — a well-known, frequently-relearned
JS footgun.

**How to avoid:** Route every `LabResult.date`/`Procedure.date` value through the codebase's
existing `parseDateOnly()` (`lib/dates.ts`) before computing a `ts` for `ReferenceLine`'s `x`
prop — exactly the same fix already applied to date-preset anchoring and `composeConfirmation`'s
custom-range formatting (see `lib/agent.ts`'s `fmtLongDateOnly` comment referencing "Pitfall 7").
`Incident.datetime_` uses the plain `new Date(iso)` path instead, matching `toTimePoints()`.

**Warning signs:** Overlay markers for labs/procedures appear one calendar day earlier than
expected for users west of UTC (i.e., everywhere the target user is likely located).

**Confidence:** HIGH `[VERIFIED: backend/app/models.py — LabResult.date/Procedure.date are
mapped_column(Date, ...), Incident.datetime_ is mapped_column("datetime", DateTime, ...);
frontend/src/lib/dates.ts — parseDateOnly() exists specifically for this class of bug]`

### Pitfall 2: `ReferenceLine`'s default `ifOverflow="discard"` silently drops edge-of-range markers

**What goes wrong:** `BPTimeline`/`PulseTrend`'s x-axis domain is `["dataMin", "dataMax"]`
computed from the READINGS array only (`toTimePoints(readings)`), not from overlay event dates.
An overlay event (e.g. an incident) whose timestamp falls even slightly outside the actual
min/max of the currently-filtered readings — which is common near the edges of a date-range
filter, since reading timestamps and event timestamps are independent — gets silently
`discard`ed (the default `ifOverflow` value) with no visual trace and no console warning.

**Why it happens:** Recharts computes `ReferenceLine` position against the chart's resolved axis
domain; a value outside that domain is treated as "off-canvas" per the `ifOverflow` prop's
documented default.

**How to avoid:** Either (a) widen the chart's x-axis domain calculation to include overlay event
timestamps whenever any overlay layer is on (compute `Math.min`/`Math.max` across BOTH
`toTimePoints(readings)` and the active overlay events' `ts` values), or (b) set
`ifOverflow="extendDomain"` on each `ReferenceLine` (lets Recharts handle the domain extension
per-line) and verify no double-extension conflict with the chart's own fixed `domain` prop — note
`YAxis`'s domain is fixed/clinical (`[40,220]`/`[30,120]`, D-05 pattern) but `XAxis`'s domain is
already dynamic (`["dataMin","dataMax"]`), so extending it is consistent with existing intent, not
a new pattern.

**Warning signs:** An overlay toggled ON with events known to exist in the DB shows nothing on
the chart, but the accessible list/table (OVERLAY-06) correctly shows the events — a working
data-fetch path with an invisible-marker symptom is the signature of this exact bug.

**Confidence:** MEDIUM `[CITED: recharts.github.io/en-US/api/ReferenceLine — ifOverflow default
"discard"]` — the interaction with THIS codebase's specific dynamic-domain setup is inferred, not
directly tested; flag for a Wave-0 manual verification once implemented.

### Pitfall 3: `<Label content={...}>` nested inside `ReferenceLine` is a known-broken pattern in Recharts

**What goes wrong:** Passing a custom `content` render function/component via a nested
`<Label content={...} />` element as `ReferenceLine`'s `label` prop has an open, long-standing
GitHub issue (recharts/recharts#2405) where the content prop fails to render correctly — objects
get stringified instead of passed through as props.

**Why it happens:** `ReferenceLine`'s internal `Label` wiring does not consistently forward
`content` the way `LabelList`'s `content` prop does (which the codebase already uses successfully
in `BPTimeline.tsx`'s `makeEndLabel` / `CategoryBars.tsx`'s `barLabel` — those are `LabelList`
inside a `<Line>`/`<Bar>`, a DIFFERENT mechanism than `ReferenceLine`'s own `label` prop).

**How to avoid:** Use the plain **object** form of `label` (`{ value, position, fontSize, fill }`)
— exactly what `PulseTrend.tsx`'s existing bradycardia `ReferenceLine` and `BPTimeline.tsx`'s
`bandLabel()` (on `ReferenceArea`, same `Label` machinery) already do successfully today. If a
true icon (not just a styled text glyph) is required for D-05's shape+color distinction, render
the icon as a short, distinguishing Unicode character or abbreviation string via the `value`
field rather than attempting a nested custom SVG icon component — this sidesteps the known bug
entirely while still satisfying "shape AND color, not color alone."

**Warning signs:** The `ReferenceLine` renders (visible colored vertical line) but its label is
blank, or the console shows a DOM warning about an unrecognized `content`/`viewBox` attribute on a
`<p>` or similar element.

**Confidence:** MEDIUM `[CITED: github.com/recharts/recharts/issues/2405]` — the issue's exact
resolution status in Recharts 3.9.x (this project's pinned version) could not be confirmed from
available sources; the RECOMMENDED mitigation (use the object form, already proven twice in this
codebase) sidesteps the question entirely regardless of whether the bug is still present.

### Pitfall 4: `agent-parity.test.ts` structurally fails on any new store action without a matching test case

**What goes wrong:** `frontend/src/lib/agent-parity.test.ts` introspects `useFilters.getState()`
at test time, collects every key whose value is a function, and asserts that set equals a
hardcoded `STORE_ACTIONS` array. Adding `setOverlayDataset` to the store WITHOUT adding a
corresponding case to that test's `CASES` array and `STORE_ACTIONS` list fails the existing test
suite immediately and unconditionally — this is not optional cleanup, it is a build-breaking
omission.

**Why it happens:** The test is intentionally structural (not just enumerating known actions) —
its whole purpose (per its own docstring) is to make "adding a store action with no
`AppliedFilters` field" a hard test failure, guaranteeing every filter action stays voice-reachable
(ACC-03).

**How to avoid:** The plan MUST include an explicit task to extend `agent-parity.test.ts`:
add `"setOverlayDataset"` to `STORE_ACTIONS`, add a `CASES` entry exercising
`applyAgentFilters({ overlayDataset: "labs", overlayState: "on" })` → assert
`useFilters.getState().overlayDatasets.labs === true`, and reset `overlayDatasets` in the
`beforeEach` initial-state object at the top of the file.

**Warning signs:** N/A — this fails loudly and immediately (`npm test`), which is the intended
behavior; the risk is not noticing it during planning and treating the store change as complete
without the test update.

**Confidence:** HIGH `[VERIFIED: frontend/src/lib/agent-parity.test.ts, lines 165-176 — read
directly]`

### Pitfall 5: `AppliedFilters` byte-identical-mirror drift between backend and frontend is NOT caught by the existing parity test for new fields

**What goes wrong:** `agent-parity.test.ts`'s backend↔frontend token check
(`schemaText.match(/bpCategory: Literal\[([^\]]*)\]/)` etc.) only diffs the *literal values* of
two specific already-existing fields (`ChartToken`, `bpCategory`). It does NOT enumerate
`AppliedFilters`'s field NAMES, so adding `overlayDataset`/`overlayState` to the backend Pydantic
model without adding the matching fields to the frontend `AppliedFilters` TypeScript type will
compile/run without any automated test catching the omission — the drift is silent until a real
voice/agent overlay command is issued and nothing happens.

**Why it happens:** The existing parity test was written for the fields that existed at the time;
it is not a general schema-diff tool.

**How to avoid:** Manually keep `backend/app/agent/schemas.py`'s `AppliedFilters` and
`frontend/src/api/types.ts`'s `AppliedFilters` in lockstep for the two new fields (both already
documented in Pattern 1 above). Optionally, the plan could extend `agent-parity.test.ts` with a
generic field-name-set comparison for `AppliedFilters` as a follow-on improvement (not required by
CONTEXT.md, but consistent with the file's own stated purpose).

**Confidence:** HIGH `[VERIFIED: frontend/src/lib/agent-parity.test.ts read in full — no
AppliedFilters field-name assertions exist]`

## Code Examples

### Overlay read hook (mirrors `useReadings.ts` exactly, narrowed query key)

```typescript
// Source: pattern extrapolated from frontend/src/hooks/useReadings.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLabs } from "../api/client";

type DateWindow = { start_date?: string; end_date?: string };

export function useLabs(window: DateWindow, enabled: boolean) {
  return useQuery({
    queryKey: ["labs", window],       // NOT the full ResolvedFilters — see Anti-Patterns
    queryFn: () => getLabs(window),
    enabled,                          // lazy — first toggle-on triggers the fetch
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
```

### Cache invalidation on new record creation (addresses the flagged staleTime discretion item)

`useCreateRecord.ts`'s mutations currently have no `onSuccess` cache interaction at all (bare
`useMutation({ mutationFn: postLab })`). Since Phase 8's forms are a new mutation source for data
this phase's overlay hooks read, the call site (`AddRecordPage.tsx`) — or the hooks themselves —
should invalidate the matching query key on success so a caregiver's newly-added lab/incident/
procedure appears in the overlay without waiting out the 5-minute `staleTime`:

```typescript
// Source: pattern extrapolated from TanStack Query v5 conventions +
// frontend/src/hooks/useCreateRecord.ts's existing mutation shape
import { useQueryClient } from "@tanstack/react-query";

export function useCreateLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postLab,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labs"] }),
  });
}
```

### Backend agent schema + prompt routing addition

See Architecture Patterns §1–2 above for the full `ToggleDataset`/`_apply_toggle_dataset` code.
`prompt.py`'s `SYSTEM_PROMPT` needs a new routing-rules paragraph teaching the vocabulary, e.g.:

```
Overlay data toggles (use these exact dataset tokens): labs, incidents, procedures.
- "show/add/turn on <dataset>" -> toggle_dataset with state = on
- "hide/remove/turn off <dataset>" -> toggle_dataset with state = off
- "incidents" also covers "hospital stays", "hospitalizations"
```

## State of the Art

Not applicable in the traditional sense — this phase extends an internal, already-current stack
(Recharts 3.9, structured-outputs-GA Claude Haiku, TanStack Query v5) rather than adopting a new
one. No deprecated/legacy approach is being replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recharts 3.9.x still exhibits the `<Label content={...}>`-on-`ReferenceLine` bug described in recharts#2405 (issue status/resolution version could not be confirmed from available sources) | Common Pitfalls #3 | Low — the RECOMMENDED mitigation (plain object `label` form) is safe and proven in this codebase regardless of whether the bug is fixed; worst case the team avoids a working feature unnecessarily, not a functional break. |
| A2 | `ReferenceLine`'s `ifOverflow="extendDomain"` correctly composes with this codebase's existing dynamic `domain={["dataMin","dataMax"]}` XAxis setup without visual side effects (e.g. axis jumping when an overlay is toggled) | Common Pitfalls #2, Architecture Patterns §4 | Medium — if extendDomain behaves unexpectedly, the fallback (computing the domain manually from readings ∪ overlay events) is a safe, fully-controllable alternative already sketched in the pitfall; flag for a quick manual spike early in implementation. |
| A3 | A `Literal["on","off"]` field is marginally preferable to a `bool` field for the new `ToggleDataset.state` — both are proven-safe with this codebase's structured-outputs pipeline (the existing `reset: bool` field already round-trips) | Standard Stack (Alternatives), Architecture Patterns §1 | Low — this is presented as a recommendation, not a locked requirement; either choice works, planner can pick either without re-research. |
| A4 | The exact props a custom `content` function receives when passed directly as `ReferenceLine`'s `label` (a function, not nested `<Label content>`) — e.g. whether it receives `viewBox` — could not be confirmed from official docs | Architecture Patterns §4 | Low — mitigated by recommending the already-proven plain-object `label` form instead of a custom content function, sidestepping the need to know this shape at all. |

## Open Questions

1. **Will the live Claude model correctly route the new `toggle_dataset` vocabulary?**
   - What we know: The schema/prompt/service-layer wiring can be fully unit-tested with a mocked
     Anthropic client (the existing `test_agent_service.py`/`test_agent_schemas.py` pattern —
     monkeypatched `_get_client`, no network call).
   - What's unclear: The Anthropic account behind this project's Railway deployment has $0
     credits (per `.planning/STATE.md`'s Blockers — "Agent inert in production"), so no live
     model behavioral evaluation is possible this session, matching the same constraint that
     already deferred Phase 3's live-model eval to v2.
   - Recommendation: Plan for schema/unit-test coverage only (mirroring existing test files'
     conventions); do not schedule a live-model accuracy checkpoint for this phase — it would be
     blocked identically to the existing, already-accepted v1.0→v2 deferral.

2. **Exact icon glyph rendering mechanism for `ReferenceLine` labels (styled Unicode character vs.
   attempting a workaround for the nested-content bug)**
   - What we know: `lucide-react` icons are verified present and are the project's icon standard,
     but a true SVG icon component cannot be reliably nested inside `ReferenceLine`'s `label` per
     Pitfall 3.
   - What's unclear: Whether a short styled text glyph (rendered via the proven object-label form)
     will satisfy D-05's "shape AND color, not color alone" bar as convincingly as a true icon, or
     whether the planner should schedule a small implementation spike to test whether a function
     passed directly as `label={(props) => ...}` (not nested via `<Label content>`) DOES
     successfully render an SVG icon in this Recharts version — this is a different code path from
     the documented bug and was not conclusively ruled in or out by available sources.
   - Recommendation: Plan a very small (sub-1-hour) implementation spike as an early task: try
     `label` as a direct function returning an inline `<svg>`/lucide icon; if it renders correctly,
     use it; if not, fall back to the proven styled-text-glyph object form. Either path satisfies
     D-05.

## Environment Availability

No new external tool/service/runtime dependencies are introduced by this phase — it extends
already-running frontend (Vite/React) and backend (FastAPI/SQLAlchemy) code against already-shipped
API routes. The one existing environment constraint relevant to this phase (the $0-credit
Anthropic account making live-model testing unavailable) is documented under Open Questions #1
rather than here, since it is a pre-existing, already-tracked project blocker (`.planning/STATE.md`
Blockers/Concerns), not a new dependency this phase introduces.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 9.x `[VERIFIED: CLAUDE.md]`, `backend/tests/` (existing `test_agent_schemas.py`, `test_agent_service.py`, `test_agent_route.py`, `test_api_labs.py`/`test_api_incidents.py`/`test_api_procedures.py` are the direct templates) |
| Frontend framework | Vitest 4.x `[VERIFIED: package.json ^4.1.10]` + @testing-library/react 16.3.2, `frontend/src/**/*.test.ts(x)` colocated with source |
| Config file | `backend/pyproject.toml` (pytest config), Vite's default Vitest config (no separate `vitest.config.ts` found — uses `vite.config.ts` `test` block per Vitest convention) |
| Quick run command | `cd backend && pytest tests/test_agent_schemas.py tests/test_agent_service.py -x` / `cd frontend && npx vitest run src/store/filters.test.ts src/lib/agent-parity.test.ts` |
| Full suite command | `cd backend && pytest` / `cd frontend && npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVERLAY-03 | `ToggleDataset` parses/round-trips through `AgentOutput`, case-drift normalizes | unit | `pytest backend/tests/test_agent_schemas.py -x` | ✅ (extend existing file) |
| OVERLAY-03 | `setOverlayDataset` mutates `overlayDatasets`; reachable via `applyAgentFilters` | unit | `npx vitest run src/store/filters.test.ts src/lib/agent-parity.test.ts` | ✅ (extend existing files — Pitfall 4) |
| OVERLAY-03 | `interpret()` maps `ToggleDataset` → `AppliedFilters(overlayDataset, overlayState)` | unit | `pytest backend/tests/test_agent_service.py -x` | ✅ (extend existing file) |
| OVERLAY-04 | `useLabs`/`useIncidents`/`useProcedures` fetch only when `enabled`, key on date window only | unit | `pytest backend/tests/test_api_labs.py backend/tests/test_api_incidents.py backend/tests/test_api_procedures.py -x` (backend routes unchanged — regression only) | ✅ existing, no new backend test needed |
| OVERLAY-04 | Overlay markers render with distinct shape+color per type (no color-only) | manual/visual | N/A — Recharts renders 0×0 in jsdom (documented existing project constraint, `lib/chartData.ts`'s own docstring) | ❌ Wave 0 note: chart-level marker rendering is manual-verify only, matching this project's established chart-testing boundary |
| OVERLAY-05 | Overlay toggle row shows dimmed/annotated-but-interactive state on BP Categories/AM-PM | component test | `npx vitest run src/components/OverlayToggle.test.tsx` (new) | ❌ Wave 0 gap |
| OVERLAY-06 | Accessible events table renders every overlaid event across all ON datasets | component test | `npx vitest run src/components/OverlayEventsList.test.tsx` (new) | ❌ Wave 0 gap |

### Sampling Rate
- **Per task commit:** the scoped unit test file(s) touched by that task
- **Per wave merge:** `cd backend && pytest` + `cd frontend && npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/OverlayToggle.test.tsx` (or wherever the toggle row lands) —
  covers OVERLAY-03 (click reachability) + OVERLAY-05 (doesn't-apply-here state)
- [ ] `frontend/src/components/OverlayEventsList.test.tsx` — covers OVERLAY-06
- [ ] `frontend/src/lib/agent-parity.test.ts` extension — covers the Pitfall 4 structural gate
  (`setOverlayDataset` added to `STORE_ACTIONS` + `CASES`)
- [ ] Chart marker rendering (`ReferenceLine` shape/color/position correctness) has NO automated
  test path available in this codebase (Recharts renders 0×0 in jsdom — pre-existing, documented
  project constraint) — mark as manual-verify in the plan, consistent with how every other chart
  visual detail in this codebase is already verified (`chartData.ts`'s pure-function tests cover
  data shaping; visual rendering itself is human-checked).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — this phase adds no new auth flow; new GET wrappers call already Bearer-gated Phase 7 routes. |
| V3 Session Management | No | Unchanged — same Bearer token mechanism (`itsdangerous` signed token) already in place. |
| V4 Access Control | No | Unchanged — `/labs`, `/incidents`, `/procedures` are already gated at `include_router` time (per `labs.py`'s own docstring: "Gated at `include_router` time... never a per-route `Depends(verify_token)`"). No new routes are added by this phase. |
| V5 Input Validation | Yes | The new `ToggleDataset.dataset`/`.state` fields are closed `Literal` unions validated by Pydantic at parse time — Claude structurally cannot emit a value outside `{"labs","incidents","procedures"}` / `{"on","off"}` (same constrained-sampling guarantee already documented for the other five `AgentOutput` variants). No free-text field is introduced. |
| V6 Cryptography | No | Unchanged — no new secrets, tokens, or crypto operations. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model-authored string reaching the frontend unescaped | Tampering / Elevation of Privilege | Already mitigated project-wide: only `Clarification.question` is model-authored text and it is not touched by this phase; `ToggleDataset`'s two fields are closed enums, not free text, so there is no new surface for this pattern. |
| Prompt injection via a malicious lab/incident/procedure `notes`/`test_name` field surfacing in the overlay list and being echoed back into a future agent prompt | Tampering | Not applicable to this phase — the agent's `SYSTEM_PROMPT` is a static module constant never interpolated with database content (existing project invariant, `prompt.py`'s own docstring); the overlay accessible list renders these fields as plain React text nodes only (same `T-02-08` no-raw-HTML discipline `ChartTooltip.tsx`/`ReadingsTable.tsx` already enforce for `notes`). |
| Over-fetching / cache poisoning via an overly broad `queryKey` | Information Disclosure (low severity, single-user app) | Addressed directly in Anti-Patterns above — key the new hooks on `{ start_date, end_date }` only, matching the backend's actual filter surface, not the full `ResolvedFilters` object. |

## Sources

### Primary (HIGH confidence)
- `backend/app/agent/schemas.py`, `service.py`, `resolver.py`, `prompt.py`, `copy.py` — read in
  full, existing five-variant closed-union pattern, `_lower_tokens` normalizer, `_apply_command`
  branch structure
- `backend/app/deps.py`, `backend/app/schemas.py`, `backend/app/models.py`,
  `backend/app/routers/labs.py` — read in full, `LabFilters`/`IncidentFilters`/`ProcedureFilters`
  date-range-only contract, `LabResult.date`/`Procedure.date` (Date column) vs.
  `Incident.datetime_` (DateTime column) distinction
- `frontend/src/store/filters.ts`, `lib/agent.ts`, `lib/dates.ts`, `lib/chartData.ts`,
  `lib/palette.ts` — read in full, store shape, `applyAgentFilters`/`composeConfirmation`,
  `parseDateOnly`, jsdom 0×0 chart-rendering constraint
- `frontend/src/components/FilterBar.tsx`, `ChartDeck.tsx`, `ReadingsTable.tsx`,
  `ChartTooltip.tsx`, `CommandBar.tsx`, `charts/BPTimeline.tsx`, `charts/PulseTrend.tsx`,
  `charts/CategoryBars.tsx`, `charts/AmPmComparison.tsx` — read in full, all reused patterns
  cited above
- `frontend/src/hooks/useReadings.ts`, `useStats.ts`, `useCreateRecord.ts`, `useAgent.ts` — read
  in full, TanStack Query hook conventions
- `frontend/src/lib/agent-parity.test.ts` — read in full, structural `STORE_ACTIONS` gate (Pitfall
  4/5)
- `frontend/src/api/types.ts`, `api/client.ts` — read in full, byte-identical-mirror contract
- `frontend/package.json` — verified installed versions (recharts 3.9.2, zustand 5.0.14,
  @tanstack/react-query 5.101.2, lucide-react 1.24.0, vitest 4.1.10)
- `node_modules/lucide-react/dist/esm/icons/` listing — verified `flask-conical.mjs`,
  `alert-triangle.mjs`, `clipboard-list.mjs` exist at the installed version
- `.planning/phases/09-multi-dataset-overlay-filtering/09-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — read in full

### Secondary (MEDIUM confidence)
- https://recharts.github.io/en-US/api/ReferenceLine/ — prop list (`x`, `ifOverflow`, `label`,
  `zIndex` default) via WebFetch
- https://recharts.github.io/en-US/api/Label/ — `content`/`viewBox`/`position` prop descriptions
  via WebFetch
- https://github.com/recharts/recharts/issues/2405 — `content` prop on `ReferenceLine`'s `Label`
  known-broken behavior, via WebFetch (resolution status in Recharts 3.9.x not confirmed — see
  Assumptions Log A1)

### Tertiary (LOW confidence)
- General WebSearch results on Recharts `ReferenceLine` icon rendering (CodeSandbox links) — not
  independently fetchable (403), used only to corroborate that custom-icon-on-ReferenceLine is a
  commonly-attempted pattern with known friction, not to source any specific code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every library/version verified directly against
  `package.json`/installed `node_modules`.
- Architecture: HIGH — every pattern is a direct, read-verified extension of existing code in this
  exact repository, not a generic best-practice inference.
- Pitfalls: MEDIUM-HIGH — the date-parsing and test-structural-gate pitfalls are HIGH confidence
  (directly verified in-repo); the `ReferenceLine` label/domain-overflow pitfalls are MEDIUM
  (grounded in official docs + a GitHub issue, but not confirmed against the exact pinned Recharts
  3.9.x behavior in this specific chart configuration — flagged for a small early implementation
  spike, not a blocker).

**Research date:** 2026-08-21
**Valid until:** 2026-09-20 (30 days — stable internal codebase extension, no fast-moving external
dependency)
