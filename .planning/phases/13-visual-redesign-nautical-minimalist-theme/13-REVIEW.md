---
phase: 13-visual-redesign-nautical-minimalist-theme
reviewed: 2026-09-04T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - frontend/src/App.tsx
  - frontend/src/components/AddRecordPage.tsx
  - frontend/src/components/AgentStatusBanner.tsx
  - frontend/src/components/ChartDeck.tsx
  - frontend/src/components/CommandBar.tsx
  - frontend/src/components/DateRangePicker.tsx
  - frontend/src/components/EmptyState.tsx
  - frontend/src/components/FilterBar.tsx
  - frontend/src/components/GuideOverlay.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/LoginGate.tsx
  - frontend/src/components/OverlayEventsList.tsx
  - frontend/src/components/OverlayToggle.tsx
  - frontend/src/components/ReadingsTable.tsx
  - frontend/src/components/StatsStrip.tsx
  - frontend/src/components/UploadPage.tsx
  - frontend/src/components/charts/AmPmComparison.tsx
  - frontend/src/components/charts/BPTimeline.tsx
  - frontend/src/components/charts/CategoryBars.tsx
  - frontend/src/components/charts/ChartTooltip.tsx
  - frontend/src/components/charts/StatsSparkline.test.tsx
  - frontend/src/components/charts/StatsSparkline.tsx
  - frontend/src/components/records/IncidentFields.tsx
  - frontend/src/components/records/LabFields.tsx
  - frontend/src/components/records/ProcedureFields.tsx
  - frontend/src/components/records/SingleDateField.tsx
  - frontend/src/index.css
  - frontend/src/lib/chartData.ts
  - frontend/src/main.tsx
  - frontend/src/tests/contrast.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-09-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed the full Phase 13 "Slack Water / Night Watch" visual-redesign file
set (App shell, chart components, record field-sets, design tokens, and
tests) at standard depth. The codebase is disciplined overall — no hardcoded
secrets, no `eval`/`innerHTML`/`dangerouslySetInnerHTML`, no `console.log`/
`debugger`/empty catch blocks, no loose `==`, no `any` types, `tsc --noEmit`
and `oxlint` both come back essentially clean. All new palette tokens
(`--cat-*`, `--overlay-*`) were independently verified against WCAG 1.4.3/
1.4.11 floors and pass in both themes.

The one BLOCKER is a real, provable regression: `GuideOverlay`'s focus-restore
effect fires on every mount (not just on an open→close transition), so it
steals keyboard/screen-reader focus onto the header's "Guide" button
immediately after login and after every Dashboard/Upload/Add-Record
navigation — directly contradicting the project's non-negotiable
keyboard/voice-first accessibility requirement for a user with no reliable
pointer input. The remaining findings are narrower: an ARIA-dialog tooltip
with no focus management, three effects with a lint-flagged missing
dependency, an unused font import contradicted by its own comment, and a test
coverage gap.

## Critical Issues

### CR-01: GuideOverlay steals focus to the Guide button on every mount, not just on close

**File:** `frontend/src/components/GuideOverlay.tsx:141-147`
**Issue:**
```tsx
useEffect(() => {
  if (open) {
    closeButtonRef.current?.focus();
  } else {
    document.getElementById("guide-toggle-button")?.focus();
  }
}, [open]);
```
This effect's intent (per the surrounding comment, "WR-03") is to restore
focus to the header's "Guide" button *when the guide closes*. But `useEffect`
always runs once after the initial commit regardless of what the component
renders (the `if (!mounted) return null;` guard a few lines below does not
suppress hooks that were already called — hooks execute unconditionally by
React's rules). `useGuide`'s `open` defaults to `false` and is never
persisted (`frontend/src/store/guide.ts:18-22`), so on **every** mount of
`GuideOverlay` with `open === false` — i.e. on initial page load right after
login, and again on every Dashboard ↔ Upload ↔ Add Record navigation (`App.tsx`
mounts a fresh `Dashboard`/`UploadView`/`RecordsView` tree, so `GuideOverlay`
unmounts and remounts each time) — this effect runs the `else` branch and
calls `document.getElementById("guide-toggle-button")?.focus()`, even though
the guide was never opened.

Concretely: a caregiver logs in (LoginGate → Dashboard mount) and focus jumps
away from the password form onto the header's "Guide" button instead of
following natural page flow. A user clicks "Upload" or "Back to dashboard" in
the header — the click already correctly focuses that button per default
browser behavior — but the very next render remounts `GuideOverlay`, which
immediately yanks focus back onto the unrelated "Guide" button. For a
screen-reader user this means an unannounced, unexpected jump to "Guide,
button" after essentially every navigation in the app — a direct violation of
CLAUDE.md's non-negotiable keyboard/voice-first accessibility bar (the
project's primary user has no reliable pointer input and depends on correct
focus flow). `Header.tsx`'s own `LogoutConfirmDialog` avoids this exact trap
by restoring focus directly inside its `onCancel`/`onConfirm` handlers instead
of a generic mount-triggered effect — confirming this is a regression/oversight
in `GuideOverlay`'s implementation, not an intentional pattern.

