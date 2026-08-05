# Roadmap: Health Visualizer — Chris's Health Dashboard

## Overview

Build from the data up: first a tested, privacy-safe ETL foundation seeded with Chris's 132 real readings; then the four-chart dashboard with manual filter controls (whose state shape becomes the agent command schema); then the Claude agent driven by text input (full pipeline debugged with zero voice complexity — text fallback ships as a side effect); then voice capture as a purely additive transcript source (Chrome first, then Safari/iOS restart-loop hardening); finally the caregiver upload flow, shared-password gate, and split Vercel + Railway deployment with an end-to-end smoke test. Each phase delivers something Chris or a caregiver can observe working.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Repo + privacy setup, schema/migrations, idempotent OMRON ETL with tested derivations, 132 readings seeded (completed 2026-07-13)
- [x] **Phase 2: Read API & Dashboard** - `/readings` + `/stats` endpoints and the four-chart dashboard with manual filters, stats strip, and readings table (completed 2026-07-17)
- [x] **Phase 3: Agent via Text Input** - Claude-powered `/agent` endpoint with validated JSON commands, driven by the text input box (completed 2026-07-20)
- [x] **Phase 4: Voice Capture** - Continuous-listening mic sessions on Chrome/Edge and Safari/iOS with unmissable state indicators and live transcript (completed 2026-07-21)
- [ ] **Phase 5: Upload, Auth Gate & Deployment** - Caregiver upload page, shared-password Bearer gate on every route, Vercel + Railway deploy, smoke test

## Phase Details

### Phase 1: Data Foundation

**Goal**: Chris's real data lives in a correctly-derived, duplicate-proof database — and never in the public repo
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08
**Success Criteria** (what must be TRUE):

  1. Database contains all 132 real readings (Feb 22 – Jun 13, 2025) with derived fields (AM/PM, BP category, pulse category, MAP, pulse pressure) matching `bp_data_cleaned.csv` in a golden-master diff
  2. Re-running the ETL on the same or an overlapping cumulative OMRON export adds zero duplicate rows (unique datetime constraint enforced)
  3. Automated test suite passes: AHA + Hypotension category boundaries, bradycardia/tachycardia boundaries, MAP calculation, AM/PM logic, and double-ingest idempotency
  4. Public repo contains no real health data — real files are gitignored and a committed synthetic sample with the same schema and outlier character works for development
  5. Alembic migrations create the readings table plus empty future tables (lab_results, incidents, procedures), with all timestamps stored as naive local time

**Plans:** 8/8 plans complete

Plans:

- [x] 01-01-PLAN.md — Privacy-first repo scaffold: gitignore-first commit, backend layout, pinned deps, real-data drop checkpoint
- [x] 01-02-PLAN.md — SQLAlchemy schema + Alembic (readings w/ unique datetime, empty future tables, migration smoke test)
- [x] 01-03-PLAN.md — Derivation module TDD: AHA/hypotension/pulse classifiers, MAP, pulse pressure, AM/PM boundary matrix
- [x] 01-04-PLAN.md — OMRON parse + transform: real-format inspection, naive datetimes, D-07 dedupe, D-08 rejection
- [x] 01-05-PLAN.md — Seeded synthetic sample generator + committed OMRON-format xlsx + character regression test
- [x] 01-06-PLAN.md — Idempotent merge loader: D-05 upsert, D-06 IngestSummary, double-ingest proof
- [x] 01-07-PLAN.md — python -m app.seed, golden-master diff vs bp_data_cleaned.csv, README + final privacy audit
- [x] 01-08-PLAN.md — Gap closure: D-08 validation/coercion agreement (CR-01+WR-02), NaN-notes convergence + minute-key (WR-01+WR-03), ambiguous-date guard (WR-04)

### Phase 2: Read API & Dashboard

