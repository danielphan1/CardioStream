# Phase 15: Unified Filter Surface — Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 19 (13 modified, 2 new, 4 extended test files) — no CONTEXT.md existed for this
phase (discuss-phase was skipped); file list drawn from `15-RESEARCH.md` + `15-UI-SPEC.md` §1
**Analogs found:** 19 / 19 — every file's own current implementation is the closest analog to its
future shape (this phase is overwhelmingly mechanical type-widening of existing patterns, per
RESEARCH's own framing), plus two cross-file analogs (`ShowPanel.tsx`/`ShowPanel.test.tsx` for the
plain-checkbox control and its test structure)

> **RESOLVED SCOPE NOTE — read this before using the tables below.** `15-RESEARCH.md`'s Open
> Question 1 was resolved on 2026-09-16, **after** `15-UI-SPEC.md` was written: **Option B — Time of
> Day REPLACES AM/PM entirely.** The UI-SPEC's own body text (§2, §3, §7, §8, §9) still shows the
> Option-A-coexist shape (5 groups, `amPm` present in the store). Every pattern excerpt and file
> classification below reflects the **resolved** 3-map store shape (`bpCategory`, `pulseCategory`,
> `timeOfDay` — no `amPm`), 4-group `FilterBar`, and `prompt.py`'s "mornings"/"evenings" vocabulary
> routing to `time_of_day` tokens instead of `am_pm` tokens. Where a UI-SPEC excerpt still shows
> `amPm`, treat it as the pre-resolution draft and drop that field per the RESEARCH resolution note.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/store/filters.ts` | store | transform (migration) + event-driven (setters) | itself (v1→v2 migration block, lines 91–158) | exact — self-mirror |
| `frontend/src/components/FilterBar.tsx` | component | event-driven | `frontend/src/components/ShowPanel.tsx` (plain + colored checkbox controls) + itself (date-preset group, sentence assembly) | exact for checkbox controls, self-mirror for retained parts |
| `frontend/src/components/FilterBar.test.tsx` | test | event-driven | `frontend/src/components/ShowPanel.test.tsx` (full file — no `FilterBar.test.tsx` exists today) | role-match — closest existing checkbox-group component test |
| `frontend/src/api/types.ts` | model (types) | transform | itself (`BPCategory`, `AppliedFilters`, `ResolvedFilters`) | exact — self-mirror |
| `frontend/src/lib/palette.ts` | utility | transform | itself (`CLINICAL_ORDER`/`categoryColor()`, lines 10–31) | exact — self-mirror |
| `frontend/src/lib/dates.ts` | utility | transform | itself (`resolveFilters`, lines 133–159) | exact — self-mirror |
| `frontend/src/api/client.ts` | service (HTTP client) | request-response | itself (`getJson`, lines 49–56) — **gap RESEARCH did not name explicitly** | exact — self-mirror, but requires a genuinely new capability (repeated query params) |
| `frontend/src/hooks/useStats.ts` (`useResolvedFilters`) | hook | request-response | itself (lines 29–46) | exact — self-mirror |
| `frontend/src/components/EmptyState.tsx` | component | transform | itself (lines 15–53) | exact — self-mirror |
| `frontend/src/lib/agent.ts` | service (agent bridge) | event-driven + transform | itself (`applyAgentFilters` lines 78–170, `composeConfirmation` lines 195–240) | exact — self-mirror |
| `frontend/src/store/filters.test.ts` | test | transform | itself (`"v1 → v2 migration…"` describe block, lines 275–360) | exact — self-mirror |
| `frontend/src/lib/agent.test.ts` | test | transform | itself (`describe("composeConfirmation", …)`, lines 244–285) | exact — self-mirror |
| `backend/app/deps.py` | utility (FastAPI query-filter dependency) | CRUD (SQL query building) | itself (`ReadingFilters`, lines 102–130) | exact for `bp_category`→IN-clause + new `pulse_category`; **no analog** for `time_of_day` (see No Analog Found) |
| `backend/app/schemas.py` | model (Pydantic response) | transform | itself (`ReadingOut`, lines 25–41) | exact — self-mirror |
| `backend/app/agent/schemas.py` | model (Pydantic wire schema) | transform / request-response | itself — `ShowOnly.datasets: list[DatasetToken]` (lines 157–174) for the list-of-`Literal` shape; `DashboardCommand`/`AppliedFilters` (lines 103–119, 268–287) for the fields to convert | exact — precedent already in same file |
| `backend/app/agent/service.py` | service | transform | itself (`_apply_command`, lines 196–221) | exact — self-mirror |
| `backend/app/agent/prompt.py` | config (prompt text) | transform | itself (`SYSTEM_PROMPT`, "Time-of-day filter" section lines 35–38) | exact — self-mirror |
| `backend/tests/test_api_readings.py` | test | CRUD (integration) | itself (`test_bp_category_filter_canonical_labels` lines 106–124, `test_filters_combine` lines 127–134, `test_invalid_params_return_422` lines 145–157) | exact — self-mirror |
| `backend/tests/test_derivations.py` **or** a new sibling test for the `time_of_day` boundary function | test | transform (unit) | `test_derive_am_pm_boundaries` (lines 37–49) — pattern to mirror, not the file to extend (see below) | role-match, placement is a planner decision |
| `backend/tests/test_agent_schemas.py` | test | transform | itself (`test_bp_category_case_drift_normalizes` lines 127–137) | exact — self-mirror |

## Pattern Assignments

### `frontend/src/store/filters.ts` (store, transform + event-driven)

**Analog:** itself — the file already contains the exact migration shape to mirror one version up.

**v1→v2 migration pattern to mirror as v2→v3** (lines 102–178):
```typescript
function isLegacyFilters(value: unknown): value is LegacyFilters {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.activeChart !== "string") return false;
  if (typeof v.overlayDatasets !== "object" || v.overlayDatasets === null) return false;
  const o = v.overlayDatasets as Record<string, unknown>;
  return (
    typeof o.labs === "boolean" &&
    typeof o.incidents === "boolean" &&
    typeof o.procedures === "boolean"
  );
}

