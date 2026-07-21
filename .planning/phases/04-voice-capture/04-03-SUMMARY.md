---
phase: 04-voice-capture
plan: 03
subsystem: ui
tags: [web-speech-api, react, command-bar, voice-ui, accessibility, reduced-motion, ios-safari, vitest]

# Dependency graph
requires:
  - phase: 04-voice-capture
    provides: "useVoiceCommand hook — VoiceState union (off | listening | triggered | working | paused), stripped interim transcript, fixed friendly message, start()/stop(), singleton recognizer + restart loop"
  - phase: 04-voice-capture
    provides: "lib/voice.ts helpers + FakeRecognition test double + WAKE_WORD constant (04-01)"
  - phase: 02-dashboard
    provides: "existing CommandBar surface, FilterBar pulseClass motion-safe precedent, filter store render target"
provides:
  - "CommandBar voice layer: a ≥48px mic button (aria-label state swap Start/Stop voice control) mounted on the existing bar (D-06, one surface, no second component)"
  - "3-state indicator rendering color + word + icon together (LISTENING green ring / WORKING amber ring+spinner / paused MicOff) with a motion-safe:animate-pulse + static ring-2 reduced-motion fallback (D-07/D-09)"
  - "Live green stripped transcript streaming through the existing aria-live region, replaced in-place by the confirmation message (D-10/D-11)"
  - "Paused-state + unsupported-browser text fallback keeping the input + Send usable (D-14/VOICE-08)"
  - "04-IOS-TEST-CHECKLIST.md — executable real-device verification script (restart-loop spike, 10-min session, trigger-gating, hard-failure, cross-browser matrix), executed and APPROVED on-device 2026-07-21"
