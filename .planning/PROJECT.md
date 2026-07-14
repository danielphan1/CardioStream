# Health Visualizer — Chris's Health Dashboard

## What This Is

A personal health data dashboard website for a single user: Chris, a C4 quadriplegic individual (wheelchair user since 1997, limited/no hand mobility) who has been tracking blood pressure, pulse, and other health metrics since early 2025. It replaces an earlier Tableau Public prototype with a voice-controlled web app: Chris asks for views of his data hands-free ("show me my blood pressure for the last 30 days, mornings only") and the dashboard responds. His wife/caregivers also use the site to enter new data.

This is also a portfolio project for the builder, demonstrating data engineering, software engineering, and applied AI on a consistent Python + React stack.

## Core Value

Chris can see and explore his own health data entirely by voice — voice interaction is the primary input method, not a gimmick. Every feature must be operable by voice; mouse/keyboard is the fallback, not the default.

## Requirements

### Validated

- [x] ETL pipeline ingests OMRON Excel exports, computes derived fields, loads idempotently — Validated in Phase 1: Data Foundation (real export format verified 2026-07-14; SQLite locally, same SQLAlchemy models target Postgres in prod)
- [x] Database seeded with the existing 132 real readings (Feb 22 – Jun 13, 2025) — Validated in Phase 1: seed added=132, re-run 0/132 unchanged; golden-master diff waived (reference CSV does not exist), derived fields covered by 83-test boundary suite

### Active

- [ ] FastAPI endpoints: readings (filterable), summary stats, file upload, agent
- [ ] React dashboard replicating the four Tableau charts (BP Timeline, Pulse Trend, BP Categories, AM vs PM)
- [ ] Voice control: mic capture → transcript → Claude agent → validated JSON command → dashboard updates
- [ ] Text input box as voice fallback
- [ ] Accessibility: large targets (≥48px), high contrast, ≥18px body text, keyboard navigable, no drag/hover-only/precision interactions
- [ ] Simple shared-password gate before public deployment
- [ ] Deployed: Vercel (frontend) + Railway or Render (backend + Postgres)

### Out of Scope

- Voice replies via SpeechSynthesis — post-MVP; text confirmation is enough for v1
- Data entry by voice ("log a reading of 120 over 80") — post-MVP; caregivers can upload files for now
- Lab results / incidents / procedures views and correlation charts — post-MVP; migrations created but tables stay empty
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
| Future tables (labs/incidents/procedures) migrated but empty | Don't block MVP, don't repaint schema later | — Pending |

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
*Last updated: 2026-07-14 after Phase 1 completion (data foundation: real data seeded, ETL verified)*
