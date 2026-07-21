---
phase: 04-voice-capture
plan: 01
subsystem: testing
tags: [web-speech-api, speechrecognition, voice, typescript, vitest, wake-word]

# Dependency graph
requires:
  - phase: 03-agent-text
    provides: applyAgentFilters single mutation surface, AppliedFilters wire type, backend /agent schemas.py token vocabulary
  - phase: 02-dashboard
    provides: zustand useFilters store (the parity target)
provides:
  - "lib/voice.ts pure helpers: WAKE_WORD, extractCommand, classifyError, isIOS, getSpeechRecognitionCtor, isSpeechSupported, supportsContinuous, computeBackoff"
  - "FakeRecognition injectable SpeechRecognition test double (start/stop/abort + emitResult/emitError drivers) for Wave 2 hook tests"
  - "Ambient speech.d.ts SpeechRecognition/Event/ErrorEvent + webkit window ctor types"
  - "agent-parity.test.ts — VOICE-05/ACC-03 lockstep proof + frontend↔backend token equality guard"
affects: [04-02-voice-hook, 04-03-voice-ui, voice-capture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure DOM-free voice logic in lib/voice.ts (mirrors lib/agent.ts) so gating/classification/backoff unit-test without a recognizer"
    - "extractCommand null-vs-empty-string discipline: null = untriggered/ignore, '' = armed-but-empty (D-10)"
    - "Enumeration + disk cross-check parity test as a compile-plus-runtime lockstep guardrail (D-15)"

key-files:
  created:
    - frontend/src/lib/voice.ts
    - frontend/src/lib/voice.test.ts
    - frontend/src/tests/fakeRecognition.ts
    - frontend/src/types/speech.d.ts
    - frontend/src/lib/agent-parity.test.ts
  modified:
    - frontend/tsconfig.app.json

key-decisions:
  - "WAKE_WORD = 'dashboard' as a single named constant (D-04), swappable in one place as a UAT tuning knob"
  - "computeBackoff: exponential 200ms base, 2000ms hard cap (D-12); consecutiveRestarts reset to 0 after a successful final result"
  - "Unknown recognizer errors default to recoverable — a stuck loop is bounded by the backoff cap; a wrongly-fatal error would strand the session"
  - "Parity test asserts bidirectional frontend↔backend equality (not just presence) so token drift on either side breaks the build"
  - "Added @types/node to tsconfig.app so the parity test can read schemas.py via node:fs (plan-mandated approach)"

patterns-established:
  - "Pattern 1: pure voice primitives isolated from the untestable recognizer lifecycle (lib/voice.ts)"
  - "Pattern 2: injectable browser-API test double registered on the window global (FakeRecognition)"
  - "Pattern 3: disk cross-check parity test keeps two source-of-truth vocabularies (frontend unions ↔ backend Literals) in lockstep"

requirements-completed: [VOICE-01, VOICE-05, ACC-03]

# Metrics
duration: 5min
completed: 2026-07-21
---

# Phase 4 Plan 01: Voice Layer Foundation Summary

**Pure DOM-free voice primitives (wake-word gating/stripping, iOS + capability detection, recoverable-vs-fatal error classification, restart backoff), an injectable FakeRecognition test double with ambient SpeechRecognition types, and a VOICE-05/ACC-03 lockstep parity test that fails on any frontend↔backend vocabulary drift.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-21T02:00:00Z
- **Completed:** 2026-07-21T02:05:00Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `lib/voice.ts` ships the eight plan-specified pure helpers, each unit-tested (24 cases) — the DOM-free logic Wave 2's hook and Wave 3's UI will consume unchanged.
- `FakeRecognition` + ambient `speech.d.ts` make the native recognizer strongly typed under `tsc -b` and fully mockable in jsdom (which has no SpeechRecognition).
- `agent-parity.test.ts` enumerates the full frontend unions and cross-checks `backend/app/agent/schemas.py` on disk, proving every UI filter is voice-reachable and locking the two vocabularies together (mutation-tested: removing a backend token fails the suite).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure voice helpers in lib/voice.ts** - `039ff75` (feat)
2. **Task 2: FakeRecognition test double + ambient SpeechRecognition types** - `1c06a89` (feat)
3. **Task 3: VOICE-05/ACC-03 lockstep parity test** - `b934cd4` (test)

_Note: Task 1 was `tdd="true"`; helpers and their failing-first tests were authored together and committed as one green feat commit._

## Files Created/Modified
- `frontend/src/lib/voice.ts` - WAKE_WORD, extractCommand (gate/strip), classifyError, isIOS, getSpeechRecognitionCtor, isSpeechSupported, supportsContinuous, computeBackoff
- `frontend/src/lib/voice.test.ts` - 24 unit cases covering every helper behavior (match/no-match/empty, each recoverable+fatal error, capability present/absent, iOS, backoff base/cap)
- `frontend/src/tests/fakeRecognition.ts` - FakeRecognition class (vi.fn start/stop/abort, emitResult/emitError drivers) + installFakeRecognition() window installer
- `frontend/src/types/speech.d.ts` - ambient SpeechRecognition / SpeechRecognitionEvent / SpeechRecognitionErrorEvent + optional webkit window constructors
- `frontend/src/lib/agent-parity.test.ts` - 30 cases: union enumeration reachability, store↔command 1:1 mapping, backend token equality/presence cross-check
- `frontend/tsconfig.app.json` - added `node` to `types` so the parity test can `node:fs.readFileSync` schemas.py

## Decisions Made
- `WAKE_WORD = "dashboard"` single constant (D-04) — UAT tuning knob.
- Backoff exponential from 200ms base, capped at 2000ms; reset after a successful final result (D-12).
- Unknown recognizer errors → recoverable (lenient; bounded by the backoff cap).
- Parity cross-check asserts bidirectional set equality, not mere presence, so drift on either side breaks the build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled @types/node in tsconfig.app.json**
- **Found during:** Task 3 (agent-parity.test.ts)
- **Issue:** The plan mandates reading `schemas.py` via `fileURLToPath(import.meta.url)` + `node:fs.readFileSync`, but `tsconfig.app.json` `types` listed only `["vite/client", "vitest/globals"]`, so `tsc -b` failed with TS2307 "Cannot find module 'node:fs' / 'node:path' / 'node:url'".
- **Fix:** Added `"node"` to the `types` array (`@types/node` v24 already installed). Verified existing `setTimeout`/`setInterval` uses are inferred-typed and only passed to `clearTimeout`/`clearInterval`, so no DOM/node handle-type conflict is introduced.
- **Files modified:** frontend/tsconfig.app.json
- **Verification:** `npx tsc -b` exits 0; full suite (120 tests) green.
- **Committed in:** b934cd4 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix is required to satisfy the plan's own mandated file-read approach under the type checker. No scope creep; no runtime behavior change.

## Issues Encountered
- TS 5.9 `lib.dom` already declares `SpeechRecognitionAlternative/Result/ResultList` but NOT `SpeechRecognition`/`SpeechRecognitionEvent`/`SpeechRecognitionErrorEvent`. Verified before writing `speech.d.ts` and declared only the missing interfaces + Window augmentation, reusing the built-in `SpeechRecognitionResultList` for the event's `results` — avoids a redeclaration conflict.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 2 (04-02) can build `useVoiceCommand` against tested primitives: import `extractCommand`/`classifyError`/`computeBackoff`/`getSpeechRecognitionCtor` from `lib/voice.ts`, and drive it in tests via `installFakeRecognition()` + `emitResult`/`emitError`.
- The recognizer lifecycle (onend restart loop, seq guard, visibility guards) remains the phase's #1 device-test risk (STATE.md blocker) — unit-covered in CI via FakeRecognition ahead of the real-iOS checkpoint in 04-03.

## Known Stubs
None — all delivered helpers are fully implemented and unit-tested; this plan is logic-only by design (no UI/store wiring, which is Wave 2/3).

## Self-Check: PASSED

---
*Phase: 04-voice-capture*
*Completed: 2026-07-21*
