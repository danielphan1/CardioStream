# Architecture Research

**Domain:** Voice-controlled personal health data dashboard (Python ETL → PostgreSQL → FastAPI → React, Claude agent, Web Speech API)
**Researched:** 2026-07-07
**Confidence:** HIGH (core web/API patterns), MEDIUM (Safari/iOS voice specifics — community-sourced, needs device validation)

## Standard Architecture

### System Overview

Voice-agent-driven dashboards follow a consistent shape across the industry (Datadog's dashboard agents, Tinybird's NL filters, and similar systems): the LLM never renders anything and never touches data directly. It is a **translator** that converts free-form text into a closed vocabulary of declarative commands, which deterministic frontend code applies to state. This is the single most important boundary in the system.

```
┌───────────────────────────── BROWSER ─────────────────────────────┐
│  ┌──────────────┐   ┌──────────────┐                              │
│  │ Voice Capture │   │  Text Input  │  ← same downstream pipeline │
│  │ (Web Speech,  │   │  (fallback)  │                              │
│  │  vendor shim) │   └──────┬───────┘                              │
│  └──────┬───────┘          │                                      │
│         └──── transcript ───┘                                      │
│                    │                                               │
│                    ▼                                               │
│  ┌──────────────────────────────────────────────┐                 │
│  │      Dashboard State (single reducer)        │                 │
│  │  { chart, dateRange, amPm, ... }             │◄── command      │
│  └──────┬───────────────────────────────────────┘    dispatch     │
│         │ state drives                                    ▲        │
│         ▼                                                 │        │
│  ┌──────────────┐   ┌──────────────┐             ┌───────┴──────┐ │
│  │   Recharts   │   │ Confirmation │             │  API Client  │ │
│  │  chart views │   │  text banner │             │ (fetch layer)│ │
│  └──────────────┘   └──────────────┘             └───────┬──────┘ │
└──────────────────────────────────────────────────────────┼────────┘
                                                            │ HTTPS + CORS
┌───────────────────────────── BACKEND ─────────────────────┼────────┐
│  ┌─────────────────────────── FastAPI ──────────────────── ▼─────┐ │
│  │  /readings   /stats   /upload   /agent      auth dependency  │ │
│  │      │          │        │         │        (shared password)│ │
│  └──────┼──────────┼────────┼─────────┼───────────────────────── ┘ │
│         │          │        │         ▼                            │
│         │          │        │   ┌────────────────┐    ┌──────────┐│
│         │          │        │   │  Agent Service │───►│ Claude   ││
│         │          │        │   │  (prompt + tool│◄───│ API      ││
│         │          │        │   │  schema +      │    │ (server- ││
│         │          │        │   │  Pydantic      │    │  side    ││
│         │          │        │   │  validation)   │    │  only)   ││
│         │          │        │   └────────────────┘    └──────────┘│
│         │          │        ▼                                      │
│         │          │  ┌────────────────┐                           │
│         │          │  │  ETL Pipeline  │  (also runs as CLI for    │
│         │          │  │  parse→derive→ │   initial seed)           │
│         │          │  │  upsert)       │                           │
│         │          │  └───────┬────────┘                           │
│         ▼          ▼          ▼                                    │
│  ┌──────────────────────────────────────┐                          │
│  │  PostgreSQL (readings + empty future │                          │
│  │  tables; Alembic migrations)         │                          │
│  └──────────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────── ┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Voice capture layer | Speech → transcript only. Owns browser quirks (vendor prefix, restart loops, permission state). Knows nothing about commands or charts. | React hook (`useSpeechRecognition`) wrapping a singleton `SpeechRecognition \|\| webkitSpeechRecognition` instance |
| Text input fallback | Alternate transcript source; feeds the **identical** pipeline as voice | Plain `<input>` + submit; calls the same `sendToAgent(transcript)` function |
| Dashboard state | Single source of truth for what's displayed: active chart + all filters. The **only** thing charts read; the **only** thing commands mutate. | `useReducer` (or Zustand) with one state object |
| Command applier | Validated command → state transition. Deterministic, no LLM involvement. Resolves relative dates (`last_n_days`) against the client clock. | Reducer case per `action` value |
| Chart views | Pure render of (state, data). No fetching, no filter logic of their own. | 4 Recharts components keyed off `state.chart` |
| API client | HTTP calls, attaches password header, maps errors to user-visible messages | Small fetch wrapper; React Query optional at this scale |
| FastAPI routers | HTTP boundary: request validation, auth dependency, response shaping | `routers/readings.py`, `stats.py`, `upload.py`, `agent.py` |
| Agent service | Transcript → Claude call (tool-use / structured output) → Pydantic validation → `{command, confirmation}` or `{error}`. Never returns raw model text as a command. | `services/agent.py` with the Pydantic command models as the schema source |
| ETL pipeline | OMRON Excel/CSV → parse → derive (BP category, MAP, AM/PM, pulse pressure, pulse category) → idempotent upsert. Pure transform functions separated from I/O so derivations are unit-testable. | `etl/parse.py`, `etl/derive.py`, `etl/load.py`; callable from both CLI and `/upload` |
| PostgreSQL | Persistent readings + empty future tables; unique natural key on reading datetime | Alembic migrations; SQLAlchemy models |
| Auth gate | Shared password check on every API route; login screen on frontend | FastAPI dependency comparing a header/cookie to an env var; frontend stores it in `sessionStorage` |

## Recommended Project Structure

```
Health-Visualizer/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # env-based settings (DATABASE_URL, ANTHROPIC_API_KEY, SITE_PASSWORD, ALLOWED_ORIGINS)
│   │   ├── auth.py              # shared-password dependency
│   │   ├── models/              # SQLAlchemy table models
│   │   ├── schemas/
│   │   │   ├── readings.py      # response models
│   │   │   └── commands.py      # ★ agent command Pydantic models (the contract)
│   │   ├── routers/             # readings, stats, upload, agent
│   │   ├── services/
│   │   │   └── agent.py         # Claude call + validation + confirmation text
│   │   └── etl/
│   │       ├── parse.py         # OMRON file → raw DataFrame
│   │       ├── derive.py        # pure functions: bp_category(), map(), am_pm()...
│   │       ├── load.py          # upsert into Postgres
│   │       └── run.py           # CLI entry: python -m app.etl.run <file>
│   ├── alembic/                 # migrations (readings + empty future tables)
│   └── tests/
│       ├── test_derive.py       # ★ required: category boundaries, MAP, AM/PM
│       ├── test_load_idempotent.py
│       └── test_agent_schema.py
├── frontend/
│   ├── src/
│   │   ├── api/                 # fetch wrapper, endpoint functions
│   │   ├── state/
│   │   │   ├── dashboardState.ts  # ★ state shape mirrors command schema
│   │   │   └── reducer.ts         # command applier
│   │   ├── hooks/
│   │   │   └── useSpeechRecognition.ts  # vendor shim + restart logic
│   │   ├── components/
│   │   │   ├── charts/          # BPTimeline, PulseTrend, BPCategories, AmPmComparison
│   │   │   ├── VoiceControl.tsx # big mic button, listening indicator
│   │   │   ├── CommandInput.tsx # text fallback
│   │   │   ├── FilterBar.tsx    # manual filter controls (mouse/keyboard fallback)
│   │   │   └── PasswordGate.tsx
│   │   └── App.tsx
│   └── .env                     # VITE_API_URL only — never API keys
└── data/                        # OMRON exports + bp_data_cleaned.csv (seed input)
```

### Structure Rationale

- **`schemas/commands.py` is the contract:** the Pydantic models used to validate Claude's output define the entire voice vocabulary. Frontend state shape and reducer cases are written to mirror it exactly (mirror as a TypeScript type by hand — the schema is small; codegen is overkill).
- **`etl/derive.py` is pure functions:** takes values, returns values, no I/O — this is what makes the required medical-categorization tests trivial to write.
- **`hooks/useSpeechRecognition.ts` quarantines browser chaos:** all Chrome/Safari divergence lives in one file; nothing else in the app knows which browser it's on.
- **Two deployable units (frontend/, backend/):** matches Vercel + Railway/Render split deployment; each has its own env config.

## Architectural Patterns

### Pattern 1: Command Schema = Declarative State Patch (the core agent pattern)

**What:** The agent's output is not "instructions" — it is a partial description of the desired dashboard state. The frontend merges it into current state. Every field is a closed enum or bounded value; nothing free-form except an optional echo of the user's request.

**When to use:** Any LLM→UI control system. This is what makes model output safe and deterministic to apply.

**Trade-offs:** Adding a new capability requires touching schema + prompt + reducer (three places), but that friction is exactly what keeps the system verifiable.

**Example:**

```python
# backend/app/schemas/commands.py
from enum import Enum
from pydantic import BaseModel, Field

