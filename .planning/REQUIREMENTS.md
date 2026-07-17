# Requirements — Health Visualizer (Chris's Health Dashboard)

**Defined:** 2026-07-07
**Core value:** Chris can see and explore his own health data entirely by voice.

## v1 Requirements

### Data Foundation

- [x] **DATA-01**: ETL pipeline ingests OMRON Excel/CSV exports and computes derived fields (AM/PM, BP category, pulse category, MAP, pulse pressure) — categories computed in ETL only, single source of truth
- [x] **DATA-02**: BP categories follow AHA classification extended with Hypotension; pulse categories include Bradycardia (<60 bpm) / Normal / Tachycardia
- [x] **DATA-03**: ETL is idempotent — re-uploading a cumulative/overlapping OMRON export never duplicates rows (DB unique constraint on reading datetime)
- [x] **DATA-04**: Database is seeded with the existing 132 real readings (Feb 22 – Jun 13, 2025)
- [x] **DATA-05**: All timestamps stored as naive local time end-to-end — no UTC conversion anywhere (protects AM/PM analysis)
- [x] **DATA-06**: Migrations exist for future tables (lab_results, incidents, procedures); tables stay empty in v1
- [x] **DATA-07**: Automated tests cover ETL derivations: BP category boundaries, pulse category boundaries, MAP calculation, AM/PM logic, idempotent re-ingest
- [x] **DATA-08**: Real health data never enters the public repo — gitignored data directory plus a synthetic sample file for development and demos

### API

- [ ] **API-01**: `GET /readings` returns readings filterable by start_date, end_date, am_pm, bp_category
- [ ] **API-02**: `GET /stats/summary` returns averages, min/max, reading counts, and per-category counts for the current filter set
- [ ] **API-03**: `POST /upload` accepts an OMRON export file, runs the ETL, and returns a result summary (readings added, duplicates skipped, total count, latest reading date)
- [ ] **API-04**: `POST /agent` accepts a transcript/text command, calls Claude, and returns a Pydantic-validated JSON dashboard command — raw model output is never executed or passed through unvalidated
- [ ] **API-05**: Agent date ranges are symbolic (e.g., last_n_days) and resolved server-side in local time — Claude never computes absolute dates

### Dashboard

- [x] **DASH-01**: BP Timeline chart — dual-line systolic + diastolic over time
- [x] **DASH-02**: Pulse Trend chart — line with bradycardia reference line at 60 bpm
- [x] **DASH-03**: BP Categories chart — horizontal bars in clinical order with AHA color coding plus blue/grey Hypotension
- [x] **DASH-04**: AM vs PM comparison chart — grouped bars of average systolic/diastolic/pulse
- [x] **DASH-05**: Category color bands (AHA zones) rendered behind the BP timeline
- [x] **DASH-06**: Charts handle Chris's full data range gracefully (systolic 60–211, mostly-bradycardic pulse) — no misleading axis clipping
- [x] **DASH-07**: Filter controls — date-range presets (7/30/90 days, all) + custom range, AM/PM, BP category — applied consistently across all charts
- [x] **DASH-08**: Summary statistics strip — avg/min/max systolic/diastolic/pulse, reading count, % per category — recomputes when filters change
- [x] **DASH-09**: Readings table — date-sorted raw data view with category color chips
- [ ] **DASH-10**: Upload page for caregivers showing the post-upload result summary
- [ ] **DASH-11**: "Chris's Health Dashboard" header bar matching the Tableau prototype styling

### Voice & Agent

- [ ] **VOICE-01**: Mic capture via Web Speech API works on Chrome/Edge and Safari/iOS (webkit-prefixed, restart-loop handling)
- [ ] **VOICE-02**: Continuous listening session — caregiver taps the large mic button once; Chris then issues multiple commands hands-free
- [ ] **VOICE-03**: Unmissable listening-state indicator — Chris can always tell from a distance whether the dashboard is listening, processing, or stopped
- [ ] **VOICE-04**: Live transcript of recognized speech is displayed while listening
- [ ] **VOICE-05**: Voice commands can switch charts and apply any filter available in the UI (chart, date range, AM/PM, category) — command schema and UI filters stay in lockstep
- [ ] **VOICE-06**: Every applied command produces a large-text confirmation of what changed ("Showing blood pressure, last 30 days, mornings")
- [ ] **VOICE-07**: Unrecognized or ambiguous commands produce a clear, non-technical error/clarification message instead of silent failure
- [ ] **VOICE-08**: Text input box drives the same agent endpoint as voice (fallback for Firefox, noise, recognition failure)
- [ ] **VOICE-09**: The agent describes what the dashboard shows and never gives medical advice, diagnosis, or alarm-style interpretation

