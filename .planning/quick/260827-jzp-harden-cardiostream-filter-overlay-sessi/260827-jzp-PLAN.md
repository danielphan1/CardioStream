---
phase: quick-260827-jzp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/store/filters.ts
  - frontend/src/main.tsx
  - frontend/src/store/filters.test.ts
autonomous: true

must_haves:
  truths:
    - "After setting any combination of activeChart/datePreset/customRange/amPm/bpCategory/overlayDatasets via the store's own setters, an involuntary reload (simulated in tests via a fresh initFilters() call against the same localStorage) restores exactly those values -- a voice-built multi-step filter session (e.g. 'last 30 days, mornings only, stage 2, overlay incidents') survives a Safari/iOS reclaim instead of silently reverting to defaults."
    - "A corrupted, wrong-shape, or missing 'hv-filters' localStorage value never throws and never partially applies -- initFilters() leaves the pre-existing in-memory defaults completely untouched in every one of those three cases."
    - "Every one of the 7 mutating actions (setActiveChart, setDatePreset, setCustomRange, setAmPm, setBpCategory, setOverlayDataset, showAllData) persists the FULL current 6-field slice to localStorage immediately after updating state -- not just some of them."
    - "The store creation pattern matches theme.ts/speech.ts's hand-rolled try/catch localStorage philosophy exactly (STORAGE_KEY constant, guarded read*/store* functions, an explicit init action) -- zustand/middleware's persist middleware is not imported or used anywhere in the codebase."
    - "All pre-existing filters.test.ts behaviors (preset/custom exclusivity, single-select AM/PM and BP category, showAllData, overlay multi-select) still pass unchanged, and the wider suite (theme/speech/auth/agentStatus/guide/view stores, all components) shows zero regressions against the 2026-08-27 baseline of 30 test files / 347 tests."
  artifacts:
    - path: "frontend/src/store/filters.ts"
      provides: "STORAGE_KEY = \"hv-filters\"; a PersistedFilters type; a shallow-shape isPersistedFilters(value: unknown) type guard; guarded readStoredFilters()/storeFilters() functions; an initFilters action; a persistCurrent() helper wired into all 7 mutating setters; store creator changed from create<FilterState>((set) => ...) to create<FilterState>((set, get) => ...)"
      contains: "const STORAGE_KEY = \"hv-filters\""
    - path: "frontend/src/main.tsx"
      provides: "useFilters.getState().initFilters() called before createRoot().render(), alongside the existing initTheme()/initSpeech() calls"
      contains: "initFilters()"
    - path: "frontend/src/store/filters.test.ts"
      provides: "localStorage.clear() added to beforeEach; new coverage for initFilters() restoring a valid blob, initFilters() no-op/no-throw on corrupted or wrong-shape or missing data, and a setter persisting its change to the 'hv-filters' localStorage key"
      contains: "initFilters"
  key_links:
    - from: "frontend/src/store/filters.ts (each of the 7 setters)"
      to: "frontend/src/store/filters.ts (storeFilters via persistCurrent())"
      via: "a persistCurrent() call as the last statement in each setter body"
      pattern: "persistCurrent\\(\\);"
    - from: "frontend/src/main.tsx"
      to: "frontend/src/store/filters.ts (useFilters.getState().initFilters)"
      via: "a bootstrap call before createRoot().render(), mirroring useTheme.getState().initTheme() and useSpeech.getState().initSpeech()"
      pattern: "useFilters\\.getState\\(\\)\\.initFilters\\(\\)"
    - from: "frontend/src/components/ChartDeck.tsx (unchanged, read-only reference)"
      to: "a restored-but-unrecognized activeChart value"
      via: "CHART_REGISTRY.find((c) => c.id === activeChart) ?? CHART_REGISTRY[0] -- the existing downstream fallback this plan deliberately relies on instead of full enum validation in the type guard"
      pattern: "CHART_REGISTRY\\.find"
---

<objective>
Harden CardioStream's filter/overlay session (`useFilters` in `frontend/src/store/filters.ts`) against
reload/tab-reclaim data loss. This is the ONLY zustand store in the codebase with zero localStorage
persistence -- `activeChart`, `datePreset`, `customRange`, `amPm`, `bpCategory`, and `overlayDatasets`
currently live in memory only, so a Safari/iOS involuntary reload (CLAUDE.md's named #1 device-test
risk) silently erases a voice-built multi-step filter session with zero warning to the user
(impeccable critique P1, 2026-08-27 re-critique).

