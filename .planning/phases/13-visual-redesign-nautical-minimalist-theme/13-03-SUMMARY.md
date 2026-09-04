---
phase: 13-visual-redesign-nautical-minimalist-theme
plan: 03
subsystem: ui
tags: [react, tailwind, design-tokens, accessibility, header, guide-overlay]

# Dependency graph
requires:
  - phase: 13-01
    provides: Phase 13 "Slack Water"/"Night Watch" token layer in index.css (--color-deck/mist/depth/brass/brass-text/signal/hazard, --text-label/heading/display, --radius-xl)
  - phase: 13-02
    provides: Self-hosted Inter + Space Grotesk fonts consumed via the --font-sans/--font-display theme vars
provides:
  - Header.tsx fully re-skinned to Phase 13 tokens (site title, theme/voice-replies/guide toggles, LogoutConfirmDialog, view-toggle + log-out controls, wave-curve divider)
  - GuideOverlay.tsx fully re-skinned to Phase 13 tokens (backdrop, scrollable region, sticky Close bar, jump-nav, all 9 sections, "What Can I Say" category headings)
  - Closed the 48px accessibility-floor gap on Header's 4 previously sub-floor utility buttons (Upload, Add Record, Back to dashboard, Log out)
  - Removed stale "exempt from 48px" code comments (file-header + inline) now that the carve-out no longer exists in code
