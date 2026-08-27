---
status: clean
files_reviewed: 25
critical: 0
warning: 0
info: 2
---

# Phase 12 (Visual Refresh) — Code Review

## Scope

Reviewed all 25 files listed for this phase at standard depth: `frontend/src/index.css`, `frontend/package.json`,
`frontend/package-lock.json`, `frontend/src/App.tsx`, every changed component under `frontend/src/components/`
(including `charts/` and `records/` subfolders), and the new `frontend/src/tests/contrast.test.ts`.

Method: read every file in full, then diffed each against the pre-phase baseline (`83e4ca2`, the last commit
before Phase 12 started) to isolate exactly what this phase changed, cross-referenced every change against
`12-CONTEXT.md` / `12-UI-SPEC.md` / the eight `12-0N-PLAN.md` files' stated scope and `<done>` criteria, and ran
the frontend test suite, `tsc -b`, and `oxlint` against the working tree.

## Verification performed

- `git diff 83e4ca2 HEAD -- frontend/src/` — full diff review, file by file.
- `cd frontend && npm test -- --run` — **329/329 tests pass** (up from 323 pre-phase; the 6 new tests are
  `contrast.test.ts`'s WCAG assertions).
- `cd frontend && npx tsc -b` — clean, no type errors.
- `cd frontend && npm run lint` — 3 pre-existing `react-hooks/exhaustive-deps` warnings in
  `records/{Lab,Incident,Procedure}Fields.tsx` (missing `canSubmit` dep), confirmed present in the pre-phase
  baseline too (verified by checking out those files at `83e4ca2` and re-linting) — **not introduced by this
  phase**, out of its scope (a pure className refresh never touched the `useEffect` dependency arrays).
- Line-by-line diff of `frontend/src/index.css` against baseline to verify the D-04 lock.
- Scripted before/after count of `min-h-12`/`min-w-12` occurrences per changed file to verify no accessibility
  floor regression.
- Cross-referenced every "unchanged" `rounded-lg`/`text-[20px]` spot I found suspicious against the phase's own
  plan files, which explicitly scoped and verified each one via grep-based acceptance criteria.

## D-04 locked-token audit (index.css)

Diffed `frontend/src/index.css` byte-for-byte against the pre-phase baseline. The only changes are:

- `--color-accent` / dark-mode `--color-accent` (light `#14213D`→`#B94927`, dark `#8FC1D4`→`#DA6F4E`) — this is
  the **explicitly in-scope** D-03 accent swap, not a D-04 token.
- New additions: `--shadow-elevation` (both themes) and the nine `--text-h1`/`--text-h2`/`--text-control`
  companion tokens in `@theme`. Both are new tokens, not edits to existing ones.

Every D-04-locked token named in the task — `--color-focus`, `--cat-hypotension` through `--cat-crisis`,
`--band-opacity`, `--cat-chip-text`, `--overlay-labs`/`--overlay-incidents`/`--overlay-procedures`,
`--overlay-chip-text`, `--line-systolic`/`--line-diastolic`, `--ref-bradycardia` — is **byte-identical** to the
pre-phase baseline in both the `:root` and `.dark` blocks. The `.chart-band` rule and the `:focus-visible` rule
are also untouched. **No D-04 violation.**

## Accessibility floor audit (min-h-12 / min-w-12 / body text)

Scripted a before/after occurrence count of `min-h-12` and `min-w-12` across all 21 changed `.tsx` files: **every
file has an identical count before and after** — zero targets dropped while radius classes were bumped. Spot-checked
the diffs directly too (`CommandBar.tsx`'s mic button, `AddRecordPage.tsx`'s submit button, `DateRangePicker.tsx`'s
Apply button, etc.) — in every case only `rounded-lg`→`rounded-xl` and/or `text-[20px]`→`text-control` changed
inside the class string; `min-h-12`/`min-w-12` tokens are preserved verbatim. `body{ font-size: 18px }` in
`index.css` (the ACC-01 floor) is untouched. **No accessibility-floor regression.**

## Scope-boundary spot checks (initially flagged, resolved as intentional)

Three things looked like incomplete migrations at first read, but each is a **documented, deliberate** scope
boundary in the phase's own plans, verified there via grep-based acceptance criteria — not defects:

1. **`Header.tsx`'s discreet caregiver-zone buttons** (Theme/Voice Replies/Guide toggles, Upload/Add
   Record/Log-out triggers) still use `rounded-lg`/`text-[20px]`. Plan `12-04` names this explicitly
   (`T-12-12`, "Elevation of Privilege (scope creep)") and its acceptance criteria grep-verify the Theme toggle
   button is *still* `rounded-lg`/`text-[20px]` after the plan runs, proving the radius/type-scale bump was
   correctly confined to the UI-SPEC's named "app-owned surfaces" list.