class ChartId(str, Enum):
    bp_timeline = "bp_timeline"
    pulse_trend = "pulse_trend"
    bp_categories = "bp_categories"
    am_pm_comparison = "am_pm_comparison"

class AmPm(str, Enum):
    AM = "AM"; PM = "PM"; ALL = "ALL"

class DateRange(BaseModel):
    # Relative OR absolute — model picks relative when user says "last 30 days";
    # the FRONTEND resolves relative → absolute against the client clock.
    last_n_days: int | None = Field(None, ge=1, le=3650)
    start: str | None = None   # ISO date, only when user names explicit dates
    end: str | None = None

class Action(str, Enum):
    show_chart = "show_chart"
    set_filters = "set_filters"
    reset = "reset"
    clarify = "clarify"        # model couldn't map the request — ask, don't guess

class DashboardCommand(BaseModel):
    action: Action
    chart: ChartId | None = None
    date_range: DateRange | None = None
    am_pm: AmPm | None = None
    confirmation: str          # short text shown to Chris ("Showing BP for the last 30 days, mornings")
```

Key design rules verified against production NL-dashboard systems (Datadog, Tinybird):
1. **Closed vocabulary** — every controllable dimension is an enum the reducer already handles. Unknown values are impossible after validation.
2. **Model never computes dates** — "last 30 days" stays as `last_n_days: 30`; resolving to timestamps is the client's job (LLMs get timezone/clock arithmetic wrong; the frontend clock is Chris's clock).
3. **`clarify` action instead of guessing** — when the transcript doesn't map, the agent returns a question, never a best-guess mutation.
4. **`confirmation` rides along in the same payload** — one round trip yields both the state change and the accessibility-critical text feedback.

### Pattern 2: Tool Use as the JSON Extraction Mechanism

**What:** On the backend, call Claude with a single tool (`update_dashboard`) whose `input_schema` is generated from the Pydantic model (`DashboardCommand.model_json_schema()`), and `tool_choice={"type": "tool", "name": "update_dashboard"}` to force a tool call. Then re-validate the returned `input` with `DashboardCommand.model_validate()`.

**When to use:** This is the standard, GA-supported way to get schema-shaped JSON from Claude on all current models. Anthropic also ships **Structured Outputs** (beta header `structured-outputs-2025-11-13`, Sonnet 4.5/Opus 4.1 as of late 2025) which grammar-constrains generation for guaranteed compliance — use it if available for your chosen model, but **keep the Pydantic validation step regardless**. The project constraint ("never execute raw model output") means validation is defense-in-depth, not redundancy.

**Trade-offs:** Forced tool choice means the model can't reply conversationally — which is exactly right here; the `clarify` action covers the "I don't understand" case inside the schema.

**Example:**

```python
# backend/app/services/agent.py
tool = {
    "name": "update_dashboard",
    "description": "Apply a chart/filter change to Chris's health dashboard",
    "input_schema": DashboardCommand.model_json_schema(),
}
resp = client.messages.create(
    model=MODEL, max_tokens=500,
    system=SYSTEM_PROMPT,          # lists charts, filters, today's date, examples
    tools=[tool],
    tool_choice={"type": "tool", "name": "update_dashboard"},
    messages=[{"role": "user", "content": transcript}],
)
raw = next(b.input for b in resp.content if b.type == "tool_use")
command = DashboardCommand.model_validate(raw)   # ValidationError → 422 with friendly message
return command
```

### Pattern 3: Transcript-Source Convergence (voice and text are the same pipeline)

**What:** Voice capture and the text input box both terminate in one function: `sendToAgent(transcript: string)`. Everything downstream — POST `/agent`, dispatch, confirmation display — is shared.

**When to use:** Always, for this project. It makes the text box a true equal-fidelity fallback (Firefox, noisy rooms, Speech API failures) and, critically, lets you **build and test the entire agent pipeline before any voice code exists**.

**Trade-offs:** None meaningful.

### Pattern 4: Quarantined Cross-Browser Voice Hook

**What:** One hook owns all Web Speech API behavior and exposes only `{ isListening, start, stop, error }` plus a transcript callback. Inside it:

- Feature-detect: `const SR = window.SpeechRecognition || window.webkitSpeechRecognition` (Chrome exposes prefixed too; Safari is prefixed-only).
- **Singleton instance** — creating a new recognizer per utterance causes the iOS system chime and first-recognition failures.
- **Do not rely on `continuous: true` on iOS.** Community-verified behavior: iOS Safari's continuous mode stops firing `onresult` without firing `onend`/`onerror` (silent death), and accumulates one ever-growing result string. The stable pattern is: detect iOS → `continuous = false` → in `onend`, if a `shouldBeListening` ref is true, restart after ~200–300ms delay. On Chrome, `continuous = true` works but still auto-stops after prolonged silence, so the same restart-on-`onend` loop is the universal implementation — Chrome just restarts less often.
- The caregiver's initial tap satisfies the user-gesture requirement; the restart loop keeps the session alive hands-free afterward. Show a persistent, high-contrast "Listening" indicator so silent failures are visible.

**When to use:** This exact project constraint set (continuous hands-free sessions + Safari/iOS support).

**Trade-offs:** The restart loop briefly drops audio between utterances (~200ms) — acceptable for discrete voice commands, unacceptable for dictation (not needed here). MEDIUM confidence: iOS behavior is community-documented, changes across iOS versions, and must be validated on real hardware early.

### Pattern 5: Idempotent ETL via Natural-Key Upsert (parse → derive → upsert)

**What:** Three-stage pipeline where re-running on the same or overlapping file leaves the DB unchanged.

1. **Parse:** OMRON Excel/CSV → normalized DataFrame (column mapping, type coercion, drop empty rows).
2. **Derive:** pure functions add `am_pm`, `bp_category`, `pulse_category`, `map`, `pulse_pressure` — computed here and only here (single source of truth; matches the existing cleaned CSV).
3. **Upsert:** `INSERT ... ON CONFLICT (datetime) DO UPDATE` against a **unique constraint on the reading `datetime`** (the natural key of an OMRON export — one cuff reading per timestamp). `DO UPDATE` (not `DO NOTHING`) so corrected notes/values in a re-export win. Report `{inserted, updated}` counts back to the uploader.

```sql
ALTER TABLE readings ADD CONSTRAINT uq_readings_datetime UNIQUE (datetime);
```

```python
# etl/load.py — SQLAlchemy dialect insert
stmt = pg_insert(readings).values(rows)
stmt = stmt.on_conflict_do_update(
    index_elements=["datetime"],
    set_={c: stmt.excluded[c] for c in DERIVED_AND_VALUE_COLS},
)
```

**When to use:** Any file-re-upload ingest. OMRON exports are cumulative (each export contains all history), so overlap on every upload is the normal case, not the edge case.

**Trade-offs:** If two genuine readings ever share an exact timestamp (unlikely with a cuff), the second silently overwrites — acceptable here; note it in upload results. Use SQLite's `ON CONFLICT` (same syntax family) for local dev, or run Postgres locally via Docker to avoid dialect drift.

## Data Flow

### Voice Command Flow (end to end)

```
Caregiver taps mic (user gesture)
    ↓
