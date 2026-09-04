---
phase: 13-visual-redesign-nautical-minimalist-theme
plan: 11
subsystem: ui
tags: [react, recharts, tailwind, lucide-react, sparkline, accessibility]

# Dependency graph
requires:
  - phase: 13-visual-redesign-nautical-minimalist-theme (Plan 13-01/13-02)
    provides: token layer (--color-mist/--color-deck/--color-depth, --text-label/--text-display/font-display, --line-systolic/--line-diastolic, --shadow-elevation) and the Space Grotesk font import this plan finally consumes
  - phase: 13-visual-redesign-nautical-minimalist-theme (Plan 13-04)
    provides: App.tsx's re-skinned Command Bar panel background and the Dashboard() call-site shape this plan extends with the new readings prop
provides:
  - "StatsSparkline.tsx: new decorative per-tile trend sub-component (ResponsiveContainer + AreaChart, no axes/tooltip/accessibilityLayer, aria-hidden)"
  - "StatsStrip.tsx rewired to icon + label + large value + sparkline + status-pill card language (13-UI-SPEC.md Component Language item 2)"
  - "StatsStripProps.readings — new required prop, added and consumed atomically with its one App.tsx call site"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decorative-only Recharts sub-component: accessibilityLayer={false}, no XAxis/YAxis/Tooltip, aria-hidden wrapper — mirrors PulseTrend.tsx's mini-variant gating and BPTimeline.tsx's decorative/contrast-exemption precedent but has no hero branch at all"
    - "text-display/font-display reserved for exactly one visual role sitewide (the stat-tile numeric value) — enforced via grep in acceptance criteria, not just convention"

key-files:
  created:
    - frontend/src/components/charts/StatsSparkline.tsx
    - frontend/src/components/charts/StatsSparkline.test.tsx
  modified:
    - frontend/src/components/StatsStrip.tsx
    - frontend/src/App.tsx

key-decisions:
  - "Sparkline values sorted chronologically ascending (oldest-to-newest, matching the main chart's time-axis direction) — same convention as ReadingsTable.tsx's sort, just not reversed"
  - "Status pill (latest bp_category) applies only to Systolic/Diastolic tiles — Pulse has no AHA category ladder (only a bradycardia reference line) and Readings-count isn't a vital"
  - "Pulse tile's sparkline reuses the systolic navy color, mirroring PulseTrend.tsx's own documented reuse of that color for its single series"

patterns-established:
  - "New non-hero decorative Recharts sub-components should follow StatsSparkline's shape: no hero/mini branch, always minimal (no axes/tooltip/accessibilityLayer), aria-hidden wrapper"

requirements-completed: [D-04, D-05, D-06, D-07, D-08, D-09]

# Metrics
duration: 20min
completed: 2026-09-04
---

# Phase 13 Plan 11: StatsSparkline + StatsStrip Card Language Summary

**New decorative per-tile Recharts sparkline (StatsSparkline.tsx) wired into StatsStrip's four stat tiles alongside lucide-react icons, Space Grotesk display values, and a bp_category status pill on Systolic/Diastolic only.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T19:03:00Z (approx.)
- **Completed:** 2026-09-04T19:24:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Built the phase's one genuinely new UI piece: `StatsSparkline.tsx`, a decorative, `aria-hidden`, axis/tooltip-free Recharts AreaChart sub-component (RED/GREEN TDD cycle, 4 passing tests)
- Rewired all four `StatsStrip.tsx` tiles to the structural reference's icon + label + large value + sparkline + status-pill card language, consuming `StatsSparkline` and reusing existing `categoryColor()`/`CHIP_TEXT` tokens for the pill
- Added `StatsStripProps.readings` and wired its one `App.tsx` call site (`Dashboard()`) in the same task, so the prop was never required-but-unsatisfied or passed-but-unconsumed at any commit
- Gave `main.tsx`'s Space Grotesk import (Plan 13-02) its first real consumer: `text-display font-display` now appears in exactly one component in the whole app

## Task Commits

Each task was committed atomically (Task 1 followed the RED→GREEN TDD gate sequence):

1. **Task 1: Create the StatsSparkline decorative sub-component**
   - `a1d54f9` (test) — failing test written and confirmed to fail (module-not-found) before the component existed
   - `5b443bc` (feat) — implementation added, all 4 tests pass
2. **Task 2: Rewire StatsStrip.tsx to the card language, wire readings prop from App.tsx** — `85e1ded` (feat)

