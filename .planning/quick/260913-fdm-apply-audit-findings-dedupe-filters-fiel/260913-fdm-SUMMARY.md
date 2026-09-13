---
phase: quick-260913-fdm
plan: 01
subsystem: cross-cutting (backend deps/ETL + frontend hooks/lib/components)
tags: [refactor, deduplication, no-behavior-change, audit-followup]
requires: []
provides:
  - "backend/app/deps.py DateRangeFilters — one date-range filter base for all four read routes"
  - "frontend/src/hooks/useRecordEvents.ts — one record-query hook body"
  - "frontend/src/lib/agent.ts useAgentPulseFlash() — one copy of the D-08 pulse effect"
  - "frontend/src/components/fields.tsx TextField — one label+input primitive"
  - "frontend/src/components/rdpSizing.ts — one react-day-picker sizing object"
affects: []
tech-stack:
  added: []
  removed: ["@fontsource/atkinson-hyperlegible (declared, never imported)"]
  patterns:
    - "SQLAlchemy filter base parameterized by (model class, attribute NAME as str) — never by the InstrumentedAttribute, which is a descriptor"
    - "pandas itertuples over iterrows for row walks"
key-files:
  created:
    - frontend/src/hooks/useRecordEvents.ts
    - frontend/src/components/fields.tsx
    - frontend/src/components/rdpSizing.ts
  deleted:
    - frontend/src/hooks/useLabs.ts
    - frontend/src/hooks/useIncidents.ts
    - frontend/src/hooks/useProcedures.ts
  modified:
    - backend/app/deps.py
    - backend/app/etl.py
    - frontend/src/App.tsx
    - frontend/src/lib/agent.ts
    - frontend/src/lib/copy.ts
    - frontend/src/lib/dates.ts
    - frontend/src/lib/datasetMeta.ts
    - frontend/src/lib/overlayEvents.ts
    - frontend/src/lib/showSentence.ts
    - frontend/src/hooks/useVoiceCommand.ts
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/FilterBar.tsx
    - frontend/src/components/ShowPanel.tsx
    - frontend/src/components/ChartViewSwitcher.tsx
    - frontend/src/components/DateRangePicker.tsx
    - frontend/src/components/records/SingleDateField.tsx
    - frontend/src/components/records/LabFields.tsx
    - frontend/src/components/records/IncidentFields.tsx
    - frontend/src/components/records/ProcedureFields.tsx
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - "Item 1 took the base-class route (DateRangeFilters), not the pre-approved _apply_date_range helper fallback — FastAPI introspects the inherited __init__ correctly, verified against the generated OpenAPI schema"
  - "Item 9 (the two sort/perf fixes) was NOT applied: ReadingsTable.test.tsx explicitly locks 'sorts newest-first regardless of input order' and feeds a deliberately shuffled array, so the item's premise (components may rely on the API's ascending order) is contradicted by the suite"
  - "rdpSizing lives in its own module rather than fields.tsx — a file exporting both a component and a non-component trips oxlint react(only-export-components) and breaks Fast Refresh"
metrics:
  duration: ~16 min
  completed: 2026-09-13
  tasks: 3
  items_applied: 9 of 10
  net_lines: "-41 (470 insertions, 511 deletions)"
---

# Quick Task 260913-fdm: Apply Audit Findings Summary

Nine of ten audit findings applied as pure refactors — one shared filter base, one record hook, one pulse effect, one TextField, four single-sourced helpers, one dependency removed — with both suites unchanged at baseline and a net deletion of 41 lines.

## What Was Done

### Task 1 — Backend (commit `82790eb`)

**Item 1 — filter classes collapsed.** `DateRangeFilters` now owns the
`start_date`/`end_date` parsing and the inclusive end-of-day semantics.
`LabFilters` / `ProcedureFilters` / `IncidentFilters` are three-line subclasses
declaring only `_model` + `_field`; `ReadingFilters` overrides `__init__` to add
`am_pm` / `bp_category` and chains `super().apply(stmt)`.

The plan's verified hazard held exactly as described: the column must be
resolved via `getattr(self._model, self._field)` at apply time. An
`InstrumentedAttribute` stored as a plain class attribute is a descriptor and
resolves through `__get__` against the *filter* instance.

**Item 10 — ETL loops.** Both `transform()` row walks moved from `iterrows()` to
`itertuples()`; `_validate_row` now takes the namedtuple (attribute access,
`getattr(row, field)`) and lost its `pd.Series` hint. Single caller, verified.

### Task 2 — Frontend libs (commit `8d1b920`)

