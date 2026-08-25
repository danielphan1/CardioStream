---
phase: 10-spoken-replies-tts
plan: 05
subsystem: ui
tags: [react, zustand, tts, header, agent-fanout]

# Dependency graph
requires:
  - phase: 10-spoken-replies-tts (plan 10-01)
    provides: backend toggle_speech agent command schema (AppliedFilters.speechEnabled)
  - phase: 10-spoken-replies-tts (plan 10-02)
    provides: useSpeech zustand store (enabled, toggleEnabled, setEnabled)
provides:
  - Header.tsx Voice Replies click toggle (D-02, TTS-02), styled identically to the Theme toggle
  - applyAgentFilters speechEnabled fan-out branch routing server-composed deltas to useSpeech.setEnabled
affects: [10-06 (final phase-10 plan), 11-site-guide (documents this control), 12-visual-refresh]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header-right site-wide preference toggles (Theme, Voice Replies) share one exact markup contract: icon + text, aria-pressed, min-h-12, border-2 border-ink, bg-sky, never accent-filled"
    - "applyAgentFilters's != null present-value-delta branch style extended to a non-PulseField target (useSpeech) — proof the fan-out pattern generalizes beyond FilterBar's five highlighted groups"

key-files:
  created: []
  modified:
    - frontend/src/components/Header.tsx
    - frontend/src/lib/agent.ts
    - frontend/src/lib/agent.test.ts

key-decisions:
  - "Called the store action toggleEnabled (not toggle) per Plan 10-02's actual exported store contract — 10-UI-SPEC.md's illustrative snippet used a shorthand name that didn't match"
  - "speechEnabled branch in applyAgentFilters does NOT add to the touched/PulseField set — Voice Replies has no FilterBar-highlighted group, confirmed by RESEARCH"

patterns-established:
  - "Non-PulseField-mapped AppliedFilters keys are legal in applyAgentFilters — a field can update external store state without ever touching touched/PulseField"

requirements-completed: [TTS-02]

# Metrics
duration: 3min
completed: 2026-08-25
---

# Phase 10 Plan 05: Voice Replies Header Toggle + Agent Fan-out Summary

**Header click toggle for TTS mute/quiet (Volume2/VolumeX, aria-pressed) wired to the Plan 10-02 useSpeech store, plus a new applyAgentFilters branch routing server-composed speechEnabled deltas to the same store.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-25T12:49:xx-07:00
- **Completed:** 2026-08-25T12:51:14-07:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- Header now renders a fully functional "Voice Replies: On/Off" toggle immediately after the Theme toggle, byte-identical styling, reading/writing `useSpeech`
- `applyAgentFilters` gained a `speechEnabled != null` branch calling `useSpeech.getState().setEnabled(...)`, closing the loop for both the (currently inert, billing-gated) voice path and any future text-command path, without touching the FilterBar pulse mechanism
- New passing test locks in the "no PulseField for Voice Replies" contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Header.tsx — Voice Replies toggle button** - `5e6dad4` (feat)
2. **Task 2: lib/agent.ts speechEnabled fan-out branch (TDD)** - `c0c9b2a` (test, RED) → `cb4c41c` (feat, GREEN)

**Plan metadata:** committed by the orchestrator after wave merge (worktree execution — this agent does not write STATE.md/ROADMAP.md).

_TDD: Task 2 followed RED → GREEN. No REFACTOR commit needed — the GREEN implementation matched the existing `!= null` present-value-delta style used by every other field in the same function; nothing to clean up._

## Files Created/Modified
- `frontend/src/components/Header.tsx` - Added `Volume2`/`VolumeX` imports, `useSpeech` import, `speechEnabled`/`toggleSpeech` store reads, and the new toggle button (placed after Theme, before Upload/Add Record/Log out)
- `frontend/src/lib/agent.ts` - Added `useSpeech` import and a `speechEnabled != null` branch in `applyAgentFilters` that calls `useSpeech.getState().setEnabled(f.speechEnabled === "on")`, deliberately not touching `touched`
- `frontend/src/lib/agent.test.ts` - Added `useSpeech` import, a `useSpeech.setState(...)` reset in `beforeEach`, and a new test asserting the speechEnabled branch reaches the store with an empty returned `fields` array

## Decisions Made
- Used the store's actual `toggleEnabled` action name (plan explicitly called this out as a correction to 10-UI-SPEC.md's shorthand `toggle`)
- Confirmed via the plan's `<behavior>` block and RESEARCH note that Voice Replies deliberately has no `PulseField` — implemented with zero `touched.add(...)` calls in the new branch

## Deviations from Plan

None — plan executed exactly as written. `frontend/node_modules` was missing in this fresh worktree checkout (gitignored, not committed); ran `npm install` to enable `tsc`/`vitest` verification. This is routine worktree setup, not a code deviation, and no files were added to the repo (node_modules stays gitignored).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TTS-02's click-toggle requirement is fully satisfied: prominent (Header-right, icon+text, >=48px), persisted (via Plan 10-02's store), voice-reachable (via this plan's new fan-out branch, dormant only because the Claude API is billing-gated per project-wide limitation, not a Phase 10 gap)
- Plan 10-06 (final Phase 10 plan) can proceed; no blockers introduced here
- `AppliedFilters.speechEnabled` now has a real consumer on both the text-command and (once billing is enabled) voice-command paths — no remaining gap in the fan-out surface

---
*Phase: 10-spoken-replies-tts*
*Completed: 2026-08-25*