**Goal**: Anyone can see and manually explore Chris's data across all four charts — the manual filter state that voice commands will later mutate
**Depends on**: Phase 1
**Requirements**: API-01, API-02, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-11, ACC-01, ACC-02
**Success Criteria** (what must be TRUE):

  1. User can view all four charts — BP Timeline (dual-line with AHA category bands behind it), Pulse Trend (60 bpm bradycardia reference line), BP Categories (clinical-order bars with AHA colors + Hypotension), AM vs PM (grouped bars) — under the "Chris's Health Dashboard" header matching the Tableau prototype
  2. User can apply date presets (7/30/90 days, all) or a custom range, AM/PM, and BP category filters via manual controls, and all charts, the summary stats strip, and the readings table update consistently together
  3. Summary stats strip shows correct avg/min/max systolic/diastolic/pulse, reading count, and % per category for the current filter set, matching `GET /stats/summary`
  4. Charts render Chris's full data range (systolic 60–211, mostly-bradycardic pulse) without axis clipping or misleading scales
  5. Every interactive target is ≥48px, body text ≥18px, palette (including chart colors) is high-contrast, and the entire dashboard is keyboard navigable with visible focus — no drag, hover-only, or precision interactions

**Plans:** 7/7 plans complete
**UI hint**: yes
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Read API: GET /readings + GET /stats/summary (shared ReadingFilters, alias-correct JSON, auth stub, CORS)
- [x] 02-02-PLAN.md — Frontend scaffold + two-theme design tokens, theme store, typed API client
- [x] 02-03-PLAN.md — Filter foundations: zustand filter store (agent command schema), date resolution anchored to latest_reading, palette, query hooks

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — Four chart components: BP Timeline w/ AHA bands, Pulse Trend w/ 60 bpm line, BP Categories bars, AM vs PM
- [x] 02-05-PLAN.md — Header (DASH-11) + filter controls UI: presets, AM/PM, category chips, oversized custom date range
- [x] 02-06-PLAN.md — Stats strip (DASH-08), readings table w/ category chips (DASH-09), guided empty state

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-07-PLAN.md — ChartDeck hero/mini rotation, App assembly, visual + accessibility verification checkpoint

### Phase 3: Agent via Text Input

**Goal**: Natural-language commands typed into the dashboard reliably control it — the full Claude pipeline works before voice adds complexity
**Depends on**: Phase 2
**Requirements**: API-04, API-05, VOICE-06, VOICE-07, VOICE-08, VOICE-09, SEC-02
**Success Criteria** (what must be TRUE):

  1. Typing a natural-language command ("show my blood pressure for the last 30 days, mornings only") into the text input box switches charts and applies filters correctly via the `/agent` endpoint
  2. Every applied command produces a large-text confirmation of what changed ("Showing blood pressure, last 30 days, mornings")
  3. Unrecognized or ambiguous input produces a clear, non-technical clarification message — never a silent failure, raw error, or 500
  4. Claude output is Pydantic-validated JSON with closed enums and symbolic date ranges resolved server-side in local time; raw model output is never executed or passed through unvalidated (verified against a fixture suite of ~30 real utterances including garbled transcripts)
  5. The agent only describes what the dashboard shows — it refuses medical advice, diagnosis, or alarm-style interpretation — and the Anthropic API key exists only in backend environment variables

**Plans**: TBD

### Phase 4: Voice Capture

**Goal**: Chris can operate the entire dashboard hands-free by voice after one caregiver tap, on either Chrome/Edge or Safari/iOS
**Depends on**: Phase 3
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, ACC-03
**Success Criteria** (what must be TRUE):

  1. A caregiver taps the large mic button once, and Chris then issues multiple voice commands hands-free — on both Chrome/Edge and Safari/iOS (webkit-prefixed, restart-on-onend loop verified on a real iOS device early in the phase)
  2. An unmissable, distance-visible indicator always shows whether the dashboard is listening, processing, or stopped
  3. A live transcript of recognized speech displays while listening
  4. Every chart switch and every filter available in the manual UI can be triggered by voice — command schema and UI filters verified in lockstep, so all primary actions are voice-operable
  5. A 10-minute continuous session with long silences keeps listening (recognizer restarts survive silence timeouts and error loops without caregiver intervention)

