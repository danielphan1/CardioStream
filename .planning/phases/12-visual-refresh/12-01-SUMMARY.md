---
phase: 12-visual-refresh
plan: 01
subsystem: ui
tags: [css, design-tokens, tailwind4, wcag, contrast, vitest, accessibility]

# Dependency graph
requires: []
provides:
  - "--color-accent (light #B94927 / dark #DA6F4E) replacing the old navy pair — every component consuming var(--color-accent) picks this up automatically"
  - "--shadow-elevation themed custom property (light + dark), mirroring the --band-opacity per-theme pattern"
  - "--text-control / --text-h2 / --text-h1 named @theme type-scale tokens (20px/24px/32px, unchanged rendered sizes)"
  - "wcag-contrast devDependency + frontend/src/tests/contrast.test.ts regression coverage proving the new accent pair clears WCAG AA in both themes"
affects: ["12-02", "12-03", "12-04", "12-05", "12-06", "12-07"]

# Tech tracking
tech-stack:
  added: ["wcag-contrast ^3.0.0 (devDependency)"]
  patterns:
    - "Themed custom properties declared once per theme block (:root / .dark), never per-component — consumers use var(--token) and pick up theme changes automatically at paint time"
    - "Named @theme type-scale tokens (--text-control/--text-h2/--text-h1) with paired --token--font-weight/--token--line-height companions, formalizing previously ad-hoc pixel literals with zero rendered-size change"
    - "wcag-contrast's hex() used for contrast-ratio assertions instead of a hand-rolled luminance formula"

key-files:
  created:
    - frontend/src/tests/contrast.test.ts
  modified:
    - frontend/src/index.css
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "wcag-contrast (v3.0.0, maintainer tmcw) approved via the Package Legitimacy Gate checkpoint after user reviewed npmjs.com/package/wcag-contrast and the GitHub repo — no alternative (colorjs.io/culori) needed for this single-purpose use"
  - "Dark-mode --shadow-elevation uses a different formula than light (low-opacity black shadow + 1px light hairline) rather than a darker version of the same shadow, per Material Design dark-theme elevation guidance — flat black shadows are imperceptible on near-black dark surfaces"
  - "All four D-04-locked token families (--color-focus, --cat-*, --band-opacity, --overlay-*) left byte-identical — verified via grep acceptance criteria, not just visual inspection"

requirements-completed: [VISUAL-01, VISUAL-02]

# Metrics
duration: ~15min (continuation session; Task 0 Package Legitimacy checkpoint was approved in a prior session)
completed: 2026-08-26
---

# Phase 12 Plan 01: Design Token Foundation Summary

**Swapped the navy accent for the UI-SPEC-locked terracotta/coral pair, added a themed --shadow-elevation token, and formalized three named type-scale tokens — all D-04-locked clinical/overlay/focus tokens left untouched, proven by a new wcag-contrast regression suite.**

## Performance

