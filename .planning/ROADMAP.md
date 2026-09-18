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
| 13. Visual Redesign (Nautical) | v1.1 | 12/12 | Complete    | 2026-09-04 |
| 14. Show Panel & Combined Timeline | v1.1 | 6/6 | Complete    | 2026-09-12 |
| 15. Unified Filter Surface | v1.2 | 8/8 | Complete    | 2026-09-17 |
| 16. Trend Clarity & Chart Polish | v1.2 | 0/3 | Planned, ready to execute | — |
| 17. Analytical Views | v1.2 | 0/0 | Not planned | — |
| 18. Deep Query | v1.2 | 0/0 | Not planned | — |
| 19. Guest Demo Mode | v1.2 | 7/7 | Complete   | 2026-09-16 |

### Phase 13: Visual Redesign — Nautical Minimalist Theme

**Goal:** Every screen gets a completely new visual identity — a clean, minimalist nautical/ocean world replacing today's design system outright — with zero regression to existing functionality or the accessibility floor.
**Requirements**: TBD (no active REQUIREMENTS.md yet — between milestones; decision IDs D-01 through D-09 from `13-CONTEXT.md` are the requirement source instead — see plan `requirements` frontmatter)
**Depends on:** Phase 12
**Plans:** 12/12 plans complete
**UI hint**: yes
Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Design tokens (index.css full replacement) + WCAG contrast regression test (wave 1)
- [x] 13-02-PLAN.md — Font migration: install/import Inter + Space Grotesk behind a package-legitimacy checkpoint (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-03-PLAN.md — Header + GuideOverlay re-skin, close the 48px gap on 4 utility buttons (wave 2)
- [x] 13-04-PLAN.md — App.tsx + CommandBar re-skin: new dark "feature panel" identity for the Command Bar (wave 2)
- [x] 13-05-PLAN.md — FilterBar + OverlayToggle + DateRangePicker re-skin (wave 2)
- [x] 13-06-PLAN.md — ReadingsTable + OverlayEventsList re-skin (wave 2)
- [x] 13-07-PLAN.md — BPTimeline + ChartTooltip + CategoryBars + AmPmComparison + ChartDeck re-skin (wave 2)
- [x] 13-08-PLAN.md — UploadPage + AgentStatusBanner re-skin (wave 2)
- [x] 13-09-PLAN.md — AddRecordPage + records/* field-sets re-skin (wave 2)
- [x] 13-10-PLAN.md — EmptyState + LoginGate re-skin (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-11-PLAN.md — New StatsSparkline component + StatsStrip rewired to icon+value+sparkline+status-pill card language (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 13-12-PLAN.md — Full-site automated regression sweep + human cross-screen/cross-theme checkpoint (wave 4)

### Phase 14: Unified Show Panel and Combined Timeline

**Goal:** Chris can turn any dataset on or off independently — by voice or by checkbox — and see any combination on one chart, including blood pressure and pulse together and events on their own.
**Requirements**: Client change request (Chris, 2026-09-12); decision IDs D-01 through D-10 in `14-CONTEXT.md` are the requirement source. Reverses Phase 9's "no combined-metric chart" lock.
**Depends on:** Phase 13
**Plans:** 6/6 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — `--line-pulse` token both themes + first contrast coverage for vitals line colours (wave 1)
- [x] 14-02-PLAN.md — store/filters.ts: `visibleDatasets` + `chartView` with v1→v2 persistence migration (wave 1)
- [x] 14-03-PLAN.md — backend agent: five dataset tokens + new `show_only` action (wave 1)

**Wave 2** *(blocked on Wave 1)*

- [x] 14-04-PLAN.md — ShowPanel + ChartViewSwitcher + EventTimelineList; OverlayToggle deleted (wave 2)
- [x] 14-05-PLAN.md — CombinedTimeline dual-axis chart; BPTimeline + PulseTrend retired (wave 2)

**Wave 3** *(blocked on Wave 2)*

- [x] 14-06-PLAN.md — ChartDeck view router, App wiring, agent mirror, voice vocabulary + guide (wave 3)

### Phase 15: Unified Filter Surface — multi-select checkboxes, pulse category, time of day

**Goal:** Chris can combine filters instead of picking one — "Stage 1 **and** Stage 2", "mornings **and** evenings" — through the same checkbox control model the Show panel already uses, plus two filters whose data already exists but has never been reachable.
**Requirements**: Client-driven request (2026-09-13). Direct continuation of Phase 14, whose `14-CONTEXT.md` named the root cause as *"the dashboard runs two different control models side by side"* — Phase 14 converted the five datasets to real checkboxes but left FilterBar as single-select `aria-pressed` buttons. This finishes that job.
**Depends on:** Phase 14
**Plans:** 8/8 plans complete
**UI hint**: yes

Scope:

- FilterBar AM/PM + BP category → **multi-select checkboxes** matching ShowPanel's control language.
  Date presets deliberately stay exclusive buttons: a range cannot be "7 days AND 90 days", so a
  checkbox there would promise a combination the data model cannot honour.
- **New filter — pulse category** (Bradycardia / Normal / Tachycardia). Already in `models.py`,
  computed by `derivations.classify_pulse()`, covered by `test_derivations.py` — and reachable by
  exactly zero UI controls today. Pairs with the 60 bpm reference line the timeline already draws.
- **New filter — time of day** finer than AM/PM (morning / afternoon / evening / night), derived
  from the stored `datetime_` at query time. No schema change, no ETL change.

**Key functional unlock:** single-select makes "Stage 1 AND Stage 2" — the clinically natural query
for hypertension management — literally inexpressible today. This is a capability gain, not a
click-convenience change.

**Primary risk — cross-stack, NOT a UI swap.** Touches: `store/filters.ts` (`amPm` and `bpCategory`
become multi-valued), a **v2→v3 localStorage persistence migration** (the existing v1→v2 migration is
the precedent to follow), `backend/app/deps.py` `ReadingFilters` (`Literal` → list, `IN` clause),
`backend/app/agent/schemas.py` (`bp_category` token is single-valued; `BP_TOKEN_TO_LABEL`), and
`lib/agent.ts` `composeConfirmation` (the spoken echo must describe multiple selections grammatically —
"Showing Stage 1 and Stage 2 readings", not a list dump).

**Constraints:** every filter stays operable by voice (CLAUDE.md core value); ≥48px targets, ≥18px
text, no drag or hover-only interactions.

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — Backend ReadingFilters: bp_category IN-clause + pulse_category + time_of_day (query-time predicate), am_pm filter removed (wave 1)
- [x] 15-02-PLAN.md — Backend agent schema/service/prompt: list-typed bp_category/pulse_category/time_of_day + sibling *_all clear flags, am_pm retired (wave 1)
- [x] 15-03-PLAN.md — Frontend contracts: PulseCategory/TimeOfDayBucket types, Pulse Category palette, getJson multi-value params, list-aware resolveFilters (wave 1)

**Wave 2** *(blocked on Wave 1 completion — 15-04 depends on 15-03)*

- [x] 15-04-PLAN.md — store/filters.ts: v3 shape (bpCategory/pulseCategory/timeOfDay maps, amPm dropped) + v2→v3 migration + toggle/set action pairs (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 15-05-PLAN.md — FilterBar.tsx converted to 4-group checkbox surface (Time of Day, BP Category, Pulse Category) + new FilterBar.test.tsx (wave 3)
- [x] 15-06-PLAN.md — lib/agent.ts: applyAgentFilters + composeConfirmation multi-select grammar (wave 3)
- [x] 15-07-PLAN.md — EmptyState/App.tsx/useStats.ts wiring + Guide "What Can I Say" copy correction (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 15-08-PLAN.md — Frontend test-fixture sync (ChartDeck/CommandBar/useVoiceCommand/ShowPanel tests) + lib/agent-parity.test.ts rewrite (wave 4)

### Phase 16: Trend Clarity and Chart Polish

**Goal:** Chris can see which *direction* his health is moving, not just where each reading landed. No new chart types — this improves what already exists.
**Requirements**: Client-driven request (2026-09-13), "better data visuals".
**Depends on:** Phase 15
**Plans:** 0/3 plans
**UI hint**: yes

Scope:

- **Rolling average** (7-day or similar) drawn over the combined timeline's raw points. "All data" plots
  ~1,500 individual dots, and day-to-day blood pressure is noisy enough that the trend is invisible in
  them. *"Am I getting better or worse"* is the question this dashboard exists to answer and cannot
  answer today.
- **Readability pass** on `CombinedTimeline`, `CategoryBars`, `AmPmComparison` — density, labelling,
  colour, and axis legibility.

Per CLAUDE.md's impeccable + GSD convention: run an `impeccable` critique pass to inform the work, then
let a GSD command execute and commit. `impeccable` never edits files itself.

**Note:** the rolling average is a *derived medical-adjacent value*. Per CLAUDE.md's Quality constraint,
the window arithmetic needs unit tests — including how it handles gaps in the series, which this dataset
has (readings are not daily).

Plans:
**Wave 1**

- [ ] 16-01-PLAN.md — rollingAverage() window function + unit tests + dimmed-line contrast regression (wave 1)
- [ ] 16-02-PLAN.md — CategoryBars + AmPmComparison responsive readability fixes (wave 1)

**Wave 2** *(blocked on Wave 1 — 16-03 depends on 16-01)*

- [ ] 16-03-PLAN.md — CombinedTimeline trend lines, conditional raw-line dimming, caption, tests (wave 2)

### Phase 17: Analytical Views — BP heatmap and event correlation

**Goal:** Surface patterns a time-series line structurally cannot show — routine-driven daily rhythms, and what the vitals actually did around a hospital stay.
**Requirements**: Client-driven request (2026-09-13), "better data visuals".
**Depends on:** Phase 16 (and Phase 15 for the time-of-day buckets the heatmap reuses)
**Plans:** 0 plans
**UI hint**: yes

Scope:

- **Weekday × time-of-day heatmap** of average BP. Reuses Phase 15's time-of-day buckets rather than
  inventing a second definition. Surfaces routine-driven patterns — consistently high weekday evenings,
  say — that a chronological line cannot expose no matter how it is styled.
- **Event-correlation view**: vitals in a window before and after an incident or procedure. Today an
  incident renders as a single ▲ marker on a date, and the dashboard never connects it to what the
  vitals were doing around it — arguably the most clinically interesting question in the dataset.

**Both are new chart types** and want their own UI-SPEC design contract before planning.

**Accessibility risk, non-negotiable:** a heatmap is the hardest chart type to make non-visual. Colour
alone cannot carry the value (CLAUDE.md bans colour-only signalling), every cell must be keyboard
reachable, and the whole view must be reachable and interpretable by voice. If it cannot meet that bar,
it should not ship — design the accessible version first, not as a retrofit.

Plans:
- [ ] TBD (run /gsd-ui-phase 17 for the design contract, then /gsd-plan-phase 17)

### Phase 18: Deep Query — value thresholds and notes search

**Goal:** Filter by reading value and by what was written in the notes, without breaking the accessibility floor.
**Requirements**: Client-driven request (2026-09-13), "more filtering options".
**Depends on:** Phase 17; **and see the external dependency below**
**Plans:** 0 plans
**UI hint**: yes

Scope:

- **Value thresholds as PRESET CUT-POINTS, shipped as checkboxes** — "above 140", "above 180",
  "below 90". Deliberately **not** free numeric entry. A number input fails the accessibility floor
  twice over: it is a small precise target for a user with no reliable hand mobility, and spoken
  numbers mis-transcribe ("one forty" vs "140") on exactly the input path that matters most. Preset
  cut-points keep the checkbox affordance, stay clinically meaningful, and speak naturally —
  "show me readings above 140".
- **Notes / symptom text search** across the `notes` field, which renders today but cannot be
  searched or filtered.

**EXTERNAL DEPENDENCY — the reason this phase is sequenced last.** The genuinely useful version of
notes search is voice-driven ("show me readings where I noted dizziness"), which routes through the
agent. The agent is **inert in production** (AGENT-01, $0 Anthropic balance, live eval 4/35). Built
before that is funded, notes search is a caregiver-only feature Chris cannot reach by voice — which
inverts the product's core value rather than serving it. **Fund the API before starting this phase**,
or accept that half of it ships unusable by its primary user.

Plans:
- [ ] TBD (run /gsd-ui-phase 18 for the design contract, then /gsd-plan-phase 18)

### Phase 19: Guest Demo Mode

**Goal:** A visitor to the portfolio project can log into a separate, isolated demo deployment with a
guest username+password (distinct from Chris's real shared-password gate), explore the dashboard against
synthetic seed data by click or voice, and cannot write to it — the 4 mutating routes (upload, labs,
incidents, procedures) reject guest tokens with a friendly 403; all GET routes and the /agent
voice-command endpoint stay fully usable.
**Requirements**: Client-driven request (2026-09-15), "add a working demo version that people who are
viewing can use".
**Depends on:** Phase 5 (the shared-password auth gate this layers onto) — no dependency on Phases 6-18.
**Plans:** 7/7 plans complete
**Status:** COMPLETE — live demo verified at https://health-dashboard-demo.vercel.app (2026-09-16, full
detail in `19-HUMAN-UAT.md`).

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Backend Settings.site_username + reject_if_demo dependency + /auth username compare + /health demo field (wave 1)
- [x] 19-03-PLAN.md — Synthetic labs/incidents/procedures data generator + committed fixture (wave 1)
- [x] 19-05-PLAN.md — Frontend HealthStatus.demo + postAuth(username) contract (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02-PLAN.md — Wire reject_if_demo onto the 4 write routes + test_demo_guard.py (wave 2)
- [x] 19-04-PLAN.md — seed_records() + boot-time auto-seed gate in start.sh + .env.example (wave 2)
- [x] 19-06-PLAN.md — LoginGate guest-username field + Header demo badge/hidden write buttons (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-07-PLAN.md — DEPLOY.md literal second-deployment instructions + README pointer (wave 3)
