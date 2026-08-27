---
phase: 12-visual-refresh
plan: 06
subsystem: ui
tags: [css, design-tokens, tailwind4, guide-overlay, date-range-picker, accessibility]

# Dependency graph
requires: ["12-01"]
provides:
  - "GuideOverlay.tsx Close button and jump-to-section links carry rounded-xl + shadow-elevation depth treatment"
  - "GuideOverlay.tsx page title, all nine section headings, nav label, and What-Can-I-Say category labels use named text-h1/text-h2/text-control tokens"
  - "DateRangePicker.tsx From/To inputs and Apply button carry rounded-xl corners and text-control labels"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "className-only token substitution: rounded-lg to rounded-xl, ad-hoc text-[Npx] literals to named text-h1/text-h2/text-control @theme tokens, shadow-[var(--shadow-elevation)] appended to interactive controls named explicitly in the design contract"
    - "Third-party widget scope boundary: react-day-picker's rdpSizing bridge object and DayPicker internals left completely untouched, verified by grep acceptance criteria rather than visual inspection alone"

key-files:
  created: []
  modified:
    - frontend/src/components/GuideOverlay.tsx
    - frontend/src/components/DateRangePicker.tsx

key-decisions:
  - "Both files' edits were pure Tailwind className substitutions with zero changes to scroll-clearance math, focus-management effects, Escape-key handling, or the rdpSizing/DayPicker calendar chrome — confirmed via unchanged grep counts on those identifiers before and after"

requirements-completed: [VISUAL-01, VISUAL-02]

# Metrics
duration: ~10min
completed: 2026-08-26
---

# Phase 12 Plan 06: Guide Overlay & Date Range Picker Visual Refresh Summary

**Applied rounded-xl + shadow-elevation depth to GuideOverlay's Close button and jump-links, formalized text-h1/text-h2/text-control tokens across both files, and gave DateRangePicker's app-owned inputs/Apply button matching rounded-xl corners — while leaving the react-day-picker calendar's own internal chrome fully untouched.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-26
- **Tasks:** 2 of 2 auto tasks completed
- **Files modified:** 2

## Accomplishments

- `GuideOverlay.tsx`'s Close button and all nine jump-to-section links now show `rounded-xl` corners plus `shadow-[var(--shadow-elevation)]` — the two controls PATTERNS.md's exhaustive map names explicitly for the D-05 depth treatment
- The shared `h2Class` constant (consumed by all nine section `<h2>` elements: Command Bar, Filters, Charts, Overlay, Voice Replies, Upload, Add a Record, What Can I Say, About This Guide) now uses `text-h2` instead of the ad-hoc `text-2xl`
- The page `<h1>` uses `text-h1`, the "Jump to a section" nav label and all "What Can I Say" per-category `<h3>` labels use `text-control` — four named-token substitutions in `GuideOverlay.tsx` total, at unchanged rendered sizes (D-06)
- `DateRangePicker.tsx`'s shared `inputClass` (From/To text inputs) and the Apply button's className ternary (both the enabled and disabled branches) now use `rounded-xl` instead of `rounded-lg`
- `DateRangePicker.tsx`'s From label, To label, and both Apply-button branches now use `text-control` instead of the ad-hoc `text-[20px]`
- `DateRangePicker.tsx`'s `rdpSizing` bridge object (four `--rdp-*` custom properties) and everything passed to the `<DayPicker>` element are byte-identical to before — verified by grep, not just visual inspection — per UI-SPEC's explicit third-party-widget scope decision (RESEARCH.md Pitfall 3)
- `GuideOverlay.tsx`'s scroll-clearance math (`CLOSE_BAR_HEIGHT`/`DEFAULT_CLEARANCE_ABOVE`/`CLEARANCE_BUFFER`), focus-management `useEffect`s, and Escape-key listener are byte-identical to before
- Full frontend suite green: 329/329 tests, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: GuideOverlay.tsx — depth, radius, and type-scale** - `800c1fe` (feat)
2. **Task 2: DateRangePicker.tsx — radius and type-scale on app-owned inputs only** - `61f51bd` (feat)

## Files Created/Modified

- `frontend/src/components/GuideOverlay.tsx` - Close button and jump-links: `rounded-lg`→`rounded-xl` + `shadow-[var(--shadow-elevation)]` appended, `text-[20px]`→`text-control`; shared `h2Class`: `text-2xl`→`text-h2`; page `<h1>`: `text-[32px]`→`text-h1`; nav label and What-Can-I-Say `<h3>` labels: `text-[20px]`→`text-control`
- `frontend/src/components/DateRangePicker.tsx` - Shared `inputClass` and both Apply-button className branches: `rounded-lg`→`rounded-xl`; From/To labels and both Apply-button branches: `text-[20px]`→`text-control`; `rdpSizing` object and `<DayPicker>` props untouched

## Decisions Made

- Verified the T-12-18 scope-creep threat mitigation with explicit grep-based acceptance criteria (all four `rdpSizing` keys unchanged count) before considering Task 2 done, rather than relying on eyeballing the diff — matches the plan's own threat-model disposition for this exact risk.
- Ran the pre-task grep baseline for `CLOSE_BAR_HEIGHT`/`DEFAULT_CLEARANCE_ABOVE`/`CLEARANCE_BUFFER` (9 occurrences) before editing `GuideOverlay.tsx`, then re-verified the same count post-edit, to positively confirm the scroll-clearance math was untouched rather than assuming it from the diff alone.

## Deviations from Plan

None — plan executed exactly as written. One pre-existing, unrelated test (`AddRecordPage.test.tsx`'s "shows Lab active by default..." test) timed out on the very first baseline run before any edits were made in this plan; it passed cleanly on every subsequent run (including the final full-suite verification), confirming it is pre-existing test-environment flakiness unrelated to this plan's className-only changes to `GuideOverlay.tsx`/`DateRangePicker.tsx`. Logged here for visibility, not fixed (out of scope — neither file it exercises was touched by this plan).

## Issues Encountered

None beyond the pre-existing flaky test noted above, which resolved itself on re-run and required no action.

## User Setup Required

None.

## Next Phase Readiness

Both files now carry the phase's D-05 depth/radius treatment and D-06 named type-scale tokens on all app-owned surfaces named in the design contract. No new tokens or patterns were introduced — this plan only consumed tokens already established in Plan 12-01. Nothing blocks downstream Wave 2 sibling plans or Wave 3.

---
*Phase: 12-visual-refresh*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: frontend/src/components/GuideOverlay.tsx
- FOUND: frontend/src/components/DateRangePicker.tsx
- FOUND commit: 800c1fe (Task 1)
- FOUND commit: 61f51bd (Task 2)
