---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - backend/app/agent/prompt.py
  - backend/app/agent/schemas.py
  - backend/app/agent/service.py
  - backend/app/deps.py
  - backend/app/schemas.py
  - backend/tests/fixtures/agent_utterances.json
  - backend/tests/test_agent_fixtures.py
  - backend/tests/test_agent_route.py
  - backend/tests/test_agent_schemas.py
  - backend/tests/test_agent_service.py
  - backend/tests/test_api_readings.py
  - backend/tests/test_api_stats.py
  - backend/tests/test_time_of_day.py
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/components/ChartDeck.test.tsx
  - frontend/src/components/CommandBar.test.tsx
  - frontend/src/components/EmptyState.tsx
  - frontend/src/components/FilterBar.test.tsx
  - frontend/src/components/FilterBar.tsx
  - frontend/src/components/GuideOverlay.tsx
  - frontend/src/components/ShowPanel.test.tsx
  - frontend/src/hooks/useStats.ts
  - frontend/src/hooks/useVoiceCommand.test.ts
  - frontend/src/lib/agent-parity.test.ts
  - frontend/src/lib/agent.test.ts
  - frontend/src/lib/agent.ts
  - frontend/src/lib/dates.test.ts
  - frontend/src/lib/dates.ts
  - frontend/src/lib/palette.ts
  - frontend/src/lib/voiceCommands.test.ts
  - frontend/src/lib/voiceCommands.ts
  - frontend/src/store/filters.test.ts
  - frontend/src/store/filters.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-09-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Reviewed the Phase 15 unified filter surface (multi-select checkboxes, pulse
category) plus the surrounding agent vocabulary/schema files that were
touched or exercised by this phase. The multi-select checkbox mechanics
(`FilterBar.tsx`, `store/filters.ts`, `lib/dates.ts`, `lib/agent.ts`) are
solid: the "Stage 1 AND Stage 2" headline capability is implemented
correctly, the zero-or-all collapse convention is applied consistently
across `resolveFilters`, `composeConfirmation`, and `EmptyState`, the
v1→v2→v3 localStorage migration chain is defensive and well-guarded, and the
backend/frontend token unions are kept in lockstep by `agent-parity.test.ts`
reading the schema file directly off disk. No SQL/command injection,
hardcoded secrets, `eval`/`innerHTML` usage, or empty catch blocks were found
in the reviewed files.

Four real issues surfaced, none of which are crashes, data loss, or exploits
against this single-user/shared-password threat model, but two are worth
prioritizing: `GuideOverlay.tsx`'s static "Charts" and "Overlay" sections
describe the pre-Phase-14 UI (four charts, a "chart-picker card", separate
"overlay buttons") that no longer exists — this is the one place in the app
specifically designed to compensate for Chris's limited ability to explore
the UI by trial and error, so shipping it stale directly undercuts the
project's core accessibility value. The agent's system prompt also has an
unresolved token-ambiguity gap between BP-category "normal" and
pulse-category "normal" with no disambiguation rule. The other two are
smaller: a client-controlled/server-trust gap in how `ClarifyContext` is
replayed into the model's conversation, and a dead-code-style inconsistency
between two "is this delta present" checks in `lib/agent.ts`.

## Warnings

### WR-01: GuideOverlay's "Charts" and "Overlay" sections describe a UI that no longer exists

**File:** `frontend/src/components/GuideOverlay.tsx:308-323` (Charts) and `frontend/src/components/GuideOverlay.tsx:325-340` (Overlay)

**Issue:** The static copy in the "Charts" section reads:

> "Four charts are available: Blood Pressure Timeline, Pulse Trend, Blood
> Pressure Categories, and AM vs PM. The chart-picker cards switch which one
> is shown on the dashboard." … "By click: Tap a chart-picker card to switch
> to that chart."

This describes the pre-Phase-14 architecture. Per `schemas.py`'s own
docstring ("Phase 14 dropped bp_timeline/pulse_trend: the two vitals stopped
being charts and became independently toggleable datasets on one shared
timeline") and `ChartViewSwitcher.tsx` (only three buttons: Timeline, BP
Categories, AM vs PM — no "cards", no "Pulse Trend" chart, no
"chart-picker"), there is no "Pulse Trend" chart and no "chart-picker card"
anywhere in the current app. Blood pressure and pulse are now two of five
checkboxes in `ShowPanel`, not charts.

