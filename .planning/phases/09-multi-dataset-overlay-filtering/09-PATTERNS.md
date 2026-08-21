# Phase 9: Multi-Dataset Overlay & Filtering - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 23 (5 backend, 18 frontend)
**Analogs found:** 23 / 23 (18 self-extension of the modified file's own established
discipline, 5 cross-file role-match onto a different existing file)

This phase is a pure extension of five already-proven patterns (RESEARCH's own framing) —
every file below either extends its own existing internal convention (modify) or has a
direct, already-read analog elsewhere in the repo (new file). `09-UI-SPEC.md`'s
"Phase-Specific Component Contract" section already nails the exact JSX/markup for the two
new components (`OverlayToggle.tsx`, `OverlayEventsList.tsx`) — this document pairs that
markup with the underlying *mechanical* pattern (aria-pressed contract, pagination contract,
query-hook contract, closed-union schema contract) so the planner can cite both the "what"
(UI-SPEC) and the "why/how it plugs into the rest of the app" (this file) per plan action.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/agent/schemas.py` | model (schema) | request-response | self — `DashboardCommand`/`AppliedFilters` (same file) | exact |
| `backend/app/agent/service.py` | service | request-response | self — `_apply_command`/`interpret` (same file) | exact |
| `backend/app/agent/prompt.py` | config | request-response | self — `SYSTEM_PROMPT` routing-rules block (same file) | exact |
| `backend/tests/test_agent_schemas.py` | test | n/a | self — existing variant-parse/case-drift tests (same file) | exact |
| `backend/tests/test_agent_service.py` | test | n/a | self — existing breaker/interpret tests (same file) | exact |
| `frontend/src/store/filters.ts` | store | event-driven (state) | self — existing single-select fields/actions (same file) | exact |
| `frontend/src/store/filters.test.ts` | test | n/a | self — existing `useFilters.getState()` tests (same file) | exact |
| `frontend/src/lib/agent.ts` | utility (agent→store bridge) | transform | self — `applyAgentFilters` (same file) | exact |
| `frontend/src/lib/agent-parity.test.ts` | test | n/a | self — structural `STORE_ACTIONS`/`CASES` gate (same file) | exact |
| `frontend/src/api/types.ts` | model (TS types) | transform | self — `AppliedFilters` mirror (same file) | exact |
| `frontend/src/api/client.ts` | service (API client) | request-response | self — `getReadings`/`getStatsSummary` (same file) | exact |
| `frontend/src/hooks/useLabs.ts` (new) | hook | CRUD (read) | `frontend/src/hooks/useReadings.ts` | exact |
| `frontend/src/hooks/useIncidents.ts` (new) | hook | CRUD (read) | `frontend/src/hooks/useReadings.ts` | exact |
| `frontend/src/hooks/useProcedures.ts` (new) | hook | CRUD (read) | `frontend/src/hooks/useReadings.ts` | exact |
| `frontend/src/lib/overlayEvents.ts` (new, recommended) | utility (pure data-shaping) | transform | `frontend/src/lib/chartData.ts` (`toTimePoints`/`groupAmPm`) | role-match |
| `frontend/src/components/OverlayToggle.tsx` (new) | component | event-driven | `frontend/src/components/FilterBar.tsx` | role-match (first multi-select group) |
| `frontend/src/components/OverlayToggle.test.tsx` (new) | test | n/a | `frontend/src/components/AddRecordPage.test.tsx` (aria-pressed group assertions) | partial-match |
| `frontend/src/components/OverlayEventsList.tsx` (new) | component | CRUD (display) | `frontend/src/components/ReadingsTable.tsx` | exact |
| `frontend/src/components/OverlayEventsList.test.tsx` (new) | test | n/a | `frontend/src/components/ReadingsTable.test.tsx` | exact |
| `frontend/src/components/charts/BPTimeline.tsx` | component (chart) | transform/render | self + `PulseTrend.tsx`'s existing `ReferenceLine` | exact |
| `frontend/src/components/charts/PulseTrend.tsx` | component (chart) | transform/render | self — existing bradycardia `ReferenceLine` (same file) | exact |
| `frontend/src/components/ChartDeck.tsx` | component (registry) | pass-through | self — `ChartDeckProps`/registry (same file) | exact |
| `frontend/src/App.tsx` | component (composition) | composition | self — `Dashboard()`'s `main` assembly (same file) | exact |

**Not modified (correcting a RESEARCH guess):** `frontend/src/components/charts/CategoryBars.tsx`
and `frontend/src/components/charts/AmPmComparison.tsx` do **not** need changes.
`09-UI-SPEC.md`'s Phase-Specific Component Contract resolved OVERLAY-05's "doesn't apply
here" indicator to live *inside* `OverlayToggle.tsx` itself (it reads `activeChart` directly
and renders its own note) — RESEARCH's Recommended Project Structure flagged these two chart
files as only conditionally in scope ("if placed per-chart"); the UI-SPEC's binding decision
is NOT per-chart. Do not touch these two files.

**No backend route changes:** `GET /labs`, `GET /incidents`, `GET /procedures` (Phase 7,
`backend/app/routers/labs.py` + siblings) are reused verbatim — zero backend route files in
scope this phase.

---

## Pattern Assignments

### `backend/app/agent/schemas.py` (model, request-response)

**Analog:** self — the file's own `DashboardCommand`/`AppliedFilters` classes are the
template for the new `ToggleDataset` member and its two new `AppliedFilters` fields.

**Existing closed-union member to mirror** (lines 94-102):
```python
class DashboardCommand(BaseModel):
    """A view/filter command. Unmentioned fields stay None → carry over (D-13)."""

    action: Literal["command"]
    chart: ChartToken | None = None
    date_range: DateRange | None = None
    am_pm: Literal["all", "am", "pm"] | None = None
    bp_category: BPCategoryToken | None = None
    reset: bool = False  # "show all data"/"start over" → showAllData()
```

**Closed union to extend** (lines 132-135):
```python
class AgentOutput(BaseModel):
    """The closed union Claude fills via structured outputs (API-04)."""

    result: DashboardCommand | DataQuestion | Clarification | MedicalRefusal | Unintelligible
```
Add `ToggleDataset` as a sixth member. The `_lower_tokens` validator (lines 137-157) needs
**no change** — it recurses generically over every key in the `result` dict regardless of
which union member it is.

**`AppliedFilters` to extend** (lines 188-198):
```python
class AppliedFilters(BaseModel):
    """Store-shaped filter delta the frontend applies. Canonical labels, not tokens."""

    activeChart: ChartToken | None = None
    datePreset: Literal["7d", "30d", "90d", "all"] | None = None
    customRange: CustomRange | None = None
    amPm: Literal["all", "AM", "PM"] | None = None
    bpCategory: Literal[
        "all", "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
    ] | None = None
    reset: bool = False
```
Add `overlayDataset: DatasetToken | None = None` and `overlayState: Literal["on","off"] | None = None`
in this exact `X | None = None` style (D-03: single-valued `Literal`, no list constraint).

**New shape to add** (module docstring's discipline, lines 1-27, applies verbatim — lowercase
snake_case tokens, no numeric bounds):
```python
DatasetToken = Literal["labs", "incidents", "procedures"]

class ToggleDataset(BaseModel):
    """Explicit on/off for one overlay dataset (D-03: single dataset, D-04: explicit state)."""

    action: Literal["toggle_dataset"]
    dataset: DatasetToken
    state: Literal["on", "off"]
```

**Critical:** `frontend/src/api/types.ts`'s `AppliedFilters` type must mirror the two new
fields byte-identically (see that file's Pattern Assignment below) — `agent-parity.test.ts`
does NOT catch a field-name drift on this specific model (see Shared Patterns).

---

### `backend/app/agent/service.py` (service, request-response)

**Analog:** self — `_apply_command` (lines 185-206) is the template for a new
`_apply_toggle_dataset` branch, and `interpret`'s `isinstance` dispatch chain (lines 233-261)
is the template for wiring it in.

**Branch-dispatch pattern to mirror** (lines 231-261, excerpted):
```python
result = output.result

if isinstance(result, DashboardCommand):
    return _apply_command(result, earliest, latest)

if isinstance(result, DataQuestion):
    filters = AppliedFilters(activeChart=result.chart) if result.chart else AppliedFilters()
    return AgentReply(kind="applied", filters=filters, message=DATA_QUESTION_MESSAGE)
```
Add `if isinstance(result, ToggleDataset): return _apply_toggle_dataset(result)` alongside
these, importing `ToggleDataset` into the existing `from app.agent.schemas import (...)` block
(lines 45-58).

**New function to add**, mirroring `_apply_command`'s shape (lines 185-189) but simpler (no
date-range resolution needed):
```python
def _apply_toggle_dataset(cmd: ToggleDataset) -> AgentReply:
    filters = AppliedFilters(overlayDataset=cmd.dataset, overlayState=cmd.state)
    return AgentReply(kind="applied", filters=filters, message="", context=None)
```
Note `message=""` matches `_apply_command`'s own comment (lines 203-204): "the frontend
composes the ... full-state echo from the post-merge store; the server never authors the
confirmation." D-08 (reset also clears overlays) needs **no backend change** — `reset` already
flows through `AppliedFilters(reset=True)` unchanged; the frontend's `showAllData()` handles it
(see `store/filters.ts` below).

---

### `backend/app/agent/prompt.py` (config, static prompt)

**Analog:** self — the existing "Charts"/"Time-of-day filter"/"Routing rules" paragraphs
(lines 27-67) are the template for a new "Overlay data toggles" paragraph.

**Pattern to mirror** (lines 33-39, an existing token-vocabulary paragraph):
```
Time-of-day filter:
- "mornings", "AM" -> am
- "evenings", "afternoons", "nights", "PM" -> pm
- "all times", "both" -> all
```

**New paragraph to add** (insert before "Routing rules:", per D-03/D-04 and UI-SPEC's
Copywriting Contract voice-vocabulary table):
```
Overlay data toggles (use these exact dataset tokens): labs, incidents, procedures.
- "show/add/turn on <dataset>" -> toggle_dataset with state = on
- "hide/remove/turn off <dataset>" -> toggle_dataset with state = off
- "incidents" also covers "hospital stays", "hospitalizations"
```
Also extend the existing "show all data" routing rule (lines 55-57) — its current wording
already says the reset command clears "everything"; no wording change is strictly required
since D-08 is frontend-only, but confirm it doesn't contradict the new overlay vocabulary.

---

### `backend/tests/test_agent_schemas.py` (test)

**Analog:** self — the file's existing per-variant parse/case-drift tests are the direct
template (verified via `grep`, function names only — full read not needed given the mechanical
shape is identical to `test_command_variant_parses`/`test_bp_category_case_drift_normalizes`).

Add:
- A `test_toggle_dataset_variant_parses` mirroring `test_command_variant_parses` (constructs an
  `AgentOutput` dict with `{"result": {"action": "toggle_dataset", "dataset": "labs", "state": "on"}}`,
  asserts `isinstance(out.result, ToggleDataset)`).
- A case-drift test mirroring `test_bp_category_case_drift_normalizes`/`test_am_pm_case_drift_normalizes`
  (uppercase `"LABS"`/`"ON"` input normalizes to lowercase via the existing generic `_lower_tokens`
  validator — no new validator code needed, just a new test proving the existing one covers it).
- A `test_bp_token_map_values_match_deps_bpcategory`-style parity test is NOT needed for
  `DatasetToken` (no label-mapping translation exists for overlay tokens — `dataset`/`state`
  pass through to `AppliedFilters` verbatim, unlike `bp_category`'s `BP_TOKEN_TO_LABEL` remap).

---

### `backend/tests/test_agent_service.py` (test)

**Analog:** self — existing breaker/`interpret()` tests (fixture-based, monkeypatched
`_get_client`, no network) are the template shape; add a new test exercising
`_apply_toggle_dataset` / `interpret()` returning `AppliedFilters(overlayDataset=..., overlayState=...)`
for a fake `ToggleDataset` result, following the same fixture pattern already used at
`_reset_breaker` (line 56) and the `_override`-style fake-interpreter injection also visible in
`test_agent_route.py` (lines 33-35) if route-level coverage is preferred instead/in addition.

---

### `frontend/src/store/filters.ts` (store, event-driven)

**Analog:** self — the existing single-select field/action pairs are the template for the new
independent multi-select field.

**Full existing file for context** (this is the entire file, 53 lines — read once, no re-read
needed):
```typescript
interface FilterState {
  activeChart: ChartId; // D-02/D-03
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null }; // "YYYY-MM-DD"
  amPm: "all" | "AM" | "PM"; // D-19 single-select
  bpCategory: "all" | BPCategory; // D-19 single-select
  setActiveChart: (c: ChartId) => void; // each action ↔ one future voice command
  setDatePreset: (p: Exclude<DatePreset, "custom">) => void;
  setCustomRange: (from: string, to: string) => void;
  setAmPm: (v: "all" | "AM" | "PM") => void;
  setBpCategory: (v: "all" | BPCategory) => void;
  showAllData: () => void; // D-11 big button
}

