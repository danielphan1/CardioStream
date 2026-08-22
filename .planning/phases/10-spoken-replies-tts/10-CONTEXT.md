# Phase 10: Spoken Replies (TTS) - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The dashboard speaks its confirmation aloud via Web SpeechSynthesis after a voice/agent command is applied, closing the hands-free loop so Chris doesn't need to look at the screen to know a command worked. Spoken replies are on by default with a prominent, persisted, voice-reachable mute/quiet toggle. Only one utterance plays at a time (cancel-and-replace). The live mic pauses while the dashboard is speaking and resumes right after. Works on Chrome/Edge and Safari/iOS, verified on a real device.

In scope: TTS playback wired to the existing `applied`-reply confirmation path only; a mute/quiet toggle (UI + voice); mic pause/resume around playback; iOS gesture-unlock and backgrounding handling.

Out of scope (locked by REQUIREMENTS.md, not re-discussed): TTS reading full data tables/long lists aloud (confirmation sentence only); TTS firing on manual click/keyboard filter changes (voice/agent-applied commands only); adjustable speech rate/voice picker (TTS-06, deferred to v2 unless caregiver feedback asks for it).

</domain>

<decisions>
## Implementation Decisions

### Mute/quiet toggle — reachability
- **D-01:** The mute/quiet toggle voice command is a new action added to the Claude agent's structured-output schema (`AgentOutput` union in `backend/app/agent/schemas.py`), mirroring Phase 9's `ToggleDataset` shape exactly: explicit on/off state (`Literal["on", "off"]`), never a flip/toggle. This keeps `lib/voice.ts`'s documented trust boundary intact ("the server /agent Pydantic structured-outputs validation stays the sole authority" on command intent) and matches the accepted Phase 9 precedent: click works today via the header button; the voice path works once the Anthropic account has billing/credits (same accepted limitation as every other voice command, tracked in PROJECT.md/STATE.md as a known v1.0→v2 blocker, not something Phase 10 needs to solve). Do NOT implement a local/client-side keyword shortcut that bypasses `/agent` — that would be the first command in the app to break the "server is sole authority" invariant.
- Exact voice phrasing ("mute the voice replies" / "turn voice replies back on" / synonyms) is Claude's (the LLM's) job via the system prompt, same as Phase 9's "add incidents"/"show labs" synonym handling — no fixed keyword list to lock here.

### Mute/quiet toggle — UI placement & persistence
- **D-02:** The toggle is a header-right button, in the same control zone as the existing theme toggle in `Header.tsx`, following its exact contract: icon + text label (never icon-only), `aria-pressed`, ≥48px target, inactive-control styling (bordered, not accent-fill).
- **D-03:** Persistence follows `store/theme.ts`'s pattern exactly: a new zustand store (e.g. `store/speech.ts`) with a `localStorage` key, guarded try/catch on both read and write so a blocked/unavailable localStorage degrades to session-only rather than breaking bootstrap. Single-user personal app — no server-side persistence needed.

