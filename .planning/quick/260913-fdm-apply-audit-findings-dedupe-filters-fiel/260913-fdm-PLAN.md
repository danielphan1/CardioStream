---
phase: quick-260913-fdm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/deps.py
  - backend/app/etl.py
  - frontend/src/hooks/useLabs.ts
  - frontend/src/hooks/useIncidents.ts
  - frontend/src/hooks/useProcedures.ts
  - frontend/src/hooks/useRecordEvents.ts
  - frontend/src/hooks/useVoiceCommand.ts
  - frontend/src/App.tsx
  - frontend/src/lib/agent.ts
  - frontend/src/lib/copy.ts
  - frontend/src/lib/dates.ts
  - frontend/src/lib/datasetMeta.ts
  - frontend/src/lib/overlayEvents.ts
  - frontend/src/lib/showSentence.ts
  - frontend/src/components/CommandBar.tsx
  - frontend/src/components/FilterBar.tsx
  - frontend/src/components/ShowPanel.tsx
  - frontend/src/components/ChartViewSwitcher.tsx
  - frontend/src/components/StatsStrip.tsx
  - frontend/src/components/ReadingsTable.tsx
  - frontend/src/components/DateRangePicker.tsx
  - frontend/src/components/fields.tsx
  - frontend/src/components/records/SingleDateField.tsx
  - frontend/src/components/records/LabFields.tsx
  - frontend/src/components/records/IncidentFields.tsx
  - frontend/src/components/records/ProcedureFields.tsx
  - frontend/package.json
  - frontend/package-lock.json
autonomous: true

must_haves:
  truths:
    - "Backend pytest from backend/ ends at exactly the captured baseline: 278 passed, 7 skipped, 43 deselected, and exactly ONE failure — tests/test_auth_upload.py::test_config_new_fields_default_keyless, which is pre-existing (backend/.env sets SITE_PASSWORD; documented in STATE.md Blockers) and unrelated to this work. Any other failure, and any change in the passed/skipped counts, means a behavior change was introduced and the executor stops."
    - "Frontend `npx vitest run` from frontend/ ends at exactly the captured baseline: 37 test files passed, 475 tests passed, 0 failed. No test file was edited, added, or deleted by this task — the suite proving no-behavior-change must be the same suite, byte-for-byte."
    - "`npx tsc -b` exits 0 and `npx oxlint` exits 0 with no output (both clean at baseline); `ruff check .` from backend/ prints 'All checks passed!'."
    - "GET /readings, /labs, /incidents, /procedures emit byte-identical SQL WHERE clauses to before for every combination of start_date/end_date (and am_pm/bp_category on /readings): inclusive end-of-day (23:59:59.999999) on the DateTime columns Reading.datetime_ and Incident.datetime_, plain date comparison on the Date columns LabResult.date and Procedure.date. Bad query values still 422."
    - "Every query parameter still appears in the generated OpenAPI schema for each route (start_date, end_date on all four; plus am_pm, bp_category on /readings) — proof that FastAPI still introspects the (now partly inherited) __init__ signatures."
    - "etl.transform() rejects exactly the same rows with exactly the same reason strings as before, and produces a byte-identical clean frame — proven by the unchanged test_etl / test_categories / test_derivations / test_golden_master / test_idempotency suites."
    - "No user-visible string, accessible name, label, placeholder, aria attribute, CSS class string, query-key string, or exported symbol name changed anywhere in the frontend."
  artifacts:
    - path: "backend/app/deps.py"
      provides: "One shared date-range filter base class; LabFilters/ProcedureFilters/IncidentFilters become near-empty subclasses and ReadingFilters extends it with am_pm + bp_category"
      contains: "class ReadingFilters"
    - path: "backend/app/etl.py"
      provides: "transform()'s two row loops on itertuples() instead of iterrows(); _validate_row adapted to the namedtuple row"
      contains: "itertuples"
    - path: "frontend/src/components/fields.tsx"
      provides: "Shared TextField component plus the single definitions of inputClass, labelClass and rdpSizing consumed by the three record field-sets, SingleDateField and DateRangePicker"
      contains: "export function TextField"
    - path: "frontend/src/hooks/useRecordEvents.ts"
      provides: "One shared record-query hook body with useLabs / useIncidents / useProcedures as one-line exports, same names and same (window, enabled) signature"
      contains: "export function useLabs"
    - path: "frontend/src/lib/agent.ts"
      provides: "useAgentPulseFlash() hook holding the single copy of the 1500ms D-08 pulse effect"
      contains: "useAgentPulseFlash"
    - path: "frontend/src/lib/copy.ts"
      provides: "RATE_LIMIT_COPY and OFFLINE_COPY as shared consts, with the stale 'duplicated on purpose' comment rewritten"
      contains: "RATE_LIMIT_COPY"
    - path: "frontend/src/lib/dates.ts"
      provides: "fmtLongDateOnly promoted beside fmtLongDate as the single definition"
      contains: "fmtLongDateOnly"
  key_links:
    - from: "backend/app/deps.py filter subclasses"
      to: "FastAPI query-param parsing via Depends()"
      via: "an __init__ signature FastAPI can still introspect (inherited or overridden), verified against the OpenAPI schema — not assumed"
      pattern: "Annotated\\[.*Query\\(\\)\\]"
    - from: "frontend/src/components/StatsStrip.tsx and ReadingsTable.tsx"
      to: "backend/app/routers/readings.py's order_by(Reading.datetime_)"
      via: "an explicit comment at both sites naming the API's ascending-order guarantee the removed/downgraded sort now depends on"
      pattern: "ascending"
