---
phase: 15
slug: unified-filter-surface-multi-select-checkboxes-pulse-categor
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-13
---

# Phase 15 — UI Design Contract: Unified Filter Surface

> Implementation-level contract, in the style of `14-UI-SPEC.md`: pins exact tokens, shapes, and
> copy so nothing is re-derived at build time. Design System / Spacing / Typography / Color carry
> forward **unchanged** from `13-UI-SPEC.md` (this phase adds no new visual language, only converts
> a control model and adds two filter groups) — declared fresh here per the template's own
> requirement that each phase state its own contract, not inherit by reference.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (unchanged from Phase 13 — no `components.json`, hand-rolled components over Tailwind 4) |
| Preset | not applicable |
| Component library | none — hand-rolled, reusing `ShowPanel.tsx`'s proven checkbox pattern verbatim |
| Icon library | lucide-react (unchanged; no new icons needed this phase) |
| Font | Inter (body/label/heading) + Space Grotesk (stat-card values only) — unchanged from Phase 13 |

shadcn gate: not re-run — no design-system state has changed since Phase 13's documented decline.

---

## Spacing Scale

Unchanged from `13-UI-SPEC.md`. No new spacing values needed.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing, chip gaps |
| md | 16px | Default element spacing, card gutters |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks — **also the accessibility click-target floor (non-negotiable)** |
| 3xl | 64px | Page-level side gutters |

Exceptions: none. Every checkbox target in this phase is ≥48×48px, matching `ShowPanel.tsx`'s
`min-h-12` control exactly.

---

## Typography

Unchanged from `13-UI-SPEC.md`. No new sizes or weights.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 18px | 400 (Regular) | 1.5 |
| Label | 20px | 600 (Semibold) | 1.25 |
| Heading | 24px | 600 (Semibold) | 1.2 |
| Display | 36px | 600 (Semibold) | 1.15 (not used this phase) |

Checkbox labels and group headings use `text-label` (20px/600), matching `ShowPanel.tsx` and the
existing `FilterBar.tsx` buttons. Live-sentence and empty-state body text stay at 18px body.

---

## Color

Unchanged palette from `13-UI-SPEC.md`. No new hex values are introduced this phase — see the
Pulse Category reuse table below, which is the one open color question this phase has.

| Role | Value (light / dark) | Usage |
|------|-------|-------|
| Dominant (60%) | `#F5F7F6` / `#0A121F` | Page background (`--color-deck`) |
| Secondary (30%) | `#E3EBE9` / `#101D30` | Cards, panels, filter/show bars (`--color-mist`) |
| Accent (10%) | `#8A5A1E` / `#D9A356` | `--color-brass` — reserved for checkbox tick marks (`accent-*`) and any active/pressed fill (date-range presets only, unchanged) |
| Destructive | `#9C2B22` / `#E2685A` | `--color-hazard` — unused this phase, no destructive actions added |

**Accent reserved for:** the native checkbox tick (`accent-[var(--color-brass)]`) on every new and
converted checkbox, and the date-range preset buttons' pressed fill (unchanged, untouched this
phase). Nothing else is ever Brass-filled.

### Pulse Category — reuse existing tokens, add zero new colors

`Bradycardia` / `Normal` / `Tachycardia` need a chip color each (matching the existing BP-category
chip pattern), but every hue this project would reach for already exists and already carries the
matching clinical meaning:

| Pulse category | Reused token | Rationale |
|---|---|---|
| Bradycardia | `--ref-bradycardia` (identical hex to `--cat-hypotension`: `#3E6E8E` / `#8FB3D1`) | Already the exact color `CombinedTimeline.tsx`'s 60 bpm reference line uses for "low." Reusing it (rather than inventing a near-duplicate) means Bradycardia reads as the same "below-normal" concept everywhere it appears, and needs **zero new contrast test cases** — the token is already verified. |
| Normal | `--cat-normal` (`#2B7A5B` / `#5FBF8F`) | "Normal" means the same thing for BP and pulse; reusing the exact token keeps that consistent instead of inventing a second green. |
| Tachycardia | `--cat-elevated` (`#866A00` / `#E0B84E`, gold) | Tachycardia alone isn't a crisis-tier finding — reusing "Elevated" (mild-concern gold) rather than a Stage 2/Crisis red avoids overstating severity, and avoids adding an 8th warm hue into a palette that already has six BP-severity colors plus `--line-pulse` and `--color-hazard` crowding that region. |