**Plans:** 3/3 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Pure voice helpers (wake-word gate/strip, capability + iOS detection, error classification, backoff), FakeRecognition harness, ambient types, and the VOICE-05/ACC-03 parity test

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — useVoiceCommand hook: singleton recognizer lifecycle, onend/onerror restart loop with backoff, wake-word gating, newest-wins seq guard (reuses /agent unchanged)

**Wave 3** *(blocked on Wave 2)*

- [x] 04-03-PLAN.md — CommandBar mic button + 3-state indicator + live transcript, iOS test checklist, and the real-device restart-loop + 10-min-session human-verify checkpoint

### Phase 5: Upload, Auth Gate & Deployment

**Goal**: Caregivers can add new data through the site, and the finished app runs on the public internet behind a password with no health-data exposure
**Depends on**: Phase 4
**Requirements**: API-03, DASH-10, SEC-01, SEC-03, DEPL-01, DEPL-02
**Success Criteria** (what must be TRUE):

  1. Caregiver can upload an OMRON export on the upload page and sees a result summary (readings added, duplicates skipped, total count, latest reading date); re-uploading the same file is a visible no-op
  2. The deployed site requires the shared password, and every API route — including `/agent` and `/upload` — returns 401 without a valid Bearer token (curl-verified)
  3. Frontend runs on Vercel and backend + PostgreSQL on Railway (or Render), configured entirely via environment variables with a CORS allow-list for the Vercel origin
  4. End-to-end smoke test passes on the deployed site: log in, view all charts, issue a voice or text command that updates the dashboard, upload a file
  5. No analytics trackers or third-party data sharing anywhere; the database is not publicly reachable and platform logs contain no health values or transcripts

**Plans:** 6/7 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Backend Wave-0 foundations: add itsdangerous/python-multipart/psycopg deps (legitimacy gate) + override verify_token in conftest so existing API tests survive enforcement
- [x] 05-04-PLAN.md — Frontend auth: localStorage token store, client.ts Bearer header + 401→logout + postFile/postAuth, full-screen LoginGate wrapping App (nothing renders pre-auth)

**Wave 2** *(02 blocked on 01; 05 blocked on 04)*

- [x] 05-02-PLAN.md — Auth backend: real itsdangerous verify_token (401 not 403, no-expiry), ungated rate-limited POST /auth, Settings + psycopg3/CORS config gotchas
- [x] 05-05-PLAN.md — Upload UI: view-swap store, UploadPage (immediate ingest → plain-language summary + rejects), discreet Header Upload/Log-out controls + logout confirm

**Wave 3** *(blocked on Wave 2)*

- [x] 05-03-PLAN.md — Upload backend: thin gated POST /upload over the existing ETL, IngestSummary verbatim, idempotent + never-500 rejection

**Wave 4** *(blocked on Waves 2-3)*

- [x] 05-06-PLAN.md — Deployment: Railway backend + private Postgres (alembic on deploy), Vercel frontend, env inventory, seed-vs-empty decision

**Wave 5** *(blocked on Wave 4)*

- [ ] 05-07-PLAN.md — Hybrid smoke test: automated curl 401-on-every-route + auth round-trip, human live-site checklist, SEC-03 privacy audit

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 8/8 | Complete    | 2026-07-14 |
| 2. Read API & Dashboard | 7/7 | Complete   | 2026-07-17 |
| 3. Agent via Text Input | 4/4 | Complete    | 2026-07-21 |
| 4. Voice Capture | 3/3 | Complete    | 2026-07-21 |
| 5. Upload, Auth Gate & Deployment | 6/7 | In Progress|  |
