# Project Research Summary

**Project:** Health Visualizer — Chris's Health Dashboard — v1.1 "Polish & Records" milestone
**Domain:** Additions to an existing, shipped, voice-first accessible personal health dashboard — spoken TTS replies, multi-dataset overlay/filtering (labs, incidents, procedures), an in-app site guide, and real agent-liveness detection
**Researched:** 2026-08-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone adds four features to an already-shipped, well-instrumented codebase (v1.0 MVP: FastAPI + SQLAlchemy backend, React/Vite + Zustand/TanStack Query frontend, Claude structured-outputs agent — currently inert on $0 API credits). The single biggest finding across all four research files is that this milestone needs zero new dependencies: spoken replies use the native SpeechSynthesis API (mirroring the custom-hook pattern the project already chose for SpeechRecognition), overlay charting reuses the already-installed Recharts 3.9.2 primitives, agent liveness reuses the already-installed anthropic SDK's typed error hierarchy, and the site guide is a third view state with native details/summary — no router, no accordion library, no TTS wrapper, no markdown/CMS. Every recommendation is grounded directly in this repository's own files and conventions, which is why architecture confidence is HIGH rather than merely inferred from general best practice.

The recommended approach is liveness first, records backend next, then overlay/forms in parallel, then TTS, then the guide last — dependency-driven, not feature-importance-driven. Liveness has no dependencies on the other three and fixes a real, already-diagnosed bug (the backend already distinguishes "no API key" from "configured," but not "configured and failing on every call," which is precisely today's $0-credit failure mode). The records backend (labs/incidents/procedures CRUD) unblocks the manual-entry forms and the overlay UI, which can then proceed in parallel. TTS should land after liveness (it needs to speak the "unavailable" message) and after the overlay clause is added to composeConfirmation() (so spoken and visual confirmations don't diverge). The guide should be built last so its content documents the finished UI rather than a moving target — but its scaffolding decision (render inside the Dashboard tree, not as a view-swap) must be made up front.

The key risks are not "will this work" but "will this quietly break something that already works." Three integration risks recur across the pitfalls and architecture research: (1) TTS speaking while the always-on SpeechRecognition session is armed creates a feedback loop the mic can mistake for a new command — this must be solved alongside the first TTS call, not deferred; (2) a naive multi-dataset overlay chart implementation will either plot lab values on a clinically meaningless mmHg axis or use ReferenceLine/ReferenceDot annotations that Recharts' accessibilityLayer silently excludes from keyboard/screen-reader navigation — for an app whose primary user cannot use a mouse, this is a correctness bug, not a nice-to-have; and (3) building the guide as a third view-swap state (copying the existing Dashboard/Upload pattern) will unmount the voice recognizer the instant the guide opens, breaking hands-free navigation for the one feature that exists to teach hands-free navigation. All three have concrete, low-cost mitigations documented below and must be treated as first-class phase design decisions, not implementation afterthoughts.

## Key Findings

### Recommended Stack

No new npm or PyPI packages are required for this milestone. All four features are built on native browser APIs (SpeechSynthesis) or libraries already installed and in use (recharts 3.9.2, anthropic 0.117.0, zustand 5.0.14). Where an off-the-shelf library might tempt (a TTS wrapper, a router, an accordion primitive), the research explicitly recommends against adding it.

**Core technologies:**
- Native SpeechSynthesis/SpeechSynthesisUtterance — spoken confirmation replies — broader browser support than SpeechRecognition (works on Safari desktop/iOS unprefixed), already in TS's lib.dom.d.ts (unlike SpeechRecognition, which this repo had to hand-declare). Build a hooks/useSpeechSynthesis.ts + lib/speech.ts pair mirroring the existing lib/voice.ts split — this project already chose the custom-hook path over a wrapper library once, for the same API family.
- Recharts ComposedChart/ReferenceLine (existing, no bump) — overlay incidents/procedures/labs on the two time-series charts. Native support for mixed-series composition; z-order is JSX order, already a documented convention in BPTimeline.tsx.
- anthropic SDK (existing, 0.117.0) — typed APIStatusError/billing_error hierarchy + messages.count_tokens() — precise billing-failure classification and a candidate zero-cost liveness probe (see Gaps below re: confidence on the "free" claim).
- zustand (existing, 5.0.14) — new sibling stores (store/overlay.ts, store/speech.ts, store/agentStatus.ts) for the new UI/liveness state, following the same one-concern-per-store convention as store/filters.ts/store/view.ts.