function migrateLegacy(legacy: LegacyFilters & Record<string, unknown>): PersistedFilters {
  // ... maps old shape fields onto new shape fields, defaulting anything
  // that didn't exist in v1 to the safe default.
}

function readStoredFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPersistedFilters(parsed)) return parsed;
    if (isLegacyFilters(parsed)) {
      return migrateLegacy(parsed as LegacyFilters & Record<string, unknown>);
    }
    return null;
  } catch {
    return null;
  }
}
```

**What v3 needs** (per RESOLVED Option B — `amPm` is NOT part of this migration at all, only
`bpCategory` converts from a string sentinel to an array/map, plus two brand-new all-false maps):
1. Rename today's `isPersistedFilters` → `isV2Filters` (checks `bpCategory` is a **string**).
2. New `isV3Filters` (checks `bpCategory`/`pulseCategory`/`timeOfDay` are **objects** with correct
   boolean-valued keys) — mirror the existing `visibleDatasets` per-key boolean loop verbatim
   (lines 81–86 below), the exact pattern to copy for all three new maps:
   ```typescript
   if (typeof v.visibleDatasets !== "object" || v.visibleDatasets === null) return false;
   const datasets = v.visibleDatasets as Record<string, unknown>;
   for (const key of DATASET_KEYS) {
     if (typeof datasets[key] !== "boolean") return false;
   }
   ```
3. `migrateV2` maps a single `bpCategory` string onto one `true` key (never resets Chris's choice —
   the file's own governing comment, lines 92–95, states this principle explicitly and it must
   carry forward): `amPm` from the v2 blob is simply **not read at all** — it has no v3 destination.
4. Chain in `readStoredFilters`: `isV3Filters` → pass through; else `isV2Filters` → `migrateV2` +
   default the two brand-new maps; else `isLegacyFilters` (kept, not deleted — a pre-Phase-14 user
   may still have a v1 blob) → `migrateLegacy` then thread its output through `migrateV2` too (chain,
   not a hand-written v1→v3 mapper); else `null`.

**Setter/`persistCurrent` pattern to mirror** (lines 208–261) — every mutating setter ends with
`persistCurrent()`; `showAllData` (lines 277–287) resets every filter field to its default in one
`set({...})` call, the same shape `bpCategory`/`pulseCategory`/`timeOfDay` all-false resets need.

---

### `frontend/src/components/FilterBar.tsx` (component, event-driven)

**Analogs:** `frontend/src/components/ShowPanel.tsx` (checkbox controls) + itself (retained date
group, sentence assembly).

**Plain checkbox control — copy from `ShowPanel.tsx` verbatim** (lines 31–34, 56–66), this is
UI-SPEC §3's own instruction ("reuse `ShowPanel.boxClass` verbatim") and applies to both `Time of
Day` (new) and any remaining plain groups:
```typescript
const boxClass =
  "min-h-12 flex items-center gap-3 rounded-xl py-2 pl-3.5 pr-4 text-label " +
  "bg-[var(--color-mist)] text-[var(--color-depth)] " +
  "border-2 border-[var(--color-depth)] shadow-[var(--shadow-elevation)] cursor-pointer";
// ...
<label key={key} className={boxClass}>
  <input
    type="checkbox"
    checked={on}
    onChange={() => setDataset(key, !on)}
    className="h-[26px] w-[26px] flex-none cursor-pointer accent-[var(--color-brass)]"
  />
  {label}
</label>
```

**Colored-chip checkbox control** — today's BP-category group is an `aria-pressed` button
(FilterBar.tsx lines 134–169); UI-SPEC §3 gives the exact target shape (real checkbox, same
`categoryColor()` fill regardless of checked state per D-14, `boxShadow` ring on checked in addition
to the native tick). The button-to-checkbox delta:
```typescript
// TODAY (aria-pressed button, single-select — lines 142–166):
<button
  type="button"
  aria-pressed={isActive}
  onClick={() => { if (isActive) setBpCategory("all"); else setBpCategory(cat); }}
  className="min-h-12 rounded-full px-4 text-label"
  style={{ backgroundColor: categoryColor(cat), color: CHIP_TEXT,
           boxShadow: isActive ? "0 0 0 3px var(--color-depth)" : undefined }}
>
  {cat}
</button>
```
becomes a `<label>` wrapping a real `<input type="checkbox">` per UI-SPEC §3's exact markup (fill
color always solid regardless of checked state — D-14 carries forward unchanged, never dim/gray the
unchecked state).

**Retained pattern — date-preset group is UNCHANGED** (lines 82–111): exclusive `aria-pressed`
buttons stay exactly as-is; do not convert.

**Retained pattern — D-08 agent pulse flash** (lines 57–64, `pulseClass` helper) applies unchanged
to every group including the two new ones — `PulseField` just grows two members (`"timeOfDay"`,
`"pulseCategory"`) per `lib/agent.ts`'s contract.

**Sentence assembly to extend** (lines 69–77) — today builds a 3-part `sentenceParts` array; UI-SPEC
§7 locks the target as `{datePhrase} · {timeOfDayPhrase} · {bpCategoryPhrase} · {pulseCategoryPhrase}`
(4 segments under the resolved no-`amPm` shape), each collapsing to "All …" under the zero-or-all
convention and using `joinWithAnd` for a strict subset — same shape as the `composeConfirmation`
suffix pattern below, so the same helper should back both call sites (see Shared Patterns).

**Groups removed under RESOLVED Option B:** the `AM/PM` `role="group" aria-label="Time of day"`
block (lines 113–130) is **replaced**, not kept alongside the new `Time of Day` group — its
`aria-label="Time of day"` is reused by the new 4-bucket group per UI-SPEC §3's own note that group 3
claims that label.

---

### `frontend/src/components/FilterBar.test.tsx` (test, event-driven) — NEW FILE

**Analog:** `frontend/src/components/ShowPanel.test.tsx` (full file) — the closest existing
component test for a checkbox-group control surface; no `FilterBar.test.tsx` exists today
(`FilterBar.tsx` is currently only exercised indirectly via `smoke.test.tsx`).

**Structural patterns to mirror** (line ranges from `ShowPanel.test.tsx`):
```typescript
describe("ShowPanel checkbox group", () => {
  it("renders exactly five real checkboxes, one per dataset", () => {
    const boxes = screen.getAllByRole("checkbox");
    // ...
    expect(screen.getByRole("checkbox", { name: label })).toBeTruthy();
  });

  it("reflects store state as checked/unchecked", () => { /* ... */ });
  it("ticking a box turns that dataset on and leaves the others alone", () => {
    fireEvent.click(screen.getByRole("checkbox", { name: "Labs" }));
    // assert store state
  });
  it("every label meets the 48px target floor", () => { /* getBoundingClientRect or class assertion */ });
});

