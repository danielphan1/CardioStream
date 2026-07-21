# Phase 4: Voice Capture - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the voice layer on top of the Phase 3 agent pipeline: mic capture (Web Speech API), a continuous-listening session opened by one caregiver tap, an unmissable listening/processing/stopped indicator, and a live transcript. Recognized speech is fed into the **existing** `/agent` pipeline unchanged (`postAgent` → `useAgent` → `applyAgentFilters` → `composeConfirmation`). Covers VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, ACC-03.

**In scope:** mic button + permission flow, continuous session lifecycle, trigger-word command gating, state indicator on the command bar, live transcript, Safari/iOS restart-on-`onend` loop, cross-browser (Chrome/Edge + Safari/iOS webkit) support.

**Out of scope (belongs elsewhere):** voice *replies* (SpeechSynthesis) — post-MVP; voice data entry ("log a reading") — post-MVP; any change to the agent command schema or backend `/agent` endpoint (Phase 3, reused as-is); relative/stateful command adjustments ("zoom out", "go back further") — deferred in Phase 3; auth gate + deployment (Phase 5).
</domain>

<decisions>
## Implementation Decisions

### Command Submission
- **D-01:** **Caregiver taps the mic once to open the session** (satisfies the Web Speech user-gesture requirement); Chris then issues many commands hands-free until the caregiver taps again to stop.
- **D-02:** **Trigger-word gated.** Only speech that begins with a trigger word is treated as a command. Room conversation / caregiver chatter without the word is ignored and never mutates the dashboard. This was chosen over auto-submit-on-pause specifically for robustness in a shared home with background speech.
- **D-03:** **A speech pause ends the command.** Everything from the trigger word to the next pause (recognizer final result) is the command; the trigger word itself is stripped before sending to `/agent`.
- **D-04:** **Trigger word is a single named constant** (`WAKE_WORD`, default `"dashboard"`), trivially changeable in one place. Final word choice is deferred to real-device testing — single-word false-trigger rate is a known unknown for research/UAT.
- **D-05:** **Newest command wins.** If a new triggered command arrives while one is still in its Claude round-trip, the in-flight one is cancelled and the newest is processed. **Requires a stale-response guard** so a cancelled command can never apply late to the filter store (the store is the single mutation surface — see [[03-CONTEXT]] D-13/carry-over).

### State Indicator (VOICE-03)
- **D-06:** **The whole command bar transforms** to signal state — one element is input + transcript + state + confirmation (extends Phase 3 D-01/D-05). No separate banner or orb; fewest places for Chris to look.
- **D-07:** **Three states encoded by color + word + icon/motion together** (never color alone — accessibility): 🟢 pulse **LISTENING** / 🟠 spinner **WORKING…** / ⚪ mic **TAP TO SPEAK**. Must be legible from across the room / a wheelchair.
- **D-08:** **Visual only — no audio cues.** Quiet in a shared home; the transforming bar carries all feedback.
- **D-09:** Pulse/spinner animations honor `prefers-reduced-motion` with a **static fallback** (solid ring / static icon), consistent with the Phase 2 motion convention.

### Live Transcript (VOICE-04)
- **D-10:** **Transcript shows only after the trigger fires.** While armed but untriggered, the bar shows a hint: `LISTENING — say "dashboard…"`. Once triggered, interim recognition streams live (the captured command only, word stripped), then the pause submits it.
- **D-11:** **Bar lifecycle:** armed hint → streaming interim transcript (green) → WORKING (amber, spinner) → confirmation text **replaces** the transcript in the same spot (Phase 3 D-05). One place, one thing at a time.

