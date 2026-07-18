# Phase 3: Agent via Text Input - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18 (resumed from 2026-07-17 checkpoint)
**Phase:** 03-agent-via-text-input
**Areas discussed:** Command box placement & feel, Confirmation display, Ambiguity & refusal behavior, Command vocabulary breadth

---

## Command box placement & feel *(from 2026-07-17 session)*

| Option | Description | Selected |
|--------|-------------|----------|
| Command bar under header | Full-width bar between header and filter bar; primary control gets top billing; Phase 4 adds mic + transcript here | ✓ |
| Floating bottom bar | Command input pinned to bottom of viewport | |
| Inside the filter bar | Input embedded alongside existing filter controls | |

**User's choice:** Command bar under header

| Option | Description | Selected |
|--------|-------------|----------|
| Rotating example placeholder | Cycles real commands, ≥18px high-contrast | ✓ |
| Static placeholder + example chips | Fixed hint text with tappable examples | |
| Minimal placeholder only | Plain "Type a command…" | |

**User's choice:** Rotating example placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| Text stays + working indicator | Submitted text visible with spinner + bar highlight, clears when applied — same state serves voice in Phase 4 | ✓ |
| Clear immediately, spinner in bar | Input empties on submit | |
| You decide | Claude's discretion | |

**User's choice:** Text stays + working indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Big Send button + Enter | ≥48px labeled button plus Enter key | ✓ |
| Enter key only | No visible button | |
| You decide | Claude's discretion | |

**User's choice:** Big Send button + Enter

---

## Confirmation display

| Option | Description | Selected |
|--------|-------------|----------|
| In the command bar | "Working…" state resolves into the confirmation right where the command was entered; one place to look; Phase 4 transcript shares the spot | ✓ |
| Banner between bar and charts | Dedicated full-width strip; more room but permanent vertical space | |
| Toast overlay on the charts | Prominent but transient, overlays content | |

**User's choice:** In the command bar (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Until the next command | Bar always shows current dashboard state; no timing to tune | ✓ |
| Fade after ~10 seconds | Returns to rotating placeholder; state echo disappears | |
| Fade to compact form | Full then shrinks to status line; more UI complexity | |

**User's choice:** Until the next command (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Full state echo | Always reads complete result ("Showing blood pressure, last 30 days, mornings") | ✓ |
| Delta only | Only names what changed | |
| Delta + full state | Change first, full state in smaller text | |

**User's choice:** Full state echo (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Brief highlight on changed controls | Affected chips/presets pulse briefly, reduced-motion aware | ✓ |
| Text only | Store re-render already updates active states | |
| Highlight + chart flourish | Lean on existing ChartDeck mount-fade | |

**User's choice:** Yes — brief highlight (recommended)

---

## Ambiguity & refusal behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Confident-guess hybrid | Apply when one reading clearly most likely; ask only when genuinely ambiguous | ✓ |
| Always ask when unsure | Any ambiguity produces a clarification question | |
| Always best-guess | Never asks; can compound misreadings on garbled voice input | |

**User's choice:** Confident-guess hybrid (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect + show the data | "I can't interpret readings, but here's your blood pressure" + switches to the relevant chart | ✓ |
| Plain refusal + doctor suggestion | Fixed message, dashboard unchanged | |
| You decide | Claude's discretion within non-alarming tone constraint | |

**User's choice:** Redirect + show the data (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| "Didn't catch that" + examples | Friendly message plus 2–3 example commands; every failure teaches | ✓ |
| Echo what was heard + retry prompt | Shows the transcript problem explicitly | |
| Simple retry message | Minimal, teaches nothing | |

**User's choice:** "Didn't catch that" + examples (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| One-turn memory | Original command + clarification sent with the follow-up so a fragment completes the request | ✓ |
| Stateless commands | Every submission stands alone; clarifications expensive | |
| Full conversation memory | Whole-session context; more tokens, harder to test | |

**User's choice:** One-turn memory (recommended)

---

## Command vocabulary breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Carry over | Commands compose like the manual controls; "show all data" is the explicit reset | ✓ |
| Named fields reset the rest | Each command starts from defaults | |
| You decide | Claude's discretion | |

**User's choice:** Carry over (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No — absolute commands only | Keeps closed enums simple, fixture suite deterministic | ✓ |
| Yes — simple step adjustments | Needs current-state awareness in every call | |
| You decide | Claude's discretion | |

**User's choice:** No — absolute commands only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — symbolic ranges | Month/date phrases as symbolic fields resolved server-side per API-05 | ✓ |
| Presets only in v1 | Natural month requests would be refused | |
| You decide | Claude's discretion | |

**User's choice:** Yes — symbolic ranges (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Point at the stats strip | Treat as dashboard command; confirm "Your averages are in the stats bar below" | ✓ |
| Answer with the number | Free-text data answers; accuracy-testing burden, VOICE-09 risk | |
| Defer entirely | Data questions get the didn't-understand response | |

**User's choice:** Point at the stats strip (recommended)

---

## Claude's Discretion

- Confidence heuristic for the guess-vs-ask boundary (prompt design + fixture tuning)
- Exact copy for confirmations, clarifications, and refusals (non-technical, non-alarming, large-text friendly)
- Placeholder rotation content and timing
- One-turn memory transport (client resends context vs. server-side)

## Deferred Ideas

- Relative date-range adjustments ("go back further", "zoom out") — revisit after real voice usage
- Conversational data Q&A with spoken values — post-MVP alongside SpeechSynthesis replies
