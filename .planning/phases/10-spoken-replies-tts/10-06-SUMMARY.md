---
phase: 10-spoken-replies-tts
plan: 06
subsystem: testing
tags: [web-speech-api, tts, manual-verification, ios-safari, accessibility]

# Dependency graph
requires:
  - phase: 10-spoken-replies-tts
    provides: CommandBar TTS wiring (10-03), voice-path TTS + mic pause/resume (10-04), Voice Replies mute toggle (10-05)
provides:
  - Human sign-off that spoken replies work correctly on Chrome/Edge desktop, Safari desktop, and a real iOS Safari device
  - Real-device confirmation of the two highest-risk technical bets (RESEARCH A5/A6): empty-utterance gesture-unlock persistence, and proactive-cancel-on-backgrounding
  - Closes out TTS-01 through TTS-05 end to end
affects: [11-full-site-guide, 12-visual-refresh]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "TTS-03 and TTS-05 were left unchecked in REQUIREMENTS.md until this plan's human sign-off landed — code-level implementation (Plans 10-01 through 10-05) is necessary but not sufficient for requirements that explicitly demand real-device verification."

patterns-established: []

requirements-completed: [TTS-05]

# Metrics
duration: ~15min (checkpoint presentation + user verification + sign-off)
completed: 2026-08-25
---

# Phase 10: Spoken Replies (TTS) Summary — Plan 10-06

**Real-device manual verification signed off across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device — closes out TTS-01 through TTS-05.**

## Performance

- **Duration:** ~15 min (checkpoint presentation + user verification + sign-off)
- **Completed:** 2026-08-25
- **Tasks:** 1 (checkpoint:human-verify)
- **Files modified:** 1 (.planning/REQUIREMENTS.md)

## Accomplishments
- Confirmed spoken replies audibly play the correct confirmation text on all three required environments
- Confirmed iOS Safari's gesture-unlock (from the first tap/submit) persists for the rest of the page session — a second spoken reply plays with no additional tap (RESEARCH Assumption A5)
- Confirmed backgrounding the tab mid-utterance on iOS does not permanently break subsequent speech (RESEARCH Assumption A6, Pitfall 6)
- Confirmed the mic pauses during TTS playback and auto-resumes after, with no self-mishearing, on desktop and iOS
- Confirmed only the second of two rapid spoken replies is heard, with no audio overlap (TTS-03 real-device confirmation)
- Confirmed the Voice Replies mute toggle persists across a page reload (D-03 real-device confirmation)

## Task Commits

This was a verification-only task (no files_modified declared in the plan) — no code commits. Requirement status updates:

1. **Task 1: Real-device manual verification — TTS-05** - requirements correction committed pre-checkpoint (`677fdcd`, reverting a premature TTS-05 completion mark from Plan 10-04) and requirements completion committed post-checkpoint (this SUMMARY's accompanying commit).

## Files Created/Modified
- `.planning/REQUIREMENTS.md` - TTS-03 and TTS-05 marked complete (both `[x]` and traceability table) following human sign-off; TTS-01/02/04 were already complete from Plans 10-01/10-02/10-04/10-05

## Decisions Made
- Held TTS-03 and TTS-05 to `[ ]` (pending) in REQUIREMENTS.md until this plan's human checkpoint actually passed, even though both were code-complete after Plans 10-01–10-05 — matches 10-VALIDATION.md's explicit "manual only" classification for anything touching `window.speechSynthesis`, which has no jsdom implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Orchestrator-level] Reverted premature TTS-05 completion mark**
- **Found during:** Pre-checkpoint review, before presenting Wave 3 to the user
- **Issue:** Plan 10-04's executor marked TTS-05 `[x]` complete in REQUIREMENTS.md as part of its own docs commit, despite TTS-05's text explicitly requiring "verified on a real device" — work this plan (10-06), not 10-04, is responsible for.
- **Fix:** Reverted TTS-05 to `[ ]` / "Pending — requires 10-06 real-device sign-off" before presenting the checkpoint, then re-marked complete (along with TTS-03) only after the user's "approved" response.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Traceability table and checklist now both correctly reflect real-device sign-off as the gating event, matching TTS-03's parallel treatment.
- **Committed in:** `677fdcd` (pre-checkpoint correction)

---

**Total deviations:** 1 auto-fixed (orchestrator-level tracking correction, no code impact)
**Impact on plan:** No scope creep — corrects a requirements-tracking accuracy issue introduced by a sibling plan, consistent with 10-06's own stated purpose as the sole gate for real-device-verified requirements.

## Issues Encountered
None during the checkpoint itself — user confirmed all verification steps passed across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device on first pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 (Spoken Replies / TTS) is fully complete: TTS-01 through TTS-05 all verified, both at the code level (Plans 10-01–10-05, automated suites green) and now at the real-device level (this plan).
- No blockers carried forward from Phase 10 into Phase 11 (Full Site Guide) or Phase 12 (Visual Refresh).

---
*Phase: 10-spoken-replies-tts*
*Completed: 2026-08-25*
