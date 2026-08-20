# Pitfalls Research: Spoken Replies, Multi-Dataset Overlay, Site Guide, Agent Liveness

**Domain:** Adding TTS voice output, multi-series/overlay charting, an in-app guide, and
service-liveness detection to an existing shipped, voice-first, accessibility-critical
health dashboard (Chris's Health Dashboard, milestone v1.1)
**Researched:** 2026-08-19
**Confidence:** MEDIUM-HIGH (grounded in direct inspection of the existing codebase +
verified against MDN, Chromium bug tracker, Recharts GitHub issues/wiki, and community
reports on react-speech-recognition; the codebase-specific integration claims are HIGH
confidence — they come from reading the actual source, not inference)

This research reads the shipped v1.0 code directly (`frontend/src/hooks/useVoiceCommand.ts`,
`frontend/src/lib/voice.ts`, `frontend/src/store/filters.ts`, `frontend/src/store/view.ts`,
`frontend/src/components/ChartDeck.tsx`, `frontend/src/components/charts/BPTimeline.tsx`,
`backend/app/agent/schemas.py`, `backend/app/agent/service.py`, `backend/app/main.py`,
`backend/app/routers/agent.py`) so every pitfall below is anchored to a real file/function,
not a generic warning.

---

## Critical Pitfalls

### Pitfall 1: The mic hears its own voice — TTS/STT feedback loop

**What goes wrong:**
`useVoiceCommand` (`frontend/src/hooks/useVoiceCommand.ts`) keeps a single long-lived
`SpeechRecognition` instance armed continuously — `state` returns to `"listening"`
immediately after every command resolves (`handleSuccess` → `setVoiceState("listening")`).
If spoken replies fire `speechSynthesis.speak()` at that same moment, the mic is live
*while the device's own speaker is playing the confirmation*. Without headphones (the
expected setup — Chris is hands-free, not wearing a headset), the recognizer will pick up
the TTS audio as room speech. Best case: wasted recognition cycles, spurious `no-speech`/
`network` errors that feed the existing `scheduleRestart()` backoff loop. Worse case on
iOS: several independent reports (Apple Developer Forums, WebKit speech-api issue tracker)
describe `SpeechRecognition` silently breaking or `onend` firing prematurely when another
audio session (video playback, and by extension `speechSynthesis`) starts while recognition
is active — the AVAudioSession conflict is a known WebKit weak spot, not just a feedback-loop
nuisance.

**Why it happens:**
Voice INPUT (recognition) and voice OUTPUT (synthesis) are independent Web APIs with no
built-in coordination. Nothing in the current `useVoiceCommand` hook anticipates a second
consumer of the audio pipeline — it was built as input-only (per its own header comment:
"the one genuinely novel, high-risk surface of Phase 4").

**How to avoid:**
Explicitly pause the recognizer before speaking and resume after, mirroring the pattern
multiple react-speech-recognition users converged on independently: call
`recRef.current?.abort()` (or a new `pause()` path that doesn't flip `armedRef` — mirror
the existing `visibilitychange` handler, which already does exactly this abort/resume
dance for backgrounding) immediately before `speechSynthesis.speak()`, then restart
inside `utterance.onend` **and** a hard fallback `setTimeout` (see Pitfall 3 — `onend` is
not guaranteed to fire, especially cross-browser/backgrounded). Treat "TTS speaking" as a
new state in the existing `VoiceState` union (e.g. add `"speaking"`) rather than
overloading `"working"`, so CommandBar's state machine and the `armedRef`/`scheduleRestart`
invariants stay legible. Never rely on browser echo-cancellation — the Web Speech API gives
no guarantee AEC applies to arbitrary page audio (it's tuned for WebRTC calls, not
`speechSynthesis` output).

**Warning signs:**
The confirmation "Showing blood pressure…" gets partially re-transcribed and, worse,
occasionally re-triggers the wake word ("dashboard") if guide-reading content or a future
longer confirmation happens to contain it — watch especially for this once the Full Site
Guide's "read aloud" feature is built, since a guide describing "the dashboard" will
contain the wake word repeatedly.

**Phase to address:** Spoken Replies (must be solved before or alongside first TTS call —
this is not deferrable polish, it directly breaks the existing continuous-listening
contract from v1.0).

---

### Pitfall 2: iOS Safari SpeechSynthesis needs its own gesture-unlock and voice-load handling

**What goes wrong:**
Two independent iOS/Safari `speechSynthesis` quirks, both well documented:
1. `speechSynthesis.getVoices()` returns an empty array on first call on Safari; voices
   load asynchronously and the `voiceschanged` event is unreliable on older Safari
   ("not available immediately, while onvoiceschanged is not available too" — multiple
   independent reports). Code that calls `getVoices()` once and picks `voices[0]` at
   import time silently gets no voice (default OS voice, or nothing).
2. iOS **cancels in-flight speech synthesis when Safari is backgrounded mid-utterance**
   (locking the device, switching apps, or — per Apple's WebKit audio-session rules —
   potentially just losing audio focus), and recovery is not guaranteed without a page
   reload. This is the TTS-output mirror of the STT-input auto-stop-on-silence problem
   the project already solved for `SpeechRecognition` in v1.0 — the same discipline
   (assume the platform can kill the session at any time, detect it, and recover
   gracefully) must be re-applied for the new TTS surface.

**Why it happens:**
iOS Safari's speech APIs are implemented on top of AVFoundation with strict audio-session
and user-activation rules that Chrome/Edge's implementation does not share; the existing
STT-side handling (`isIOS()`, `supportsContinuous()` in `frontend/src/lib/voice.ts`) proves
the team already knows this platform diverges — but that logic only covers recognition,
not synthesis.