affects: [13-04, 13-05, 13-06, 13-07, 13-08, 13-09, 13-10, 13-11, 13-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token rename is a pure find/replace on var(--color-*) Tailwind arbitrary-value class strings — no structural JSX changes"
    - "Named type-scale tokens (text-label/text-heading) replace the old text-control/text-h1/text-h2 + font-bold combinations; standalone font-bold not co-located with a named token becomes font-semibold (Two-Weight Rule caps weight at 600)"

key-files:
  created: []
  modified:
    - frontend/src/components/Header.tsx
    - frontend/src/components/GuideOverlay.tsx

key-decisions:
  - "Acceptance criterion 'grep -ic exempt returns 0' conflicted with the plan's own literal rewrite text (which quoted the phrase \"exempt from 48px\" while describing its removal). Resolved by rephrasing the comment to preserve the same meaning (carve-out removed, unconditional floor now applies) without using the literal word \"exempt\" anywhere in the file, satisfying both the <done> criterion's intent and the strict grep check."

requirements-completed: [D-01, D-02, D-03, D-06, D-09]

# Metrics
duration: 6min
completed: 2026-09-04
---

# Phase 13 Plan 03: Header & GuideOverlay Re-skin Summary

**Re-skinned Header.tsx and GuideOverlay.tsx to the Phase 13 "Slack Water"/"Night Watch" token system and closed the last accessibility-floor gap PATTERNS.md flagged: 4 Header utility buttons that relied on a now-removed "exempt from 48px" carve-out.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-04T12:07:41-07:00
- **Completed:** 2026-09-04T12:13:25-07:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Header.tsx: zero Phase-12 token/type-scale names remain; all 7 header-right controls (theme, voice replies, guide, upload, add record, back-to-dashboard, log out) are now unconditionally >=48px via `min-h-12`, closing the gap on the 4 that previously used `py-2` only
- GuideOverlay.tsx: zero Phase-12 token/type-scale names and zero `font-bold` remain; existing focus-management/Escape/backdrop-click behavior verified unchanged (14/14 GuideOverlay tests pass)
- Both files' code comments now accurately describe current behavior — no lingering "exempt from 48px" language anywhere in the codebase
- Wave-curve divider (Header's most literal nautical motif element) carried forward re-skinned to `--color-mist`, not removed, per D-02/D-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-skin Header.tsx, close the 48px gap on 4 utility buttons, and remove stale "exempt from 48px" comments** - `56297c6` (feat)
2. **Task 2: Re-skin GuideOverlay.tsx** - `1e73ebf` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit)

## Files Created/Modified
- `frontend/src/components/Header.tsx` - Site header: sailboat mark + title, theme/voice-replies/guide toggles, LogoutConfirmDialog, caregiver view-toggle + log-out controls, wave-curve divider — all re-skinned to `--color-deck/mist/depth/brass/brass-text`; typography moved to `text-heading`/`text-label`; all 7 header-right controls now `min-h-12`
- `frontend/src/components/GuideOverlay.tsx` - Full-site guide overlay: backdrop, scrollable region, sticky Close bar, jump-nav chips, all 9 guide sections, "What Can I Say" category headings — re-skinned to `--color-deck/mist/depth`; typography moved to `text-heading`/`text-label`; example-quote paragraph moved from `font-bold` to `font-semibold` (Two-Weight Rule)

## Decisions Made
- Rephrased the file-header comment's description of the removed 48px carve-out to avoid the literal word "exempt" (while preserving its meaning: the carve-out is gone, the floor is now unconditional) — the plan's own suggested rewrite text used the word "exempt" in a historical/negating sense, which would have failed the plan's own `grep -ic "exempt" returns 0` acceptance criterion. See Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan self-contradiction] Task 1's literal rewrite text used the word "exempt" while its own acceptance criterion forbids any occurrence of "exempt"**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` block specifies an exact rewrite for Header.tsx's file-header comment that includes the phrase `Phase 13 (D-06) removed the prior "exempt from 48px" carve-out`. The same task's `<acceptance_criteria>` requires `grep -ic "exempt" frontend/src/components/Header.tsx` to return 0 — a literal substring check that the specified rewrite text itself would fail, regardless of the negating context ("removed... carve-out").
- **Fix:** Rewrote the comment to convey the identical meaning (carve-out removed, unconditional floor now applies to all header/utility controls) without using the word "exempt" anywhere in the file: "Phase 13 (D-06) removed the prior sub-floor carve-out for these controls — they carry the same unconditional >=48px floor and 3px focus ring as every other interactive control in the app."
- **Files modified:** `frontend/src/components/Header.tsx`
- **Verification:** `grep -ic "exempt" frontend/src/components/Header.tsx` returns 0 (confirmed); the `<done>` criterion's actual intent ("no comment describes an 'exempt from 48px' carve-out") is satisfied either way since the comment describes removal, not presence, of an exemption.
- **Committed in:** `56297c6` (part of Task 1 commit)

## Verification Results

- `cd frontend && npx tsc -b --noEmit` — clean, zero errors (Task 1 and Task 2 both re-verified after each edit)
- `cd frontend && npx vitest run src/components/GuideOverlay.test.tsx` — 14/14 passed (focus-management/Escape/backdrop-click behavior confirmed unchanged by the pure token/class rename)
- `cd frontend && npx vitest run` (full suite, beyond plan's explicit scope, run as a sanity check) — 379/379 passed across 32 test files
- `grep -c "color-ink\|color-sky\|color-foam\|color-accent\b\|color-accent-text" Header.tsx` → 0
- `grep -c "min-h-12" Header.tsx` → 9 (>= 7 required: 3 pre-existing toggle buttons + 4 newly-floored utility buttons + the LogoutConfirmDialog's 2 buttons)
- `grep -c "text-control\|text-h1\|text-h2\|text-\[20px\] font-bold" Header.tsx` → 0
- `grep -ic "exempt" Header.tsx` → 0
- `grep -c "color-foam\|color-ink\|color-sky" GuideOverlay.tsx` → 0
- `grep -c "text-control\|text-h1\|text-h2" GuideOverlay.tsx` → 0
- `grep -c "font-bold" GuideOverlay.tsx` → 0
- `grep -c "color-depth" Header.tsx` → 13 (must-have artifact marker satisfied)
- `grep -c "color-deck" GuideOverlay.tsx` → 3 (must-have artifact marker satisfied)

## Known Stubs

None — this plan only re-skins existing, fully-wired components; no new data sources or placeholder states introduced.

## Threat Flags

None — pure presentational/CSS-class and typography-class changes to two already-existing, already-accessibility-verified components, matching the plan's own threat model (no new trust boundaries, no new attack surface).

## Next Steps
- Remaining Phase 13 Wave 2 plans (13-04 through 13-10, executed in parallel sibling worktrees) continue the same token-rename mechanism across the rest of the component tree.
- Orchestrator merges this worktree and updates STATE.md/ROADMAP.md after all Wave 2 agents complete.

## Self-Check: PASSED

- FOUND: frontend/src/components/Header.tsx
- FOUND: frontend/src/components/GuideOverlay.tsx
- FOUND: commit 56297c6 (Task 1)
- FOUND: commit 1e73ebf (Task 2)
