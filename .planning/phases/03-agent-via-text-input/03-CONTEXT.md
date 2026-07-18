# Phase 3: Agent via Text Input - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Natural-language commands typed into the dashboard reliably control it — the full Claude pipeline (text → `/agent` endpoint → Pydantic-validated JSON command → filter store mutation → confirmation) works before voice adds complexity in Phase 4. Covers API-04, API-05, VOICE-06, VOICE-07, VOICE-08, VOICE-09, SEC-02. Voice capture, mic UI, and speech recognition are Phase 4; upload and auth-gate enforcement are Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Command box placement & feel
- **D-01:** Command bar under header — full-width bar between header and filter bar; the primary control gets top billing. Phase 4 adds mic button + live transcript to this same bar.
- **D-02:** Rotating example placeholder cycling real commands ("show my pulse", "last 30 days, mornings only"), ≥18px high-contrast — the box teaches its own vocabulary.
- **D-03:** During the Claude round-trip, submitted text stays visible with a clear "Working…" state (spinner + bar highlight); clears when applied. The same in-flight state serves voice in Phase 4.
- **D-04:** Submission via big ≥48px labeled Send button + Enter key.

### Confirmation display
- **D-05:** Confirmation appears in the command bar itself — the "Working…" state resolves into the confirmation text right where the command was entered. One place to look; Phase 4's transcript shares the spot.
- **D-06:** Confirmation persists until the next command — the bar always shows current dashboard state. No fade timers.
- **D-07:** Full state echo, not delta: "Showing blood pressure, last 30 days, mornings" — Chris never has to remember earlier commands to know what's applied (VOICE-06's own example format).
- **D-08:** Affected filter controls pulse briefly when the agent changes them (respecting `prefers-reduced-motion`) — reinforces that agent commands and manual controls are one system.

### Ambiguity & refusal behavior
- **D-09:** Confident-guess hybrid — apply the command when one reading is clearly most likely; ask a short clarifying question only when genuinely ambiguous. The full-state confirmation (D-07) makes wrong guesses instantly visible and cheap to correct.
- **D-10:** Medical interpretation requests ("is my blood pressure dangerous?") get a redirect that still does something useful: "I can't interpret readings, but here's your blood pressure" + switch to the relevant chart. Gentle, non-alarming, points to the care team (VOICE-09).
- **D-11:** Completely unintelligible input → friendly "didn't catch that" message in the command bar plus 2–3 example commands to try. Every failure teaches; never a raw error or 500 (VOICE-07).
- **D-12:** One-turn memory for clarifications — the original command + the clarification question are sent along with the follow-up answer, so "mornings" completes "show me the mornings one". Only one turn is remembered; no long-lived conversation state.

### Command vocabulary breadth
- **D-13:** Partial commands carry existing filters over — "show my pulse" switches the chart and keeps last-30-days/AM if active. Commands compose like the manual controls; "show all data" is the explicit reset (matches `showAllData()` in the filter store).
- **D-14:** Absolute commands only in v1 — no relative adjustments ("go back further", "zoom out"). Keeps the closed enums simple and the ~30-utterance fixture suite deterministic.
- **D-15:** Symbolic custom date ranges are in scope — "February through April", "since June" map to symbolic fields (month names / from-to) resolved server-side in local time per API-05. Claude never computes absolute dates. Parity with the existing DateRangePicker.
- **D-16:** Data questions ("what's my average BP?") are treated as dashboard commands: ensure the relevant view is showing and confirm "Your averages are in the stats bar below." No free-text data answers — everything stays inside the validated-command pipeline.

### Claude's Discretion
- Exact confidence heuristic for D-09's guess-vs-ask boundary (prompt design + fixture-suite tuning).
- Exact wording of confirmations, clarifications, and refusal messages — must stay non-technical, non-alarming, large-text friendly.
- Placeholder rotation content and timing (D-02).
- How the one-turn memory (D-12) is carried (client resends context vs. server-side) — planner decides; keep it stateless server-side if practical.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project ground rules
- `CLAUDE.md` — Stack versions and the agent pattern: `client.messages.parse(output_format=Model)` structured outputs on `claude-haiku-4-5`; refusal `stop_reason` handling; no numeric min/max in schema (validate in Pydantic after parse); API key backend-only (SEC-02).
- `.planning/PROJECT.md` — Core value, accessibility constraints (≥48px targets, ≥18px text, high contrast), out-of-scope list.
- `.planning/REQUIREMENTS.md` — API-04, API-05, VOICE-06–09, SEC-02 exact wording.
- `.planning/ROADMAP.md` — Phase 3 success criteria, including the ~30-utterance fixture suite (garbled transcripts included).

### Prior phase contracts
- `.planning/phases/02-read-api-dashboard/02-CONTEXT.md` — Phase 2 decisions this phase builds on (filter semantics, layout, motion).
- `frontend/src/store/filters.ts` — THE agent command schema: `activeChart`, `datePreset`, `customRange`, `amPm`, `bpCategory` + delta-style actions. The agent-response handler mutates exactly this shape; commands and UI filters stay in lockstep.
- `backend/app/main.py` — FastAPI app the `/agent` router joins.
- `backend/app/auth.py` — Bearer-token dependency designed in Phase 2; `/agent` must sit behind it (enforcement gate lands in Phase 5).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/store/filters.ts` — zustand store whose actions map 1:1 to commands; the agent handler calls these actions from outside the React tree (why zustand was chosen).
- `frontend/src/lib/dates.ts` `resolveFilters` — existing symbolic→concrete date resolution anchored to latest_reading; the server-side symbolic resolution (API-05) must agree with it.
- `frontend/src/components/FilterBar.tsx` — renders active filter states from the store; D-08's pulse highlight attaches here.
- `frontend/src/components/StatsStrip.tsx` — target of D-16's "averages are in the stats bar" redirect.
- ChartDeck keyed mount-fade (250ms, reduced-motion aware) — already fires on agent-driven chart switches for free.
- `backend/app/schemas.py` — Pydantic model conventions to follow for the command schema.

### Established Patterns
- All data fetching lives at App level; dashboard components stay presentational — the filter store is the sole mutation surface for the agent (Phase 2 decision, restated because it is load-bearing).
- Backend routers live in `backend/app/routers/`; `/agent` follows the same structure.
- Non-technical, friendly copy throughout (guided empty state precedent from 02-06).

### Integration Points
- New CommandBar component slots between `Header` and `FilterBar` in `App.tsx`.
- New `/agent` router: request {text, optional one-turn context} → Claude structured outputs → Pydantic command → response consumed by a frontend handler that calls filter-store actions.
- Anthropic SDK call lives backend-only; key via `pydantic-settings` env config (SEC-02).

</code_context>

<specifics>
## Specific Ideas

- Confirmation format follows the requirement's own example: "Showing blood pressure, last 30 days, mornings."
- Failure copy pattern: "Try: 'show my pulse' or 'last 30 days'" — examples in every didn't-understand response.
- Refusal pattern always pairs the boundary statement with a useful action (show the data), never a bare "I can't do that."

</specifics>

<deferred>
## Deferred Ideas

- Relative date-range adjustments ("go back further", "zoom out") — needs current-state-aware agent calls; revisit after real voice usage in Phase 4+.
- Conversational data Q&A with spoken values ("your average is 118 over 76") — free-text answers need their own accuracy testing; post-MVP alongside SpeechSynthesis replies.

</deferred>

---

*Phase: 03-agent-via-text-input*
*Context gathered: 2026-07-18*