---

<objective>
Apply 10 findings from a completed whole-repo over-engineering audit. Every item is a pure
refactor with NO behavior change — the point is that the existing test suites pass unchanged.

The findings are already located and verified. Do NOT re-audit, do NOT re-derive, do NOT look
for additional duplication. Apply exactly these 10 items and stop.

EXCLUDED by explicit user decision — do not plan, do not suggest, do not do: merging the
labs/procedures/incidents routers into one module.

Purpose: delete duplicated code that has already drifted once (SingleDateField's own comment
admits copying rdpSizing verbatim from DateRangePicker) and remove two small perf warts, without
moving a single byte of user-visible behavior.
Output: ~14 duplicated JSX blocks, 3 duplicated hooks, 3 duplicated effects, 4 duplicated helper
definitions, 3 duplicated filter classes and one unused font dependency gone.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
</context>

<baselines>
Captured on this exact working tree immediately before planning. These are the acceptance bar;
any deviation is a regression.

| Command | Working dir | Baseline |
|---------|-------------|----------|
| `.venv/bin/python -m pytest -q` | `backend/` | `1 failed, 278 passed, 7 skipped, 43 deselected` — the 1 failure is ALWAYS and ONLY `tests/test_auth_upload.py::test_config_new_fields_default_keyless` (pre-existing: `backend/.env` sets `SITE_PASSWORD` and pydantic-settings reads it; see STATE.md Blockers). Do not fix it here, do not let it mask a new failure. |
| `.venv/bin/ruff check .` | `backend/` | `All checks passed!` |
| `npx vitest run` | `frontend/` | `Test Files 37 passed (37)`, `Tests 475 passed (475)` |
| `npx tsc -b` | `frontend/` | exit 0, no output |
| `npx oxlint` | `frontend/` | exit 0, no output |

Do NOT edit, add, or delete any test file. The suites are the instrument; changing the
instrument invalidates the measurement.
</baselines>

<stop_rule>
Pure refactors only. If any item turns out to require a behavior change, a test edit, or a
user-visible string/class/attribute change to work — STOP on that item, leave it unapplied,
finish the other items, and surface it explicitly in the SUMMARY. Do not "make it fit".
Partial application of 9 of 10 items is a success; a silent behavior change is not.
</stop_rule>

<tasks>

<task type="auto">
  <name>Task 1: Backend — collapse the four filter classes, switch ETL to itertuples</name>
  <files>backend/app/deps.py, backend/app/etl.py</files>
  <action>
Two independent backend items.

ITEM 1 — `backend/app/deps.py` (lines 43–145). Collapse `LabFilters`, `ProcedureFilters`,
`IncidentFilters` and the date half of `ReadingFilters` into one shared base parameterized by
the target column and whether that column is a DateTime.

Exact semantics to preserve (these are load-bearing medical-data correctness rules, both already
covered by tests):
- DateTime columns (`Reading.datetime_`, `Incident.datetime_`): `>= datetime.combine(start_date,
  datetime.min.time())` and `<= datetime.combine(end_date, datetime.max.time())` — the inclusive
  end-of-day form, deliberately NOT `end_date + 1 day` because that overflows at `date.max`.