- **Item 3:** `useRecordEvents.ts` replaces the three byte-identical hook files. Same export names, same `(window, enabled)` signature, same `"labs"`/`"incidents"`/`"procedures"` query-key strings that `useCreateRecord.ts` invalidates against.
- **Item 4:** `useAgentPulseFlash()` holds the single copy of the 1500 ms D-08 pulse effect; FilterBar, ShowPanel and ChartViewSwitcher each became one line. ShowPanel and ChartViewSwitcher no longer import React at all.
- **Item 5:** The three event entries in `datasetMeta.ts` spread `OVERLAY_META[k]` instead of re-projecting five fields each. TypeScript accepted the spread with no `DatasetEntry` widening — `tableLabel` riding along is harmless, as the plan predicted.
- **Item 6:** `joinWithAnd` and `fmtLongDateOnly` each collapsed to one definition (`showSentence.ts` and `dates.ts` respectively). `joinWithOr` became `Intl.ListFormat` disjunction — identical output for the 0/1/2/3+ cases, and `overlayEvents.test.ts` passes untouched.
- **Item 7:** `RATE_LIMIT_COPY` / `OFFLINE_COPY` moved to `lib/copy.ts`. The stale "duplicated on purpose" comment in `useVoiceCommand.ts` was rewritten, and `copy.ts`'s header dropped its now-false "holds exactly one string" claim while keeping the three-failure-moments warning.

### Task 3 — Frontend components (commit `6322bc5`)

- **Item 2:** `components/fields.tsx` exports `TextField`, which absorbed **all 17** label+input blocks (LabFields 6, IncidentFields 4, ProcedureFields 4, SingleDateField 1, DateRangePicker 2). **No field was left inline.** The prop surface is exactly the one the plan fixed — `label`, `value`, `onChange`, `type`, `inputMode`, `placeholder`, `maxLength`, `multiline`, `invalid`, `error` — nothing added.
- **Item 8:** `@fontsource/atkinson-hyperlegible` removed. `package-lock.json` diff is **10 deletions, 0 additions** — the T-fdm-SC mitigation, verified explicitly.

## Deviations from Plan

### 1. [STOP RULE] Item 9 not applied — both halves reverted

**Found during:** Task 3 verification.

`ReadingsTable.test.tsx` contains:

```
test("sorts newest-first regardless of input order", () => {
  const newest = makeReading(44, { systolic: 199, diastolic: 99 });
  const shuffled = [makeReading(7), newest, makeReading(0), makeReading(30), makeReading(12)];
```

The test name and the deliberately shuffled fixture lock the opposite of what
item 9 assumes. Replacing the sort with `[...readings].reverse()` failed it
immediately (`Expected: 199 / 99`, received the January-13 row). The plan's
claim that "ReadingsTable.test.tsx's fixtures are generated ascending by day
index" is true of `makeReadings(n)` but **not** of this test, which builds its
array by hand out of order.

Making the item work would have required editing that assertion — a behavior
change, forbidden by the plan's stop rule. Reverted.

**I also reverted the StatsStrip half**, which passed only because StatsStrip
has no test. Both halves rest on the same premise, and the plan groups them as
one item. Keeping StatsStrip's unsorted read while ReadingsTable keeps its
defensive sort would leave two sibling components making opposite assumptions
about the same array, with nothing guarding the unprotected one. The
ascending-order comment the plan called "the whole point of the item" went with
it, since the coupling it documents no longer exists.

`localeCompare` therefore still appears in both files, and Task 3's
`SORTS REPLACED` gate does not print. That is the intended outcome, not a
missed step.

**To actually land item 9** someone must first decide whether the API's
ascending order is a contract the frontend may rely on. If yes, that decision
belongs in the ReadingsTable test (rename it, drop the shuffled fixture) as a
deliberate behavior change — not smuggled in under a perf refactor.

### 2. `rdpSizing` split into its own module

**Found during:** Task 3 lint gate.

With `inputClass`, `labelClass`, `rdpSizing` *and* `TextField` all exported from
`fields.tsx`, oxlint emitted a new warning (baseline was zero output):

```
src/components/fields.tsx:27:14: warning react(only-export-components):
Fast refresh only works when a file only exports components.
```

Note oxlint still **exited 0**, so the plan's `npx tsc -b && npx oxlint` gate
would have passed while silently regressing the captured "exit 0, no output"
baseline.

