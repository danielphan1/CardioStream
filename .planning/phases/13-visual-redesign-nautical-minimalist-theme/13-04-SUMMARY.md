---
phase: 13-visual-redesign-nautical-minimalist-theme
plan: 04
subsystem: ui
tags: [react, tailwind, design-tokens, accessibility, wcag]

# Dependency graph
requires:
  - phase: 13-01
    provides: "index.css token layer — --color-panel/--color-panel-text (non-inverting dark feature-panel pair), --color-deck/--color-mist/--color-depth/--color-brass(-text), text-label/text-heading/text-display type scale"
  - phase: 13-02
    provides: "Self-hosted Inter + Space Grotesk fonts wired into main.tsx"
provides:
  - "App.tsx re-skinned to Phase 13 tokens sitewide (ChartSkeleton, error card, ReadingsTable heading, Upload/Records view backgrounds)"
  - "App.tsx's CommandBar wrapper band switched to the dedicated --color-panel token — the one deliberately non-Mist surface in the app"
  - "CommandBar.tsx re-skinned as the dark 'feature panel': self-contained chips renamed straight, ambient (no-own-fill) text flipped to --color-panel-text, and the cat-normal confirmation line wrapped in a solid WCAG-safe pill"
affects: [13-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ambient/no-own-background text on a fixed dark surface must consume the surface's own non-inverting text-pair token (--color-panel-text), never the theme-inverting ink/depth token or the deck token"
    - "When a single fixed-hue accent (--cat-normal) needs to render on a background that is dark in one theme but not proven ≥4.5:1 in the other, wrap it in a solid pill (bg + high-contrast chip text) instead of relying on bare colored text, applied identically in both themes rather than a theme-conditional branch"

key-files:
  created: []
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/CommandBar.tsx

key-decisions:
  - "CommandBar wrapper band (App.tsx line ~214) uses --color-panel, not --color-depth — --color-depth inverts per theme by design (dark navy light-theme / near-white dark-theme), which would make the panel correctly dark in light theme but the single brightest surface on the page in dark theme"
  - "The green cat-normal-on-panel confirmation line (voice armed-hint/live-transcript) is rendered as a solid pill in BOTH themes, not theme-conditional bare text — the light-theme bare pairing (#2B7A5B on #101C2E) measures ~3.29:1, below the 4.5:1 floor, while the dark-theme pairing passes at ~8.82:1; a single non-conditional pill implementation is simpler and equally correct since the passing dark pairing doesn't require bare text either"
  - "CommandBar.tsx's remaining `text-control` type-scale usages (Send/Cancel buttons) were left untouched — out of scope for this plan per its own task boundaries (Task 1's typography rename was scoped explicitly to App.tsx only); no sibling Phase 13 plan lists CommandBar.tsx in files_modified, so this is a pre-existing Wave-1 token-layer gap, not something introduced by this plan's edits"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-09]

# Metrics
duration: ~15min
completed: 2026-09-04
---

# Phase 13 Plan 04: Command Bar Feature-Panel Re-skin Summary

**App.tsx and CommandBar.tsx migrated to Phase 13 nautical-minimalist tokens; the Command Bar now reads as the app's one dark, contrasting instrument panel via the dedicated non-inverting `--color-panel`/`--color-panel-text` pair, with every ambient text element re-verified for WCAG contrast against the new fixed-dark background.**

## Performance