export const useFilters = create<FilterState>((set) => ({
  activeChart: "bp_timeline",
  datePreset: "all",
  customRange: { from: null, to: null },
  amPm: "all",
  bpCategory: "all",
  setActiveChart: (activeChart) => set({ activeChart }),
  setDatePreset: (datePreset) =>
    set({ datePreset, customRange: { from: null, to: null } }),
  setCustomRange: (from, to) =>
    set({ datePreset: "custom", customRange: { from, to } }),
  setAmPm: (amPm) => set({ amPm }),
  setBpCategory: (bpCategory) => set({ bpCategory }),
  showAllData: () =>
    set({
      datePreset: "all",
      customRange: { from: null, to: null },
      amPm: "all",
      bpCategory: "all",
    }),
}));
```

**Add** (RESEARCH Pattern 3, matches D-01/D-03/D-04/D-07/D-08 exactly):
```typescript
export type OverlayDataset = "labs" | "incidents" | "procedures";

// in FilterState:
overlayDatasets: Record<OverlayDataset, boolean>; // independent multi-select (D-01)
setOverlayDataset: (dataset: OverlayDataset, on: boolean) => void; // D-03/D-04 shape

// in create<FilterState>:
overlayDatasets: { labs: false, incidents: false, procedures: false }, // D-07
setOverlayDataset: (dataset, on) =>
  set((s) => ({ overlayDatasets: { ...s.overlayDatasets, [dataset]: on } })),
