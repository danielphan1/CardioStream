# Roadmap: Health Visualizer — Chris's Health Dashboard

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-08-05) — full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Polish & Records** — Phases 6–12 (in progress)
- 📋 **v2** — Activate paid Claude API + agent-parsed data entry + other deferred enhancements (planned)

## Phases

**Phase Numbering:**

- Integer phases: planned milestone work, numbered continuously across milestones (v1.0 used 1–5; v1.1 continues at 6)
- Decimal phases (6.1, 6.2, …): urgent insertions, if any, execute between their surrounding integers

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-08-05</summary>

- [x] **Phase 1: Data Foundation** (8/8 plans) — completed 2026-07-13
- [x] **Phase 2: Read API & Dashboard** (7/7 plans) — completed 2026-07-17
- [x] **Phase 3: Agent via Text Input** (4/4 plans) — completed 2026-07-20 · ⚠️ agent built & verified in code, but **inert in prod (no API credits → v2)**
- [x] **Phase 4: Voice Capture** (3/3 plans) — completed 2026-07-21
- [x] **Phase 5: Upload, Auth Gate & Deployment** (7/7 plans) — completed 2026-08-05

Full phase goals, dependencies, and plan lists archived in
[milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

### 🚧 v1.1 Polish & Records (In Progress)

**Milestone Goal:** Make the shipped MVP more complete and more usable without the paid API — close the voice loop with spoken replies, let Chris and caregivers mix and match datasets on one overlaid view, surface the records the schema already anticipates, teach the whole site through a built-in guide, refresh the visuals, and make agent unavailability honest instead of silently mislabeled.

- [x] **Phase 6: Agent Availability (Liveness Detection)** - Real "assistant unavailable" detection replaces silent mislabeling as "didn't catch that" (completed 2026-08-20)
- [x] **Phase 7: Records Backend** - CRUD API for labs, incidents, and procedures, mirroring the existing readings API (completed 2026-08-20)
- [x] **Phase 8: Manual-Entry Forms** - Accessible forms so caregivers can populate labs/incidents/procedures (completed 2026-08-21)
- [ ] **Phase 9: Multi-Dataset Overlay & Filtering** - Toggle and overlay any combination of BP/pulse/labs/incidents/procedures, by voice or click
- [ ] **Phase 10: Spoken Replies (TTS)** - Dashboard speaks its confirmations aloud, closing the hands-free loop
- [ ] **Phase 11: Full Site Guide** - Accessible, voice-navigable walkthrough of every control, chart, and flow
- [ ] **Phase 12: Visual Refresh** - Modernized theme/typography/spacing/color, accessibility preserved

## Phase Details

### Phase 6: Agent Availability (Liveness Detection)

**Goal**: Chris and caregivers always know — before speaking — whether the voice assistant will actually respond, replacing today's silent mislabeling of real outages as "didn't catch that."
**Depends on**: Nothing new (extends v1.0's existing `/agent` and `/health` infrastructure from Phase 3/5)
**Requirements**: LIVE-01, LIVE-02, LIVE-03, LIVE-04
**Success Criteria** (what must be TRUE):

  1. When the backend can't reach Claude (missing key, or every call failing), the UI shows a calm "assistant temporarily unavailable" message distinct from "didn't catch that," always paired with "manual controls still work."
  2. The dashboard checks assistant availability automatically when the page loads, so Chris knows before speaking whether the assistant will respond.
  3. Liveness checks never spend Claude API tokens and never share `/agent`'s rate limiter — checking status is free and never blocks real commands.
  4. A caregiver can tell "assistant is down" apart from "assistant didn't understand that" from the message text alone.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Backend circuit breaker + AgentReply.kind/health wire contract (LIVE-01, LIVE-04)
- [x] 06-02-PLAN.md — Frontend liveness surface: agentStatus store, useHealth poll, AgentStatusBanner (LIVE-02, LIVE-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-03-PLAN.md — CommandBar/useVoiceCommand reactive wiring, closes switch-exhaustiveness gap (LIVE-01, D-07)

**UI hint**: yes

### Phase 7: Records Backend (Labs / Incidents / Procedures CRUD)

**Goal**: The labs, incidents, and procedures tables the schema already anticipates become reachable through the API, giving the forms and overlay phases something to build on.
**Depends on**: Nothing new (extends v1.0's existing schema/migrations — tables exist, currently empty)
**Requirements**: OVERLAY-01
**Success Criteria** (what must be TRUE):

  1. A new lab result, incident, or procedure record can be created via the API and is stored correctly.
  2. Labs, incidents, and procedures can each be fetched filtered by date range, mirroring how readings are already fetched.
  3. Every new route rejects unauthenticated requests, Bearer-gated like every other route.

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Records contracts (deps.py filters + schemas.py Out/Create) and labs/incidents/procedures routers, Bearer-gated (OVERLAY-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — Test coverage: GET date-range filters, POST create, serialization, and 401 gating for all 3 resources (OVERLAY-01)

### Phase 8: Manual-Entry Forms

**Goal**: Caregivers can populate labs, incidents, and procedures themselves, through accessible forms, instead of those tables staying permanently empty.
**Depends on**: Phase 7 (needs the POST endpoints)
**Requirements**: OVERLAY-02
**Success Criteria** (what must be TRUE):

  1. A caregiver can submit a new lab result through a form with ≥48px targets and no drag/precision interactions.
  2. A caregiver can submit a new incident (e.g. passing out, hospitalization) through an accessible form.
  3. A caregiver can submit a new procedure through an accessible form.
  4. A submitted record shows up in the data immediately, without a page reload.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 08-01-PLAN.md — Records API contracts, date primitives, and creation hooks (OVERLAY-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — Lab/Incident/Procedure field-set components (OVERLAY-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03-PLAN.md — AddRecordPage container + Header/App navigation wiring (OVERLAY-02)

**UI hint**: yes

### Phase 9: Multi-Dataset Overlay & Filtering

**Goal**: Chris and caregivers can mix and match which data types they're looking at — by voice or click — and see them overlaid together on one timeline instead of living in separate silos.
**Depends on**: Phase 7 (GET endpoints); Phase 8 recommended complete first so overlay can be verified against real entered data, not just empty tables
**Requirements**: OVERLAY-03, OVERLAY-04, OVERLAY-05, OVERLAY-06
**Success Criteria** (what must be TRUE):

  1. Chris can toggle any combination of BP, pulse, labs, incidents, and procedures on or off by voice command.
  2. A caregiver can toggle the same combinations by click, with pressed/not-pressed state shown by word or icon, never color alone.
  3. Selected dataset types appear overlaid together on the BP Timeline and Pulse Trend charts (e.g. a hospital-stay marker plotted directly on the BP timeline).
  4. On the BP Categories and AM/PM charts, overlay controls visibly indicate they don't apply there, instead of silently doing nothing.
  5. Every overlaid event is also available in an accessible list/table, so keyboard and screen-reader users get full access regardless of chart-marker limits.

**Plans**: TBD
**UI hint**: yes

> **Note (folded from research):** research/SUMMARY.md proposed splitting click-based overlay rendering and voice-driven toggle control into two phases (with voice framed as a stretch goal). That framing is reconciled here: PROJECT.md's non-negotiable "every feature operable by voice" constraint and REQUIREMENTS.md's OVERLAY-03 text ("by voice or click") place voice-toggle support in v1.1 scope, not v2 — so both interaction modes are delivered together in this phase. The underlying risk the research flagged (the agent's `DashboardCommand` schema needs a new `toggle_dataset` action shape, not a bolt-on) still applies and should be treated as this phase's hardest design decision, resolved explicitly during `/gsd-plan-phase 9`, not defaulted silently. The accessibility-mechanism choice for overlay markers (ReferenceLine+list vs. a real Scatter series bound into `accessibilityLayer`) is a second open decision flagged by research for the same phase.

### Phase 10: Spoken Replies (TTS)

**Goal**: The dashboard speaks its confirmation aloud, closing the hands-free loop so Chris doesn't need to look at the screen to know a command worked.
**Depends on**: Phase 6 (needs the "unavailable" copy to speak), Phase 9 (needs the final overlay confirmation clause so spoken and visual replies don't diverge)
**Requirements**: TTS-01, TTS-02, TTS-03, TTS-04, TTS-05
**Success Criteria** (what must be TRUE):

  1. After a voice/agent command, the dashboard speaks the same confirmation text shown on screen; manual click/keyboard filter changes never trigger speech.
  2. Spoken replies are on by default; Chris or a caregiver can reach a mute/quiet toggle by voice or click, and the setting persists across sessions.
  3. Only one utterance ever plays at a time — a new confirmation cancels and replaces any reply still speaking.
  4. The mic pauses listening while the dashboard is speaking and resumes right after, so the assistant never mishears its own voice as a new command.
  5. Spoken replies work correctly on both Chrome/Edge and Safari/iOS, verified on a real device.

**Plans**: TBD
**UI hint**: yes

### Phase 11: Full Site Guide / Instructions Tab

**Goal**: Chris and his caregivers can learn how to use every part of the site — including what to say by voice — from a built-in guide, without interrupting a live voice session to do it.
**Depends on**: Phase 9, Phase 10 (documents the finished overlay controls and mute toggle)
**Requirements**: GUIDE-01, GUIDE-02, GUIDE-03, GUIDE-04
**Success Criteria** (what must be TRUE):

  1. A static guide screen explains every control, filter, chart, and upload flow on the site.
  2. The guide includes a "what can I say" voice-command reference that stays in sync with the app's real command vocabulary (one source, not a second divergent list).
  3. Opening the guide never interrupts or unmounts an active voice session — Chris can reach and navigate the guide by voice mid-session.
  4. The guide meets the same accessibility bar as the rest of the site (≥48px targets, ≥18px text, high contrast, keyboard + voice navigable).

**Plans**: TBD
**UI hint**: yes

### Phase 12: Visual Refresh

**Goal**: The whole site looks modern and cohesive — updated theme, typography, spacing, and color — without losing any accessibility ground.
**Depends on**: Phase 11 (refreshes the finished UI, including the new guide)
**Requirements**: VISUAL-01, VISUAL-02
**Success Criteria** (what must be TRUE):

  1. Every screen (dashboard, upload, guide, forms) reflects a consistent, modernized theme — typography, spacing, and color.
  2. All existing accessibility floors (≥48px targets, ≥18px body text, high contrast, keyboard navigation) are verified intact or improved after the refresh, with no regressions.

**Plans**: TBD
**UI hint**: yes

> **Research flag:** Unlike Phases 6–11, this phase was not scoped by any of the four v1.1 research files (STACK/FEATURES/ARCHITECTURE/PITFALLS) — it is a genuine research gap. Run a lightweight, targeted research/planning pass before executing this phase, checked specifically against this codebase's existing accessibility-floor conventions (e.g. BPTimeline.tsx's documented "ambient decorative tint, exempt from contrast floors" carve-out) so the refresh doesn't accidentally regress them.

### 📋 v2 (Planned)

Deferred items acknowledged but not in the v1.1 roadmap (see REQUIREMENTS.md → v2 Requirements for full detail):

- [ ] **AGENT-01**: Activate the paid Claude API so the natural-language agent works in production (billing-only, no code change)
- [ ] **AGENT-02**: Voice/text data entry via the agent ("log a reading of 120 over 80")
- [ ] **GUIDE-05**: Voice-triggered contextual help ("dashboard, help") reachable mid-task without opening the guide tab
- [ ] **OVERLAY-07**: Click/focus a marker on the timeline to see full incident/lab/procedure detail in a non-hover panel
- [ ] **LIVE-05**: Distinguish "not configured" from "temporarily failing" — defer until the paid API is active and transient failures are observable
- [ ] **TTS-06**: Adjustable speech rate/voice picker
- [ ] **GUIDE-06**: Staged/contextual onboarding hints beyond the static guide

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 8/8 | Complete | 2026-07-13 |
| 2. Read API & Dashboard | v1.0 | 7/7 | Complete | 2026-07-17 |
| 3. Agent via Text Input | v1.0 | 4/4 | Complete (agent billing-gated → v2) | 2026-07-20 |
| 4. Voice Capture | v1.0 | 3/3 | Complete | 2026-07-21 |
| 5. Upload, Auth Gate & Deployment | v1.0 | 7/7 | Complete | 2026-08-05 |
| 6. Agent Availability (Liveness) | v1.1 | 3/3 | Complete    | 2026-08-20 |
| 7. Records Backend | v1.1 | 2/2 | Complete    | 2026-08-20 |
| 8. Manual-Entry Forms | v1.1 | 3/3 | Complete    | 2026-08-21 |
| 9. Multi-Dataset Overlay & Filtering | v1.1 | 0/TBD | Not started | - |
| 10. Spoken Replies (TTS) | v1.1 | 0/TBD | Not started | - |
| 11. Full Site Guide | v1.1 | 0/TBD | Not started | - |
| 12. Visual Refresh | v1.1 | 0/TBD | Not started | - |