The "Overlay" section has the same problem: "The overlay buttons let you
show labs, incidents, and procedures plotted right on top of the Blood
Pressure or Pulse charts... Tap a Labs, Incidents, or Procedures button" —
this describes the deleted `OverlayToggle` component and omits that the
*same* panel now also toggles blood_pressure/pulse (per `ShowPanel.test.tsx`,
which asserts exactly 5 checkboxes: Blood Pressure, Pulse, Labs, Incidents,
Procedures).

Notably, the "What Can I Say" section further down in the *same file*
(`GuideOverlay.tsx:385-398`) is dynamically generated from
`VOICE_COMMAND_CATEGORIES` (`lib/voiceCommands.ts`) and correctly reflects
the current five-dataset/show-only vocabulary — so this guide is internally
self-contradictory: one section says "show my pulse" toggles a dataset;
an earlier section says pulse is a whole chart you switch to via a
chart-picker card.

Chris is a C4 quadriplegic user who depends on voice as the primary input
and cannot easily explore the UI by trial and error; per CLAUDE.md,
"Every feature must be operable by voice" and accessibility is
non-negotiable. The Guide is the feature specifically built to compensate
for his exploration limits, so shipping stale, self-contradictory
instructions here undermines the app's core value proposition more than the
same staleness would anywhere else in the app.

**Fix:** Rewrite the "Charts" and "Overlay" sections to match the current
model: three views via `ChartViewSwitcher` (Timeline / BP Categories / AM vs
PM), and one five-dataset `ShowPanel` (blood pressure, pulse, labs,
incidents, procedures) that toggles what's drawn on the Timeline. E.g.:

```tsx
<section id="charts" style={sectionScrollStyle}>
  <h2 className={h2Class}>Charts</h2>
  <p className={bodyClass}>
    Three views are available: the Timeline, Blood Pressure Categories, and
    AM vs PM. The view buttons switch which one is shown on the dashboard.
  </p>
  <p className={bodyClass}>
    <strong>By click:</strong> Tap a view button to switch to that view.
  </p>
  <p className={bodyClass}>
    <strong>By voice:</strong> Say a view's name, like "show categories" or
    "go back to the chart."
  </p>
</section>

<section id="overlay" style={sectionScrollStyle}>
  <h2 className={h2Class}>Show Panel</h2>
  <p className={bodyClass}>
    The Show checkboxes control what's plotted on the Timeline: blood
    pressure, pulse, labs, incidents, and procedures — pick any combination.
  </p>
  <p className={bodyClass}>
    <strong>By click:</strong> Tick or untick a Blood Pressure, Pulse, Labs,
    Incidents, or Procedures checkbox.
  </p>
  <p className={bodyClass}>
    <strong>By voice:</strong> Say something like "show my pulse", "only
    blood pressure and pulse", or "hide labs."
  </p>
</section>
```

---

### WR-02: `SYSTEM_PROMPT` gives no rule for the shared "normal" token between BP category and pulse category

**File:** `backend/app/agent/prompt.py:43-51`

**Issue:** Both category groups use the literal token `"normal"`:

```
Blood-pressure category filter tokens: hypotension, normal, elevated,
stage_1, stage_2, hypertensive_crisis.
...
Pulse category filter tokens: bradycardia, normal, tachycardia.
```

Every other token has at least one disambiguating example ("BP" for
blood_pressure, "heart rate"/"bpm" for pulse, "low pulse" for bradycardia),
but a bare instruction like "normal readings only" or "show normal" has no
textual signal pointing the model at `bp_category` vs. `pulse_category` vs.
both. `backend/tests/fixtures/agent_utterances.json`'s `cat_normal` entry
("normal readings only") asserts `bpCategory: ["Normal"]` only, but nothing
in `SYSTEM_PROMPT` tells the model to prefer BP over pulse (or to ask a
clarifying question) for this exact phrasing — the live eval
(`test_agent_fixtures.py`, gated behind `-m live`) is the only thing that
would catch a regression here, and it isn't part of the default CI run.

**Fix:** Add an explicit disambiguation rule, e.g.:

```
"Normal" alone is ambiguous between the two category groups. Default to
blood-pressure category (bp_category = ["normal"]) unless the utterance
names pulse/heart rate explicitly ("normal pulse", "normal heart rate" ->
pulse_category = ["normal"]). If truly ambiguous, use clarify.
```

---

### WR-03: `POST /agent`'s client-supplied `ClarifyContext.question` is trusted as a genuine prior model turn

**File:** `backend/app/agent/service.py:141-162` (`call_claude` → `build_messages`), `backend/app/agent/schemas.py:259-270` (`ClarifyContext`, `AgentRequest`)

