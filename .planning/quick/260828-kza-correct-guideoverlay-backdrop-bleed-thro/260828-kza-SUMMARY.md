---
phase: quick-260828-kza
plan: 01
subsystem: ui
tags: [react, guideoverlay, backdrop, accessibility, elementfrompoint, playwright]

# Dependency graph
requires:
  - phase: quick-260828-kbq
    provides: GuideOverlay's `fixed inset-x-0 bottom-0` + `top:clearanceAbove` scrollable region structure, which fixed the original band text-clipping bug but shrank the region's own backdrop coverage
provides:
  - A new, always-`fixed inset-0` `aria-hidden="true"` decorative backdrop div in GuideOverlay.tsx, restoring unconditional full-viewport opaque coverage independent of clearanceAbove's accuracy or the CommandBar band's stuck/unstuck state
  - Two new GuideOverlay.test.tsx structural assertions locking the two-element (backdrop + region) contract
affects: [guide-overlay, dashboard-shell, app-tsx-command-bar-band]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split a single overlay element's two responsibilities (full-viewport backdrop vs. scroll-safe content region) into two separate sibling DOM elements, rather than one element trying to serve both roles"
    - "Live-DOM elementFromPoint sweep (not getBoundingClientRect overlap math) as the verification method for paint-order/coverage bugs, run via ephemeral Playwright against isolated dev servers standed up specifically for the worktree"

key-files:
  created: []
  modified:
    - frontend/src/components/GuideOverlay.tsx
    - frontend/src/components/GuideOverlay.test.tsx

key-decisions:
  - "Split GuideOverlay's outer JSX into two siblings (Fragment-wrapped): a plain always-fixed inset-0 aria-hidden backdrop (z-40) plus the existing fixed inset-x-0 bottom-0 scrollable region (z-50, unchanged) -- restores full-viewport coverage without reverting kbq's clipping-safety fix"
  - "Live verification requires isolated dev servers when running inside a worktree -- the already-running frontend/backend processes on 5173/5174/8000 serve the main checkout's disk, not the worktree's edited files; stood up throwaway instances on 5180/8010 with a copied .env (CORS_ORIGINS adjusted) and a copied dev.db, torn down after"
  - "Refined the plan's suggested band-detection selector (`el.closest('section[aria-label=\"Command bar\"]')`) after live testing showed false positives: that selector only matches CommandBar's own inner section, a descendant of the true sticky/z-60 band container in App.tsx, so closest()'s upward-only traversal misses points landing in the band's own padding/gap area (still opaque, still part of the band, but not caught by the narrower selector). Fixed by walking up from the known landmark to find the ancestor with computed `position: sticky`, then using `.contains()` for band membership"
  - "The guide's own pre-existing internal sticky Close bar (`sticky top-0 z-10`, inside [role=\"region\"]) is intentionally allowed to overlap scrolled-past headings -- that's standard, reversible sticky-header behavior, not the external-band clipping bug this plan (and kbq before it) targets. The plan's own must_haves text scopes the clip-recheck to 'never...inside the CommandBar+AgentStatusBanner band' specifically, so this benign overlap is logged, not counted as a failure"
  - "Squashed the two TDD-protocol commits (test/RED, feat/GREEN) from Task 1 into a single commit before Task 3, because the plan's own Task 3 <verify> block explicitly checks HEAD for exactly one commit touching exactly the two GuideOverlay files -- the plan's explicit, testable acceptance criteria took priority over the general RED/GREEN commit-split convention"

patterns-established:
  - "When a plan's own <verify> block checks HEAD commit shape explicitly (single commit, N files), that supersedes the general TDD RED/GREEN/REFACTOR multi-commit convention for that task"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-08-28
---

# Phase quick-260828-kza: Correct GuideOverlay Backdrop Bleed-Through Summary

**Split GuideOverlay's single `[role="region"]` element into a plain always-`fixed inset-0` backdrop plus the existing scroll-safe region, restoring full-viewport opaque coverage that quick task 260828-kbq's clipping fix had inadvertently shrunk away — live-verified via elementFromPoint sweep (not rect math) at two viewport widths and four window/guide-scroll combinations each, zero bleed-through and zero clipping regressions.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-28 (worktree base commit 1f96a75, ~15:15 local)
- **Completed:** 2026-08-28 (~15:27 local)
- **Tasks:** 3 (all completed)
- **Files modified:** 2

