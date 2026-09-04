---
phase: 13-visual-redesign-nautical-minimalist-theme
plan: 05
subsystem: frontend-filter-controls
tags: [visual-redesign, tokens, filterbar, overlaytoggle, daterangepicker]
dependency-graph:
  requires: ["13-01", "13-02"]
  provides: "Filter, overlay, and custom-date-range controls re-skinned to Phase 13 Slack Water/Night Watch tokens"
  affects: ["frontend/src/components/FilterBar.tsx", "frontend/src/components/OverlayToggle.tsx", "frontend/src/components/DateRangePicker.tsx"]
tech-stack:
  added: []
  patterns: ["mechanical Phase-12→Phase-13 token find/replace per 13-PATTERNS.md (--color-sky→--color-mist, --color-ink→--color-depth, --color-accent(+ -text)→--color-brass(+ -text), --color-foam→--color-deck, text-control→text-label)"]
key-files:
  created: []
  modified:
    - frontend/src/components/FilterBar.tsx
    - frontend/src/components/OverlayToggle.tsx
    - frontend/src/components/DateRangePicker.tsx
decisions:
  - "Applied the section-wrapper background token swap (bg-[var(--color-sky)] → bg-[var(--color-mist)]) in FilterBar.tsx (line 94) and OverlayToggle.tsx (line 58) even though the plan's <action> text didn't explicitly call out those two lines — the plan's own acceptance criteria requires a zero-count grep for `color-sky` across each whole file, and 13-PATTERNS.md's stated executor contract is a full mechanical token find/replace, not a partial one. Left as in-scope completion of the stated task, not a deviation requiring a new rule."
metrics:
  duration: "~25min"
  completed: 2026-09-04
---

# Phase 13 Plan 05: Filter/Overlay/Date-Range Controls Re-skin Summary

Re-skinned FilterBar.tsx, OverlayToggle.tsx, and DateRangePicker.tsx — the three shared `inactiveClass`/`activeClass`/`aria-pressed` control surfaces plus the custom date-range disclosure — from Phase 12's terracotta/coral token names to Phase 13's Slack Water (light) / Night Watch (dark) "Brass"/"Mist"/"Depth" token system, with zero change to ARIA state signaling or the `useAgentPulse` motion-safe pulse ring behavior.

## What Was Built

**Task 1 — FilterBar.tsx and OverlayToggle.tsx:**
- `inactiveClass`/`activeClass` constants in both files migrated from `--color-sky`/`--color-ink`/`--color-accent(-text)` to `--color-mist`/`--color-depth`/`--color-brass(-text)`, and from `text-control font-bold` to the new `text-label` named type-scale token (which already carries weight 600 and line-height via `@theme` in `index.css`, so the separate `font-bold` class was dropped as redundant).
- Agent-pulse ring (`pulseClass`) in both files re-pointed from `ring-[var(--color-accent)]` to `ring-[var(--color-brass)]`.
- FilterBar's category-chip active-state `boxShadow` ring moved from `var(--color-ink)` to `var(--color-depth)`.
- Both files' `<section>` wrapper backgrounds moved from `bg-[var(--color-sky)]` to `bg-[var(--color-mist)]` (see Decisions — required by acceptance criteria though not itemized in the plan's line-by-line action text).
- OverlayToggle's "Overlay:" label and both sentence/note paragraphs moved to `text-label`/`text-[var(--color-depth)]`.
- FilterBar's filter-state sentence paragraph moved to `text-[var(--color-depth)]` (font size unchanged at `text-[18px]`, already Body scale).

**Task 2 — DateRangePicker.tsx:**
- `rdpSizing` CSS custom-property object: `--rdp-accent-color` → `var(--color-brass)`, `--rdp-accent-background-color` → `var(--color-mist)`.
- `inputClass` (From/To text inputs): border/text `--color-ink` → `--color-depth`, background `--color-foam` → `--color-deck`.
- Both `<label>` classes and the `DayPicker` wrapper: `text-control font-bold` → `text-label`, `--color-ink` → `--color-depth`.
- Apply button: active branch `--color-accent`/`--color-accent-text` → `--color-brass`/`--color-brass-text`; disabled branch `--color-ink`/`--color-sky` → `--color-depth`/`--color-mist`; both branches' `text-control font-bold` → `text-label`.

All `aria-pressed` attributes, the `role="group"` groupings, the `aria-expanded`/`aria-invalid`/`aria-live`/`aria-disabled` wiring, and the `isValidDateText`/`parseDateOnly` date-text validation path are byte-identical to before this plan — only className token names and the type-scale class changed, exactly as scoped.

## Deviations from Plan

None requiring a new rule. One completion note: the plan's `<action>` prose for Task 1 named specific line numbers for the `inactiveClass`/`activeClass`/pulse/chip-ring/sentence edits but did not explicitly list the `<section>` wrapper's own `bg-[var(--color-sky)]` (FilterBar.tsx line 94, OverlayToggle.tsx line 58). Both files' acceptance criteria require `grep -c "color-ink\|color-sky\|color-accent\b"` to return `0` across the *whole file*, and 13-PATTERNS.md documents the executor's job as a full mechanical token find/replace, not a partial one — so both section backgrounds were swapped to `--color-mist` to satisfy the stated acceptance gate. Verified via `grep -c` returning `0` for both files before committing.

## Verification

- `cd frontend && npx vitest run src/components/OverlayToggle.test.tsx` → 15/15 passed
- `cd frontend && npx vitest run src/components/DateRangePicker.test.tsx` → 3/3 passed
- `grep -c "color-ink\|color-sky\|color-accent\b" FilterBar.tsx OverlayToggle.tsx` → 0 for both
- `grep -c "color-ink\|color-sky\|color-foam\|color-accent\b\|color-accent-text" DateRangePicker.tsx` → 0
- `grep -c "text-control"` → 0 across all three files
- Node dependencies were not yet installed in this worktree (fresh worktree checkout, `node_modules` gitignored); ran `npm install` in `frontend/` to restore the existing lockfile-pinned dependency set before running tests — no new packages added, no `package.json`/`package-lock.json` changes.

## Known Stubs

None — this plan only changes className/style token references; no new components, props, or data wiring were introduced.

## Self-Check: PASSED

- FOUND: frontend/src/components/FilterBar.tsx
- FOUND: frontend/src/components/OverlayToggle.tsx
- FOUND: frontend/src/components/DateRangePicker.tsx
- FOUND: commit b4eb9e2 (Task 1: FilterBar + OverlayToggle re-skin)
- FOUND: commit a4943f5 (Task 2: DateRangePicker re-skin)