2. **`FilterBar.tsx`'s category-chip button** (line 168, `rounded-full`, `text-[20px]`) — plan `12-03` explicitly
   instructs "Do NOT touch the category-chip button's..." and verifies via `grep -c "rounded-full"` staying at 1.
3. **`ChartTooltip.tsx`'s Close button** (`rounded-lg`) and the three record field-sets' `<h3>` section headers
   (`LabFields.tsx`, `IncidentFields.tsx`, `ProcedureFields.tsx`, still `text-[20px]`) — plan `12-02`'s `<done>`
   line states "the category chip and Close button are untouched"; plan `12-07` scoped its `text-control` swap
   to the shared `labelClass` constant only, not the `<h3>` headings.

All three are consistent with `12-UI-SPEC.md` line 72's explicit scope ("App-owned surfaces only... filter bar")
for the radius/shadow bump, and are why the mixed `text-[20px]`/`text-control` usage across the codebase is
intentional rather than an oversight.

## Findings

No critical or warning-level issues found. Two minor/info-level observations:

### [INFO] Redundant `font-bold`/`leading-tight` alongside `text-h1`/`text-h2`/`text-control`

`--text-h1`, `--text-h2`, and `--text-control` are declared in `@theme` with companion
`--text-*--font-weight: 700` and `--text-*--line-height: 1.25` tokens, which Tailwind 4 applies automatically
whenever the `text-h1`/`text-h2`/`text-control` utility is used. Most call sites (e.g. `App.tsx:156`,
`ChartDeck.tsx:140`, `StatsStrip.tsx:36-37`) still append an explicit `font-bold` and/or `leading-tight`
alongside the new token class. This is harmless — both resolve to the same computed value (700 weight, 1.25
line-height), confirmed by the passing test suite and `tsc` — but it's redundant, and a few sibling call sites
(`AddRecordPage.tsx:145`, `UploadPage.tsx:88`, `LoginGate.tsx:60,63`) already dropped the redundant class,
showing the newly-introduced pattern isn't applied consistently. Not a functional bug and not in the phase's
explicit scope (the plans' literal instructions were "swap `text-[20px]`→`text-control`" without touching
neighboring classes), so this is left as a follow-up-cleanup note rather than something to fix now.

### [INFO] `12-UI-SPEC.md` line 131 documentation mismatch

The UI-SPEC's "Accent reserved for" list (line 131) names "Header.tsx Guide/Voice-Replies toggles when ON" as an
existing `--color-accent` consumer. The actual `Header.tsx` code (both pre- and post-phase-12, confirmed via
`git show 83e4ca2`) never conditionally applies an accent fill to these toggles — they always render with
`bg-[var(--color-sky)]` regardless of `aria-pressed` state, per the component's own long-standing comment ("the
navy accent fill is reserved for the UI-SPEC list, which excludes all of these"). This predates Phase 12 and
Phase 12 did not touch this behavior, so it isn't a code defect introduced here — it's a stale/inaccurate line in
the design-contract doc worth a one-line correction next time that doc is touched, not a code fix.

## Summary

This phase's diff is exactly what it claims to be: a bounded, mechanical CSS/className refresh (new terracotta
accent color, `--shadow-elevation` depth tokens, `rounded-lg`→`rounded-xl` on named app-owned surfaces, and
ad-hoc pixel sizes formalized into `--text-h1`/`--text-h2`/`--text-control`). The D-04 clinical/overlay/focus
token lock holds byte-for-byte, the `min-h-12`/`min-w-12` accessibility floor is fully preserved across every
changed file, the 18px body-text floor is untouched, all 329 frontend tests pass, `tsc -b` is clean, and the only
new dependency (`wcag-contrast`, dev-only) is exactly what the new regression test needs. No security concerns
(pure presentational/CSS change, no new input handling, no raw model output involved). No functional
regressions found.
