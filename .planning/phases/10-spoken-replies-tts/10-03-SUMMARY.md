---
phase: 10-spoken-replies-tts
plan: 03
subsystem: ui
tags: [react, zustand, web-speech-api, tts, accessibility, vitest]

# Dependency graph
requires:
  - phase: 10-spoken-replies-tts (Plan 10-02)
    provides: "useSpeech zustand store (speak/primeSpeech/isSpeaking/enabled), FakeUtterance/fakeSpeechSynthesis/installFakeSpeechSynthesis test double"
provides:
  - "CommandBar.tsx text-input path wired to speak() on applied replies only (TTS-01)"
  - "primeSpeech() called inside both real user-gesture handlers (onSubmit, onMicClick's start branch) for TTS-05 Pitfall 1 gesture-unlock"
  - "sessionOpen extended to include the new 'speaking' VoiceState sub-state (consumed once merged with Plan 10-04's VoiceState union change)"
  - "new 'Speaking…' indicator block (D-05), non-color-only, distinct from Working…"
  - "3 new CommandBar.test.tsx tests proving TTS-01 scope + Speaking… indicator toggle"
affects: [10-04-voice-path-tts-wiring, 10-06-real-device-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Speech trigger stays single-surface: only CommandBar.onApplied calls speak() from this file, mirroring the plan's D-06 threat-model invariant"
    - "primeSpeech() fired unconditionally at the top of every real user-gesture handler, before any early-return, so an accidental Enter-press or mic tap still unlocks iOS/Chrome synthesis"

key-files:
  created: []
  modified:
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/CommandBar.test.tsx

key-decisions:
  - "Imported only installFakeSpeechSynthesis + FakeUtterance from the test double (not fakeSpeechSynthesis) — the project's tsconfig.app.json has noUnusedLocals: true, and no test in this file asserts against fakeSpeechSynthesis directly; importing it unused would fail tsc even though vitest itself doesn't type-check"
  - "Implemented the plan's 'representative unclear reply' wording literally as ONE test (not an it.each over all four non-applied kinds) — matches the plan's explicit acceptance criteria of exactly 3 new tests"

requirements-completed: [TTS-01, TTS-03, TTS-05]

duration: 9min
completed: 2026-08-25
---

# Phase 10 Plan 03: CommandBar speak()/primeSpeech() wiring + Speaking… indicator Summary

**Text-input path of CommandBar now speaks the exact on-screen confirmation aloud on applied replies only, primes speechSynthesis on every real user gesture, and shows a non-color-only "Speaking…" indicator — all built against Plan 10-02's speech store with zero changes to the existing unconditional aria-live confirmation region.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-25T19:45:44Z (worktree base commit)
- **Completed:** 2026-08-25T19:54:49Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- `onApplied` calls `useSpeech.getState().speak(msg)` with the exact same `msg` string already set via `setMessage(msg)` — never a re-derivation, never fired for `clarify`/`refuse`/`unclear`/`unavailable` (TTS-01 scope).
- `onSubmit` and `onMicClick`'s session-opening branch both call `useSpeech.getState().primeSpeech()` as their first real side effect, covering both text-only and voice-first user-gesture paths (TTS-05, Pitfall 1).
- `sessionOpen` and the `lineText`/`lineGlyph` if/else chain both extended for the new `"speaking"` `VoiceState` sub-state (leaves that slot blank per 10-UI-SPEC.md — the new indicator is the sole visible signal).
- New `isSpeaking`-gated "Speaking…" block added as a third, independent sibling of the existing Working… indicator and the existing `aria-live` confirmation paragraph — neither of which was touched (D-04 unconditional-confirmation invariant verified unchanged by grep).
- 3 new tests in `CommandBar.test.tsx` lock TTS-01's applied-only scope (asserting on the LAST `FakeUtterance` instance, since `primeSpeech()` creates an earlier `" "` utterance first), the non-applied-kinds silence, and the Speaking… indicator's visibility toggle.

## Task Commits

Each task was committed atomically:

1. **Task 1: CommandBar.tsx — speak()/primeSpeech() wiring + Speaking… indicator** - `1f688d5` (feat)
2. **Task 2: Extend CommandBar.test.tsx for TTS-01/TTS-03 wiring** - `test(10-03): extend CommandBar.test.tsx for TTS-01 wiring` - `5eaa6ed` (test)

_Note: Task 1 was marked `tdd="true"` in the plan but its own `<action>`/`<verify>` block contained implementation only (verified via `tsc --noEmit`); the plan explicitly deferred all new test-writing to Task 2 (a plain `type="auto"` task) with its own file scope and its own `vitest` verify step. Followed the plan's literal task decomposition (implementation commit, then a separate test commit) rather than forcing a same-task RED→GREEN split the plan didn't provide — see "Deviations" below for the rationale this doesn't violate the plan-level TDD gate (this plan's frontmatter is `type: execute`, not `type: tdd`, so the plan-level RED/GREEN/REFACTOR gate sequence in the executor instructions does not apply)._

**Plan metadata:** commit pending (this SUMMARY + REQUIREMENTS.md), created in worktree isolation — the orchestrator merges and updates STATE.md/ROADMAP.md centrally after all wave-2 plans land.