- Date columns (`LabResult.date`, `Procedure.date`): plain `>= start_date` / `<= end_date`.
- `ReadingFilters` keeps its `am_pm` and `bp_category` params and their where-clauses.

VERIFIED HAZARD — do not skip this, it was probed against this repo's own SQLAlchemy 2.0.51 and
it fails: storing the column as a plain CLASS attribute (`column = Reading.datetime_`) on the
filter class is a trap. `InstrumentedAttribute` is a descriptor, so `self.column` invokes its
`__get__` with the filter instance and raises
`AttributeError: 'NoneType' object has no attribute 'supports_population'`.

VERIFIED-WORKING shape (probed end-to-end through FastAPI TestClient on this repo — query parsing,
OpenAPI params, 422 on bad input, and literal-bound SQL all confirmed identical):
- Base class holds `_model` (the declarative class) and `_field` (the attribute NAME as a str) as
  class attributes — neither is a descriptor, so both are safe — and resolves the column via
  `getattr(self._model, self._field)` at apply time (on the model CLASS, where `__get__` gets
  `instance=None` and correctly returns the attribute itself).
- `isinstance(col.type, DateTime)` is a correct DateTime-vs-Date discriminator here (probed:
  True for both `datetime_` columns, False for both `date` columns). Declaring the flag
  explicitly per subclass is equally acceptable — pick one, do not do both.
- Base `__init__` takes `start_date` / `end_date` with the existing
  `Annotated[date | None, Query()] = None` annotations. `LabFilters` / `ProcedureFilters` /
  `IncidentFilters` inherit it with no `__init__` of their own — `inspect.signature` follows the
  MRO, so FastAPI introspects the inherited signature correctly (probed: OpenAPI lists
  `start_date`, `end_date`).
- `ReadingFilters` overrides `__init__` with all four params, calls `super().__init__(start_date,
  end_date)`, and its `apply` calls `super().apply(stmt)` then adds the am_pm / bp_category
  clauses (probed: OpenAPI lists all four params; SQL is `datetime <= '...23:59:59.999999' AND
  am_pm = 'AM'`).

Keep the module docstring's pinned-invariant block and carry the per-class rationale comments
(Pitfall 4 inclusive-end-date note, D-04 date-range-only note) onto the base rather than deleting
them — they explain WHY, and the why did not change.

Pre-approved lazier fallback if the base-class route fights back for any reason: keep the four
classes and extract only a module-level `_apply_date_range(stmt, column, start_date, end_date,
is_datetime)` helper that all four `apply` methods call. That removes the duplicated *semantics*
(the part that can drift) while leaving FastAPI's introspection surface completely untouched.
Taking this fallback is a legitimate outcome, not a failure — note it in the SUMMARY.

ITEM 10 — `backend/app/etl.py`. `transform()` walks the frame twice with `iterrows()` (lines 271
and 295), pandas' slowest row access. Switch BOTH loops to `itertuples()` with identical logic.

- Validation loop: needs the row index for `RejectedRow(int(idx), reason)`. Use
  `raw_df.itertuples(index=True)` and read `row.Index`. `_validate_row` currently takes a
  `pd.Series` and subscripts (`row["datetime"]`, `row[field]`) — adapt it to the namedtuple
  (`row.datetime`, `getattr(row, field)`) and update its type hint off `pd.Series`. It is private
  and called from exactly one place (verified: no other reference in app/, tests/ or scripts/),
  so its signature is free to change. Which rows get rejected and the exact reason strings must
  not move.
- Derivation loop: `for row in valid.itertuples(index=False)` (the index is unused there today —
  it is `for _, row`). `row.datetime.to_pydatetime()`, `row.systolic`, `row.diastolic`,
  `row.pulse`, and `pd.isna(row.notes)` all behave identically (probed on a frame with NaT, NaN,
  object-dtype text vitals and pandas-3 `str`-dtype notes). Keep the `int(float(...))` coercion
  exactly as-is — its comment explains why the gate and the coercion must agree by construction.

Safe here because `parse_omron` returns exactly `["datetime","systolic","diastolic","pulse",
"notes"]` and every test frame is built to that same column list (verified) — all five are valid
Python identifiers, so `itertuples` does not fall back to positional `_N` renaming.