### Expected Features

**Must have (table stakes, v1.1 launch scope per PROJECT.md and FEATURES.md P1):**
- Distinct AgentReply.kind: "unavailable" (or equivalent) routed from both the keyless case and the call_claude() exception path, paired with a calm, non-alarming UI state and "manual controls still work" messaging — this is the actual bug fix, not just new UI.
- Spoken confirmation of the existing composeConfirmation() text (never new/different content) on applied voice/agent commands only, with a persisted, voice-reachable mute toggle.
- Multi-select overlay toggle chips for BP/pulse/labs/incidents/procedures (aria-pressed, word+icon+color, never color alone), scoped to the two timeline charts only.
- Accessible manual-entry forms for labs/incidents/procedures — required, not optional; the migrated-but-empty tables are otherwise unreachable and overlay is meaningless without data.
- A static, always-available, keyboard+voice-navigable guide tab covering every control/chart/filter/upload flow, including a "what can I say" command list (reuse EXAMPLE_COMMANDS, don't fork a second list).

**Should have (differentiators, P2):**
- Voice-triggered contextual help ("dashboard, help") via a local/deterministic phrase match.
- Click-to-detail panels on overlay markers (full incident/lab/procedure record), triggered on click/focus, never hover-only.
- Proactive /health polling at load (vs. reactive-only liveness) — cheap once the kind: "unavailable" distinction exists.

**Defer (v2+ / explicitly out of scope):**
- Adjustable TTS voice/rate settings — no evidence of need for a single user.
- Distinguishing "not configured" vs. "temporarily failing" unavailable states — every failure mode is effectively "not configured" until the paid API is actually activated.
- Staged/contextual onboarding hints beyond the static guide.
- Cross-dataset statistical correlation ("BP spikes near incidents") — explicitly out of scope per PROJECT.md; clinically risky to imply without care-team review. Visual co-location only.

### Architecture Approach

All four features are additive — none require restructuring the existing FastAPI/Zustand/TanStack Query split. The two features with real design decisions are multi-dataset overlay (new sibling store, new backend routers, a schema/store shape that must stay separate from the single-select store/filters.ts) and agent liveness (a backend circuit breaker fed by real traffic, not a naive health-ping that would either cost tokens or add latency). Spoken replies and the site guide are smaller, mostly-frontend additions once those two land, but each carries a specific integration trap (see Critical Pitfalls).

**Major components:**
1. agent/service.py circuit breaker (backend) — module-level cache of the last real /agent call outcome; /health reads it for free, never pings Claude itself.
2. labs.py/incidents.py/procedures.py routers (backend) — one thin router per resource, mirroring readings.py exactly, GET (date-filtered) + POST, Bearer-gated like every other route.
3. store/overlay.ts (frontend, new sibling store) — independent multi-select dataset-visibility state, deliberately not merged into store/filters.ts (which is the parity-tested agent command schema and must stay untouched by unrelated concerns).
4. lib/speech.ts + lib/guideCommands.ts (frontend, pure helpers) — mirror lib/voice.ts's pure/testable-helper convention; guideCommands.ts specifically short-circuits before the network call so guide navigation works even while the paid agent is down.
5. BPTimeline.tsx/PulseTrend.tsx (extended) — render overlay event markers on the existing numeric time x-axis; the two bar charts (BP Categories, AM/PM) are not overlay targets (no time axis).

### Critical Pitfalls

1. TTS/STT feedback loop — the always-on SpeechRecognition session will pick up the device's own spoken confirmation as new input if nothing coordinates the two. Pause/abort the recognizer immediately before speak(), resume on onend and a timeout fallback (don't trust onend alone). Must be solved alongside the first TTS call, not deferred.
2. iOS Safari TTS quirks — getVoices() can return empty/late, and backgrounding cancels in-flight speech with no auto-resume. Prime speechSynthesis with a silent utterance inside the same mic-tap gesture already used for SpeechRecognition.start(); extend the existing visibilitychange handler to also cancel() speech on hide.
3. Chrome's ~15s/~250-char TTS cutoff — a long-standing Chromium bug truncates long utterances mid-sentence. composeConfirmation() is designed to grow (overlay clauses will lengthen it) — add a resume() heartbeat as defense-in-depth and re-audit worst-case confirmation length once overlays ship.
4. Overlay data has no shared Y-axis — labs (arbitrary units), incidents/procedures (no y-value at all) cannot simply be added as another Line on the fixed [40,220] mmHg-domain BP chart. Decide per dataset type, before writing chart code, whether it's a plotted series (needs its own axis) or an event marker (needs only an X position).
5. accessibilityLayer excludes Reference* annotations — Recharts' keyboard navigation and Tooltip only cover real data series (Line/Bar/Scatter/Area), not ReferenceLine/ReferenceDot. Implementing overlay markers as ReferenceLines (the path of least resistance, since BPTimeline.tsx already uses ReferenceArea for AHA bands) will silently exclude keyboard/screen-reader users from clinical event data. Must be paired with — or replaced by — an accessible list/table equivalent.