## Accomplishments
- GuideOverlay now renders two elements when open: a decorative, non-interactive `div[aria-hidden="true"]` with `fixed inset-0` (unconditional full-viewport coverage, z-40) as the first sibling, followed by the unchanged `[role="region"][aria-label="Site guide"]` scrollable content region (`fixed inset-x-0 bottom-0` + inline `top: clearanceAbove`, z-50)
- Live-verified (Playwright, elementFromPoint sweep against isolated dev servers on ports 5180/8010) that no dashboard content (Header, FilterBar, chip labels) is ever painted underneath the guide overlay, at both 1440x900 and 390x844, at both an unstuck-band (`window.scrollY=0`) and a stuck-band (`window.scrollY=800`) state, at two guide-internal scroll positions each — 8 combinations per viewport, 16 total, zero bleed-through failures
- Re-confirmed kbq's original clipping fix still holds under the same live sweep: every visible guide `h2`/`p` element's center point resolves back to itself (or a descendant), never into the external CommandBar+AgentStatusBanner band
- Two new automated structural tests (`GuideOverlay.test.tsx`) lock the two-element contract going forward — full suite now 30 files / 363 tests, up from the 361-test baseline

## Task Commits

1. **Task 1 + Task 3 (squashed): Split GuideOverlay backdrop from scroll region** - `beef896` (fix)
   - Originally executed as TDD RED (`2ae9fe1`, test-only, confirmed 2 failing) → GREEN (`3df4596`, feat), then squashed into one commit per Task 3's own explicit `<verify>` requirement (HEAD must be a single commit touching exactly 2 files)