**How to avoid:**
- Poll `getVoices()` with a short retry/interval AND listen for `voiceschanged`, don't
  rely on either alone (matches the "poll, don't just listen" workaround multiple sources
  converged on).
- Because the caregiver already performs a user gesture to tap the mic (D-01 in
  `useVoiceCommand`), reuse that same tap as the TTS unlock: fire one silent/empty
  `speechSynthesis.speak(new SpeechSynthesisUtterance(""))` inside the same click handler
  that starts recognition, so the synthesis engine is "warmed" before the first real
  confirmation needs to speak (mirrors the existing D-01 comment: "MUST run inside the
  caregiver tap").
- On `document.visibilitychange` → hidden, call `speechSynthesis.cancel()` proactively
  (don't let it hang) — extend the *existing* `onVisibility` handler in
  `useVoiceCommand.ts` (which already aborts the recognizer on hide) to also cancel any
  in-flight utterance, so both halves of the voice loop go quiet together and both resume
  together on foreground.
- Never assume `utterance.onend` will fire after a background/foreground cycle; treat a
  stuck "speaking" UI state as recoverable via the same visibility-driven reset.

**Warning signs:**
Works perfectly in Chrome desktop testing, then on a real iPhone (Chris's likely device
per PROJECT.md — "primary device is not yet decided," Safari/iOS is explicitly a target)
the first confirmation is silent, or later confirmations silently do nothing after the
screen has auto-locked once.

**Phase to address:** Spoken Replies. This is a real-device test risk on par with the
v1.0 "iOS Safari auto-stop restart loop" — budget explicit iPhone testing time here, not
just desktop Chrome.

---

### Pitfall 3: Long confirmations get truncated mid-sentence (Chrome's ~15s/~250-char SpeechSynthesis cutoff)

**What goes wrong:**
Desktop Chrome has a long-standing, still-reproducible bug (Chromium issues #679437 /
#41294170, multiple duplicate reports spanning years) where a single
`SpeechSynthesisUtterance` longer than roughly 200–250 characters or ~15 seconds of speech
gets cut off mid-sentence unless `speechSynthesis.resume()` is called periodically (every
~14s) while speaking. This directly threatens this project because the sentence that gets
spoken is `composeConfirmation()` (`frontend/src/lib/agent.ts`) — a template that is
*already* designed to grow: `"Showing {chart}, {range}{ampmSuffix}{categorySuffix}"`. Once
Multi-Dataset Overlay adds dataset-toggle clauses to that same sentence (e.g. "…Stage 2
readings only, with hospital stays and lab results overlaid"), it easily crosses the
cutoff threshold — a confirmation that reads fine as on-screen `aria-live` text will get
silently chopped when spoken aloud, and Chris — who depends on the spoken channel, not the
screen — never hears the second half.

**Why it happens:**
Two features shipping in the same milestone compound: Spoken Replies reads whatever
`composeConfirmation()` currently returns, and Multi-Dataset Overlay is the feature that
makes that string longer. Neither team building either feature in isolation would
necessarily notice the interaction.

**How to avoid:**
- Add a `speechSynthesis.resume()` heartbeat (`setInterval(() => speechSynthesis.resume(),
  14000)`, cleared on `onend`/`onerror`) as defense-in-depth regardless of length, since
  the bug is Chrome-version-dependent and easy to regress into.
- Prefer splitting a long confirmation into 2 short queued `SpeechSynthesisUtterance`
  objects at a natural clause boundary rather than one long string — queuing multiple
  utterances is the documented Chrome-safe workaround and also gives more natural pacing.
- When Multi-Dataset Overlay lands, **re-audit `composeConfirmation()`'s output length**
  with the worst-case combination (all 5 dataset types + a category filter + a custom
  range) — write a test asserting the spoken variant never exceeds a safe character budget,
  or design the spoken confirmation as a deliberately shorter summary than the on-screen
  text (e.g. "Showing 3 datasets over the last 30 days" instead of enumerating every
  toggle).

**Warning signs:**
Confirmation cuts off after "Showing blood pressure, last 30 days, mornings, Stage 2—"
with no error, no visual sign anything went wrong (the on-screen `aria-live` text is
complete; only the spoken audio is truncated), so this is easy to miss in manual testing
unless someone is specifically listening to long commands.

**Phase to address:** Spoken Replies (baseline defense), re-verify in Multi-Dataset
Filtering & Overlay (the phase that actually grows the sentence).

---

### Pitfall 4: Overlay data has no shared Y-axis — mixing BP (mmHg), pulse (bpm), and lab values on one chart is not "just add a Line"

**What goes wrong:**
`BPTimeline` (`frontend/src/components/charts/BPTimeline.tsx`) is built around a **fixed
clinical Y-domain `[40, 220]`** in mmHg with hand-placed `ReferenceArea` AHA category bands
— this is explicitly "never auto-fit" (D-05/DASH-06 in the file header). Lab results
(`lab_results` table: glucose, cholesterol, etc. — arbitrary units, arbitrary ranges) have
no meaningful position on a 40–220 mmHg axis; plotting a glucose value of "95" on that
scale renders it as a flat line pinned near the bottom, visually meaningless. Incidents
(`incidents` table — "passed out," "hospitalized") and procedures have **no Y-value at
all** — they are point-in-time events, not measurements. A naive overlay implementation
that just adds more `<Line>`/`<Scatter>` elements to the existing `LineChart` will produce
either an unreadable chart (wrong scale) or silently-wrong data (forcing a fake Y value).

**Why it happens:**
The existing 4-chart architecture was built for one dataset (BP/pulse readings, one shared
unit family) shown in one of four mutually-exclusive views (`ChartDeck`'s fixed
`CHART_REGISTRY` of exactly 4 `ChartId`s, one active "hero" at a time). Multi-Dataset
Overlay is architecturally a different shape: *simultaneous, heterogeneous* series on one
timeline, which the current single-Y-domain, single-purpose chart components were never
designed for.

**How to avoid:**
- Render labs on a **second Y-axis** (Recharts `<YAxis yAxisId="labs" orientation="right">`
  + matching `yAxisId` on the lab `<Line>`/`<Scatter>`), with its own auto-fit or
  per-test-type domain — never force lab values onto the mmHg axis.
- Render incidents/procedures as **discrete markers at a fixed, clearly-labeled visual
  lane** (e.g. a `<Scatter>` series pinned to a constant Y position just above the chart
  area, or `yAxisId="events"` with its own hidden axis), not as data points implying a
  measured value. Use shape/icon differentiation (hospital icon vs. procedure icon), not
  color alone — consistent with the project's existing "word + icon + color, never color
  alone" rule already used in `CommandBar.tsx`.
- Decide, per dataset type, up front: does this overlay as a *plotted series* (needs a
  scale) or as an *event marker* (needs only an X position)? Labs are the former,
  incidents/procedures are the latter. Get this decision into the phase's design step
  before touching Recharts — retrofitting a wrong choice is expensive.

**Warning signs:**
A demo screenshot where "overlay incidents" makes the BP timeline look like it now has a
mysterious flat line at y=0, or where toggling on labs silently does nothing because the
value doesn't fit the visible mmHg band.

**Phase to address:** Multi-Dataset Filtering & Overlay.

---

### Pitfall 5: `accessibilityLayer` keyboard navigation silently excludes annotation-style overlay markers

**What goes wrong:**
Recharts' `accessibilityLayer` (on by default in v3, and explicitly enabled on the hero
variant in `BPTimeline.tsx` via `accessibilityLayer={hero}`) gives arrow-key navigation and
screen-reader roles **only to actual data series** (`Line`, `Bar`, `Scatter`, `Area`).
`ReferenceLine`/`ReferenceDot`/`ReferenceArea` — the natural-looking Recharts primitives
for "mark this date as a hospital stay" — are decorative annotations, not part of the
keyboard-navigable item set. If incidents/procedures are implemented as `ReferenceLine`s
(a very likely first instinct, since `BPTimeline.tsx` already uses `ReferenceArea` for the
AHA bands), a sighted mouse user sees the hospital-stay marker on the chart, but a
keyboard/screen-reader user arrowing through the BP timeline **never encounters it at
all** — a silent accessibility regression for exactly the population this app exists to
serve. Separately, Recharts' own GitHub issue tracker documents that keyboard nav order
across multiple series follows *series-encounter (JSX) order*, not visual/X-axis order —
so even where markers ARE real series, arrowing through "all systolic points, then all
diastolic points, then all incident points" (rather than moving left-to-right through time
across all series) may read as confusing rather than clarifying once 3+ series are
overlaid.

**Why it happens:**
`ReferenceArea`/`ReferenceLine` are the tool already in use in this codebase for annotation
(the 6 AHA category bands), so reusing them for the new overlay markers is the path of
least resistance — but bands are explicitly documented in `BPTimeline.tsx` as "ambient
decorative tint, explicitly EXEMPT from the contrast floors" (i.e., already known to be a
non-interactive, sighted-only layer). Extending that same non-interactive pattern to
actual clinical event data (a hospitalization) crosses from "decorative" to "informational
content that must be accessible."

**How to avoid:**
- Render overlay event markers as a real `<Scatter>` (or `<Line>` with `dot`-only styling)
  data series bound into `accessibilityLayer`'s navigable set, not as `ReferenceDot`/
  `ReferenceLine`.
- Follow the precedent already established by `ReadingsTable.tsx`: the project already
  ships an accessible **tabular alternative** to the charts. Extend that same pattern to
  overlay data — every toggled-on dataset should also be reachable as a table/list, not
  only as a chart annotation, so screen-reader users have a first-class path to the same
  information sighted users get from the visual overlay (this also sidesteps the Recharts
  nav-order ambiguity entirely for anyone who prefers the table).
- If overlay markers are implemented as a real `Scatter` series, manually verify (don't
  assume) that arrow-key traversal reaches them in a sensible order once mixed with the
  existing `Line` series — test with 3+ series toggled on simultaneously, not just 1.

**Warning signs:**
Keyboard/VoiceOver testing of the overlay chart never announces "hospitalization, June
3rd" even though the marker is visibly plotted; this will not show up in a purely visual
QA pass.

**Phase to address:** Multi-Dataset Filtering & Overlay.

---

### Pitfall 6: The agent's command schema is closed and single-select — voice-driven multi-dataset toggling needs a real schema change, not a bolt-on

**What goes wrong:**
`backend/app/agent/schemas.py`'s `DashboardCommand` (the Claude-facing structured-output
schema) is deliberately closed and single-valued: one `chart: ChartToken | None`, one
`am_pm: Literal["all","am","pm"] | None`, one `bp_category: BPCategoryToken | None` — this
mirrors the frontend `useFilters` store (`frontend/src/store/filters.ts`), which is
explicitly documented as "each action maps 1:1 to a future voice command." Multi-Dataset
Overlay needs the opposite shape: an **independent multi-select** ("show BP and hospital
stays, hide labs") that doesn't fit a single `Literal` field. Two traps follow:
1. If a new field is added as e.g. `datasets: list[DatasetToken] | None`, this must be
   re-verified against the project's own documented structured-outputs constraints
   (`schemas.py`'s own comments: "Structured-outputs-SAFE ONLY — closed lowercase
   snake_case Literal tokens, no numeric ge/le bounds, no min-length" — list-typed fields
   with constrained item types are a different code path than the flat scalars every
   existing field uses, and this project has already hit and documented one
   structured-outputs footgun class (Pitfall 2/3 in the file's own comments about enum
   capitalization drift and numeric bounds) — don't assume list support is friction-free
   without testing it against the pinned `anthropic` SDK version.
2. `composeConfirmation()` (`frontend/src/lib/agent.ts`) assumes exactly one active chart
   phrase (`CHART_PHRASE[state.activeChart]`) — it has no vocabulary for "3 datasets are
   now overlaid." This function is reused verbatim by both `CommandBar.tsx` and
   `useVoiceCommand.ts` per the file's own "Wave 3... reuse UNCHANGED" comment — a
   half-migrated confirmation composer (that only reports chart/date/am-pm/category but
   silently drops which overlays are on) will make the *spoken* confirmation (Pitfall 3)
   actively misleading: Chris hears "Showing blood pressure, last 30 days" with no
   mention that hospital-stay markers are now also on screen.

**Why it happens:**
Both the store and the agent schema were deliberately designed around v1.0's actual
feature set (one chart, single-value filters) — this was the right call at the time, but
it means Multi-Dataset Overlay is not additive to the existing filter model, it's a
structural change to it.

**How to avoid:**
- Design the new agent action explicitly (e.g. a `toggle_dataset` action with a single
  `dataset: DatasetToken` + `on: bool`, issued once per voice command — "turn on hospital
  stays" — rather than trying to get Claude to emit an array in one shot) so it stays
  inside the same closed-Literal, single-value discipline every other field already
  follows, and so it maps 1:1 to how a person actually phrases an overlay command.
- Extend `AppliedFilters` and the zustand store with an explicit multi-select field (e.g.
  `activeDatasets: Set<DatasetId>` or a boolean per dataset) rather than overloading
  `activeChart`.
- Rewrite `composeConfirmation()` to append an overlay clause (and keep the Pitfall 3
  length budget in mind while doing it) — this function is a single point of truth
  reused by text, voice, and (new) spoken confirmations, so getting it right once here
  is high-leverage, but getting it wrong once is also reused everywhere.

**Warning signs:**
The agent correctly changes date range/category by voice but never toggles overlays
("show hospital stays" gets classified `unclear`) because the schema was extended but the
system prompt (`backend/app/agent/prompt.py`) and resolver weren't updated in lockstep;
or overlays toggle correctly but the spoken/typed confirmation never mentions them.

**Phase to address:** Multi-Dataset Filtering & Overlay (note: PROJECT.md scopes v1.1 to
**click/manual** toggling as the primary path with voice as a stretch — if voice control of
overlays slips to a later phase, that's a legitimate scope cut, but it must be an explicit
decision, not a silent gap, since "every feature must be operable by voice" is a
non-negotiable project constraint).

---

### Pitfall 7: A "Guide" tab built as a swapped top-level view silently kills the live voice session

**What goes wrong:**
`App.tsx` currently swaps between exactly two post-auth surfaces —
`Dashboard()` and `UploadView()` — via `useView` (`frontend/src/store/view.ts`), a plain
state flip that **fully unmounts one component tree and mounts the other**. The single
long-lived `SpeechRecognition` instance (`recRef` inside `useVoiceCommand`) is only
constructed and rendered inside `CommandBar`, which only exists inside `Dashboard()`. If
the Full Site Guide is implemented the same way — a third `useView` state that swaps the
whole screen — then navigating to the guide **tears down the recognizer entirely**
(component unmount → hook cleanup runs, per the existing `useEffect` cleanup in
`useVoiceCommand.ts` which already aborts the recognizer and clears timers on unmount).
This is exactly backwards for the stated goal: a guide meant to be reachable and readable
hands-free by voice would, by construction, end the voice session the moment it opens —
Chris would need someone to physically tap the mic again just to get back to a listening
state, defeating "every feature must be operable by voice" for the one feature whose whole
purpose is teaching voice usage.

**Why it happens:**
The `Dashboard`/`Upload` view-swap pattern is a reasonable, already-proven way to separate
the caregiver-only upload surface from the main dashboard (upload has no voice
requirement — it's explicitly a caregiver, mouse/keyboard-oriented flow). Copying that same
pattern for the Guide is the path of least resistance but imports an assumption ("this
view doesn't need live voice") that is true for Upload and false for Guide.

**How to avoid:**
- Do not add `"guide"` as a third `useView` state that swaps out `Dashboard`. Instead,
  render the guide as an overlay/panel/modal **within** the `Dashboard` tree (so
  `CommandBar` — and therefore the recognizer — stays mounted the whole time), or hoist
  `useVoiceCommand` above the view switch in `App.tsx` so the recognizer's lifetime is
  independent of which screen is showing.
- Explicitly design and test the interaction: what happens when the wake word is said
  while the guide is open — does "dashboard, show my pulse" close the guide AND apply the
  filter? Does the guide need its own voice vocabulary (e.g., "next", "close guide")
  layered on top of the existing wake-word grammar in `frontend/src/lib/voice.ts`
  (`extractCommand`)? This needs a decision, not a default.
- If the guide has a "read aloud" mode, apply the same pause-recognition-while-speaking
  discipline as Pitfall 1 — guide text is much longer than a filter confirmation, making
  the feedback-loop and cutoff (Pitfall 3) risks worse, not better.

**Warning signs:**
Manual test: tap mic, say "dashboard, open the guide," then say "dashboard, show my
pulse" without touching the screen — if the second command is silently ignored, the
recognizer died on the view swap.

**Phase to address:** Full Site Guide / Instructions Tab (the routing decision must be
made before any guide UI is built, not retrofitted).

---

### Pitfall 8: A "real" liveness check either burns paid API credits per check or gives the exact same false-positive the feature exists to fix

**What goes wrong:**
`backend/app/main.py`'s existing `/health` endpoint already reports `agent_configured`
— but this is a **key-presence check**, not a liveness check: it returns `True` whenever
`ANTHROPIC_API_KEY` is non-empty, regardless of whether calls actually succeed.
PROJECT.md documents the exact failure this causes today: with $0 API credits, every real
`/agent` call gets a 400-class `APIError`, which `call_claude()`
(`backend/app/agent/service.py`) catches and converts to `None` → `interpret()` then
returns the generic `UNCLEAR_MESSAGE` (**"didn't catch that"**), not the
`UNAVAILABLE_MESSAGE` that `interpret()` *does* correctly return when `_get_client() is
None` (no key at all). In other words: the code already distinguishes "not configured" from
"configured," but does **not** distinguish "configured and working" from "configured but
failing on every call" — which is precisely the gap this milestone's "Agent availability
made visible" feature is meant to close. A naive fix that just checks `agent_configured`
harder (or exposes it more prominently in the UI) will not fix anything, because
`agent_configured=True` is already true today, in the exact broken state PROJECT.md is
trying to surface honestly. A genuinely correct liveness check must actually attempt a
Claude call (or equivalent) and observe whether it succeeds — which costs money — creating
tension between "detect real failures" and "don't burn credits checking."

**Why it happens:**
"Is the key present" and "does the key work right now" are different questions that look
similar in code (`_get_client() is None` covers only the first), and the cheap check
(config presence) was sufficient for v1.0's dev/test-keyless-boot needs (explicitly the
point of the "Pitfall 9" comment in `service.py`) — but is not sufficient for v1.1's
user-facing honesty goal.

**How to avoid:**
- Distinguish the check from the feature it's protecting: don't make the liveness probe
  hit `/agent` itself (that endpoint is rate-limited at `20/minute` per IP via the shared
  `slowapi` `Limiter` in `backend/app/routers/agent.py` — a poll that shares that budget
  with real user commands will produce false 429s on real commands, or the poll itself
  gets false-429'd and misreports "down"). Give the liveness probe its own route and,
  if it needs a limiter at all, its own separate budget.
- Cache the result server-side with a TTL (e.g. re-verify at most once every few minutes,
  not once per page load or per command) so the cost is bounded and predictable regardless
  of how many browser tabs/sessions poll it.
- Prefer the cheapest signal that actually distinguishes "will fail" from "will work":
  Anthropic does not expose a free credit-balance endpoint (confirmed — no public
  `GET .../balance`), so the only reliable "is this call going to work" signal is a real
  API call. Minimize its cost: the smallest possible `max_tokens` completion, or (if
  acceptable) a `models.list()`-style metadata call if the SDK exposes one cheaply — but
  verify against the pinned `anthropic` SDK version rather than assuming, since API
  surface for "free" endpoints is not guaranteed stable and training-data claims here
  should be treated as LOW confidence until checked against the current SDK docs at
  implementation time.
- Make the UI state genuinely distinct from "unclear" (a person said something the agent
  didn't understand) vs. "unavailable" (the agent itself is down) — reuse the wording split
  that already exists in `copy.py` (`UNAVAILABLE_MESSAGE` vs `UNCLEAR_MESSAGE`) but make
  sure the **liveness check**, not just an individual failed call, is what flips the UI
  into the unavailable state, so a single transient network blip doesn't flash "assistant
  unavailable" when the very next call would have worked.
- Race condition to guard explicitly: a background liveness poll firing at the same moment
  a real voice/text command is in flight (`useAgent().mutate` in
  `frontend/src/hooks/useAgent.ts`) must not stomp on or delay that command's own
  success/error handling — keep the liveness signal in its own store/query, read
  passively by the UI, never gating or blocking the command mutation itself.

**Warning signs:**
The new "assistant unavailable" banner never appears even with $0 credits (because it's
still just checking key-presence); or it appears correctly but real commands start getting
429'd shortly after deploy (because the liveness poll and real commands are competing for
the same rate-limit bucket); or the Anthropic bill has a new small recurring line item from
liveness pings with no TTL/caching.

**Phase to address:** Agent Availability Made Visible.

---

### Pitfall 9: Multi-select toggle UI multiplies taps and breaks the single readable-sentence state pattern for the population that can least afford it

**What goes wrong:**
Every existing filter control in `FilterBar.tsx` (date presets, AM/PM, BP category) is
**single-select**: exactly one option is ever active per group, which is why the filter
state can always be summarized as one readable sentence (`sentence` in `FilterBar.tsx`,
`composeConfirmation()` in `agent.ts`) and why the agent schema can use flat `Literal`
fields (Pitfall 6). Multi-Dataset Overlay is explicitly **multi-select** — up to 5
independent toggles (BP, pulse, labs, incidents, procedures) that can be on/off in any
combination. For Chris specifically (limited/no hand mobility, voice-primary, but
mouse/keyboard is the documented fallback for caregivers), a naive 5-independent-toggle row
means: (a) reaching any given ON/OFF combination by click/switch takes up to 5 discrete
activations instead of 1, directly increasing physical fatigue for exactly the access
method the project treats as fallback but must still support; (b) with no "select
all"/"clear all" bulk action, returning to a known-good state (e.g. "just show BP again")
requires manually reasoning about which of 5 toggles are currently on; (c) 5 buttons at the
required ≥48px target size, in a `flex flex-wrap` row like the existing filter groups, will
wrap awkwardly on narrow viewports if not designed for — cramming them tighter to avoid
wrapping is a direct regression of the ≥48px constraint.

**Why it happens:**
The existing single-select `aria-pressed` toggle-button pattern (`inactiveClass`/
`activeClass` in `FilterBar.tsx`) is proven, accessible, and the obvious template to copy
— `aria-pressed` toggle buttons are in fact the *correct* ARIA pattern for multi-select too
(no need to switch to checkbox roles), but copying the *visual/interaction* pattern without
also adding the bulk-action and sentence-summary affordances that made the single-select
version fast to use is the trap.

**How to avoid:**
- Keep `aria-pressed` toggle buttons (correct pattern, matches existing codebase
  convention) but visually distinguish the group as multi-select vs. the existing
  single-select segmented groups (e.g. different container styling) so sighted users don't
  assume "picking one turns off the others," which is the mental model every other filter
  group in this app currently teaches.
- Add an explicit "Show all datasets" / "Reset overlay" bulk action (mirrors the existing
  `showAllData()` big-button pattern already in `store/filters.ts` and `FilterBar.tsx`'s
  D-11 pattern) so a single tap/voice command can return to a known state instead of
  requiring up to 5 individual toggles.
- Keep a one-line, always-visible summary of which datasets are active (extending the
  existing `sentence`/`aria-live` pattern in `FilterBar.tsx`) so state is legible without
  visually scanning 5 buttons for their pressed/unpressed state — this also directly feeds
  the spoken-confirmation text from Pitfall 3/6.
- Guarantee the 5-toggle row wraps (never shrinks) below 48px at any supported viewport
  width — test at the narrowest supported width explicitly, don't just eyeball desktop.
- Voice equivalent: "show everything" / "hide labs" style commands should map to the same
  bulk/single actions as the click UI (see Pitfall 6) so voice users get the same fatigue
  relief mouse/switch users get from a bulk toggle.

**Warning signs:**
Usability walkthrough where getting from "everything on" to "just BP" by click takes 4
separate taps because there's no bulk action; or a screen-reader pass where the toggle
group reads identically to the existing single-select AM/PM group, misleading the user
into thinking only one dataset can be shown at a time.

**Phase to address:** Multi-Dataset Filtering & Overlay.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Speak `composeConfirmation()`'s full text verbatim instead of a shorter spoken-specific summary | No new copy to write; one source of truth | Hits the Chrome cutoff (Pitfall 3) as soon as overlay clauses are added; on-screen and spoken text silently diverge in content | Never once Multi-Dataset Overlay ships; acceptable only as a Spoken Replies MVP before overlay lands |
| Implement overlay event markers as `ReferenceLine`/`ReferenceDot` (reusing the existing AHA-band pattern) | Fast, matches an existing in-file pattern | Silently excludes keyboard/screen-reader users from clinical event data (Pitfall 5) | Never for real clinical data (incidents/procedures); fine to keep for genuinely decorative elements only (the existing AHA bands) |
| Add `"guide"` as a third `useView` state, matching `"upload"` | Fastest to build, copies a proven pattern | Kills the live voice session on open (Pitfall 7) | Never — this directly regresses the app's core value proposition |
| Ship the liveness check as a client-side poll hitting `/agent` with a throwaway phrase | No new backend route | Burns real Claude credits per poll interval per open tab; competes with the 20/min rate limit real commands need (Pitfall 8) | Never in production; acceptable only behind a feature flag during local dev with a keyless/mocked backend |
| Copy the single-select `aria-pressed` toggle-button visuals directly for the multi-select dataset row with no bulk action | Fastest to ship, visually consistent | Multiplies taps/switch-activations to reach common states for the primary low-mobility user (Pitfall 9) | Never for the shipped feature; acceptable only as a throwaway internal prototype |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|--------------------|
| `SpeechSynthesis` + existing `SpeechRecognition` loop (`useVoiceCommand.ts`) | Adding `speechSynthesis.speak()` calls without touching the recognizer at all | Explicitly abort/pause recognition before speaking, resume after `onend` **and** a timeout fallback (Pitfall 1) |
| `SpeechSynthesis` + existing `visibilitychange` handler | Leaving the new TTS code out of the handler that already exists in `useVoiceCommand.ts` for backgrounding | Extend the same handler to `speechSynthesis.cancel()` on hide, matching the existing recognizer-abort behavior (Pitfall 2) |
| Recharts `accessibilityLayer` + new overlay series | Assuming "on by default in v3" means every visual element (including `Reference*` annotations) is keyboard-reachable | Only real data series (`Line`/`Bar`/`Scatter`/`Area`) join `accessibilityLayer`'s nav set; verify overlay markers are implemented as one of those, not `Reference*` (Pitfall 5) |
| Agent structured-outputs schema (`schemas.py`) + new multi-select dataset field | Adding a `list[...]` field to `DashboardCommand` and assuming it "just works" like the existing scalar `Literal` fields | Design a single-value `toggle_dataset` action instead, staying inside the same closed-Literal discipline every other field already follows and that the file's own comments document as load-bearing (Pitfall 6) |
| New liveness-check route + existing `slowapi` `Limiter` in `routers/agent.py` | Reusing the same limiter/route the real `/agent` traffic uses, or polling frequently with no server-side cache | New route, own (or no) rate limit, server-side TTL cache so poll frequency from N browser tabs doesn't multiply cost (Pitfall 8) |
| `useView` (`store/view.ts`) + new Guide surface | Adding `"guide"` as a third top-level view swapped the same way as `"upload"` | Render Guide within the `Dashboard` tree (or hoist the recognizer above the view switch) so `CommandBar`/the recognizer never unmounts (Pitfall 7) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Liveness poll interval too short / uncached | Anthropic bill grows with no corresponding user activity; possible rate-limit contention with real commands | Server-side TTL cache (minutes, not seconds); one shared check across all sessions, not per-tab | Immediately, at any nonzero polling interval without a cache — this is a correctness issue, not a scale issue |
| `speechSynthesis.resume()` heartbeat left running after `cancel()` | Zombie interval keeps firing after speech naturally ends or is cancelled, harmless but wasteful | Clear the interval in every exit path (`onend`, `onerror`, explicit cancel, unmount) | Noticeable only under heavy/rapid command use, but a correctness smell regardless |
| Overlay chart re-renders on every toggle when all datasets are combined into one query | Chart flicker/jank as more series get added, especially on the animated `LineChart` (`isAnimationActive`) | Keep `isAnimationActive={animate}` gated by `prefersReducedMotion()` (already the pattern in `BPTimeline.tsx`); consider disabling animation for the overlay hero specifically once 3+ series render simultaneously | Once 3+ heterogeneous series (BP lines + lab line + event scatter) are all animating in on toggle, well within v1.1's realistic dataset sizes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Liveness check implemented as a full `/agent`-equivalent call with real free-text content | Treats a system-health probe as untrusted-input-processing, unnecessarily; also risks the probe text leaking into logs/prompts | Use a minimal, fixed, non-user-authored probe payload — never route real user text through a liveness check |
| Guide content or spoken confirmations echoing raw error/model text | Every other error surface in this codebase deliberately uses fixed friendly copy (`VOICE-07`/`copy.py` templates) — a new TTS path is a new place someone could accidentally pipe a raw exception string into `speechSynthesis.speak()` | Route all spoken text through the same fixed-copy discipline (`copy.py`/`composeConfirmation()`) already enforced for on-screen text; never speak `error.message` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Spoken replies default to "on" with no persisted mute state | A caregiver mutes it in a quiet room (e.g., during a call), reload resets it to speaking aloud unexpectedly — awkward given the content is health data | Persist the mute/quiet toggle (mirror the existing `theme`/`auth` localStorage pattern, not the ephemeral `view` store pattern) |
| Guide has no voice-driven "go back to dashboard" | User who opened the guide by voice has no voice path out if the guide isn't inside the same recognizer-mounted tree (Pitfall 7) | Guide must accept the same wake-word grammar for at least "close guide"/"go back" |
| Overlay toggle changes the chart's Y-axis scale without warning | A user who has learned "the BP band colors mean X" sees the same visual space suddenly host a second axis/series and may misread it as still being the mmHg scale | Clear axis labeling per `yAxisId`, and visually separate the events lane from the measurement lanes (Pitfall 4) |
| "Assistant unavailable" state looks identical to a generic loading/error state | Caregiver can't tell "the agent is down" from "the network is down" from "my command was garbled" | Give the liveness-driven unavailable state its own distinct, persistent UI treatment (not just another line in the existing `aria-live` region that flashes and disappears) |

## "Looks Done But Isn't" Checklist

- [ ] **Spoken replies:** Often missing the pause-recognition-while-speaking coordination —
  verify by watching the mic state during a spoken confirmation on a device without
  headphones, not just checking that audio comes out of the speaker.
- [ ] **Spoken replies on iOS:** Often missing background-cancel handling — verify by
  locking the phone mid-confirmation and unlocking it, not just a single happy-path test.
- [ ] **Multi-dataset overlay:** Often missing a non-visual (table/list) equivalent for
  overlay event markers — verify with a screen reader or keyboard-only pass specifically
  targeting the incidents/procedures markers, not just the existing BP/pulse lines.
- [ ] **Multi-dataset overlay:** Often missing the Y-axis/scale decision for labs — verify
  a real (or realistic sample) lab value actually plots somewhere meaningful, not just that
  the toggle doesn't crash.
- [ ] **Site guide:** Often missing voice reachability entirely (built as a mouse-only tab)
  — verify by opening and closing the guide using only the wake word, no taps.
- [ ] **Agent liveness:** Often missing the "configured but failing" case — verify by
  simulating a $0-credit/API-error response (not just simulating "no key set," which the
  code already handles correctly) and confirming the UI shows "unavailable," not "didn't
  catch that."
- [ ] **Agent liveness:** Often missing rate-limit isolation — verify that hammering the
  liveness check does not produce 429s on a simultaneous real `/agent` command.
- [ ] **Multi-select toggles:** Often missing a bulk reset action — verify the number of
  taps/clicks needed to go from "everything on" to "just BP" is 1, not up to 5.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| TTS/STT feedback loop shipped without coordination (Pitfall 1) | LOW | Add the pause/resume wrapper around existing `speechSynthesis.speak()` calls; no data model change, purely additive to `useVoiceCommand.ts` |
| Overlay markers built as `ReferenceLine`/`ReferenceDot` (Pitfall 5) | MEDIUM | Swap the rendering primitive to a real `Scatter`/`Line` series; requires revisiting styling (markers currently styled as annotations, not data points) but no schema change |
| Agent schema extended incorrectly for multi-select (Pitfall 6) | MEDIUM-HIGH | Structured-outputs schema changes require re-verifying against the live SDK and re-testing the whole `/agent` interpretation pipeline (existing `test_agent_*` suite) — budget real regression-test time, not just a quick patch |
| Guide built as a `useView`-swapped surface that kills voice (Pitfall 7) | MEDIUM | Refactor to render inside `Dashboard` or hoist the recognizer above the view switch; touches `App.tsx` structure, moderate but contained |
| Liveness check burning credits/racing rate limits (Pitfall 8) | LOW-MEDIUM | Move the check to its own route + server-side TTL cache; does not require touching `/agent` or the interpretation pipeline itself |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|-----------------|
| 1. TTS/STT feedback loop | Spoken Replies | Manual test without headphones: confirmation speaks without the mic re-triggering a spurious command |
| 2. iOS Safari TTS quirks | Spoken Replies | Real iPhone test: lock/unlock mid-confirmation; verify voice loads without a long delay on first use |
| 3. Long-confirmation cutoff | Spoken Replies (baseline), re-verify in Multi-Dataset Overlay | Automated test asserting worst-case confirmation length stays under a safe budget, or manual listen-through of a max-clause confirmation |
| 4. Overlay Y-axis/scale mismatch | Multi-Dataset Filtering & Overlay | Design review before implementation: explicit per-dataset-type decision (plotted series vs. event marker) documented before coding |
| 5. accessibilityLayer excludes annotation markers | Multi-Dataset Filtering & Overlay | Keyboard-only + screen-reader pass over the overlay chart with 3+ datasets toggled on |
| 6. Agent schema single-select mismatch | Multi-Dataset Filtering & Overlay | `test_agent_schemas.py`/`test_agent_route.py`-style regression coverage for the new action, plus a manual voice/text toggle-dataset command |
| 7. Guide kills voice session | Full Site Guide / Instructions Tab | Manual test: open and close the guide using only the wake word, then issue a normal filter command with no manual mic tap |
| 8. Liveness check cost/race | Agent Availability Made Visible | Simulate a $0-credit failure and confirm distinct "unavailable" UI; load-test the liveness route in isolation from `/agent`'s rate limit |
| 9. Multi-select toggle fatigue | Multi-Dataset Filtering & Overlay | Count taps/clicks from "all on" to "just BP"; screen-reader pass confirms the group reads as multi-select, not single-select |

## Sources

- Direct inspection of this repository (HIGH confidence — primary source, not inference):
  `frontend/src/hooks/useVoiceCommand.ts`, `frontend/src/lib/voice.ts`,
  `frontend/src/store/filters.ts`, `frontend/src/store/view.ts`,
  `frontend/src/components/CommandBar.tsx`, `frontend/src/components/FilterBar.tsx`,
  `frontend/src/components/ChartDeck.tsx`, `frontend/src/components/charts/BPTimeline.tsx`,
  `frontend/src/lib/agent.ts`, `frontend/src/lib/palette.ts`,
  `backend/app/agent/schemas.py`, `backend/app/agent/service.py`,
  `backend/app/routers/agent.py`, `backend/app/main.py`, `backend/app/models.py`,
  `.planning/PROJECT.md` — MEDIUM–HIGH for the historical `$0 credits` behavior claim
  (documented by the project itself in PROJECT.md's Validated section, dated 2026-08-19).
- Chromium bug tracker — "Speech Synthesis stops abruptly after about 15 seconds"
  (issues #679437 and #41294170, long-standing, multiple duplicate reports) — MEDIUM-HIGH,
  reproducible bug still referenced in recent discussion threads.
- MDN — `SpeechSynthesis`/`SpeechSynthesisUtterance`/`SpeechRecognition` reference pages —
  HIGH (official docs).
- Community reports (Apple Developer Forums, WICG/speech-api GitHub issues,
  react-speech-recognition GitHub issues, weboutloud.io "The State of Speech Synthesis in
  Safari") on iOS Safari `getVoices()`/`voiceschanged` timing and background-cancellation
  behavior, and on stop-recognition-before-speaking as the community-converged workaround
  pattern — MEDIUM (multiple independent, consistent reports; no single official Apple doc
  confirms all specifics, so treat exact thresholds/behavior as subject to iOS-version
  drift and re-verify on the actual target device before/during the Spoken Replies phase).
- Recharts GitHub — "Recharts and accessibility" wiki, issue #4809 (`accessibilityLayer`
  scope), issue #6338 (tooltip keyboard activation gaps on some chart types), discussion
  #4484 — MEDIUM (project wiki + maintainer/community issue threads, not versioned API
  docs; re-verify against the pinned Recharts 3.9.x behavior directly during
  implementation, since accessibility support has been actively evolving across recent
  minor versions).
- WebSearch — Anthropic API credit-balance visibility (no public balance/lightweight
  liveness endpoint found) — MEDIUM (absence-of-evidence claim from search; re-verify
  directly against current `platform.claude.com` docs at implementation time since this is
  exactly the kind of claim that should not be taken as a permanent negative).
- WCAG/ARIA — toggle-button vs. checkbox pattern guidance (`aria-pressed` is correct for
  both single- and multi-select toggle buttons; `aria-multiselectable` matters for
  listbox/option patterns, not independent toggle-button groups) — MEDIUM, synthesized
  from multiple accessibility-guide sources rather than a single WAI-ARIA APG citation;
  cross-check against the current WAI-ARIA Authoring Practices Guide "Button" pattern
  before finalizing the multi-select group's markup.

---
*Pitfalls research for: Health Visualizer v1.1 (Polish & Records) — Spoken Replies,
Multi-Dataset Filtering & Overlay, Full Site Guide, Agent Availability*
*Researched: 2026-08-19*