Fix by mirroring the codebase's existing hand-rolled localStorage pattern (`store/theme.ts`,
`store/speech.ts`, `store/auth.ts`) exactly, adapted for filters.ts's 6-field shape -- explicit
`initFilters()` bootstrap action (not read-at-creation like auth.ts), one JSON blob under a single
`STORAGE_KEY`, a shallow shape-only type guard that never partially applies or throws, and a shared
`persistCurrent()` helper called from all 7 mutating setters so persistence can't be silently
forgotten by a future new setter. Do NOT use zustand's `persist` middleware -- this codebase has
never used it and the philosophy is deliberately hand-rolled guarded try/catch.

Purpose: stop a Safari/iOS reload from silently discarding a voice-built filter session -- the app's
core value proposition (voice-driven, hands-free data exploration) is defeated if a routine OS-level
tab reclaim erases 4+ voice commands' worth of state with no recovery path.

Output: `filters.ts` hardened with guarded persistence; `main.tsx` wired to bootstrap it; new test
coverage in `filters.test.ts` proving restore-on-reload, safe degradation on corrupt/missing data, and
setter-level persistence -- committed in one commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@frontend/src/store/filters.ts
@frontend/src/store/filters.test.ts
@frontend/src/store/theme.ts
@frontend/src/store/speech.ts
@frontend/src/store/speech.test.ts
@frontend/src/store/auth.ts
@frontend/src/main.tsx
@frontend/src/components/ChartDeck.tsx
@frontend/src/api/types.ts
</context>

<starting_state>
Facts already established during planning -- do not re-derive:

- Pre-flight baseline (recorded at planning time, 2026-08-27): `cd frontend && npx vitest run`
  currently reports **30 test files, 347 tests, all passing**. `npx tsc -b` is clean (no errors).
  `npx oxlint` reports exactly 3 pre-existing warnings, all in files this plan does not touch
  (LabFields.tsx, IncidentFields.tsx, ProcedureFields.tsx -- missing `canSubmit` hook dependency).
  Use this live baseline, not any other number, when verifying "zero regressions."
- `store/theme.ts` and `store/speech.ts` establish the exact pattern to mirror: a module-level
  `STORAGE_KEY` constant, a `readStored*()` function and a `store*()` function each wrapped in
  try/catch (localStorage access can throw -- Chromium with site data blocked throws SecurityError
  on mere access, Safari private mode throws on setItem), and an explicit `init*()` action called
  from `main.tsx` before `createRoot().render()`. `store/auth.ts` reads its token synchronously AT
  STORE CREATION instead (because it must be correct on the very first render for the LoginGate
  check) -- filters.ts has no such first-render-correctness requirement, so it follows
  theme.ts/speech.ts's explicit-init pattern, NOT auth.ts's read-at-creation pattern.
  `speech.test.ts` establishes the exact test technique to mirror: `localStorage.clear()` in
  `beforeEach`, manually `localStorage.setItem(...)` a value, call the store's own init action,
  assert the resulting state -- no `vi.resetModules()` needed.
- `ChartDeck.tsx` (line ~131) already does
  `CHART_REGISTRY.find((c) => c.id === activeChart) ?? CHART_REGISTRY[0]` -- this existing downstream
  fallback is why the type guard in this plan validates SHAPE only (primitive types), not exact enum
  membership (e.g. that `activeChart` is one of the 4 valid `ChartId` literals). This is deliberate
  defense-in-depth, not a gap to close in this plan.
- `frontend/src/lib/dates.ts` declares `DatePreset = "7d" | "30d" | "90d" | "all" | "custom"`.
  `frontend/src/api/types.ts` declares `ChartId` (4 literals), `BPCategory` (6 literals), and
  `OverlayDataset = "labs" | "incidents" | "procedures"`.
- Out of scope, do not touch: cross-tab sync (no `storage` event listener -- this fixes single-tab
  reload/reclaim, not simultaneous multi-tab sync), a schema version field (no prior schema exists to
  migrate from; the type guard is the self-healing mechanism for future field changes), and
  `agentStatus.ts`, `guide.ts`, `view.ts`, `theme.ts`, `speech.ts`, `auth.ts` (all read-only
  references in this plan, not modified).
