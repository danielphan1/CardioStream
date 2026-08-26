# Requirements: Health Visualizer — Chris's Health Dashboard

**Defined:** 2026-08-19
**Core Value:** Chris can see and explore his own health data entirely by voice — voice interaction is the primary input method, not a gimmick.

## v1.1 Requirements (Polish & Records)

Requirements for the v1.1 milestone. Each maps to a roadmap phase. Continues REQ-ID numbering from v1.0 (archived in `.planning/milestones/v1.0-REQUIREMENTS.md`) with new category prefixes for new feature areas.

### Agent Liveness (LIVE)

- [x] **LIVE-01**: Backend distinguishes "assistant unavailable" from "didn't understand you" — `AgentReply` gets a distinct kind routed from both the no-API-key case and the `call_claude()` exception path (network/timeout/schema-parse failures), replacing today's mislabeling of real outages as generic "unclear"
- [x] **LIVE-02**: Frontend shows a calm, non-alarming "assistant temporarily unavailable" state distinct from the "didn't catch that" state, always paired with "manual controls still work"
- [x] **LIVE-03**: Dashboard checks liveness proactively when the page loads, not only reactively after a failed command, so Chris knows before speaking whether the assistant will respond
- [x] **LIVE-04**: Liveness checks never share `/agent`'s rate limiter and never spend API tokens on their own (passive circuit breaker fed by real traffic, not a self-pinging health check)

### Spoken Replies (TTS)

- [x] **TTS-01**: Dashboard speaks the same confirmation text already shown visually (`composeConfirmation()` output) aloud via Web SpeechSynthesis, on applied voice/agent commands only — never new/different content, never triggered by manual click/keyboard filter changes
- [x] **TTS-02**: Spoken replies are on by default; a prominent, persisted, voice-reachable mute/quiet toggle lets Chris or caregivers turn them off
- [x] **TTS-03**: Only one utterance ever plays at a time — cancel-before-speak, never overlapping or queued
- [x] **TTS-04**: The live voice-recognition session pauses while the dashboard is speaking and resumes after, so the mic never hears its own confirmation as a new command
- [x] **TTS-05**: Spoken replies work on both Chrome/Edge and Safari/iOS, including iOS's gesture-unlock and backgrounding-cancel quirks — verified on a real device

### Multi-Dataset Filtering & Overlay (OVERLAY)

- [x] **OVERLAY-01**: Backend CRUD (GET filtered + POST create) for labs, incidents, and procedures, mirroring the existing readings API, Bearer-gated like every other route
- [x] **OVERLAY-02**: Accessible manual-entry forms for labs, incidents, and procedures (≥48px targets, no drag/precision input) — the tables are otherwise unreachable
- [x] **OVERLAY-03**: Multi-select toggle controls let Chris and caregivers show any combination of BP, pulse, labs, incidents/hospital stays, and procedures at once, by voice or click — independent of which single chart is active
- [x] **OVERLAY-04**: Selected dataset types overlay together on the BP Timeline and Pulse Trend charts (e.g. hospital-stay markers plotted directly on the timeline) rather than living in separate silos; toggle state uses non-color-only encoding (word/icon + `aria-pressed`)
- [x] **OVERLAY-05**: Overlay controls on the two non-timeline charts (BP Categories, AM/PM) visibly indicate they don't apply there, rather than silently doing nothing
- [x] **OVERLAY-06**: An accessible list/table equivalent of every overlaid event exists so keyboard and screen-reader users get full access to overlay data regardless of chart-marker accessibility limits

### Full Site Guide (GUIDE)