2. **Task 2: Live-verify no bleed-through and no reintroduced clipping** - no persistent commit (verification-only; zero code changes were needed beyond Task 1's implementation — confirmed via Playwright elementFromPoint sweep, evidence discussed below; all scratch artifacts deleted after use)

**Plan metadata:** _(docs commit deferred to orchestrator per constraints)_

_Note: Task 1 was originally two TDD commits (RED test commit, GREEN feat commit); both were squashed into `beef896` before Task 3 to satisfy Task 3's own automated verification, which checks that HEAD is a single commit containing exactly `GuideOverlay.tsx` and `GuideOverlay.test.tsx`._

## Files Created/Modified
- `frontend/src/components/GuideOverlay.tsx` - Added a `<div aria-hidden="true" className="fixed inset-0 z-40 bg-[var(--color-foam)]" />` backdrop as the first child of a new outer `<>...</>` Fragment, before the pre-existing `[role="region"]` scrollable element (left byte-for-byte unchanged); updated the region's structural comment to describe the two-element split
- `frontend/src/components/GuideOverlay.test.tsx` - Added two new `it(...)` cases: backdrop exists / is full-viewport (`fixed inset-0`, not `inset-x-0`/`bottom-0`), and backdrop has no `role` and is a distinct DOM node from `[role="region"]`

## Decisions Made
- See `key-decisions` in frontmatter above for the full rationale on: the two-element split design, isolated-dev-server verification setup, the band-detection selector fix discovered during live testing, the benign-Close-bar-overlap scoping decision, and the commit-squash reconciliation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in verification tooling] Fixed a false-positive band-detection selector in the Task 2 live-verification script**
- **Found during:** Task 2 (initial run of the elementFromPoint sweep)
- **Issue:** The plan's own suggested band-membership check (`el.closest('section[aria-label="Command bar"]') !== null || el.closest('[role="status"]') !== null`) produced 6 false-positive "bleed-through" and 3 false-positive "clip-recheck" failures. Root cause: `section[aria-label="Command bar"]` is `CommandBar.tsx`'s own inner `<section>`, a *descendant* of the true sticky/`z-[60]` band container (`<section ref={commandBarRef}>` in `App.tsx`). `closest()` only traverses upward from a resolved element, so it can't match when `elementFromPoint` resolves to an *ancestor* of that landmark (e.g. the band's own padding/gap area between `CommandBar` and `AgentStatusBanner`, which is still opaque and still part of the band's own `bg-[var(--color-sky)]` box, just not covered by either narrow landmark selector)
- **Fix:** Rewrote the band-detection logic to walk up from the known `section[aria-label="Command bar"]` landmark until finding the ancestor with computed `position: sticky` (guaranteed to be `commandBarRef`'s own section while `guideOpen` is true), then used `.contains()` for band membership instead of `.closest()` on a too-narrow selector. This is a fix to the ephemeral, session-local verification script only — no GuideOverlay.tsx/App.tsx source change was needed or made
- **Files modified:** none in the repo (scratch `verify.mjs`, deleted after use)
- **Verification:** Re-ran the sweep after the fix — 0 bleed-through failures, 0 clip-recheck failures across all 16 combinations (8 per viewport × 2 viewports)
- **Committed in:** N/A (scratch tooling, not committed)

**2. [Rule 1 - Bug in verification tooling] Scoped the clip-recheck to exclude the guide's own pre-existing internal sticky Close bar**
- **Found during:** Task 2 (initial run of the elementFromPoint sweep)
- **Issue:** 4 clip-recheck "failures" were guide headings/paragraphs whose center point, at certain guide-internal scroll positions, resolved to the guide's OWN internal `sticky top-0 z-10` Close bar (inside `[role="region"]`) rather than themselves. This is expected, pre-existing, reversible sticky-header overlap (scroll further to bring the heading back into view) -- structurally identical to any sticky table/nav header covering content beneath it -- and is unrelated to the external-band clipping bug this plan (and kbq before it) specifically targets. The plan's own `must_haves.truths` text scopes the re-check to resolving "never to something inside the CommandBar+AgentStatusBanner band," not the guide's own internal Close bar
- **Fix:** Refined the clip-recheck to only flag a mismatch as a real failure when the resolved element is inside the external band root; overlaps with the guide's own internal Close bar are logged separately as benign, non-failing information
- **Files modified:** none in the repo (scratch `verify.mjs`, deleted after use)
- **Verification:** Re-ran the sweep — the 4 benign Close-bar overlaps are now correctly excluded from the pass/fail signal; 0 real clip-recheck failures remain across all 16 combinations
- **Committed in:** N/A (scratch tooling, not committed)

**3. [Process reconciliation, not a Rule 1-3 bug] Squashed Task 1's two TDD commits into one before Task 3**
- **Found during:** Task 3 (final regression sweep)
- **Issue:** My general TDD execution protocol produces separate RED (`test(...)`) and GREEN (`feat(...)`) commits per task. This plan's own Task 3 `<verify>` block explicitly checks that HEAD is a single commit containing exactly `GuideOverlay.tsx` and `GuideOverlay.test.tsx` (via `git show --name-only --format='' HEAD | wc -l` = 2) — a shape the two separate Task 1 commits didn't satisfy
- **Fix:** `git reset --soft` back to the pre-Task-1 base commit, re-staged both files, and committed once with Task 3's prescribed commit message and an expanded body summarizing the full change
- **Files modified:** frontend/src/components/GuideOverlay.tsx, frontend/src/components/GuideOverlay.test.tsx (same files, same final content — only commit history shape changed)
- **Verification:** `git show --stat HEAD | grep -c "GuideOverlay"` → 4; `git show --name-only --format='' HEAD | wc -l` → 2 (both match Task 3's automated checks)
- **Committed in:** `beef896`

---

**Total deviations:** 3 (2 verification-tooling bug fixes, 1 commit-history reconciliation). No source-code deviations from the plan — GuideOverlay.tsx and GuideOverlay.test.tsx were implemented exactly as specified in Task 1; both verification-script fixes and the commit squash were needed to correctly execute Task 2 and Task 3 as the plan's own acceptance criteria required.
**Impact on plan:** None on scope — no additional source changes were needed beyond Task 1's initial implementation. All three deviations were process/tooling corrections required to faithfully satisfy the plan's own stated verification criteria.

## Issues Encountered
- The frontend/backend dev servers already running on 5173/5174/8000 (confirmed via `ps`/`lsof` to be running from the main checkout, not this worktree) would not have reflected the worktree's GuideOverlay.tsx edits. Stood up isolated instances instead: backend on port 8010 (main checkout's `.venv` Python interpreter invoked from the worktree's `backend/` directory — confirmed via `import app; print(app.__file__)` that cwd-relative resolution correctly picks up worktree source over the venv's editable-install `.pth` redirect — with a copied `.env`/`dev.db`, `CORS_ORIGINS` adjusted to the new frontend port), frontend on port 5180 (`VITE_API_URL` overridden to point at 8010). Both torn down (`kill`) and all copied `.env`/`dev.db` files removed after verification completed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GuideOverlay's backdrop-bleed-through regression (introduced by 260828-kbq) is fully corrected and live-verified; the original text-clipping fix from kbq remains intact and re-confirmed
- No known follow-up work identified for GuideOverlay itself
- STATE.md's Quick Tasks table should mark `260828-kbq`'s row status as fully resolved now that this follow-up (`260828-kza`) has landed and been verified

---
*Phase: quick-260828-kza*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: frontend/src/components/GuideOverlay.tsx
- FOUND: frontend/src/components/GuideOverlay.test.tsx
- FOUND: .planning/quick/260828-kza-correct-guideoverlay-backdrop-bleed-thro/260828-kza-SUMMARY.md
- FOUND: commit beef896 (fix(frontend): split GuideOverlay backdrop from scroll region to stop dashboard bleed-through)