describe("agent pulse parity (D-08)", () => {
  it("rings the group when the agent touches datasets", () => { /* ... */ });
  it("does not ring for an unrelated field", () => { /* ... */ });
});
```
Apply this same `describe` structure per new/converted group (`Time of Day`, `BP Category`,
`Pulse Category`) plus a dedicated block for the zero-or-all sentence collapse (0 checked and ALL
checked both render `"All …"` — this is FilterBar-specific, not something `ShowPanel.test.tsx` needs
to cover since ShowPanel has no such convention).

---

### `frontend/src/api/types.ts` (model, transform)

**Analog:** itself — `BPCategory` union (lines 7–13) is the exact shape to mirror for the two new
unions; `AppliedFilters`/`ResolvedFilters` are the exact shapes to widen.

**Union type to mirror twice** (lines 7–13):
```typescript
export type BPCategory =
  | "Hypotension" | "Normal" | "Elevated" | "Stage 1" | "Stage 2" | "Hypertensive Crisis";
```
→ add `PulseCategory = "Bradycardia" | "Normal" | "Tachycardia"` and
`TimeOfDayBucket = "Morning" | "Afternoon" | "Evening" | "Night"`.

**`ResolvedFilters` to widen** (lines 133–138) — drop `am_pm`, widen `bp_category` to an array, add
two new array fields:
```typescript
// TODAY:
export type ResolvedFilters = {
  start_date?: string;
  end_date?: string;
  am_pm?: "AM" | "PM";
  bp_category?: BPCategory;
};
// TARGET (resolved Option B — no am_pm):
export type ResolvedFilters = {
  start_date?: string;
  end_date?: string;
  bp_category?: BPCategory[];
  pulse_category?: PulseCategory[];
  time_of_day?: TimeOfDayBucket[];
};
```

**`AppliedFilters` to widen** (lines 172–195) — same treatment; `amPm?: "all"|"AM"|"PM"|null` is
dropped entirely, `bpCategory` becomes list-typed, `pulseCategory`/`timeOfDay` are added following
the exact `datasetsOn?: SeriesDataset[] | null` precedent already in this type (line 186).

**`Reading.pulse_category` tightening** (line 23) — currently loose `string`; UI-SPEC's own
component-inventory table calls for `pulse_category: PulseCategory` here, mirroring how `bp_category`
already uses the `BPCategory` union at line 22.

---

### `frontend/src/lib/palette.ts` (utility, transform)

**Analog:** itself, in full (34 lines) — this is the exact three-piece pattern (`CLINICAL_ORDER`
array, `Record<Category,string>` var map, thin `categoryColor()` getter) to copy for Pulse Category:
```typescript
export const CLINICAL_ORDER: BPCategory[] = [
  "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis",
];

const CATEGORY_VARS: Record<BPCategory, string> = {
  Hypotension: "var(--cat-hypotension)",
  // ...
};

export function categoryColor(cat: BPCategory): string {
  return CATEGORY_VARS[cat];
}

export const CHIP_TEXT = "var(--cat-chip-text)";
```
UI-SPEC's Color section (§ Pulse Category — reuse existing tokens) pins the exact three CSS vars to
reuse — `--ref-bradycardia`, `--cat-normal`, `--cat-elevated` — **zero new CSS custom properties**,
so `PULSE_CLINICAL_ORDER`/`pulseCategoryColor()` are thin wrappers over vars that already exist in
`index.css`, not new tokens.

---

### `frontend/src/lib/dates.ts` (utility, transform)

**Analog:** itself — `resolveFilters` (lines 133–159) is the function to extend; `FilterDateState`
(lines 24–29) is the type to widen.

**Zero-or-all omission pattern already exists for the singular case — extend to lists:**
```typescript
// TODAY (lines 155–156, singular sentinel-based omission):
if (state.amPm !== "all") resolved.am_pm = state.amPm;
if (state.bpCategory !== "all") resolved.bp_category = state.bpCategory;
```
becomes (per RESEARCH Focus Answer 2's frontend-side half of the empty-`IN` guard — omit the query
key entirely when 0 or ALL keys are selected, not just when 0 are):
```typescript
const selectedKeys = <K extends string>(m: Record<K, boolean>): K[] =>
  (Object.keys(m) as K[]).filter((k) => m[k]);

