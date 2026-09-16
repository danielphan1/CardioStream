# Phase 15: Unified Filter Surface — Research

**Researched:** 2026-09-16
**Domain:** Cross-stack filter model conversion (Zustand store shape, FastAPI/SQLAlchemy query filters, Claude structured-outputs agent schema, spoken-confirmation grammar) in a TypeScript/React + Python/FastAPI health dashboard
**Confidence:** HIGH (every recommendation is grounded in this codebase's own existing precedents; the two genuinely new patterns — backend `IN`-clause filtering and query-time time-of-day derivation — are verified against current SQLAlchemy 2.0/FastAPI behavior, not just training-data recall)

## Summary

This phase has **no exploratory options to weigh** — `15-UI-SPEC.md` is an approved, implementation-level design contract that already pins every visual/copy/store-shape decision except one (§10, addressed below). The job for planning is almost entirely **mechanical propagation of one type change** (`amPm`/`bpCategory` go from single-valued sentinels to `Record<key, boolean>` maps, mirrored end-to-end through localStorage, the FastAPI query layer, and the Claude agent schema) **plus wiring two dormant capabilities** (`pulse_category`, already a stored/tested column with zero UI reachability; time-of-day, a brand-new query-time-only derivation) into that same multi-select model.

Two things in this phase are genuinely new to the codebase, not mirrors of an existing pattern, and deserve the planner's attention:

1. **The backend has never filtered `/readings` by an `IN`-clause before.** Every existing `ReadingFilters` field (`am_pm`, `bp_category`, date range) is a scalar equality/comparison. There is no multi-value filter anywhere in `backend/app/deps.py` to copy verbatim — Phase 14's "multi-select" (`visibleDatasets`) is a **frontend-only** concept that never becomes a backend query filter (dataset visibility just gates which endpoints the frontend calls). The IN-clause pattern must be built fresh, and it has one sharp edge: SQLAlchemy's `column.in_([])` compiles to an always-false predicate, which is the *opposite* of this phase's locked "empty selection = no restriction" (zero-or-all) convention. This must be guarded explicitly (see Focus Answer 2).
2. **Time-of-day is the first query-time-only derived filter in the project.** Every existing derived value (`am_pm`, `bp_category`, `pulse_category`, MAP, pulse pressure) is computed once at ETL/ingestion time and stored as a column. Time-of-day is deliberately *not* stored (UI-SPEC: "No ETL/schema change... time-of-day is query-time-only"), so it must be expressed as a SQL predicate over `Reading.datetime_` inside `ReadingFilters.apply()`, using SQLAlchemy's `extract('hour', ...)`, which compiles correctly on both SQLite (dev) and Postgres (prod) per this project's portability requirement. The midnight-wrapping "Night" bucket (21:00–04:59) cannot be a single `BETWEEN`; it needs `hour >= 21 OR hour < 5`, flagged explicitly in the UI-SPEC and confirmed here.

Everything else — the store migration shape, the Pydantic list-of-`Literal` agent schema pattern, and the spoken-confirmation grammar — already has a verbatim precedent in this exact codebase (v1→v2 migration in `store/filters.ts`, `ShowOnly.datasets: list[DatasetToken]` in `agent/schemas.py`, and `joinWithAnd` in `lib/showSentence.ts`, already imported into `lib/agent.ts`). The planner's job there is disciplined mirroring, not invention.

**Primary recommendation:** Treat this as two backend-foundation tasks (IN-clause `ReadingFilters` + time-of-day derivation, each independently unit/integration-testable with zero frontend dependency) that unblock everything downstream, followed by a frontend store-shape conversion (with its v2→v3 migration) that unblocks the UI and agent-response wiring. `pulse_category` is the "free" addition in both stacks (column and Literal type already exist — it's a pure mirror of `bp_category`'s existing treatment); `time_of_day` is the phase's one genuinely novel piece of engineering and should not be scheduled casually alongside the mechanical conversions.

**RESOLVED 2026-09-16 — Option B (replace AM/PM with Time of Day entirely).** UI-SPEC §10 flagged
that AM/PM and the new Time of Day group can produce a logically-guaranteed-empty combination (e.g.,
`AM` + `Evening`) and recommended replacing AM/PM outright rather than shipping both; the user was
asked directly and confirmed Option B before planning. The `amPm` field is dropped from
`store/filters.ts` entirely — it does NOT need a v2→v3 migration entry. See Open Questions §1 for
full detail and the `prompt.py` vocabulary implication.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-select checkbox UI (AM/PM, Time of Day, BP Category, Pulse Category) | Browser / Client | — | Pure presentation; `FilterBar.tsx` component, reuses `ShowPanel.boxClass` |
| Filter selection state + localStorage persistence + v2→v3 migration | Browser / Client | — | `store/filters.ts` (Zustand) — UI state only, never server data (CLAUDE.md/store convention) |
| Store state → REST query params (`resolveFilters`) | Browser / Client | API / Backend (contract) | Runs in the browser (`lib/dates.ts`) but its *output shape* is dictated by the backend's `ReadingFilters` query-param contract — the two must change together |
| `IN`-clause filtering on `Reading` rows (am_pm, bp_category, pulse_category, time_of_day) | API / Backend | Database / Storage | `backend/app/deps.py` `ReadingFilters.apply()` — SQLAlchemy generates the `WHERE ... IN (...)` against Postgres/SQLite |
| `pulse_category` storage | Database / Storage | — | Column already exists (`models.py`), already ETL-computed (`derivations.classify_pulse`) — this phase only exposes it, no schema change |
| Time-of-day bucket derivation | API / Backend | — | Query-time-only per UI-SPEC (no ETL/schema change) — lives inside `ReadingFilters.apply()`'s SQL, backed by a small pure Python function for the boundary constants + unit test |
| Agent token vocabulary (list-typed `bp_category`, new `pulse_category`/`time_of_day` tokens) | API / Backend | — | Claude structured-outputs schema (`agent/schemas.py`), constrained-sampling closed vocabulary; server-side token→label translation (`BP_TOKEN_TO_LABEL`-style maps) |
| Spoken/live-sentence confirmation grammar for multi-select | Browser / Client | — | `composeConfirmation` (`lib/agent.ts`) composes from **post-apply store state**, never from model text (D-07) — pure client-side string composition |

## User Constraints

> No `CONTEXT.md` exists for this phase (only `15-UI-SPEC.md`, which serves as the approved design
> contract — read in full and treated as authoritative below). The project's `CLAUDE.md` supplies the
> binding project-level constraints; extracted here per the researcher's CLAUDE.md-enforcement duty.

### Project Constraints (from CLAUDE.md)

- **Tech stack is fixed** — PostgreSQL/SQLite, Python+Pandas ETL, FastAPI, React (Vite), Recharts, Web Speech API, Claude API (Anthropic), Vercel+Railway. This phase introduces **zero new libraries**; every mechanism it needs (SQLAlchemy `.in_()`/`extract()`, FastAPI list `Query()`, Pydantic list-of-`Literal`, Zustand) is already in the pinned stack.
- **Security:** Claude agent must return JSON only, Pydantic-validated on the backend; model output is untrusted input. The existing `AgentOutput._lower_tokens` validator already recurses into list values (`_lower_value`'s list branch, docstring: "load-bearing for `ShowOnly.datasets`") — the same mechanism covers the new list-typed `bp_category`/`pulse_category`/`time_of_day` fields without modification.
- **Security:** API keys stay server-side; all Claude calls through the backend. Unaffected by this phase (no new external calls).
- **Privacy:** no analytics, no third-party sharing, DB not publicly exposed. Unaffected.
- **Accessibility (non-negotiable):** every primary action reachable by voice; ≥48px click targets; high contrast; ≥18px body fonts; keyboard navigable; no drag/hover-only/precise-pointing. UI-SPEC §12 restates and locks this for every new/converted checkbox — real `<input type="checkbox">`, ≥48px targets, Tab+Space operable, `aria-live="polite"` sentence, nothing color-only.
- **Quality:** tests required for derived medical categorizations (BP boundaries, MAP, AM/PM logic — "derived medical categorizations must be correct"). Time-of-day is a new derived value in the same spirit and needs the same unit-test treatment (UI-SPEC §11 says so explicitly); `pulse_category`'s derivation (`classify_pulse`) is already tested (`backend/tests/test_categories.py`) and unaffected by this phase — only its *reachability* is new.
- **Compatibility:** voice on Chrome/Edge and Safari/iOS. Unaffected directly — the agent is currently inert in production (no API credits, `AGENT-01`), so this phase's agent-schema changes are unit-tested only, not live-verified (same caveat Phase 14 carried).

### Locked Decisions (from 15-UI-SPEC.md)

- Date-range presets stay **exclusive** buttons — NOT converted to checkboxes (a range can't be "7 days AND 90 days").
- AM/PM and BP Category convert to real `<input type="checkbox">`, matching `ShowPanel.tsx`'s control language verbatim (plain-box class for AM/PM; colored-chip class, unchanged fill-is-information rule, for BP Category).
- Two new checkbox groups: **Time of Day** (Morning/Afternoon/Evening/Night, plain checkboxes, no color) and **Pulse Category** (Bradycardia/Normal/Tachycardia, colored chips reusing existing tokens — zero new CSS).
- **Zero-or-all convention (locked):** 0 selected and ALL selected both mean "no restriction," rendered identically ("All categories," etc.). No group gets ShowPanel's "nothing selected" guided prompt — these are narrowing filters over an already-chosen dataset, not ShowPanel's "what to draw" decision.
- Store shape: `amPm: Record<"AM"|"PM", boolean>`, `bpCategory: Record<BPCategory, boolean>`, `pulseCategory: Record<PulseCategory, boolean>` (new), `timeOfDay: Record<TimeOfDayBucket, boolean>` (new). Default: every key `false`.
- v2→v3 migration MUST follow the existing v1→v2 precedent (see Focus Answer 1).
- Live filter-state sentence grows from 3 to 5 dot-joined segments; empty-state and spoken-confirmation templates extend with one optional clause per new group, each self-naming its subject.
- Time-of-day boundaries (flagged as a **default**, not independently confirmed with Chris): Morning 05:00–11:59, Afternoon 12:00–16:59, Evening 17:00–20:59, Night 21:00–04:59 (wraps midnight).

### Claude's Discretion / Open Question (from 15-UI-SPEC.md §10)

- **AM/PM vs. Time of Day coexistence.** UI-SPEC ships Option A (both groups coexist) as the *default*, but its own author recommends Option B (Time of Day replaces AM/PM outright) as simpler and trap-free, and says explicitly: *"this is the one thing in this document worth a human's explicit yes/no before `/gsd-plan-phase 15` locks the store shape."* Not resolved by this research — flagged for the planner/user, not decided here. See Open Questions below.

### Deferred Ideas (out of scope, per UI-SPEC)

- Value-threshold checkboxes (Phase 18).
- Notes/symptom text search (Phase 18).
- Any ETL/schema change — time-of-day is query-time-only; `pulse_category` already exists.
- New chart types (Phase 17).
- Reworking `CategoryBars.tsx`/`AmPmComparison.tsx` beyond consuming the now-multi-valued filters the same way they already consume `bpCategory`/`amPm` — no new visual design there.

## Phase Requirements

> This project has no `REQUIREMENTS.md` with formal `REQ-XX` IDs. `ROADMAP.md`'s Phase 15 entry
> supplies the requirement text verbatim ("Client-driven request, 2026-09-13... direct continuation
> of Phase 14"). The rows below are scope bullets from that roadmap entry, given short IDs here
> purely for traceability inside this research document — they are not IDs from an external
> requirements source.

| ID | Description | Research Support |
|----|-------------|------------------|
| PH15-01 | FilterBar AM/PM + BP category convert from single-select `aria-pressed` buttons to multi-select checkboxes | `ShowPanel.tsx` control-language precedent read in full; UI-SPEC §3 pins exact classes |
| PH15-02 | New Pulse Category filter (Bradycardia/Normal/Tachycardia) — column + derivation already exist, zero UI reachability today | `models.py`/`derivations.classify_pulse` confirmed; mirrors `bp_category`'s existing `Literal`/`IN`-clause treatment exactly |
| PH15-03 | New Time of Day filter (morning/afternoon/evening/night), query-time-only, no ETL/schema change | SQLAlchemy `extract('hour', ...)` cross-dialect pattern verified; midnight-wrap pitfall documented |
| PH15-04 | v2→v3 localStorage migration for `amPm`/`bpCategory` becoming arrays | v1→v2 precedent read in full in `store/filters.ts`; exact mirror pattern given in Focus Answer 1 |
| PH15-05 | Backend `ReadingFilters` (`deps.py`) converts `Literal` single-value filters to list-typed `IN` filters | No existing multi-value precedent in this codebase (confirmed via grep) — pattern designed fresh, verified against current FastAPI/SQLAlchemy behavior; empty-list gotcha documented |
| PH15-06 | Agent schema (`agent/schemas.py`) — `bp_category` becomes list-typed; new `pulse_category`/`time_of_day` tokens | `ShowOnly.datasets: list[DatasetToken]` is a direct, already-shipped precedent in this same file |
| PH15-07 | `composeConfirmation` spoken echo describes multiple selections grammatically | `joinWithAnd` (`lib/showSentence.ts`) already imported into `lib/agent.ts` and used for `datasetsPhrase` — same helper reused, not reinvented |

## Focus Answer 1 — The v2→v3 localStorage migration shape

**The v1→v2 precedent, read in full from `frontend/src/store/filters.ts` (lines 91–158):**

```ts
type LegacyFilters = {
  activeChart: string;
  overlayDatasets: Record<"labs" | "incidents" | "procedures", boolean>;
};

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
```

Called from `readStoredFilters()`:

```ts
function readStoredFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPersistedFilters(parsed)) return parsed;       // current shape — pass through
    if (isLegacyFilters(parsed)) {
      return migrateLegacy(parsed as LegacyFilters & Record<string, unknown>);
    }
    return null;                                          // unrecognized — safe defaults
  } catch {
    return null;
  }
}
```

**Governing principle stated in the v1→v2 comment, and restated in UI-SPEC §2 for v2→v3:** "Returning null for those would be simpler, but it would silently reset Chris's choice on his first load after deploy — a worse upgrade experience than this mapping costs to maintain." This is a locked project value, not a style preference — the v2→v3 migration must preserve it.

**What v3 needs to add**, mirroring the same three-function shape (`isXFilters` type guard → `migrateX` mapper → one new branch in `readStoredFilters`):

1. **A new `isV2Filters` guard** (today's `isPersistedFilters` becomes this, renamed) checking `amPm`/`bpCategory` are **strings** (`"all" | "AM" | "PM"` / `"all" | BPCategory`) — the CURRENT shape becomes the thing being migrated *from*.
2. **A new `isV3Filters` guard** (the new "current shape") checking `amPm`/`bpCategory`/`pulseCategory`/`timeOfDay` are all **objects** with the correct boolean-valued keys (mirror the existing `visibleDatasets` per-key boolean loop already in `isPersistedFilters` — that loop is the exact pattern to copy for all four new maps).
3. **`migrateV2`**, exactly the shape UI-SPEC §2 already drafts:
   ```ts
   function migrateV2(v2: { amPm: string; bpCategory: string }): {
     amPm: Record<"AM" | "PM", boolean>;
     bpCategory: Record<BPCategory, boolean>;
   } {
     const amPm = { AM: v2.amPm === "AM", PM: v2.amPm === "PM" }; // "all" -> both false
     const bpCategory = Object.fromEntries(
       CLINICAL_ORDER.map((c) => [c, c === v2.bpCategory]),
     ) as Record<BPCategory, boolean>;
     // pulseCategory / timeOfDay did not exist in v2 -> default all-false maps.
     return { amPm, bpCategory };
   }
   ```
   Note this preserves a v2 single active value as **one `true` key** under the new shape — the same "don't silently reset Chris's choice" principle, now applied to the multi-select conversion.
4. **Chain the fallback in `readStoredFilters`**: `isV3Filters` → pass through; else `isV2Filters` → `migrateV2` + defaults for the two brand-new maps; else `isLegacyFilters` (the OLD v1→v2 branch, **kept, not deleted** — a user who hasn't opened the app since before Phase 14 still has a v1 blob sitting in their browser) → `migrateLegacy` then thread its output through `migrateV2` too (v1 → v2 → v3 as a chain, not a second hand-written v1→v3 mapper, so the v1→v2 logic is never duplicated); else `null`.
5. **Test file precedent:** `frontend/src/store/filters.test.ts` already has a `describe("v1 → v2 migration of pre-Phase-14 persisted filters", ...)` block (~line 275) that seeds `localStorage` with a hand-built legacy blob and asserts the migrated shape. The v2→v3 block should be structured identically — a sibling `describe` block, not a rewrite of the existing one, and the existing v1→v2 tests must keep passing (the chain in step 4 handles v1 blobs going through v2 *shape* before v3 shape, so those tests' assertions may need updating to expect the final v3 record shape rather than the v2 sentinel shape — flag for the planner to check, since the existing tests currently assert `result?.amPm === "AM"` string equality, which will need to become `result?.amPm.AM === true` under the new shape).

**Confidence:** HIGH — this is a verbatim reading of code that exists in the repo today, not an inference.

## Focus Answer 2 — Backend `IN`-clause pattern: no existing precedent, build fresh, one sharp edge

**Verified by direct grep:** `grep -rn "\.in_(\|in_(" backend/app --include="*.py"` returns **zero matches**. There is no multi-value filter anywhere in this backend to mirror. Phase 14's `visibleDatasets`/dataset toggling is entirely a **frontend** concept — it gates which endpoints (`/labs`, `/incidents`, `/procedures`) the frontend chooses to *call*, and never becomes a backend query filter on `/readings` itself. So despite the phase description's suggestion to look for a Phase-14 backend precedent, **there isn't one** — this is new engineering, not a mirror.

**The pattern to build**, following this file's own conventions (`Annotated[X | None, Query()]`, `if self.field:` gate before adding a `.where()`):

```python
# backend/app/deps.py

BPCategory = Literal[
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
]
PulseCategory = Literal["Bradycardia", "Normal", "Tachycardia"]  # NEW — mirrors BPCategory
TimeOfDayBucket = Literal["Morning", "Afternoon", "Evening", "Night"]  # NEW

class ReadingFilters(DateRangeFilters):
    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        am_pm: Annotated[list[Literal["AM", "PM"]] | None, Query()] = None,
        bp_category: Annotated[list[BPCategory] | None, Query()] = None,
        pulse_category: Annotated[list[PulseCategory] | None, Query()] = None,   # NEW
        time_of_day: Annotated[list[TimeOfDayBucket] | None, Query()] = None,    # NEW
    ) -> None:
        super().__init__(start_date, end_date)
        self.am_pm = am_pm
        self.bp_category = bp_category
        self.pulse_category = pulse_category
        self.time_of_day = time_of_day

    def apply(self, stmt: Select) -> Select:
        stmt = super().apply(stmt)
        if self.am_pm:                      # truthy guard — see gotcha below
            stmt = stmt.where(Reading.am_pm.in_(self.am_pm))
        if self.bp_category:
            stmt = stmt.where(Reading.bp_category.in_(self.bp_category))
        if self.pulse_category:
            stmt = stmt.where(Reading.pulse_category.in_(self.pulse_category))
        if self.time_of_day:
            stmt = stmt.where(_time_of_day_predicate(self.time_of_day))
        return stmt
```

**FastAPI list-`Query()` mechanics (verified current, not just training recall):** declaring the parameter as `Annotated[list[Literal[...]] | None, Query()] = None` makes FastAPI accept **repeated query params** with the same name (`?bp_category=Stage%201&bp_category=Stage%202`) and validate each occurrence against the `Literal` — a bad value still 422s per-item, matching the existing `test_invalid_params_return_422` test pattern in `backend/tests/test_api_readings.py`. This is standard, stable FastAPI behavior (`List[str] = Query(default=None)` / `Annotated[list[str] | None, Query()]`), not a fragile or version-specific trick — confirmed via web search against current FastAPI documentation and community references. [CITED: fastapi.tiangolo.com query-params-str-validations + community confirmation]

**The sharp edge — SQLAlchemy `.in_([])` is FALSE, not "no filter":** SQLAlchemy's expanding-`IN` implementation treats an empty list as "nothing can match," compiling to an always-false predicate (documented SQLAlchemy behavior — "anything IN () evaluates to false"). [CITED: SQLAlchemy core documentation / SQLAlchemy GitHub discussions on empty-list `IN` handling] This is the **exact opposite** of this phase's locked zero-or-all convention, where an empty selection means "no restriction" (all rows). The `if self.am_pm:` / `if self.bp_category:` truthy guards shown above are therefore **not optional style** — they are the correctness mechanism that prevents an empty list from silently zeroing out every result. This must hold on **both ends**:
- **Frontend must never send an empty-but-present list.** `resolveFilters`'s multi-select equivalent should *omit the query key entirely* when 0 or all keys are selected (the existing singular pattern — `if (state.bpCategory !== "all") resolved.bp_category = state.bpCategory;` — already omits on "no restriction"; the new version must do the same: omit when the selected-key array has length 0 **or** equals the full key set, not just length 0, since "all checked" and "none checked" both mean "no restriction" per the zero-or-all convention).
- **Backend must defend anyway** (belt-and-suspenders, matching this codebase's existing defensive style elsewhere — e.g., `ShowOnly`'s empty-list guard in `agent/service.py`) — the `if self.field:` truthy check on a `list | None` param already achieves this for free, since `[]` and `None` are both falsy in Python.

**Existing `/stats/summary` composability confirmed, no special-casing needed:** `backend/app/routers/stats.py`'s category-breakdown query reuses the *same* `ReadingFilters.apply()` before grouping by `bp_category`. Once `pulse_category` joins that same filter chain, a `pulse_category` selection will correctly narrow the BP-category breakdown too (and vice versa) — this is exactly the UI-SPEC's own "Filter semantics reminder" ("a `pulseCategory` filter can remove a row from the Blood Pressure line too... identical to how `bpCategory` already, today, can remove a row from the Pulse line"), and it falls out of the existing architecture automatically because every filter is a sequential `.where()` on one `Reading`-based `Select` — no new integration risk here.

**Test precedent to extend, not invent:** `backend/tests/test_api_readings.py` already has `test_bp_category_filter_canonical_labels` (parametrized) and `test_filters_combine` (AND-across-groups). The IN-clause version needs the OR-within-group case added (`?bp_category=Stage%201&bp_category=Stage%202` returns both), plus an explicit empty-selection-means-all-rows regression test (send no `bp_category` param at all — already covered by `test_no_filters_returns_all_rows_ordered_ascending` — and confirm a client-sent empty list, if FastAPI's list param ever resolves to `[]` rather than `None` for a param omitted entirely, does NOT zero out results; verify empirically which one FastAPI actually produces for this project's FastAPI version before writing the assertion).

**Confidence:** MEDIUM-HIGH — the FastAPI list-query-param mechanics and the SQLAlchemy empty-`IN`-list behavior are both well-established, cross-referenced findings (not single-source), but neither was verified against a live `pytest` run in this session (no test execution was performed as part of this research pass) — the planner's first backend task should include writing the two regression tests above as its own verification step, not just code that "should" work.

## Focus Answer 3 — Agent schema: mirror `ShowOnly`'s existing list-of-`Literal` pattern

**The precedent already exists in this exact file (`backend/app/agent/schemas.py`), no need to invent one:**

```python
class ShowOnly(BaseModel):
    action: Literal["show_only"]
    datasets: list[DatasetToken]
```

And its structured-outputs-safety is already documented at the top of the same file: "Structured-outputs-SAFE ONLY — closed lowercase snake_case `Literal` tokens, no numeric ge/le bounds... Enum capitalization is not guaranteed by structured outputs... tokens are lowercase and a `mode="before"` normalizer lowercases every incoming string EXCEPT the free-text `question`." The `_lower_value` helper's **list branch already exists and is already documented as load-bearing for exactly this pattern**: *"The list branch is load-bearing for `ShowOnly.datasets`: the structured outputs docs require enum values be compared case-insensitively, and without it a model emitting `["Blood_Pressure"]` would fail Literal validation."* This means **no change is needed to `_lower_value`/`_lower_tokens`** — the recursive lowercasing already covers list-of-`Literal` fields generically, not just `ShowOnly`.

**Recommended schema change**, mirroring `ShowOnly` exactly:

```python
BPCategoryToken = Literal[
    "hypotension", "normal", "elevated", "stage_1", "stage_2", "hypertensive_crisis"
]  # NOTE: "all" sentinel removed from the token vocabulary itself — see below
PulseCategoryToken = Literal["bradycardia", "normal", "tachycardia"]  # NEW
TimeOfDayToken = Literal["morning", "afternoon", "evening", "night"]  # NEW

class DashboardCommand(BaseModel):
    action: Literal["command"]
    chart: ChartToken | None = None
    datasets: list[DatasetToken] | None = None
    date_range: DateRange | None = None
    am_pm: list[Literal["am", "pm"]] | None = None            # was: Literal["all","am","pm"] | None
    bp_category: list[BPCategoryToken] | None = None            # was: BPCategoryToken | None
    pulse_category: list[PulseCategoryToken] | None = None      # NEW
    time_of_day: list[TimeOfDayToken] | None = None             # NEW
    reset: bool = False
```

**The one design decision this conversion surfaces that `ShowOnly` doesn't have to solve:** today, `am_pm`/`bp_category` use an explicit `"all"` token to mean "clear this filter back to no restriction" — distinct from the field being `None` (D-13: "Unmentioned fields stay None → carry over"). A bare `list[BPCategoryToken] | None` loses that third state — there is no way for Claude to express "go back to all categories" as a *field-level* clear, only "don't mention it" (which means *keep whatever was already selected*, not clear it). Two options, in order of recommendation:

1. **Recommended — a sibling boolean/enum "clear" signal per group**, e.g. `bp_category_all: bool = False` alongside `bp_category: list[BPCategoryToken] | None = None` (mirrors how `reset: bool` already coexists with the rest of `DashboardCommand`'s optional fields — same idiom, smaller blast radius, no change to `BPCategoryToken`'s existing members needed). `service.py`'s `_apply_command` maps `bp_category_all=True` to `AppliedFilters.bpCategory = []` (the store's own "clear" representation), same branch style as the existing `if cmd.bp_category is not None:` check.
2. **Alternative — keep `"all"` as a legal single-element sentinel inside the list** (`bp_category: list[BPCategoryToken | Literal["all"]] | None`), and have `service.py` special-case `cmd.bp_category == ["all"]` → clear. Slightly cheaper on the schema side, but conflates "a real category token" and "a clear signal" in one list, which is a less honest schema than option 1 and would need its own comment explaining why `["all"]` is special-cased rather than just being "the all category, selected."

Either way, **this must be decided at plan time** — it isn't resolved by the UI-SPEC (which only speaks to the store/UI shape, not the wire-level agent grammar) and isn't a mechanical mirror of any existing pattern.

**`prompt.py` vocabulary** already has a `bp_category` section (single-token) and a rough time-of-day section under "Time-of-day filter" (currently mapped to the *am_pm* field's am/pm tokens, described as "mornings"→am, "evenings"→pm — this existing text will need revision once four-bucket Time of Day exists as its own field, not just AM/PM's finer-grained synonym; see Open Question on AM/PM vs. Time-of-Day coexistence, which affects this prompt section directly). No `pulse_category` vocabulary exists yet — new prompt lines needed (e.g., "bradycardia"/"low pulse"/"slow heart rate" → `bradycardia`; "tachycardia"/"high pulse"/"racing heart" → `tachycardia`), following the same natural-language-to-token style already used for BP category and dataset tokens.

**`AppliedFilters`/`api/types.ts` mirror:** both sides currently have `amPm: Literal["all","AM","PM"] | None` / `amPm?: "all" | "AM" | "PM" | null`. These become list-typed the same way (`amPm: list[Literal["AM","PM"]] | None` / `amPm?: ("AM"|"PM")[] | null`), and `BP_TOKEN_TO_LABEL`/`AMPM_TOKEN_TO_LABEL` (currently `dict[str, str]`, one token → one label) need to map **each element** of the incoming list, not the whole list at once — e.g. `filters.bpCategory = [BP_TOKEN_TO_LABEL[t] for t in cmd.bp_category]` rather than a single dict lookup. New `PULSE_TOKEN_TO_LABEL` and a time-of-day equivalent (title-casing `"morning"` → `"Morning"` is trivial enough it may not need a dict at all — `.capitalize()` suffices since none of the four labels have internal capitals or multi-word forms) follow the same shape.

**Confidence:** HIGH for the list-of-`Literal` mechanics and lowercasing (verbatim existing pattern + explicit codebase documentation of why it's safe). MEDIUM for the "all"-token redesign — this is a genuine design fork with two reasonable answers, not a fact to verify; flagged as a plan-time decision, not asserted as settled.

## Focus Answer 4 — `composeConfirmation` grammar: reuse `joinWithAnd`, already imported

**Confirmed by direct read of both files — no gap to fill, this is already wired:**

`frontend/src/lib/showSentence.ts` defines and exports:
```ts
/** "a" / "a and b" / "a, b and c" — NO Oxford comma, because this string is
 * spoken aloud. Do NOT "fix" it to Intl.ListFormat's conjunction form: that
 * adds the comma. lib/agent.ts's spoken confirmation imports this same one. */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
```

`frontend/src/lib/agent.ts` **already imports it** (`import { joinWithAnd } from "./showSentence";`) and already uses it in `datasetsPhrase()` to compose the Show-panel dataset list. The UI-SPEC's own §7/§9 tables (live-sentence and spoken-confirmation contracts) explicitly say: *"Reuse `joinWithAnd` from `lib/showSentence.ts` verbatim — do not reimplement."*

**What actually needs to change in `composeConfirmation`** is not the join helper (already correct, already available) but the **function signature and clause-assembly logic**, since today it takes scalar `amPm`/`bpCategory` and produces at most one suffix each:

```ts
// TODAY (scalar):
const ampmSuffix =
  state.amPm === "AM" ? ", mornings" : state.amPm === "PM" ? ", evenings" : "";
const categorySuffix =
  state.bpCategory !== "all" ? `, ${state.bpCategory} readings only` : "";
```

becomes, per UI-SPEC §9's locked template (`{amPmSuffix}{timeOfDaySuffix}{bpCategorySuffix}{pulseCategorySuffix}`, each clause self-naming its subject so two clauses never collide):

```ts
const selected = (m: Record<string, boolean>) => Object.keys(m).filter((k) => m[k]);

const bpCategorySuffix = (() => {
  const on = selected(state.bpCategory);
  if (on.length === 0 || on.length === CLINICAL_ORDER.length) return "";
  return `, ${joinWithAnd(on)} blood pressure`;
})();
// pulseCategorySuffix, timeOfDaySuffix follow the same shape — zero-or-all
// collapse to "", strict subset joins with joinWithAnd and a self-naming tail.
```

The **zero-or-all collapse-to-empty-string** check (`on.length === 0 || on.length === totalKeys`) is the one piece of new logic every one of the four suffix builders needs, and it is the same check needed in the live-sentence (`FilterBar.tsx`'s dot-joined sentence) and empty-state (`EmptyState.tsx`) builders — worth extracting as one small shared helper (e.g., `selectedOrAll(map, allLabel)` in a shared lib module) rather than writing the same `length === 0 || length === Object.keys(map).length` check four-plus times across `FilterBar.tsx`, `EmptyState.tsx`, and `lib/agent.ts`. This isn't in the UI-SPEC (which specifies the *output strings*, not the implementation), but is a clear "don't hand-roll the same guard four times" opportunity the planner should capture as a task, consistent with this codebase's demonstrated preference for exactly this kind of dedup (see STATE.md's `260913-fdm` audit-fix entry, which did precisely this kind of consolidation across the codebase previously).

**`PulseField` type extension** (also in `lib/agent.ts`) is mechanical — UI-SPEC confirms: *"`PulseField` grows two members: `"timeOfDay"` and `"pulseCategory"`. Same 1500ms `motion-safe:animate-pulse` + static ring fallback every other group already uses."* No new mechanism, just two more string-literal union members and two more `touched.add(...)` call sites in `applyAgentFilters`.

**Confidence:** HIGH — verified by reading both the helper's implementation and its current call site; the phase's own design contract independently confirms "reuse, don't reimplement."

## Focus Answer 5 — Sequencing risk: pulse_category is cheap, time_of_day is not

Both new filters are being wired into the checkbox UI *and* the query layer at the same time as the `amPm`/`bpCategory` conversion, but they are not equally risky, and treating them as equivalent-effort line items in a wave plan would understate `time_of_day`'s cost:

- **`pulse_category` is a pure mirror of `bp_category`'s existing treatment at every layer.** The column exists (`models.py`), the derivation exists and is tested (`derivations.classify_pulse`, `test_categories.py`), the API schema pattern exists (`ReadingOut.pulse_category: str` just needs tightening to `Literal["Bradycardia","Normal","Tachycardia"]`, per UI-SPEC's own component-inventory table: `backend/app/schemas.py` — `pulse_category: str → Literal[...]`), and the filter/agent/UI patterns are identical in shape to `bp_category`'s. This can be built by literally copy-adapting every `bp_category` touchpoint. Low risk, low novelty.
- **`time_of_day` is the phase's one genuinely new derivation mechanism** (Focus Answer 2's `extract('hour', ...)` SQL predicate, no stored column, no ETL precedent, a midnight-wrap edge case, and per UI-SPEC §11 a required unit test for the boundary logic — the *first* time this project needs a derived value that is computed in the query layer rather than at ingestion). It also has the only unresolved open product question (§10) touching it directly.

**Recommended sequencing (for the planner, not prescriptive plan/wave numbers):**

1. **Backend foundation first, in parallel with each other, both independent of the frontend:**
   - Convert `ReadingFilters`'s existing `am_pm`/`bp_category` to `IN`-clause list filters (Focus Answer 2), verified by extending `test_api_readings.py`.
   - Add `pulse_category` as a **new** list filter mirroring the now-list-typed `bp_category` (same PR/task, since it's the same pattern applied to a second column) — do this in the *same* task as the `IN`-clause conversion, not a separate one, since it's genuinely the same code shape repeated.
   - Add `time_of_day` as its **own, separate task** — new pure boundary-constants function + unit test (mirroring `test_derive_am_pm_boundaries`'s parametrize-over-hour style in `test_derivations.py`, but note the function itself likely does NOT belong in `derivations.py` proper, since `derivations.py`'s own docstring states "Categories are computed here and ONLY here" and describes values computed *at ETL/ingestion time* — time-of-day is deliberately never stored, so a `derivations.py` addition would misrepresent it as an ingestion-time derivation like `derive_am_pm`. Recommend a small sibling function, colocated or in `deps.py` itself, with its own unit test, and a comment cross-referencing why it's NOT in `derivations.py`) + the `extract('hour', ...)`-based SQL predicate + its own `test_api_readings.py` extension covering the midnight-wrap case explicitly (a reading at 23:00 and a reading at 03:00 both match "Night"; a reading at 04:00 does not).
2. **Frontend store-shape conversion**, gated on the AM/PM-vs-Time-of-Day product decision (§10) being resolved — this determines whether the store gets 4 new-shape maps or 3 (with `amPm` dropped). Includes the v2→v3 migration (Focus Answer 1) and the shared `pulseCategoryColor()`/`PULSE_CLINICAL_ORDER` palette additions (trivial — three-line wrappers per UI-SPEC, zero new CSS).
3. **Frontend UI + query-param wiring**, gated on step 2: `FilterBar.tsx` checkbox conversion, `lib/dates.ts` `resolveFilters` equivalent (list-aware, with the zero-or-all-omit logic from Focus Answer 2), `useStats.ts`'s call site.
4. **Agent schema + `composeConfirmation`/`applyAgentFilters`**, gated on both the backend schema decision (Focus Answer 3's "all"-clear-signal fork) and the frontend store shape (step 2) since `AppliedFilters` bridges both. This is naturally the *last* piece to lock, since it depends on the shape both other stacks converge on.

**The sequencing risk to flag explicitly for the plan-checker:** because `pulse_category` and `time_of_day` are being added to the *same* store fields, the *same* `FilterBar.tsx` component, and the *same* `ReadingFilters` class as the `amPm`/`bpCategory` conversion in one phase, there is a real temptation to treat all four groups as one undifferentiated "add checkboxes" task. Doing so risks under-scoping `time_of_day`'s SQL-predicate design and its unit test, since it looks superficially identical to `pulse_category` (both are "a new checkbox group") but is not — one is copy-adaptation of an existing pattern, the other is new query-layer engineering with an edge case (midnight wrap) that a rushed mirror-and-paste approach would likely miss.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select checkbox styling | A new checkbox component/class | `ShowPanel.boxClass` (plain) / the colored-chip `<label>` pattern already in `ShowPanel.tsx`/`FilterBar.tsx`'s BP-category chips | UI-SPEC pins these verbatim; a new component would drift from the accessibility floor (≥48px, real `<input>`, no dimming) that's already correct in the existing pattern |
| "a and b and c" spoken/written list grammar | A new join helper, or `Intl.ListFormat` | `joinWithAnd` (`lib/showSentence.ts`), already imported into `lib/agent.ts` | Already exists, already correctly excludes the Oxford comma for spoken text (a deliberate, documented choice — `Intl.ListFormat`'s conjunction form adds a comma that would be wrong here) |
| localStorage schema-migration guard logic | Ad hoc `try/catch` + manual key checks per field | The existing `isXFilters` type-guard + `migrateX` mapper + `readStoredFilters` fallback-chain pattern | Already proven across v1→v2; extending the same chain for v2→v3 keeps exactly one migration mechanism instead of two different styles in one file |
| Structured-outputs enum-list validation/lowercasing | New Pydantic validators for the three new list fields | `AgentOutput._lower_tokens`/`_lower_value` (already generic over lists, per its own docstring) | Already handles this exact case (`ShowOnly.datasets`) — adding fields to the closed union gets this for free |
| Cross-database hour-of-day filtering | Raw SQL string with dialect-specific date functions, or a Python-side post-filter after loading all rows | SQLAlchemy `extract('hour', Reading.datetime_)` | Compiles correctly to both Postgres's native `EXTRACT` and SQLite's `CAST(STRFTIME(...))` via SQLAlchemy's dialect-aware compiler — the ORM-idiomatic way to stay portable, matching CLAUDE.md's "same SQLAlchemy models... on SQLite (dev) and Postgres (prod)" constraint |

**Key insight:** almost nothing in this phase requires new infrastructure — the risk is entirely in *correctly propagating one type change through five layers that each currently encode "single value" as an assumption* (a Python `Literal`, a TS string union, a Pydantic model field, a localStorage blob shape, and a spoken-sentence template), plus correctly building the two pieces (backend `IN`-clause, time-of-day derivation) that have never existed in this codebase before.

## Common Pitfalls

### Pitfall 1: Empty-selection `IN ([])` silently returns zero rows instead of "no restriction"
**What goes wrong:** A multi-select filter with nothing checked (or, transiently, a client that sends an empty array instead of omitting the param) produces `WHERE column IN ()`, which SQLAlchemy compiles to an always-false predicate — the backend would return **zero readings**, the opposite of this phase's locked zero-or-all convention.
**Why it happens:** `IN` semantics are mathematically correct (nothing can equal a member of an empty set) but conflict with this phase's UI-level convention that empty selection means "don't filter."
**How to avoid:** Guard every list-typed filter field with a truthy check (`if self.bp_category:`) before adding the `.where()` clause — `None` and `[]` are both falsy in Python, so this one-line guard handles both "not provided" and "explicitly empty" identically. On the frontend, never construct a query-string list from an empty-or-all-selected map; omit the key entirely (mirrors the existing singular-filter omission pattern in `resolveFilters`).
**Warning signs:** A checkbox group with nothing checked making the whole dashboard go blank, when the group was supposed to be a no-op.

### Pitfall 2: `time_of_day`'s "Night" bucket wraps midnight — a single `BETWEEN`/range comparison is wrong
**What goes wrong:** Night is 21:00–04:59. A naive `hour BETWEEN 21 AND 4` (or the SQLAlchemy equivalent) matches nothing, because 21 is never `<= 4`.
**Why it happens:** Every other bucket (Morning/Afternoon/Evening) is a normal ascending range; Night is the only one that wraps past midnight, and it's easy to write the same range-comparison shape for all four buckets without noticing the fourth one needs different logic.
**How to avoid:** `hour >= 21 OR hour < 5` for Night specifically (UI-SPEC §11 flags this explicitly: "`Night` wrapping midnight means the backend `WHERE` clause needs `hour >= 21 OR hour < 5`, not a single `BETWEEN`"). Write the unit test for this bucket first, with boundary cases at 20:59 (Evening), 21:00 (Night), 04:59 (Night), 05:00 (Morning).
**Warning signs:** A "Night" filter that returns suspiciously few or zero results, or that silently matches every hour (the inverse mistake — using `OR` for all four buckets instead of just the wrapping one).

### Pitfall 3: Agent's `am_pm`/`bp_category` losing their "explicit clear" meaning when converted to bare lists
**What goes wrong:** Today, Claude can say "back to all categories" by emitting the `"all"` token. A naive conversion to `list[BPCategoryToken] | None` with no sentinel leaves no way to express "clear this filter specifically" — only "don't mention it" (None → carry over unchanged) or "set it to exactly these categories" (a non-empty list). The clear-to-all case becomes inexpressible, silently regressing an existing voice capability.
**Why it happens:** The `"all"` sentinel was baked into the *token type itself* in the old singular schema; when the field becomes list-typed, the natural first instinct is to just drop the sentinel and only keep "real" category tokens, without replacing the clear-mechanism it was also serving.
**How to avoid:** Decide explicitly (Focus Answer 3) between a sibling `*_all: bool` clear flag per group (recommended) or retaining `"all"` as a special single-element list value, and implement whichever is chosen — don't let this fall out silently during a routine type-widening edit.
**Warning signs:** A test for "Chris says 'show all categories again' after filtering to Stage 2" that has no way to pass under the naive conversion.

### Pitfall 4: Treating `pulse_category` and `time_of_day` as equal-effort additions in wave/task sizing
**What goes wrong:** Both look like "add one more checkbox group" from the UI side, so a plan might budget them identically. `time_of_day` actually requires new SQL-predicate design, a new unit-tested boundary function, and touches the phase's one open product question (§10); `pulse_category` is a mechanical copy of `bp_category`'s already-existing treatment at every layer.
**Why it happens:** Surface-level symmetry (both are "new checkbox group, three-ish options, colored or plain chips") hides a real asymmetry in backend novelty.
**How to avoid:** Scope `time_of_day` as its own task with its own test-first step (boundary unit test before the SQL predicate, per this project's existing `derive_am_pm`/`classify_pulse` test-first convention); let `pulse_category` ride along with the `bp_category` `IN`-clause conversion task since it's genuinely the same code shape.
**Warning signs:** A plan wave that groups "add pulse_category + time_of_day filters" as one line item with the same task-count budget as "convert bp_category to IN-clause."

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 9.x (`backend/pyproject.toml`: `testpaths = ["tests"]`, `-m 'not live'` default — live-Anthropic tests excluded by default, matching the project's no-API-credits reality) |
| Frontend framework | Vitest 4.x (`frontend/package.json`: `"test": "vitest"` — watch mode by default; use `--run` for a single non-interactive pass) |
| Backend quick run | `cd backend && pytest tests/test_api_readings.py tests/test_categories.py -x` |
| Backend full suite | `cd backend && pytest` |
| Frontend quick run | `cd frontend && npx vitest run src/store/filters.test.ts src/lib/agent.test.ts` |
| Frontend full suite | `cd frontend && npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PH15-01 | FilterBar AM/PM + BP Category render as checkboxes, multi-select | component/unit | `npx vitest run src/components/FilterBar.test.tsx` | ❌ Wave 0 (no existing `FilterBar.test.tsx`; component currently untested directly, only exercised via `smoke.test.tsx`) |
| PH15-02 | `pulse_category` filters `/readings`/`/stats/summary` via `IN` | integration | `pytest tests/test_api_readings.py -k pulse_category -x` | ❌ Wave 0 — extend existing file |
| PH15-03 | `time_of_day` boundary function classifies hours correctly, including midnight wrap | unit | `pytest tests/test_derivations.py -k time_of_day -x` (or a new sibling test file — see Focus Answer 5 on placement) | ❌ Wave 0 |
| PH15-03b | `time_of_day` query filter returns correct rows across the midnight boundary | integration | `pytest tests/test_api_readings.py -k time_of_day -x` | ❌ Wave 0 |
| PH15-04 | v2→v3 localStorage migration preserves a single prior AM/PM or BP-category selection | unit | `npx vitest run src/store/filters.test.ts -t "v2 → v3"` | ❌ Wave 0 — extend existing file (v1→v2 block already present as the pattern to mirror) |
| PH15-05 | Empty selection in any filter group == no restriction (zero-or-all) | integration | `pytest tests/test_api_readings.py -k empty_selection -x` | ❌ Wave 0 |
| PH15-05b | `IN` clause with 2+ values ORs correctly within a group | integration | `pytest tests/test_api_readings.py -k combine -x` | ❌ Wave 0 — extend `test_filters_combine`-style existing pattern |
| PH15-06 | Agent schema accepts list-typed `bp_category`/`pulse_category`/`time_of_day`, case-insensitive | unit | `pytest tests/test_agent_schemas.py -k bp_category -x` | ❌ Wave 0 — extend existing file (`test_bp_category_case_drift_normalizes` is the pattern to mirror for lists) |
| PH15-07 | `composeConfirmation` produces grammatically correct multi-select suffixes | unit | `npx vitest run src/lib/agent.test.ts -t composeConfirmation` | ❌ Wave 0 — extend existing file |

### Sampling Rate
- **Per task commit:** the relevant quick-run command from the table above (scoped to the file(s) touched).
- **Per wave merge:** full suite, both stacks (`pytest` + `npm test -- --run`).
- **Phase gate:** full suite green before `/gsd-verify-work`, plus the existing `contrast.test.ts` (unaffected by this phase's zero-new-CSS Pulse Category reuse, but worth a quick confirm run since colored chips are involved) and `accessibilityLayer`/keyboard-nav manual spot-check per CLAUDE.md's non-negotiable accessibility floor (no automated Recharts a11y test exists in this suite today — this is a human-verify item, not a gap to fill with new automation this phase).

### Wave 0 Gaps
- [ ] `frontend/src/components/FilterBar.test.tsx` — does not exist today; `FilterBar.tsx` is currently only exercised indirectly via `smoke.test.tsx`. Given this phase rewrites most of the component's interactive surface, direct component tests are warranted, not optional.
- [ ] Backend time-of-day boundary unit tests — new test coverage, exact location (sibling to `derivations.py` vs. inline in `deps.py`'s test file) is a plan-time decision per Focus Answer 5's placement note.
- [ ] `test_api_readings.py` extensions for `IN`-clause OR-within-group, empty-selection-means-all, and midnight-wrap time-of-day behavior — no gap in *framework*, just in test cases; straightforward parametrize-and-extend of existing patterns.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — this phase touches no auth surface |
| V3 Session Management | No | Unaffected |
| V4 Access Control | No | Unaffected — `/readings`/`/stats/summary` remain behind the existing Bearer-token gate (Phase 5), unchanged by this phase |
| V5 Input Validation | Yes | FastAPI `Literal`/`list[Literal]` query-param validation (422 on any value outside the closed vocabulary — verified existing behavior via `test_invalid_params_return_422`); Pydantic `Literal`/`list[Literal]` on the agent schema side, with the existing `_lower_tokens` normalizer as defense-in-depth against enum-casing drift from Claude's structured output |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter values | Tampering | Not newly at-risk — SQLAlchemy's `.in_()` and `extract()` are fully parameterized query-builder calls, never raw string interpolation; this phase does not introduce any `text()`/raw-SQL construction |
| Malformed/oversized filter-value lists as a resource-exhaustion vector | Denial of Service | `Literal` typing already caps each list element to a closed 3–6-value vocabulary (an attacker can repeat the same query param many times, but each value must match the enum or 422s immediately before hitting the DB) — no new guard needed beyond what `Literal` already provides; if a plan wants extra hardening, a `max_length` on the list param (`Query(max_length=6)`) would be a cheap, non-load-bearing addition, not a gap that blocks this phase |
| Agent producing an out-of-vocabulary token that reaches the DB query | Tampering | `AgentOutput`'s closed-union Pydantic validation already rejects this at the parse boundary — Claude literally cannot emit a token outside the `Literal` vocabulary through constrained sampling (CLAUDE.md's own stated security rationale for structured outputs), and the same protection extends automatically to the new list-typed fields since they're still `Literal`-based |

## Environment Availability

Skipped — this phase is pure application code within the existing, already-provisioned stack (Python/FastAPI/SQLAlchemy backend, React/Vite frontend, SQLite dev DB). No new external tool, service, or runtime dependency is introduced.

## Package Legitimacy Audit

Not applicable — this phase introduces **zero new external packages** (UI-SPEC's own Design System table: "no component library, hand-rolled" — confirmed by reading the spec and cross-checking `frontend/package.json`/`backend/pyproject.toml`, neither of which needs a new entry for anything described here). The Package Legitimacy Gate is scoped to external package installs and does not apply.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Time-of-day boundary hours (Morning 05:00–11:59, Afternoon 12:00–16:59, Evening 17:00–20:59, Night 21:00–04:59) are a reasonable default, not independently confirmed with Chris | Common Pitfalls / Locked Decisions | If Chris has a different mental model (e.g., "evening" starting at 18:00), the filter would technically work but misclassify readings relative to his expectation — UI-SPEC itself already flags this as unconfirmed, carried forward here rather than newly introduced |
| A2 | FastAPI's `Annotated[list[Literal[...]] \| None, Query()]` pattern behaves as documented (repeated query params → list, 422 on any invalid element) on this project's pinned FastAPI 0.139.x | Focus Answer 2 | If behavior differs on this specific version, the `IN`-clause filters could silently accept malformed input or fail to parse repeated params — mitigated by the recommendation that the planner's first backend task include the regression tests, run against this project's actual pinned version, before trusting the pattern |
| A3 | SQLAlchemy `extract('hour', ...)` compiles correctly for both this project's SQLite dev DB and Postgres prod DB without dialect-specific code | Focus Answer 2 / Pitfall 2 | If the compiled SQL differs unexpectedly on one dialect, time-of-day filtering could silently return wrong results on dev *or* prod while looking correct on the other — mitigated by recommending the boundary/midnight-wrap test run against the actual dev SQLite DB as part of Wave 0, not just asserted from documentation |
| A4 | The recommended "sibling `*_all: bool` clear flag" design (Focus Answer 3, option 1) for the agent's am_pm/bp_category "clear filter" signal is the best fit — this is a judgment call, not a verified fact | Focus Answer 3 | If the alternative (`"all"` as a special list value) is actually preferred by the planner/user, no functional harm, just a different (also valid) schema shape — flagged as a decision point specifically so it isn't silently defaulted either way without consideration |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. ~~**AM/PM vs. Time of Day coexistence (UI-SPEC §10) — blocks store-shape lock-in.**~~ **RESOLVED
   2026-09-16.** Asked the user directly before planning: **Option B — Time of Day replaces AM/PM
   entirely.** Drop the `amPm` group and its store field outright; the four-bucket Time of Day filter
   (§11) is the one time-of-day control. The planner MUST NOT carry `amPm` forward into the v2→v3
   store migration — the migration only needs to handle `bpCategory` becoming multi-valued (single
   string → array), with no `amPm` field to migrate at all. `prompt.py`'s existing "mornings"→am,
   "evenings"→pm vocabulary routes to the new `time_of_day` tokens (`morning`/`evening`) instead.
   Original framing kept below for traceability.
   - What we know: UI-SPEC ships "Option A — coexist" as the shipped default (citing `ROADMAP.md`'s framing of `amPm` becoming multi-valued, read together with its "Primary risk" section, as stronger evidence of an intended two-group design), but its own author recommends "Option B — replace" as simpler, trap-free, and a smaller diff, and explicitly asks for a human yes/no before the store shape locks.
   - What's unclear: whether Chris (the actual end user) has an opinion on this, or whether "no strong opinion, ship the recommended option" is an acceptable path for `/gsd-plan-phase 15` to take unilaterally.
   - Recommendation: surface this exact question to the user before or during planning (per the UI-SPEC's own instruction), since it changes the store shape (`store/filters.ts`'s field count), the agent's `prompt.py` vocabulary for "mornings"/"evenings" routing, and the live-sentence segment count — a decision reversed *after* implementation starts is a real rework cost, not a cosmetic one.

2. **The agent's "clear this filter back to all" mechanism for list-typed `am_pm`/`bp_category` (Focus Answer 3).**
   - What we know: the current singular schema handles this via an `"all"` token; a bare list-typed field loses that expressiveness unless something replaces it.
   - What's unclear: which of the two options (sibling boolean flag vs. retained `"all"` sentinel inside the list) the planner should commit to — both are valid, this research recommends the sibling-flag approach but flags it as a judgment call (Assumption A4), not a settled fact.
   - Recommendation: decide explicitly during planning (not silently during coding); whichever is chosen, `prompt.py`'s "back to all categories"/"show all times" vocabulary needs a matching update either way.

3. **Does FastAPI (this project's pinned 0.139.x) resolve an entirely-omitted `list[X] | None` query param to `None` or to `[]`?**
   - What we know: training knowledge and general FastAPI documentation say `None` (the declared default), consistent with existing singular-filter behavior in this codebase.
   - What's unclear: not independently verified against a running instance of this project's exact pinned version in this research session (no test execution was performed).
   - Recommendation: the planner's first backend task for the `IN`-clause conversion should include an explicit test asserting this (`GET /readings` with no `bp_category` param at all returns every row, not zero) as its very first regression test, before building anything on top of the assumption.

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `frontend/src/store/filters.ts` — full v1→v2 migration implementation, read in full
- `backend/app/deps.py`, `backend/app/routers/readings.py`, `backend/app/routers/stats.py` — current `ReadingFilters` implementation, confirmed no existing `IN`-clause via `grep -rn "\.in_(" backend/app`
- `backend/app/agent/schemas.py` — `ShowOnly.datasets: list[DatasetToken]` precedent, `_lower_tokens`/`_lower_value` list-handling, read in full
- `frontend/src/lib/agent.ts`, `frontend/src/lib/showSentence.ts` — `composeConfirmation`, `joinWithAnd`, confirmed already wired together
- `backend/app/derivations.py`, `backend/app/models.py`, `backend/tests/test_categories.py` — `pulse_category` column + `classify_pulse` derivation + existing test coverage, confirmed pre-existing and unaffected by this phase
- `.planning/phases/15-.../15-UI-SPEC.md` — full design contract, read in full
- `.planning/phases/14-.../14-CONTEXT.md`, `.planning/ROADMAP.md` (Phase 15 entry) — origin/scope context
- `backend/tests/test_api_readings.py`, `frontend/src/store/filters.test.ts`, `backend/tests/test_agent_schemas.py` — existing test patterns to extend

### Secondary (MEDIUM confidence — web-verified against current docs)
- FastAPI list-`Query()` parameter behavior (repeated params → list, per-item `Literal` validation) — [CITED: fastapi.tiangolo.com/tutorial/query-params-str-validations/](https://fastapi.tiangolo.com/tutorial/query-params-str-validations/) cross-referenced with community examples
- SQLAlchemy `column.in_([])` empty-list-compiles-to-false behavior — [CITED: SQLAlchemy core documentation](https://docs.sqlalchemy.org/en/20/core/sqlelement.html) and SQLAlchemy GitHub issue/discussion threads on expanding-`IN` empty-list handling
- SQLAlchemy `extract()` cross-dialect compilation (Postgres native `EXTRACT`, SQLite `CAST(STRFTIME(...))`) — [CITED: SQLAlchemy SQLite dialect documentation](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html), cross-referenced against SQLAlchemy compiler-internals discussion

### Tertiary (LOW confidence)
- None — every claim in this document is either a direct codebase read or cross-referenced against current official/semi-official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new packages) — HIGH confidence there is nothing to add
- Store migration pattern (Focus 1): HIGH — verbatim existing code, direct read
- Backend `IN`-clause + time-of-day (Focus 2): MEDIUM-HIGH — sound, cross-referenced pattern, not live-tested in this session
- Agent schema conversion (Focus 3): HIGH for mechanics, MEDIUM for the "all"-clear-signal design fork (a genuine open decision, not a verifiable fact)
- Spoken confirmation grammar (Focus 4): HIGH — verbatim existing code, direct read, already wired
- Sequencing risk (Focus 5): HIGH — derived directly from the asymmetry visible in the codebase (one filter has full existing precedent, the other has none)

**Research date:** 2026-09-16
**Valid until:** ~30 days (stable stack, no external API dependency for this phase's core logic — the one time-sensitive element, FastAPI/SQLAlchemy behavior confirmation, should be re-verified with a live test run at plan/execute time regardless of this document's age, per Open Question 3)