**No new CSS custom properties, no new `contrast.test.ts` cases required this phase** — every token
reused here is already verified. Add `frontend/src/lib/palette.ts`'s `pulseCategoryColor()` +
`PULSE_CLINICAL_ORDER` as thin wrappers around these three existing vars (mirrors `categoryColor()`
exactly).

### Time of Day — no color

`Morning` / `Afternoon` / `Evening` / `Night` carry no clinical severity, so — like the existing
AM/PM buttons being converted — they get **plain checkboxes** (`ShowPanel.boxClass` styling: mist
background, depth border, brass tick), never a colored chip. This mirrors the existing visual split
already in `FilterBar.tsx` today: AM/PM is plain buttons, BP category is colored chips. That split
carries forward unchanged — Pulse Category joins the colored-chip side, Time of Day joins the
plain-checkbox side.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Show all data" (`EmptyState.tsx`) — unchanged, this phase adds no new CTA |
| Empty state heading | "No readings match these filters" — unchanged |
| Empty state body | **Changed** — extended template below to describe multi-select selections |
| Error state | Unchanged — no new error paths this phase |
| Destructive confirmation | Not applicable — no destructive actions in this phase |

See §7 and §8 below for the exact locked templates (live sentence, empty state, spoken
confirmation) with worked examples — these are the substance of this phase's copy contract.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none — shadcn not initialized | not applicable |
| third-party | none | not applicable |

---

## 1. Component inventory

| File | Fate |
|------|------|
| `frontend/src/components/FilterBar.tsx` | **Heavily modified.** Date-range group unchanged. AM/PM and BP-category groups convert from `aria-pressed` buttons to checkboxes. Two new checkbox groups added: Time of Day, Pulse Category. |
| `frontend/src/store/filters.ts` | **Modified.** `amPm` and `bpCategory` change shape from a single sentinel value to a `Record<key, boolean>` map (mirrors `visibleDatasets`). Two new map fields: `pulseCategory`, `timeOfDay`. v2→v3 migration added (see §2). |
| `frontend/src/api/types.ts` | **Modified.** Add `PulseCategory` and `TimeOfDayBucket` union types (mirrors `BPCategory`). Type `Reading.pulse_category` as `PulseCategory` instead of loose `string`. |
| `frontend/src/lib/palette.ts` | **Extended.** Add `PULSE_CLINICAL_ORDER`, `pulseCategoryColor()` — thin wrappers, same shape as the existing `CLINICAL_ORDER`/`categoryColor()`. |
| `frontend/src/lib/dates.ts` (or a new small sibling module) | **Extended.** Add `TIME_OF_DAY_ORDER`, time-of-day labels, and the hour-boundary constants (§9) as the single source of truth the backend query and any frontend display share conceptually — do not hardcode the boundary hours a second time anywhere. |
| `frontend/src/components/EmptyState.tsx` | **Modified.** Props change from singular `amPm`/`bpCategory` to the four selection maps; body copy extended (§8). |
| `frontend/src/lib/agent.ts` | **Modified.** `composeConfirmation` rewritten for multi-select (§9). `PulseField` gains `"timeOfDay"` and `"pulseCategory"`. `applyAgentFilters` gains handling for the new `AppliedFilters` list fields. |
| `backend/app/deps.py` | **Modified.** `ReadingFilters.am_pm`/`bp_category` become list-typed with `IN` semantics. New `pulse_category` and `time_of_day` list params, same `IN` pattern. |
| `backend/app/schemas.py` | **Modified.** `pulse_category: str` → `Literal["Bradycardia","Normal","Tachycardia"]`, matching the existing `bp_category` pattern. |
| `backend/app/agent/schemas.py` | **Modified.** `DashboardCommand.am_pm`/`bp_category` become list-typed; add `pulse_category` and `time_of_day` list fields. `AppliedFilters` grows matching list fields. |
| `backend/app/agent/prompt.py` | **Modified.** Vocabulary for pulse category and time-of-day tokens; AM/PM wording revisited per §10's open question. |
| Guide "What Can I Say" section | **Flagged, not spec'd here** — needs new example phrases once the agent vocabulary above is finalized. Same treatment Phase 14 gave this (propagate, don't design in the UI-SPEC). |