function selectedOrOmit<K extends string>(m: Record<K, boolean>, totalKeys: number): K[] | undefined {
  const on = selectedKeys(m);
  return on.length === 0 || on.length === totalKeys ? undefined : on;
}
// resolved.bp_category = selectedOrOmit(state.bpCategory, CLINICAL_ORDER.length);
```
This `selectedOrOmit`-shaped helper is the same zero-or-all collapse needed independently in
`FilterBar.tsx`'s sentence, `EmptyState.tsx`'s clause builder, and `lib/agent.ts`'s suffix builders —
RESEARCH explicitly flags this as a "don't hand-roll four times" dedup opportunity (see Shared
Patterns below). `lib/dates.ts` is a reasonable single home for it, mirroring how this file is
already "the ONE module all dashboard plans use for dates" (file's own header comment, line 3).

**`FilterDateState` to widen** (lines 24–29) — drop `amPm`, widen `bpCategory` to `Record<BPCategory,
boolean>`, add `pulseCategory`/`timeOfDay` maps — same shape change as `store/filters.ts`'s
`PersistedFilters`/`FilterState`, since this type exists specifically to describe "the date-relevant
slice of the filter store."

---

### `frontend/src/api/client.ts` (service/HTTP client, request-response) — gap not named in RESEARCH

**Analog:** itself — `getJson` (lines 49–56).

**The genuinely new capability this phase needs here:** `getJson`'s `params` type is
`Record<string, string | undefined>` and builds the query string with `search.set(key, value)` —
**one value per key**. FastAPI's repeated-query-param convention for `list[Literal[...]]` fields
(confirmed in RESEARCH Focus Answer 2) requires `?bp_category=Stage%201&bp_category=Stage%202` — the
SAME key repeated, which `URLSearchParams.set` cannot produce (it overwrites). This file was not
named in `15-RESEARCH.md`'s file list but is load-bearing: without this change, a multi-value
`ResolvedFilters.bp_category` array serializes as only its last element.

```typescript
// TODAY (lines 49–56):
export async function getJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  // ...
}
```
**Target shape** — widen the value type to accept `string[]` and `.append()` once per list item
(never `.set()` for the array branch, and never join with a comma — FastAPI does not parse
comma-joined values as a list for this parameter style):
```typescript
export async function getJson<T>(
  path: string,
  params?: Record<string, string | string[] | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, v);
    } else {
      search.set(key, value);
    }
  }
  // ...
}
```
`getReadings`/`getStatsSummary` (lines 156–164) call sites are unaffected — they already just pass
`ResolvedFilters` straight through to `getJson`, so widening `ResolvedFilters.bp_category` etc. to
arrays flows through automatically once `getJson`'s param type accepts arrays.

---

### `frontend/src/hooks/useStats.ts` — `useResolvedFilters` (hook, request-response)

**Analog:** itself, in full (lines 29–46).

```typescript
export function useResolvedFilters(): ResolvedFilters {
  const datePreset = useFilters((s) => s.datePreset);
  const customRange = useFilters((s) => s.customRange);
  const amPm = useFilters((s) => s.amPm);           // DROP under resolved Option B
  const bpCategory = useFilters((s) => s.bpCategory); // becomes a Record<BPCategory, boolean>
  // ...
  return resolveFilters(
    { datePreset, customRange, amPm, bpCategory },
    anchor?.latest_reading ?? null,
  );
}
```
Target: drop the `amPm` subscription, add `pulseCategory`/`timeOfDay` subscriptions (same
`useFilters((s) => s.X)` selector pattern), and pass the widened object into `resolveFilters` — no
other structural change (the `anchor` query and `staleTime: Infinity` latest-reading-anchor logic is
untouched).

---

### `frontend/src/components/EmptyState.tsx` (component, transform)

**Analog:** itself, in full (64 lines).

```typescript
type EmptyStateProps = {
  latestReading: string | null;
  amPm: "all" | "AM" | "PM";          // DROP under resolved Option B
  bpCategory: string;                  // becomes a selection-map-derived clause
  presetLabel: string;
};
// ...
const amPmSegment = amPm === "all" ? "" : `${amPm} `;
const categoryClause = bpCategory === "all" ? "" : ` in ${bpCategory}`;
```
Target per UI-SPEC §8: props become the selection maps (`timeOfDay`, `bpCategory`, `pulseCategory` —
no `amPm` prop), and each clause builder follows the same ternary-to-empty-string shape shown above,
using the shared zero-or-all helper (see `lib/dates.ts` above / Shared Patterns) instead of a
string-sentinel check, since the underlying state is no longer `"all" | X` but a boolean map.

---

### `frontend/src/lib/agent.ts` (service/agent bridge, event-driven + transform)

**Analog:** itself, in full (240 lines) — `PulseField` (lines 27–32), `applyAgentFilters` (lines
78–170), `composeConfirmation` (lines 195–240).

**`PulseField` union to widen** (lines 27–32):
```typescript
export type PulseField = "chart" | "dateRange" | "amPm" | "bpCategory" | "datasets";
```
→ drop `"amPm"`, add `"timeOfDay"` and `"pulseCategory"` (UI-SPEC §3 confirms: "`PulseField` grows
two members... same 1500ms `motion-safe:animate-pulse` + static ring fallback").

**`applyAgentFilters` present-value-delta pattern to mirror** (lines 129–136) — this exact shape,
`!= null` guard (never truthiness — `"all"`/empty-array are valid present values) then `touched.add`:
```typescript
if (f.amPm != null) {           // pattern to mirror for pulseCategory/timeOfDay,
  s.setAmPm(f.amPm);            // but f.amPm itself is REMOVED (resolved Option B)
  touched.add("amPm");
}
if (f.bpCategory != null) {
  s.setBpCategory(f.bpCategory); // becomes list-aware: s.setBpCategory(f.bpCategory) where
  touched.add("bpCategory");     // f.bpCategory is now BPCategory[] and the store setter
}                                 // replaces the whole map from the array
```
Also update the `hasOtherCommand` disjunction (lines 90–100, `f.amPm != null` at line 95) and the
`f.reset` branch's `touched.add("amPm")` (line 109) — both need the same drop/rename treatment.

**`composeConfirmation` suffix pattern to mirror and multiply** (lines 234–239):
```typescript
// TODAY — scalar, at most one suffix per group:
const ampmSuffix =
  state.amPm === "AM" ? ", mornings" : state.amPm === "PM" ? ", evenings" : "";
const categorySuffix =
  state.bpCategory !== "all" ? `, ${state.bpCategory} readings only` : "";
```
Target shape (UI-SPEC §9, using the already-imported `joinWithAnd` from `lib/showSentence.ts`,
line 20 of this file):
```typescript
const selected = (m: Record<string, boolean>) => Object.keys(m).filter((k) => m[k]);

