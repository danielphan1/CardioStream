# Phase 4: Voice Capture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 4-voice-capture
**Areas discussed:** Command submission, State indicator, Live transcript, Silence & recovery

---

## Command Submission

### Submit model
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-submit on pause | Speak naturally; a pause sends the phrase | |
| Spoken trigger word | Prefix each command with a wake word marking the boundary | ✓ |
| Hybrid: pause + barge-in | Auto-submit, new utterance cancels in-flight | |

**User's choice:** Spoken trigger word.
**Notes:** Chosen for robustness against caregiver chatter / room noise in a shared home, accepting that Chris must say the word each time.

### Trigger word
| Option | Description | Selected |
|--------|-------------|----------|
| "Dashboard" | Single distinctive word | |
| Two-word phrase | e.g. "Hey chart" — lower false-trigger rate | |
| Let me decide later | Named constant, default "dashboard", tune on device | ✓ |

**User's choice:** Let me decide later — ship `WAKE_WORD = "dashboard"` as a single constant, finalize after real-device testing.

### Boundaries
| Option | Description | Selected |
|--------|-------------|----------|
| Trigger-gated, pause ends it | Only word-prefixed speech is a command; pause submits; room speech ignored | ✓ |
| Trigger opens a short window | Word opens a brief window; one command without repeating | |

**User's choice:** Trigger-gated, pause ends it. Every command needs the word; non-triggered speech does nothing.

### Concurrency
| Option | Description | Selected |
|--------|-------------|----------|
| Ignore until it resolves | Drop new commands while processing | |
| Queue in order | Hold and run after the first | |
| Newest wins | New command cancels the in-flight one | ✓ |

**User's choice:** Newest wins.
**Notes:** Good for self-corrections. Flagged for planner: needs a stale-response guard so a cancelled command can't apply late to the filter store.

---

## State Indicator

### Indicator form
| Option | Description | Selected |
|--------|-------------|----------|
| Whole command bar transforms | The bar itself changes color/border for state | ✓ |
| Big dedicated status banner | Separate loud status strip | |
| Large mic orb | Circular mic button conveys state via color/pulse | |

**User's choice:** Whole command bar transforms — one element does input + transcript + state + confirmation.

### State encoding
| Option | Description | Selected |
|--------|-------------|----------|
| Color + word + icon | Three independent cues per state | ✓ |
| Color + word | Color plus the state word, no icon | |

**User's choice:** Color + word + icon (🟢 pulse LISTENING / 🟠 spin WORKING / ⚪ mic TAP TO SPEAK) — never color-alone.

### Audio cue
| Option | Description | Selected |
|--------|-------------|----------|
| Chime on trigger + error tone | Sound where it aids eyes-free use | |
| Visual only | Bar carries all feedback, no sound | ✓ |
| Full audio cues | Chime + tick + error tone | |

**User's choice:** Visual only — quiet in a shared home.

---

## Live Transcript

### Transcript scope
| Option | Description | Selected |
|--------|-------------|----------|
| Only after trigger | Armed shows a hint; transcript streams only the captured command | ✓ |
| Everything heard | Stream all recognized speech continuously | |

**User's choice:** Only after trigger — armed state shows `LISTENING — say "dashboard…"`; transcript = only the captured command, trigger word stripped; confirmation replaces it in the same spot.

---

## Silence & Recovery

### Restart UX
| Option | Description | Selected |
|--------|-------------|----------|
| Invisible restart | Auto-restart under the hood, indicator stays LISTENING | ✓ |
| Brief 'reconnecting' blip | Momentary reconnecting state on each restart | |

**User's choice:** Invisible restart — session feels continuous.
**Notes:** Flagged for research: classify recoverable vs fatal errors and apply backoff to avoid restart thrash.

### Session end
| Option | Description | Selected |
|--------|-------------|----------|
| Explicit stop; fail → tap to resume | Runs until caregiver taps; hard fail → "Voice paused — tap to resume" + text box fallback | ✓ |
| Long inactivity timeout + explicit | Also auto-stops after ~10–15 min idle | |

**User's choice:** Explicit stop only, no timeout (Chris can't reliably re-tap); unrecoverable failure drops to the text box (VOICE-08).

---

## Claude's Discretion

- Exact mic-button placement/size (within ≥48px + accessibility limits).
- First-run mic-permission prompt copy/flow.
- Precise pause-duration threshold for end-of-command.
- Final trigger-word choice (default "dashboard", tune on device).

## Deferred Ideas

- Voice replies (SpeechSynthesis) — post-MVP, out of scope.
- Voice data entry — post-MVP, out of scope.
- Relative/stateful command adjustments ("zoom out") — carried from Phase 3.
- Audio cues — considered, declined for v1 (visual-only).
- Long inactivity timeout — considered, declined (explicit-stop-only).