The plan said one file, not two — but that instruction was about *location*
(don't split `components/` from `components/records/`). This split is on a
different axis and is forced by the lint baseline. Resolution:

- `inputClass` / `labelClass` became **module-private**. After the TextField conversion nothing outside `fields.tsx` imports them, so exporting them was dead API.
- `rdpSizing` moved to `components/rdpSizing.ts`. Still exactly one definition — the `rdp-day-width` gate passes.

### 3. Worktree pytest baseline is 279 passed / 0 failed, not 278 + 1 failure

The plan's pre-existing failure —
`test_config_new_fields_default_keyless` — **does not reproduce in this
worktree**, because it is caused by the developer's `backend/.env` setting
`SITE_PASSWORD`, and `.env` is gitignored so it does not exist here.

The worktree baseline captured before any edit was `279 passed, 7 skipped,
43 deselected`, zero failures — and it is still exactly that. The
"278 passed must hold or rise" invariant is satisfied at 279. **There were no
failures at all at any point**, so nothing was masked.

This does mean the pre-existing failure was not re-confirmed here; it will
reappear in the main checkout, where `.env` exists. It remains logged in
STATE.md Blockers, untouched.

### 4. Toolchain had to be provisioned in the worktree

Neither `backend/.venv` nor `frontend/node_modules` exists in a fresh worktree
(both gitignored). Worth recording because the backend case is a trap: the main
repo's venv installs `app` via an **editable-install meta-path finder**, which
takes precedence over `sys.path` and would have silently imported the
*unmodified* main-repo `app` package no matter what `PYTHONPATH` said — i.e.
every test would have passed against the wrong source tree.

Built an isolated worktree venv (dependency copy, excluding the editable
artifacts) and asserted `app.deps.__file__` resolved inside the worktree before
trusting a single result. `npm ci` for the frontend. Both are gitignored and
uncommitted.

## Verification Results

Actual observed counts, final state of the tree:

| Gate | Result | Baseline |
|------|--------|----------|
| `pytest -q` (backend) | **279 passed, 7 skipped, 43 deselected, 0 failed** | 279 passed (worktree) / 278 + 1 pre-existing (main checkout) |
| `ruff check .` | **All checks passed!** | same |
| `npx vitest run` | **37 test files passed, 475 tests passed, 0 failed** | identical |
| `npx tsc -b` | exit 0, no output | identical |
| `npx oxlint` | exit 0, no output | identical |
| OpenAPI param probe | `OPENAPI PARAMS OK` — start_date/end_date on all four routes, am_pm/bp_category on /readings | n/a |
| Test files in diff | **0** | required |
| `git diff --stat` | **470 insertions, 511 deletions → net −41** | net deletion required |

**Was the pre-existing backend failure still the only failure?** There were
**zero** failures in this worktree at every run, baseline included — see
deviation 3. No new failure appeared and none was masked.

### Beyond the plan's gates

Compiled the SQL for all four filter classes with `literal_binds` and compared
it byte-for-byte against the pre-refactor expressions rebuilt by hand, across
full, partial and empty filter combinations:

```
readings.datetime >= '2025-03-01 00:00:00' AND readings.datetime <= '2025-03-31 23:59:59.999999'
  AND readings.am_pm = 'AM' AND readings.bp_category = 'Stage 1'
```

Identical on every combination, including `date.min`/`date.max` (no overflow).
Inclusive end-of-day preserved on both DateTime columns; plain `<=` on both
Date columns.

## Threat Model Follow-through

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-fdm-01 | mitigate | OpenAPI parameter assertion passes — FastAPI still introspects the inherited `__init__`, so `Literal` params still 422 on bad input. Verified by explicit probe, not by the suite alone. |
| T-fdm-02 | mitigate | `_validate_row`'s D-08 gate unchanged in substance; `test_etl` rejection-path suite passes with reason strings asserted verbatim. |
| T-fdm-03 | accept | Two fixed strings moved to a shared module; raw `error.message` / recognizer text still never rendered, and the rewritten comment restates it. |
| T-fdm-SC | mitigate | Lockfile diff confirmed **10 deletions, 0 additions**. No package entered the tree. |

## No Threat Flags

No new network endpoints, auth paths, file-access patterns or schema changes.
Every change is a relocation of existing code.

## Known Stubs

None.

## Excluded by User Decision

The labs/procedures/incidents routers were not merged and not touched.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `82790eb` | Backend: filter base class + ETL itertuples |
| 2 | `8d1b920` | Frontend libs: record hook, pulse hook, helper dedupe |
| 3 | `6322bc5` | Frontend components: TextField, font dep removal |

## Self-Check: PASSED

All three commits present in `git log`. All created files exist
(`useRecordEvents.ts`, `fields.tsx`, `rdpSizing.ts`); all three deleted hook
files absent. Both suites re-run green from the clean post-commit tree.
