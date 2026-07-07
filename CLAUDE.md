<!-- GSD:project-start source:PROJECT.md -->
## Project

**Health Visualizer — Chris's Health Dashboard**

A personal health data dashboard website for a single user: Chris, a C4 quadriplegic individual (wheelchair user since 1997, limited/no hand mobility) who has been tracking blood pressure, pulse, and other health metrics since early 2025. It replaces an earlier Tableau Public prototype with a voice-controlled web app: Chris asks for views of his data hands-free ("show me my blood pressure for the last 30 days, mornings only") and the dashboard responds. His wife/caregivers also use the site to enter new data.

This is also a portfolio project for the builder, demonstrating data engineering, software engineering, and applied AI on a consistent Python + React stack.

**Core Value:** Chris can see and explore his own health data entirely by voice — voice interaction is the primary input method, not a gimmick. Every feature must be operable by voice; mouse/keyboard is the fallback, not the default.

### Constraints

- **Tech stack (fixed — do not substitute)**: PostgreSQL (SQLite acceptable for local dev), Python + Pandas ETL, FastAPI backend, React (Vite) frontend, Recharts, Web Speech API voice input, Claude API (Anthropic) agent, Vercel + Railway/Render hosting — single consistent Python/React stack is a portfolio requirement
- **Security**: Claude agent must return JSON only, validated with Pydantic on the backend; never execute raw model output — model output is untrusted input
- **Security**: API keys live in environment variables, never in frontend code; all Claude calls go through the backend — keys must not be exposable
- **Privacy**: No analytics trackers, no third-party data sharing, DB not publicly exposed, shared-password gate before the deployed site — health data is sensitive
- **Accessibility (non-negotiable)**: All primary actions reachable by voice; ≥48px click targets; high contrast; ≥18px body fonts; keyboard navigable as fallback; no drag, hover-only, or precise-pointing interactions — the primary user cannot use standard input devices
- **Quality**: Tests required for ETL derivations (BP category boundaries, MAP calculation, AM/PM logic) — derived medical categorizations must be correct
- **Compatibility**: Voice input must work on Chrome/Edge and Safari/iOS (webkit-prefixed) — Chris's primary device is undecided
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies — Backend (Python)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12 (3.13 also fine) | Runtime | pandas 3.x requires ≥3.11; 3.12 has universal wheel coverage on Railway/Render buildpacks. Don't use 3.10 (pandas 3 won't install). |
| FastAPI | 0.139.x | API framework | Current release; native Pydantic v2 integration. Use `fastapi[standard]` extra for uvicorn + python-multipart in one install. |
| Pydantic | 2.13.x | Validation (agent command schema, API models) | v2 is the only line FastAPI 0.1xx supports well. The agent's JSON command schema is a Pydantic model — same model doubles as the Claude structured-output schema. |
| SQLAlchemy | 2.0.x (2.0.51 current) | ORM / DB access | **Use SQLAlchemy 2.0 typed declarative (`Mapped[]` / `mapped_column`), not raw SQL.** One codebase runs on SQLite (dev) and Postgres (prod) — raw SQL would fork into two dialects. Use **sync** engine; app is single-user, async DB adds complexity for zero benefit (FastAPI runs sync endpoints in a threadpool). |
| Alembic | 1.18.x | Migrations | Required by PROJECT.md ("future tables migrated but empty"). Standard companion to SQLAlchemy; autogenerate from the declarative models. |
| psycopg | 3.3.x (`psycopg[binary]`) | Postgres driver | psycopg 3 is the current-generation driver; SQLAlchemy URL `postgresql+psycopg://`. **Do not use psycopg2** (maintenance mode, no reason for new projects). |
| pandas | 3.0.x (3.0.3 current) | ETL derivations | pandas 3.0 shipped Jan 2026 and is stable at patch .3. Greenfield project should start on 3.x: default `str` dtype, Copy-on-Write always on (no `SettingWithCopyWarning`, chained assignment is dead — write `df.loc[...] = ...`). |
| openpyxl | 3.1.x | Read OMRON `.xlsx` exports | The engine `pd.read_excel` uses for xlsx; must be installed explicitly. |
| anthropic | ≥0.116.0 | Claude API SDK | Use `client.messages.parse(..., output_format=CommandModel)` — see agent pattern below. |
| uvicorn | 0.50.x (`uvicorn[standard]`) | ASGI server | Standard FastAPI server on Railway/Render. |
### Core Technologies — Frontend (React)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Toolchain runtime | Vite 8 requires `^20.19.0 || >=22.12.0`; 22 is the active LTS. |
| React + react-dom | 19.2.x | UI framework | Current stable; all companions below support 19. |
| Vite | 8.x (8.1.3 current) | Build tool / dev server | Current major; Rolldown-based bundler (faster builds, drop-in). If an obscure plugin breaks, Vite 7 is the fallback — but the plugins here (`@vitejs/plugin-react` 6.x) are compatible. |
| TypeScript | ~5.9 | Types | Recommended for the portfolio goal and for typing the agent command schema on the frontend. TS 6.0 shipped very recently — stay on 5.9 until ESLint/tooling settles (Vite strips types either way, so this is zero-risk to revisit). |
| Recharts | 3.9.x | Charts | v3 is current; **`accessibilityLayer` is true by default in v3** — arrow-key navigation of data points and screen-reader roles for free. React 19 supported (peerDeps verified). ReferenceLine covers the 60 bpm bradycardia threshold; ResponsiveContainer for layout. |
| react-speech-recognition | 4.0.1 | Web Speech API wrapper | v4 (Mar–Apr 2025) modernized the library; peerDep `react >=16.8` so React 19 works. Handles the `webkitSpeechRecognition` prefix, transcript state, and exposes `browserSupportsSpeechRecognition` and `browserSupportsContinuousListening` — exactly the Chrome-vs-Safari capability checks this project needs. See voice notes below. |
| zustand | 5.0.x | Dashboard filter/command state | Voice commands mutate one central store (active chart, date range, AM/PM filter); every component subscribes. Zustand is the smallest store that lets the agent-response handler set state from outside the React tree. Redux is overkill; prop-drilling/context churns re-renders. |
| @tanstack/react-query | 5.x | Server state (readings, stats) | Caches `/readings` responses per filter combination, handles loading/error states, refetch after upload. Keeps server data out of the zustand store (clean separation: zustand = UI/filter state, Query = server data). |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-multipart | 0.0.3x | File upload parsing | Required by FastAPI `UploadFile` (included in `fastapi[standard]`). |
| itsdangerous | 2.2.x | Signed tokens for password gate | Sign a timestamped token on successful password check; verify in a FastAPI dependency. Simpler than PyJWT for one shared secret (no claims needed). |
| slowapi | 0.1.x | Rate limiting | Optional but cheap insurance on `/agent` (Claude API cost) and `/auth` (password brute-force) endpoints. |
| pytest | 9.x | Backend tests | Required for ETL derivation tests (BP category boundaries, MAP, AM/PM). pytest 9 is current major. |
| httpx | 0.28.x | FastAPI TestClient dependency + async HTTP | `TestClient` requires httpx. |
| tailwindcss | 4.x | Styling (optional, recommended) | Fast way to enforce the accessibility constraints (48px targets, 18px+ text, contrast) consistently; v4 uses the CSS-first config with `@tailwindcss/vite` plugin. Plain CSS is acceptable if preferred. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Ruff | 0.15.x | Python lint + format (replaces black/flake8/isort in one tool). |
| Vitest | 4.x | Frontend unit tests; native Vite integration. Pair with @testing-library/react. |
| ESLint | 10.x + typescript-eslint | Vite's `react-ts` template scaffolds this. |
| Alembic CLI | Migrations | `alembic revision --autogenerate` from SQLAlchemy models; create the empty labs/incidents/procedures tables as a second migration. |
## Key Configuration Decisions (the open questions)
### 1. Claude agent: use structured outputs, not prompt-and-parse
- **Model: `claude-haiku-4-5`** ($1/$5 per MTok, fastest, supports structured outputs). Intent parsing over a small fixed command vocabulary does not need Sonnet/Opus. Latency matters most here — Chris is waiting on a voice round-trip.
- This satisfies the "Pydantic-validated JSON only" security constraint *at the API level* — the model literally cannot emit non-conforming JSON.
- Caveats from official docs: handle `stop_reason == "refusal"` (output may not match schema); compare enum values case-insensitively; schemas cannot use numeric min/max constraints (validate ranges locally after parse).
- First request per schema has grammar-compilation latency; cached 24h after — warm it at startup if cold-start latency matters.
### 2. Voice: react-speech-recognition wrapper + explicit Safari handling
- **Safari/iOS auto-stops on silence.** Continuous listening is unreliable there; check `browserSupportsContinuousListening` and, when false, restart recognition in the `onend`/listening-state change handler to simulate a continuous session (the caregiver's initial tap satisfies the user-gesture requirement; subsequent programmatic restarts within the session generally work, but test on real iOS — this is the project's #1 device-test risk).
- **Chrome desktop/Edge:** `SpeechRecognition.startListening({ continuous: true })` works as designed.
- **Chrome on Android:** beeps on every mic restart (documented in the library README) — if an Android device becomes the target, this affects UX.
- If you hit `regeneratorRuntime is not defined` under Vite, `npm i regenerator-runtime` and import it once in `main.tsx` (documented troubleshooting; may not be needed with v4 + modern browserslist).
- The library was last published Apr 2025 (slow but not dead). If its restart abstraction fights you on Safari, a custom ~100-line hook over raw `webkitSpeechRecognition` is a reasonable escape hatch — the fixed constraint is Web Speech API, not the wrapper.
### 3. Password gate: signed Bearer token, NOT cross-site cookies
### 4. CORS + deployment (Railway recommended over Render)
- No `allow_credentials=True` needed with Bearer tokens (and it forbids wildcard origins anyway).
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (both platforms inject `PORT`).
- **Prefer Railway (Hobby, ~$5/mo) over Render free tier**: Render free web services spin down after inactivity → ~1 min cold start on Chris's first request, which is a bad experience for this user. Railway keeps the service warm and bundles Postgres provisioning (`DATABASE_URL` injected). Render paid tier is an equivalent fallback.
- Config via `pydantic-settings` (BaseSettings) reading env vars: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SITE_PASSWORD`, `TOKEN_SECRET`, `CORS_ORIGINS`.
- SQLite locally: `DATABASE_URL=sqlite:///./dev.db` — same SQLAlchemy models; keep column types portable (use `Numeric`, `DateTime`, `Text` — all fine on both).
## Installation
# Backend (Python 3.12+, in a venv or uv project)
# Frontend (Node 22)
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SQLAlchemy 2.0 ORM (sync) | Raw SQL / asyncpg | Never here — SQLite/Postgres portability and Alembic autogenerate depend on the ORM; async adds complexity for a single-user app |
| `messages.parse()` structured outputs | Forced tool-use JSON trick | Only if pinned to a pre-4.5 model (all current models support structured outputs GA) |
| react-speech-recognition | Custom hook over raw `webkitSpeechRecognition` | If the library's continuous-restart behavior fights Safari testing; ~100 LOC, keep as escape hatch |
| zustand | useReducer + Context | Fine for very small state, but agent handler mutating state outside the tree is cleaner with a store |
| itsdangerous signed token | PyJWT | If you later need claims/expiry semantics beyond a timestamp |
| Railway | Render (paid) | If Railway pricing/region is a problem; avoid Render free tier (spin-down cold starts) |
| claude-haiku-4-5 | claude-sonnet-5 | If intent parsing accuracy proves insufficient in testing (unlikely for a 4-chart command vocabulary; costs 3x) |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| psycopg2 / psycopg2-binary | Maintenance mode; psycopg3 is the current driver with SQLAlchemy 2.0 support | `psycopg[binary]` 3.3.x, URL `postgresql+psycopg://` |
| pandas 2.x idioms (chained assignment, `inplace` reliance) | pandas 3.0 CoW makes chained assignment a no-op; `SettingWithCopyWarning` removed | `df.loc[mask, "col"] = ...`; treat every op as returning a copy |
| Prompt-engineering "return only JSON" + `json.loads` | Fragile; structured outputs are GA and guarantee schema-valid JSON | `client.messages.parse(output_format=Model)` |
| Cookie-based session for the password gate | Cross-origin Vercel↔Railway + Safari ITP third-party cookie blocking = breaks on the likely primary device | Signed Bearer token in localStorage |
| Recharts 2.x | v3 changed internals (no UNSAFE lifecycle, accessibilityLayer default on); starting on 2.x means a migration later | Recharts 3.9.x |
| Create React App / react-scripts | Deprecated | Vite 8 `react-ts` template |
| Calling Anthropic from the frontend | Exposes API key | All Claude calls via FastAPI `/agent` (fixed constraint, restated because it's load-bearing) |
| Render free tier for the backend | Spin-down after inactivity → ~1 min cold start for Chris | Railway Hobby or Render paid |
| Numeric `minimum`/`maximum` in the agent's JSON schema | Not supported by structured-outputs constrained sampling | Validate ranges in Pydantic after parse (plain validators run locally) |
## Stack Patterns by Variant
- Budget a phase task for real-device voice testing early (auto-stop restart loop, Apple-server transcription latency, mic permission persistence).
- Keep the text-input fallback prominent, not hidden.
- Same pandas module either way — structure ETL as a pure function `raw_df -> clean_df` imported by both the CLI seeder and the FastAPI upload route, so the pytest suite covers both paths.
- Pin `vite@^7` — no code changes; Rolldown is drop-in.
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| pandas 3.0.x | Python ≥3.11, NumPy ≥1.26 | Blocks Python 3.10 — pick 3.12/3.13 runtime |
| FastAPI 0.139 | Pydantic 2.x only | Pydantic v1 unsupported in this range |
| SQLAlchemy 2.0.51 | psycopg 3.3 (`postgresql+psycopg://`), SQLite stdlib | Same models both DBs |
| Vite 8.1 | Node ^20.19 or ≥22.12 | Use Node 22 LTS; Rolldown bundler built-in |
| Recharts 3.9 | React 16.8–19 (peerDeps verified) | `accessibilityLayer` default true |
| react-speech-recognition 4.0.1 | React ≥16.8 (works with 19) | Last publish Apr 2025; only dep is lodash.debounce |
| anthropic ≥0.116 | Python ≥3.9; `messages.parse()` + `output_format` | Structured outputs GA on claude-haiku-4-5 and newer |
| fastapi TestClient | httpx | httpx required for tests |
## Sources
- PyPI JSON API (2026-07-07) — verified latest: fastapi 0.139.0, pydantic 2.13.4, sqlalchemy 2.0.51, alembic 1.18.5, anthropic 0.116.0, pandas 3.0.3, psycopg 3.3.4, uvicorn 0.50.2, pytest 9.1.1, itsdangerous 2.2.0, ruff 0.15.20 — HIGH
- npm registry (2026-07-07) — verified latest + peerDeps/engines: react 19.2.7, vite 8.1.3 (node ^20.19||>=22.12, rolldown dep), recharts 3.9.2 (React 19 peerDep), react-speech-recognition 4.0.1 (published 2025-04-29, react>=16.8), zustand 5.0.14, @tanstack/react-query 5.101.2, vitest 4.1.10 — HIGH
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs — structured outputs GA, `messages.parse()` + `output_format` Pydantic pattern, schema limitations, refusal/enum caveats — HIGH
- https://platform.claude.com/docs/en/about-claude/models/overview — model IDs and pricing; claude-haiku-4-5 = $1/$5 MTok, fastest, structured-outputs capable — HIGH
- https://pandas.pydata.org/docs/whatsnew/v3.0.0.html — pandas 3.0 released 2026-01-21; str dtype default, CoW, Python ≥3.11 — HIGH
- https://github.com/JamesBrill/react-speech-recognition — README: Safari 14.1+ native support, `browserSupportsContinuousListening`, Chrome Android beeping caveat, regenerator-runtime troubleshooting — MEDIUM-HIGH
- https://github.com/recharts/recharts/wiki (accessibility + 3.0 migration guide, via search) — `accessibilityLayer` default true in v3, arrow-key navigation, tooltip keyboard gaps on some chart types — MEDIUM
- Render free-tier spin-down behavior — training knowledge consistent with Render docs; flagged for confirmation at deploy time — MEDIUM
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