const bpCategorySuffix = (() => {
  const on = selected(state.bpCategory);
  if (on.length === 0 || on.length === CLINICAL_ORDER.length) return "";
  return `, ${joinWithAnd(on)} blood pressure`;
})();
// pulseCategorySuffix, timeOfDaySuffix follow the same shape.
```
`ampmSuffix` is **deleted entirely** under resolved Option B — `timeOfDaySuffix` takes its place in
the template string, with `"mornings"`/`"evenings"` wording preserved per UI-SPEC §9's table
(`", mornings"` for Morning-only, etc.), routed through the new multi-select shape instead of the old
scalar one.

---

### `frontend/src/store/filters.test.ts` (test, transform)

**Analog:** itself — `describe("v1 → v2 migration of pre-Phase-14 persisted filters", …)` (lines
275–360) is the exact sibling-`describe`-block structure to copy for `"v2 → v3 migration"`:
```typescript
describe("v1 → v2 migration of pre-Phase-14 persisted filters", () => {
  const legacy = (activeChart: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ activeChart, datePreset: "30d", /* ... */ amPm: "PM", bpCategory: "Stage 1",
      overlayDatasets: { labs: true, incidents: false, procedures: true }, ...extra });

  it("bp_timeline becomes the timeline with blood pressure only", () => {
    localStorage.setItem("hv-filters", legacy("bp_timeline"));
    useFilters.getState().initFilters();
    const s = useFilters.getState();
    expect(s.chartView).toBe("timeline");
    // ...
  });
  // ... one `it` per legacy field mapping, plus a "rejects wrong type" guard test.
});
```
**Load-bearing existing-test risk RESEARCH flags** (Focus Answer 1, point 5): this exact block's
line 334 (`expect(s.amPm).toBe("PM")`) currently asserts the OLD scalar shape. Once v2→v3 exists,
`initFilters()` chains v1→v2→v3, so this assertion's target shape changes. Since `amPm` is dropped
entirely under resolved Option B, this specific assertion should be **removed** (not converted to
`s.bpCategory.X === true`), while the `bpCategory` assertion on the same line needs updating from
`.toBe("Stage 1")` to the v3 map-membership form.

---

### `frontend/src/lib/agent.test.ts` (test, transform)

**Analog:** itself — `describe("composeConfirmation", …)` (lines 244–285):
```typescript
it("emits the VOICE-06/D-07 canonical string exactly", () => {
  expect(
    composeConfirmation(confState({ datePreset: "30d", amPm: "AM" }), null),
  ).toBe("Showing blood pressure, last 30 days, mornings");
});

it("composes pulse + PM + category suffix from all data", () => {
  expect(
    composeConfirmation(
      confState({ visibleDatasets: {/*...*/}, datePreset: "all", amPm: "PM", bpCategory: "Stage 2" }),
      null,
    ),
  ).toBe("Showing pulse, all data, evenings, Stage 2 readings only");
});
```
Mirror this `confState({...})` + literal-string-equality pattern for the multi-select suffix
builders — one test per zero-or-all collapse, one per strict-subset join, one combining
`timeOfDay`+`bpCategory`+`pulseCategory` all at once (UI-SPEC §9's worked example is the string to
assert verbatim: `"Showing blood pressure and pulse, last 30 days, mornings, Stage 1 and Stage 2
blood pressure, Tachycardia pulse"`).

---

### `backend/app/deps.py` (utility/FastAPI dependency, CRUD)

**Analog:** itself — `ReadingFilters` (lines 102–130) is both the pattern to convert (`bp_category`)
and the pattern to copy verbatim for the new `pulse_category` field; `time_of_day` has no analog in
this file or anywhere else in the codebase (see No Analog Found).

**Existing scalar-equality pattern to convert to `IN`-clause list filtering:**
```python
class ReadingFilters(DateRangeFilters):
    _model = Reading
    _field = "datetime_"

    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        am_pm: Annotated[Literal["AM", "PM"] | None, Query()] = None,
        bp_category: Annotated[BPCategory | None, Query()] = None,
    ) -> None:
        super().__init__(start_date, end_date)
        self.am_pm = am_pm
        self.bp_category = bp_category

    def apply(self, stmt: Select) -> Select:
        stmt = super().apply(stmt)
        if self.am_pm:
            stmt = stmt.where(Reading.am_pm == self.am_pm)
        if self.bp_category:
            stmt = stmt.where(Reading.bp_category == self.bp_category)
        return stmt
```
**Target shape** (RESEARCH Focus Answer 2 — verified fresh pattern, no existing `.in_()` anywhere in
`backend/app`):
```python
PulseCategory = Literal["Bradycardia", "Normal", "Tachycardia"]  # NEW — mirrors BPCategory exactly

class ReadingFilters(DateRangeFilters):
    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        bp_category: Annotated[list[BPCategory] | None, Query()] = None,
        pulse_category: Annotated[list[PulseCategory] | None, Query()] = None,   # NEW
        time_of_day: Annotated[list[TimeOfDayBucket] | None, Query()] = None,    # NEW
    ) -> None:
        super().__init__(start_date, end_date)
        self.bp_category = bp_category
        self.pulse_category = pulse_category
        self.time_of_day = time_of_day

    def apply(self, stmt: Select) -> Select:
        stmt = super().apply(stmt)
        if self.bp_category:           # truthy guard — [] and None both falsy,
            stmt = stmt.where(Reading.bp_category.in_(self.bp_category))  # both "no restriction"
        if self.pulse_category:
            stmt = stmt.where(Reading.pulse_category.in_(self.pulse_category))
        if self.time_of_day:
            stmt = stmt.where(_time_of_day_predicate(self.time_of_day))
        return stmt
```
**`am_pm` disposition — flagged for the planner, not resolved here:** the RESEARCH excerpt above
(written before the Option B resolution note was appended) still shows `am_pm` converting to a list
filter alongside `bp_category`. The resolution note only says the **frontend/agent surface** drops
`amPm`; it does not explicitly say whether the backend query parameter itself is deleted, deprecated,
or simply left unconverted (still scalar, still functional, just unreachable from the UI). The
`Reading.am_pm` **column** and `ReadingOut.am_pm` **response field** are unaffected either way (still
ETL-derived, still returned) — only the *filter* parameter's fate is ambiguous. Decide explicitly at
plan time; do not let it fall out silently.

**The sharp edge (both ends of this pattern):** SQLAlchemy's `.in_([])` compiles to an always-false
predicate — the *opposite* of this phase's zero-or-all convention. The `if self.field:` truthy guard
shown above is the correctness mechanism (`None` and `[]` are both falsy in Python) — not optional
style.