```
**Modify `showAllData`** (D-08) to also zero `overlayDatasets` — add
`overlayDatasets: { labs: false, incidents: false, procedures: false }` to its existing `set({...})` call.

---

### `frontend/src/store/filters.test.ts` (test)

**Analog:** self. The existing `INITIAL` fixture (lines 7-13) and `describe("showAllData (D-11)")`
block (lines 63-80) are the direct templates:
```typescript
const INITIAL = {
  activeChart: "bp_timeline" as const,
  datePreset: "all" as const,
  customRange: { from: null, to: null },
  amPm: "all" as const,
  bpCategory: "all" as const,
};
```
Add `overlayDatasets: { labs: false, incidents: false, procedures: false }` to `INITIAL`. Add a
new `describe("overlay multi-select (D-01/D-07)")` block asserting `setOverlayDataset("labs", true)`
sets only `overlayDatasets.labs` (others stay `false` — proves independence), and extend the
existing `showAllData` test (lines 64-79) to first set an overlay ON, then assert
`overlayDatasets` returns to all-`false` after `showAllData()` (D-08), following this file's
existing get-state/act/assert shape verbatim.

---

### `frontend/src/lib/agent.ts` (utility, transform)

**Analog:** self — `applyAgentFilters`'s per-field `if (f.X != null)` block is the direct
template (lines 38-77), and `PulseField`'s union type (line 16) is the template for the new
`"overlay"` member.

**Existing per-field pattern to mirror** (lines 50-72):
```typescript
// Present-value deltas only (`!= null` — "all" is a valid present value, so
// truthiness would be wrong; every value here is otherwise a non-empty token).
if (f.activeChart != null) {
  s.setActiveChart(f.activeChart);
  touched.add("chart");
}
// ...
if (f.bpCategory != null) {
  s.setBpCategory(f.bpCategory);
  touched.add("bpCategory");
}
```

**Add**, following the exact same shape (both `overlayDataset` and `overlayState` must be
present together since the store setter needs both args):
```typescript
export type PulseField = "chart" | "dateRange" | "amPm" | "bpCategory" | "overlay"; // + "overlay"