- **Duration:** ~15 min (this continuation session — Task 0's Package Legitimacy checkpoint was reached and approved by the user in a prior session with zero file changes)
- **Completed:** 2026-08-26T22:37:02Z
- **Tasks:** 2 of 2 auto tasks completed (Task 0 checkpoint pre-satisfied per continuation context)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `--color-accent` swapped from navy (`#14213D` light / `#8FC1D4` dark) to the UI-SPEC-locked warm terracotta/coral pair (`#B94927` light / `#DA6F4E` dark) in both `:root` and `.dark` — every one of the ~20 consuming components picks this up automatically via `var(--color-accent)`, no component edits needed
- New `--shadow-elevation` themed custom property added to both theme blocks, following the existing `--band-opacity` per-theme pattern; dark-mode variant intentionally uses a different shadow formula (low-opacity black + 1px light hairline) rather than a darker copy of the light shadow
- Three new named type-scale tokens (`--text-control` 20px, `--text-h2` 24px, `--text-h1` 32px) added to `@theme` with matching `--token--font-weight`/`--token--line-height` companions, at the exact sizes already rendered today — zero visual size change
- `wcag-contrast` installed as a devDependency (approved via the Package Legitimacy Gate) and a new `contrast.test.ts` proves the new accent pair clears WCAG AA 4.5:1 (text-on-accent) and 3:1 (accent-as-border against foam/sky) in both themes
- Full frontend suite green: 329/329 tests (323 pre-existing + 6 new), zero regressions
- `npx tsc -b --force` clean with zero type errors (wcag-contrast's untyped JS export resolved without issue under `moduleResolution: bundler`)

## Task Commits

Each task was committed atomically:

1. **Task 1: index.css — accent replacement, --shadow-elevation, type-scale tokens** - `aea8412` (feat)
2. **Task 2: wcag-contrast install + contrast.test.ts regression test** - `0c5ead1` (test)

_Note: Task 0 (Package Legitimacy Gate checkpoint) required no commit — it is a verification-only checkpoint with zero files modified, satisfied by the user's "approved" response in a prior session per the continuation context._

## Files Created/Modified
- `frontend/src/index.css` - `--color-accent` swapped to terracotta/coral in both themes; new `--shadow-elevation` per-theme token; three new `--text-control`/`--text-h2`/`--text-h1` `@theme` tokens with font-weight/line-height companions; every D-04-locked token (`--color-focus`, `--cat-*`, `--band-opacity`, `--overlay-*`) byte-identical
- `frontend/src/tests/contrast.test.ts` - New regression test asserting `hex()` contrast ratios for the new accent pair against `--color-accent-text`/`--color-foam`/`--color-sky` in both light and dark themes (6 assertions)
- `frontend/package.json` / `frontend/package-lock.json` - Added `wcag-contrast ^3.0.0` devDependency

## Decisions Made
- Kept the light-theme `--color-accent` comment updated to note "terracotta — replaces navy, D-03" rather than leaving the old comment, per the plan's either/or instruction, to make the token's history traceable from the CSS itself.
- Verified the D-04 token-locking constraint with explicit grep-based acceptance criteria (not just eyeballing the diff) before considering Task 1 done — this is the exact kind of scope-creep guard the plan's threat model (T-12-04) calls for.
- Ran `npx tsc -b --force` as an extra sanity check beyond the plan's stated verification (`npx vitest run`) since `wcag-contrast` ships no `.d.ts` — confirmed zero type errors under this project's `moduleResolution: bundler` config before considering the devDependency addition complete.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] `npm ci` required before any verification could run — worktree had no `node_modules`**
- **Found during:** Task 1 verification step (`cd frontend && npx vitest run --reporter=dot`)
- **Issue:** This worktree is a fresh git worktree checkout; `node_modules` is gitignored and not shared/symlinked from the main repo checkout, so `vite.config.ts`'s `import "vite"` and `import "@tailwindcss/vite"` failed with `ERR_MODULE_NOT_FOUND` before any test could run.
- **Fix:** Ran `npm ci` in `frontend/` to install the exact locked dependency tree from the plan's baseline `package-lock.json`, before proceeding to any Task 1/Task 2 verification or the `npm install --save-dev wcag-contrast` step.
- **Files modified:** None (installs `node_modules/`, which is gitignored — no tracked files affected)
- **Verification:** `npx vitest run --reporter=dot` then ran cleanly and reported the expected pre-existing 323/323 passing baseline before any Task 1 edits were verified
- **Committed in:** N/A (no tracked files changed; `node_modules/` is gitignored per `frontend/.gitignore`)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue, environment setup only)
**Impact on plan:** No scope creep. This was a worktree-isolation environment artifact (node_modules not present in a fresh worktree checkout), not a plan or code issue — no plan-scope files were touched to resolve it.

## Issues Encountered
None beyond the node_modules environment-setup deviation documented above.

## User Setup Required

None — no external service configuration required. The Package Legitimacy Gate checkpoint (Task 0) was the only human-in-the-loop step in this plan, and it was already resolved (user typed "approved" after reviewing npmjs.com/package/wcag-contrast) before this continuation session began.

## Next Phase Readiness

All Phase 12 Wave 2+ plans (12-02 through 12-07) can now consume `--color-accent`, `--shadow-elevation`, `--text-control`, `--text-h2`, and `--text-h1` by Tailwind utility class name or automatic `var(--color-accent)` resolution — no blockers. The full 329-test frontend suite is green, and the D-04-locked clinical/overlay/focus tokens are verified byte-identical, so downstream plans can rely on those values being exactly what they were before this plan.

---
*Phase: 12-visual-refresh*
*Completed: 2026-08-26*