Keep both loops' existing D-07/D-08 comment blocks. Do not touch the dedupe block between them.
  </action>
  <verify>
    <automated>cd backend && .venv/bin/python -m pytest -q 2>&1 | tail -3 && .venv/bin/ruff check .</automated>
    <automated>cd backend && .venv/bin/python -m pytest -q tests/test_readings_api.py tests/test_etl.py tests/test_idempotency.py tests/test_golden_master.py -q 2>&1 | tail -3</automated>
    <automated>cd backend && .venv/bin/python -c "
from fastapi.testclient import TestClient
from app.main import app
spec = TestClient(app).get('/openapi.json').json()['paths']
for route in ('/readings','/labs','/incidents','/procedures'):
    names = sorted(p['name'] for p in spec[route]['get'].get('parameters', []))
    print(route, names)
    assert 'start_date' in names and 'end_date' in names, route
assert 'am_pm' in [p['name'] for p in spec['/readings']['get']['parameters']]
assert 'bp_category' in [p['name'] for p in spec['/readings']['get']['parameters']]
print('OPENAPI PARAMS OK')"</automated>
  </verify>
  <done>
pytest reports exactly `1 failed, 278 passed, 7 skipped, 43 deselected` with the single failure
being `test_config_new_fields_default_keyless`; ruff clean; the OpenAPI probe prints
`OPENAPI PARAMS OK` with start_date/end_date on all four routes and am_pm/bp_category on
/readings. `iterrows` no longer appears in backend/app/etl.py.
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend libs — one hook file, one pulse hook, one of each shared helper</name>
  <files>frontend/src/hooks/useRecordEvents.ts, frontend/src/hooks/useLabs.ts, frontend/src/hooks/useIncidents.ts, frontend/src/hooks/useProcedures.ts, frontend/src/hooks/useVoiceCommand.ts, frontend/src/App.tsx, frontend/src/lib/agent.ts, frontend/src/lib/copy.ts, frontend/src/lib/dates.ts, frontend/src/lib/datasetMeta.ts, frontend/src/lib/overlayEvents.ts, frontend/src/lib/showSentence.ts, frontend/src/components/CommandBar.tsx, frontend/src/components/FilterBar.tsx, frontend/src/components/ShowPanel.tsx, frontend/src/components/ChartViewSwitcher.tsx</files>
  <action>
Five independent frontend de-duplications. No exported symbol name, string literal, or query-key
value changes anywhere in this task.

ITEM 3 — collapse `hooks/useLabs.ts`, `useIncidents.ts`, `useProcedures.ts` (byte-identical
modulo the fetcher and the query-key string) into one new `hooks/useRecordEvents.ts`: one shared
body plus three one-line exports. Delete the three old files. Keep the exported names `useLabs` /
`useIncidents` / `useProcedures`, the `(window: DateWindow, enabled: boolean)` signature, the
query-key strings `"labs"` / `"incidents"` / `"procedures"`, `placeholderData: keepPreviousData`
and `staleTime: 5 * 60_000` exactly — `useCreateRecord.ts` invalidates against those key strings.
The only importer is `frontend/src/App.tsx` (lines 29–31, verified); update its three import lines
to one. Carry one copy of the three near-identical header comments (the T-09-06 narrow-keying
rationale) onto the shared body.

ITEM 4 — extract the 9-line D-08 pulse effect copy-pasted in `FilterBar.tsx:63`,
`ShowPanel.tsx:46` and `ChartViewSwitcher.tsx:33` (all three identical: two `useAgentPulse`
selectors, a `PulseField[]` state, a `pulseSeq === 0` early return, a 1500ms timeout, cleanup)
into `useAgentPulseFlash(): PulseField[]` in `lib/agent.ts`, beside `useAgentPulse`. Each call
site becomes `const pulsing = useAgentPulseFlash();` with its existing `pulseClass` logic
unchanged. `lib/agent.ts` gaining `useEffect`/`useState` imports is fine — the module already
exports a zustand store and the whole vitest environment is jsdom (verified). Carry the fullest of
the three comment blocks (FilterBar's, which explains the `seq`-bump rationale and the
`motion-safe:` gating) onto the hook; leave each call site's own local comments alone.