</starting_state>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Harden filters.ts with guarded localStorage persistence and wire main.tsx</name>
  <files>frontend/src/store/filters.ts, frontend/src/main.tsx</files>
  <behavior>
    - A shallow shape-only type guard (name it `isPersistedFilters`, signature
      `(value: unknown): value is PersistedFilters`) returns true for a plain object with all 6
      fields present and correctly primitively-typed: `activeChart`/`datePreset`/`amPm`/`bpCategory`
      each `typeof === "string"`; `customRange` a non-null object whose `from` and `to` are each
      `string | null`; `overlayDatasets` a non-null object whose `labs`/`incidents`/`procedures` are
      each `typeof === "boolean"`.
    - The same guard returns false for: `null`, a non-object primitive (e.g. the string
      `"garbage"`), an array, an object missing any of the 6 keys, or an object where any field has
      the wrong primitive type (e.g. `overlayDatasets.labs` as the string `"true"` instead of the
      boolean `true`). It does NOT check that `activeChart`/`datePreset`/`amPm`/`bpCategory` are one
      of their exact literal union members -- shape only.
    - A module-private `readStoredFilters(): PersistedFilters | null` returns `null` (never throws)
      when the `"hv-filters"` localStorage key is absent, when `JSON.parse` throws on corrupted
      content, or when the parsed value fails `isPersistedFilters`; it returns the parsed value
      otherwise.
    - A module-private `storeFilters(filters: PersistedFilters): void` writes the full 6-field slice
      as one JSON blob under `"hv-filters"` and never throws, even if `localStorage.setItem` itself
      throws.
    - A new `initFilters` action applies `readStoredFilters()`'s result via `set()` when non-null;
      when `null`, it leaves the existing in-memory defaults completely untouched (no partial
      `set()` call at all).
    - Each of the 7 mutating actions (`setActiveChart`, `setDatePreset`, `setCustomRange`, `setAmPm`,
      `setBpCategory`, `setOverlayDataset`, `showAllData`) calls a shared `persistCurrent()` helper
      as the last statement in its body, so every persisted-field mutation is written to localStorage
      immediately, and a future new setter can't forget to wire this in without it being obvious.
  </behavior>
  <action>
In frontend/src/store/filters.ts, add a module-level `const STORAGE_KEY = "hv-filters";` (mirroring
theme.ts's/speech.ts's exact naming convention, one string literal per store).

Add a `type PersistedFilters` (not exported -- purely internal to this module) with exactly these 6
fields, matching the corresponding `FilterState` field types: `activeChart: ChartId`,
`datePreset: DatePreset`, `customRange: { from: string | null; to: string | null }`,
`amPm: "all" | "AM" | "PM"`, `bpCategory: "all" | BPCategory`,
`overlayDatasets: Record<OverlayDataset, boolean>`.