- **Duration:** ~15 min (includes `npm install` to hydrate the worktree's missing `node_modules`, plus full 32-file/379-test suite run)
- **Started:** 2026-09-04T19:09:00Z (approx, first file read)
- **Completed:** 2026-09-04T19:15:16Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- App.tsx: sitewide Phase-12→Phase-13 token rename (`--color-sky`→`--color-mist`, `--color-ink`→`--color-depth`, `--color-foam`→`--color-deck`, `--color-accent`(+`-text`)→`--color-brass`(+`-text`)) across ChartSkeleton, the error card, the ReadingsTable heading, and the Upload/Records view backgrounds, plus the `text-h2`→`text-heading` / `text-control`→`text-label` type-scale migration on the touched headings/button
- App.tsx: the CommandBar wrapper band is the one deliberate exception — switched to `var(--color-panel)` instead of the sitewide Mist rename, per `13-UI-SPEC.md`'s "one dark, contrasting feature panel" component-language rule (D-04)
- CommandBar.tsx: self-contained chips (mic "off" state, text input, Send button, Cancel button, the working/armed ring) renamed to their straight Phase-13 token equivalents
- CommandBar.tsx: every ambient (no-own-background) text element — the Working… label + spinner ring, the Speaking… label, and the default (non-green) confirmation-line branch — flipped to `--color-panel-text`, the always-light, non-inverting pairing for `--color-panel`, so none of them go dark-on-dark in light theme
- CommandBar.tsx: the green `cat-normal` armed-hint/live-transcript confirmation line is now a solid pill (`bg-[var(--cat-normal)] text-[var(--cat-chip-text)] rounded-full px-3 py-1 w-fit`) in both themes, closing the light-theme bare-text WCAG failure (~3.29:1) the plan's contrast analysis identified

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-skin App.tsx, including the CommandBar wrapper's new feature-panel background** - `9b3a278` (feat)
2. **Task 2: Re-skin CommandBar.tsx as the dark feature panel, with a Panel-text flip on every ambient text element** - `0aa1cb9` (feat)

**Plan metadata:** committed alongside this SUMMARY (worktree mode — orchestrator handles the final metadata commit after merge)

## Files Created/Modified
- `frontend/src/App.tsx` - Sitewide token rename to Phase 13 palette; CommandBar wrapper band switched to `--color-panel`; error-card and ReadingsTable headings migrated to the new type scale
- `frontend/src/components/CommandBar.tsx` - Self-contained chips renamed straight to Phase 13 tokens; ambient text flipped to `--color-panel-text`; cat-normal confirmation line wrapped in a solid WCAG-safe pill

## Decisions Made
- Followed the plan's explicit token/typography scoping exactly: App.tsx got both the color-token rename and the `text-h2`/`text-control`→`text-heading`/`text-label` typography rename on its touched elements; CommandBar.tsx got only the color-token treatment (categories A/B/C) as specified — its own `text-control` usages on Send/Cancel were intentionally left alone since the plan's action text never asked for that rename there and no sibling Phase-13 plan owns this file to pick it up later. See Key Decisions in frontmatter for full rationale.
- `npm install` was run to hydrate this worktree's `node_modules` (absent at spawn) from the already-committed `package-lock.json` — a standard dependency hydration, not a new/untrusted package install, so it does not trigger the Rule 3 package-legitimacy exclusion.

## Deviations from Plan

None - plan executed exactly as written. The `npm install` step was infrastructure hydration (empty worktree `node_modules`), not a plan deviation — no package versions changed from what `package-lock.json` already pinned.

## Issues Encountered
- This worktree had no `node_modules` at spawn time (`vitest`/`vite` unresolved), which blocked both tasks' `<verify>` steps. Resolved by running `npm install` against the already-committed lockfile before any test run; verified via `git status --short` that no lockfile/package.json changes resulted (only the gitignored `node_modules` directory was populated).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- App.tsx and CommandBar.tsx are fully migrated to Phase 13 tokens; zero Phase-12 token/type-scale names remain in either file (verified via grep per the plan's acceptance criteria).
- Plan 13-11 still owns wiring `StatsStrip`'s `readings` prop at the App.tsx call site (line ~237, untouched by this plan) — per this plan's own explicit exclusion, to avoid a same-file excess-prop TypeScript conflict across sibling Wave-2 plans.
- Full frontend suite (32 files / 379 tests) passes post-change, including `CommandBar.test.tsx` (27/27) and `contrast.test.ts` (12/12).
- Manual/visual verification (browser, both themes: Command Bar reads as the one dark panel, all controls and ambient text remain legible) is deferred to the phase's own end-of-phase human-verify checkpoint per `13-04-PLAN.md`'s `<verification>` section — not performed by this executor, consistent with the plan's automated-only `<verify>` blocks per task.

---
*Phase: 13-visual-redesign-nautical-minimalist-theme*
*Completed: 2026-09-04*