ITEM 5 — `lib/datasetMeta.ts:56-79`. The three event entries re-project `OVERLAY_META` field by
field. Replace each with `{ ...OVERLAY_META[k], kind: "event" }` (literal keys `labs`,
`incidents`, `procedures`). `tableLabel` riding along is harmless. KEEP the `incidents`
explanatory comment verbatim (D-07 — it documents why the label stays "Incidents" rather than
Chris's "hospital stays"). If TypeScript's excess-property check rejects the spread against
`DatasetEntry`, the minimal fix is to widen `DatasetEntry` with an optional `tableLabel?: string`
— do that rather than reverting to field-by-field projection.

ITEM 6 — promote the duplicated helpers to single definitions:
- `joinWithAnd` is defined identically in `lib/agent.ts:153` and `lib/showSentence.ts:11`. Keep
  ONE (export it from `lib/showSentence.ts` and import it in `agent.ts`, or move it to a shared
  lib — either is fine, pick one). It must KEEP omitting the Oxford comma: its output is spoken
  aloud. Keep a comment saying exactly that, because the next person will "fix" it otherwise.
- `fmtLongDateOnly` is defined identically in `lib/agent.ts:170` and `lib/overlayEvents.ts:35`.
  Move it to `lib/dates.ts` beside `fmtLongDate`, export it, import at both old sites. Keep its
  Pitfall-7 comment (routes through `parseDateOnly`, never bare `new Date("YYYY-MM-DD")`).
- `joinWithOr` at `lib/overlayEvents.ts:99` DOES want the Oxford comma, so it can collapse to
  `new Intl.ListFormat("en", { type: "disjunction" }).format(items)` — identical output for the
  0/1/2/3+ cases this uses. Do that, and leave a one-line comment recording the deliberate
  asymmetry: `joinWithOr` is Intl (written, Oxford comma), `joinWithAnd` is hand-rolled (spoken,
  no Oxford comma). `lib/overlayEvents.test.ts` asserts these strings — if any assertion moves,
  revert this sub-item and report it.

ITEM 7 — `RATE_LIMIT_COPY` and `OFFLINE_COPY` are declared with identical strings in
`CommandBar.tsx:51` and `useVoiceCommand.ts:47`. Move both into `lib/copy.ts` as exported consts
and import at both sites. The existing `useVoiceCommand.ts` comment claims the duplication is
deliberate because "raw error strings are NEVER rendered" — a shared const satisfies that exactly
as well, so REWRITE that comment to say the strings are single-sourced in `lib/copy.ts` and that
raw error/recognizer text is still never rendered. Leave `PAUSED_COPY` where it is (single
definition, `useVoiceCommand.ts` owns it) and leave `AGENT_UNAVAILABLE_BANNER_COPY`'s existing
header comment in `copy.ts` intact — but drop its now-false claim that the file "currently holds
exactly one string", and keep its point that the three failure-moment strings must never be merged
with each other.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run 2>&1 | tail -6</automated>
    <automated>cd frontend && npx tsc -b && npx oxlint && echo "TSC+LINT CLEAN"</automated>
    <automated>cd frontend && test ! -e src/hooks/useLabs.ts && test ! -e src/hooks/useIncidents.ts && test ! -e src/hooks/useProcedures.ts && echo "OLD HOOK FILES GONE" && test $(grep -rln 'function joinWithAnd' src | wc -l | tr -d ' ') -eq 1 && test $(grep -rln 'function fmtLongDateOnly' src | wc -l | tr -d ' ') -eq 1 && echo "HELPERS SINGLE-SOURCED"</automated>
    <automated>cd frontend && git diff --name-only | grep -c 'test\.tsx\?$' | grep -qx 0 && echo "NO TEST FILES TOUCHED"</automated>
  </verify>
  <done>
`Test Files 37 passed (37)` / `Tests 475 passed (475)`, tsc and oxlint clean, the three old hook
files are gone, `joinWithAnd` and `fmtLongDateOnly` each have exactly one definition, and no test
file appears in the diff.
  </done>
</task>

<task type="auto">
  <name>Task 3: Frontend components — shared TextField, drop unused font dep, 2 perf fixes</name>
  <files>frontend/src/components/fields.tsx, frontend/src/components/records/SingleDateField.tsx, frontend/src/components/records/LabFields.tsx, frontend/src/components/records/IncidentFields.tsx, frontend/src/components/records/ProcedureFields.tsx, frontend/src/components/DateRangePicker.tsx, frontend/src/components/StatsStrip.tsx, frontend/src/components/ReadingsTable.tsx, frontend/package.json, frontend/package-lock.json</files>
  <action>
ITEM 2 — extract the shared field primitives into ONE new file
`frontend/src/components/fields.tsx` (one file, not two — `DateRangePicker.tsx` lives in
`components/`, not `components/records/`, so a shared home above both is the honest placement):

- `inputClass` — byte-identical in `LabFields`, `IncidentFields`, `ProcedureFields`,
  `SingleDateField` and inline in `DateRangePicker` (verified identical in all five).
- `labelClass` — byte-identical in all of the above (`DateRangePicker` and `SingleDateField`
  inline the same literal).
- `rdpSizing` — the react-day-picker CSS-custom-property object duplicated verbatim between
  `SingleDateField.tsx:20` and `DateRangePicker.tsx:21`; SingleDateField's own comment admits the
  duplication. Delete both copies, import the shared one.
- `TextField` — the label+input primitive replacing ~14 near-identical
  `<label className={labelClass}>Text<input className={inputClass}/></label>` blocks.

`TextField`'s prop surface is fixed by what the 14 call sites actually vary, and nothing more:
`label`, `value`, `onChange(value: string)`, `type` (`"text" | "time"`, default `"text"` — only
`IncidentFields`' Time field needs `"time"`), `inputMode?`, `placeholder?`, `maxLength?`,
`multiline?` (renders a `<textarea>` with the existing `inputClass + " min-h-24 py-2"` — the three
Notes fields), `invalid?` (drives `aria-invalid`), `error?` (renders the existing
`<span role="alert" className="text-[18px] font-normal">` inside the label — only
`DateRangePicker`'s two fields use it). Do not add props beyond these. Do not add a `name`/`id`
mechanism: today's association is implicit via the wrapping `<label>` and must stay implicit, or
accessible names change.

Non-negotiable: the rendered DOM for every converted field must be structurally equivalent to
today — same wrapping `<label>`, same label text as a direct text child, same className strings,
same `placeholder` / `maxLength` / `inputMode` / `aria-invalid` values, `<textarea>` still a
textarea and `type="time"` still a time input. `LabFields.test.tsx`, `IncidentFields.test.tsx`,
`ProcedureFields.test.tsx` and `DateRangePicker.test.tsx` query by accessible name and placeholder
and must pass unchanged.

If a given field cannot go through `TextField` without adding a prop outside the list above, leave
that field inline — an inline outlier is cheaper than a prop nobody else uses. Note any left
inline in the SUMMARY.

ITEM 8 — remove `@fontsource/atkinson-hyperlegible` from `frontend/package.json:14`. It is
declared but never imported (verified: the only hit in the repo is that dependency line;
`main.tsx:10-12` imports Inter 400/600 and Space Grotesk 600 only, and its comment already records
that the Atkinson imports were deliberately removed). Run `npm install` from `frontend/` to update
`package-lock.json`. This is a removal only — no new package enters the tree, so no install-time
legitimacy review applies.

ITEM 9 — two perf fixes, both depending on the same API guarantee:
- `StatsStrip.tsx:118` — delete the per-render `[...readings].sort((a,b) => a.datetime.localeCompare(b.datetime))`
  and use `readings` directly. `/readings` already serves datetime-ascending
  (`backend/app/routers/readings.py:33`, `order_by(Reading.datetime_)`), and `App.tsx:259` passes
  `readings.data ?? []` straight through. Do not mutate `readings` anywhere downstream.
- `ReadingsTable.tsx:70` — needs the opposite (newest-first) order and currently re-sorts. Replace
  `[...readings].sort((a,b) => b.datetime.localeCompare(a.datetime))` with `[...readings].reverse()`
  — O(n) instead of O(n log n), correct because the input order is known. Keep the copy: `.reverse()`
  mutates in place and `readings` is the query cache's array.
- Add a brief comment at BOTH sites naming the dependency on the API's ascending order, so the
  coupling is visible to whoever next touches the router. That comment is the whole point of the
  item — do not skip it.

`ReadingsTable.test.tsx`'s fixtures are generated ascending by day index (verified), so `.reverse()`
reproduces today's newest-first output exactly. There is no `StatsStrip.test.tsx`; the sparkline
direction is covered via `StatsSparkline.test.tsx`.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run 2>&1 | tail -6</automated>
    <automated>cd frontend && npx tsc -b && npx oxlint && echo "TSC+LINT CLEAN"</automated>
    <automated>cd frontend && ! grep -q atkinson package.json && ! grep -q atkinson package-lock.json && echo "FONT DEP GONE"</automated>
    <automated>cd frontend && test $(grep -rc 'rdp-day-width' src | grep -v ':0$' | wc -l | tr -d ' ') -eq 1 && echo "RDPSIZING SINGLE-SOURCED" && ! grep -q 'localeCompare' src/components/StatsStrip.tsx src/components/ReadingsTable.tsx && echo "SORTS REPLACED"</automated>
    <automated>cd frontend && git diff --name-only | grep -c 'test\.tsx\?$' | grep -qx 0 && echo "NO TEST FILES TOUCHED"</automated>
  </verify>
  <done>
`Test Files 37 passed (37)` / `Tests 475 passed (475)`, tsc and oxlint clean, no `atkinson` in
package.json or package-lock.json, exactly one `rdpSizing` definition, neither StatsStrip nor
ReadingsTable calls `localeCompare`, both carry the ascending-order comment, and no test file
appears in the diff.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→API query params | `start_date` / `end_date` / `am_pm` / `bp_category` cross here; Task 1 rewrites the class that parses and validates them |
| uploaded .xlsx→ETL | Task 1 rewrites `transform()`'s row loops, which sit behind the `POST /upload` row-validation gate |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fdm-01 | Tampering | `deps.py` filter classes | mitigate | The refactor must keep FastAPI introspecting the `__init__` signature, or params silently stop being validated (a `Literal` that no longer 422s is an injection surface). Verified by an explicit OpenAPI-parameter assertion in Task 1's verify block, not by the test suite alone. |
| T-fdm-02 | Tampering | `etl.transform()` row validation | mitigate | `_validate_row` is the D-08 gate rejecting non-finite/non-integer/non-positive vitals from an uploaded file. The itertuples rewrite must not widen it; proven by the unchanged `test_etl` rejection-path suite (reason strings asserted verbatim). |
| T-fdm-03 | Information disclosure | `lib/copy.ts` shared failure strings | accept | Item 7 moves two fixed strings to a shared module; the invariant that raw `error.message` / recognizer errors are never rendered is unaffected and the rewritten comment restates it. |
| T-fdm-SC | Tampering | npm dependency tree | mitigate | Item 8 is a dependency REMOVAL plus a lockfile update. No package is added, so no new code enters the tree and no legitimacy audit is required. Verify `package-lock.json`'s diff contains only removals of `@fontsource/atkinson-hyperlegible` entries. |
</threat_model>

<verification>
After all three tasks, from a clean tree:

1. `cd backend && .venv/bin/python -m pytest -q` → `1 failed, 278 passed, 7 skipped, 43 deselected`,
   failure is `test_config_new_fields_default_keyless` only.
2. `cd backend && .venv/bin/ruff check .` → `All checks passed!`
3. `cd frontend && npx vitest run` → `37 passed (37)` / `475 passed (475)`.
4. `cd frontend && npx tsc -b && npx oxlint` → both exit 0, no output.
5. `git diff --stat` shows a net line DELETION overall (this is a de-duplication task; a net
   addition means an abstraction was built that costs more than the duplication it replaced —
   report it if so).
6. No file matching `*test.ts` / `*test.tsx` / `test_*.py` appears anywhere in `git diff --name-only`.
</verification>

<success_criteria>
- All 10 items applied, or any unapplied item explicitly surfaced in the SUMMARY with the reason
  it would have required a behavior change.
- Both suites green at exactly their captured baselines, with zero test-file edits.
- The labs/procedures/incidents routers are untouched (excluded by user decision).
- No user-visible string, accessible name, CSS class string, query-key, or exported symbol changed.
</success_criteria>

<output>
Create `.planning/quick/260913-fdm-apply-audit-findings-dedupe-filters-fiel/260913-fdm-SUMMARY.md` when done.
Record in it: which of the 10 items applied cleanly, whether Task 1 took the base-class route or
the pre-approved `_apply_date_range` helper fallback, any field left inline rather than routed
through `TextField`, and the final `git diff --stat` net line count.
</output>