**Time-of-day predicate — build fresh, midnight-wrap pitfall:**
```python
TimeOfDayBucket = Literal["Morning", "Afternoon", "Evening", "Night"]

_TIME_OF_DAY_HOURS: dict[TimeOfDayBucket, tuple[int, int]] = {
    "Morning": (5, 11),
    "Afternoon": (12, 16),
    "Evening": (17, 20),
    "Night": (21, 4),  # wraps midnight — handled specially below, NOT a BETWEEN
}

def _time_of_day_predicate(buckets: list[TimeOfDayBucket]):
    hour = extract("hour", Reading.datetime_)
    clauses = []
    for b in buckets:
        lo, hi = _TIME_OF_DAY_HOURS[b]
        if b == "Night":
            clauses.append(or_(hour >= lo, hour < 5))
        else:
            clauses.append(hour.between(lo, hi))
    return or_(*clauses)
```
`extract('hour', ...)` compiles correctly on both SQLite (dev) and Postgres (prod) via SQLAlchemy's
dialect-aware compiler — no dialect-specific code needed (CLAUDE.md's cross-DB portability
constraint).

---

### `backend/app/schemas.py` (model, transform)

**Analog:** itself — `ReadingOut` (lines 25–41).

**Current state — both fields are loose `str`, NOT yet `Literal`-typed** (a detail the UI-SPEC's
component-inventory table understates — it names only `pulse_category` as needing tightening, but
`am_pm`/`bp_category` are equally loose today):
```python
class ReadingOut(BaseModel):
    # ...
    am_pm: str
    bp_category: str
    pulse_category: str
```
UI-SPEC's instruction: `pulse_category: str → Literal["Bradycardia","Normal","Tachycardia"]`,
matching how `deps.py`'s `BPCategory` `Literal` already exists (but note: `ReadingOut.bp_category`
itself is currently NOT that `Literal` — only the *query-param* type is). Tightening
`ReadingOut.pulse_category` is in explicit scope; tightening `bp_category`/`am_pm` to match is not
required by this phase but would be a consistent, low-risk sibling change if the planner chooses to
fold it in (flag, don't silently expand scope).

---

### `backend/app/agent/schemas.py` (model, transform / request-response)

**Analog:** itself — `ShowOnly.datasets: list[DatasetToken]` (lines 157–174) is a direct,
already-shipped precedent for the list-of-`Literal` shape this phase needs three more times.

**The precedent to mirror exactly:**
```python
class ShowOnly(BaseModel):
    """... service._apply_show_only rejects an empty list locally rather than
    applying a delta that would blank the dashboard."""
    action: Literal["show_only"]
    datasets: list[DatasetToken]
```
And the lowercasing/case-insensitivity mechanism that ALREADY covers list fields generically, no
change needed (lines 221–237):
```python
def _lower_value(key: str, val: object) -> object:
    """... The list branch is load-bearing for ShowOnly.datasets: the structured
    outputs docs require enum values be compared case-insensitively..."""
    if key == "question":
        return val
    if isinstance(val, str):
        return val.lower()
    if isinstance(val, dict):
        return {k: _lower_value(k, sub) for k, sub in val.items()}
    if isinstance(val, list):
        return [_lower_value(key, item) for item in val]
    return val
```

**`DashboardCommand` fields to convert** (lines 103–119):
```python
# TODAY:
am_pm: Literal["all", "am", "pm"] | None = None
bp_category: BPCategoryToken | None = None
```
→ per RESOLVED Option B, `am_pm` is **removed** (not converted), `bp_category` becomes
`list[BPCategoryToken] | None`, and `pulse_category: list[PulseCategoryToken] | None` /
`time_of_day: list[TimeOfDayToken] | None` are added — mirroring `datasets: list[DatasetToken] |
None` (line 114) exactly, which already coexists correctly in this same model.

**The "all"-clear-signal design fork — genuinely new, not a mirror (RESEARCH Focus Answer 3):**
today `am_pm`/`bp_category` use an `"all"` token to mean "clear this filter" as a value distinct from
`None` ("don't mention it, carry over"). A bare `list[BPCategoryToken] | None` loses that third
state. RESEARCH recommends (but does not mandate) a sibling boolean flag, mirroring how `reset: bool
= False` (line 118) already coexists with the rest of this model's optional fields:
```python
bp_category: list[BPCategoryToken] | None = None
bp_category_all: bool = False   # NEW — "go back to all categories" clear signal
```
`service.py`'s `_apply_command` would map `bp_category_all=True` → `AppliedFilters.bpCategory = []`
(the store's own empty-map "clear" representation). This is a **plan-time decision, not a fact to
copy** — flagged here per RESEARCH, not resolved.

**`AppliedFilters` mirror** (lines 268–287) — same treatment: `amPm` field removed, `bpCategory`
list-typed, `pulseCategory`/`timeOfDay` list fields added, following the exact
`datasetsOn?: list[DatasetToken] | None` precedent already in this model (line 282).

**Token→label maps to extend per-element, not whole-list** (lines 304–315):
```python
BP_TOKEN_TO_LABEL: dict[str, str] = {
    "all": "all", "hypotension": "Hypotension", # ...
}
```
Usage changes from a single dict lookup to a per-element list comprehension — see `service.py` below.

---

### `backend/app/agent/service.py` (service, transform)

**Analog:** itself — `_apply_command` (lines 196–221).

**Single-token lookup pattern to convert to per-element list comprehension:**
```python
# TODAY (lines 209–212):
if cmd.am_pm is not None:
    filters.amPm = AMPM_TOKEN_TO_LABEL[cmd.am_pm]  # type: ignore[assignment]
if cmd.bp_category is not None:
    filters.bpCategory = BP_TOKEN_TO_LABEL[cmd.bp_category]  # type: ignore[assignment]
```
Target (RESEARCH Focus Answer 3): `cmd.am_pm` branch is **removed**; `cmd.bp_category` becomes:
```python
if cmd.bp_category is not None:
    filters.bpCategory = [BP_TOKEN_TO_LABEL[t] for t in cmd.bp_category]
# pulse_category / time_of_day follow the same per-element mapping shape.
```
**Existing list-handling precedent already in this same function to copy** (lines 213–217, the
`cmd.datasets` branch — de-duplication via `dict.fromkeys`):
```python
if cmd.datasets:
    filters.datasetsOn = list(dict.fromkeys(cmd.datasets))
```

**Empty-list-is-not-"clear" precedent, for the "all"-clear-signal design** (`_apply_show_only`, lines
240–265) — the existing guard style to copy if/when `bp_category_all`-style flags are implemented:
```python
def _apply_show_only(cmd: ShowOnly) -> AgentReply:
    """Empty-list guard: structured outputs cannot express minItems..."""
    if not cmd.datasets:
        return AgentReply(kind="unclear", message=UNCLEAR_MESSAGE)
    datasets = list(dict.fromkeys(cmd.datasets))
    filters = AppliedFilters(showOnly=datasets)
    return AgentReply(kind="applied", filters=filters, message=show_only_message(datasets), context=None)
```

---

### `backend/app/agent/prompt.py` (config/prompt text, transform)

**Analog:** itself — the "Time-of-day filter" section (lines 35–38) needs a full rewrite, not a
patch, per the RESOLVED Option B decision:
```python
# TODAY:
Time-of-day filter:
- "mornings", "AM" -> am
- "evenings", "afternoons", "nights", "PM" -> pm
- "all times", "both" -> all
```
Target: four-bucket vocabulary routing directly to `time_of_day` tokens (`morning`/`afternoon`/
`evening`/`night`) instead of the two-bucket `am`/`pm` — per the resolution note's own instruction
("`prompt.py`'s existing 'mornings'→am, 'evenings'→pm vocabulary routes to the new `time_of_day`
tokens (`morning`/`evening`) instead").

**New vocabulary needed for `pulse_category`** (no existing section to convert — this is additive,
following the exact style of the adjacent "Blood-pressure category filter tokens" line, line 40):
```python
Blood-pressure category filter tokens: all, hypotension, normal, elevated,
stage_1, stage_2, hypertensive_crisis.
```
→ add a sibling line: `Pulse category filter tokens: bradycardia, normal, tachycardia.` with example
synonyms ("bradycardia"/"low pulse"/"slow heart rate" → `bradycardia`; "tachycardia"/"high pulse"/
"racing heart" → `tachycardia`), matching this file's established natural-language-to-token style.

**Routing-rules section to check** (lines 102–116) — "Partial commands: set ONLY the fields the user
mentioned; leave everything else null" already generalizes correctly to list-typed fields with no
prompt change needed there.

---

### `backend/tests/test_api_readings.py` (test, CRUD integration)

**Analog:** itself — three existing tests are the direct patterns to extend, not rewrite:

```python
@pytest.mark.parametrize(
    ("label", "expected_count"),
    [("Normal", 1), ("Stage 1", 1), ("Stage 2", 1), ("Hypertensive Crisis", 1),
     ("Hypotension", 1), ("Elevated", 0)],
)
def test_bp_category_filter_canonical_labels(client, seeded, label, expected_count) -> None:
    r = client.get("/readings", params={"bp_category": label})
    assert r.status_code == 200
    body = r.json()
    assert len(body) == expected_count
    assert all(item["bp_category"] == label for item in body)

def test_filters_combine(client, seeded) -> None:
    r = client.get("/readings", params={"am_pm": "AM", "bp_category": "Stage 2"})
    # ...

@pytest.mark.parametrize("params", [
    {"am_pm": "MORNING"}, {"bp_category": "stage 1"}, {"bp_category": "Crisis"},
    {"start_date": "not-a-date"}, {"end_date": "2025-13-45"},
])
def test_invalid_params_return_422(client, seeded, params: dict) -> None:
    r = client.get("/readings", params=params)
    assert r.status_code == 422
```
**New test cases needed** (RESEARCH's own test map, PH15-05/PH15-05b/PH15-03b):
- OR-within-group: `client.get("/readings", params=[("bp_category", "Stage 1"), ("bp_category",
  "Stage 2")])` (httpx `TestClient` needs a list-of-tuples or `params={"bp_category": ["Stage 1",
  "Stage 2"]}` — verify which form this project's pinned httpx/TestClient version accepts) → both
  categories' rows returned.
- Empty-selection-means-all-rows regression (Open Question 3): confirm `GET /readings` with NO
  `bp_category` param returns every row — already covered by
  `test_no_filters_returns_all_rows_ordered_ascending` (line 55) as a baseline, but add an explicit
  assertion this stays true once the param becomes list-typed.
- Midnight-wrap `time_of_day` case: a reading at 23:00 and a reading at 03:00 both match `"Night"`; a
  reading at 04:00 does NOT.

---

### `backend/tests/test_derivations.py` (or new sibling — placement is a planner decision)

**Analog:** `test_derive_am_pm_boundaries` (lines 37–49) — the exact parametrize-over-boundary-hour
pattern to mirror for the new time-of-day boundary function:
```python
@pytest.mark.parametrize(
    ("dt", "expected"),
    [
        (datetime(2025, 3, 1, 0, 0), "AM"),
        (datetime(2025, 3, 1, 11, 59), "AM"),
        (datetime(2025, 3, 1, 12, 0), "PM"),
        (datetime(2025, 3, 1, 23, 59), "PM"),
    ],
)
def test_derive_am_pm_boundaries(dt: datetime, expected: str) -> None:
    assert dt.tzinfo is None
    assert derive_am_pm(dt) == expected
```
**Placement flag (RESEARCH Focus Answer 5, explicit):** `derivations.py`'s own module docstring
states "Categories are computed here and ONLY here" and describes values computed **at ETL/ingestion
time**. Time-of-day is deliberately query-time-only (never stored), so adding it to `derivations.py`
would misrepresent it as an ingestion-time derivation. Recommend a small sibling pure function
(boundary constants + classifier), colocated with or near `deps.py`, with its own test file/section
and a comment cross-referencing why it is NOT in `derivations.py` — this placement is a planner
decision, not resolved here. Required test boundary cases per UI-SPEC §11: 20:59 (Evening), 21:00
(Night), 04:59 (Night), 05:00 (Morning) — the exact same "boundary just before / boundary exactly at"
shape as the AM/PM test above.

---

### `backend/tests/test_agent_schemas.py` (test, transform)

**Analog:** itself — `test_bp_category_case_drift_normalizes` (lines 127–137):
```python
@pytest.mark.parametrize(
    "raw, expected_category",
    [
        ({"action": "command", "bp_category": "Stage_1"}, "stage_1"),
        ({"action": "command", "bp_category": "HYPERTENSIVE_CRISIS"}, "hypertensive_crisis"),
        ({"action": "command", "bp_category": "Normal"}, "normal"),
    ],
)
def test_bp_category_case_drift_normalizes(raw, expected_category):
    out = AgentOutput.model_validate({"result": raw})
    assert out.result.bp_category == expected_category
```
Once `bp_category` is list-typed, this needs a parallel test asserting list-element-wise lowercasing
(e.g. `{"bp_category": ["Stage_1", "NORMAL"]}` → `["stage_1", "normal"]`), which exercises the
already-generic list branch of `_lower_value` (schemas.py lines 235–236) — no new normalizer logic
needed, just a new test proving the existing mechanism covers the new field shape. Also update/remove
`test_am_pm_case_drift_normalizes` (line 140) since the `am_pm` field is dropped under resolved
Option B — this specific existing test will fail once the field is removed and needs deletion, not
modification.

## Shared Patterns

### Zero-or-all collapse (new cross-cutting helper this phase should extract)
**Source pattern:** the singular sentinel check already in `lib/dates.ts` (`state.amPm !== "all"`)
and `lib/agent.ts` (`state.bpCategory !== "all"`), generalized to `on.length === 0 || on.length ===
totalKeys` for the new map-based shape.
**Apply to:** `FilterBar.tsx`'s live sentence, `EmptyState.tsx`'s clause builder, `lib/agent.ts`'s
`composeConfirmation` suffixes — RESEARCH explicitly flags this as a "don't hand-roll four times"
opportunity (Focus Answer 4), consistent with this codebase's own STATE.md-documented preference for
this kind of consolidation (the `260913-fdm` audit-fix entry did the same kind of dedup previously).
```typescript
function selectedOrAll<K extends string>(m: Record<K, boolean>, allLabel: string): string[] | typeof allLabel {
  const on = Object.keys(m).filter((k) => m[k as K]);
  return on.length === 0 || on.length === Object.keys(m).length ? allLabel : on;
}
```

### `joinWithAnd` spoken/written list grammar — reuse verbatim, do not reimplement
**Source:** `frontend/src/lib/showSentence.ts`, lines 15–19 (already imported into `lib/agent.ts`,
line 20, and used by `datasetsPhrase`, lines 181–185).
```typescript
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
```
**Apply to:** every new multi-select join in `FilterBar.tsx`'s sentence, `EmptyState.tsx`'s clauses,
and `lib/agent.ts`'s suffixes — deliberately NO Oxford comma (spoken text), do not "fix" with
`Intl.ListFormat`.

### FastAPI list-`Query()` + SQLAlchemy `.in_()` truthy guard — the empty-list correctness mechanism
**Source:** none existing (new pattern, RESEARCH Focus Answer 2) — build per the `deps.py` excerpt
above.
**Apply to:** every one of `deps.py`'s new/converted list filters (`bp_category`, `pulse_category`,
`time_of_day`, and `am_pm` if the planner chooses to convert it too). `if self.field:` before every
`.where(...).in_(...)` call — `None` and `[]` are both falsy in Python, so this single-line guard is
the entire correctness mechanism preventing an empty selection from zeroing out every result.

### Structured-outputs case-insensitive list lowercasing — already generic, zero changes needed
**Source:** `backend/app/agent/schemas.py`, `_lower_value` (lines 221–237), list branch already
documented as "load-bearing for `ShowOnly.datasets`."
**Apply to:** `bp_category`, `pulse_category`, `time_of_day` on `DashboardCommand` automatically,
once they're declared as `list[Literal[...]]` fields — no code change to the validator itself.

## No Analog Found

| File / Capability | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/deps.py` — `time_of_day` SQL predicate (`extract('hour', ...)` + midnight-wrap `OR`) | utility | CRUD | The first query-time-only derived value in this codebase — every existing derivation (`am_pm`, `bp_category`, `pulse_category`, MAP, pulse pressure) is computed once at ETL/ingestion time in `derivations.py` and stored as a column. No existing SQL predicate of this shape to copy; built fresh per RESEARCH Focus Answer 2, verified against current SQLAlchemy/FastAPI documentation rather than a codebase precedent. |
| `backend/app/agent/schemas.py` — the "all"-clear-signal design (sibling `*_all: bool` flag vs. retained `"all"` list sentinel) | model | transform | A genuine design fork, not a fact to mirror — `ShowOnly.datasets` (the closest analog) never needed a "clear back to previous" mechanism because it has no `"all"` concept in the first place. RESEARCH recommends the sibling-boolean-flag option but flags it explicitly as a judgment call (Assumption A4), not a settled precedent. |

## Metadata

**Analog search scope:** `frontend/src/{store,components,lib,hooks,api}`, `backend/app/{,agent}`,
`backend/tests`, `frontend/src/{store,lib,components}/*.test.ts(x)` — scoped directly from the file
list in `15-RESEARCH.md`'s Component Inventory (§1) and Phase Requirements table, cross-checked
against actual repo contents via `find`/`grep`.
**Files scanned:** 19 target files read in full (all ≤ 400 lines; no file required targeted
offset/limit reads) + 3 additional analog-only files read in full (`ShowPanel.tsx`,
`ShowPanel.test.tsx`, `showSentence.ts`) + 2 files discovered via cross-reference not named in
RESEARCH's file list (`api/client.ts`, `hooks/useStats.ts`'s `useResolvedFilters`).
**Pattern extraction date:** 2026-09-16
