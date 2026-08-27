# Roadmap: Health Visualizer — Chris's Health Dashboard

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-08-05) — full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Polish & Records** — Phases 6–12 (shipped 2026-08-27) — full detail: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
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

<details>
<summary>✅ v1.1 Polish & Records (Phases 6–12) — SHIPPED 2026-08-27</summary>

- [x] **Phase 6: Agent Availability (Liveness Detection)** (3/3 plans) — completed 2026-08-20
- [x] **Phase 7: Records Backend** (2/2 plans) — completed 2026-08-20
- [x] **Phase 8: Manual-Entry Forms** (3/3 plans) — completed 2026-08-21
- [x] **Phase 9: Multi-Dataset Overlay & Filtering** (7/7 plans) — completed 2026-08-22
- [x] **Phase 10: Spoken Replies (TTS)** (6/6 plans) — completed 2026-08-25
- [x] **Phase 11: Full Site Guide** (5/5 plans) — completed 2026-08-26
- [x] **Phase 12: Visual Refresh** (8/8 plans) — completed 2026-08-27

Full phase goals, dependencies, and plan lists archived in
[milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

</details>

## Phase Details

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
| 9. Multi-Dataset Overlay & Filtering | v1.1 | 7/7 | Complete    | 2026-08-22 |
| 10. Spoken Replies (TTS) | v1.1 | 6/6 | Complete    | 2026-08-25 |
| 11. Full Site Guide | v1.1 | 5/5 | Complete    | 2026-08-26 |
| 12. Visual Refresh | v1.1 | 8/8 | Complete    | 2026-08-27 |
