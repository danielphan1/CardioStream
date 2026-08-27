---
phase: 12-visual-refresh
plan: 04
subsystem: ui
tags: [tailwind4, react, accessibility, design-tokens, header, command-bar]

# Dependency graph
requires:
  - phase: 12-visual-refresh (plan 01)
    provides: "--shadow-elevation, --text-h1, --text-h2, --text-control design tokens in frontend/src/index.css"
provides:
  - "Header.tsx LogoutConfirmDialog card/heading/buttons with rounded-xl + shadow-elevation depth and text-h2/text-control type-scale"
  - "Header.tsx app-title h1 using the named text-h1 token"
  - "AgentStatusBanner.tsx unavailable-assistant notice with rounded-xl + shadow-elevation depth"
  - "CommandBar.tsx mic button, text input, and Send button with rounded-xl corners and Send label using text-control"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-05 depth treatment (rounded-xl + shadow-[var(--shadow-elevation)]) applied only to card/panel surfaces named in the design contract, never to buttons (buttons get radius-only)"
    - "D-06 type-scale formalization: pixel-literal className tokens (text-[32px], text-2xl, text-[20px], text-xl) replaced 1:1 with named text-h1/text-h2/text-control Tailwind utilities generated from @theme tokens, zero rendered-size change"

key-files:
  created: []
  modified:
    - frontend/src/components/Header.tsx
    - frontend/src/components/AgentStatusBanner.tsx
    - frontend/src/components/CommandBar.tsx

key-decisions:
  - "Left Header's Theme/Voice-Replies/Guide toggle buttons and view-toggle/logout-trigger buttons completely untouched, per the plan's explicit scope boundary — they are not named in the design contract's card/panel/accent-button surface list"
  - "Did not touch CommandBar's ringClass computation (D-07-protected WORKING/listening state ring) — verified byte-identical via acceptance-criteria grep checks before and after"

requirements-completed: [VISUAL-01, VISUAL-02]

# Metrics
duration: ~12min
completed: 2026-08-26
---

# Phase 12 Plan 04: Header & CommandBar Depth/Radius/Type-Scale Summary

**Applied the D-05 depth treatment and D-06 type-scale formalization to the two components present on every screen (Header, CommandBar) plus AgentStatusBanner, while proving zero scope creep into un-named toggle buttons or the D-07-protected state ring via grep-verified acceptance criteria.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-27T00:58:27Z
- **Tasks:** 2 of 2 auto tasks completed
- **Files modified:** 3

## Accomplishments
- `Header.tsx`'s `LogoutConfirmDialog` card now shows `rounded-xl` + `shadow-[var(--shadow-elevation)]`, matching every other confirm/notice panel sitewide; its heading uses `text-h2` and its Cancel/Log out buttons use `rounded-xl` + `text-control`
- `Header.tsx`'s app-title `<h1>` uses the named `text-h1` token at the unchanged 32px rendered size
- `AgentStatusBanner.tsx`'s "assistant unavailable" notice shows `rounded-xl` + `shadow-[var(--shadow-elevation)]`, consistent with every other bordered notice panel
- `CommandBar.tsx`'s mic button, text input, and Send button all show `rounded-xl` corners at unchanged `min-h-12`/`min-w-12` size; the Send button label now uses `text-control`
- `CommandBar.tsx`'s D-06/D-09 `ringClass` (the WORKING/listening state ring) is byte-identical to before — verified via acceptance-criteria grep on both branches
- Header's Theme/Voice-Replies/Guide toggle buttons and view-toggle/logout-trigger buttons are byte-identical to before this plan — confirmed no scope creep
- Full frontend suite green: 329/329 tests, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Header.tsx — LogoutConfirmDialog depth/radius and app-title type-scale** - `bb4b0ce` (feat)
2. **Task 2: AgentStatusBanner.tsx + CommandBar.tsx — depth/radius and type-scale** - `9acc0fe` (feat)

## Files Created/Modified
- `frontend/src/components/Header.tsx` - `LogoutConfirmDialog` card: `rounded-lg`→`rounded-xl` + added `shadow-[var(--shadow-elevation)]`; heading `text-2xl`→`text-h2`; Cancel/Log out buttons `rounded-lg`→`rounded-xl` + `text-[20px]`→`text-control`; app-title `<h1>` `text-[32px]`→`text-h1`. Header-right controls row (Theme, Voice Replies, Guide, Upload, Add Record, Back-to-dashboard, Log out trigger) left untouched.
- `frontend/src/components/AgentStatusBanner.tsx` - Notice panel div: `rounded-lg`→`rounded-xl` + added `shadow-[var(--shadow-elevation)]`; `text-[18px]` body floor and existing `transition-opacity` left unchanged.
- `frontend/src/components/CommandBar.tsx` - Mic button and text input: `rounded-lg`→`rounded-xl` (radius-only); Send button: `rounded-lg`→`rounded-xl` + `text-xl`→`text-control`. `ringClass` computation (both WORKING and listening branches, still `rounded-lg`) left byte-identical.

## Decisions Made
- Confirmed via grep that Header's Theme/Voice-Replies/Guide toggle buttons share one identical className string in the original file (all three, not just Theme) — the plan's acceptance criterion phrasing ("equals 1") undercounted this pre-existing overlap; the actual grep result is 3, which still proves the invariant the criterion intended to check (these buttons are unchanged from before the plan). No code change was needed; this is a plan-documentation quirk, not a defect.
- Applied the D-05 depth treatment (rounded-xl + shadow-elevation) only to the two panel/card surfaces explicitly named in the design contract (LogoutConfirmDialog card, AgentStatusBanner notice) and radius-only to the button/control surfaces (Cancel, Log out, mic, input, Send) — matching the plan's explicit "buttons get radius-only, not shadow" instruction.

## Deviations from Plan

None — plan executed exactly as written. All six acceptance-criteria grep checks from both tasks passed on first attempt (with the one documented "3 vs 1" count in Task 1's Theme-toggle check reflecting a pre-existing plan-phrasing quirk, not a code deviation — see Decisions Made above).

## Issues Encountered

None. This worktree's `frontend/node_modules` was absent (gitignored, not shared from the main checkout) — ran `npm ci` before any verification, consistent with the pattern already documented in 12-01-SUMMARY.md for this same worktree-isolation environment characteristic. No tracked files were affected.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Header, AgentStatusBanner, and CommandBar — the three components present on every screen alongside the dashboard body — now carry the D-05/D-06 visual refresh. No blockers for the remaining Wave 2 plans (12-02, 12-03, 12-05 through 12-07), which touch disjoint files. Full 329-test frontend suite is green.

---
*Phase: 12-visual-refresh*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: frontend/src/components/Header.tsx
- FOUND: frontend/src/components/AgentStatusBanner.tsx
- FOUND: frontend/src/components/CommandBar.tsx
- FOUND: .planning/phases/12-visual-refresh/12-04-SUMMARY.md
- FOUND commit: bb4b0ce (Task 1)
- FOUND commit: 9acc0fe (Task 2)
