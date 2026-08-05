# Roadmap: Health Visualizer — Chris's Health Dashboard

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-08-05) — full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 📋 **v2** — Activate the paid Claude API + agent hardening + post-MVP views (planned)

## Phases

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

### 📋 v2 (Planned)

- [ ] **Activate paid Claude API** — add billing/credits so the natural-language agent actually works in production (billing-only; the pipeline is already built & verified). See [03-HUMAN-UAT.md](phases/03-agent-via-text-input/03-HUMAN-UAT.md).
- [ ] **Make the failure visible** — have `/health` actually ping Claude, and surface a distinct "assistant temporarily unavailable" state instead of silently degrading every command to `unclear`.
- [ ] **Post-MVP views** (from PROJECT.md → Out of Scope): spoken replies (SpeechSynthesis), data entry by voice, and the labs / incidents / procedures views.

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Data Foundation | v1.0 | 8/8 | Complete | 2026-07-13 |
| 2. Read API & Dashboard | v1.0 | 7/7 | Complete | 2026-07-17 |
| 3. Agent via Text Input | v1.0 | 4/4 | Complete (agent billing-gated → v2) | 2026-07-20 |
| 4. Voice Capture | v1.0 | 3/3 | Complete | 2026-07-21 |
| 5. Upload, Auth Gate & Deployment | v1.0 | 7/7 | Complete | 2026-08-05 |
