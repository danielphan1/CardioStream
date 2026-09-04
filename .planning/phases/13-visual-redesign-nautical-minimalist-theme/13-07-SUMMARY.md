---
phase: 13-visual-redesign-nautical-minimalist-theme
plan: 07
subsystem: ui
tags: [react, recharts, tailwind, design-tokens, typography]

# Dependency graph
requires:
  - phase: 13-visual-redesign-nautical-minimalist-theme (13-01, 13-02)
    provides: Phase 13 "Slack Water" / "Night Watch" design-token layer in index.css (--color-mist, --color-depth, --color-brass, --color-brass-text, --text-heading, --text-label) and self-hosted Inter/Space Grotesk fonts
provides:
  - BPTimeline.tsx, ChartTooltip.tsx, CategoryBars.tsx, AmPmComparison.tsx, and ChartDeck.tsx re-skinned to Phase 13 tokens with the Two-Weight Rule (400/600, no 700) applied to every SVG/inline-style text glyph in these files
  - chartData.ts doc comment corrected to reference Inter instead of the removed Atkinson Hyperlegible font
affects: [13-08, 13-09, 13-10, 13-11, 13-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-Weight Rule enforcement: every SVG <text fontWeight={...}> and inline style={{fontWeight}} in chart-region components uses 600, never 700, matching Phase 13's --text-*--font-weight tokens"

key-files:
  created: []
  modified:
    - frontend/src/components/charts/BPTimeline.tsx
    - frontend/src/lib/chartData.ts
    - frontend/src/components/charts/ChartTooltip.tsx
    - frontend/src/components/charts/CategoryBars.tsx
    - frontend/src/components/charts/AmPmComparison.tsx
    - frontend/src/components/ChartDeck.tsx

key-decisions:
  - "Fixed AmPmComparison.tsx's AM/PM value-label fontWeight={700} (not called out in the plan's action prose) because the plan's own must_haves.truths explicitly lists \"AM/PM value labels\" among the SVG glyphs required to be weight 600, and the acceptance criteria's grep for zero fontWeight={700} occurrences in this file would otherwise fail."

requirements-completed: [D-01, D-06, D-07, D-08, D-09]

# Metrics
duration: ~12min
completed: 2026-09-04
---

# Phase 13 Plan 07: Chart-Region Re-skin (Two-Weight Rule + Token Rename) Summary

**Re-skinned five chart-region components (BPTimeline, ChartTooltip, CategoryBars, AmPmComparison, ChartDeck) to Phase 13's Slack Water/Night Watch tokens and enforced the Two-Weight Rule (400/600, no 700) on every text glyph they render, with PulseTrend.tsx confirmed to need zero changes.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-04T19:03:00Z (approx, worktree setup + fast-forward)
- **Completed:** 2026-09-04T19:15:28Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- BPTimeline.tsx's two SVG label-glyph helpers (band-label chip, line-end label) now render at weight 600, not 700; the file's `chart-band` opacity mechanism and clinical band colors were untouched (they resolve to new Phase 13 hex automatically via Plan 13-01's token layer)
- chartData.ts's `CHIP_CHAR_WIDTH_FACTOR` doc comment now references Inter instead of the removed Atkinson Hyperlegible font (numeric estimate factor itself unchanged, still deliberately generous)
- ChartTooltip.tsx's click-persistent hero dialog re-skinned: `--color-sky`/`--color-ink` → `--color-mist`/`--color-depth`, Close button `--color-accent`/`--color-accent-text` → `--color-brass`/`--color-brass-text`, all three `fontWeight: 700` sites → 600
- CategoryBars.tsx's bar-end label fill `--color-ink` → `--color-depth`
- AmPmComparison.tsx's period-label fill and both heading `color-ink` references → `--color-depth`, heading `fontWeight: 700` → 600, and (deviation, see below) the AM/PM value-label glyph's `fontWeight={700}` → 600
- ChartDeck.tsx's hero heading and mini chart-picker cards re-skinned to `--color-depth`/`--color-mist` and the named `text-heading`/`text-label` type-scale tokens, replacing the old `text-h2 font-bold`/`text-control font-bold` pairs; the mini cards' `min-h-12` 48px floor is unchanged
- PulseTrend.tsx confirmed via read + `git diff --stat` to need zero edits — no `--color-*` token references, no `fontWeight={700}` literal

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix BPTimeline.tsx's two SVG font-weight literals; update chartData.ts's font-name doc comment; verify PulseTrend.tsx needs no changes** - `099eca4` (fix)
2. **Task 2: Re-skin ChartTooltip.tsx, CategoryBars.tsx, and AmPmComparison.tsx** - `b179d1f` (feat)
3. **Task 3: Re-skin ChartDeck.tsx** - `a73c3f8` (feat)

**Plan metadata:** committed separately by the orchestrator after merge (worktree mode — STATE.md/ROADMAP.md not touched by this agent)

## Files Created/Modified
- `frontend/src/components/charts/BPTimeline.tsx` - two SVG `<text fontWeight>` literals 700 → 600 (band-label chip, line-end label)
- `frontend/src/lib/chartData.ts` - doc comment above `CHIP_CHAR_WIDTH_FACTOR` now says "Inter" instead of "Atkinson Hyperlegible"
- `frontend/src/components/charts/ChartTooltip.tsx` - dialog background/text/border and Close button re-skinned to Phase 13 tokens, all fontWeight 700 → 600
- `frontend/src/components/charts/CategoryBars.tsx` - bar-end label fill `--color-ink` → `--color-depth`
- `frontend/src/components/charts/AmPmComparison.tsx` - period-label fill, heading color, and AM/PM value-label fill/weight re-skinned; all fontWeight 700 → 600
- `frontend/src/components/ChartDeck.tsx` - hero heading and mini chart-picker cards re-skinned to `--color-depth`/`--color-mist` and named type-scale tokens

## Decisions Made
- AmPmComparison.tsx's AM/PM value-label `fontWeight={700}` was fixed to 600 even though the plan's Task 2 action prose only mentioned the period-label `fill` and the two heading blocks — the plan's own `must_haves.truths` explicitly lists "AM/PM value labels" as required to be weight 600, and the acceptance criterion `grep -c "fontWeight: 700\|fontWeight={700}" ... AmPmComparison.tsx returns 0` would otherwise have failed. Treated as Rule 1 (bug — action prose omission contradicted the plan's own stated truths/acceptance criteria), not a scope expansion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AmPmComparison.tsx's AM/PM value-label fontWeight left at 700 by the plan's action prose**
- **Found during:** Task 2 (Re-skin ChartTooltip.tsx, CategoryBars.tsx, and AmPmComparison.tsx)
- **Issue:** The plan's Task 2 `<action>` text described changing `makeBarLabels`'s period-label `fill` and the two heading `<p style>` blocks, but was silent on the adjacent value-label `<text fontWeight={700}>` glyph in the same function. The plan's own `must_haves.truths` ("Every SVG-rendered text glyph across these files uses weight 600, not 700 ... AM/PM value labels") and Task 2's acceptance criteria (`grep -c "fontWeight: 700\|fontWeight={700}" ... AmPmComparison.tsx returns 0`) both required this literal to be 600.
- **Fix:** Changed `fontWeight={700}` to `fontWeight={600}` on the value-label `<text>` element in `makeBarLabels` (line ~64), leaving its `fill="var(--cat-chip-text)"` untouched per the plan's explicit instruction.
- **Files modified:** frontend/src/components/charts/AmPmComparison.tsx
- **Verification:** `grep -c "fontWeight: 700\|fontWeight={700}" frontend/src/components/charts/AmPmComparison.tsx` returns 0; `npx tsc -b --noEmit` clean; full frontend vitest suite (379 tests) green
- **Committed in:** b179d1f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Necessary to satisfy the plan's own stated must_haves and acceptance criteria. No scope creep — same function, same file, already in scope for Task 2.

## Issues Encountered
- The worktree had no `node_modules` installed (fresh worktree checkout). Ran `npm ci` from the committed `package-lock.json` to install existing declared dependencies before running `tsc`/`vitest` — this is standard project setup from a lockfile, not a new-package install, so it does not fall under the package-manager-install exclusion in the deviation rules.
- The worktree branch (`worktree-agent-a10116153a57af829`) was created before Wave 1 merged into `main`; `git merge-base` confirmed the branch tip was a strict ancestor of `main`'s current HEAD, so a clean `git merge --ff-only main` (not a real three-way merge) brought in Wave 1's token layer and font imports with zero conflict risk.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All six files in this plan's scope (BPTimeline.tsx, chartData.ts, ChartTooltip.tsx, CategoryBars.tsx, AmPmComparison.tsx, ChartDeck.tsx, plus PulseTrend.tsx verified unchanged) contain zero Phase-12 token names (`color-ink`, `color-sky`, `color-accent`, `color-focus`) and zero `fontWeight: 700`/`fontWeight={700}` literals — confirmed via grep across the full file set, not just the plan's own listed criteria.
- `npx tsc -b --noEmit` is clean; `npx vitest run` (full suite) is 379/379 green including `ChartTooltip.test.tsx`'s 3 tests.
- No blockers for sibling Wave 2 plans (13-08 through 13-10) or downstream waves.

---
*Phase: 13-visual-redesign-nautical-minimalist-theme*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: .planning/phases/13-visual-redesign-nautical-minimalist-theme/13-07-SUMMARY.md
- FOUND: commit 099eca4 (Task 1)
- FOUND: commit b179d1f (Task 2)
- FOUND: commit a73c3f8 (Task 3)