**Filter semantics reminder (not new, stated for clarity with two new groups added at once):**
every group here filters the same `Reading` rows. Within a group, values are OR'd (`bp_category IN
(Stage 1, Stage 2)`); across groups, results AND together. A reading is one systolic+diastolic+pulse
triple, so a `pulseCategory` filter can remove a row from the Blood Pressure line too — identical to
how `bpCategory` already, today, can remove a row from the Pulse line. Not a new behavior, just now
true in both directions.

---

## 2. Store shape contract

```ts
// Replaces the "all" | "AM" | "PM" sentinel and "all" | BPCategory sentinel.
// Empty map (every value false) === "no restriction from this group" — the
// same meaning "all" carries today. This mirrors visibleDatasets exactly:
// same Record<key, boolean> shape, same setX(key, on) setter pattern.
amPm: Record<"AM" | "PM", boolean>;              // default: { AM: false, PM: false }
bpCategory: Record<BPCategory, boolean>;          // default: all 6 keys false
pulseCategory: Record<PulseCategory, boolean>;    // NEW — default: all 3 keys false
timeOfDay: Record<TimeOfDayBucket, boolean>;      // NEW — default: all 4 keys false
```

**Zero-or-all convention (locked, applies to every group in this store and every derived sentence):**
0 selected and ALL selected both mean "no restriction" and render identically ("All categories",
"All times", etc.) — selecting every checkbox in a group is not a distinct state from selecting
none. This matches how an `IN` clause containing every possible value is a no-op filter; no group
gets a ShowPanel-style "nothing selected" guided prompt, because these are narrowing filters over an
already-chosen dataset, not the ShowPanel's "what to draw" decision — showing zero rows only ever
happens because the *data* has none in range, never because a filter group is empty.

### v2 → v3 migration (follow the existing v1→v2 precedent in `store/filters.ts`)

```ts
// v2 shape: amPm: "all" | "AM" | "PM"; bpCategory: "all" | BPCategory
// v3 shape: the four Record<key, boolean> maps above.
function migrateV2(v2: { amPm: string; bpCategory: string }): {
  amPm: Record<"AM" | "PM", boolean>;
  bpCategory: Record<BPCategory, boolean>;
} {
  const amPm = { AM: v2.amPm === "AM", PM: v2.amPm === "PM" }; // "all" -> both false
  const bpCategory = Object.fromEntries(
    CLINICAL_ORDER.map((c) => [c, c === v2.bpCategory]),
  ) as Record<BPCategory, boolean>; // "all" -> every key false
  // pulseCategory / timeOfDay did not exist in v2 -> default all-false maps.
  return { amPm, bpCategory };
}
```

A v2 blob carrying a single active AM/PM value or a single active BP category is preserved exactly
under the new multi-select shape (one key true) — the same "don't silently reset Chris's choice"
principle the v1→v2 migration's own comment states.

---

## 3. FilterBar layout & control contract

Five groups, left to right, each preceded by a small visible `text-label` heading (new — today's
groups rely on `aria-label` alone with no visible text; adding a visible prefix keeps five groups
scannable at a glance, matching `ShowPanel.tsx`'s own `Show:` prefix precedent):

| Order | Visible label | `aria-label` | Control style |
|---|---|---|---|
| 1 | `Date:` | `Date range` | Unchanged — exclusive `aria-pressed` buttons (date presets are NOT converted, per locked decision) |
| 2 | `AM/PM:` | `AM or PM` | **Converted** to checkboxes |
| 3 | `Time of Day:` | `Time of day` | **New** — checkboxes |
| 4 | `BP Category:` | `Blood pressure category` | **Converted** to checkboxes (colored chips retained) |
| 5 | `Pulse Category:` | `Pulse category` | **New** — checkboxes (colored chips) |

Renaming groups 1/2's `aria-label`s from today's `"Date range"`/`"Time of day"` to `"Date range"`
(unchanged) / `"AM or Pm"` is required — `"Time of day"` is claimed by the new group 3, so group 2
cannot keep it.

### Plain checkbox control (AM/PM, Time of Day) — reuse `ShowPanel.boxClass` verbatim

```
min-h-12 flex items-center gap-3 rounded-xl py-2 pl-3.5 pr-4 text-label
bg-[var(--color-mist)] text-[var(--color-depth)]
border-2 border-[var(--color-depth)] shadow-[var(--shadow-elevation)] cursor-pointer
```

Real `<input type="checkbox" className="h-[26px] w-[26px] accent-[var(--color-brass)]">` inside the
`<label>`, exactly as `ShowPanel.tsx` implements it — no dimming of the unchecked state (the
`260827-kir` anti-pattern stays banned everywhere, not just `ShowPanel`).

AM/PM labels: `AM`, `PM`. Time of Day labels: `Morning`, `Afternoon`, `Evening`, `Night`.

### Colored-chip checkbox control (BP Category, Pulse Category)

Today's chips are `aria-pressed` buttons with a solid `categoryColor()` fill and a box-shadow ring
when active. Converting to a *real* checkbox (required — Phase 14's own rule: "not a colour-fill the
user has to interpret") while preserving D-14's "clinical colors are always information, regardless
of state" rule:

```
<label className="min-h-12 flex items-center gap-2 rounded-full px-4 text-label cursor-pointer"
       style={{ backgroundColor: categoryColor(cat), color: CHIP_TEXT }}>
  <input type="checkbox" checked={on} onChange={...}
         className="h-[26px] w-[26px] flex-none cursor-pointer"
         style={{ accentColor: CHIP_TEXT }} />
  {cat}