## Implications for Roadmap

Based on combined research, suggested phase structure (dependency-driven, not by feature prominence):

### Phase 1: Agent Availability Made Visible (Liveness Detection)
**Rationale:** Zero dependency on the other three features; extends existing test scaffolding (test_health.py) directly; fixes a real, already-diagnosed bug — the code today distinguishes "no key" from "configured" but not "configured and failing on every call" (today's actual $0-credit state). Ship first so TTS (Phase 6) can speak the "unavailable" copy and the guide (Phase 7) can document the finished banner.
**Delivers:** Backend circuit breaker in agent/service.py (records pass/fail of real /agent traffic, no self-pinging Claude); extended /health response; new AgentReply.kind: "down" distinct from "unclear"; calm, non-alarming frontend banner reusing existing error-copy conventions, always paired with "manual controls still work."
**Addresses:** FEATURES.md P1 liveness items (distinct unavailable kind, calm UI, actionable next step).
**Avoids:** A naive liveness check either burns paid credits per poll or reproduces the exact false-positive it exists to fix; give it its own route with its own (or no) rate limit and a server-side TTL cache, never share /agent's 20/min limiter.

### Phase 2: Records Backend (Labs / Incidents / Procedures CRUD)
**Rationale:** Pure backend, no frontend dependency; mirrors the existing readings.py router pattern exactly (lowest-risk slice of the largest feature); unblocks Phases 3 and 4, which can then proceed in parallel.
**Delivers:** labs.py/incidents.py/procedures.py routers (GET date-range-filtered + POST validated create) and matching Pydantic schemas, Bearer-gated like every other route. Migrations already exist (empty tables).
**Uses:** Existing SQLAlchemy models — no new stack elements.
**Implements:** Architecture's "one router file per resource" pattern.

### Phase 3: Manual-Entry Forms
**Rationale:** Depends only on Phase 2's POST endpoints; independent of overlay rendering, so it can run in parallel with Phase 4. Required, not optional — overlay is inert without data to show.
**Delivers:** Three accessible entry forms (labs/incidents/procedures) — large touch targets, no drag/precision input per CLAUDE.md; wired to mutation hooks with query invalidation so overlay markers update without a reload.
**Addresses:** FEATURES.md P1 manual-entry forms.

### Phase 4: Multi-Dataset Overlay & Filtering (click/manual path)
**Rationale:** Depends only on Phase 2's GET endpoints — renders correctly against empty tables even before Phase 3 lands. This is the architecturally riskiest slice (new store shape, Y-axis semantics, an open accessibility-mechanism decision) — budget explicit design-review time before writing chart code, not after.
**Delivers:** New sibling store/overlay.ts (multi-select, independent of store/filters.ts); overlay markers on BP Timeline + Pulse Trend only; aria-pressed toggle chips with a bulk "show all/reset" action and a one-line always-visible summary sentence; an accessible list/table extension (ReadingsTable-style) as the authoritative, keyboard/screen-reader-navigable surface for every dataset type, regardless of chart-marker choice.
**Addresses:** FEATURES.md P1 overlay toggle chips; P2 click-to-detail panels.
**Avoids:** No-shared-Y-axis pitfall (labs need their own axis or event-marker treatment; incidents/procedures have no y-value), the accessibilityLayer-exclusion pitfall, and multi-select toggle fatigue (bulk action required — going from "everything on" to "just BP" must be 1 action, not up to 5).
**Open design decision — resolve explicitly, don't default silently:** STACK.md/ARCHITECTURE.md recommend ReferenceLine decoration paired with a mandatory accessible list; PITFALLS.md recommends a real Scatter series bound into accessibilityLayer instead, for native keyboard parity. Pick one deliberately during this phase's design step.

### Phase 5: Overlay Voice Command Extension (stretch — explicit scope decision required)
**Rationale:** Depends on Phase 4's store/overlay.ts existing and requires a genuine agent-schema redesign, not a bolt-on — the existing DashboardCommand schema is closed and single-valued by design; multi-select toggling needs a new toggle_dataset action shape. PROJECT.md scopes v1.1 to click/manual as the primary path with voice as a stretch goal — if this phase slips, that must be an explicit, recorded scope cut, since "every feature operable by voice" is a non-negotiable project constraint, not a preference.
**Delivers:** New toggle_dataset agent action (single dataset + on/off, staying inside the existing closed-Literal discipline); OverlayDelta on AppliedFilters; composeConfirmation() extended with an overlay clause.
**Avoids:** Schema/prompt/resolver drift — prompt.py and the store must be updated in lockstep, or overlay voice commands will silently and permanently classify as unclear.

### Phase 6: Spoken Replies (TTS)
**Rationale:** Functionally independent except for reusing composeConfirmation(); sequence after Phase 1 (needs the "unavailable" copy) and after the overlay clause lands (Phase 4/5) so spoken and visual confirmations don't diverge and aren't touched at the same call sites twice. Real-device-test risk on par with v1.0's Speech Recognition work.
**Delivers:** hooks/useSpeechSynthesis.ts + lib/speech.ts; pause-recognizer-while-speaking coordination (new "speaking" VoiceState); iOS gesture-unlock primed in the mic-tap handler; visibilitychange-driven cancel-on-background; Chrome resume() heartbeat plus a confirmation-length budget/test; persisted, voice-reachable mute toggle.
**Addresses:** FEATURES.md P1 spoken confirmation + mute toggle.
**Avoids:** The TTS/STT feedback loop, iOS Safari gesture/backgrounding quirks, and the Chrome long-utterance cutoff.

### Phase 7: Full Site Guide / Instructions Tab
**Rationale:** No hard technical dependency on anything above, but its content should describe the finished overlay toggles, mute button, and status banner — sequence content last. The rendering-strategy decision must be made before any UI is written, not retrofitted.
**Delivers:** Guide rendered inside the Dashboard component tree (not a useView-swapped surface), so CommandBar/the recognizer stays mounted the whole time; native details/summary disclosure sections (no accordion library); a hardcoded content array reusing EXAMPLE_COMMANDS; a client-side keyword shortcut ("help", "show me the guide") that bypasses /agent entirely and therefore works during the outage.
**Addresses:** FEATURES.md P1 static, voice+keyboard-navigable reference tab.
**Avoids:** Building the guide as a view-swap, which would unmount the voice recognizer the instant the guide opens — exactly backwards for a feature whose whole purpose is teaching hands-free usage.

### Phase 8: Visual Refresh (not covered by this research pass)
**Rationale:** PROJECT.md lists a visual refresh as a fifth active v1.1 target, but none of the four research files (STACK/FEATURES/ARCHITECTURE/PITFALLS) scoped it in — all four frame the milestone as "spoken replies, multi-dataset overlay, guide, agent liveness" only. This is a genuine research gap, not something to silently skip.
**Delivers:** TBD — modernized theme/typography/spacing/color across all screens, accessibility preserved (≥48px targets, ≥18px text, high contrast, keyboard nav per CLAUDE.md).
**Research flag:** Needs a lightweight, targeted research/planning pass of its own before execution — check specifically against this codebase's existing accessibility-floor conventions (e.g., BPTimeline.tsx's documented "ambient decorative tint, exempt from contrast floors" carve-out) so a visual refresh doesn't accidentally regress them.

