# Project Research Summary

**Project:** Health Visualizer — Chris's Health Dashboard
**Domain:** Voice-controlled personal health data dashboard (single-patient BP/pulse, accessibility-first)
**Researched:** 2026-07-07
**Confidence:** HIGH overall (stack and architecture verified against official sources; voice/iOS specifics MEDIUM pending real-device validation)

## Executive Summary

This is a single-patient blood-pressure/pulse dashboard whose defining feature — natural-language voice control of charts and filters — genuinely does not exist in consumer BP apps (OMRON Connect, SmartBP, Withings all lack it). Experts build voice-agent dashboards with one non-negotiable boundary: the LLM is a translator, never an executor. Claude converts a transcript into a closed-vocabulary JSON command (Pydantic-validated enums), and deterministic frontend code applies it to a single dashboard state object. The command schema, the frontend state shape, and the manual filter controls are three views of the same design — which forces a specific build order: dashboard with manual controls first, then the agent via text input, then voice capture last as a purely additive transcript source.

The recommended approach uses the fixed stack at current versions (FastAPI 0.139 + SQLAlchemy 2.0 sync ORM + Alembic + pandas 3.0 backend; React 19 + Vite 8 + Recharts 3 + zustand frontend), with `claude-haiku-4-5` via structured outputs (`messages.parse()` + Pydantic `output_format`) for intent parsing — fast and cheap matters because Chris waits on every voice round-trip. Auth is a signed Bearer token in localStorage, not cookies, because the Vercel↔Railway split is cross-origin and Safari ITP blocks third-party cookies. Deploy backend to Railway Hobby (~$5/mo), not Render free tier — cold starts of 30–60s would make the first voice command of a session indistinguishable from "broken" for a non-technical user.

The three highest risks: (1) **iOS Safari voice behavior** — `continuous: true` silently dies on iOS; the universal fix is a singleton recognizer with a restart-on-`onend` state machine, and it must be tested on a real iPhone in the first days of the voice phase, not at the end; (2) **real health data of an identifiable person in a public portfolio repo** — irreversible once committed; `.gitignore` real data and commit a synthetic sample before the first commit; (3) **silent clinical errors** — AHA category boundary logic, timezone shifts corrupting AM/PM, and non-idempotent ETL duplicating cumulative OMRON exports are all invisible-when-wrong; each has a cheap deterministic test (golden-master diff against `bp_data_cleaned.csv`, boundary unit tests, double-upload no-op test) that must be a phase deliverable.

## Key Findings

### Recommended Stack