### TTS + existing aria-live confirmation
- **D-04:** The existing `aria-live="polite"` confirmation region in `CommandBar.tsx` keeps firing unconditionally, regardless of the mute/quiet toggle. TTS is a strictly additive hands-free convenience layer on top of it, not a replacement — the mute toggle controls spoken audio only and must never suppress the visual/screen-reader-accessible confirmation text. Resolves the open product decision flagged in STATE.md Blockers ("does TTS coexist with aria-live").
- **D-05:** `CommandBar` gains a new visible "Speaking…" state (mirroring the existing "WORKING…" indicator's word + icon treatment, non-color-only) shown while an utterance is playing, so sighted users understand why the mic is paused. This is a new, distinct UI state — not a reuse of "WORKING…" (which means "waiting on the agent," a different wait than "currently talking").

### Barge-in / interrupt scope
- **D-06:** Manual clicks/keyboard filter changes never touch TTS playback — only a new `applied` voice/agent reply cancels-and-replaces an in-progress utterance (TTS-03, unchanged). A manual click mid-utterance lets the current speech finish; it does not silence it. One code path (the agent-reply handler) owns all speech start/cancel — the filter store is not a speech trigger source.

### Claude's Discretion
- Exact mute-toggle button label text/icon (e.g. "Voice replies: On"/"Off" vs "Mute"/"Unmute", speaker-icon choice) — cosmetic, mirrors the theme toggle's "Dark"/"Light" label pattern.
- Whether spoken text is exactly `composeConfirmation()`'s return value or the full visually-displayed message including any appended D-16 stats-bar-pointer text (`reply.message` when non-empty) — planning's call; TTS-01's parenthetical ties it to `composeConfirmation()` specifically.
- Exact mic pause/resume mechanics around `SpeechSynthesisUtterance` start/end events (new `VoiceState` value vs. reusing an existing one — "paused" is already taken by the D-14 fatal-error state, so it needs its own name) and the iOS gesture-unlock strategy (priming `speechSynthesis` inside the same caregiver tap that starts the mic, mirroring D-01's user-gesture requirement for the recognizer) — technical implementation, planner/researcher's job.
- Backgrounding/tab-hide behavior for in-progress speech (cancel vs. let finish) — mirror `useVoiceCommand`'s existing visibilitychange handling for consistency unless research surfaces an iOS-specific reason to diverge.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & product context
- `.planning/REQUIREMENTS.md` — TTS-01 through TTS-05 (locked requirements), TTS-06 (deferred voice/rate picker, v2), "TTS re-speaking on every store change" and "TTS reading full tables" both explicitly Out of Scope
- `.planning/PROJECT.md` — Core Value (voice-first), Constraints (accessibility floor, Chrome/Edge + Safari/iOS compatibility)
- `.planning/STATE.md` — Blockers/Concerns: "TTS vs. existing aria-live confirmation is an open product decision" (resolved by D-04 above) and the agent-inert-in-production blocker (context for D-01)

### Precedent to mirror
- `.planning/phases/09-multi-dataset-overlay-filtering/09-CONTEXT.md` — D-03/D-04 (explicit on/off voice-toggle grammar, single-valued schema field) — the direct precedent for D-01
- `backend/app/agent/schemas.py` — `ToggleDataset` (lines ~133-140) and its registration in the `AgentOutput` union (~144-151) — the exact shape a new mute/unmute action should follow
- `frontend/src/store/theme.ts` — persisted-toggle pattern (D-15) to mirror for D-02/D-03
- `frontend/src/components/Header.tsx` (~lines 152-170) — header-right toggle button placement/styling to mirror for D-02

### Integration surface (read before implementing)
- `frontend/src/components/CommandBar.tsx` — the `aria-live` confirmation region (D-04), the `Status`/state-machine pattern to extend for D-05's "Speaking…" state, `onApplied`/`onSuccess` (where spoken text would be triggered for the text-input path)
- `frontend/src/hooks/useVoiceCommand.ts` — the `VoiceState` union and `handleSuccess`'s `case "applied"` branch (where spoken text would be triggered for the voice path); note `"paused"` is already used for the D-14 fatal-error state, so a speaking-state needs a different name
- `frontend/src/lib/agent.ts` — `composeConfirmation()`, the exact text TTS-01 ties spoken output to
- `frontend/src/lib/voice.ts` — documented trust boundary ("the server /agent ... stays the sole authority") that D-01 explicitly preserves

No external specs/ADRs beyond the above — this project has no dedicated ADR directory; REQUIREMENTS.md and PROJECT.md are the canonical product docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `store/theme.ts` — direct template for a new `store/speech.ts` (persisted boolean, guarded localStorage read/write)
- `Header.tsx`'s theme toggle button — direct template for the mute toggle's markup/styling
- `backend/app/agent/schemas.py`'s `ToggleDataset` — direct template for the new mute/unmute agent action, including its registration in the `AgentOutput` union and the `DatasetToken`-style closed vocabulary pattern

### Established Patterns
- Two-path reply handling: `CommandBar.tsx`'s `onSuccess` (text-input path) and `useVoiceCommand.ts`'s `handleSuccess` (voice path) both independently handle `reply.kind === "applied"` and both call `composeConfirmation()` — a TTS trigger needs to be wired into BOTH, not just one (they are two separate implementations of the same switch statement, not shared code — the phase's discovery/planning should confirm whether to add a third shared helper or duplicate the trigger twice, matching the existing duplication style).
- Fixed friendly copy convention (VOICE-07): raw errors are never rendered/spoken; any TTS-related failure copy must follow the same fixed-copy discipline.
- Non-color-only state signaling (word + icon + color triad) — the new "Speaking…" state (D-05) must follow this, not add a color-only cue.

### Integration Points
- The `applied`-reply branches in both `CommandBar.onSuccess`/`onApplied` and `useVoiceCommand.handleSuccess` are the two call sites that need a `speak(text)` trigger.
- `useVoiceCommand`'s recognizer lifecycle (`start`/`stop`/`onend`/`scheduleRestart`) is where mic pause/resume around speech needs to hook in, without disarming the session (D-13's explicit-stop-only invariant must not be violated by a TTS-driven pause).

</code_context>

<specifics>
## Specific Ideas

No specific visual/audio references beyond "mirror the theme toggle and Phase 9's toggle_dataset pattern" (D-01/D-02/D-03) — the user confirmed the recommended, precedent-consistent option on every question asked.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (TTS-06 adjustable rate/voice picker was already deferred to v2 by REQUIREMENTS.md before this discussion; not re-raised here.)

</deferred>

---

*Phase: 10-Spoken Replies (TTS)*
*Context gathered: 2026-08-22*