</label>
```

- Fill color is **always** the category's solid color, checked or not (D-14 carries forward
  unchanged — color is information, not a checked-state indicator).
- `accentColor: CHIP_TEXT` (white on light-theme chips, near-black on dark-theme chips) so the
  native tick is visible against every one of the 6 BP / 3 pulse background colors.
- Checked state gets the SAME ring the active state used to get: `boxShadow: "0 0 0 3px
  var(--color-depth)"`. This is now redundant with the native checkbox's own tick for signalling
  "on," which is intentional — two reinforcing, non-color signals (native tick + ring), not one.
- BP Category labels (unchanged, verbatim, `CLINICAL_ORDER`): `Hypotension`, `Normal`, `Elevated`,
  `Stage 1`, `Stage 2`, `Hypertensive Crisis`.
- Pulse Category labels (`PULSE_CLINICAL_ORDER`): `Bradycardia`, `Normal`, `Tachycardia`.

### Agent pulse

`PulseField` grows two members: `"timeOfDay"` and `"pulseCategory"`. Same 1500ms
`motion-safe:animate-pulse` + static `ring-2 ring-[var(--color-brass)]` fallback every other group
already uses.

---

## 7. Live filter-state sentence (D-20 pattern, extended)

Still one `aria-live="polite"` sentence, dot-joined (` · `), now five segments instead of three.
Each segment individually collapses to "All …" under the zero-or-all convention (§2):

```
{datePhrase} · {amPmPhrase} · {timeOfDayPhrase} · {bpCategoryPhrase} · {pulseCategoryPhrase}
```

