# Health Visualizer — Chris's Health Dashboard

## What This Is

A personal health data dashboard website for a single user: Chris, a C4 quadriplegic individual (wheelchair user since 1997, limited/no hand mobility) who has been tracking blood pressure, pulse, and other health metrics since early 2025. It replaces an earlier Tableau Public prototype with a voice-controlled web app: Chris asks for views of his data hands-free ("show me my blood pressure for the last 30 days, mornings only") and the dashboard responds. His wife/caregivers also use the site to enter new data.

This is also a portfolio project for the builder, demonstrating data engineering, software engineering, and applied AI on a consistent Python + React stack.

## Core Value

Chris can see and explore his own health data entirely by voice — voice interaction is the primary input method, not a gimmick. Every feature must be operable by voice; mouse/keyboard is the fallback, not the default.

## Milestone History

<details>
<summary>✅ v1.0 MVP — SHIPPED 2026-08-05 (Phases 1–5)</summary>

**Goal:** Replace the Tableau Public prototype with a voice-controlled dashboard: ETL foundation, four-chart dashboard with manual filters, Claude agent via text input, continuous-listening voice capture, caregiver upload + shared-password gate, deployed to Vercel + Railway.

**Shipped, with one known limitation carried to v2:** the natural-language agent is built and verified in code but inert in production (Anthropic account has $0 credits, every `/agent` call degrades to `unclear`) — billing-only fix, deferred by user decision.

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Polish & Records — SHIPPED 2026-08-27 (Phases 6–12)</summary>

**Goal:** Make the shipped MVP more complete and more usable without needing the paid API — close the voice loop with spoken replies, let Chris and caregivers mix and match which data they're looking at, surface the health records the schema already anticipates, teach the whole site through a built-in guide, refresh the visuals, and turn the silent agent outage into an honest "unavailable" state.

**Shipped:** agent-liveness detection (real "unavailable" state, zero added token cost), labs/incidents/procedures CRUD + accessible manual-entry forms, multi-dataset overlay & filtering (voice + click, with an accessible list twin), spoken replies (TTS) verified on real Chrome/Edge/Safari/iOS hardware, a full-screen voice-navigable site guide with a single-sourced command vocabulary, and a sitewide visual refresh with zero accessibility-floor regression (git-diff-verified, not just self-reported).

**Explicitly NOT in v1.1** (unchanged, still deferred to v2): activating the paid Claude API, and voice/text data-entry via the agent.

Full detail: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

## Next Milestone

Not yet scoped. Run `/gsd-new-milestone` to define v2 (or whatever comes next) — candidate scope already acknowledged in Requirements → Deferred below and in ROADMAP.md's v2 placeholder section.

## Requirements

### Validated