**Plan metadata:** committed separately by the orchestrator after this worktree's wave merges (worktree mode — STATE.md/ROADMAP.md not touched here).

## Files Created/Modified
- `frontend/src/components/charts/StatsSparkline.tsx` - new decorative sparkline: `{ values, color }` props, returns `null` for `< 2` points, `ResponsiveContainer` → `AreaChart` → one `Area`, `aria-hidden="true"` wrapper, `accessibilityLayer={false}`, no axes/Tooltip
- `frontend/src/components/charts/StatsSparkline.test.tsx` - 4 behavior tests (renders for ≥2 points, null for 1 point, null for empty array, aria-hidden wrapper always present when rendered)
- `frontend/src/components/StatsStrip.tsx` - `VitalTile` restructured to accept `{ label, vital, Icon, values, sparklineColor, statusCategory }`; new `readings: Reading[]` prop derives `chronological`/`latestCategory`; 4 lucide-react icons (`Gauge`/`Activity`/`HeartPulse`/`ListChecks`); `SkeletonTile` and category-chip row retokenized (`color-sky`→`color-mist`, `color-foam`→`color-deck`)
- `frontend/src/App.tsx` - `<StatsStrip>` call site now passes `readings={readings.data ?? []}` (readings query result was already in scope in `Dashboard()`)

## Decisions Made
- Chronological sort direction for the sparkline series matches the main chart's left-to-right time axis, not the ReadingsTable's newest-first table order (documented inline in `StatsStrip.tsx`)
- Status pill gating (Systolic/Diastolic only) is a clinical-correctness decision, not a styling one — BP category is a joint systolic+diastolic classification, so showing it on a single-vital Pulse tile would misrepresent what the pill means
- Pulse's sparkline color deliberately reuses `--line-systolic` (matching `PulseTrend.tsx`'s own precedent) rather than inventing a new hue for a metric that has no dedicated line-chart color token

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a doc comment that tripped the plan's own acceptance-criteria grep**
- **Found during:** Task 1 (StatsSparkline.tsx) verification
- **Issue:** The file's top-of-file doc comment described the component as following "PulseTrend.tsx's mini-variant gating (no axes, no Tooltip)" — the literal word "Tooltip" in that prose comment caused the acceptance criterion `grep -c "Tooltip\|XAxis\|YAxis" ... returns 0` to return 1 (a comment match, not an actual `<Tooltip>`/`<XAxis>`/`<YAxis>` JSX usage)
- **Fix:** Reworded the comment to "no axes, no click-to-persist popover" — same meaning, no longer trips the literal grep
- **Files modified:** frontend/src/components/charts/StatsSparkline.tsx
- **Verification:** `grep -c "Tooltip\|XAxis\|YAxis" frontend/src/components/charts/StatsSparkline.tsx` now returns 0; full test suite still green
- **Committed in:** 5b443bc (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug/documentation-wording fix, zero functional change)
**Impact on plan:** Cosmetic-only fix to satisfy the plan's own literal acceptance-criteria grep. No scope creep, no behavior change.

## Issues Encountered
- The worktree had no `node_modules` installed (fresh worktree, `node_modules` is not tracked in git); ran `npm install` in `frontend/` before any test/build/lint command would run. Not a plan deviation — standard worktree setup, no source files affected.
- Merged `main`'s current HEAD (`1a67ed1`, Wave 1+2 tokens/App.tsx) into this worktree's branch before starting, per the branch-check instructions — clean fast-forward-style merge, no conflicts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `StatsSparkline.tsx` is a reusable decorative-sparkline building block available to any future stat-tile-shaped UI in this codebase
- Full frontend suite green: 33 test files / 383 tests passing after this plan's changes; `tsc -b --noEmit` clean; `npm run build` succeeds; `npm run lint` shows only 3 pre-existing warnings in unrelated files (`records/IncidentFields.tsx`, `records/LabFields.tsx`, `records/ProcedureFields.tsx` — out of scope, not touched by this plan)
- No blockers for the remaining Phase 13 plan(s)

---
*Phase: 13-visual-redesign-nautical-minimalist-theme*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: frontend/src/components/charts/StatsSparkline.tsx
- FOUND: frontend/src/components/charts/StatsSparkline.test.tsx
- FOUND: commit a1d54f9 (test)
- FOUND: commit 5b443bc (feat)
- FOUND: commit 85e1ded (feat)