| Segment | 0 or all selected | Strict subset |
|---|---|---|
| amPmPhrase | `All times` | `AM` or `PM` (only these two are ever possible: exactly one checked) |
| timeOfDayPhrase | `All times of day` | `joinWithAnd(selected)` — e.g. `Morning and Evening` |
| bpCategoryPhrase | `All categories` | `joinWithAnd(selected)` — e.g. `Stage 1 and Stage 2` |
| pulseCategoryPhrase | `All pulse categories` | `joinWithAnd(selected)` — e.g. `Tachycardia` |

Reuse `joinWithAnd` from `lib/showSentence.ts` verbatim — do not reimplement.

**Worked examples:**
- Nothing filtered: `All data · All times · All times of day · All categories · All pulse categories`
- Everything filtered: `Last 30 days to Sep 13, 2026 · AM · Morning and Evening · Stage 1 and Stage 2 · Tachycardia`

---

## 8. Empty state contract

`EmptyState.tsx` takes the four selection maps (plus unchanged `latestReading`/`presetLabel`) and
builds:

```
There are no {amPmPrefix}{timeOfDayPrefix}readings in {presetLabel}{bpCategoryClause}{pulseCategoryClause}.{newestSentence}
```

| Piece | 0 or all | Strict subset |
|---|---|---|
| `amPmPrefix` | `""` | `"AM "` or `"PM "` |
| `timeOfDayPrefix` | `""` | `"{joinWithAnd(lowercase labels)} "` — e.g. `"morning and evening "` |
| `bpCategoryClause` | `""` | `" in {joinWithAnd(selected)}"` — e.g. `" in Stage 1 and Stage 2"` |
| `pulseCategoryClause` | `""` | `" with {joinWithAnd(selected)} pulse"` — e.g. `" with Tachycardia pulse"` |

**Worked examples:**
- One filter: `There are no AM readings in Last 30 days. The newest reading is from September 13, 2026.`
- Several filters: `There are no readings in Last 30 days in Stage 1 and Stage 2 with Tachycardia pulse. The newest reading is from September 13, 2026.`