- [x] ETL pipeline ingests OMRON Excel exports, computes derived fields, loads idempotently — Validated in Phase 1: Data Foundation (real export format verified 2026-07-14; SQLite locally, same SQLAlchemy models target Postgres in prod)
- [x] Database seeded with the existing 132 real readings (Feb 22 – Jun 13, 2025) — Validated in Phase 1: seed added=132, re-run 0/132 unchanged; golden-master diff waived (reference CSV does not exist), derived fields covered by 83-test boundary suite
- [x] Claude-powered `/agent` endpoint: text → structured-outputs command → Pydantic-validated JSON → dashboard filter updates — Validated in Phase 3 at the **code level** (constraint-free Literal schema, server-side symbolic date resolution, triple never-500 backstop, rate-limited + auth-gated route, key backend-only per SEC-02). ⚠️ Live-model accuracy **NOT** validated — the deployed agent is inert on $0 API credits (every call 400s → `unclear`; live eval 4/35). → v2 (see 03-HUMAN-UAT.md)
- [x] Text input box (CommandBar) as the voice fallback surface — Validated in Phase 3: full idle/working/confirmed/clarify/error state machine, aria-live confirmation, ≥48px targets, drives the same filter store voice will reuse in Phase 4
- [x] FastAPI endpoints — readings (filterable), summary stats, file upload, agent — v1.0 (Phases 2/3/5); every route Bearer-gated
- [x] React dashboard replicating the four Tableau charts (BP Timeline, Pulse Trend, BP Categories, AM vs PM) — v1.0 (Phase 2)
- [x] Accessibility: ≥48px targets, high contrast, ≥18px body text, keyboard navigable, no drag/hover-only/precision interactions — v1.0
- [x] Simple shared-password gate before public deployment — v1.0 (Phase 5: signed Bearer token, 401 on every route)
- [x] Deployed: Vercel (frontend) + Railway (backend + private Postgres) — v1.0 (Phase 5); SEC-03 verified private (no trackers, private DB, clean logs)
- [⚠️] Voice/text control (mic/text → transcript → Claude agent → validated JSON → dashboard) — BUILT and verified at the code + deterministic-test level (Phases 3–4), but **NOT validated end-to-end in production: the Anthropic account has $0 credits, so every `/agent` call degrades to `unclear`.** → v2
- [x] Agent availability made visible — real liveness detection; backend passive circuit breaker + `/health.agent_reachable`, frontend `AgentStatusBanner` (proactive on load, reactive on every reply) — Validated in Phase 6: Agent Availability (Liveness Detection) (4/4 roadmap success criteria, 216 backend + 195 frontend tests; the subjective "calm, non-alarming" visual check passed human confirmation 2026-08-25, see `06-HUMAN-UAT.md`)
- [x] Records backend (labs/incidents/procedures CRUD) — Bearer-gated GET (filtered) + POST (create) for all three resources, mirroring the `/readings` pattern — Validated in Phase 7: Records Backend (249 backend tests, OVERLAY-01)
- [x] Manual-entry forms — caregivers can submit a lab result, incident, or procedure through an accessible form (≥48px targets, no drag/precision input, immediate confirmation without reload) — Validated in Phase 8: Manual-Entry Forms (OVERLAY-02; 4/4 roadmap success criteria; code review found 1 critical + 3 warning issues, all fixed same-session — see `08-REVIEW-FIX.md`; the critical fix (async submit race) is concurrency-sensitive and has a manual spot-check pending, tracked in STATE.md Blockers/Concerns)
- [x] Multi-dataset filtering & overlay — toggle any combination of BP / pulse / labs / incidents / procedures on or off (voice or click); selected types overlay together on one dashboard view — Validated in Phase 9: Multi-Dataset Overlay & Filtering (OVERLAY-03/04/05/06; 5/5 roadmap success criteria; initial verification found 2 BLOCKER gaps — stale toggle-off data surviving in chart markers/table, dark-mode WCAG contrast failure — both closed by gap-closure Plan 09-07 and independently re-verified: `useMemo`-gated event arrays, new `--overlay-chip-text` theme token (8.75:1-11.47:1 dark-mode contrast), plus bundled WR-3 agent-parity test coverage)
- [x] Spoken replies — dashboard reads its confirmation aloud via Web SpeechSynthesis on applied voice/agent commands only, with a persisted, voice-reachable mute/quiet toggle on by default — Validated in Phase 10: Spoken Replies (TTS) (TTS-01–05; 5/5 roadmap success criteria; 257 backend + 299 frontend tests green; real-device human sign-off across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device confirmed gesture-unlock persistence and backgrounding-cancel recovery; code review found 6 warning + 2 info issues, 0 critical, tracked for follow-up in `10-REVIEW.md`)
- [x] Full site guide / instructions tab — accessible, voice-navigable walkthrough of every control, filter, chart, and upload flow for Chris and caregivers — Validated in Phase 11: Full Site Guide / Instructions Tab (GUIDE-01–04; 4/4 roadmap success criteria; 323 frontend + 260/261 backend tests green (1 pre-existing unrelated env failure); the phase's own mandatory manual-verification checkpoint was performed via Claude-in-Chrome browser automation rather than deferred to the user, and found + fixed two real bugs — a viewport-width-dependent content overlap (replaced a guessed fixed padding with live ResizeObserver measurement) and a Tab-order gap into hidden content (`inert`); code review then found + fixed 1 critical (keyboard focus dropped to `<body>` on open) + 2 related warnings (jump-link scroll clearance, no focus restoration on close) — see `11-REVIEW.md` and `11-VERIFICATION.md`)
- [x] Overall visual refresh — new warm terracotta/coral-salmon accent (light `#B94927`/dark `#DA6F4E`, replacing navy) applied sitewide via a single CSS token change, added surface depth (`rounded-xl` + theme-aware `shadow-elevation`) on every card/panel/notice surface, and a formalized `text-control`/`text-h2`/`text-h1` type scale at unchanged rendered pixel sizes — Validated in Phase 12: Visual Refresh (VISUAL-01/02; 2/2 roadmap success criteria; 8/8 plans across 3 waves; 329/329 frontend tests green; every D-04-locked clinical/overlay/focus token confirmed byte-identical pre/post; accessibility floor (`min-h-12`/`min-w-12`) confirmed unchanged via pre/post git-diff reconstruction — the plan's own static grep threshold was miscalibrated but the independently-reconstructed count matched exactly; code review clean (0 critical/warning, 2 info); human cross-screen/cross-theme sign-off approved — see `12-REVIEW.md` and `12-VERIFICATION.md`)

### Active

None — no milestone currently in progress. v1.1 shipped 2026-08-27 (all five target features validated, see Milestone History above). Run `/gsd-new-milestone` to populate this section for the next milestone.

### Deferred (needs the paid Claude API — future milestone)

- [ ] Activate the paid Claude API so the natural-language agent works in production (billing-only, no code change)
- [ ] Voice/text data entry via the agent ("log a reading of 120 over 80")

### Out of Scope

- Data entry by voice/text via the agent ("log a reading of 120 over 80") — needs the paid API; deferred with agent activation. Manual entry forms are in scope for v1.1.
- Cross-metric correlation analysis (e.g. statistical correlation between BP and incidents, beyond visual overlay) — post-MVP; v1.1 overlay is visual only
- Full auth (accounts, magic links) — single shared password is sufficient for a personal site
- Scheduled email/summary reports — post-MVP
- Analytics trackers or any third-party data sharing — health data is sensitive; never add these
- Multi-user support — this is a single-patient personal site

## Context

**The user (critical):** Chris is non-technical. UI must be simple, large, high-contrast, and readable from a distance. He cannot reliably use a mouse or keyboard. A caregiver starts each dashboard session (taps the mic); once active, the session must stay listening (continuous recognition) so Chris can issue multiple commands without anyone re-tapping.

**Devices:** Primary device is not yet decided — design voice for both Chrome/Edge (standard Web Speech API) and Safari/iOS (webkit-prefixed SpeechRecognition, with its quirks: user-gesture requirement, auto-stop on silence, Apple servers). Voice must work acceptably on both; text input covers Firefox and anything else.

**Existing data:**
- OMRON blood pressure export (Excel): 132 readings, Feb 22 – Jun 13, 2025. Columns: Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes (last three empty).
- A cleaned CSV already exists (`bp_data_cleaned.csv`) with derived fields: DateTime, AM_PM, DayOfWeek, WeekNumber, Month, BP_Category (AHA classification: Normal / Elevated / Stage 1 / Stage 2 / Hypertensive Crisis / Hypotension), Pulse_Category (Bradycardia <60 bpm / Normal / Tachycardia), MAP (mean arterial pressure), Pulse_Pressure.
- The user will add these data files to this repo before/during Phase 1.
- Notable characteristics: ~88% of readings show bradycardia; BP is highly variable (hypotension to hypertensive crisis, systolic 60–211). Charts and thresholds must handle this range gracefully.
- Future data (templates exist, not populated): lab results, incidents (passing out, hospitalizations), procedures, other vitals (oxygen, temperature).

**Prior work:** Tableau Public prototype with four charts to replicate:
1. BP Timeline — dual-line systolic/diastolic over time
2. Pulse Trend — line with bradycardia threshold reference line at 60 bpm
3. BP Categories — horizontal bar chart with AHA color coding
4. AM vs PM comparison — grouped bars

Header: "Chris's Health Dashboard" title bar, matching the Tableau prototype styling.

**Architecture:**

```
[OMRON Excel/CSV uploads]
        │
        ▼
[Python ETL pipeline] ──► [PostgreSQL]
                               │
                               ▼
                          [FastAPI]
                          /        \
              REST endpoints    /agent endpoint
                    │                │
                    ▼                ▼
                [React frontend] ◄── Claude API
                    │                (intent → JSON command)
              [Web Speech API]
              (voice → text)
```

**Voice agent flow:**
1. Caregiver activates mic (large button; always-listening toggle) → Web Speech API transcribes speech to text.
2. Transcript is POSTed to FastAPI `/agent` endpoint.
3. Backend calls Claude API with a system prompt describing available charts, filters, and date ranges.
4. Claude returns structured JSON only, e.g. `{"action": "show_chart", "chart": "bp_timeline", "date_range": {"last_n_days": 30}, "am_pm": "AM"}`.
5. Backend validates the JSON against a Pydantic schema and returns it to the frontend.
6. Frontend applies the command: switches chart, applies filters, updates view.
7. Agent responds with a short text confirmation, shown on screen and (as of v1.1 Phase 10) spoken aloud via Web SpeechSynthesis unless muted.

**Database schema (initial):**

```sql
readings (
  id SERIAL PRIMARY KEY,
  datetime TIMESTAMP NOT NULL,
  systolic INT,
  diastolic INT,
  pulse INT,
  am_pm TEXT,              -- derived
  bp_category TEXT,        -- derived
  pulse_category TEXT,     -- derived
  map NUMERIC,             -- derived
  pulse_pressure INT,      -- derived
  notes TEXT
)

-- Records tables (migrated empty in v1.0; reachable via CRUD API + manual-entry forms as of v1.1 Phases 7-8):
lab_results (id, date, test_name, result, unit, range_low, range_high, notes)
incidents (id, datetime, incident_type, duration, notes)
procedures (id, date, procedure_name, location, outcome, notes)
```

Derived fields are computed in the ETL pipeline, not by hand.

**Current codebase state (as of v1.1 close, 2026-08-27):** ~6.9k LOC Python (backend) + ~11k LOC TypeScript/TSX (frontend), 316 commits since v1.0 tag. Backend: FastAPI routers for readings/labs/incidents/procedures/agent/health/auth/upload, all Bearer-gated; Claude agent service with a passive circuit breaker for liveness. Frontend: React 19 + Vite, zustand stores for filters/overlay/speech/guide/agent-status, TanStack Query for server state, Recharts dashboard with overlay markers, GuideOverlay, AddRecordPage forms, a terracotta/coral visual theme with a formalized type scale. 329 frontend + 216+ backend tests green at last phase close.

## Constraints

- **Tech stack (fixed — do not substitute)**: PostgreSQL (SQLite acceptable for local dev), Python + Pandas ETL, FastAPI backend, React (Vite) frontend, Recharts, Web Speech API voice input, Claude API (Anthropic) agent, Vercel + Railway/Render hosting — single consistent Python/React stack is a portfolio requirement
- **Security**: Claude agent must return JSON only, validated with Pydantic on the backend; never execute raw model output — model output is untrusted input
- **Security**: API keys live in environment variables, never in frontend code; all Claude calls go through the backend — keys must not be exposable
- **Privacy**: No analytics trackers, no third-party data sharing, DB not publicly exposed, shared-password gate before the deployed site — health data is sensitive
- **Accessibility (non-negotiable)**: All primary actions reachable by voice; ≥48px click targets; high contrast; ≥18px body fonts; keyboard navigable as fallback; no drag, hover-only, or precise-pointing interactions — the primary user cannot use standard input devices
- **Quality**: Tests required for ETL derivations (BP category boundaries, MAP calculation, AM/PM logic) — derived medical categorizations must be correct
- **Compatibility**: Voice input must work on Chrome/Edge and Safari/iOS (webkit-prefixed) — Chris's primary device is undecided

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Voice-first, not voice-added | Chris cannot use mouse/keyboard reliably; voice is his primary input | ✓ Good — every v1.1 feature (overlay toggles, mute, guide) shipped with voice parity, not just click |
| Web Speech API (browser-native) over cloud STT | No extra service, no audio leaves the browser except to the OS vendor; fits fixed stack | ✓ Good — real-device verified on Chrome/Edge + Safari/iOS in both Phase 4 and Phase 10 |
| Claude returns structured JSON commands only, Pydantic-validated | Never execute raw model output; frontend applies validated commands | ✓ Good — pattern held for 3 new v1.1 commands (ToggleDataset, ToggleSpeech, ToggleGuide), each a closed-union `AgentOutput` member |
| Shared-password gate at MVP (moved up from post-MVP) | Deployed MVP would otherwise expose real health data publicly | ✓ Good — SEC-03 audit passed; every new v1.1 route (labs/incidents/procedures) Bearer-gated by default |
| Caregiver-initiated continuous listening sessions | Chris can't tap the mic himself; one tap per session, then hands-free | ✓ Good — 10-minute real-device session verified in Phase 4; Phase 10 added mic pause/resume around TTS playback without breaking the session |
| Support both Chrome and Safari/iOS voice from the start | Primary device undecided; retrofitting Safari quirks later is costlier | ✓ Good — paid off directly in Phase 10 (TTS gesture-unlock/backgrounding-cancel quirks were a known-shape problem, not a surprise) |
| Derived fields computed in ETL, stored in DB | Single source of truth for categories; testable; matches existing cleaned CSV | ✓ Good — no derivation logic duplicated in v1.1's new records tables |
| Future tables (labs/incidents/procedures) migrated but empty | Don't block MVP, don't repaint schema later | ✓ Good — reachable via CRUD API (v1.1 Phase 7) and populated via manual-entry forms (Phase 8) with zero schema changes |
| Agent inert in prod deferred to v2 rather than funded mid-v1.1 | Billing-only fix, no code change; v1.1 scoped to work entirely without paid API | ✓ Good — v1.1's five features (liveness, records, overlay, TTS, guide, visual refresh) all shipped and were fully verifiable without live model calls |
| Liveness detection as a passive circuit breaker, no active probe | Zero added Claude API token cost; `/health` must never spend a request | ✓ Good — 0 tokens spent on liveness across the whole milestone; `06-REVIEW.md` flagged a *fetch-timeout* gap (WR-03/WR-04), not a design flaw, tracked as tech debt |
| Overlay accessibility via `ReferenceLine` + accessible list, not a Scatter series in `accessibilityLayer` | Recharts' `accessibilityLayer` arrow-key nav doesn't cover marker-dense overlay data well; a separate list guarantees full keyboard/screen-reader access | ✓ Good — resolved explicitly in Phase 9 planning (`09-CONTEXT.md`), no rework needed after initial 2-BLOCKER gap closure (which was a staleness/contrast bug, not an architecture problem) |
| Each new agent command is its own closed-union `AgentOutput` member | Consistent, type-checked dispatch pattern instead of ad-hoc parsing per feature | ✓ Good — repeated 3x (Phases 9/10/11) with zero deviation; kept `interpret()` exhaustive and switch-checked throughout |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-27 after v1.1 milestone close.*

**v1.1 — Polish & Records shipped and archived 2026-08-27** (Phases 6–12, 34 plans, 76 tasks; see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) and MILESTONES.md for full detail): agent-failure visibility (liveness detection), records backend + manual-entry forms, multi-dataset overlay & filtering, spoken replies (TTS), full site guide, and a sitewide visual refresh — all five target features validated, zero accessibility-floor regression. v1.0 MVP remains shipped & archived: dashboard, upload, auth gate, and deployment are live and verified private (SEC-03); the natural-language agent is built and verified in code but inert in production pending paid Claude API credits (deferred to v2, unchanged by v1.1). No milestone is currently active — next: `/gsd-new-milestone` to scope v2.*