The core stack is fixed by PROJECT.md; research pinned versions and resolved the open configuration questions. Backend: Python 3.12, FastAPI 0.139, SQLAlchemy 2.0 **sync** ORM (not raw SQL, not async — one codebase spans SQLite dev / Postgres prod, and single-user load doesn't justify async), Alembic migrations, pandas 3.0 (Copy-on-Write semantics — no chained assignment), psycopg 3 (never psycopg2). Frontend: Node 22 LTS, React 19, Vite 8, TypeScript 5.9, Recharts 3 (accessibilityLayer on by default), react-speech-recognition 4.0.1 with a custom-hook escape hatch, zustand for filter/command state + TanStack Query for server data.

**Core technologies:**
- **claude-haiku-4-5 + structured outputs**: intent parsing — `client.messages.parse(output_format=DashboardCommand)` guarantees schema-valid JSON at the API level; Haiku because latency is UX-critical ($1/$5 per MTok)
- **SQLAlchemy 2.0 typed declarative + Alembic**: SQLite/Postgres portability from one model set; future tables (labs/incidents/procedures) as a second migration
- **itsdangerous signed Bearer token**: password gate — cookies break cross-origin on Safari ITP; localStorage token is the accepted tradeoff for a shared-password personal site
- **Railway Hobby over Render free**: no spin-down; managed Postgres with injected `DATABASE_URL`
- **zustand**: voice commands mutate state from outside the React tree; the agent-response handler and manual FilterBar dispatch the same actions

See STACK.md for full version matrix and what-not-to-use list.

### Expected Features

Consumer BP apps define table stakes; none of them are voice-operable — voice-queried dashboards are the real differentiator.

**Must have (table stakes):**
- Four charts: BP timeline (dual-line), pulse trend + 60 bpm reference line, BP categories bar (AHA colors **plus a hypotension category** — Chris's data reaches systolic 60, and AHA's chart doesn't cover it), AM vs PM grouped bars
- Filter state model (date presets / AM-PM / category) driven by UI controls *and* voice — every filter must be voice-expressible or the primary user can't use it
- Summary statistics strip reactive to filters (also the substrate for agent Q&A later)
- Visible feedback for every voice command: live transcript, processing state, text confirmation ("Showing blood pressure, last 30 days, mornings")
- Text-input fallback hitting the same `/agent` endpoint
- OMRON file upload with idempotent ingest and result summary ("added 12, skipped 3 duplicates")
- Readings table (trust anchor + upload verification), shared-password gate, accessibility baseline (≥48px targets, ≥18px text, contrast, keyboard nav)

**Should have (competitive):**
- Continuous listening session (one caregiver tap, then hands-free) — the accessibility feature that makes voice-first real
- Voice-driven filter composition ("just the stage 2 readings") — falls out of the schema if filters are first-class
- Hypotension + bradycardia as first-class categories — every off-the-shelf app is hypertension-centric; Chris's data is the opposite

**Defer (v2+):**
- Agent summary Q&A, category bands behind timeline, print stylesheet (v1.x triggers defined in FEATURES.md)
- Spoken replies (conflicts with continuous listening), voice data entry (silent numeric transcription errors), labs/incidents views (no data yet)

**Anti-features (do not build):** medical advice/interpretation (liability, and dangerous — Chris's baseline would alarm a general-population model), real-time alerts on batch-uploaded stale data, accounts/roles, Bluetooth/HealthKit sync, free-form AI insights.

### Architecture Approach

The system is a translator pipeline: voice capture and text input converge on one `sendToAgent(transcript)` function; FastAPI's `/agent` calls Claude with the Pydantic-derived schema, re-validates, and returns `{command, confirmation}`; a single reducer merges validated commands into dashboard state; charts render pure (state, data). The model never computes dates ("last 30 days" stays symbolic; the client clock resolves it), never classifies BP (categories come from tested ETL functions stored in the DB), and has a `clarify` action so it asks rather than guesses. At 132 rows, fetch the full dataset once and filter client-side — voice commands apply instantly with no per-command fetch.

**Major components:**
1. **`schemas/commands.py` (the contract)** — Pydantic command models define the entire voice vocabulary; mirrored by hand as a TS type; agent capability = exactly what the UI can already do
2. **`etl/parse.py` / `derive.py` / `load.py`** — pure derivation functions (unit-testable category/MAP/AM-PM logic) + natural-key upsert on `UNIQUE (datetime)`; callable from CLI seeder and `/upload` alike
3. **`hooks/useSpeechRecognition.ts`** — quarantines all Chrome/Safari divergence; singleton recognizer, restart-on-`onend` loop, exposes only `{isListening, start, stop, error}`
4. **Dashboard state reducer** — single state object `{chart, dateRange, amPm, readings, lastConfirmation, listening}`; voice, text-agent, and mouse are three input sources for one state machine
5. **FastAPI routers + auth dependency** — `/readings`, `/stats`, `/upload`, `/agent`, all behind the token check

### Critical Pitfalls

1. **`continuous: true` is not "always listening"** — Chrome stops after silence; iOS Safari dies silently without `onend`/`onerror`. Build a lifecycle state machine (`shouldBeListening` ref, restart-on-`onend` with ~200–300ms delay, backoff on error loops, unmissable visual listening indicator). Test a 10-minute session with long silences on real hardware.
2. **Real health data in the public repo** — decide before the first commit: real files in `.gitignore`, committed synthetic sample with the same schema and outlier character, seed prod via untracked path. Irreversible once in git history.
3. **LLM date/enum failures** — Claude must return symbolic date ranges (resolved client-side against Chris's clock), closed enums with `extra="forbid"`, and a `clarify` escape hatch; validation failure returns a friendly 422, never a 500 or silent no-op. Test with ~30 real utterances including garbled transcriptions.
4. **Timezone "correctness" corrupting AM/PM** — OMRON readings are naive wall-clock local times; use naive `TIMESTAMP` (not `TIMESTAMPTZ`), no tz conversions anywhere, no `Z` suffix in API responses. Document the convention so nobody "fixes" it.
5. **AHA boundary + idempotency errors** — Stage 1 is systolic 130–139 **OR** diastolic 80–89, higher category wins (125/95 = Stage 2); OMRON exports are cumulative so plain INSERT doubles history on every re-upload. Golden-master diff of all 132 readings against `bp_data_cleaned.csv` + double-run ETL test are mandatory deliverables.
6. **Password gate that protects the UI but not the API** — auth is a FastAPI dependency on every route including `/agent` (which costs real money); verify with curl 401s. Rate-limit `/auth` and `/agent`.

## Implications for Roadmap

Research converges on a five-phase structure. The key non-obvious ordering (verified against production NL-dashboard systems): **dashboard before agent, agent before voice** — the manual UI defines the state shape, the state shape *is* the command schema, and voice is just another transcript source into a working pipeline.

### Phase 1: Data Foundation (repo setup, ETL, schema, seed)
**Rationale:** Everything downstream needs real data; derivation tests are cheapest before anything depends on them; the data-privacy decision (Pitfall 12) must happen before the first commit and cannot be retrofitted.
**Delivers:** `.gitignore`d real data + committed synthetic sample; Alembic migrations (readings with `UNIQUE (datetime)` + empty future tables); parse/derive/load pipeline; CLI seed of 132 readings; pytest suite (AHA boundaries, MAP, AM/PM edges, golden-master CSV diff, double-run idempotency).
**Addresses:** Idempotent OMRON ingest (the ETL core of upload later).
**Avoids:** Pitfalls 5, 6, 8, 9, 12 — all the silent-clinical-corruption and irreversible-exposure risks.

### Phase 2: Read API + Dashboard with Manual Controls
**Rationale:** The state shape those controls mutate *is* the command schema — building the agent first would mean designing the contract against an imaginary UI. Trivially verifiable against known seed data.
**Delivers:** `/readings` + `/stats` endpoints (auth dependency designed here, even if the gate ships in Phase 5); four Recharts views with numeric time axes, fixed clinical Y domains ([40,220] BP / [30,130] pulse), reference lines/bands; FilterBar + summary stats strip + readings table; zustand state reducer; accessibility baseline (48px targets, 18px text, contrast-checked AHA palette, aria-live status region, accessibilityLayer).
**Uses:** Recharts 3, zustand, TanStack Query; fetch-once + client-side filtering.
**Implements:** Dashboard state (single reducer), chart views, API client.
**Avoids:** Pitfalls 7 (axis distortion), 10 (accessibility gaps).

### Phase 3: Agent via Text Input
**Rationale:** The full agent pipeline gets exercised and debugged with zero voice complexity; the text-fallback requirement is satisfied as a side effect.
**Delivers:** `schemas/commands.py` (closed enums, symbolic date ranges, `clarify` action, `confirmation` field); `/agent` with `messages.parse()` structured outputs + defense-in-depth Pydantic re-validation; text box wired to `sendToAgent`; reducer accepts commands; 30-utterance fixture test suite; friendly error paths (422 → "I didn't understand, try...").
**Uses:** anthropic SDK ≥0.116, claude-haiku-4-5, structured outputs.
**Avoids:** Pitfalls 4 (LLM dates/enums), 14 (injection, cost — final transcripts only, low max_tokens, spend cap).

### Phase 4: Voice Capture
**Rationale:** Purely additive — produces transcripts into an already-working pipeline, so voice bugs are isolated from agent bugs. Riskiest browser-behavior work in the project.
**Delivers:** `useSpeechRecognition` hook (singleton instance, engine branching: Chrome `continuous: true` + restart, iOS `continuous: false` + restart-on-`onend` with delay, transcript-delta parsing, error-type branching incl. `network`); big mic button + persistent listening indicator + live transcript; aria-live announcements wired to command application; **real iOS device test in the first days of this phase**.
**Implements:** Voice capture layer, continuous-listening session.
**Avoids:** Pitfalls 1, 2, 3 (lifecycle, Safari divergence, network dependency).

### Phase 5: Upload, Auth Gate, Deploy
**Rationale:** Gate must land before or with deployment (real health data); upload can trail because the CLI seeder covers data needs until then. Deployment last so cold-start/CORS realities are tested against the finished voice UX.
**Delivers:** `/upload` endpoint reusing the ETL with `{inserted, updated}` feedback; `POST /auth` → itsdangerous signed token, Bearer dependency on every route, slowapi rate limits, curl-verified 401s; CORS allow-list for Vercel origins; Railway (backend + Postgres) + Vercel deploy; backup/re-seed routine executed once; log hygiene (no transcripts/values in platform logs).
**Avoids:** Pitfalls 11 (cold starts, Postgres expiry), 13 (UI-only gate).

### Phase Ordering Rationale

- **Data first** because derivation tests are a hard PROJECT.md constraint and every later phase reads seeded data; the privacy decision is day-one-irreversible.
- **Manual dashboard before agent** because the command schema must mirror a real state shape (Anti-Pattern 3: schema diverging from state is the classic failure).
- **Text agent before voice** because it splits two hard problems (LLM reliability, browser speech quirks) into separately debuggable phases — and text fallback is a requirement anyway.
- **Auth designed in Phase 2, enforced in Phase 5** so it's a dependency from the first endpoint, not a retrofit.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Voice):** iOS Safari behavior is community-sourced MEDIUM confidence and changes across iOS releases — plan `/gsd-plan-phase --research-phase 4`; budget real-device testing as a task, and decide react-speech-recognition vs. custom ~100-line hook based on how its restart abstraction behaves on Safari.
- **Phase 3 (Agent):** mostly standard, but verify the structured-outputs API surface at implementation time — STACK.md (verified against current docs) says GA with no beta header on claude-haiku-4-5; ARCHITECTURE.md describes an older beta-header/tool-use path. Either way the Pydantic re-validation step stays.

Phases with standard patterns (skip research-phase):
- **Phase 1 (ETL/DB):** SQLAlchemy/Alembic/pandas patterns fully documented; pitfalls already enumerated with concrete tests.
- **Phase 2 (Dashboard):** Recharts + zustand are well-trodden; chart specs and axis strategy are already decided.
- **Phase 5 (Deploy):** Railway/Vercel FastAPI+Vite deploys are commodity; the CORS/auth patterns are specified in STACK.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against PyPI/npm registries and official Anthropic docs on research date |
| Features | MEDIUM-HIGH | AHA categories and BP visualization conventions verified against heart.org and peer-reviewed HCI research (HIGH); competitor inventories and VUI patterns from vendor pages/industry guides (MEDIUM) |
| Architecture | HIGH (core) / MEDIUM (voice) | Web/API/agent patterns match production NL-dashboard systems; iOS Web Speech specifics are community-sourced and need device validation |
| Pitfalls | HIGH | Verified against current sources; some Safari behaviors are iOS-version-dependent (MEDIUM) |

**Overall confidence:** HIGH

### Gaps to Address

- **iOS Safari real-device voice behavior**: community-documented, changes between iOS versions; validate the restart loop, programmatic-restart-after-gesture, and warm-up delay on real hardware in the first days of Phase 4 — the fallback is a large "resume listening" button.
- **Structured outputs GA vs. beta discrepancy**: STACK.md (GA, `messages.parse()`, no beta header) vs. ARCHITECTURE.md (beta header, forced tool-use). Confirm against current Anthropic docs when Phase 3 starts; keep Pydantic re-validation regardless.
- **Actual OMRON export format**: parsing strategy (serial dates, locale strings, separate Date/Time columns) must be verified against the real file the user adds in Phase 1; accept both `.xlsx` and `.csv`.
- **Hypotension and bradycardia-boundary conventions are project-defined, not AHA**: document explicitly (<90 systolic or <60 diastolic; pulse exactly 60 = Normal) and encode in tests.
- **Render free-tier spin-down specifics**: flagged MEDIUM in STACK.md; moot if Railway Hobby is chosen as recommended.
- **Primary device undecided**: both Chrome and iOS voice paths are required from the start (already a PROJECT.md constraint); if iOS is confirmed primary, pull real-device testing even earlier.

## Sources

### Primary (HIGH confidence)
- PyPI JSON API + npm registry (2026-07-07) — all pinned versions, peerDeps, engines
- Anthropic docs (platform.claude.com) — structured outputs, model IDs/pricing (claude-haiku-4-5)
- pandas 3.0.0 whatsnew — CoW, str dtype, Python ≥3.11 requirement
- heart.org AHA BP categories + rainbow chart; 2017/2025 ACC/AHA guidelines
- JAMIA home-BP visualization studies (PMC8340525, PMC7432548) — guideline bands, dual-line conventions
- WCAG 2.2 — target sizes, aria-live (MDN)

### Secondary (MEDIUM confidence)
- react-speech-recognition README — Safari support, continuous-listening checks, Android beeping
- lilting.ch / Andrea Giammarchi / WebAudio web-speech-api#96 — iOS Safari restart patterns, silent onresult death
- Datadog dashboard agents / Tinybird NL filters — production LLM→validated-command patterns
- OMRON Connect / SmartBP feature inventories; VUI best-practice guides
- Render free-tier spin-down and 90-day Postgres expiry articles

### Tertiary (LOW confidence)
- iOS-version-specific gesture/restart blocking behavior — validate on device, no authoritative source

---
*Research completed: 2026-07-07*
*Ready for roadmap: yes*