No existing test catches this: `GuideOverlay.test.tsx` renders `GuideOverlay`
in isolation (no `Header`, so `getElementById("guide-toggle-button")` is
always `null` there), and `App`-level tests were not part of this review's
file set.

**Fix:** Only restore focus to the Guide button on an actual open→close
transition, not on initial mount:
```tsx
const wasOpenRef = useRef(open);
useEffect(() => {
  const wasOpen = wasOpenRef.current;
  wasOpenRef.current = open;
  if (open) {
    closeButtonRef.current?.focus();
  } else if (wasOpen) {
    // Only steal focus back to the trigger when we're actually closing —
    // never on initial mount (open was already false).
    document.getElementById("guide-toggle-button")?.focus();
  }
}, [open]);
```

## Warnings

### WR-01: ChartTooltip uses `role="dialog"` with no focus management

**File:** `frontend/src/components/charts/ChartTooltip.tsx:91-116`
**Issue:** The click-persistent tooltip is marked `role="dialog"` (line 93)
but nothing moves focus into it when it becomes visible, and nothing returns
focus to the chart when it closes (contrast with `LogoutConfirmDialog` in
`Header.tsx`, which focuses `Cancel` on open and restores focus to the
trigger on close, and with `GuideOverlay`, which — bug above aside — is
explicitly documented as deliberately *not* using dialog semantics because it
doesn't manage focus). A screen reader encountering `role="dialog"` typically
expects the dialog to receive focus; here it doesn't, so AT users get an
unfocused "dialog" announcement while their focus silently stays on the chart
point, and the only documented dismissal path is Escape (global listener) —
Tab order is left to accident of DOM position rather than guaranteed.
**Fix:** Either move focus to the dialog/Close button on `visible` becoming
true (and restore focus to the triggering chart point on close, mirroring
`LogoutConfirmDialog`'s pattern), or drop `role="dialog"` in favor of a
non-dialog role (e.g. `role="group"` or `role="status"`) that doesn't imply
focus-management semantics the component doesn't provide.

### WR-02: Record field-set effects omit `canSubmit` from their dependency array

**File:** `frontend/src/components/records/IncidentFields.tsx:42-62`, `frontend/src/components/records/LabFields.tsx:52-67`, `frontend/src/components/records/ProcedureFields.tsx:33-46`
**Issue:** `oxlint`'s `react-hooks(exhaustive-deps)` flags all three: each
effect reads `canSubmit` (a value derived every render from the same state
that *is* listed in the deps array) inside its body but doesn't list it as a
dependency. It happens to be harmless today because `canSubmit` is
recomputed from exactly the same state variables already in each deps array,
but it's exactly the kind of stale-closure footgun that silently breaks the
next time someone adds a new input to `canSubmit`'s derivation without also
remembering to add it to three separate effects.
**Fix:** Add `canSubmit` to each dependency array (or compute the guarded
body via a `useMemo`/derived-state helper so there's nothing for the effect
to miss):
```tsx
}, [dateText, testName, resultText, unit, rangeLowText, rangeHighText, notes, canSubmit, onDraftChange]);
```

### WR-03: `main.tsx` imports Atkinson Hyperlegible font files that are never referenced

**File:** `frontend/src/main.tsx:7-8`
**Issue:**
```tsx
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
```
The inline comment claims this font is "still in use, removal deferred to a
later cleanup task," but a search of the whole reviewed file set turns up
zero references to Atkinson/"Atkinson Hyperlegible" anywhere — `--font-sans`
(`index.css:25`), `body { font-family: ... }` (`index.css:116`), and
`--font-display` (`index.css:26`) all resolve to Inter/Space Grotesk only.
This phase's redesign fully replaced the prior type system, so these two
`@fontsource` imports now ship two unused font-weight files on every page
load for no visual effect — dead code, and the comment justifying it is
factually stale.
**Fix:** Remove the two unused imports (and the `@fontsource/atkinson-hyperlegible`
dependency if nothing else in the app references it), or update the comment
if there's a still-planned future use this review can't see.

## Info

### IN-01: `contrast.test.ts` doesn't cover the new `--cat-*`/`--overlay-*` tokens

**File:** `frontend/src/tests/contrast.test.ts`
**Issue:** This regression suite locks in WCAG floors for the brass, hazard,
and panel token trio but not for the six clinical category colors
(`--cat-hypotension` … `--cat-crisis`) or the three overlay-dataset colors
(`--overlay-labs`/`--overlay-incidents`/`--overlay-procedures`) introduced in
the same `index.css` this phase edited. Manually checked, all nine currently
clear the 4.5:1 text floor against their paired chip-text tokens in both
themes, so there's no live defect — but unlike brass/hazard/panel, a future
edit to any of these nine values has no regression test to catch a contrast
regression.
**Fix:** Extend `contrast.test.ts` with the same `hex(chipText, fill) >= 4.5`
assertions for `--cat-*`/`--cat-chip-text` and `--overlay-*`/`--overlay-chip-text`
in both `LIGHT`/`DARK` blocks.

---

_Reviewed: 2026-09-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
