---
status: issues
files_reviewed:
  - backend/app/agent/prompt.py
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/tests/test_agent_schemas.py
  - backend/tests/test_agent_service.py
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/components/ChartDeck.tsx
  - frontend/src/components/OverlayEventsList.test.tsx
  - frontend/src/components/OverlayEventsList.tsx
  - frontend/src/components/OverlayToggle.test.tsx
  - frontend/src/components/OverlayToggle.tsx
  - frontend/src/components/charts/BPTimeline.tsx
  - frontend/src/components/charts/PulseTrend.tsx
  - frontend/src/hooks/useCreateRecord.ts
  - frontend/src/hooks/useIncidents.ts
  - frontend/src/hooks/useLabs.ts
  - frontend/src/hooks/useProcedures.ts
  - frontend/src/index.css
  - frontend/src/lib/agent-parity.test.ts
  - frontend/src/lib/agent.test.ts
  - frontend/src/lib/agent.ts
  - frontend/src/lib/overlayEvents.test.ts
  - frontend/src/lib/overlayEvents.ts
  - frontend/src/lib/overlayMeta.ts
  - frontend/src/store/filters.test.ts
  - frontend/src/store/filters.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
---

# Phase 09 Code Review — Multi-Dataset Overlay & Filtering

## Summary

The backend agent extension (`ToggleDataset` command, schema case-drift
normalization, circuit-breaker integration) is clean and well tested — no
bugs found in `backend/app/agent/*` or its tests. The frontend overlay data
layer (`lib/overlayEvents.ts`, `lib/overlayMeta.ts`, `store/filters.ts`) is
also solid and matches its unit tests exactly.

Two critical issues were found in the wiring layer (`App.tsx` +
`OverlayEventsList.tsx`): stale React Query data leaks past a disabled
overlay toggle, and the overlay marker/button colors fail WCAG contrast
against their hardcoded white text in dark mode — a direct violation of this
project's non-negotiable accessibility constraint. Three warnings and two
info items round out the findings; none of the warnings/info items block
the feature but should be tracked.

---

### CR-1: Stale overlay data survives a toggle-off (App.tsx + OverlayEventsList.tsx)

**Files:**
- `frontend/src/App.tsx:70-79`
- `frontend/src/components/OverlayEventsList.tsx:61-76`

**Description:**

`useLabs`/`useIncidents`/`useProcedures` gate fetching via TanStack Query's
`enabled` flag (`frontend/src/hooks/useLabs.ts:17`, etc.), but disabling a
query does **not** clear its cached `data` — TanStack Query v5 simply stops
refetching; the last successfully-fetched array remains attached to that
query key indefinitely (the query is still mounted/observed, so garbage
collection never runs either). `App.tsx` relies on the `enabled` flag alone
to keep an off dataset's contribution empty:

```tsx
const labs = useLabs(window, overlayDatasets.labs);
...
const labsEvents = labsToEvents(labs.data ?? []);   // stale data if labs was ON, now OFF
...
const overlayEvents = mergeOverlayEvents(labsEvents, incidentsEvents, proceduresEvents);
```

Reproduction: toggle "Labs" on (query fetches and caches for the current
date window), let it render, then toggle "Labs" off again without changing
the date range. `overlayDatasets.labs` flips to `false`, but `labs.data`
still holds the last successful result, so `labsEvents` stays non-empty.
This stale array flows into:
1. `overlayEvents` passed to `<ChartDeck>` → `BPTimeline`/`PulseTrend` hero
   `ReferenceLine` markers keep rendering the "removed" dataset.
2. `OverlayEventsList`'s `merged` useMemo (`OverlayEventsList.tsx:61-76`),
   which filters only on `isError`, never on `enabled` — so the accessible
   events table keeps showing rows for a dataset whose toggle button now
   reads `aria-pressed="false"`.

For a voice-first app whose core value proposition is that Chris can trust
what he asked for ("hide labs") actually happened, this is a materially
misleading result: the UI state (button, live-region sentence) says off,
but the chart markers and table rows say on.

**Suggested fix:** Gate each dataset's contribution on the toggle flag, not
just query `enabled`/`isError`:

```tsx
// App.tsx
const labsEvents = overlayDatasets.labs ? labsToEvents(labs.data ?? []) : [];
const incidentsEvents = overlayDatasets.incidents ? incidentsToEvents(incidents.data ?? []) : [];
const proceduresEvents = overlayDatasets.procedures ? proceduresToEvents(procedures.data ?? []) : [];
```

And in `OverlayEventsList.tsx`'s `merged` useMemo, additionally require
`labs.enabled` / `incidents.enabled` / `procedures.enabled` alongside the
existing `!isError` check.

