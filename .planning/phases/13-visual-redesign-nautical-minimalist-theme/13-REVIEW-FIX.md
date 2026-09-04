---
phase: 13-visual-redesign-nautical-minimalist-theme
fixed_at: 2026-09-04T20:24:15Z
review_path: .planning/phases/13-visual-redesign-nautical-minimalist-theme/13-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-09-04T20:24:15Z
**Source review:** .planning/phases/13-visual-redesign-nautical-minimalist-theme/13-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (fix_scope: critical_warning — CR-01, WR-01, WR-02, WR-03; IN-01 excluded by scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: GuideOverlay steals focus to the Guide button on every mount, not just on close

**Files modified:** `frontend/src/components/GuideOverlay.tsx`
**Commit:** `3b3e6bd`
**Applied fix:** Added a `wasOpenRef` (seeded from the initial `open` value) to the
existing focus-management `useEffect`. The effect's `else` branch — which
calls `document.getElementById("guide-toggle-button")?.focus()` — now only
runs when `wasOpenRef.current` was `true` on the previous render (i.e. on a
real open→close transition), never on initial mount. This fixes the
regression where `GuideOverlay`, mounted fresh at three separate call sites
in `App.tsx` (Dashboard/Upload/Add Record), stole keyboard/screen-reader
focus onto the header's "Guide" button on every login and every navigation
between those views. Verified against `GuideOverlay.test.tsx` (10 tests,
all pass) and a project-wide `tsc --noEmit` (clean).

### WR-01: ChartTooltip uses `role="dialog"` with no focus management

**Files modified:** `frontend/src/components/charts/ChartTooltip.tsx`,
`frontend/src/components/charts/ChartTooltip.test.tsx`
**Commit:** `91f0935`
**Applied fix:** Replaced `role="dialog"` with `role="group"` on the
tooltip panel's root `<div>`, since the component moves no focus on open
and restores none on close (Escape and the Close button both simply call
`onClose`) — the reviewer's second suggested option, chosen over adding
full focus-trap semantics because there's no natural DOM focus target to
restore to on the Recharts `accessibilityLayer` chart (no per-datapoint
focusable node), and because it mirrors `GuideOverlay`'s own existing,
deliberate choice to avoid dialog semantics for the identical reason. Added
an inline comment documenting the rationale. Updated the three
`getByRole("dialog")`/`queryByRole("dialog")` assertions in
`ChartTooltip.test.tsx` to `"group"` since they directly assert on this
attribute. Verified: `tsc --noEmit` clean, `oxlint` clean, and
`ChartTooltip.test.tsx` + `GuideOverlay.test.tsx` (17 tests total) all
pass — confirming `GuideOverlay`'s own unrelated `role="dialog"` absence
assertion (for `LogoutConfirmDialog`) still holds.

### WR-02: Record field-set effects omit `canSubmit` from their dependency array

**Files modified:** `frontend/src/components/records/IncidentFields.tsx`,
`frontend/src/components/records/LabFields.tsx`,
`frontend/src/components/records/ProcedureFields.tsx`
**Commit:** `cace63d`
**Applied fix:** Added `canSubmit` to each of the three effects'
dependency arrays, exactly as suggested in the review — closing the
`react-hooks(exhaustive-deps)` lint gap where each effect reads `canSubmit`
in its body without listing it as a dependency. Verified: `oxlint` now
reports zero warnings on all three files (previously flagged), `tsc
--noEmit` clean, and all three components' test suites (9 tests total)
pass unchanged.

### WR-03: `main.tsx` imports Atkinson Hyperlegible font files that are never referenced

**Files modified:** `frontend/src/main.tsx`
**Commit:** `feaf6bb`
**Applied fix:** Removed the two dead
`@fontsource/atkinson-hyperlegible/{400,700}.css` imports and rewrote the
stale comment above them (which incorrectly claimed the font was "still in
use"). Confirmed via `grep` that no file in `frontend/src` references
"Atkinson" anywhere, and that `--font-sans`/`--font-display`/`body{
font-family }` in `index.css` resolve to Inter/Space Grotesk only. Verified
with `tsc --noEmit` (clean), `oxlint` (clean), and a full `vite build` —
the production bundle output no longer includes any Atkinson font asset.

**Note:** The review's fix guidance also suggested optionally removing the
now-unused `@fontsource/atkinson-hyperlegible` entry from `package.json`
"if nothing else in the app references it." That removal was intentionally
**not** applied here: it requires a real `npm install`/lock-file
regeneration to keep `package.json` and `package-lock.json` in sync (a bare
text edit to `package.json` risks breaking `npm ci`, which validates the
two files match), and this fixer's git-only rollback guarantee doesn't
extend to package-manager operations against the shared `node_modules`.
Recommended as a manual follow-up: `npm uninstall @fontsource/atkinson-hyperlegible`
in the frontend package.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-09-04T20:24:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