useSpeechRecognition: SR.start(), continuous session via restart-on-onend loop
    ↓  onresult (final transcript)
sendToAgent(transcript)                       ← text input box enters here too
    ↓  POST /agent  { transcript }            (+ password header)
FastAPI /agent → services/agent.py
    ↓  Claude API: system prompt (charts/filters/today's date/examples)
    ↓             + forced tool_use on DashboardCommand schema
    ↓  tool_use.input  →  DashboardCommand.model_validate()   ← reject ≠ apply
    ↓  200 { action, chart, date_range, am_pm, confirmation }
Frontend: dispatch(command)
    ↓  reducer merges into dashboard state
    ↓  (resolves last_n_days → concrete [start, end] using client clock)
State change triggers:
    ├── chart component swap / filter re-application → Recharts re-render
    └── confirmation text displayed in large, high-contrast banner
```

Failure paths (must be first-class): SpeechRecognition error → visible message + text-box prompt; Pydantic validation failure → 422 → "I didn't understand that, try…"; `action: clarify` → show the model's question; API/network error → banner, state untouched. **State never changes unless a fully validated command arrives.**

### Reading Data Flow

```
GET /readings?start=&end=&am_pm=   →  SQL filter  →  JSON rows
```

At 132 rows (growing slowly), **fetch the full dataset once on load and filter client-side in the reducer/selectors**. This makes voice commands apply instantly (no fetch round-trip per command) and simplifies state. Keep the server-side filter params on `/readings` anyway — they're cheap, correct API design, and the portfolio story — but the dashboard doesn't need to call them per command. Revisit only if data grows to tens of thousands of rows.

### Ingest Flow

```
Caregiver: file picker → POST /upload (multipart)
    → save temp file → etl.run(file) → parse → derive → upsert
    → { inserted: 12, updated: 120 } → shown in UI
Initial seed: python -m app.etl.run data/omron_export.xlsx  (same code path, CLI)
```

### State Management

One reducer, one state object — the command schema and the state shape are two views of the same design:

```typescript
interface DashboardState {
  chart: ChartId;                       // mirrors DashboardCommand.chart
  dateRange: { start: Date; end: Date } | null;  // resolved, absolute
  amPm: "AM" | "PM" | "ALL";
  readings: Reading[];                  // full dataset, fetched once
  lastConfirmation: string | null;
  listening: boolean;
}
```

Manual filter controls (FilterBar) dispatch the **same actions** as agent commands — voice, text-agent, and mouse are three input sources for one state machine.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1 patient, ~130 rows, handful of users) | Everything above is sufficient. Fetch-all + client filtering. Free/hobby tiers on Vercel + Railway/Render fine. |
| 10k+ readings (years of data + future vitals) | Switch dashboard to server-side filtered fetches keyed on state; add index on `readings(datetime)` (already unique). |
| Multi-patient (explicitly out of scope) | Would require real auth + patient_id foreign keys everywhere — this is the "don't build it now, don't preclude it" line the empty future tables already respect. |

### Scaling Priorities

1. **First real bottleneck:** Render/Railway free-tier cold starts (backend sleeps; first voice command of a session takes 20–50s). Mitigate with a paid hobby tier or a wake-up ping when the password gate is passed — matters a lot for a voice-first UX.
2. **Second:** Claude API latency per command (~1–3s). Acceptable for v1; if it grates, add a client-side fast path that pattern-matches trivial commands ("show pulse") before falling through to the agent.

## Anti-Patterns

### Anti-Pattern 1: LLM Output Applied Directly (or LLM generates SQL/chart config)

**What people do:** Have the model return arbitrary JSON/SQL/JSX and interpret or execute it.
**Why it's wrong:** Model output is untrusted input (a hard project constraint); freeform output is unverifiable, injectable, and non-deterministic to apply.
**Do this instead:** Closed enum command vocabulary, forced tool use, Pydantic validation, reducer application. The model chooses from options; it never authors behavior.

### Anti-Pattern 2: Frontend Calls Claude Directly

**What people do:** Put the Anthropic key in the React app "to save a hop."
**Why it's wrong:** Key exposure in a public bundle; also loses the server-side validation choke point.
**Do this instead:** All Claude traffic through `/agent`; only `VITE_API_URL` in frontend env.

### Anti-Pattern 3: Command Schema Diverges from Dashboard State

**What people do:** Design the agent's JSON independently of frontend state, then write a translation layer full of special cases.
**Why it's wrong:** Every mismatch is a bug surface; commands become non-deterministic to apply.
**Do this instead:** Build the dashboard with manual controls **first**; the state shape those controls mutate *is* the command schema. Agent capability = exactly what the UI can already do.

### Anti-Pattern 4: LLM Resolves Dates and Derived Values

**What people do:** Prompt the model to output absolute timestamps for "last 30 days," or to classify BP categories in the agent.
**Why it's wrong:** Wrong clock/timezone, non-reproducible; and medical categorization must come from the tested ETL functions, nowhere else.
**Do this instead:** Relative ranges in the schema, resolved by client code; derived medical fields computed once in `etl/derive.py` and stored.

### Anti-Pattern 5: Trusting `continuous: true` Cross-Browser

**What people do:** Set `continuous = true`, ship, works on desktop Chrome, silently dies on iOS.
**Why it's wrong:** iOS Safari stops delivering results without any error/end event; Chrome auto-stops on prolonged silence.
**Do this instead:** Universal restart-on-`onend` loop guarded by a `shouldBeListening` ref; singleton recognizer; visible listening indicator; test on a real iPhone in the same phase the hook is built.

### Anti-Pattern 6: Append-Only or Truncate-and-Reload ETL

**What people do:** `df.to_sql(if_exists="append")` (duplicates every re-upload, since OMRON exports are cumulative) or `if_exists="replace"` (drops constraints, races readers).
**Do this instead:** Natural-key upsert (Pattern 5).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API | Backend-only; forced tool use against Pydantic-generated JSON schema; optionally Structured Outputs beta (`structured-outputs-2025-11-13`, Sonnet 4.5) for grammar-guaranteed JSON | Always re-validate with Pydantic regardless; key in Railway/Render env var |
| Web Speech API | Browser-native; vendor-prefix shim; audio goes to Google (Chrome) / Apple (Safari) servers — note this in privacy posture | Requires HTTPS + user gesture; unavailable in Firefox → text fallback |
| Vercel (frontend) | Static Vite build; `VITE_API_URL` env per environment | No secrets in frontend env |
| Railway/Render (backend + Postgres) | FastAPI + managed Postgres; `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SITE_PASSWORD`, `ALLOWED_ORIGINS` env vars | CORS middleware must allow-list the exact Vercel origin (including preview URLs if used); cold starts on free tier hurt voice UX |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Voice hook ↔ agent pipeline | Transcript string only | Hook knows nothing about commands |
| Frontend ↔ backend | JSON over HTTPS; password header on every request | The `DashboardCommand` JSON shape is the shared contract — mirror it as a TS type |
| Agent service ↔ Claude | Tool schema derived from `schemas/commands.py` | One source of truth for the vocabulary |
| /upload router ↔ ETL | Direct function call (same process) | Also invokable as CLI for seeding; no queue needed at this scale |
| ETL ↔ Postgres | Upsert on `UNIQUE (datetime)` | Idempotency lives in the DB constraint, not application logic |
| Charts ↔ state | Read-only selectors | Charts never fetch or filter independently |

## Suggested Build Order (dependency-driven)

The dependencies force a specific sequence; the key non-obvious ordering is **dashboard before agent, agent before voice**:

1. **Schema + ETL + seed** — Alembic migrations (readings unique-keyed + empty future tables), `parse/derive/load`, derivation tests (required constraint), seed the 132 readings via CLI. *Everything downstream needs real data; derivation tests are cheapest before anything depends on them.*
2. **Read API** — `/readings` (filters) + `/stats`. *Trivially verifiable against known seed data.*
3. **Dashboard with manual controls** — four Recharts views + FilterBar + the state reducer, accessibility baked in (targets, contrast, font sizes). *This step defines the state shape, which defines the command schema — building the agent first would mean designing the contract against an imaginary UI.*
4. **Agent via text input** — `schemas/commands.py`, `/agent`, Claude tool-use call, text box wired to `sendToAgent`, reducer accepts commands. *Full agent pipeline exercised and debuggable with zero voice complexity; the text fallback requirement is satisfied as a side effect.*
5. **Voice capture** — `useSpeechRecognition` hook, Chrome first, then iOS Safari restart-loop hardening on a real device. *Purely additive: it produces transcripts into an already-working pipeline, so voice bugs are isolated from agent bugs.*
6. **Upload + password gate + deploy** — `/upload` endpoint (reuses ETL), auth dependency + PasswordGate, CORS/env config, Vercel + Railway/Render. *Gate must land before or with deployment (real health data); upload can trail because the seed CLI covers data needs until then.*

Steps 1–2 and 3 can partially overlap (mock data for chart layout), but the state shape must be settled before step 4 starts.

## Sources

- [Anthropic — Structured outputs (official docs)](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — beta header, model availability, tool-use vs JSON-output distinction (HIGH)
- [Instructor — Anthropic structured outputs with Pydantic](https://python.useinstructor.com/integrations/anthropic/) — tool-use + Pydantic validation pattern (HIGH)
- [Datadog — Building reliable dashboard agents](https://www.datadoghq.com/blog/llm-observability-at-datadog-dashboards/) — NL → validated widget/dashboard JSON in production (MEDIUM)
- [Tinybird — Natural language dashboard filters](https://www.tinybird.co/blog/natural-language-dashboard-filters) — LLM emitting structured filter params for a dashboard API (MEDIUM)
- [Towards Data Science — JSON mode vs function calling for structured output](https://towardsdatascience.com/structured-outputs-with-llms-json-mode-function-calling-and-when-to-use-each/) (MEDIUM)
- [lilting.ch — Stabilizing the WebSpeech API on iOS](https://lilting.ch/en/articles/ios-webspeech-api-tips) — singleton instance, continuous=false + restart-on-onend with delay, mic warm-up (MEDIUM, community; validate on device)
- [Andrea Giammarchi — Taming the Web Speech API](https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1) — continuous-mode behavior divergence Chrome vs iOS (MEDIUM)
- [WebAudio/web-speech-api issue #96 — Safari SpeechRecognition problems](https://github.com/WebAudio/web-speech-api/issues/96) — silent onresult death on Safari (MEDIUM)
- [PostgreSQL upsert patterns — ON CONFLICT idempotency](https://viprasol.com/blog/postgres-upsert-patterns/) and [QueryPlane — INSERT ON CONFLICT in practice](https://queryplane.com/docs/blog/postgres-upsert) — natural-key requirement for idempotent re-runs (MEDIUM, matches PostgreSQL official semantics)
- [pangres — pandas upsert helper](https://pypi.org/project/pangres/) — DataFrame ON CONFLICT loading option (MEDIUM)

---
*Architecture research for: voice-controlled personal health dashboard*
*Researched: 2026-07-07*