`amPmPrefix` and `timeOfDayPrefix` can both be non-empty at once (§10's flagged risk) — accept the
slightly redundant-sounding prefix (e.g. `"AM morning "`) rather than special-casing it; it is
still an honest description of the filter, and the conflict itself is what §10 asks the human to
resolve.

---

## 9. Spoken confirmation contract (`composeConfirmation`, D-07/D-20)

Extend the existing locked template, one optional clause per group, each self-naming its subject so
two clauses never collide (e.g. never two bare `"readings only"` tails):

```
Showing {chartPhrase}, {rangePhrase}{amPmSuffix}{timeOfDaySuffix}{bpCategorySuffix}{pulseCategorySuffix}
```

| Suffix | 0 or all | Strict subset |
|---|---|---|
| `amPmSuffix` | `""` | `", mornings"` (AM only) or `", evenings"` (PM only) — wording unchanged from today |
| `timeOfDaySuffix` | `""` | `", {joinWithAnd(pluralized lowercase labels)}"` — e.g. `", mornings and evenings"` |
| `bpCategorySuffix` | `""` | `", {joinWithAnd(selected)} blood pressure"` — e.g. `", Stage 1 and Stage 2 blood pressure"` |
| `pulseCategorySuffix` | `""` | `", {joinWithAnd(selected)} pulse"` — e.g. `", Tachycardia pulse"` |

**Worked example:** `Showing blood pressure and pulse, last 30 days, mornings, Stage 1 and Stage 2 blood pressure, Tachycardia pulse`

Longer than today's confirmations, but every clause is self-labelled and unambiguous when read
aloud — prioritize correctness over brevity here, matching CLAUDE.md's derived-value-correctness
bar.

---

## 10. Open question — flagging as instructed, with a recommendation

**AM/PM and Time of Day can produce always-empty combinations.** If the boundaries in §11 hold
(Evening = 17:00–20:59, entirely within PM), then checking `AM` + `Evening` together is a
mathematically guaranteed zero-result filter — a caregiver has no way to know that from the UI
before applying it. This is the concrete version of the question the orchestrator flagged: *should
AM/PM be replaced by the finer Time of Day group, or do both coexist?*

- **Option A — coexist (this document's shipped default).** Matches `ROADMAP.md`'s two separate
  scope bullets and its "Primary risk" section, which names `amPm` (not a new field) as becoming
  multi-valued — read together, that is stronger evidence of an intended two-group design than the
  inline aside about "addition, not replacement." Ships two groups; the empty-result trap above is
  real but no worse than any other over-constrained multi-group filter (e.g. `Hypotension` +
  `Bradycardia` + a date range with no matching data is already possible today's system's problem
  too, just not from a *logically guaranteed* combination).
- **Option B — replace.** Drop the AM/PM group entirely; Time of Day (4 buckets) becomes the one
  time-of-day filter, and `"mornings only"` / `"evenings only"` route directly to `Morning` /
  `Evening`. Removes the conflict outright, one fewer control, and maps onto Chris's own phrasing
  (`"mornings"`, `"evenings"`) more precisely than a raw AM/PM binary ever did.

**Recommendation: Option B.** It is simpler, removes a real dead-end trap rather than documenting
around it, and is a smaller total diff (delete a group instead of adding a fifth). Shipping Option A
as the default here only because the roadmap's own words lean that way and this contract should not
silently override a scope call — but this is the one thing in this document worth a human's
explicit yes/no before `/gsd-plan-phase 15` locks the store shape. Swapping to Option B later is a
small, contained edit (drop §3 row 2 and the `amPm` map from §2, keep everything else) — noted so
the swap is cheap if the answer comes back "B."

---

## 11. Time-of-day bucket boundaries (new derived value — needs a test, per CLAUDE.md Quality bar)

No ETL/schema change (not persisted), but the boundary logic is still a derived value in the spirit
of `derive_am_pm` and deserves the same single-source-of-truth + unit-test treatment, not four
copies of magic hour numbers scattered across a SQL `CASE` and a frontend label list.

| Bucket | Hours (local, naive, DATA-05) |
|---|---|
| Morning | 05:00–11:59 |
| Afternoon | 12:00–16:59 |
| Evening | 17:00–20:59 |
| Night | 21:00–04:59 (wraps midnight) |

Flagged as a **default**, not independently confirmed with the user — reasonable, common
convention, but call it out at plan time in case Chris has an opinion (e.g. "evening" starting at
17:00 vs 18:00). `Night` wrapping midnight means the backend `WHERE` clause needs `hour >= 21 OR
hour < 5`, not a single `BETWEEN` — flag for the planner, not solved here.

---

## 12. Accessibility floor (unchanged, restated per project convention)

- Real `<input type="checkbox">`, label inside a ≥48px target — every group, no exceptions.
- No hover-only affordance, no drag, no precise pointing.
- Tab reaches every checkbox; Space toggles it.
- Every BP/Pulse category distinction already carries a text label — color is reinforcement, never
  the only signal (D-14/D-07 carried forward unchanged).
- `aria-live="polite"` on the filter-state sentence (unchanged mechanism, extended content).
- Body text ≥18px; control labels use `text-label` (20px/600).
- `motion-safe:` gates the agent-pulse animation; `motion-reduce` renders instantly (ring-only).

---

## Out of scope

- Value-threshold checkboxes (Phase 18).
- Notes/symptom text search (Phase 18).
- Any ETL or database schema change — time-of-day is query-time-only, pulse_category already exists
  in the DB (this phase only exposes it to the API and UI).
- New chart types (Phase 17).
- Reworking `CategoryBars.tsx` / `AmPmComparison.tsx` beyond consuming the now-multi-valued filters
  the same way they already consume `bpCategory`/`amPm` today — no new visual design needed there.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending — §10's Option A vs B question should be resolved (or explicitly deferred to
planning) before this flips to approved.