### Phase Ordering Rationale

- Liveness first because it has zero dependencies, fixes a real bug independent of everything else, and two later phases (TTS, guide) want to consume its output (the "unavailable" state/copy).
- Records backend before its consumers (forms, overlay) is a strict dependency, not a preference — both need the GET/POST endpoints to exist.
- Manual-entry forms and overlay rendering run in parallel — both depend only on the backend, not on each other; overlay renders correctly against empty tables before forms exist.
- Voice extension for overlay is sequenced after and treated as separable because it requires an agent-schema redesign (not a bolt-on) and PROJECT.md itself scopes it as a stretch — this lets the roadmap ship the P1 click/manual overlay experience without blocking on a harder, riskier schema change.
- TTS after liveness and after the overlay confirmation clause so the spoken confirmation covers both new states without revisiting the same call sites twice, and so the Chrome-cutoff risk is evaluated against the final, longest version of composeConfirmation().
- Guide last so its content documents the finished UI, but its scaffolding decision (render-inside-Dashboard, not view-swap) is a Phase 7 design task done before any guide code is written, not an afterthought.
- Visual refresh is placed last and flagged for its own research because it's the one target feature with no grounding in any of the four research files.

### Research Flags

Phases likely needing deeper research during planning:
- Phase 5 (Overlay Voice Command Extension): No source has actually tested whether the required schema shape (single-value toggle_dataset action, or any list-typed alternative) behaves cleanly against the pinned anthropic SDK's structured-outputs constraints — treat as unverified until a spike/test against the real API.
- Phase 8 (Visual Refresh): Entirely unresearched by this pass — needs a dedicated, lighter-weight research or planning pass before execution.
- Phase 4 (Overlay & Filtering), narrowly: The overall architecture pattern is clear and well-sourced, but the specific accessibility-mechanism decision (ReferenceLine + list vs. real Scatter series) is an open disagreement between STACK/ARCHITECTURE and PITFALLS that should get a short, targeted research/verification pass (test accessibilityLayer keyboard traversal with 3+ series toggled, against the pinned Recharts 3.9.x) rather than defaulting silently.

