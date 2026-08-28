---
phase: quick-260827-kir
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/OverlayToggle.tsx
  - frontend/src/components/OverlayToggle.test.tsx
autonomous: true
requirements: [OVERLAY-05]

must_haves:
  truths:
    - "The overlay toggle button group (role=\"group\", aria-label=\"Overlay events\") renders at full opacity in every activeChart state, including states where overlayApplies is false (bp_categories, am_pm_comparison) -- the buttons are never actually disabled (per this file's own top-of-file code comment), so they must never look disabled either."
    - "The 'doesn't apply here' textual note (NOTE_COPY, aria-live=\"polite\", conditionally rendered when !overlayApplies) is completely unchanged -- it remains the sole visual signal for the overlayApplies=false state, per DESIGN.md's Dashed-Border Rule which reserves visual 'not ready' signaling for genuinely disabled controls, not always-clickable ones."
    - "OverlayToggle.test.tsx explicitly locks (via an automated assertion) that the group's className never contains the string 'opacity-60', exercised across both an overlayApplies=true activeChart (e.g. bp_timeline) and an overlayApplies=false activeChart (e.g. bp_categories) -- closing the prior gap where no test guarded this behavior."
    - "The full frontend suite (vitest), type-check (tsc -b), and linter (oxlint) all pass at the pre-change baseline captured during planning (30 test files / 354 tests passing; tsc exit 0 with zero errors; oxlint exit 0 with exactly 3 pre-existing warnings in frontend/src/components/records/{ProcedureFields,IncidentFields,LabFields}.tsx, none in OverlayToggle.tsx) -- the single-line removal introduces zero regressions."
  artifacts:
    - path: "frontend/src/components/OverlayToggle.tsx"
      provides: "role=\"group\" div className template literal with the `${overlayApplies ? \"\" : \" opacity-60\"}` conditional segment removed entirely"
      contains: "className={`flex flex-wrap gap-2${pulseClass}`}"
    - path: "frontend/src/components/OverlayToggle.test.tsx"
      provides: "A test asserting the group's className never contains opacity-60, checked under both an overlayApplies=true and an overlayApplies=false activeChart value"
      contains: "opacity-60"
  key_links:
    - from: "frontend/src/components/OverlayToggle.tsx (role=\"group\" div)"
      to: "DESIGN.md's Dashed-Border Rule (a disabled/not-ready action gets a 2px dashed Ink border, never a dimmed/low-opacity solid one)"
      via: "removing opacity-based dimming from a control group that is never actually disabled, so no control in the app dims without also being functionally disabled"
      pattern: "flex flex-wrap gap-2\\$\\{pulseClass\\}"
    - from: "frontend/src/components/OverlayToggle.test.tsx"
      to: "frontend/src/components/OverlayToggle.tsx"
      via: "render(<OverlayToggle />) + screen.getByRole(\"group\", { name: \"Overlay events\" }) + className assertion"
      pattern: "not\\.toContain\\(\"opacity-60\"\\)"
---

<objective>
Remove a single dimming class (`opacity-60`) from OverlayToggle.tsx's button-group container that fires whenever `overlayApplies` is false, and lock the corrected behavior with a test. The buttons in this group are documented in the file's own top comment as never disabling — a caregiver can pre-set overlays before switching to a chart that renders them. Dimming a fully-functional, always-clickable control set visually implies it is off-limits, which is the exact anti-pattern DESIGN.md's Dashed-Border Rule warns against (disabled/not-ready state must use a dashed border, never lowered opacity — and this control isn't even disabled).

Purpose: Restore visual/functional parity so the overlay buttons look exactly as interactive as they are, in every chart state, closing a P2 finding from the 2026-08-27 impeccable re-critique.
Output: `frontend/src/components/OverlayToggle.tsx` (one conditional class segment removed), `frontend/src/components/OverlayToggle.test.tsx` (new assertion locking the no-dimming behavior).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/components/OverlayToggle.tsx
@frontend/src/components/OverlayToggle.test.tsx
@DESIGN.md

## Pre-flight regression baseline (captured at planning time, 2026-08-27)

- `cd frontend && npx vitest run` → **30 test files passed, 354 tests passed**.
- `cd frontend && npx tsc -b` → exit 0, zero errors.
- `cd frontend && npx oxlint` → exit 0, exactly 3 pre-existing warnings, all `react-hooks(exhaustive-deps)` in `src/components/records/{ProcedureFields,IncidentFields,LabFields}.tsx` (unrelated to this fix). Zero warnings in `OverlayToggle.tsx`.
- `grep -rn "opacity-60" frontend/src/` → exactly 2 hits: `AddRecordPage.tsx:164` (unrelated, out of scope — a genuinely disabled submit-in-flight state, leave untouched) and `OverlayToggle.tsx:66` (the one this plan fixes).

## The exact line to change

`frontend/src/components/OverlayToggle.tsx` line 66, inside the `role="group"` div:

Current: `` className={`flex flex-wrap gap-2${overlayApplies ? "" : " opacity-60"}${pulseClass}`} ``
Target: `` className={`flex flex-wrap gap-2${pulseClass}`} ``