// inside applyAgentFilters, alongside the other field checks:
if (f.overlayDataset != null && f.overlayState != null) {
  s.setOverlayDataset(f.overlayDataset, f.overlayState === "on");
  touched.add("overlay");
}
```
Also add `touched.add("overlay")` to the `if (f.reset)` block (lines 42-48) so a reset pulses
the new overlay group too, matching how `reset` already pulses `chart`/`dateRange`/`amPm`/`bpCategory`.

---

### `frontend/src/lib/agent-parity.test.ts` (test) — MANDATORY, build-breaking if skipped

**Analog:** self. This is RESEARCH's Pitfall 4/5 — the file's own docstring (lines 1-14)
states its purpose is to make "adding a store action with no `AppliedFilters` field" a hard
test failure. Three concrete edits are required, all following patterns already in the file:

**1. `STORE_ACTIONS` array** (lines 49-56) — add `"setOverlayDataset"`:
```typescript
const STORE_ACTIONS = [
  "setActiveChart",
  "setDatePreset",
  "setCustomRange",
  "setAmPm",
  "setBpCategory",
  "showAllData",
  "setOverlayDataset", // NEW
] as const;
```

**2. `beforeEach` initial-state reset** (lines 58-67) — add `overlayDatasets` to the
`useFilters.setState({...})` object, matching `frontend/src/store/filters.test.ts`'s `INITIAL`.

**3. `CASES` array** (lines 122-158) — add a new case following this exact shape:
```typescript
{
  action: "setOverlayDataset",
  apply: () => applyAgentFilters({ overlayDataset: "labs", overlayState: "on" }),
  assert: () => expect(useFilters.getState().overlayDatasets.labs).toBe(true),
},
```
The file's own closing assertion (lines 165-176) structurally diffs `CASES`' covered actions
against the store's actual function-typed keys — omitting any of the three edits above fails
`npm test` immediately and unconditionally.

**Not required this phase** (already-existing scope, not new): the backend↔frontend token
parity block (lines 179-211) only diffs `ChartToken`/`bpCategory` literal values — it does not
need a new assertion for `DatasetToken` unless the planner wants defensive test coverage
(optional, not blocking).

---

### `frontend/src/api/types.ts` (model, TS types)

**Analog:** self — the `AppliedFilters` type (lines 154-161) must mirror
`backend/app/agent/schemas.py`'s `AppliedFilters` byte-identically per this file's own header
comment ("byte-identical mirror" contract, lines 1-5).

**Existing type to extend** (lines 154-161):
```typescript
export type AppliedFilters = {
  activeChart?: ChartId | null;
  datePreset?: "7d" | "30d" | "90d" | "all" | null;
  customRange?: { from: string; to: string } | null;
  amPm?: "all" | "AM" | "PM" | null;
  bpCategory?: "all" | BPCategory | null;
  reset?: boolean;
};
```
Add:
```typescript
export type OverlayDataset = "labs" | "incidents" | "procedures";
// in AppliedFilters:
overlayDataset?: OverlayDataset | null;
overlayState?: "on" | "off" | null;
```
Note `LabResult`/`Incident`/`Procedure`/`*Create` types already exist (lines 73-124, Phase 7/8)
— no changes needed there, only the `AppliedFilters` mirror above. **Warning (Pitfall 5, HIGH
confidence):** no automated test currently catches a drift between this file and the backend
model for these two fields specifically — this must be done by hand in lockstep with the
`schemas.py` edit above.

---

### `frontend/src/api/client.ts` (service, request-response)

**Analog:** self — `getReadings`/`getStatsSummary` (lines 151-159) are the direct template for
three new thin wrapper functions over the already-generic `getJson`.

**Pattern to mirror** (lines 151-159):
```typescript
export function getReadings(filters: ResolvedFilters): Promise<Reading[]> {
  return getJson<Reading[]>("/readings", filters);
}

export function getStatsSummary(
  filters: ResolvedFilters,
): Promise<StatsSummary> {
  return getJson<StatsSummary>("/stats/summary", filters);
}
```
**Add**, narrowed to the date-window-only param shape (Anti-Pattern warning below):
```typescript
type DateWindow = { start_date?: string; end_date?: string };

export function getLabs(window: DateWindow): Promise<LabResult[]> {
  return getJson<LabResult[]>("/labs", window);
}
export function getIncidents(window: DateWindow): Promise<Incident[]> {
  return getJson<Incident[]>("/incidents", window);
}
export function getProcedures(window: DateWindow): Promise<Procedure[]> {
  return getJson<Procedure[]>("/procedures", window);
}
```
`LabResult`/`Incident`/`Procedure` are already imported into this file (lines 9-14) — no new
import needed. `getJson`'s existing three-branch `ApiError` discipline (network throw / !res.ok
/ unparseable body — lines 49-75) applies automatically, no new error handling to write.

---

### `frontend/src/hooks/useLabs.ts` / `useIncidents.ts` / `useProcedures.ts` (hooks, new)

**Analog:** `frontend/src/hooks/useReadings.ts` (full file, 18 lines):
```typescript
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getReadings } from "../api/client";
import type { ResolvedFilters } from "../api/types";

export function useReadings(resolved: ResolvedFilters) {
  return useQuery({
    queryKey: ["readings", resolved],
    queryFn: () => getReadings(resolved),
    placeholderData: keepPreviousData, // v5 rename — Pitfall 13
    staleTime: 5 * 60_000, // data changes only on (Phase 5) uploads
  });
}
```
**New hook shape** (RESEARCH Code Example, narrowed `queryKey` per the Anti-Pattern below):
```typescript
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getLabs } from "../api/client";

type DateWindow = { start_date?: string; end_date?: string };