---

### CR-2: Dark-mode contrast failure on overlay toggle buttons and table badges

**Files:**
- `frontend/src/components/OverlayToggle.tsx:29-30,77-78`
- `frontend/src/components/OverlayEventsList.tsx:163-168`
- `frontend/src/index.css:74-76`

**Description:**

CLAUDE.md lists "high contrast" as a non-negotiable accessibility
constraint, and `index.css`'s own header states color pairs are
"contrast-computed in the UI-SPEC tables — do not re-derive." The overlay
dataset colors were chosen as light/pastel tones for dark mode so they read
well as chart line/marker strokes against the dark background:

```css
.dark {
  --overlay-labs: #C9A6EA;
  --overlay-incidents: #F0A8D0;
  --overlay-procedures: #C9D48A;
}
```

Both `OverlayToggle`'s active-button fill and `OverlayEventsList`'s type
badge reuse these same tokens as a **solid fill behind hardcoded white
text**:

```tsx
// OverlayToggle.tsx
const activeClass = "... text-white border-2";
style={on ? { backgroundColor: color, borderColor: color } : undefined}

// OverlayEventsList.tsx
style={{ backgroundColor: color, color: "white" }}
```

A light pastel background with white text is exactly the failure mode that
combination produces. Computed WCAG contrast ratios for white text on the
dark-mode overlay colors:

| Token | Hex | Contrast vs white text |
|---|---|---|
| `--overlay-labs` | `#C9A6EA` | ≈2.07:1 |
| `--overlay-incidents` | `#F0A8D0` | ≈1.87:1 |
| `--overlay-procedures` | `#C9D48A` | ≈1.58:1 |

All three fail even the relaxed WCAG large-text minimum (3:1), let alone
the 4.5:1 normal-text floor that applies to the 18px, non-bold table badge
text. Light mode is unaffected (the light-mode overlay colors are dark
enough that white text clears ~5.9–7.6:1).

**Suggested fix:** Add a dedicated `--overlay-*-text` (or reuse
`--cat-chip-text`-style theme-aware ink) token pair per dataset color, or
switch the active button/badge text color to the theme's dark ink
(`var(--color-ink)` equivalent) in dark mode instead of a hardcoded
`text-white`/`color: "white"`.

---

### WR-1: Voice/text confirmation never mentions the overlay change it just applied

**File:** `frontend/src/lib/agent.ts:89-145`

**Description:**

`CommandBar.tsx` composes the on-screen (and would-be spoken) confirmation
for every `"applied"` agent reply — including `toggle_dataset` — from
`composeConfirmation()`'s locked template:

```ts
return `Showing ${chartPhrase}, ${rangePhrase}${ampmSuffix}${categorySuffix}`;
```

This template has no overlay clause. When Chris says "show my labs," the
backend returns `AppliedFilters{ overlayDataset: "labs", overlayState: "on" }`
with `message: ""` (server intentionally defers to the frontend echo, per
`service.py`'s `_apply_toggle_dataset` comment). `applyAgentFilters` correctly
flips `overlayDatasets.labs` in the store, but the confirmation text the user
actually sees/hears is only ever the chart/date/AM-PM/category state — e.g.
"Showing blood pressure, all data" — with no acknowledgment that labs were
just turned on. `OverlayToggle`'s own `aria-live="polite"` sentence
(`buildOverlaySentence`) does separately announce the new state to
screen-reader users, but the primary confirmation banner — the mechanism
every other filter dimension uses for its D-07 full-state echo — stays
silent on the one thing the command actually changed.

**Suggested fix:** Extend `composeConfirmation`'s template (or add a sibling
helper `agent.ts` callers can append) with an overlay clause sourced from
`buildOverlaySentence`/`overlayDatasets`, consistent with how `ampmSuffix`/
`categorySuffix` are appended today.

---

### WR-2: Unmemoized per-dataset event arrays defeat OverlayEventsList's own pagination-reset guard

**Files:**
- `frontend/src/App.tsx:76-79`
- `frontend/src/components/OverlayEventsList.tsx:51-90`

**Description:**

`OverlayEventsList.tsx` documents (lines 51-60) that its `merged` useMemo
exists specifically so a plain re-derivation wouldn't produce a new array
reference on every render, which would cause its `useEffect(() =>
setVisible(PAGE_SIZE), [merged])` to fire and clobber an expanded "Show 20
more" page size. That guard depends on the `labs`/`incidents`/`procedures`
props it receives being referentially stable across unrelated parent
re-renders.

`App.tsx` computes those props inline, unmemoized, on every `Dashboard`
render:

```tsx
const labsEvents = labsToEvents(labs.data ?? []);
const incidentsEvents = incidentsToEvents(incidents.data ?? []);
const proceduresEvents = proceduresToEvents(procedures.data ?? []);
const overlayEvents = mergeOverlayEvents(labsEvents, incidentsEvents, proceduresEvents);
```

`.map()` always returns a new array, so `labsEvents` etc. get fresh
identities on *every* `Dashboard` render — including renders triggered by
things with zero relation to overlay data (a `readings`/`stats` background
refetch on window refocus, an unrelated `FilterBar` change, an agent-driven
filter update). Each such render feeds new-identity arrays into
`OverlayEventsList`'s props, so its `useMemo` dependency array changes and
`merged` gets a new reference regardless of whether the underlying overlay
data actually changed — reintroducing exactly the bug class the code
comment says was fixed, just one level up the tree. Net effect: a user who
expands "Show 20 more" and then changes an unrelated filter (or simply
leaves the tab open past the 5-minute `staleTime` and refocuses it) will see
their pagination silently reset to 20.

**Suggested fix:** Memoize `labsEvents`/`incidentsEvents`/`proceduresEvents`/
`overlayEvents` in `App.tsx` with `useMemo`, keyed on `labs.data`/
`incidents.data`/`procedures.data` (which TanStack Query keeps referentially
stable via structural sharing when content is unchanged).

---

### WR-3: agent-parity.test.ts doesn't cover the new DatasetToken/OverlayDataset vocabulary

**File:** `frontend/src/lib/agent-parity.test.ts`

**Description:**

This file's stated purpose (its own header comment) is to guarantee "no
command vocabulary is dead" and "frontend↔backend token equality" by
reading `backend/app/agent/schemas.py` off disk and diffing it against the
frontend's unions. It does this for `ChartToken`/`ChartId` and
`AppliedFilters.bpCategory`/`BPCategory`, and it does add
`"setOverlayDataset"` to `STORE_ACTIONS` with one passing case (`labs`
only, `agent-parity.test.ts:161-166`). It does **not**:
1. Read-compare backend `DatasetToken` (`schemas.py:49`) against frontend
   `OverlayDataset` (`api/types.ts:155`) the way it does for chart/category
   tokens.
2. Enumerate all three dataset values (`labs`, `incidents`, `procedures`)
   through `applyAgentFilters` the way `CHART_IDS`/`BP_CATEGORIES`/
   `DATE_PRESETS`/`AMPM` are each exhaustively `it.each`-tested.

Nothing is currently broken (the tokens do match today), but this is
precisely the class of drift this suite exists to catch, and Phase 09 is
the phase that introduced the vocabulary it's missing.

**Suggested fix:** Add a `DATASETS = ["labs", "incidents", "procedures"]`
const, an `it.each(DATASETS)` reachability block mirroring the existing
ones, and a `backend DatasetToken equals frontend OverlayDataset` read-file
comparison test alongside the existing `ChartToken`/`bpCategory` ones.

---

### IN-1: Local `window` binding shadows the global `Window` object

**File:** `frontend/src/App.tsx:71`

**Description:**

```tsx
const window = { start_date: resolved.start_date, end_date: resolved.end_date };
```

This shadows the global `window` for the remainder of `Dashboard`'s
function body. Nothing in the current function body needs the real
`window` (TypeScript would flag a type mismatch if it did), so it isn't a
live bug today, but it's a footgun for the next person who adds e.g. a
`window.matchMedia`/`window.innerWidth` call inside this component and gets
a confusing type error, or — in a plain-JS context — silent breakage.

**Suggested fix:** Rename to `dateWindow` (matches the `DateWindow` type
already used in `api/client.ts`/`useLabs.ts`/etc.) or `overlayWindow`.

---

### IN-2: Doc comment overstates the depth limit of `_lower_value`'s recursion

**File:** `backend/app/agent/schemas.py:168`

**Description:**

```python
def _lower_value(key: str, val: object) -> object:
    """Lowercase string values (and one level of nested dict, e.g. date_range) except ``question``."""
```

The implementation actually recurses through `_lower_value` on every nested
dict value, not just one level — it will lower strings at any depth, not
only within a single nested `date_range` dict. This is harmless (more
correct than advertised, and there's no currently-reachable structure
deeper than two levels), but the comment will mislead a future reader who
adds a deeper nested variant and assumes normalization stops at depth 1.

**Suggested fix:** Either tighten the docstring to "recursively lowercases
nested dict values at any depth" or, if a depth-1 limit was actually
intended, add a depth guard to match it.
