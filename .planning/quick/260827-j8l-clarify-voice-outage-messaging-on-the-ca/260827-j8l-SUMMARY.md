---
phase: quick-260827-j8l
plan: 01
subsystem: ui
tags: [react, zustand, vitest, copy, voice, accessibility]

# Dependency graph
requires:
  - phase: quick-260827-3j8
    provides: mic-armed styling + Cancel affordance on CommandBar (unrelated area of same file)
provides:
  - Honest, channel-accurate voice/text outage copy in AGENT_UNAVAILABLE_BANNER_COPY (copy.ts)
  - A non-doomed-retry OFFLINE_COPY shared in wording (independently declared) between CommandBar.tsx and useVoiceCommand.ts
  - CommandBar.tsx reactively reading useAgentStatus's unavailable flag to gate the placeholder
affects: [command-bar, agent-status-banner, voice-outage-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CommandBar now has a reactive useAgentStatus((s) => s.unavailable) subscription, mirroring AgentStatusBanner.tsx's established pattern, in addition to its pre-existing imperative .getState().reportOutcome() write path"

key-files:
  created: []
  modified:
    - frontend/src/lib/copy.ts
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/CommandBar.test.tsx
    - frontend/src/hooks/useVoiceCommand.ts

key-decisions:
  - "Squashed the plan's Task 1 and Task 2 code changes into the single commit Task 3 explicitly specified (`fix(command-bar): clarify voice-outage messaging, drop doomed-retry copy (impeccable P0)`), via git reset --soft, rather than leaving them as separate per-task commits — the plan's own Task 3 action block and verification (`git show --name-only --format='' HEAD` must be exactly 4 lines) require one commit containing all 4 files, which takes precedence over the generic per-task-commit default for this plan."

patterns-established: []

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-27
---

# Phase quick-260827-j8l: Clarify voice-outage messaging on the CardioStream dashboard Summary

**Rewrote both independently-declared OFFLINE_COPY constants (CommandBar.tsx and useVoiceCommand.ts) and AGENT_UNAVAILABLE_BANNER_COPY to name voice+text honestly and drop a doomed "Try: 'show my pulse'" retry invitation, and made CommandBar.tsx reactively read useAgentStatus's unavailable flag to swap the rotating vocabulary-teaching placeholder for a static "not available" string while the agent is down.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-27T21:00Z (approx, worktree base correction + reads)
- **Completed:** 2026-08-27T21:12:35Z
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 4

## Accomplishments
- `AGENT_UNAVAILABLE_BANNER_COPY` (copy.ts) now names voice AND text as the affected channels and no longer implies the buttons below are themselves a fix for Chris, the voice-only primary user
- `OFFLINE_COPY` in both CommandBar.tsx and useVoiceCommand.ts (independently declared, intentionally duplicated per existing architecture) rewritten to the identical new wording, dropping the doomed "Try: 'show my pulse'" retry invitation for a channel PRODUCT.md documents as permanently unreachable
- CommandBar.tsx gained its first reactive subscription to `useAgentStatus`'s `unavailable` boolean (previously write-only via `.getState().reportOutcome()`), branching the placeholder to a static "Voice and text commands aren't available" string while unavailable, with zero change to the rotating example behavior when available
- Test coverage added for both placeholder branches (previously untested) and the network-failure test updated to assert the new fixed copy with no lingering "Try:" example

## Task Commits

The plan's Task 3 explicitly directed staging all 4 files and creating a single commit with a specified message (superseding the generic atomic-per-task default). Work was implemented across all 3 tasks, then landed in one commit as instructed:

1. **Tasks 1-3: Rewrite both OFFLINE_COPY sites, branch the placeholder on unavailable, full-suite verify** - `e00638b` (fix)

_Note: Tasks 1 and 2 were initially committed separately (`047124d`, `1937392`) during execution, then squashed via `git reset --soft HEAD~2` + recommit into `e00638b` to match Task 3's explicit single-commit instruction and its verification check (`git show --name-only --format='' HEAD` must report exactly 4 files)._

**Plan metadata:** pending (orchestrator commits SUMMARY.md/STATE.md separately)

## Files Created/Modified
- `frontend/src/lib/copy.ts` - `AGENT_UNAVAILABLE_BANNER_COPY` rewritten to "Voice and text commands aren't working right now. Filters, charts, and uploads below still work by tap."
- `frontend/src/components/CommandBar.tsx` - `OFFLINE_COPY` rewritten to "Couldn't reach the assistant — use the filters and buttons below instead."; new `unavailable = useAgentStatus((s) => s.unavailable)` reactive selector; `placeholder` branched on `unavailable` (static string vs. existing rotating `Try: "..."` template)
- `frontend/src/components/CommandBar.test.tsx` - renamed/updated the VOICE-07 network-failure test to assert the new fixed copy and absence of any `Try:` text; added two new tests for the available/unavailable placeholder branches
- `frontend/src/hooks/useVoiceCommand.ts` - its own independently-declared `OFFLINE_COPY` constant rewritten to the exact same new text as CommandBar.tsx's, keeping the voice-path failure message as honest as the text-path one

## Decisions Made
- Squashed Task 1's and Task 2's commits into the single commit Task 3's action block explicitly specified, since the plan's own verification step required `git show --name-only --format='' HEAD` to report exactly 4 lines — the plan's explicit single-commit instruction for this quick fix takes precedence over the generic atomic-per-task-commit default.

## Deviations from Plan

None in code — the plan was executed exactly as written for all 4 file changes, copy wording, and test updates. The only process-level deviation was commit granularity (see Decisions Made above), which is a workflow adjustment, not a code deviation, and does not change any shipped behavior.

## Issues Encountered
- `frontend/node_modules` was absent in this fresh worktree (gitignored, as expected) — ran `npm ci` before any verification/test commands could run. This is routine worktree setup, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- No follow-on work required by this fix; the copy and placeholder branch are self-contained and fully tested.
- The billing-only production agent outage (PRODUCT.md, $0 API credits) remains a v2 item — this plan only makes the outage's UI messaging honest, it does not restore agent reachability.

---
*Phase: quick-260827-j8l*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 4 modified source files and this SUMMARY.md exist on disk; commit `e00638b` verified present in `git log --oneline --all`.
