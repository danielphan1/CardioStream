# Health Visualizer — Chris's Health Dashboard

## What This Is

A personal health data dashboard website for a single user: Chris, a C4 quadriplegic individual (wheelchair user since 1997, limited/no hand mobility) who has been tracking blood pressure, pulse, and other health metrics since early 2025. It replaces an earlier Tableau Public prototype with a voice-controlled web app: Chris asks for views of his data hands-free ("show me my blood pressure for the last 30 days, mornings only") and the dashboard responds. His wife/caregivers also use the site to enter new data.

This is also a portfolio project for the builder, demonstrating data engineering, software engineering, and applied AI on a consistent Python + React stack.

## Core Value

Chris can see and explore his own health data entirely by voice — voice interaction is the primary input method, not a gimmick. Every feature must be operable by voice; mouse/keyboard is the fallback, not the default.

## Current Milestone: v1.1 — Polish & Records

**Goal:** Make the shipped MVP more complete and more usable **without needing the paid API** — close the voice loop with spoken replies, let Chris and caregivers mix and match which data they're looking at, surface the health records the schema already anticipates, teach the whole site through a built-in guide, refresh the visuals, and turn the silent agent outage into an honest "unavailable" state.

**Target features:**
- **Spoken replies** — the dashboard reads its confirmation aloud via Web SpeechSynthesis, closing the hands-free loop for Chris.
- **Multi-dataset filtering & overlay** — toggle any combination of data types (BP, pulse, labs, incidents/hospital stays, procedures) on or off, by voice or click; selected types overlay together on one dashboard view (e.g. hospital-stay markers plotted directly on the BP/pulse timeline) rather than living in separate silos. Includes the manual-entry forms needed to populate labs/incidents/procedures.
- **Full site guide / instructions tab** — an accessible, voice-navigable help tab explaining every part of the site: what each button/control does, how filtering works, what each chart shows, how upload works, and what Chris can say by voice — for both Chris and his caregivers.
- **Agent failure made visible** — real agent-availability detection; the UI shows "assistant temporarily unavailable" instead of silently answering "didn't catch that."
- **Overall visual refresh** — modernize theme, typography, spacing, and color across all screens, with accessibility preserved.

**Explicitly NOT in v1.1:** activating the paid Claude API, and voice/text data-entry via the agent (manual entry forms are in scope; agent-parsed entry like "log a reading of 120 over 80" is not) — both stay deferred (the NL agent is billing-gated from v1.0).

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

### Active (v1.1 — Polish & Records)

- [ ] Full site guide / instructions tab — accessible, voice-navigable walkthrough of every control, filter, chart, and upload flow for Chris and caregivers
- [ ] Overall visual refresh — modernized theme / typography / spacing / color across all screens, accessibility preserved (≥48px, ≥18px, high contrast, keyboard)

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
7. Agent responds with a short text confirmation (spoken replies are post-MVP).

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

-- Future tables (create migrations but can stay empty):
lab_results (id, date, test_name, result, unit, range_low, range_high, notes)
incidents (id, datetime, incident_type, duration, notes)
procedures (id, date, procedure_name, location, outcome, notes)
```

Derived fields are computed in the ETL pipeline, not by hand.

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
| Voice-first, not voice-added | Chris cannot use mouse/keyboard reliably; voice is his primary input | — Pending |
| Web Speech API (browser-native) over cloud STT | No extra service, no audio leaves the browser except to the OS vendor; fits fixed stack | — Pending |
| Claude returns structured JSON commands only, Pydantic-validated | Never execute raw model output; frontend applies validated commands | — Pending |
| Shared-password gate at MVP (moved up from post-MVP) | Deployed MVP would otherwise expose real health data publicly | — Pending |
| Caregiver-initiated continuous listening sessions | Chris can't tap the mic himself; one tap per session, then hands-free | — Pending |
| Support both Chrome and Safari/iOS voice from the start | Primary device undecided; retrofitting Safari quirks later is costlier | — Pending |
| Derived fields computed in ETL, stored in DB | Single source of truth for categories; testable; matches existing cleaned CSV | — Pending |
| Future tables (labs/incidents/procedures) migrated but empty | Don't block MVP, don't repaint schema later | Reachable via CRUD API as of Phase 7 (still empty until Phase 8 forms) |

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
*Last updated: 2026-08-25 — Phase 10: Spoken Replies (TTS) complete. The dashboard now speaks its confirmation aloud (Web SpeechSynthesis) after an applied voice/agent command — never on manual click/keyboard changes — closing the hands-free loop so Chris doesn't need to look at the screen to know a command worked. A persisted, voice-reachable "Voice Replies" mute toggle is on by default; only one utterance ever plays at a time; the mic pauses while the dashboard is speaking and resumes right after. TTS-01 through TTS-05 all pass, including real-device human sign-off across Chrome/Edge desktop, Safari desktop, and a real iOS Safari device (gesture-unlock persistence and backgrounding-cancel recovery both confirmed) — 5/5 roadmap success criteria. v1.0 MVP shipped & archived: dashboard, upload, auth gate, and deployment are live and verified private (SEC-03); the natural-language agent is built and verified in code but inert in production pending paid Claude API credits (deferred). v1.1 remaining: a full site guide (Phase 11) and an overall visual refresh (Phase 12).*
