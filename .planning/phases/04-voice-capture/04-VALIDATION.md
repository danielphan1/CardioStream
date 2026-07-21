---
phase: 4
slug: voice-capture
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (jsdom, globals) + @testing-library/react |
| **Config file** | `frontend/vite.config.ts` (test env jsdom, globals true) |
| **Quick run command** | `cd frontend && npx vitest run <file>` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Type gate** | `cd frontend && npx tsc -b` |
| **Estimated runtime** | ~15 seconds (full frontend suite) |

*No new framework install — existing Vitest infrastructure (Phases 2–3) covers all phase requirements. The recommended path adds ZERO runtime packages (native `webkitSpeechRecognition`, no `react-speech-recognition`).*

---

## Sampling Rate

- **After every task commit:** Run the task's quick command (`npx vitest run <task file>`)
- **After every plan wave:** Run `cd frontend && npx vitest run` (full suite) + `npx tsc -b`
- **Before `/gsd-verify-work`:** Full suite green + `tsc -b` clean + the Wave 3 on-device checkpoint approved
- **Max feedback latency:** ~15 seconds (automated); the real-iOS checkpoint is one-time manual

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | VOICE-01, VOICE-05, ACC-03 | T-04-01 | Wake-word gate keeps room speech off the network; no transcript logging | unit | `cd frontend && npx vitest run src/lib/voice.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | VOICE-01 | T-04-SC | Native recognizer typed; zero new packages | type | `cd frontend && npx tsc -b` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 1 | VOICE-05, ACC-03 | T-04-01 | Every UI filter voice-reachable; FE↔BE vocabulary drift breaks build | unit | `cd frontend && npx vitest run src/lib/agent-parity.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | VOICE-01, VOICE-02 | T-04-01 / T-04-02 | Only extractCommand output crosses to /agent; newest-wins seq guard | unit | `cd frontend && npx vitest run src/hooks/useVoiceCommand.test.ts` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | VOICE-01 | T-04-03 / T-04-05 | Backoff caps restart storm; fatal→paused; visibility guard | unit | `cd frontend && npx vitest run src/hooks/useVoiceCommand.test.ts` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | VOICE-02, VOICE-03, VOICE-04 | T-04-04 / T-04-05 | Only fixed copy renders; LISTENING state unmissable; ≥48px target | unit | `cd frontend && npx vitest run src/components/CommandBar.test.tsx && npx tsc -b` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 3 | VOICE-01 | — | Device-test script authored (SC1/SC5) | file | `test -f .planning/phases/04-voice-capture/04-IOS-TEST-CHECKLIST.md && grep -Eqi '10[- ]?min' .planning/phases/04-voice-capture/04-IOS-TEST-CHECKLIST.md` | ⬜ | ⬜ pending |
| 04-03-03 | 03 | 3 | VOICE-01 | T-04-05 | Real-device restart loop + 10-min session; no covert listening after stop | manual | checkpoint:human-verify (04-IOS-TEST-CHECKLIST.md) | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None — existing Vitest infrastructure covers all phase requirements. Each task is TDD (`tdd="true"`): the test file is authored alongside its implementation within the same wave. The Wave 1 `FakeRecognition` harness (`frontend/src/tests/fakeRecognition.ts`) + ambient `speech.d.ts` are the injectable browser-API boundary that makes the otherwise-untestable recognizer lifecycle fully unit-testable in CI.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-iOS `onend`/`onerror` restart loop survives 60s silence without re-tap | VOICE-01 (SC1) | Safari/iOS silence auto-stop + programmatic restart is device-only; no CI/jsdom substitute (project's #1 documented risk) | 04-IOS-TEST-CHECKLIST.md step 2 — tap mic, command, 60s silence, command again applies without re-tap |
| 10-minute continuous session stays LISTENING with intermittent long silences | VOICE-01 (SC5) | Long-lived real-device session behavior cannot be simulated | 04-IOS-TEST-CHECKLIST.md step 3 |
| Cross-browser parity (desktop Chrome/Edge continuous=true path vs Safari/iOS restart path) | VOICE-01 | Requires real browsers/devices | 04-IOS-TEST-CHECKLIST.md step 6 |

*All CI-testable behaviors (gating, strip, submit, newest-wins, restart backoff, fatal→paused, indicator states, transcript, paused-fallback) have automated verification via FakeRecognition.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the single manual gap is routed to a blocking `checkpoint:human-verify`, 04-03 Task 3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the terminal on-device checkpoint is manual)
- [x] Wave 0 covers all MISSING references (no Wave 0 needed — existing infra + Wave 1 FakeRecognition)
- [x] No watch-mode flags (`vitest run` throughout, never `vitest`/`--watch`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-21