## Files Created/Modified
- `frontend/src/components/CommandBar.tsx` - Added `Volume2` icon import and `useSpeech` store import; reads `isSpeaking`; `onApplied` calls `speak(msg)`; `onSubmit`/`onMicClick` call `primeSpeech()`; `sessionOpen` and the `lineText`/`lineGlyph` chain extended for `voiceState === "speaking"`; new "Speaking…" JSX block added between the Working… block and the confirmation paragraph.
- `frontend/src/components/CommandBar.test.tsx` - Added `installFakeSpeechSynthesis()` + `useSpeech.setState(...)` resets to the outer `beforeEach`; added 3 new tests covering TTS-01 scope and the Speaking… indicator toggle.

## Decisions Made
- Only imported `installFakeSpeechSynthesis` and `FakeUtterance` from the test double (dropped `fakeSpeechSynthesis` from the plan's suggested import list) — the project's `tsconfig.app.json` sets `noUnusedLocals: true`, and this file's new tests never assert against `fakeSpeechSynthesis` directly, only against `FakeUtterance.instances`. Importing it unused would have made the plan's own full-verification command (`tsc --noEmit && vitest run ...`) fail on an unused-import error. This is a minimal, test-file-scoped adjustment with zero behavioral impact — Rule 1 (auto-fix a would-be compile error), not a scope change.
- Implemented the "does not speak for non-applied kinds" test as the single "representative unclear reply" case the plan's `<action>` text literally describes, rather than an `it.each` sweep over all four kinds — matches the plan's own acceptance criteria (exactly 3 new tests, not 6).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/compile-error prevention] Dropped unused `fakeSpeechSynthesis` import from the test file's import list**
- **Found during:** Task 2 (extending CommandBar.test.tsx)
- **Issue:** The plan's `<action>` text lists `fakeSpeechSynthesis` among the symbols to import from `../tests/fakeSpeechSynthesis`, but none of the 3 new tests (nor any existing test) assert against it. With `noUnusedLocals: true` in `tsconfig.app.json`, an unused import would fail `npx tsc --noEmit` — part of this plan's own `<verification>` command.
- **Fix:** Imported only `installFakeSpeechSynthesis` and `FakeUtterance`, both of which are actively used (`installFakeSpeechSynthesis()` in `beforeEach`, `FakeUtterance.instances` in two of the three new tests).
- **Files modified:** frontend/src/components/CommandBar.test.tsx
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run src/components/CommandBar.test.tsx` — 21/21 tests pass.
- **Committed in:** `5eaa6ed` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/compile-error prevention)
**Impact on plan:** Zero behavioral impact — a strictly test-file import-list correction required for the plan's own verification command to pass under this project's existing (pre-Phase-10) `noUnusedLocals` tsconfig setting. No scope creep.

## Cross-Plan Note (parallel worktree isolation — not a deviation)

This plan runs in wave 2 alongside sibling Plan 10-04, which is the plan responsible for adding the new `"speaking"` member to `useVoiceCommand.ts`'s `VoiceState` union (currently `"off" | "listening" | "triggered" | "working" | "paused"` in this isolated worktree, pre-merge). This plan's Task 1 references `voiceState === "speaking"` (per its own explicit acceptance criteria) against that not-yet-extended union type. Verified this compiles cleanly in this worktree's actual `tsconfig.app.json` (which does **not** set `"strict": true`, so TypeScript's TS2367 "comparison has no overlap" check — confirmed via a throwaway `--strict` repro to isolate the cause — never fires here). `npx tsc --noEmit` passed with exit 0 both immediately after Task 1 and again after Task 2. Once the orchestrator merges this plan with Plan 10-04 (which adds `"speaking"` to the shared `VoiceState` type), the comparison becomes a real, meaningful literal-type match — no rework needed on this plan's side.

## Issues Encountered
- `frontend/node_modules` was absent in this fresh worktree checkout; ran `npm ci` (restoring the exact locked dependency set from the existing `package-lock.json`, not installing any new/different package) before any `tsc`/`vitest` verification could run. Not a Rule 3 package-install exclusion case — no new package name was introduced, only the existing lockfile's dependencies were materialized into `node_modules`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 10-03's text-input path is fully wired and tested in isolation. The sibling voice-path wiring (Plan 10-04, `useVoiceCommand.ts`) and the header mute toggle (Plan 10-05, `Header.tsx`/`agent.ts`) are separate wave-2 worktree plans; Plan 10-06 (wave 3, real-device manual verification) is the integration point after all three land and merge, and is where the cross-plan `VoiceState` union extension becomes visible end-to-end for the first time in one working tree.

---
*Phase: 10-spoken-replies-tts*
*Completed: 2026-08-25*

## Self-Check: PASSED

- FOUND: frontend/src/components/CommandBar.tsx
- FOUND: frontend/src/components/CommandBar.test.tsx
- FOUND: .planning/phases/10-spoken-replies-tts/10-03-SUMMARY.md
- FOUND: commit 1f688d5 (Task 1)
- FOUND: commit 5eaa6ed (Task 2)