### Silence & Recovery (VOICE-01, SC5)
- **D-12:** **Invisible auto-restart.** On `onend` / recoverable errors (Safari silence auto-stop, `no-speech`), the recognizer restarts under the hood with the indicator staying on LISTENING — no flicker, session feels continuous. **Research must classify recoverable vs fatal errors and apply backoff** to avoid restart thrash (Chrome-Android beep, tight error loops).
- **D-13:** **Explicit stop only — no inactivity timeout.** The session runs until the caregiver taps mic to stop (Chris can't reliably re-tap, so an auto-timeout would strand him).
- **D-14:** **Hard-failure fallback:** on unrecoverable failure (mic permission revoked, offline, restart loop exhausted) the bar shows `⚪ Voice paused — tap to resume` and the **text input box stays fully usable** (VOICE-08 fallback from Phase 3).

### Command Coverage (VOICE-05 / ACC-03)
- **D-15:** **No new command vocabulary.** Voice feeds the exact same `/agent` structured-outputs schema built in Phase 3 (chart, date range/preset, AM/PM, BP category). The phase must include a **lockstep check** that every filter reachable in the manual UI is reachable by command — command schema and UI filters verified together, so no primary action is voice-unreachable.

### Claude's Discretion
- Exact mic-button placement/size within the command bar (subject to ≥48px + accessibility), first-run permission-prompt copy, and the precise pause-duration threshold for end-of-command — all implementation details for the planner, informed by research.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 4: Voice Capture" — goal, the 5 success criteria (incl. real-iOS restart-loop verification and the 10-min continuous-session test), requirements list.
- `.planning/REQUIREMENTS.md` — VOICE-01…VOICE-05, ACC-03 exact wording; VOICE-06…09 (already complete in Phase 3) for the reuse contract.

### Voice implementation guidance (project-level, load first)
- `./CLAUDE.md` §"2. Voice: react-speech-recognition wrapper + explicit Safari handling" — the fixed constraint (Web Speech API), `react-speech-recognition@4.0.1` lean, `browserSupportsContinuousListening` capability check, Safari `onend` restart pattern, Chrome-Android beep caveat, `regeneratorRuntime` troubleshooting, and the ~100-LOC raw-`webkitSpeechRecognition` custom-hook escape hatch. **This is the #1 device-test risk — MEDIUM confidence.**
- `./CLAUDE.md` §Constraints — accessibility non-negotiables (≥48px, ≥18px, high contrast, no hover/drag/precision) and Chrome/Edge + Safari/iOS compatibility requirement.

### Reuse contract (Phase 3 pipeline voice plugs into)
- `.planning/phases/03-agent-via-text-input/03-CONTEXT.md` — D-01 (mic + transcript attach to same bar), D-03/D-05 (in-flight + confirmation share the bar spot), D-13 (filter store carry-over semantics).
- `frontend/src/components/CommandBar.tsx` — the surface voice extends (state machine, `onApplied`, `latestReading` prop, aria-live confirmation).
- `frontend/src/hooks/useAgent.ts` + `frontend/src/api/client.ts` — `useAgent()` mutation over `postAgent`; voice calls the same mutation.
- `frontend/src/lib/agent.ts` — `applyAgentFilters` (store mutation, single surface) + `composeConfirmation` (VOICE-06 echo).
- `frontend/src/api/types.ts` — `AppliedFilters` / `AgentReply` shapes voice must produce/consume unchanged.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CommandBar.tsx`**: already a full idle/working/confirmed/clarify/error state machine with aria-live and rotating placeholder — voice adds a mic button + trigger/transcript states rather than a new component.
- **`useAgent()` + `postAgent`**: the entire text→command→apply→confirm path is done; voice supplies a transcript string to the same mutation (VOICE-08 by design).
- **`applyAgentFilters` / `composeConfirmation` (`lib/agent.ts`)**: store mutation + confirmation echo reused verbatim; no schema or backend change.
- **FilterBar D-08 pulse (`FilterBar.tsx`)**: existing `useAgentPulse` + `motion-safe:animate-pulse` pattern is the reduced-motion precedent for the indicator (D-09).

### Established Patterns
- **zustand filter store is the sole mutation surface** — voice must go through `applyAgentFilters`, never mutate charts directly. The D-05 "newest wins" cancellation must not violate this (stale replies must be dropped before `applyAgentFilters`).
- **Two-theme design tokens + `prefers-reduced-motion` honoring** (Phase 2) — the state indicator's colors and motion must use existing tokens and the motion-safe fallback.
- **Accessibility budget enforced project-wide** (≥48px targets, ≥18px text) — mic button and indicator inherit this.

### Integration Points
- New voice hook (wrapper or raw `webkitSpeechRecognition`) → produces a captured command string → existing `useAgent().mutate` → existing `onApplied`/confirmation path.
- `react-speech-recognition` is **not yet in `frontend/package.json`** — adding it (and possibly `regenerator-runtime`) is a phase task; the raw-hook escape hatch avoids the dep if the wrapper fights Safari.
- Mic button lives inside `CommandBar`, mounted in `App.tsx` between Header and dashboard content (Phase 3 D-01 placement).
</code_context>

<specifics>
## Specific Ideas

- Bar lifecycle the user endorsed, verbatim: `armed: 🟢 LISTENING — say "dashboard…"` → `trigger: 🟢 "show blood pressure last 30…"` → `pause: 🟠 WORKING…` → `done: "Showing blood pressure, last 30 days"`.
- Trigger-gated example the user endorsed: caregiver saying "…pick up milk later" is ignored; "dashboard, show pulse" (pause) is sent; "last 90 days" alone (no word) is ignored.
</specifics>

<deferred>
## Deferred Ideas

- **Voice replies (SpeechSynthesis)** — spoken confirmation of what changed. Out of scope per PROJECT.md (post-MVP; text confirmation suffices for v1).
- **Voice data entry** ("log a reading of 120 over 80") — out of scope per PROJECT.md (post-MVP; caregivers upload files).
- **Relative/stateful command adjustments** ("zoom out", "go back further") — carried from Phase 3 (needs current-state-aware agent calls); revisit after real voice usage.
- **Audio cues** (chime on trigger, error tone) — considered and declined for v1 (D-08, visual-only); could revisit if real-device testing shows Chris needs eyes-free confirmation.
- **Long inactivity timeout** — considered and declined (D-13, explicit-stop-only); revisit if battery/privacy of an always-hot mic becomes a concern.
</deferred>

---

*Phase: 4-voice-capture*
*Context gathered: 2026-07-20*