- [ ] **GUIDE-01**: A static, always-available guide tab explains every control, filter, chart, and upload flow on the site — for both Chris and caregivers
- [x] **GUIDE-02**: Guide includes a "what can I say" voice-command reference list, reusing the existing centralized command-copy source rather than a second, divergent list
- [ ] **GUIDE-03**: Guide is reachable and usable without unmounting the live voice session (rendered inside the dashboard's component tree, not as a view-swap that would kill the recognizer)
- [ ] **GUIDE-04**: Guide meets the same accessibility bar as the rest of the site (≥48px targets, ≥18px text, high contrast, keyboard + voice navigable)

### Visual Refresh (VISUAL)

- [ ] **VISUAL-01**: Modernized theme, typography, spacing, and color applied consistently across all screens (scope refined by a dedicated research/planning pass at that phase)
- [ ] **VISUAL-02**: Existing accessibility floors (≥48px targets, ≥18px body text, high contrast, keyboard nav) are preserved or improved, never regressed

## v2 Requirements (Deferred)

Acknowledged but not in this milestone's roadmap.

### Agent Activation

- **AGENT-01**: Activate the paid Claude API so the natural-language agent works in production (billing-only, no code change)
- **AGENT-02**: Voice/text data entry via the agent ("log a reading of 120 over 80")

### Guide / Overlay / Liveness enhancements

- **GUIDE-05**: Voice-triggered contextual help ("dashboard, help") reachable mid-task without opening the guide tab — build once the static guide's content is stable and the local intent-matching pattern is proven
- **OVERLAY-07**: Click/focus a marker on the timeline to see full incident/lab/procedure detail in a non-hover panel — validate basic overlay presence/absence with Chris and caregivers first
- **LIVE-05**: Distinguish "not configured" (no API key) from "temporarily failing" (network/rate-limit, may resolve on retry) — defer until the paid API is active and transient failures are actually observable

### Other

- **TTS-06**: Adjustable speech rate/voice picker — defer unless caregiver feedback specifically asks for it
- **GUIDE-06**: Staged/contextual onboarding hints beyond the static guide — defer until the static guide alone proves insufficient

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cross-dataset statistical correlation (e.g. auto-detect "BP spikes near incidents") | Explicitly out of scope per PROJECT.md; clinically risky to imply correlation to a non-clinical user without care-team review — visual co-location only |
| Edit/delete on labs, incidents, procedures records | Create + read only for v1.1; typo-correction editing is a future consideration, not required for launch |
| TTS reading full data tables or long lists aloud | Slow, overwhelming, and inconsistent with the existing short-confirmation design — TTS speaks the confirmation sentence only |
| TTS re-speaking on every store change (mouse/keyboard filter changes) | Would talk over manual caregiver use constantly; speak only on agent-applied/voice-confirmed commands |
| Auto-launching, non-dismissible onboarding tour | Blocks the very controls it explains for a motor-impaired user; the guide is a persistent, always-optional tab instead |
| Alarming "OFFLINE" banner, siren icon, or modal interrupt for agent unavailability | Disproportionate to the actual event (a billing issue, not a health emergency) for a vulnerable-population user; calm neutral messaging instead |
| One combined store field conflating "which chart is active" with "which datasets are overlaid" | `activeChart` stays single-select; overlay visibility is a separate, independent multi-select concern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIVE-01 | Phase 6: Agent Availability (Liveness Detection) | Complete |
| LIVE-02 | Phase 6: Agent Availability (Liveness Detection) | Complete |
| LIVE-03 | Phase 6: Agent Availability (Liveness Detection) | Complete |
| LIVE-04 | Phase 6: Agent Availability (Liveness Detection) | Complete |
| OVERLAY-01 | Phase 7: Records Backend | Complete |
| OVERLAY-02 | Phase 8: Manual-Entry Forms | Complete |
| OVERLAY-03 | Phase 9: Multi-Dataset Overlay & Filtering | Complete |
| OVERLAY-04 | Phase 9: Multi-Dataset Overlay & Filtering | Complete |
| OVERLAY-05 | Phase 9: Multi-Dataset Overlay & Filtering | Complete |
| OVERLAY-06 | Phase 9: Multi-Dataset Overlay & Filtering | Complete |
| TTS-01 | Phase 10: Spoken Replies (TTS) | Complete |
| TTS-02 | Phase 10: Spoken Replies (TTS) | Complete |
| TTS-03 | Phase 10: Spoken Replies (TTS) | Complete |
| TTS-04 | Phase 10: Spoken Replies (TTS) | Complete |
| TTS-05 | Phase 10: Spoken Replies (TTS) | Complete |
| GUIDE-01 | Phase 11: Full Site Guide / Instructions Tab | Pending |
| GUIDE-02 | Phase 11: Full Site Guide / Instructions Tab | Complete |
| GUIDE-03 | Phase 11: Full Site Guide / Instructions Tab | Pending |
| GUIDE-04 | Phase 11: Full Site Guide / Instructions Tab | Pending |
| VISUAL-01 | Phase 12: Visual Refresh | Pending |
| VISUAL-02 | Phase 12: Visual Refresh | Pending |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-19*
*Last updated: 2026-08-20 — traceability populated by roadmap creation (Phases 6–12, 100% coverage)*