### Accessibility

- [x] **ACC-01**: All interactive targets ≥48px; body text ≥18px; high-contrast palette (including chart colors) *(partial — 18px floor + palette shipped in 02-02; ≥48px targets unverifiable until interactive UI exists)*
- [x] **ACC-02**: Fully keyboard navigable with visible focus; no drag, hover-only, or precise-pointing interactions anywhere
- [ ] **ACC-03**: Every primary action (switch chart, change filters, view data) is operable by voice

### Security & Privacy

- [ ] **SEC-01**: Shared-password gate protects the deployed site; authenticated via Bearer token (not cookies) enforced on every API route including /agent and /upload
- [ ] **SEC-02**: Anthropic API key lives in backend environment variables only; all Claude calls go through the backend
- [ ] **SEC-03**: No analytics trackers, no third-party data sharing; database not publicly exposed

### Deployment

- [ ] **DEPL-01**: Frontend deployed to Vercel; backend + PostgreSQL to Railway (or Render), configured via environment variables
- [ ] **DEPL-02**: End-to-end smoke test passes on the deployed site: log in, view charts, issue a voice/text command, upload a file

## v2 Requirements (Deferred)

- **V2-01**: Agent summary Q&A — "what's my average this month?" answered in text from computed stats (trigger: navigation commands reliable)
- **V2-02**: Voice command help overlay — "what can I say?" (trigger: observed failed-command patterns)
- **V2-03**: Spoken replies via SpeechSynthesis with mic muting during playback
- **V2-04**: Voice data entry with explicit read-back confirmation ("log 120 over 80")
- **V2-05**: Lab results / incidents / procedures views and correlation charts (once data exists)
- **V2-06**: Print stylesheet / doctor-visit report view
- **V2-07**: Scheduled email/summary reports

## Out of Scope

| Exclusion | Reason |
|-----------|--------|
| Medical advice, interpretation, or alerting | Dangerous with this dataset — quadriplegic baselines invert normal alerting logic; agent is descriptive only |
| Real-time alerts / emergency notifications | Data arrives via batch uploads weeks after readings; alerts on stale data are noise |
| Multi-user accounts, roles, per-user auth | One patient + caregivers; shared password is sufficient |
| Bluetooth / Apple Health / OMRON cloud sync | Partner-gated APIs; file upload replaces a working export workflow |
| Free-form "AI insights" / trend narratives | Unverifiable generated claims about health data; deterministic stats only |
| Configurable/drag-to-rearrange dashboards | Drag prohibited by accessibility constraints; fixed chart set is voice-switchable |
| Analytics, trackers, third-party embeds | Health data privacy — explicitly banned |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |
| DATA-08 | Phase 1 | Complete |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 2 | Complete |
| DASH-03 | Phase 2 | Complete |
| DASH-04 | Phase 2 | Complete |
| DASH-05 | Phase 2 | Complete |
| DASH-06 | Phase 2 | Complete |
| DASH-07 | Phase 2 | Complete |
| DASH-08 | Phase 2 | Complete |
| DASH-09 | Phase 2 | Complete |
| DASH-11 | Phase 2 | Pending |
| ACC-01 | Phase 2 | Partial |
| ACC-02 | Phase 2 | Complete |
| API-04 | Phase 3 | Pending |
| API-05 | Phase 3 | Pending |
| VOICE-06 | Phase 3 | Pending |
| VOICE-07 | Phase 3 | Pending |
| VOICE-08 | Phase 3 | Pending |
| VOICE-09 | Phase 3 | Pending |
| SEC-02 | Phase 3 | Pending |
| VOICE-01 | Phase 4 | Pending |
| VOICE-02 | Phase 4 | Pending |
| VOICE-03 | Phase 4 | Pending |
| VOICE-04 | Phase 4 | Pending |
| VOICE-05 | Phase 4 | Pending |
| ACC-03 | Phase 4 | Pending |
| API-03 | Phase 5 | Pending |
| DASH-10 | Phase 5 | Pending |
| SEC-01 | Phase 5 | Pending |
| SEC-03 | Phase 5 | Pending |
| DEPL-01 | Phase 5 | Pending |
| DEPL-02 | Phase 5 | Pending |

---
*Requirements defined: 2026-07-07 — 41 v1 requirements across 7 categories*