**Issue:** `prompt.py`'s module docstring states the injection-hygiene
invariant plainly: "the worst a hostile transcript can do is flip a filter
... because all user text stays in `user` role messages." That's true for
the current utterance (`text`), but `AgentRequest.context: ClarifyContext |
None` is accepted directly from the client with no server-side session
binding, and `build_messages` replays `context.question` into the
**`assistant`** role verbatim:

```python
return [
    {"role": "user", "content": context.original_text},
    {"role": "assistant", "content": context.question},
    {"role": "user", "content": text},
]
```

Since there is no server-side store of "what did we actually ask last
turn" (by design — D-12 is explicitly one-turn, stateless, client-held
memory), any caller of `POST /agent` can fabricate an arbitrary
`context.question` (bounded to 500 chars) and have it injected as if it
were the model's own prior utterance. Some models weight `assistant`-role
history differently than `user`-role content in multi-turn steering, so
this is a stronger injection primitive than the "all hostile text stays in
`user` role" invariant the docstring claims to hold everywhere. The blast
radius is bounded here (structured-outputs constrained decoding still limits
the model to the closed `AgentOutput` vocabulary, and this is a single-user,
password-gated app), so this is not exploitable for RCE/data exfiltration —
but the stated isolation guarantee does not actually hold for this code
path, which is worth being honest about in the docstring and worth a
defense-in-depth check.

**Fix:** At minimum, correct the module docstring to scope the "all hostile
text stays in `user` role" claim to `text`, not `context`. As a
defense-in-depth improvement, consider one of:
- HMAC-sign `ClarifyContext` server-side when it's first issued (in the
  `clarify` reply) and verify the signature on the follow-up request,
  rejecting/ignoring an unsigned or tampered context instead of replaying it.
- Or explicitly document/accept the current risk as bounded given the
  closed-schema output and single-user threat model, rather than leaving the
  stronger docstring claim uncorrected.

---

### WR-04: `hasOtherCommand`'s `customRange` presence check disagrees with the check that actually applies it

**File:** `frontend/src/lib/agent.ts:94-105` vs. `frontend/src/lib/agent.ts:130-134`

**Issue:** The guide-auto-close gate uses a strict non-null check:

```ts
const hasOtherCommand =
  ...
  (f.customRange?.from != null && f.customRange?.to != null) ||
  ...
```

but the code that actually mutates the store three lines later uses a
truthy check:

```ts
if (f.customRange?.from && f.customRange?.to) {
  s.setCustomRange(f.customRange.from, f.customRange.to);
  ...
}
```

For any hypothetical `customRange` delta where `from`/`to` are empty strings
(`""`), `hasOtherCommand` would treat this as "a real command" (closing the
guide) while the mutation guard would silently skip applying the range —
i.e., the guide closes with nothing actually having changed. In practice the
backend's `CustomRange` is only ever constructed from `resolve_date_range`'s
non-empty ISO date strings, so this isn't reachable today, but the two
conditions should use the same predicate so a future change to either one
doesn't silently desync guide-close behavior from actual filter application.

**Fix:** Extract one predicate and reuse it in both places, e.g.:

```ts
const hasCustomRange = !!(f.customRange?.from && f.customRange?.to);
const hasOtherCommand =
  f.reset === true ||
  f.chartView != null ||
  f.datePreset != null ||
  hasCustomRange ||
  ...;
...
if (hasCustomRange) {
  s.setCustomRange(f.customRange!.from!, f.customRange!.to!);
  touched.add("dateRange");
}
```

## Info

### IN-01: BP Category / Pulse Category chip label markup duplicated instead of sharing a class constant

**File:** `frontend/src/components/FilterBar.tsx:193-218` and `:229-254`

**Issue:** The Time of Day group centralizes its label styling into a
`boxClass` constant (line 46-49, explicitly noted as reused verbatim from
`ShowPanel.tsx`). The BP Category and Pulse Category groups instead repeat
the identical inline className string twice:

```tsx
className="min-h-12 flex items-center gap-2 rounded-full px-4 text-label cursor-pointer"
```

once for the BP Category `<label>` (line 196-197) and again, character-for-
character, for the Pulse Category `<label>` (line 232-233). This is a small
DRY violation in a file that otherwise takes care to centralize shared
styling constants (`inactiveClass`, `activeClass`, `boxClass`,
`headingClass`).

**Fix:** Hoist a shared `chipClass` constant next to `boxClass` and reuse it
in both category groups:

```ts
const chipClass =
  "min-h-12 flex items-center gap-2 rounded-full px-4 text-label cursor-pointer";
```

---

_Reviewed: 2026-09-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
