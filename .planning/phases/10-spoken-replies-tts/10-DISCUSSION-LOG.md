# Phase 10: Spoken Replies (TTS) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-22
**Phase:** 10-Spoken Replies (TTS)
**Areas discussed:** Mute-toggle reachability, TTS + accessibility coexistence, Barge-in scope

---

## Mute-toggle reachability

| Option | Description | Selected |
|--------|-------------|----------|
| Agent-schema action (like Phase 9) | New ToggleSpeech-style action added to the Claude agent schema, mirroring Phase 9's ToggleDataset (explicit on/off). Click works today via a header button; voice works once billing resumes — same accepted limitation as every other voice command. Keeps the "server is sole authority on intent" trust boundary intact. | ✓ |
| Local keyword shortcut | Mute/unmute recognized client-side in extractCommand, bypassing /agent entirely. Works by voice today even with the agent inert, but breaks the documented server-authority invariant. | |

**User's choice:** Agent-schema action (like Phase 9) — the recommended, precedent-consistent option.
**Notes:** None provided beyond selecting the recommendation.

---

## TTS + accessibility coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Additive, always-on aria-live + new "Speaking…" state | aria-live keeps firing unconditionally regardless of the mute toggle; CommandBar gets a new visible state mirroring WORKING… so sighted users see why the mic paused. | ✓ |
| Additive aria-live, reuse WORKING… for feedback | Same always-on aria-live behavior, but no new UI state — WORKING… covers the speaking window too. | |

**User's choice:** Additive, always-on aria-live + new "Speaking…" state — the recommended option.
**Notes:** None provided beyond selecting the recommendation.

---

## Barge-in scope

| Option | Description | Selected |
|--------|-------------|----------|
| Let it finish | Manual clicks never touch TTS playback — only a new applied voice/agent command can cancel-and-replace (TTS-03). | ✓ |
| Manual clicks also cancel it | Any manual filter change silences an in-progress utterance immediately. | |

**User's choice:** Let it finish.
**Notes:** None provided beyond selecting the option.

---

## Claude's Discretion

- Exact mute-toggle button label text/icon
- Whether spoken text is exactly `composeConfirmation()`'s return value vs. the full displayed message (including any D-16 stats-bar pointer text)
- Mic pause/resume mechanics around `SpeechSynthesisUtterance` events (new `VoiceState` value naming) and the iOS gesture-unlock priming strategy
- Backgrounding/tab-hide behavior for in-progress speech

## Deferred Ideas

None raised during this discussion. (TTS-06 adjustable rate/voice picker was already deferred to v2 by REQUIREMENTS.md prior to this session.)
