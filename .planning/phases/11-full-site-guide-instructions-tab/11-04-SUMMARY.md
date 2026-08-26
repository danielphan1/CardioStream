---
phase: 11-full-site-guide-instructions-tab
plan: 04
subsystem: ui
tags: [react, tailwind, accessibility, guide, zustand]

# Dependency graph
requires:
  - phase: 11-full-site-guide-instructions-tab (Plan 11-02)
    provides: "store/guide.ts — useGuide (open/setOpen/toggleOpen)"
  - phase: 11-full-site-guide-instructions-tab (Plan 11-03)
    provides: "lib/voiceCommands.ts — VOICE_COMMAND_CATEGORIES/SIMILAR_PHRASINGS_NOTE"
provides:
  - "GuideOverlay.tsx — full-screen, text-only, D-11/D-12/D-13-compliant site guide (landmark region, no modal/focus-trap semantics)"
  - "Header 'Guide' click toggle, styled identically to Theme/Voice Replies toggles"
affects: ["11-05 (App.tsx mount point + z-index stacking + manual verification)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "role=\"region\" landmark overlay (not role=\"dialog\") for full-screen surfaces that must not exclude sibling controls from the tab order"
    - "window-level keydown Escape listener (useEffect, added only while open) instead of a local onKeyDown on a focus-trapped container"

key-files:
  created:
    - frontend/src/components/GuideOverlay.tsx
    - frontend/src/components/GuideOverlay.test.tsx
  modified:
    - frontend/src/components/Header.tsx

key-decisions:
  - "GuideOverlay.tsx content is 100% static JSX text (no dangerouslySetInnerHTML anywhere) — voice-command reference imported from voiceCommands.ts, never re-authored"

patterns-established:
  - "Landmark region + window-level Escape listener is the reusable non-modal-overlay pattern for future full-screen surfaces that must not unmount/exclude CommandBar"

requirements-completed: []  # GUIDE-01/02/04 also claimed by Plan 11-05 (App.tsx wiring + manual verification) — left Pending in REQUIREMENTS.md per orchestrator instruction; 11-05 closes them out

# Metrics
duration: 25min
completed: 2026-08-26
---

# Phase 11 Plan 04: GuideOverlay Component + Header Guide Button Summary

**Full-screen, text-only site guide overlay (`GuideOverlay.tsx`) with a jump-to-section table of contents, 7 fixed-format control/flow sections, a "What Can I Say" voice-command reference sourced from `voiceCommands.ts`, and a Header "Guide" click toggle — zero modal/focus-trap semantics so `CommandBar` stays reachable while open.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-26T00:43:00Z (approx, worktree base-correction + context read)
- **Completed:** 2026-08-26T01:08:15Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `GuideOverlay.tsx`: closed → `null`, open → full guide (h1, ToC nav, 9 `<section>` blocks including the 7 fixed-format sections + What Can I Say + About This Guide)
- `role="region"` + `aria-label="Site guide"` landmark — no `role="dialog"`, no `aria-modal`, no focus trap (D-04); Escape (window-level listener) and the Close button both call `setOpen(false)`
- Upload and Add a Record sections correctly omit the "By voice:" paragraph; all other 5 sections include it
- "What Can I Say" section renders all 8 `VOICE_COMMAND_CATEGORIES` entries with their canonical example phrase and the shared `SIMILAR_PHRASINGS_NOTE`, imported (never re-authored)
- Header "Guide" button: icon (`BookOpen`) + text, `aria-pressed={guideOpen}`, styled byte-identical to the Theme/Voice Replies toggles, placed immediately after Voice Replies and before the View toggle block, present on every view Header mounts on (Dashboard/Upload/Records)

## Task Commits

Each task was committed atomically:

1. **Task 1: GuideOverlay.tsx + GuideOverlay.test.tsx** (TDD)
   - RED: `72f62d2` (test) — failing test asserting the component doesn't exist yet
   - GREEN: `6cd8272` (feat) — implementation, all 8 test behaviors pass
2. **Task 2: Header.tsx — "Guide" button** - `dbb8f51` (feat)

_TDD Task 1: test-first RED confirmed (`Failed to resolve import "./GuideOverlay"`), then GREEN (8/8 tests pass)._

## Files Created/Modified
- `frontend/src/components/GuideOverlay.tsx` - Full-screen, text-only site guide overlay (230 lines): ToC, 7 fixed-format sections, What Can I Say, About This Guide, Escape/Close handling
- `frontend/src/components/GuideOverlay.test.tsx` - 8 behavior tests: closed→null, open→content, all 9 headings, Escape/Close→setOpen(false), no dialog/aria-modal, Upload/Add-a-Record omit "By voice:", all 8 voice categories render
- `frontend/src/components/Header.tsx` - Added `BookOpen` import, `useGuide` import/reads, and the "Guide" toggle button between Voice Replies and the View toggle block

## Decisions Made
- None beyond what the plan already locked (11-UI-SPEC.md's markup/class contract followed verbatim for both the Close button and the Header Guide button).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing frontend node_modules**
- **Found during:** Task 1 (pre-flight check before running tests)
- **Issue:** This worktree had no `frontend/node_modules` — `npx vitest`/`npx tsc` would fail immediately.
- **Fix:** Ran `npm install` in `frontend/` (185 packages, matches the existing `package-lock.json`; no version changes).
- **Files modified:** none (node_modules is gitignored; no package.json/package-lock.json changes)
- **Verification:** `npx vitest run` and `npx tsc --noEmit` both ran successfully afterward.
- **Committed in:** N/A (gitignored, nothing to commit)

**2. [Rule 1 - Bug] Reworded a file-level comment to avoid a false-positive acceptance-criteria grep match**
- **Found during:** Task 1 (acceptance criteria verification)
- **Issue:** The doc comment at the top of `GuideOverlay.tsx` explained what was deliberately NOT used ("no `role=\"dialog\"`, no `aria-modal`"), but the plan's own acceptance criterion (`grep -c 'role="dialog"\|aria-modal' ... equals 0`) is a blunt literal-substring check that can't distinguish a comment from actual JSX — the comment itself tripped the check meant to catch real modal markup.
- **Fix:** Reworded the comment to describe the same fact without using the literal `role="dialog"`/`aria-modal` substrings (e.g. "no dialog role, no modal attribute").
- **Files modified:** `frontend/src/components/GuideOverlay.tsx`
- **Verification:** `grep -c 'role="dialog"\|aria-modal' frontend/src/components/GuideOverlay.tsx` now returns 0; all 8 tests still pass.
- **Committed in:** `6cd8272` (part of Task 1 GREEN commit)

**3. [Rule 1 - Bug] Collapsed the Header Guide button's icon+text onto one line to satisfy the `>Guide<` acceptance grep**
- **Found during:** Task 2 (acceptance criteria verification)
- **Issue:** An initial multi-line JSX formatting (`<BookOpen .../>\nGuide\n</button>`) is functionally identical but never produces a `>Guide<` substring on a single line, so the plan's literal `grep -c '>Guide<' ... equals 1` acceptance check failed (count 0).
- **Fix:** Reformatted to `<BookOpen aria-hidden="true" size={24} />Guide</button>` on one line, matching the plan's own exact markup snippet.
- **Files modified:** `frontend/src/components/Header.tsx`
- **Verification:** `grep -c '>Guide<' frontend/src/components/Header.tsx` returns 1; `tsc --noEmit` clean; visual spacing unaffected (flex `gap-2` applies at the flex-item level, not to literal whitespace between the icon and the text node).
- **Committed in:** `dbb8f51` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking/environment, 2 bugs — both cosmetic/grep-compliance, no behavior change)
**Impact on plan:** All three necessary to get the plan's own automated verification green. No scope creep — no functionality was added or changed beyond what the plan specified.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `GuideOverlay.tsx` is fully self-contained and tested but NOT YET mounted in `App.tsx` — Plan 11-05 owns mounting it as an unconditional sibling of the `Dashboard()` CommandBar band, raising that band's z-index while the guide is open, and the manual verification checkpoint that re-checks the `pt-24` top-clearance estimate against the CommandBar band's real rendered height.
- The Header "Guide" button is wired to `useGuide` and toggles `open`/`toggleOpen` correctly, but until 11-05 mounts `GuideOverlay`, clicking it has no visible effect (`useGuide`'s state changes but nothing renders it) — this is expected, tracked, and does not block this plan's own success criteria.
- No blockers for 11-05.

---
*Phase: 11-full-site-guide-instructions-tab*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: frontend/src/components/GuideOverlay.tsx
- FOUND: frontend/src/components/GuideOverlay.test.tsx
- FOUND: .planning/phases/11-full-site-guide-instructions-tab/11-04-SUMMARY.md
- FOUND commit: 72f62d2 (test: RED)
- FOUND commit: 6cd8272 (feat: GREEN)
- FOUND commit: dbb8f51 (feat: Header Guide button)
- FOUND commit: 26e3fe1 (docs: SUMMARY.md)