Phases with standard patterns (skip research-phase):
- Phase 1 (Liveness): Extends existing test scaffolding and an already-diagnosed code path directly.
- Phase 2 (Records Backend): Mirrors readings.py exactly — a proven, repeatable pattern in this codebase.
- Phase 3 (Manual-Entry Forms): Standard form + mutation pattern already used elsewhere in the app.
- Phase 6 (Spoken Replies): Native API + an established mirror of the lib/voice.ts pattern — the primary risk is real-device testing effort, not unknown implementation patterns.
- Phase 7 (Guide): Native details/summary + an established view-state pattern, once the render-inside-Dashboard decision is made.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Native browser-API behavior verified against MDN; Anthropic SDK claims verified by reading the installed package source directly (HIGH); Recharts verified via official docs (Context7). iOS Safari specifics are MEDIUM — community sources only, explicitly flagged for real-device testing, same caveat already carried by this project's v1.0 Speech Recognition risk. |
| Features | MEDIUM-HIGH | Accessibility/conversation-design guidance (WCAG, W3C cognitive-accessibility patterns, Alexa/Google design guides) is HIGH — official, current documentation. Claims about how comparable products implement these specific features are MEDIUM/LOW, since no direct competitor exists for a single-user personal health dashboard — patterns are synthesized from adjacent domains (BI dashboards, voice assistants), which is explicitly flagged in FEATURES.md itself. |
| Architecture | HIGH | Grounded directly in this codebase — every recommendation cites the actual file/pattern it extends, not general best practice. The one MEDIUM piece is iOS Safari SpeechSynthesis specifics (same caveat as Stack). |
| Pitfalls | MEDIUM-HIGH | Codebase-specific integration claims (feedback loop, schema mismatch, view-swap unmount) are HIGH — read from actual source, not inferred. External claims (Chromium bug behavior, iOS Safari quirks, Recharts accessibility issue threads) are MEDIUM — multiple independent, consistent community sources, but not always officially confirmed; explicitly flagged for re-verification during implementation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Visual refresh (PROJECT.md's fifth active v1.1 feature) has no dedicated research across any of the four files — flag for a lightweight follow-up research/planning pass before its phase, or confirm the codebase's existing design-token conventions are sufficient to proceed without one.
- Overlay accessibility mechanism is genuinely unresolved between sources: STACK.md/ARCHITECTURE.md recommend ReferenceLine decoration + a mandatory accessible list; PITFALLS.md recommends a real Scatter series bound into accessibilityLayer for native keyboard parity instead. This determines the actual chart-rendering implementation, not just documentation — resolve explicitly during Phase 4 planning.
- Liveness-probe design has two candidate shapes: STACK.md proposes an active count_tokens() probe (MEDIUM confidence it's genuinely free — no single official one-line doc source found, cross-referenced across multiple secondary sources) layered on top of ARCHITECTURE.md's passive-only circuit breaker (zero cost, zero risk, HIGH confidence). PITFALLS.md is more skeptical, noting no confirmed free credit-balance-adjacent endpoint and rating this LOW confidence pending verification. Recommendation: start with the passive-only circuit breaker (Phase 1 as scoped above); treat the active count_tokens() probe as an opt-in enhancement only after confirming its free-tier status directly against current Anthropic docs at implementation time.
- Agent schema multi-select support (Phase 5) is unverified — no source actually tested list-typed or repeated-action structured-outputs behavior against the pinned anthropic SDK version; treat as a spike, not an assumption.
- TTS vs. aria-live double-announcement is an explicit open product decision, not something research resolved. JS cannot reliably detect "is a screen reader running." FEATURES.md flags this directly — the roadmap should surface "does TTS coexist with the existing aria-live confirmation, and how (opt-in vs. default-on, framing of the mute toggle)" as a decision to make explicitly during Phase 6 planning, not something to improvise in code.

## Sources

### Primary (HIGH confidence)
- Direct inspection of this repository — frontend/src/hooks/useVoiceCommand.ts, lib/voice.ts, store/filters.ts, store/view.ts, store/theme.ts, lib/agent.ts, components/CommandBar.tsx, components/FilterBar.tsx, components/ChartDeck.tsx, components/charts/BPTimeline.tsx, api/client.ts, api/types.ts, agent-parity.test.ts; backend/app/agent/schemas.py, agent/service.py, agent/prompt.py, agent/copy.py, routers/agent.py, routers/readings.py, main.py, models.py, tests/test_health.py; .planning/PROJECT.md — ground truth for every architecture and pitfall claim.
- /recharts/recharts (Context7, resolved via official repo docs) — ComposedChart composition, ReferenceLine/ReferenceDot prop shapes, accessibilityLayer keyboard-navigation scope, TooltipContentProps payload model.
- Installed anthropic SDK 0.117.0 source, read directly — _exceptions.py, types/shared/error_type.py, types/shared/billing_error.py — APIStatusError/BillingError/count_tokens existence and shape.
- platform.claude.com/docs (api/errors, build-with-claude/structured-outputs, about-claude/models/overview) — current official error taxonomy, structured-outputs pattern, model pricing.
- MDN — SpeechSynthesis/getVoices/voiceschanged/SpeechRecognition, ARIA Screen Reader Implementors Guide.
- W3C WAI "Provide Help with Directions" (cognitive accessibility), Amazon Alexa Haus error-handling patterns, Google Conversation Design: Errors — official design guidance underlying the Guide and Liveness feature recommendations.
- PyPI JSON API / npm registry (2026-07-07 verification) — package version floors already codified in CLAUDE.md.

### Secondary (MEDIUM confidence)
- weboutloud.io "The State of Speech Synthesis in Safari," Apple Developer Forums, dev.to (nicozerpa), talkrapp.com — iOS/Safari SpeechSynthesis gesture-requirement, background-cancellation, and getVoices() timing quirks; consistent across multiple independent sources but not an official Apple document.
- Chromium issue tracker (#679437, #41294170, #41346274) — long-standing, still-reproducible ~15s/~250-char SpeechSynthesis truncation bug.
- Recharts GitHub wiki + issues (#4809, #6338) — accessibilityLayer scope and keyboard nav-order behavior across multiple series.
- NVDA issue tracker (#7996) — aria-live double-announcement corroboration.
- GitHub issues (anthropics/claude-code#54839, continuedev/continue#5499, BerriAI/litellm#24320) — historical 400 invalid_request_error billing-message reports predating current 402 billing_error docs; flagged as a possible API-generation discrepancy worth defensive coding.

### Tertiary (LOW confidence)
- Socket.dev maintenance-status search for react-speech-kit — corroborates the "don't add a TTS wrapper" recommendation but is a single secondary signal.
- General voice-UX/chatbot-UX blog sources (Bentley UX Center, Aufait UX, Eleken, FuseLab Creative) — used only to corroborate patterns already established by higher-confidence sources, never as standalone claims.
- WebSearch absence-of-evidence claim that Anthropic exposes no free credit-balance endpoint — plausible but explicitly flagged for re-verification against current docs at implementation time.

---
*Research completed: 2026-08-19*
*Ready for roadmap: yes*
