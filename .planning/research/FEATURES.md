# Feature Research

**Domain:** Voice-first accessible personal health dashboard — in-app guide/help, multi-dataset overlay filtering, spoken (TTS) confirmations, assistant-liveness UX
**Researched:** 2026-08-19
**Confidence:** MEDIUM-HIGH overall. Structural/accessibility guidance (WCAG 2.x, W3C Cognitive Accessibility patterns, Alexa/Google conversation-design guides, ARIA live-region behavior) is **HIGH** confidence — official, current documentation. Claims about how specific consumer products ("comparable products") implement these four features are **MEDIUM/LOW** — few health apps publish their internal help/TTS/liveness rationale, so findings are synthesized from adjacent domains (BI dashboards for overlay toggles, smart-speaker/voice-assistant design guides for TTS and liveness, W3C cognitive-accessibility patterns for help). Flagged per-row below.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **[Guide]** Static, always-available reference tab covering every control/chart/filter/upload flow | PROJECT.md explicit ask; W3C cognitive-accessibility guidance favors a persistent, findable "Provide Help and Support" surface over content that appears once and vanishes — users with memory/attention differences need to re-find help repeatedly, not just on first run | LOW-MEDIUM | New route + nav entry; content-only build once other 3 features' final control set is known (ordering dependency — see below) |
| **[Guide]** Guide is keyboard-and-voice navigable, ≥18px text, ≥48px targets, high contrast | Non-negotiable per CLAUDE.md accessibility constraint; a help feature that itself fails accessibility is a contradiction for this project | LOW | Reuses existing design tokens/typography already established in FilterBar/CommandBar |
| **[Guide]** "What can I say" voice-command list embedded in the guide | Standard pattern across all major voice assistants (Google Home, Alexa) — discoverability of vocabulary is the #1 unmet need in voice UIs since there's no visual menu to browse (MEDIUM confidence — WebSearch-verified across multiple smart-speaker help patterns, no single authoritative spec) | LOW | Content mirrors `EXAMPLE_COMMANDS` already centralized in `backend/app/agent/copy.py` — reuse, don't fork a second list |
| **[Overlay]** Toggle control per dataset (BP, pulse, labs, incidents, procedures) with visible on/off state conveyed by more than color (word/icon + `aria-pressed`) | Standard dashboard pattern (Metabase multi-series, amCharts legend-toggle, Grafana); this project's own D-07 rule ("word + icon + color triad, never color alone") already establishes the accessibility bar it must clear | LOW-MEDIUM | FilterBar already has an `aria-pressed` toggle-button visual language (`inactiveClass`/`activeClass`) — reuse styling, but note the **interaction semantics differ**: FilterBar's groups are single-select (radio-like); overlay toggles must be independent multi-select (checkbox-like), which is new to this codebase |
| **[Overlay]** Manual-entry forms for labs/incidents/procedures | Migrations exist but tables are empty; overlay is meaningless with no data — PROJECT.md explicitly scopes these forms into this feature | MEDIUM | Needs 3 new Pydantic schemas + FastAPI CRUD routes + 3 accessible forms (large touch targets, no drag/precision input, per CLAUDE.md) |
| **[Overlay]** Distinct, colorblind-safe, non-color-only visual encoding per event type on the timeline (e.g., point marker for procedures, shaded range for multi-day incidents, annotated dot for labs) | Established pattern for event-overlay-on-time-series (Grafana annotations, Wavefront/Splunk event overlays): instantaneous events → line/dot; ongoing/duration events → shaded region; clustering markers when dense | MEDIUM | BPTimeline.tsx already uses Recharts `ReferenceArea` for the 6 AHA bands, rendered *before* the Lines for z-order — new event markers must be layered deliberately (on top of lines, not competing with the existing band z-order) |
| **[TTS]** Dashboard speaks the same confirmation text already shown visually (not new/different content) | Closes the "hands-free loop" as scoped in PROJECT.md; Alexa/Google guidance is consistent — voice output should say what the system did, not new information | LOW | `composeConfirmation()` already exists and is the single source of confirmation text (`lib/agent.ts`) — TTS should consume this, not author new copy |
| **[TTS]** Mute / quiet toggle, persisted across sessions | Alexa Haus patterns explicitly call for user control over audio output ("review, delete, or mute recordings" pattern generalizes to "control what plays back"); also a practical need — caregivers may be in a room with a sleeping/resting patient | LOW | `localStorage` flag; must be reachable by voice too ("dashboard, mute" style command) to stay consistent with voice-first principle |
| **[TTS]** Only ever speak one utterance at a time; cancel/replace, never queue or overlap | Universal voice-assistant UX rule — overlapping TTS is disorienting and unintelligible, especially for a user who cannot physically silence a device by pulling out headphones or covering a speaker | LOW | `speechSynthesis.cancel()` before each `speak()` call |
| **[Liveness]** A visibly different state for "assistant unavailable" than for "didn't understand you" | This is the literal ask in PROJECT.md; Alexa/Google conversation-design guides both treat "system/service error" and "no match" as distinct error classes with different copy and different recovery paths — conflating them is called out explicitly as an anti-pattern in Google's Conversation Design guide | LOW-MEDIUM | **Backend already has 90% of this**: `/health` returns `agent_configured: bool` (ungated, ready to poll), and `service.py` already uses a *different message* (`UNAVAILABLE_MESSAGE` vs `UNCLEAR_MESSAGE`) for the keyless case. The gap: `AgentReply.kind` is `Literal["applied","clarify","refuse","unclear"]` — there is **no distinct `kind` value** for "unavailable," so the frontend can only distinguish the two cases by string-matching message text (fragile). Also, `call_claude()`'s `except (APIError, ValidationError)` path (network/timeout/schema-drift) currently degrades to the generic `UNCLEAR_MESSAGE`, not `UNAVAILABLE_MESSAGE` — i.e., transient real outages are *currently* mislabeled as "didn't catch that," which is exactly the bug this feature is meant to fix |
| **[Liveness]** Calm, non-alarming presentation (neutral color, plain word, no siren/red banner) | Alexa Haus guidance: avoid accusatory/alarming phrasing; general vulnerable-user UX literature: "signaling humility instead of perfection... trust grows when a system acknowledges its limits" calmly, not dramatically (MEDIUM confidence — single secondary source, but consistent with the project's own established "never color alone, calm error state" convention already used for `status: "error"` in CommandBar, which explicitly uses a "!" marker, "visually calm... not a red alarm") | LOW | Directly reuse the existing calm-error visual language already in `CommandBar.tsx` rather than inventing a new "offline" visual treatment |
| **[Liveness]** Always pair the unavailable state with a working alternative ("the buttons below still work") | Universal graceful-degradation principle (Google Cloud Architecture Center, AWS Well-Architected Reliability Pillar, Alexa error patterns): every error needs an actionable next step, never a dead end | LOW | `UNAVAILABLE_MESSAGE` copy already does this verbatim — extend the pattern to voice path and to a proactive (pre-emptive) banner, not just a post-failure message |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **[Guide]** Voice-triggered contextual help ("dashboard, what does this chart mean?" / "dashboard, help") | Goes beyond a static tab — ties directly into the wake-word architecture (`WAKE_WORD = "dashboard"`) already built, so help becomes reachable without navigating away from whatever chart Chris is looking at | MEDIUM | Needs a small deterministic/local intent match (not the paid Claude agent, which is inert) — e.g. a fixed phrase-to-help-topic table, consistent with how `extractCommand`/`classifyError` already do local pattern matching in `lib/voice.ts` |
| **[Guide]** Contextual/staged onboarding hints shown once per new feature area (dismissible, never auto-launching a full tour) | W3C cognitive-accessibility guidance favors "gradually introducing information in a controlled sequence" over one large upfront tour, for users with attention/memory differences — but must remain fully dismissible and never block the underlying UI (see anti-feature below) | MEDIUM | Lower priority than the static guide; only worth building if the static tab alone proves insufficient in caregiver feedback |
| **[Overlay]** Click/select an overlay marker for full detail (incident notes, procedure outcome, lab value+range) in an accessible non-hover panel | Standard event-overlay pattern (Grafana/Wavefront: click a marker for full event detail) adapted to avoid hover-only interaction, which is explicitly disallowed by CLAUDE.md | MEDIUM | Reuses the existing `ChartTooltip.tsx` pattern but must trigger on click/keyboard-focus, not hover-only, to stay compliant with the no-hover-only constraint |
| **[TTS]** Adjustable speech rate/voice via browser `SpeechSynthesisVoice` picker | Some voice-assistant guidance recommends letting users tune output speed for comprehension differences | LOW-MEDIUM | Nice-to-have; defer unless caregiver feedback asks for it — adds a settings surface for a single-user app |
| **[Liveness]** Proactive banner shown at load (poll `/health` on mount) rather than only reactive (shown after a failed command) | More honest signal — Chris knows *before* trying to speak that the assistant won't respond, rather than discovering it mid-command | LOW-MEDIUM | `/health` is already ungated and cheap to poll; low risk, meaningfully different UX from "wait for a failure" |
| **[Liveness]** Distinguish "not configured" (no API key — permanent until billing is fixed) from "temporarily failing" (network/rate-limit — may resolve on retry) | More precise messaging = more actionable next step, per Google's Conversation Design guidance ("possible next steps... transparent, honest, and helpful") | MEDIUM | Requires the backend `kind` enum change noted above (add a distinct `unavailable` kind, or split messaging with a reason code) — genuinely useful but adds a small schema migration on the Pydantic command model |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| **[Guide]** Auto-launching, non-dismissible onboarding tour on every load | Feels "helpful," common in SaaS onboarding | For a user with motor impairment and non-technical caregivers, an unskippable modal sequence is a barrier, not a feature — it blocks the very controls it's explaining, and forces multiple dismiss-taps for someone who may have only mouth-stick/limited input | Persistent reference tab (table stakes above) + optional one-time dismissible hint, never blocking |
| **[Guide]** Full walkthrough that must be completed linearly before the dashboard is usable | Mirrors typical app "setup wizards" | Directly contradicts the project's core value (Chris must reach the dashboard/voice control immediately); also a caregiver may already know the site and shouldn't be forced through it again | Guide is a separate, always-optional tab; dashboard is fully usable without ever opening it |
| **[TTS]** Reading full data tables / long lists of readings aloud | Seems like "more accessible" | Slow, overwhelming, and inconsistent with the existing rule that server-composed confirmation text is short by design (`composeConfirmation`); long TTS also can't be interrupted cleanly without barge-in support this project doesn't have | Speak only the short confirmation sentence already shown visually; point to the stats bar/chart for detail, exactly as `DATA_QUESTION_MESSAGE` already does today |
| **[TTS]** TTS re-speaking on every store change (including filter changes from mouse/keyboard clicks, not just voice/agent commands) | Feels "consistent" | Talks over the user constantly, including during manual caregiver use where audio output isn't wanted or expected; violates "one thing announced at a time" already established for the `aria-live` region | Speak only on agent-applied/voice-confirmed commands, matching where the existing `aria-live="polite"` confirmation already fires — not on every local `zustand` state change |
| **[TTS]** Speaking the same text simultaneously announced via `aria-live` for screen-reader users | Seems redundant-but-harmless | Documented double-announcement problem: NVDA/JAWS/VoiceOver behavior with concurrent `aria-live` regions and independent audio sources is inconsistent and has known repeat-announcement bugs (MDN, NVDA issue tracker) — a screen-reader user would hear the confirmation twice, from two unsynchronized sources | Treat TTS and `aria-live` as the same "spoken channel" conceptually: TTS is for users **without** a screen reader (Chris's primary path — voice control, not a screen reader); the mute toggle should be framed/default in a way that doesn't assume both are always wanted together. Flag as an open design question for the roadmap/spec phase — JS cannot reliably detect "is a screen reader running," so this needs an explicit product decision, not just an implementation detail |
| **[Overlay]** Cross-dataset statistical correlation (auto-detect "BP spikes near incidents") | Looks like a natural next step once multiple datasets are visible together | Explicitly out of scope per PROJECT.md ("beyond visual overlay... post-MVP"); also clinically risky to imply causal/statistical correlation to a non-clinical user without care-team review | Visual co-location only (same timeline, same x-axis) — the user/caregiver draws their own conclusions, same posture as the existing medical-refusal pattern ("that's a question for your care team") |
| **[Overlay]** One combined store field that conflates "which chart is active" with "which datasets are overlaid" | Seems like less state to manage | The current `activeChart: ChartId` is a **single, exclusive** selection (bar charts XOR timeline charts); overlay is a **multi-select, additive** layer concept that only makes sense on the two time-series charts (BP Timeline, Pulse Trend) — BP Categories and AM/PM Comparison have no time axis, so events cannot overlay on them. Merging these concepts creates an inconsistent, hard-to-reason-about state shape | Keep `activeChart` (which chart) and a new independent `visibleDatasets`/overlay-layers field (which data types are shown) as separate store concerns; the overlay toggles should visibly disable or explain themselves when a non-timeline chart is active |
| **[Liveness]** Alarming red "OFFLINE" banner, siren icon, or modal interrupt for agent unavailability | Feels appropriately "serious" for a health app | This app's user is explicitly a vulnerable population (C4 quadriplegic, dependent on the assistant for autonomy); an alarming banner about the *assistant* (not his health data) risks distress disproportionate to the actual event (a $0-credit API key, not a health emergency) — red is also already reserved in this app's palette for clinical BP severity categories, so reusing it for a software-availability message would blur that meaning | Calm, neutral-toned inline message (reuse the existing "!" marker / calm-error visual language already in `CommandBar.tsx`), paired with "the buttons still work" |

## Feature Dependencies

```
[Overlay: dataset toggle chips]
    └──requires──> [Backend: labs/incidents/procedures models + CRUD routes]
                       └──requires──> (migrations already exist — empty tables, per PROJECT.md)
    └──requires──> [Backend: manual-entry forms' POST endpoints]
    └──requires──> [Frontend: filters store — new independent multi-select
                     "visible datasets" concept, separate from activeChart]
    └──requires──> [Frontend: chart layering — ReferenceLine/Dot/Area overlays
                     on BPTimeline + PulseTrend only (no time axis on the two
                     bar charts)]
    └──enhances──> [Guide: overlay controls need documenting once built]

[TTS: spoken replies]
    └──requires──> [Existing composeConfirmation() as sole content source —
                     reuse, do not author new copy]
    └──conflicts (open question)──> [Existing aria-live="polite" confirmation
                     region — risk of double-announcement for screen-reader
                     users; needs an explicit product decision, not silently
                     resolved by "just add TTS"]
    └──enhances──> [Liveness: unavailable-state message can also be spoken]

[Guide: site guide tab]
    └──requires (content-completeness, not code)──> [Overlay, TTS, Liveness
                     final control sets — the guide describes them, so its
                     CONTENT should be finished last even if its scaffold
                     (tab/route/nav) is built early]
    └──enhances──> [Guide: voice-triggered contextual help variant, if built]

[Liveness: agent availability]
    └──requires──> [Existing /health endpoint (`agent_configured: bool`) —
                     already ungated and ready to poll]
    └──requires──> [Backend: new distinct AgentReply.kind value (e.g.
                     "unavailable") OR a reason code, since APIError/
                     ValidationError paths in call_claude() currently
                     collapse into the SAME generic "unclear" kind as a
                     true no-match — this is the actual bug PROJECT.md
                     is asking to fix, not just a new UI state]
    └──enhances──> [TTS: can announce "assistant unavailable" once distinct]
```

### Dependency Notes

- **Overlay requires the filters store to grow a genuinely new interaction shape**, not just new fields. `store/filters.ts` currently models `activeChart` as a single exclusive selection (mirrors a future single voice command like "show pulse"). Overlay is additive/multi-select ("show pulse *and* hospital stays *and* pulse *and* labs together"). Building it as a bolt-on to `activeChart` will produce an inconsistent model; it should be a parallel, independently-toggleable set.
- **Overlay is only meaningful on the two time-series charts** (BP Timeline, Pulse Trend). BP Categories (horizontal bar) and AM/PM Comparison (grouped bar) have no time axis to plot event markers against. The roadmap should scope overlay UI to explicitly acknowledge this (e.g., overlay toggles present but visually indicate "switch to a timeline chart to see this" rather than silently doing nothing) — this is a real UX gap if unaddressed, given the accessibility requirement that state changes must never be silent/invisible (D-07 "never color alone" implies never *no signal at all* either).
- **TTS's only real open design risk is the aria-live/SpeechSynthesis interaction**, not the SpeechSynthesis API itself (which is simple: `speechSynthesis.speak(new SpeechSynthesisUtterance(text))`, cancel-before-speak). The existing `aria-live="polite"` region in `CommandBar.tsx` already delivers the confirmation to assistive technology. Layering audible TTS on top is *for Chris specifically* (a voice-control user, not necessarily a screen-reader user) but the two systems have no coordination and JS cannot detect screen-reader presence reliably — this should be called out for the roadmap/spec phase as a product decision (e.g., "TTS is opt-in / default-on but the mute toggle is prominent and independently voice-reachable"), not resolved silently in implementation.
- **Liveness has substantially more backend groundwork already in place than the milestone description implies.** `/health`'s `agent_configured` flag and the already-distinct `UNAVAILABLE_MESSAGE` copy string mean this is not a from-scratch feature — it's closing a specific, identifiable gap: `AgentReply.kind` conflates "assistant unavailable" and "genuinely didn't understand you" into the same `"unclear"` literal, and the exception path in `call_claude()` (network/timeout/schema-parse failures) currently mislabels real outages as generic unclear replies rather than routing to the unavailable copy. This lowers the complexity estimate for this feature relative to Guide/Overlay.
- **Guide content should be written last** (though its route/tab scaffold can be built anytime) because it needs to document the final shape of the overlay controls, the mute toggle, and the liveness messaging — writing it first risks documenting a UI that changes underneath it.
- **None of the four features depend on the Claude Agent / paid API.** All four are explicitly scoped to work with $0 credits (per PROJECT.md), which matters for sequencing: they can be built and fully validated without the billing blocker that stalled v1.0's NL agent. The one caveat: voice-triggered contextual help (a differentiator, not table stakes) and any future voice command for new overlay toggles need a **local/deterministic** command matcher (extending the existing `lib/voice.ts` pattern-matching, not the inert Claude agent) if they are to work by voice in this milestone.

## MVP Definition

### Launch With (v1.1 — this milestone, per PROJECT.md scope)

- [ ] **[Liveness]** Distinct `kind: "unavailable"` (or reason code) in `AgentReply`, routed from both the keyless case and the `call_claude()` exception path — this is the actual bug fix; everything else in this feature is UI dressing on top of it
- [ ] **[Liveness]** Calm, non-alarming visual state reusing existing error-copy conventions, paired with "manual controls still work"
- [ ] **[TTS]** Speak `composeConfirmation()` output on applied voice/agent commands only, with a persisted, voice-reachable mute toggle
- [ ] **[Overlay]** Multi-select toggle chips for BP/pulse/labs/incidents/procedures, `aria-pressed`, non-color-only encoding, scoped to the two timeline charts
- [ ] **[Overlay]** Accessible manual-entry forms for labs/incidents/procedures (required — tables are otherwise unreachable)
- [ ] **[Guide]** Static, always-available, keyboard+voice-navigable reference tab covering every control, filter, chart, and upload flow, including a "what can I say" command list

### Add After Validation (v1.x)

- [ ] Voice-triggered contextual help ("dashboard, help") — trigger: once the static guide's content is stable and a local intent-matching pattern is proven for other new voice affordances (mute, overlay toggles)
- [ ] Click-to-detail panels on overlay markers (full incident/lab/procedure record) — trigger: once basic overlay presence/absence is validated with Chris and caregivers
- [ ] Proactive `/health` poll at load (vs. reactive-only liveness) — trigger: cheap to add once the `kind: "unavailable"` distinction exists; low risk, can follow shortly after

### Future Consideration (v2+)

- [ ] Adjustable TTS voice/rate settings — defer until/unless caregiver feedback specifically asks for it
- [ ] Distinguishing "not configured" vs. "temporarily failing" unavailable states — defer until the paid API is actually activated and transient failures become observable in practice (right now, every failure mode is effectively "not configured")
- [ ] Staged/contextual onboarding hints beyond the static guide — defer until the static guide alone proves insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Liveness: distinct unavailable kind + calm UI | HIGH (fixes a real silent-failure bug) | LOW-MEDIUM (backend groundwork mostly exists) | P1 |
| TTS: spoken confirmation + mute toggle | HIGH (closes the hands-free loop, core ask) | LOW-MEDIUM (content already exists; API is simple) | P1 |
| Overlay: toggle chips + timeline layering | HIGH (core ask; makes labs/incidents/procedures reachable) | MEDIUM-HIGH (new backend CRUD + new store shape + chart layering) | P1 |
| Overlay: manual-entry forms | HIGH (overlay is inert without data) | MEDIUM (3 forms × accessibility constraints) | P1 |
| Guide: static reference tab | HIGH (explicit ask; caregiver-critical) | LOW-MEDIUM (mostly content work) | P1 |
| Voice-triggered contextual help | MEDIUM (nice hands-free enhancement) | MEDIUM (needs local intent matching) | P2 |
| Click-to-detail overlay markers | MEDIUM | MEDIUM | P2 |
| Proactive `/health` polling | MEDIUM (better honesty, not core ask) | LOW | P2 |
| Adjustable TTS voice/rate | LOW (single user, unproven need) | LOW-MEDIUM | P3 |
| Staged onboarding hints | LOW (static guide likely sufficient for one user + a few caregivers) | MEDIUM | P3 |

## Reference Pattern Analysis

No direct competitor exists (single-user personal health dashboard); patterns are synthesized from adjacent domains:

| Feature area | BI/dashboard tools (Metabase, Grafana, amCharts) | Voice assistants (Alexa, Google Assistant) | W3C/WCAG cognitive accessibility | Our approach |
|---------|--------------|--------------|-----------------------------------|--------------|
| Multi-series toggle | Legend-as-filter, click-to-hide series, checkbox semantics | N/A | N/A | Toggle chips reusing existing `aria-pressed` visual language, multi-select (new interaction shape) |
| Event overlay on timeline | Reference lines/dots/shaded ranges per event type, clustering when dense | N/A | N/A | Recharts `ReferenceLine`/`ReferenceDot`/`ReferenceArea`, extending the existing AHA-band pattern already in `BPTimeline.tsx` |
| Help/guidance | N/A | "What can I say" list, contextual voice help | Persistent findable help, staged disclosure, never auto-changing content unexpectedly | Static always-available tab + reused example-command list, voice-trigger as a later enhancement |
| Spoken output | N/A | Speak what happened, not new info; single utterance; mute control | N/A | TTS mirrors `composeConfirmation()`, cancel-before-speak, persisted+voice-reachable mute |
| Service-unavailable messaging | Graceful degradation (soft dependency) | Distinct error classes (no-match vs. system error), calm tone, always pair with next step, escalate only after repeated failures | N/A | Distinct `kind`, reuse existing calm-error visual language, always paired with "buttons still work" |

## Sources

- W3C WAI — "Provide Help with Directions" (Cognitive Accessibility Design Pattern): https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p06-supported-wayfinding/ — HIGH confidence, official W3C guidance
- Amazon Alexa Haus — "Handling errors gracefully": https://developer.amazon.com/en-US/alexa/alexa-haus/patterns-and-components/patterns-errors — HIGH confidence, official Amazon design guidance
- Google — Conversation Design: Errors: https://developers.google.com/assistant/conversation-design/errors — HIGH confidence, official Google guidance
- MDN — ARIA Screen Reader Implementors Guide (live-region double-announcement behavior): https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Screen_Reader_Implementors_Guide — HIGH confidence, official MDN
- NVDA issue tracker — aria-live repeated-announcement bug: https://github.com/nvaccess/nvda/issues/7996 — MEDIUM confidence, real-world bug report corroborating the double-speak risk
- WebAbility.io / WCAG mobile accessibility guides — motor-impairment touch-target and voice-control patterns — MEDIUM confidence, secondary sources aggregating WCAG requirements
- amCharts / Metabase / Grafana docs on legend-toggle and annotation/event-overlay patterns (via WebSearch aggregation) — MEDIUM confidence, consistent across multiple independent charting tools
- MDN aria-pressed reference and general toggle-button accessibility guides — HIGH confidence for the ARIA mechanics, MEDIUM for the "menu-button vs. toggle-button" nuance (single secondary source)
- Codebase inspection (this repo): `frontend/src/store/filters.ts`, `frontend/src/components/CommandBar.tsx`, `frontend/src/components/FilterBar.tsx`, `frontend/src/components/charts/BPTimeline.tsx`, `frontend/src/lib/voice.ts`, `backend/app/main.py`, `backend/app/agent/service.py`, `backend/app/agent/copy.py`, `backend/app/agent/schemas.py` — HIGH confidence, primary source (ground truth for dependency/complexity claims)
- General voice-UX and chatbot-UX secondary sources (Bentley UX Center, Aufait UX, Eleken, FuseLab Creative, OrangeLoops "Designing Trustworthy AI Assistants") — LOW-MEDIUM confidence, blog-level sources used only to corroborate patterns already found in higher-confidence sources, not as standalone claims

---
*Feature research for: voice-first accessible personal health dashboard — v1.1 (Polish & Records) milestone*
*Researched: 2026-08-19*