export function useLabs(window: DateWindow, enabled: boolean) {
  return useQuery({
    queryKey: ["labs", window],       // NOT the full ResolvedFilters
    queryFn: () => getLabs(window),
    enabled,                          // lazy — first toggle-on triggers the fetch
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
```
Repeat for `useIncidents`/`getIncidents` and `useProcedures`/`getProcedures`, same shape.

**Anti-Pattern (do not do this):** keying on the full `ResolvedFilters` object (including
`am_pm`/`bp_category`) — `backend/app/deps.py`'s `LabFilters`/`ProcedureFilters`/`IncidentFilters`
(lines 79-146, read in full) only accept `start_date`/`end_date`; keying on more causes needless
refetches on filter changes with zero server-side effect. Key on `{ start_date, end_date }` only.

**Cache invalidation companion (addresses the staleTime Claude's-Discretion item):**
`frontend/src/hooks/useCreateRecord.ts` (full file, 18 lines) currently has no `onSuccess`:
```typescript
import { useMutation } from "@tanstack/react-query";

import { postIncident, postLab, postProcedure } from "../api/client";

export function useCreateLab() {
  return useMutation({ mutationFn: postLab });
}
export function useCreateIncident() {
  return useMutation({ mutationFn: postIncident });
}
export function useCreateProcedure() {
  return useMutation({ mutationFn: postProcedure });
}
```
If the planner elects to add cache invalidation (Claude's-Discretion item, not locked), extend
this file with `useQueryClient().invalidateQueries({ queryKey: ["labs"] })` in an `onSuccess`,
following TanStack v5's standard shape — this file is the modify-site, not a new hooks file.

---

### `frontend/src/lib/overlayEvents.ts` (utility, new, recommended)

**Analog:** `frontend/src/lib/chartData.ts` — role-match, not exact (that file shapes
`Reading[]` for charts; this new file shapes `LabResult[]`/`Incident[]`/`Procedure[]` into one
merged `OverlayEvent[]`). Reuse its documented constraint verbatim:

**Governing constraint** (chartData.ts lines 1-12, applies identically here):
```typescript
/**
 * NO React, NO Recharts imports — everything testable lives here because
 * Recharts renders 0×0 in jsdom (RESEARCH Pitfall 2 / Validation
 * Architecture): chart components only lay out JSX around these outputs.
 */
```
**Direct shaping-function template** (`toTimePoints`, chartData.ts lines 45-53):
```typescript
export function toTimePoints(readings: Reading[]): TimePoint[] {
  return readings.map((reading) => ({
    ts: new Date(reading.datetime).getTime(),
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    pulse: reading.pulse,
    reading,
  }));
}
```
**New function** must route `LabResult.date`/`Procedure.date` through `parseDateOnly` (from
`frontend/src/lib/dates.ts`, lines 37-41 — read in full, this exact function exists precisely
to prevent the UTC-midnight off-by-one bug) and `Incident.datetime` through plain `new Date()`
(same as `toTimePoints`'s `reading.datetime` handling above — it's a full ISO datetime, not
date-only):
```typescript
import { parseDateOnly } from "./dates";
import type { Incident, LabResult, Procedure } from "../api/types";

export type OverlayEvent = {
  id: number;
  ts: number;
  type: "labs" | "incidents" | "procedures";
  label: string;
};

export function labsToEvents(labs: LabResult[]): OverlayEvent[] {
  return labs.map((l) => ({
    id: l.id,
    ts: parseDateOnly(l.date).getTime(), // NEVER new Date(l.date) — Pitfall 1
    type: "labs",
    label: l.test_name,
  }));
}
// procedures: same parseDateOnly(p.date) shape.
// incidents: ts: new Date(i.datetime).getTime() — has a time component, matches toTimePoints.
```
This module is also the natural home for the merged/sorted/paginated list `OverlayEventsList.tsx`
consumes, and the `Date | Type | What happened | Notes` per-type text formatting UI-SPEC
specifies (see that component's Pattern Assignment below) — keep this pure/testable per
`chartData.ts`'s own precedent rather than inlining the logic in the component.

---

### `frontend/src/components/OverlayToggle.tsx` (component, new)

**Analog:** `frontend/src/components/FilterBar.tsx` (full file read, 205 lines) — role-match:
FilterBar's groups are all single-select/radio-style; this is the first true multi-select
group, but the underlying `role="group"` + `aria-pressed` + `≥48px` + agent-pulse contract
carries over unchanged. **`09-UI-SPEC.md`'s Phase-Specific Component Contract (lines 236-336)
is the binding exact markup for this file** — reproduced here paired with the mechanical
pattern it's borrowing from:

**Styling-class pattern to mirror** (FilterBar.tsx lines 25-28 — inactive/active button classes):
```typescript
const inactiveClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";
```
UI-SPEC's version of `activeClass` is a **function** (per-dataset color, not the shared accent
— see UI-SPEC Color section rationale) but the base Tailwind shape (`min-h-12`, `rounded-lg`,
`px-4`, `text-[20px] font-bold`, `border-2`) is copied verbatim from this same constant.

**`role="group"`/`aria-pressed` button-map pattern to mirror** (FilterBar.tsx lines 127-144,
the AM/PM segment — closest single-select precedent to adapt to independent toggling):
```tsx
<div
  role="group"
  aria-label="Time of day"
  className={`flex flex-wrap gap-2${pulseClass("amPm")}`}
>
  {AM_PM_OPTIONS.map(({ value, label }) => (
    <button
      key={value}
      type="button"
      aria-pressed={amPm === value}
      onClick={() => setAmPm(value)}
      className={amPm === value ? activeClass : inactiveClass}
    >
      {label}
    </button>
  ))}
</div>
```
The only structural difference for OverlayToggle: `onClick` calls `setOverlayDataset(key, !on)`
(toggle) instead of `setAmPm(value)` (radio-select) — each button's `aria-pressed` is
independent, not mutually exclusive.

**Agent-pulse pattern to mirror** (FilterBar.tsx lines 57-78 — the `useAgentPulse` subscribe +
1500ms-timeout + `motion-safe:animate-pulse` + static `ring-2` fallback):
```typescript
const pulseSeq = useAgentPulse((s) => s.seq);
const pulseFields = useAgentPulse((s) => s.fields);
const [pulsing, setPulsing] = useState<PulseField[]>([]);
useEffect(() => {
  if (pulseSeq === 0) return; // no apply yet
  setPulsing(pulseFields);
  const t = setTimeout(() => setPulsing([]), 1500);
  return () => clearTimeout(t);
}, [pulseSeq, pulseFields]);

const pulseClass = (field: PulseField) =>
  pulsing.includes(field)
    ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
    : "";
```
Wrap the new `role="group"` div in `pulseClass("overlay")` (requires the `PulseField` union
extension in `lib/agent.ts` above).

**Filter-state sentence pattern to mirror** (FilterBar.tsx lines 83-91, 198-201 — D-20 always-
visible `aria-live="polite"` sentence):
```tsx
<p aria-live="polite" className="mt-4 text-[18px] text-[var(--color-ink)]">
  {sentence}
</p>
```
UI-SPEC's copy: `"{list} overlaid"` / `"No overlays selected"` — same `aria-live="polite"` role,
same placement-after-controls convention.

**Exact markup/copy/color contract — use UI-SPEC verbatim, do not re-derive:** icon map
(`FlaskConical`/`AlertTriangle`/`ClipboardList`), color tokens (`--overlay-labs`/`-incidents`/
`-procedures`), the "doesn't apply here" `opacity-60` treatment, and the full component skeleton
are all specified exactly in `09-UI-SPEC.md` lines 236-361 — that document is this component's
primary implementation reference, not a paraphrase target.

---

### `frontend/src/components/OverlayToggle.test.tsx` (test, new)

**Analog:** `frontend/src/components/AddRecordPage.test.tsx` (partial read, lines 70-115) —
partial-match: it's the only existing test file asserting `aria-pressed` on a button-group
control (`role("group", { name: "Record type" })`, `aria-pressed` truthy/falsy checks):
```typescript
expect(
  screen.getByRole("group", { name: "Record type" }),
).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Lab" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
```
Adapt this shape for `role="group"` name `"Overlay events"` (per UI-SPEC's exact `aria-label`,
line 286) and each of the 3 buttons' `aria-pressed` state, plus a click-toggle test (click
"Labs" → `useFilters.getState().overlayDatasets.labs === true`; click again → `false`) and an
`activeChart`-driven "doesn't apply here" note visibility test (render with
`useFilters.setState({ activeChart: "bp_categories" })`, assert the UI-SPEC note text is
present; render with `"bp_timeline"`, assert it is absent).

---

### `frontend/src/components/OverlayEventsList.tsx` (component, new)

**Analog:** `frontend/src/components/ReadingsTable.tsx` (full file read, 145 lines) — exact
match on structure (big-button paging, plain-text-node, `sr-only` caption). **`09-UI-SPEC.md`
lines 390-464 is the binding exact markup** (4-column `Date | Type | What happened | Notes`
table, conditional mount, per-type empty/error copy) — paired here with the mechanical
pagination/sort/security patterns it borrows from ReadingsTable.tsx:

**Pagination pattern to mirror** (ReadingsTable.tsx lines 17, 42-56, 91-103):
```typescript
const PAGE_SIZE = 20;
// ...
const [visible, setVisible] = useState(PAGE_SIZE);

useEffect(() => {
  setVisible(PAGE_SIZE);
}, [readings]); // reset on data-array identity change

const sorted = [...readings].sort((a, b) => b.datetime.localeCompare(a.datetime));
const shown = sorted.slice(0, visible);
const allShown = visible >= sorted.length;
// ...
{allShown ? (
  <p className="mt-4 text-center text-lg">Showing all {sorted.length} readings</p>
) : (
  <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="mt-4 min-h-12 w-full rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)]">
    Show 20 more
  </button>
)}
```
`OverlayEventsList` sorts the MERGED events by `ts` (numeric-descending, not `localeCompare` on
an ISO string — the merged list has mixed date-only and datetime sources normalized to epoch ms
by `lib/overlayEvents.ts` above) but the `visible`/`PAGE_SIZE`/`useEffect`-reset/button copy are
reused verbatim per UI-SPEC's explicit instruction ("reuse verbatim, do not reinvent").

**Table structure + `sr-only` caption pattern to mirror** (ReadingsTable.tsx lines 59-89):
```tsx
<section className="rounded-lg bg-[var(--color-sky)] p-6">
  <table className="w-full text-left">
    <caption className="sr-only">Readings</caption>
    <thead>
      <tr>
        <th scope="col" className="p-2 text-xl font-bold">Date</th>
        {/* ... */}
      </tr>
    </thead>
    <tbody>{shown.map((r) => <ReadingRow key={r.id} reading={r} />)}</tbody>
  </table>
  {/* pagination footer */}
</section>
```

**Security pattern to mirror (T-02-08, no-HTML-injection)** (ReadingsTable.tsx lines 10-11,
134-141 — `notes` renders as a plain React text node, never `dangerouslySetInnerHTML`):
```tsx
{hasNote && (
  <tr>
    <td colSpan={6} className="p-2 pt-0 text-lg">
      Note: {r.notes}
    </td>
  </tr>
)}
```
`OverlayEventsList`'s `Notes` column applies the identical discipline to each of
`LabResult.notes`/`Incident.notes`/`Procedure.notes`.

**Chip/badge color pattern to mirror** (ReadingsTable.tsx lines 120-132, category chip):
```tsx
<span
  className="inline-block rounded-full px-3 py-1 text-lg"
  style={{ backgroundColor: categoryColor(r.bp_category), color: CHIP_TEXT }}
>
  {r.bp_category}
</span>
```
The new `Type` column's icon+color badge (UI-SPEC: `FlaskConical`/`--overlay-labs` etc.) reuses
this exact `inline-block rounded-full px-3 py-1 text-lg` chip shape with the phase's new color
tokens instead of `categoryColor`.

**Conditional mount pattern (renders nothing when no overlay is ON)** — analog:
`frontend/src/components/AgentStatusBanner.tsx` (full file, 46 lines), its own established
null-render convention (lines 31-33):
```typescript
const showBanner = unavailable || health.isError;
if (!showBanner) return null;
```
`OverlayEventsList` (or its `App.tsx` call site) applies the same `if (no overlay ON) return null`
shape — "don't render an empty shell," per UI-SPEC line 401.

---

### `frontend/src/components/OverlayEventsList.test.tsx` (test, new)

**Analog:** `frontend/src/components/ReadingsTable.test.tsx` (full file, 148 lines) — exact
match. Direct templates to adapt:
- `rowCount()` helper (lines 40-43) — same `screen.getAllByRole("row").length` pattern.
- "renders N rows, then N+20 ... Show 20 more button disappears" test (lines 45-62).
- "sorts newest-first regardless of input order" test (lines 64-79) — adapt to the merged
  `ts`-based sort instead of `datetime.localeCompare`.
- "has accessible column headers" test (lines 101-119) — adapt the header list to
  `Date | Type | What happened | Notes`.
- "resets to 20 visible when the ... prop identity changes" test (lines 138-147).
Add new cases beyond the ReadingsTable template: per-type empty-state copy (`"No labs recorded
in this date range."` etc., UI-SPEC's dynamic list-joining rule), per-dataset error isolation
(one `role="alert"` line while the other two datasets' events still render), and the
conditional-mount-when-nothing-ON test (`if (no overlay is on) render(<OverlayEventsList ... />)`
→ `container.firstChild` is `null` — mirroring `AgentStatusBanner`'s own null-render, though
that component's test file wasn't read in full for this phase — the pattern is the same
`if (!x) return null` shape already cited above).

---

### `frontend/src/components/charts/BPTimeline.tsx` (component, chart)

**Analog:** self (full file read, 218 lines) for JSX z-order discipline + `PulseTrend.tsx`'s
existing `ReferenceLine` (below) for the marker mechanics — this file has `ReferenceArea`
markers but no `ReferenceLine` yet, so PulseTrend is the closer literal precedent for the new
element type.

**Z-order discipline to preserve** (file header comment, lines 5-6, and the actual JSX order
lines 113-212 — bands, then axes/tooltip, then `Line`s):
```
- Six AHA ReferenceArea bands render BEFORE the Lines: Recharts 3 z-order
  is JSX order (Pitfall 7), so bands sit BEHIND the data (D-08).
```
New `ReferenceLine` overlay markers must render **AFTER** the two `<Line>` elements (lines
185-212) — i.e., as the LAST children inside `<LineChart>`, right before its closing tag — so
markers sit visually on top of both the AHA bands and the systolic/diastolic lines.

**Label-object pattern to mirror (NOT nested `<Label content>` — Pitfall 3)** — `bandLabel`
(lines 46-53):
```typescript
function bandLabel(cat: BPCategory) {
  return {
    value: cat,
    position: "insideTopLeft" as const,
    fontSize: 14,
    fill: categoryColor(cat),
  };
}
```
This exact plain-object `{ value, position, fontSize, fill }` shape (passed straight to a
Recharts `label` prop, not a nested `<Label content={...}>` element) is the proven-safe pattern
— UI-SPEC's fallback glyph rendering path for overlay markers uses this identical shape.

**Props to add:**
```typescript
export type BPTimelineProps = {
  readings: Reading[];
  variant: "hero" | "mini";
  overlayEvents?: OverlayEvent[]; // NEW — from lib/overlayEvents.ts
};
```
Gate rendering on `hero` (matching this file's existing `{hero && (...)}` convention used for
`Tooltip`, lines 174-184, and band labels, lines 120/127/etc.) — D-02 requires markers NEVER
render on the mini preview, and this file's own established idiom for "hero-only" is exactly
this ternary/`&&` gate, not a separate prop.

**Domain-widening prerequisite (RESEARCH Pitfall 2, MEDIUM confidence, flag for early spike):**
the existing `XAxis domain={["dataMin", "dataMax"]}` (lines 158-166) is computed from
`toTimePoints(readings)` only. An overlay event outside that range needs either (a) the domain
widened to include overlay `ts` values, or (b) `ifOverflow="extendDomain"` on each
`ReferenceLine` — UI-SPEC does not resolve this explicitly; treat as an implementation detail
within the locked D-06 `ReferenceLine` approach.

---

### `frontend/src/components/charts/PulseTrend.tsx` (component, chart)

**Analog:** self — this file already has the exact `ReferenceLine` precedent (full file read,
121 lines) the new overlay markers extend.

**Direct `ReferenceLine` template to mirror** (lines 81-95, the bradycardia line):
```tsx
<ReferenceLine
  y={60}
  stroke="var(--ref-bradycardia)"
  strokeDasharray="6 4"
  label={
    hero
      ? {
          value: "60 bpm — Bradycardia",
          position: "insideBottomRight",
          fontSize: 16,
          fill: "var(--ref-bradycardia)",
        }
      : undefined
  }
/>
```
The overlay markers differ in three ways UI-SPEC locks explicitly: `x={evt.ts}` (vertical line,
not horizontal `y={60}`), no `strokeDasharray` (solid, `strokeWidth={2}` — UI-SPEC: "so overlay
events read as distinct from the dashed clinical-threshold line already on that chart"), and
`ifOverflow="extendDomain"` (this existing bradycardia line has no `ifOverflow` prop since a
fixed `y` value can't overflow the fixed `[30,120]` Y-domain — a NEW consideration for the
overlay lines' dynamic `x` positioning, see the domain-widening note under BPTimeline above).

Add the identical `overlayEvents?: OverlayEvent[]` prop and `hero`-gated rendering block (same
placement rule: after the existing `<Line dataKey="pulse" ... />`, lines 108-115, as the last
children before `</LineChart>`).

---

### `frontend/src/components/ChartDeck.tsx` (component, registry)

**Analog:** self (full file read, 164 lines) — `ChartDeckProps` and the registry's `hero`/`mini`
function signatures are the direct pass-through template.

**Existing prop-threading pattern to extend** (lines 29-32, 115-123):
```typescript
export type ChartDeckProps = {
  readings: Reading[];
  stats: StatsSummary | undefined;
};
// ...
export function ChartDeck({ readings, stats }: ChartDeckProps) {
  // ...
  const data: ChartDeckProps = { readings, stats };
  // ...
  <div key={active.id} className="h-[420px]">
    <FadeSwap>{active.hero(data)}</FadeSwap>
  </div>
  // ...
  <div aria-hidden="true" className="pointer-events-none h-36">
    <FadeSwap>{entry.mini(data)}</FadeSwap>
  </div>
```
Add `overlayEvents?: OverlayEvent[]` to `ChartDeckProps` and thread it into `data`. Both `.hero(data)`
and `.mini(data)` receive the same `data` object (as today) — D-02's "never on mini previews"
constraint is enforced INSIDE `BPTimeline`/`PulseTrend` via their own `hero &&` gate (see those
files' Pattern Assignments above), not by withholding the prop from `ChartDeck`'s mini call —
this matches the existing convention where minis already receive the full `ChartDeckProps` and
self-gate their own hero-only features (Tooltip, band labels, end labels).

The `bp_categories`/`am_pm_comparison` registry entries' `hero`/`mini` functions (lines 60-80)
need **no change** — those chart components don't accept `overlayEvents` (confirmed: not
modified, per the File Classification note above).

---

### `frontend/src/App.tsx` (component, composition)

**Analog:** self (full file read, 180 lines) — the `Dashboard()` function's `main` assembly
and its existing hook-wiring/conditional-render conventions are the direct template.
`09-UI-SPEC.md` lines 242-251 gives the exact mount order — reproduced paired with the
underlying patterns:

**Existing `main` assembly to extend** (lines 126-136):
```tsx
<main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 md:px-8 xl:px-16">
  <FilterBar latestReading={latestReading} />
  <StatsStrip stats={stats.data} isLoading={stats.isPending} />
  {chartRegion}
  <section aria-label="Readings table">
    <h2 className="mb-4 text-2xl leading-tight font-bold text-[var(--color-ink)]">
      Readings
    </h2>
    <ReadingsTable readings={readings.data ?? []} />
  </section>
</main>
```
UI-SPEC's target order inserts `<OverlayToggle />` directly after `<FilterBar />` and a
conditional `{overlayEventsSection}` after the Readings section (UI-SPEC lines 243-250).

**Hook-wiring pattern to mirror** (lines 51-53, top of `Dashboard()`):
```typescript
const resolved = useResolvedFilters();
const readings = useReadings(resolved);
const stats = useStats(resolved);
```
Add the three new overlay hooks here, each `enabled` on its own `overlayDatasets.<type>` flag
and keyed on `{ start_date: resolved.start_date, end_date: resolved.end_date }` (the narrowed
window, not the full `resolved` object — see the Anti-Pattern note under the hooks section
above):
```typescript
const overlayDatasets = useFilters((s) => s.overlayDatasets);
const window = { start_date: resolved.start_date, end_date: resolved.end_date };
const labs = useLabs(window, overlayDatasets.labs);
const incidents = useIncidents(window, overlayDatasets.incidents);
const procedures = useProcedures(window, overlayDatasets.procedures);
```

**Conditional-section pattern to mirror** — same `if (!x) return null`/ternary idiom already
used for `chartRegion`'s branching (lines 67-109) and `AgentStatusBanner`'s self-contained
null-render (see that file's citation above): compute the merged `overlayEvents` array (via
`lib/overlayEvents.ts`) and pass it to `ChartDeck`; conditionally render
`<OverlayEventsList ... />` only when at least one of `overlayDatasets.{labs,incidents,procedures}`
is `true`.

---

## Shared Patterns

### Closed-union `Literal`-token discipline (backend agent schema)
**Source:** `backend/app/agent/schemas.py` lines 1-27 (module docstring), `DashboardCommand`
(lines 94-102).
**Apply to:** `ToggleDataset`. Lowercase snake_case tokens, no numeric bounds, single-valued
fields only (no lists) — `_lower_tokens` (lines 137-157) already handles new members generically.

### `AppliedFilters` byte-identical mirror (cross-language contract)
**Source:** `backend/app/agent/schemas.py`'s `AppliedFilters` ↔ `frontend/src/api/types.ts`'s
`AppliedFilters` (types.ts line 1-5 header comment names this explicitly).
**Apply to:** every new field added to one side must be added to the other by hand — NOT
caught by `agent-parity.test.ts`'s existing assertions for these two new fields (RESEARCH
Pitfall 5, HIGH confidence, verified by reading that test file in full).

### `role="group"` + `aria-pressed` + `≥48px` toggle contract
**Source:** `frontend/src/components/FilterBar.tsx` lines 25-28 (class constants), 127-144
(AM/PM segment).
**Apply to:** `OverlayToggle.tsx` — same contract, independent (non-radio) `aria-pressed` per
button instead of mutually-exclusive.

### Agent-pulse visual-parity system
**Source:** `frontend/src/lib/agent.ts` (`useAgentPulse`, `PulseField`, `applyAgentFilters`),
consumed by `frontend/src/components/FilterBar.tsx` lines 57-78.
**Apply to:** `OverlayToggle.tsx` must extend `PulseField` with `"overlay"` and wrap its
`role="group"` div in the same `pulseClass` treatment — D-01's "voice or click" parity mandate.

### TanStack Query read-hook contract
**Source:** `frontend/src/hooks/useReadings.ts` (full file) — `useQuery`/`queryKey`/
`placeholderData: keepPreviousData`/`staleTime: 5 * 60_000`.
**Apply to:** `useLabs`/`useIncidents`/`useProcedures`, with the addition of an `enabled` gate
(not present in `useReadings`, since readings always fetch) and a narrower `queryKey`.

### Date-only vs. datetime parsing (Pitfall 1, HIGH confidence)
**Source:** `frontend/src/lib/dates.ts` lines 37-41 (`parseDateOnly`), contrasted with
`frontend/src/lib/chartData.ts` lines 45-53 (`toTimePoints`'s plain `new Date(reading.datetime)`
for full-ISO datetimes).
**Apply to:** `lib/overlayEvents.ts` — `LabResult.date`/`Procedure.date` (Date columns, no time)
MUST route through `parseDateOnly`; `Incident.datetime` (DateTime column) uses plain `new Date()`,
matching the existing `toTimePoints` convention exactly.

### Accessible-table pagination + no-HTML-injection contract
**Source:** `frontend/src/components/ReadingsTable.tsx` (full file) — `PAGE_SIZE = 20`,
`useEffect` reset-on-identity-change, `sr-only` caption, plain-text-node `notes` rendering
(T-02-08).
**Apply to:** `OverlayEventsList.tsx` — reused verbatim per UI-SPEC's own instruction.

### Null-render-when-nothing-to-show
**Source:** `frontend/src/components/AgentStatusBanner.tsx` lines 31-33
(`if (!showBanner) return null`).
**Apply to:** `OverlayEventsList.tsx`'s conditional mount (D-07: nothing shows at neutral
default) — same one-line early-return idiom, no bespoke empty-shell markup.

### Plain-object `label` prop (never nested `<Label content={...}>`, Pitfall 3)
**Source:** `frontend/src/components/charts/BPTimeline.tsx` lines 46-53 (`bandLabel`),
`frontend/src/components/charts/PulseTrend.tsx` lines 85-93 (bradycardia `ReferenceLine` label).
**Apply to:** overlay `ReferenceLine` markers on both timeline charts — `{ value, position,
fontSize, fill }` object form only.

### Backend read-route reuse (zero backend route changes)
**Source:** `backend/app/routers/labs.py` (full file) + `backend/app/deps.py`'s `LabFilters`/
`IncidentFilters`/`ProcedureFilters` (lines 79-146) — already Bearer-gated at `include_router`
time, already date-range filterable.
**Apply to:** nothing new to write here — `useLabs`/`useIncidents`/`useProcedures` call these
routes exactly as-is via the new `getLabs`/`getIncidents`/`getProcedures` client wrappers.

---

## No Analog Found

None — every file in scope this phase has either a direct self-extension pattern (the file
being modified already establishes the convention its own new code must follow) or a clear
cross-file role-match analog already read in full above.

## Metadata

**Analog search scope:** `backend/app/agent/`, `backend/app/deps.py`, `backend/app/routers/`,
`backend/tests/`, `frontend/src/store/`, `frontend/src/lib/`, `frontend/src/api/`,
`frontend/src/hooks/`, `frontend/src/components/`, `frontend/src/components/charts/`.
**Files read in full:** 21 (5 backend, 16 frontend) — see per-section citations above; 2
backend test files consulted via `grep` only (function-name enumeration sufficient, no full
read needed given mechanical shape parity with already-read sibling tests).
**Pattern extraction date:** 2026-08-21