Nothing else in this file changes — not `NOTE_COPY`, its conditional render, `pulseClass`'s own logic, `inactiveClass`/`activeClass`, the inline active-fill `style`, `aria-pressed` wiring, or the `overlayApplies` computation itself (still used by the unchanged `NOTE_COPY` conditional at line 95).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Strengthen test to lock no-dimming behavior, then remove the opacity-60 conditional</name>
  <files>frontend/src/components/OverlayToggle.test.tsx, frontend/src/components/OverlayToggle.tsx</files>
  <behavior>
    - Test A: Render `<OverlayToggle />` with `activeChart` set to a value where `overlayApplies` is false (e.g. `"bp_categories"`, matching the existing "doesn't-apply-here indicator" describe block's convention). Assert `screen.getByRole("group", { name: "Overlay events" }).className` does NOT contain `"opacity-60"`. Against the current (unfixed) source this assertion FAILS — confirming RED.
    - Test B: Render `<OverlayToggle />` with `activeChart` set to a value where `overlayApplies` is true (e.g. the default `"bp_timeline"`). Assert the same group's className does NOT contain `"opacity-60"`. This already passes against current source (regression guard for the applies=true branch).
    - Add both as new `it(...)` cases inside the existing `describe("OverlayToggle button group", ...)` block (or a new adjacent describe — match existing file conventions), do not delete or weaken any pre-existing test.
  </behavior>
  <action>
    First add the two test cases described above to frontend/src/components/OverlayToggle.test.tsx, following the file's existing patterns (INITIAL_FILTERS setup via useFilters.setState, screen.getByRole for the group). Run `cd frontend && npx vitest run src/components/OverlayToggle.test.tsx` and confirm Test A fails (RED) while Test B passes, proving the test actually exercises the bug. Then edit frontend/src/components/OverlayToggle.tsx line 66: remove the `${overlayApplies ? "" : " opacity-60"}` segment from the className template literal so it reads exactly `` `flex flex-wrap gap-2${pulseClass}` ``. Do not touch any other line, class, prop, or the overlayApplies computation — overlayApplies is still consumed by the unchanged NOTE_COPY conditional later in the same component. Re-run the same test file and confirm both Test A and Test B now pass (GREEN).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/OverlayToggle.test.tsx</automated>
  </verify>
  <done>Both new assertions pass; OverlayToggle.tsx's group div className is exactly `` `flex flex-wrap gap-2${pulseClass}` `` with no overlayApplies-conditional segment; NOTE_COPY, pulseClass, inactiveClass/activeClass, aria-pressed wiring, and the overlayApplies computation are byte-for-byte unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Full regression sweep against the captured baseline</name>
  <files>frontend/src/components/OverlayToggle.tsx, frontend/src/components/OverlayToggle.test.tsx</files>
  <action>
    Run the full frontend verification suite and diff results against the pre-flight baseline captured in this plan's context section. Confirm: (1) `npx vitest run` shows 30 test files passed and exactly 355 tests passed (354 baseline + 1 net-new test — Test A and Test B both count, but one of the two may land as a strengthening of an existing assertion depending on how Task 1 structured them; the hard requirement is zero failures and a test count >= 355), zero regressions in any other file; (2) `npx tsc -b` exits 0 with zero errors, matching baseline; (3) `npx oxlint` exits 0 with exactly the same 3 pre-existing warnings in the records/ field components and zero new warnings anywhere, especially not in OverlayToggle.tsx; (4) `grep -rn "opacity-60" frontend/src/components/OverlayToggle.tsx` returns no matches (confirming full removal), while `grep -rn "opacity-60" frontend/src/components/AddRecordPage.tsx` still returns its one unrelated, untouched match. If any check regresses, fix before considering the plan done — do not proceed with a known regression.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run && npx tsc -b && npx oxlint && ! grep -q "opacity-60" src/components/OverlayToggle.tsx</automated>
  </verify>
  <done>vitest: 30 files / >=355 tests, zero failures. tsc -b: exit 0, zero errors. oxlint: exit 0, exactly the 3 pre-existing unrelated warnings, zero new. OverlayToggle.tsx contains zero occurrences of "opacity-60"; AddRecordPage.tsx's unrelated occurrence is untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None new | Pure client-side CSS/className change to an already-rendered, already-interactive control group. No new data flow, no new trust boundary crossed — `overlayDatasets`/`activeChart` are already-trusted local app state (zustand store), not external input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Qkir-01 | N/A (informational) | OverlayToggle.tsx role="group" div | accept | This is a visual-affordance correction (removing misleading dimming from an always-enabled control), not a security-relevant change. No new input path, no new external dependency, no change to auth/data boundaries. No STRIDE category applies meaningfully; included for template completeness per plan convention. |
</threat_model>

<verification>
1. `cd frontend && npx vitest run` — full suite green, 30 files, >=355 tests (354 baseline + at least 1 net-new), zero regressions, zero skips.
2. `cd frontend && npx tsc -b` — exit 0, no new type errors vs. baseline.
3. `cd frontend && npx oxlint` — exit 0, exactly the 3 pre-existing unrelated warnings, no new warnings.
4. `grep -n "opacity-60" frontend/src/components/OverlayToggle.tsx` — zero matches.
5. Diff review: `git diff frontend/src/components/OverlayToggle.tsx` shows exactly one line changed (the className template literal on the former line 66), nothing else.
</verification>

<success_criteria>
- `frontend/src/components/OverlayToggle.tsx`'s overlay button group renders with className `` `flex flex-wrap gap-2${pulseClass}` `` in every activeChart state — no opacity-60, regardless of overlayApplies.
- `frontend/src/components/OverlayToggle.test.tsx` contains an automated assertion that the group's className never contains "opacity-60", covering both overlayApplies=true and overlayApplies=false states.
- NOTE_COPY's conditional aria-live note remains the only visual/textual signal for the overlayApplies=false state — unchanged from before this plan.
- Full frontend suite, tsc, and oxlint pass with zero regressions against the captured pre-flight baseline (30 files/354 tests, tsc clean, oxlint's 3 pre-existing unrelated warnings only).
</success_criteria>

<output>
Create `.planning/quick/260827-kir-harden-overlaytoggle-tsx-against-a-disab/260827-kir-SUMMARY.md` when done
</output>