affects: [05-upload-auth-deploy, voice-capture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Voice UI is pure render of the VoiceState contract — the bar owns zero recognizer logic; all volatility stays in useVoiceCommand (Wave 2)"
    - "State signaling is always a color + word + icon triad (never color alone, D-07); glyphs are aria-hidden and the state word carries the accessible meaning through the existing aria-live region"
    - "Reduced-motion parity by copying the FilterBar pulseClass structure: motion-safe:animate-pulse with a static ring-2 fallback (D-09)"
    - "Only fixed friendly copy renders (paused peer constant beside RATE_LIMIT/OFFLINE); raw recognizer error strings never reach the DOM (VOICE-07)"

key-files:
  created:
    - .planning/phases/04-voice-capture/04-IOS-TEST-CHECKLIST.md
  modified:
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/CommandBar.test.tsx

key-decisions:
  - "Mic button rendered only when supported (Firefox → text-only fallback, VOICE-08); onClick calls start() synchronously in the tap handler to preserve the D-01 user gesture"
  - "LISTENING uses var(--cat-normal) green with motion-safe:animate-pulse + static ring-2; WORKING reuses the pre-existing var(--color-accent) ring+spinner — zero new tokens/colors/hex"
  - "Confirmation message replaces the interim transcript in the same single aria-live spot (D-11) rather than a second region"
  - "Text input + Send stay enabled whenever a voice session is not actively working, so the paused/unsupported fallback is genuinely usable (VOICE-08)"
  - "On-device checkpoint approved with device/OS/browser version strings left unrecorded rather than fabricated — the passing criteria (SC1 restart loop, SC5 10-min session, D-02 gating, D-14 fallback, Chrome/Edge core flow) are recorded instead"

patterns-established:
  - "Voice-on-existing-surface: extend a component in place to carry a voice affordance instead of adding a parallel component (D-06)"
  - "Color+word+icon triad for every distance-legible state indicator (accessibility non-negotiable)"

requirements-completed: [VOICE-01, VOICE-02, VOICE-03, VOICE-04]

# Metrics
duration: ~35min (spanned a blocking on-device human-verify checkpoint)
completed: 2026-07-21
---

# Phase 4 Plan 03: CommandBar Voice Layer + On-Device Verification Summary

**The hands-free voice experience mounted on the existing command bar — a ≥48px mic button, a color+word+icon three-state indicator (green LISTENING pulse / amber WORKING / MicOff paused) with a reduced-motion fallback, and a live green stripped transcript replaced in-place by the confirmation — with the real-iOS restart loop and a 10-minute continuous session verified and APPROVED on device.**

## Performance

- **Duration:** ~35 min wall clock (Tasks 1-2 executed, then paused at the Task 3 blocking checkpoint for real-device testing, then resumed to close out)
- **Completed:** 2026-07-21
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Extended `CommandBar.tsx` in place (D-06 — one surface, no second component) with a `≥48px` (`min-h-12 min-w-12`) mic button whose `aria-label` swaps between "Start voice control" and "Stop voice control", calling `useVoiceCommand.start()`/`stop()` synchronously in the tap handler (D-01 gesture). The button is rendered only when `supported`, so Firefox falls back to text-only (VOICE-08).
- Drove the bar's ring/word/transcript purely off the `VoiceState`: a green `var(--cat-normal)` LISTENING ring with `motion-safe:animate-pulse` + static `ring-2` fallback (copying the FilterBar `pulseClass` precedent, D-09), the pre-existing amber `var(--color-accent)` WORKING ring+spinner, and a `MicOff` paused glyph — every state pairs color + word + icon (D-07), no color-only signaling.
- Streamed the stripped interim transcript in green through the existing `aria-live="polite"` region, replaced in the same spot by the fixed confirmation `message` (D-10/D-11); added the D-14 paused copy (`Voice paused — tap to resume`) as a peer fixed constant so raw recognizer errors never render (VOICE-07). Text input + Send stay enabled outside the working state (VOICE-08).
- Authored `04-IOS-TEST-CHECKLIST.md` — a numbered, executable real-device script mapping ROADMAP SC1 (restart-loop spike after 60s silence) and SC5 (10-minute continuous session) plus trigger-gating, hard-failure fallback, and a Chrome/Edge + Safari/iOS cross-browser matrix, each with an explicit expected result and pass/fail marker.
- **On-device checkpoint APPROVED (2026-07-21):** the user ran the checklist on a real iPhone (Safari) + desktop Chrome/Edge and confirmed all required gates passed — restart-loop spike (SC1), 10-minute continuous session (SC5), wake-word trigger-gating (D-02), paused-state fallback (D-14), and the Chrome/Edge core flow. No failing steps; no `--gaps` plan needed.
- Full frontend suite green (139 tests) and `tsc -b` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend CommandBar with mic button, 3-state indicator, live transcript (TDD)** - `0fe8c6e` (test, RED) → `7bdc186` (feat, GREEN)
2. **Task 2: Author the real-device iOS + cross-browser manual test checklist** - `3b29a9e` (docs)
3. **Task 3: On-device human-verify checkpoint** - APPROVED on device 2026-07-21; result recorded in the checklist - `5493404` (docs). (No code change — checkpoint verifies real-device behavior CI cannot.)

**Plan metadata:** _(final tracking commit — STATE.md + ROADMAP.md)_

## Files Created/Modified
- `frontend/src/components/CommandBar.tsx` - Mic button (aria-label swap, ≥48px, supported-gated), voice `state`→ring/word mapping (green LISTENING pulse + static fallback, amber WORKING, MicOff paused), stripped green interim transcript + confirmation replacement through the existing aria-live region, D-14 paused fixed copy. Consumes `useVoiceCommand`; zero new colors/hex/fonts.
- `frontend/src/components/CommandBar.test.tsx` - Extended the existing suite (postAgent mock + renderBar + FakeRecognition install) with voice cases: mic aria-label state swap, wake-word gate (no confirmation on room speech), streamed stripped transcript, WORKING word, confirmation replacing the transcript, and paused state keeping the input enabled; asserts the state WORD is present per state (no color-only signaling).
- `.planning/phases/04-voice-capture/04-IOS-TEST-CHECKLIST.md` - Executable real-device verification script; now carries the APPROVED 2026-07-21 result.

## Decisions Made
- Mic button rendered only when `supported`; `start()` called synchronously in the tap handler to keep the D-01 user gesture valid.
- LISTENING = `var(--cat-normal)` green with `motion-safe:animate-pulse` + static `ring-2`; WORKING reuses the existing `var(--color-accent)` ring/spinner — zero new tokens.
- Confirmation message replaces the interim transcript in one aria-live spot (D-11), not a second region.
- On-device version strings intentionally left unrecorded rather than fabricated; the passing criteria are recorded instead.

## Deviations from Plan

None — plan executed exactly as written. Task 1 followed the `tdd="true"` RED→GREEN split (`0fe8c6e` test → `7bdc186` feat); Task 2 produced the checklist; Task 3's blocking human-verify checkpoint was executed on real hardware and approved, with no failing steps to route to a `--gaps` plan.

## Issues Encountered
None. The one required pause was the blocking `checkpoint:human-verify` (Task 3) awaiting a real iPhone — the phase's #1 documented device risk (STATE.md Phase 4 blocker) — which the user has now cleared with an on-device approval.

## TDD Gate Compliance
Task 1 (`tdd="true"`) landed the RED gate (`0fe8c6e` — `test(04-03)` failing voice cases) before the GREEN gate (`7bdc186` — `feat(04-03)` implementation). Full suite green (139) and `tsc -b` clean after GREEN. Gate sequence satisfied.

## User Setup Required
None - no external service configuration required.

## Threat Surface Notes
- T-04-04 (info disclosure): only fixed friendly copy renders (RATE_LIMIT/OFFLINE/D-14 paused); the transcript is display-only, raw recognizer/API error strings never reach the DOM (VOICE-07).
- T-04-05 (always-hot mic): the LISTENING state is unmissable (color+word+icon, D-07) and an explicit stop is always available (D-13); the on-device checkpoint confirmed no covert listening after stop.
No new security surface beyond the plan's `<threat_model>`.

## Known Stubs
None — the mic button, state indicator, and transcript are wired to the real `useVoiceCommand` contract and the live store. The paused/unsupported fallback routes through the existing text `/agent` path.

## Next Phase Readiness
- Phase 4 (voice-capture) is functionally complete: all three waves shipped and the real-iOS restart loop + 10-minute continuous session (SC1/SC5) — the phase's standing blocker — are verified on device. VOICE-01/02/03/04 satisfied.
- The STATE.md Phase 4 blocker ("iOS Safari voice behavior is MEDIUM confidence — test restart loop on a real iPhone") is now cleared by the approved on-device checkpoint.
- Phase 5 (Upload, Auth Gate & Deployment) can proceed; voice reuses the existing `/agent` pipeline unchanged, so no voice work blocks the auth/deploy phase.

## Self-Check: PASSED

---
*Phase: 04-voice-capture*
*Completed: 2026-07-21*