Add `function isPersistedFilters(value: unknown): value is PersistedFilters` implementing the shape
checks from the behavior block above: reject early if `value` is not a non-null object; cast to
`Record<string, unknown>`; check `activeChart`/`datePreset`/`amPm`/`bpCategory` are each
`typeof === "string"`; check `customRange` is a non-null object whose `from` and `to` are each either
`typeof === "string"` or exactly `null`; check `overlayDatasets` is a non-null object whose `labs`,
`incidents`, and `procedures` are each `typeof === "boolean"`; return `true` only if every check
passes. Add a one-line comment above it citing "impeccable P1, 2026-08-27 re-critique" and noting
this is shape-only validation, relying on ChartDeck.tsx's existing `CHART_REGISTRY.find(...) ??
CHART_REGISTRY[0]` fallback for downstream defense against an unrecognized (but shape-valid)
`activeChart` -- do not add exact literal-union validation.

Add `function readStoredFilters(): PersistedFilters | null` wrapped in try/catch (mirroring
theme.ts's `readStoredTheme`/speech.ts's `readStoredEnabled` exactly): inside the try, read
`localStorage.getItem(STORAGE_KEY)`; if `null`, return `null`; otherwise `JSON.parse` it and return
the parsed value only if `isPersistedFilters` accepts it, else return `null`; the catch block returns
`null` unconditionally (any JSON.parse throw or localStorage access throw degrades to "treat as
absent," never a partial application, never a rethrow).

Add `function storeFilters(filters: PersistedFilters): void` wrapped in try/catch (mirroring
theme.ts's `storeTheme`/speech.ts's `storeEnabled` exactly): inside the try,
`localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))`; the catch block is empty with a comment
noting persistence is unavailable but the in-memory state still applies for the session.

In the `FilterState` interface, add `initFilters: () => void;` immediately after the `bpCategory`
field and before `setActiveChart` (mirroring `SpeechState`'s placement of `initSpeech` right after its
data fields and before its setters).

Change the store creator from `create<FilterState>((set) => ({ ... }))` to
`create<FilterState>((set, get) => { ... return { ... }; })` -- a block body, not a direct object
literal, so a `persistCurrent` closure can be declared before the returned state object. Inside that
block, before the `return`, declare `const persistCurrent = () => { ... }` that reads the current
state via `get()` and calls `storeFilters(...)` with an object built from exactly the 6 persisted
fields read off that state (`activeChart`, `datePreset`, `customRange`, `amPm`, `bpCategory`,
`overlayDatasets`). Add a comment above it noting it's called at the end of every mutating setter so
persistence can never be silently forgotten by a future new setter without also being wired in here.

In the returned state object, add `initFilters: () => { const stored = readStoredFilters(); if
(stored) set(stored); },` (placed at the same interface position as above, right after the
`bpCategory` field's initial value and before `setActiveChart`).

Modify each of the 7 existing setters (`setActiveChart`, `setDatePreset`, `setCustomRange`,
`setAmPm`, `setBpCategory`, `setOverlayDataset`, `showAllData`) to become a block-body arrow function
(if it isn't already) that keeps its existing `set(...)` call exactly as-is, then adds
`persistCurrent();` as its final statement. Do not change any setter's existing `set(...)` argument
or behavior -- only append the persistence call.

In frontend/src/main.tsx, add `import { useFilters } from './store/filters'` alongside the existing
`useTheme`/`useSpeech` imports, and add `useFilters.getState().initFilters()` directly after the
existing `useSpeech.getState().initSpeech()` line (with a one-line comment mirroring the existing two
comments' style, e.g. noting this restores the persisted filter/overlay session before first paint),
before the `createRoot(...).render(...)` call.
  </action>
  <verify>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && grep -c 'const STORAGE_KEY = "hv-filters";' src/store/filters.ts</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && grep -c 'function isPersistedFilters(value: unknown): value is PersistedFilters' src/store/filters.ts</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && grep -c 'persistCurrent();' src/store/filters.ts | awk '{print ($1==7) ? "ok-7-setters" : "FAIL: expected 7 persistCurrent() call sites, got " $1}'</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && grep -c 'initFilters()' src/main.tsx</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && npx tsc -b 2>&1 | tail -30</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && npx vitest run src/store/filters.test.ts 2>&1 | tail -30</automated>
  </verify>
  <done>
filters.ts exports the same public API as before (useFilters with all existing fields/setters) plus
a new initFilters action; STORAGE_KEY/isPersistedFilters/readStoredFilters/storeFilters/
persistCurrent exist exactly as specified; all 7 mutating setters call persistCurrent() as their
final statement; main.tsx calls useFilters.getState().initFilters() before createRoot().render(),
alongside the existing initTheme()/initSpeech() calls; tsc -b is clean; the pre-existing
filters.test.ts suite (not yet extended -- that's Task 2) still passes with zero regressions.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add persistence test coverage, verify the full suite, and commit</name>
  <files>frontend/src/store/filters.test.ts</files>
  <action>
In frontend/src/store/filters.test.ts, add `localStorage.clear();` as the first line inside the
existing `beforeEach(() => { ... })` block, immediately before the existing
`useFilters.setState(INITIAL);` line (mirroring speech.test.ts's beforeEach exactly: clear real
localStorage AND reset the in-memory store).

Add a new `describe("initFilters (localStorage bootstrap)", () => { ... })` block with these tests:
(1) "restores a valid persisted blob on initFilters()" -- build a plain object literal with all 6
fields set to values DIFFERENT from INITIAL (e.g. `activeChart: "pulse_trend"`,
`datePreset: "7d"`, `customRange: { from: null, to: null }`, `amPm: "AM"`,
`bpCategory: "Stage 2"`, `overlayDatasets: { labs: true, incidents: false, procedures: true }`),
`JSON.stringify` it into `localStorage.setItem("hv-filters", ...)`, call
`useFilters.getState().initFilters()`, then assert `useFilters.getState()` matches every one of
those 6 field values exactly (not just one -- prove the whole blob round-trips). (2) "leaves defaults
untouched when the persisted value is corrupted JSON" -- `localStorage.setItem("hv-filters",
"garbage")`, wrap the `initFilters()` call in `expect(() => ...).not.toThrow()`, then assert
`useFilters.getState()`'s 6 fields still equal `INITIAL`'s. (3) "leaves defaults untouched when the
persisted value is valid JSON but wrong shape" -- `localStorage.setItem("hv-filters",
JSON.stringify({ activeChart: "pulse_trend", datePreset: "7d", customRange: { from: null, to: null },
amPm: "AM", bpCategory: "Stage 2", overlayDatasets: { labs: "true", incidents: false, procedures:
true } }))` (note `labs` is the STRING `"true"`, not boolean -- exercises the type-guard's per-field
check, not just missing-key detection), call `initFilters()`, assert state still equals `INITIAL`.
(4) "leaves defaults untouched when localStorage has no persisted key" -- call `initFilters()` with
no prior `setItem` call at all, assert state still equals `INITIAL`.

Add a new `describe("setter persistence (writes the 'hv-filters' key)", () => { ... })` block with
these tests: (5) "setDatePreset persists its change to localStorage" -- call
`useFilters.getState().setDatePreset("30d")`, then
`JSON.parse(localStorage.getItem("hv-filters")!)` and assert the parsed object's `datePreset` is
`"30d"` AND its `activeChart` is `"bp_timeline"` (proving the FULL current slice was written, not
just the changed field). (6) "setOverlayDataset persists its change to localStorage" -- call
`useFilters.getState().setOverlayDataset("labs", true)`, parse `localStorage.getItem("hv-filters")`,
assert `overlayDatasets.labs === true`. (7) "a throwing localStorage.setItem never blocks a setter
(guarded try/catch)" -- mirror speech.test.ts's exact technique: save
`const original = Storage.prototype.setItem`, replace it with a function that throws, wrap
`useFilters.getState().setAmPm("AM")` in `expect(() => ...).not.toThrow()`, assert
`useFilters.getState().amPm === "AM"` (state still updates even though persistence silently
failed), then restore `Storage.prototype.setItem = original` in a `finally` block.

After adding all tests, run the full verification suite from `frontend/`: `npx vitest run` (must
show zero failures at the 2026-08-27 baseline of 30 test files / 347 tests, plus the 7 new tests
added here -- net 30 files / 354 tests; if the live pre-Task-1 count differs from 347, diff against
whatever the suite actually reported before Task 1 ran, not the number in this sentence), `npx tsc
-b` (must remain clean), and `npx oxlint` (must report no NEW warnings -- the 3 pre-existing warnings
in LabFields.tsx/IncidentFields.tsx/ProcedureFields.tsx, unrelated to this fix, are expected and not
a regression).

Confirm the diff is scoped correctly: `git diff --stat -- frontend/src/store/filters.ts
frontend/src/main.tsx frontend/src/store/filters.test.ts` should show changes in exactly these 3
files, and `git status --porcelain` should show no other modified files (PRODUCT.md is a pre-existing
untracked file from before this plan and must NOT be swept into this commit).

Once all checks pass, stage exactly the 3 files this plan touches:
`git add frontend/src/store/filters.ts frontend/src/main.tsx frontend/src/store/filters.test.ts`
then commit with message:
`fix(filters): persist filter/overlay session to localStorage (impeccable P1)`
  </action>
  <verify>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && npx vitest run src/store/filters.test.ts 2>&1 | tail -40</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && npx vitest run 2>&1 | tail -10</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && npx tsc -b 2>&1 | tail -20</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend && npx oxlint 2>&1 | tail -20</automated>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer && git show --name-only --format='' HEAD | sort | tr '\n' ' '</automated>
  </verify>
  <done>
All 7 new tests pass; full suite is green at baseline (30 files / 347 tests) plus 7 net-new tests
(30 files / 354 tests), zero regressions; tsc -b and oxlint report no new errors/warnings; a single
new commit contains exactly frontend/src/store/filters.ts, frontend/src/main.tsx, and
frontend/src/store/filters.test.ts.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser localStorage -> useFilters store | localStorage is client-controlled and can be edited via devtools, a browser extension, or by any script with same-origin access -- it is untrusted input from the store's perspective, same trust level as the existing theme/speech/auth persisted values. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-jzp-01 | Tampering | `readStoredFilters()` / `isPersistedFilters()` in filters.ts | mitigate | Shallow shape-only type guard rejects any value missing a key or with a wrong primitive type; on ANY failure the whole stored value is discarded and safe defaults are used -- never a partial `set()`, never a thrown exception propagating to the caller. Defense-in-depth: even a shape-valid but semantically-unrecognized `activeChart` is caught downstream by ChartDeck.tsx's existing `CHART_REGISTRY.find(...) ?? CHART_REGISTRY[0]` fallback. |
| T-quick-jzp-02 | Information Disclosure | persisted `bpCategory`/`datePreset`/`overlayDatasets` values in the `"hv-filters"` localStorage key | accept | These are UI filter selections (e.g. "previously filtered by Stage 2"), not underlying health readings, and are already visible on-screen during any active session. The app already sits behind the shared-password gate (SEC-01); anyone with browser-profile access to a logged-in device already has access to the live dashboard data itself, which is a strictly larger disclosure than a stale filter preference. Equivalent residual risk is already accepted for the existing theme/speech localStorage-persisted preferences. |
| T-quick-jzp-03 | Denial of Service | Repeated `storeFilters()` writes / oversized stored value | accept | The persisted blob is a small fixed-shape JSON object (well under 1KB) written at the same frequency as the pre-existing in-memory setter calls -- no unbounded growth vector. A `localStorage.setItem` quota/blocked-access failure is already guarded by the try/catch (degrades to session-only persistence loss, never an app crash), matching the existing accepted risk profile of theme.ts/speech.ts/auth.ts. |
</threat_model>

<verification>
Run from the repo root after both tasks complete:

```
cd frontend && npx vitest run
cd frontend && npx tsc -b
cd frontend && npx oxlint
git show --stat HEAD
```

The vitest run must show zero failures at (pre-change baseline of 30 files / 347 tests) + 7 net-new
tests = 30 files / 354 tests. tsc -b and oxlint must report no new errors/warnings (oxlint's 3
pre-existing unrelated warnings are expected). `git show --stat HEAD` must list exactly the 3 files
in this plan's `files_modified` -- no PRODUCT.md, no unrelated file.
</verification>

<success_criteria>
- [ ] filters.ts follows the codebase's existing hand-rolled STORAGE_KEY / readStored*() / store*()
      try/catch pattern exactly -- zustand's `persist` middleware is not used
- [ ] initFilters() is an explicit bootstrap action (mirroring theme.ts/speech.ts), not a
      read-at-creation pattern (auth.ts's approach, deliberately not used here)
- [ ] All 6 persisted fields (activeChart, datePreset, customRange, amPm, bpCategory,
      overlayDatasets) round-trip through a reload via a single "hv-filters" JSON blob
- [ ] A corrupted, wrong-shape, or missing stored value never throws and never partially applies --
      defaults are used instead, proven by dedicated tests
- [ ] All 7 mutating setters (setActiveChart, setDatePreset, setCustomRange, setAmPm, setBpCategory,
      setOverlayDataset, showAllData) persist via a single shared persistCurrent() helper
- [ ] main.tsx calls useFilters.getState().initFilters() before first render, alongside the existing
      initTheme()/initSpeech() calls
- [ ] No cross-tab sync, no schema version field, and no other store file touched
- [ ] Full test suite green (30 files / 347 tests baseline + 7 net-new tests, zero regressions);
      tsc -b and oxlint clean
- [ ] Exactly the 3 planned files are committed in one commit
</success_criteria>

<output>
Create `.planning/quick/260827-jzp-harden-cardiostream-filter-overlay-sessi/260827-jzp-SUMMARY.md`
when done.
</output>
