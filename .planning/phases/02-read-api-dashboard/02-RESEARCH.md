# Phase 2: Read API & Dashboard - Research

**Researched:** 2026-07-14
**Domain:** FastAPI read endpoints + React 19/Vite 8 dashboard (Recharts 3, zustand 5, TanStack Query 5, Tailwind 4)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project-wide directive (supersedes earlier wording)**
- **D-01:** **The Tableau prototype is no longer a reference.** This is a standalone project — do not consider Tableau as an example for anything (layout, styling, header) for the rest of the project. The four chart *types* remain (they're requirements), but DASH-11's "matching the Tableau prototype styling" and the roadmap's "matching the Tableau prototype" wording are overridden: the header is simply "Chris's Health Dashboard" styled per the nautical theme below.

**Chart presentation**
- **D-02:** Layout is **one large hero chart + three live mini previews in a row below it**. Clicking/tapping a mini rotates it into the hero slot; the former hero becomes a mini. Minis are real Recharts renders (not sparklines/icons) and update with the active filters.
- **D-03:** **BP Timeline is the default hero** on load.
- **D-04:** Rotation uses a **quick animated swap (~200–300ms)** so the movement is legible; falls back to instant under `prefers-reduced-motion`.
- **D-05:** **Fixed clinical y-axes**: BP charts always span ~40–220 mmHg; pulse always ~30–120 bpm. Visual positions stay meaningful across filter changes — no auto-fit rescaling.
- **D-06:** Line charts show a **visible dot at every reading** (discrete batch-uploaded measurements, not continuous data) — dots double as tap targets.
- **D-07:** Systolic/diastolic lines identified by **direct large-text labels at the line ends** in the line's color — no legend box.
- **D-08:** AHA category bands behind the BP Timeline are **subtle low-opacity tinted zones with small edge labels**; the data lines stay the visual star.
- **D-09:** Point inspection is **click/tap (generous hit area) + keyboard arrows** via Recharts `accessibilityLayer`; large-text tooltip persists until dismissed. Never hover-only.
- **D-10:** BP Categories bars are labeled with **count + percent** (e.g. "Stage 1 — 34 readings (26%)"), matching the stats strip.
- **D-11:** Zero-result filter combinations show a **guided empty state**: why it's empty, the newest-reading date, and a big "Show all data" button. Never auto-widen the user's chosen range.

**Visual style & colors (nautical theme)**
- **D-12:** **Naval/nautical theme** — sailboats, ocean, water. Ocean-like colors, minimalistic: pastels + navy.
- **D-13:** **Pastels are canvas only**: pastel ocean tones (foam, seafoam, pale sky) for backgrounds, cards, surfaces. **Navy and deep tones carry all text, data lines, and interactive elements** — this is how the theme coexists with the non-negotiable high-contrast constraint (WCAG-safe contrast wherever information lives).
- **D-14:** BP category colors **keep clinical semantics** — recognizable green/yellow/orange/red severity (plus blue-grey Hypotension), tuned deeper/slightly desaturated to harmonize with the ocean palette. Never recolor severity into an ocean ramp.
- **D-15:** **Both light and dark themes ship in this phase** with a large accessible toggle. Light = airy nautical (pale foam/sky + navy); dark = "night sea" (navy-black + light text + pastel accents, contrast-checked). Theme toggle becomes a voice command later.
- **D-16:** Nautical imagery is **subtle motifs only**: a sailboat/anchor mark in the header, wave-curve section dividers, nautically-styled empty states. Chart canvases stay clean — no illustrations behind data.

**Filter controls**
- **D-17:** Date presets (7/30/90 days/All) are a **segmented row of four large buttons**, active one filled navy — state always visible, each button maps 1:1 to a future voice command.
- **D-18:** Custom date range uses **From/To fields opening an oversized calendar picker with ≥48px day cells**, plus direct typed entry for keyboard users.
- **D-19:** AM/PM and BP category are **single-select button groups**: AM/PM as `[All | AM | PM]` segmented buttons; categories as one row of large chips — tap to isolate a category, tap again to return to all. No multi-select (keeps state and voice phrasing simple).
- **D-20:** Filters live in a **horizontal bar between the header and the hero chart**, wrapping on narrow screens — current filter state is always glanceable.

**Stats strip & readings table**
- **D-21:** Stats strip shows **the full `/stats/summary` payload**: avg/min/max for systolic, diastolic, and pulse; reading count; and % per category for the current filter set (API-02 rendered as tiles).
- **D-22:** Stats strip sits **between the filter bar and the hero chart** — set a filter, see the numbers, then the chart shape.
- **D-23:** Readings table shows the **newest 20 rows with a giant "Show 20 more" button** — no pagination chrome, no inner scrollbars. Newest-first sort.
- **D-24:** Table columns: **Date, Time, AM/PM, BP as "128 / 74", Pulse, and a BP-category chip** in the category's clinical color with contrast-safe text; Notes shown only when present. MAP/pulse-pressure/pulse-category are not table columns.

### Claude's Discretion
- Exact pastel/navy hex values and the contrast-validated palette (must pass WCAG at ≥18px text), exact fixed-axis bounds, tooltip layout, animation easing, wave-divider implementation, table "Show more" increment mechanics, API response JSON shapes and query-param validation details, zustand store shape internals (as long as it cleanly maps to chart + date range + am/pm + category), where the readings table and AM/PM chart sit below the fold, responsive breakpoints. The `dataviz` skill and a `/gsd-ui-phase 2` UI-SPEC (roadmap hints UI: yes) can refine visuals within these locked decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | `GET /readings` filterable by start_date, end_date, am_pm, bp_category | Shared `ReadingFilters` FastAPI dependency pattern (Code Example 1); canonical category labels verified in `backend/app/derivations.py`; end-date inclusivity pitfall documented |
| API-02 | `GET /stats/summary` — averages, min/max, counts, per-category counts for the filter set | Single-query SQLAlchemy aggregate + zero-filled clinical-order category list (Code Example 2); payload includes `latest_reading` for D-11 empty states and preset anchoring |
| DASH-01 | BP Timeline dual-line chart | Recharts 3 LineChart with numeric time x-axis pattern (Code Example 5); direct line-end labels via custom LabelList content (D-07) |
| DASH-02 | Pulse Trend with 60 bpm reference line | `<ReferenceLine y={60}>` with edge label; fixed domain [30,120] covers actual pulse range 42–69 (verified in dev.db) |
| DASH-03 | BP Categories horizontal bars, clinical order, AHA colors + Hypotension | `<BarChart layout="vertical">` + per-bar `<Cell>` fills from category color map; data from zero-filled `/stats/summary` payload so counts always match the strip (D-10) |
| DASH-04 | AM vs PM grouped bars of avg systolic/diastolic/pulse | Client-side grouping of the filtered `/readings` response (132 rows max — trivial); grouped `<Bar>` pattern |
| DASH-05 | AHA zones behind BP timeline | Stacked `<ReferenceArea>` y-spans rendered BEFORE the Lines (Recharts 3 z-order = JSX order); systolic-threshold zones [ASSUMED interpretation — see Assumptions A1] |
| DASH-06 | Full data range without clipping (systolic 60–211, bradycardic pulse) | Verified actual ranges in dev.db: systolic 60–211, diastolic 42–129, pulse 42–69 → fixed domains [40,220] BP / [30,120] pulse cover everything (D-05) |
| DASH-07 | Filter controls applied consistently across all charts | Single zustand store as the one source of filter truth; TanStack Query keyed on resolved filters; every chart + strip + table reads the same two query results |
| DASH-08 | Summary stats strip recomputes on filter change | Strip renders `/stats/summary` for current filters (D-21); TanStack Query refetch on key change with `placeholderData: keepPreviousData` |
| DASH-09 | Readings table, date-sorted, category chips | Client-side newest-first sort of `/readings`; chip colors from the shared category color map; "Show 20 more" slice state (D-23/D-24) |
| DASH-11 | "Chris's Health Dashboard" header bar | Plain header styled per nautical theme — Tableau reference overridden by D-01 |
| ACC-01 | ≥48px targets, ≥18px body text, high-contrast palette incl. charts | Tailwind token strategy (`min-h-12`, `text-lg` base); candidate contrast-checked palette provided; chart-dot target strategy documented (dots + keyboard + click hit area, controls at 48px) |
| ACC-02 | Keyboard navigable, visible focus, no drag/hover-only/precision | Recharts `accessibilityLayer` (default ON in v3, arrow-key point nav verified); Tooltip `trigger="click"` verified; `focus-visible` ring pattern; button-group filters (no custom widgets needing drag) |
</phase_requirements>

## Summary

This phase adds the first two FastAPI endpoints on top of the existing Phase 1 backend (`backend/app/` already has models, config, db, derivations, and a seeded dev.db with the 132 real readings — verified: Feb 22 – Jun 13 2025, systolic 60–211, diastolic 42–129, pulse 42–69, 116/132 bradycardic), and creates the `frontend/` React app from scratch. The backend work is small and low-risk: a `ReadingFilters` dependency shared by `GET /readings` and `GET /stats/summary`, Pydantic response models that alias the `datetime_`/`map_value` attribute names, a no-op `verify_token` auth dependency stub, and CORS middleware. FastAPI/httpx/uvicorn are not yet installed in `backend/.venv` — that is a Wave 0 install.

The frontend is the bulk of the phase. The stack is fully locked by CLAUDE.md (React 19.2, Vite 8.1, TS ~5.9, Recharts 3.9, zustand 5, TanStack Query 5, Tailwind 4) and all versions plus peer-dependency compatibility were re-verified against the npm registry this session. Recharts 3 gives the accessibility interactions for free: `accessibilityLayer` is on by default (single tab stop + arrow-key point navigation) and `Tooltip trigger="click"` shows-and-stays on click — both verified against the Recharts wiki/docs. The one genuinely custom piece is the hero/mini rotation (D-02), which is just zustand `activeChart` state + a CSS fade-scale swap; no animation library needed.

The highest-leverage design finding: **date presets anchored to "today" would render an empty dashboard** — the data ends June 13 2025 and today is July 2026. Presets must anchor to the newest reading date (returned by `/stats/summary` as `latest_reading`), and this anchoring decision must be recorded because Phase 3's server-side symbolic date resolution (API-05) must match it. This is flagged as the top open question with a firm recommendation.

**Primary recommendation:** Build the API as two thin ORM-aggregate endpoints sharing one filter dependency; build the frontend around one zustand filter store (the future agent command schema) feeding two TanStack Query keys; let Recharts 3 defaults carry the accessibility interactions; anchor date presets to the newest reading.

## Project Constraints (from CLAUDE.md)

- **Fixed stack, do not substitute:** PostgreSQL/SQLite, Python+Pandas ETL, FastAPI, React (Vite), Recharts, Web Speech API, Claude API, Vercel + Railway/Render. Specific pinned versions in the CLAUDE.md stack tables (FastAPI 0.139.x, Pydantic 2.13.x, SQLAlchemy 2.0.x sync, React 19.2.x, Vite 8.x, TS ~5.9, Recharts 3.9.x, zustand 5.0.x, @tanstack/react-query 5.x, Node 22 LTS, Tailwind 4 optional-but-recommended).
- **SQLAlchemy 2.0 typed declarative, sync engine, no raw SQL** — one codebase for SQLite dev + Postgres prod.
- **zustand = UI/filter state; TanStack Query = server state** — keep server data out of the zustand store.
- **Accessibility non-negotiable:** ≥48px targets, ≥18px body text, high contrast, keyboard navigable, no drag/hover-only/precision interactions.
- **Privacy:** no analytics trackers; real health data never in the repo (data/ is gitignored).
- **Do NOT use:** psycopg2, pandas 2.x idioms, Recharts 2.x, CRA, cookie-based session, Anthropic calls from frontend.
- **Config via pydantic-settings env vars** (`DATABASE_URL`, later `CORS_ORIGINS` etc.) — extend the existing `Settings`, no new config mechanism.
- **Tests required** for derived medical logic; pytest 9 backend, Vitest 4 frontend.
- **CORS:** Bearer-token model later → no `allow_credentials=True`.
- **GSD workflow enforcement:** file changes only through GSD commands.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reading filtering (date/am_pm/category) | API / Backend | — | Single source of filter semantics; Phase 3 agent reuses it. Frontend only sends params. |
| Summary statistics (avg/min/max/%, counts) | API / Backend | — | API-02 requires the endpoint; strip must match it exactly — never recompute strip numbers client-side |
| AM vs PM chart aggregation | Browser / Client | — | Derived from the already-filtered `/readings` payload (≤132 rows); no API surface needed |
| Category derivations (labels, boundaries) | Backend (done, Phase 1) | — | `derivations.py` is the single source of truth; API serves stored values, never recomputes |
| Filter/UI state (active chart, presets, theme) | Browser / Client (zustand) | — | This state shape IS the Phase 3 agent command schema; lives client-side by design |
| Server-data caching per filter combo | Browser / Client (TanStack Query) | — | Query keys = resolved filters; API stays stateless |
| Auth gate | API / Backend (stub only this phase) | — | `verify_token` dependency designed now, enforced Phase 5 — never a retrofit |
| Theme (light/dark) persistence | Browser / Client | — | `.dark` class + localStorage; no server involvement |
| Chart rendering & keyboard interaction | Browser / Client (Recharts) | — | `accessibilityLayer` + click tooltips are Recharts-native |

## Standard Stack

All backend versions verified against PyPI and all frontend versions against the npm registry on 2026-07-14 (`pip index versions`, `npm view`). [VERIFIED: npm/PyPI registries + CLAUDE.md source audit]

### Core — Backend additions this phase
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.139.0 (pin `0.139.*`) | The two read endpoints | Locked stack; latest on PyPI [VERIFIED: PyPI] |
| uvicorn[standard] | 0.51.0 (CLAUDE.md says 0.50.x; 0.51.0 now latest — pin `>=0.50,<0.52`) | Dev/prod ASGI server | Locked stack [VERIFIED: PyPI] |
| httpx | 0.28.1 | Required by FastAPI TestClient | Locked stack, test-only usage this phase [VERIFIED: PyPI] |

Already installed in `backend/.venv` (verified): pandas 3.0.3, pydantic 2.13.4, pydantic-settings 2.14.2, SQLAlchemy 2.0.51, pytest 9.1.1, Python 3.12.1. `python-multipart` is NOT needed until Phase 5 (`/upload`) — using `pip install "fastapi[standard]"` would pull it plus the fastapi CLI; installing `fastapi` + `uvicorn[standard]` + `httpx` explicitly is leaner and sufficient for read-only endpoints. Either is acceptable.

### Core — Frontend (created fresh this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.2.7 | UI | Locked stack [VERIFIED: npm] |
| vite | 8.1.4 | Build/dev server | Locked stack; Node engines `^20.19 || >=22.12` — local Node is v24.14.0 ✓ [VERIFIED: npm + local] |
| @vitejs/plugin-react | 6.0.3 | React plugin | Scaffolded by `create-vite` 9.1.1 `react-ts` template [VERIFIED: npm] |
| typescript | ~5.9 (**pin — npm latest is now 7.0.2**) | Types | CLAUDE.md locks ~5.9; TS 6/7 shipped recently — after scaffolding, force `"typescript": "~5.9.0"` in package.json (see Pitfall 11) [VERIFIED: npm] |
| recharts | 3.9.2 | All four charts | Locked stack; peerDeps allow React 19 [VERIFIED: npm] |
| zustand | 5.0.14 | Filter/UI store (future agent command target) | Locked stack; peerDep react ≥18 ✓ [VERIFIED: npm] |
| @tanstack/react-query | 5.101.2 | Server state for `/readings` + `/stats/summary` | Locked stack; peerDep react ^18‖^19 ✓ [VERIFIED: npm] |
| tailwindcss + @tailwindcss/vite | 4.3.2 | Styling + enforcing ACC tokens | CLAUDE.md recommended; v4 CSS-first config [VERIFIED: npm] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-day-picker | 9.14.0 (**use v9, not v10**) | Oversized custom calendar for D-18 | v10.0.1 shipped 2026-05-08 (2 months old) and is a package-rename/cleanup release (`@daypicker/react`); v9 is the massively-deployed line, still actively published (9.14.0), styleable day cells (48px), strong a11y, peerDep react ≥16.8 ✓ [VERIFIED: npm + daypicker.dev upgrade guide] |
| vitest | 4.1.10 | Frontend unit tests | Locked dev tooling. slopcheck flagged `[SUS]` as vite-typosquat — false positive: official vitest-dev/vitest repo, published since 2021 [VERIFIED: npm metadata] |
| @testing-library/react | 16.3.2 | Component tests | Store/logic tests; avoid chart-render assertions in jsdom (Pitfall 2) [VERIFIED: npm] |
| @testing-library/jest-dom | latest 6.x | Matchers | With Vitest setup file [VERIFIED: npm registry existence via slopcheck] |
| jsdom | 29.1.1 | Vitest DOM env | [VERIFIED: npm] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-day-picker 9 | react-day-picker 10 / `@daypicker/react` | v10 is 2 months old with far less community documentation; nothing in D-18 needs it. Revisit post-v1. |
| react-day-picker | Native `<input type="date">` only | Native inputs are keyboard-great but the popup calendar cannot be styled to ≥48px day cells (D-18 locks an oversized picker). Keep native-ish typed entry alongside the picker (D-18 requires typed entry too). |
| CSS transition hero swap | framer-motion / `motion` | A whole animation library for one ~250ms fade-scale swap is unjustified weight; CSS + `motion-reduce:` handles D-04 including reduced-motion fallback. |
| Client-side AM/PM aggregation | Extra API endpoint / summary fields | 132 rows max — client grouping is trivial and keeps API surface minimal. |
| date-fns for preset math | Native `Date` arithmetic | Subtracting N days and formatting `YYYY-MM-DD` is ~10 lines of local-time-safe code; react-day-picker v9 already vendors date-fns internally but the app itself doesn't need it. |

**Installation:**
```bash
# Backend (into existing backend/.venv)
backend/.venv/bin/pip install "fastapi==0.139.*" "uvicorn[standard]>=0.50,<0.52" "httpx==0.28.*"
# (also add to backend/pyproject.toml dependencies)

# Frontend (Node 24.14 local ✓)
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install recharts@^3.9.2 zustand@^5.0.14 @tanstack/react-query@^5.101.2 react-day-picker@^9.14.0
npm install -D tailwindcss@^4.3.2 @tailwindcss/vite@^4.3.2 vitest@^4.1.10 @testing-library/react @testing-library/jest-dom jsdom
# then pin "typescript": "~5.9.0" in package.json and npm install
```

**Version verification:** performed this session — `npm view <pkg> version` for all 13 frontend packages and `pip index versions` for fastapi (0.139.0), uvicorn (0.51.0), httpx (0.28.1). Peer-dependency matrices for recharts/zustand/react-query/react-day-picker checked against React 19. No postinstall scripts on any key frontend package (checked recharts, zustand, @tanstack/react-query, react-day-picker, vitest).

## Package Legitimacy Audit

slopcheck 0.6.1 ran against both ecosystems (`scan --json` on requirements.txt and package.json copies).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| fastapi | PyPI | mature | massive | github.com/fastapi/fastapi | [OK] | Approved |
| uvicorn | PyPI | mature | massive | github.com/encode/uvicorn | [OK] | Approved |
| httpx | PyPI | mature | massive | github.com/encode/httpx | [OK] | Approved |
| python-multipart | PyPI | mature (est.) | high | github.com/Kludex/python-multipart | [OK] (info: name pattern) | Approved (not needed until Phase 5) |
| react / react-dom | npm | mature | massive | facebook/react | [OK] | Approved |
| vite / @vitejs/plugin-react | npm | mature | massive | vitejs/vite | [OK] | Approved |
| typescript | npm | mature | massive | microsoft/TypeScript | [OK] | Approved (pin ~5.9) |
| recharts | npm | mature | massive | recharts/recharts | [OK] | Approved |
| zustand | npm | mature | massive | pmndrs/zustand | [OK] | Approved |
| @tanstack/react-query | npm | mature | massive | TanStack/query | [OK] | Approved |
| react-day-picker | npm | since 2014 | high | gpbl/react-day-picker | [OK] | Approved (use 9.14.0) |
| tailwindcss / @tailwindcss/vite | npm | mature | massive | tailwindlabs/tailwindcss | [OK] | Approved |
| vitest | npm | since 2021-12 | massive | vitest-dev/vitest | [SUS] | **Kept — false positive.** Heuristic flagged "suspiciously close to 'vite'"; verified official vitest-dev repo, created 2021, latest 4.1.10. `vitest` [WARNING: slopcheck flagged as suspicious — verified legitimate via npm metadata (official vitest-dev/vitest repo), but planner may add a human-verify note if desired.] |
| jsdom | npm | mature | massive | jsdom/jsdom | [OK] | Approved |
| @testing-library/react / jest-dom | npm | mature | massive | testing-library/* | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** vitest (typosquat heuristic; verified legitimate — repo `git+https://github.com/vitest-dev/vitest.git`, created 2021-12-03, dist-tag latest 4.1.10)

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────── Browser ────────────────────────┐
                        │                                                         │
  user clicks filter →  │  Filter controls ──set──▶ zustand FilterStore           │
                        │   (presets/range/          │ activeChart, datePreset,   │
                        │    AM-PM/category)         │ customRange, amPm,         │
                        │                            │ bpCategory, theme          │
                        │                            ▼                            │
                        │              resolveFilters(store, latestReading)      │
                        │                (preset → concrete YYYY-MM-DD range)     │
                        │                            │                            │
                        │            ┌───────────────┴───────────────┐            │
                        │            ▼                               ▼            │
                        │  useQuery(['readings',f])       useQuery(['stats',f])   │
                        └────────────│───────────────────────────────│────────────┘
                                     ▼  GET /readings?…              ▼  GET /stats/summary?…
                        ┌──────────────────────── FastAPI ───────────────────────┐
                        │  CORSMiddleware → APIRouter(deps=[verify_token STUB])   │
                        │        │                                                │
                        │  ReadingFilters dependency (shared param parsing)       │
                        │        │                            │                   │
                        │        ▼                            ▼                   │
                        │  select(Reading)              select(count/avg/min/max) │
                        │  .where(filters).order_by     + group_by(bp_category)   │
                        │        │                            │ zero-fill 6 cats  │
                        │        ▼                            ▼                   │
                        │  list[ReadingOut]             StatsSummary(+latest_     │
                        │  (datetime_/map_ aliased)      reading anchor)          │
                        └───────────────│─────────────────────│───────────────────┘
                                        ▼                     ▼
                              SQLAlchemy sync engine → SQLite dev.db / Postgres prod
                                        (readings table — Phase 1, seeded, 132 rows)

  Query data fans out client-side:
    readings ──▶ BP Timeline · Pulse Trend · AM/PM grouped bars (client agg) · Readings table
    stats    ──▶ Summary stats strip · BP Categories bars (same numbers, D-10)
    activeChart ──▶ hero slot; other three render as live minis (D-02)
```

### Recommended Project Structure

```
backend/app/
├── main.py            # FastAPI app, CORS, router mount, (optional) health route
├── auth.py            # verify_token no-op dependency stub (Phase 5 fills in)
├── schemas.py         # ReadingOut, StatsSummary, shared Literal types
├── deps.py            # get_db session dependency + ReadingFilters
├── routers/
│   ├── readings.py    # GET /readings
│   └── stats.py       # GET /stats/summary
└── (existing: models.py, derivations.py, config.py, db.py, etl.py, seed.py)

frontend/src/
├── main.tsx / App.tsx
├── index.css               # @import "tailwindcss"; @custom-variant dark; @theme tokens
├── api/client.ts           # fetch wrapper (base URL from import.meta.env.VITE_API_URL)
├── api/types.ts            # Reading, StatsSummary, BPCategory — mirrors Pydantic schemas
├── store/filters.ts        # zustand store (THE future agent command schema)
├── store/theme.ts          # light/dark + localStorage persistence
├── lib/dates.ts            # preset resolution, local-time-safe parse/format
├── lib/palette.ts          # category color map (single source for chips/bars/bands)
├── hooks/useReadings.ts    # TanStack Query hooks
├── hooks/useStats.ts
├── components/
│   ├── Header.tsx          # "Chris's Health Dashboard" + theme toggle + motif
│   ├── FilterBar.tsx       # presets, custom range (DayPicker), AM/PM, category chips
│   ├── StatsStrip.tsx
│   ├── ChartDeck.tsx       # hero + 3 minis, rotation state + swap animation
│   ├── charts/
│   │   ├── BPTimeline.tsx  # bands + dual line + click tooltip
│   │   ├── PulseTrend.tsx
│   │   ├── CategoryBars.tsx
│   │   └── AmPmComparison.tsx
│   ├── ReadingsTable.tsx
│   └── EmptyState.tsx      # D-11 guided empty state
└── tests/                  # vitest: dates, store, palette, stats formatting
```

### Pattern 1: Shared filter dependency = one filter semantics for both endpoints
**What:** A single FastAPI dependency parses/validates start_date, end_date, am_pm, bp_category and builds the SQLAlchemy where-clauses. Both endpoints depend on it.
**When to use:** Always here — API-01/API-02 must agree, and Phase 3's agent resolves into the exact same filter set. See Code Example 1.

### Pattern 2: zustand store as the future agent command schema
**What:** The store holds exactly the fields a Phase 3 command can set: `activeChart`, `datePreset`, `customRange`, `amPm`, `bpCategory` (+ `theme`). Actions are discrete, machine-callable setters. Derived concrete dates live in a pure `resolveFilters()` function, NOT in the store — the agent will send symbolic ranges (API-05).
**When to use:** Design it this way from the first commit. See Code Example 3.

### Pattern 3: Two query keys, everything subscribes
**What:** `['readings', resolved]` and `['stats', resolved]` are the only server-state entry points. Charts/table consume readings; strip + category bars consume stats. `placeholderData: keepPreviousData` prevents blank flashes during filter changes.
**When to use:** All server data. Never copy query results into zustand.

### Pattern 4: Hero/mini rotation without a library
**What:** `activeChart` picks the hero; the other three render as minis in fixed order. Swap = CSS opacity/scale transition ~250ms on the two affected slots; `motion-reduce:transition-none` makes it instant under `prefers-reduced-motion` (D-04). Each mini is a single `<button>` (whole card ≥48px target, `aria-label="Show pulse trend chart"`); the mini's inner Recharts chart gets `accessibilityLayer={false}` and no Tooltip so there is no nested interactive content (Pitfall 8).
**When to use:** D-02/D-03/D-04.

### Pattern 5: Theme via `.dark` class + CSS custom properties driving Recharts
**What:** Tailwind v4 class-based dark mode (`@custom-variant dark (&:where(.dark, .dark *));` — verified against tailwindcss.com/docs/dark-mode). All chart colors defined as CSS custom properties that flip with the theme; Recharts accepts `stroke="var(--color-systolic)"` since it renders plain SVG. One palette module maps category → CSS var so chips, bars, and bands never drift apart.
**When to use:** D-13/D-14/D-15.

### Anti-Patterns to Avoid
- **Recomputing categories or stats in the frontend or API:** `derivations.py` computed them at ETL time; the API serves stored values; the strip serves `/stats/summary` verbatim. Client math is allowed only for the AM/PM chart grouping (raw averages of served rows).
- **Auto-fit y-axes:** D-05 locks fixed domains. Never let Recharts compute `domain` from data.
- **Storing server data in zustand:** breaks the zustand=UI / Query=server separation CLAUDE.md locks.
- **Hover-only anything:** tooltips are click/keyboard (D-09); no `onMouseEnter`-gated information.
- **Auto-widening empty filter results:** D-11 — show the guided empty state instead.
- **`new Date("YYYY-MM-DD")` in the frontend:** parses as UTC midnight → off-by-one dates in negative-offset timezones (Pitfall 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible calendar with big day cells | Custom grid + focus management | react-day-picker 9 | Roving tabindex, aria-grid semantics, month navigation, disabled dates — months of edge cases |
| Chart keyboard navigation | Custom focus/arrow handlers on SVG | Recharts `accessibilityLayer` (default on) | Verified: single tab stop + ArrowLeft/Right point navigation built in |
| Per-filter response caching, loading/error states, refetch | useEffect + useState fetch soup | TanStack Query 5 | Dedup, cache keys, `keepPreviousData`, devtools |
| CORS | Manual OPTIONS handling | Starlette `CORSMiddleware` via `app.add_middleware` | Preflight subtleties |
| Query param validation | Hand-parsing strings | FastAPI `Annotated[..., Query()]` + `Literal` types | Automatic 422s with clear messages; OpenAPI docs for free |
| WCAG contrast checking of the palette | Eyeballing | A contrast checker during UI-SPEC (e.g. WebAIM) with documented ratios | ACC-01 is non-negotiable; ratios must be recorded |
| Dark-mode plumbing | Duplicate stylesheets | Tailwind v4 `@custom-variant dark` + CSS vars | Verified one-line variant override |

**Key insight:** This phase has exactly one custom interaction (hero rotation) and it's deliberately cheap (state + CSS). Everything else — calendar, chart a11y, caching, validation — has a mature, verified library already in the locked stack.

## Common Pitfalls

### Pitfall 1: JS date parsing splits UTC/local by string shape
**What goes wrong:** `new Date("2025-02-22")` → UTC midnight (can display as Feb 21 locally); `new Date("2025-02-22T11:26:00")` → local time (correct for this app).
**Why it happens:** ECMAScript spec: date-only forms parse as UTC, date-time forms without offset parse as local.
**How to avoid:** API datetimes are naive ISO with time components — parsing them with `new Date()` is safe AND correct for DATA-05 (naive local end-to-end). For date-only strings (filter params, DayPicker values), never pass to `new Date()` directly — split into parts: `new Date(y, m-1, d)`. Put both helpers in `lib/dates.ts` and test them.
**Warning signs:** Table/chart dates one day earlier than the readings table; preset boundaries excluding a day.

### Pitfall 2: ResponsiveContainer needs an explicitly-sized parent; renders 0×0 in jsdom
**What goes wrong:** Charts silently render nothing, or Vitest component tests show empty SVG.
**How to avoid:** Give every chart wrapper a fixed height class (e.g. `h-[420px]` hero, `h-36` minis). In tests, do not assert on chart internals — test data-shaping functions instead (see Validation Architecture).
**Warning signs:** Blank chart area, console warning about width/height of -1.

### Pitfall 3: ORM attribute names ≠ column names in Pydantic serialization
**What goes wrong:** `ReadingOut.model_validate(reading)` fails or emits `datetime_`/`map_value` keys — the model attributes are `datetime_` and `map_value` (columns `datetime`, `map`).
**How to avoid:** `from_attributes=True` + `Field(validation_alias=...)` reading the attribute name while the JSON field is the clean name (Code Example 1). Add a serialization test asserting exact JSON keys: `datetime`, `map`.
**Warning signs:** 500s on `/readings`, or frontend types not matching payload.

### Pitfall 4: end_date exclusivity vs the DateTime column
**What goes wrong:** Filtering `Reading.datetime_ <= end_date` (a date) compares against midnight — drops all readings ON the end date.
**How to avoid:** `Reading.datetime_ < end_date + timedelta(days=1)` (and `>= start_date` at midnight). Test with a reading at 23:xx on the boundary day.

### Pitfall 5: Recharts default categorical x-axis lies about time
**What goes wrong:** With string dates, points are evenly spaced regardless of real gaps — misleading for 132 irregular readings over ~4 months (DASH-06 risk).
**How to avoid:** Feed epoch ms and set `<XAxis dataKey="ts" type="number" scale="time" domain={["dataMin","dataMax"]} tickFormatter={...}>`. [ASSUMED code pattern — long-standing Recharts API, but verify rendering during implementation]
**Warning signs:** A 3-week gap looks identical to a 12-hour gap.

### Pitfall 6: Click-tooltips have no built-in outside-click dismiss
**What goes wrong:** `Tooltip trigger="click"` shows and stays (verified — that's what D-09 wants), but Recharts issue #3573 documents there's no native click-outside close.
**How to avoid:** D-09 says "persists until dismissed" — render a custom tooltip `content` with a big explicit Close button (≥48px) and also close on Escape. This turns the library gap into the required UX.

### Pitfall 7: Reference bands drawn over the data lines
**What goes wrong:** In Recharts 3, `isFront`/`alwaysShow` are gone; z-order = JSX order (verified in 3.0 migration guide).
**How to avoid:** Render the six `<ReferenceArea>` zones BEFORE the `<Line>` elements inside the chart JSX; keep band `fillOpacity` low (~0.08–0.15) per D-08.

### Pitfall 8: Nested interactive content in mini-chart buttons
**What goes wrong:** Minis wrapped in `<button>` while the inner chart still has `accessibilityLayer` (default ON in v3) → focusable chart inside a button; invalid, confusing tab order.
**How to avoid:** Minis: `accessibilityLayer={false}`, no `<Tooltip>`, `pointer-events: none` on the SVG (the button handles activation). Hero keeps full interactivity.

### Pitfall 9: Date presets anchored to "today" render an empty dashboard
**What goes wrong:** Data ends 2025-06-13; today is 2026-07. "Last 30 days" from today = zero readings → the default view (BP Timeline, some preset) could open into the empty state.
**How to avoid:** Anchor presets to `latest_reading` from `/stats/summary` (see Open Question 1 — recommendation with Phase 3 consistency note). Default preset on load should be "All" until anchoring is confirmed, or "30 days anchored to newest" per the recommendation.

### Pitfall 10: Module-level engine blocks test overrides
**What goes wrong:** `db.py` creates the engine at import time from settings; endpoint tests would hit `dev.db`.
**How to avoid:** Route DB access through a `get_db()` dependency and use `app.dependency_overrides[get_db]` in tests with the existing in-memory-engine fixtures from `tests/conftest.py` (Code Example 6). Do not import `SessionLocal` directly in route modules.

### Pitfall 11: Toolchain drift vs CLAUDE.md pins
**What goes wrong:** `npm create vite@latest` scaffolds whatever TS/ESLint versions are current — TypeScript latest on npm is now **7.0.2** (native-compiler line) and 6.x exists; CLAUDE.md locks ~5.9.
**How to avoid:** Immediately after scaffolding, set `"typescript": "~5.9.0"` (and check `@types/react` majors) before the first `npm install` commit. Verify `npx tsc --version` reports 5.9.x.

### Pitfall 12: Tailwind v4 dark mode defaults to `prefers-color-scheme`
**What goes wrong:** `dark:` variants ignore the toggle button (D-15 requires a manual toggle).
**How to avoid:** Add `@custom-variant dark (&:where(.dark, .dark *));` after `@import "tailwindcss";` and toggle `document.documentElement.classList` + persist to localStorage. [VERIFIED: tailwindcss.com/docs/dark-mode]

### Pitfall 13: TanStack Query v5 renamed keepPreviousData
**What goes wrong:** v4's `keepPreviousData: true` option no longer exists as a boolean.
**How to avoid:** `import { keepPreviousData } from "@tanstack/react-query"` and pass `placeholderData: keepPreviousData`. [CITED: tanstack.com/query/v5 migration docs]

### Pitfall 14: Chart dots cannot be 48px — plan the ACC-01 story explicitly
**What goes wrong:** Literal reading of ACC-01 makes data dots impossible (they'd overlap).
**How to avoid:** ACC-01's 48px applies to controls (buttons, chips, toggle, calendar cells, table button, tooltip close). Data-point inspection satisfies the no-precision rule via three redundant paths: generous `activeDot` radius + Recharts' nearest-point hit detection (clicking near a point works), keyboard arrows, and the readings table as the zero-precision fallback. Document this rationale in the plan so verification doesn't flag dots.

## Code Examples

### 1. Filters dependency + `GET /readings` + aliased response model
```python
# Source: FastAPI docs (query params w/ Annotated) + Pydantic v2 alias docs — [CITED: fastapi.tiangolo.com, docs.pydantic.dev]
from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, Query
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy import select
from app.models import Reading

BPCategory = Literal[
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
]  # MUST match derivations.py verbatim — spaces are fine in query params (URL-encoded)

class ReadingFilters:
    def __init__(
        self,
        start_date: Annotated[date | None, Query()] = None,
        end_date: Annotated[date | None, Query()] = None,
        am_pm: Annotated[Literal["AM", "PM"] | None, Query()] = None,
        bp_category: Annotated[BPCategory | None, Query()] = None,
    ):
        self.start_date, self.end_date = start_date, end_date
        self.am_pm, self.bp_category = am_pm, bp_category

    def apply(self, stmt):
        if self.start_date:
            stmt = stmt.where(Reading.datetime_ >= datetime.combine(self.start_date, datetime.min.time()))
        if self.end_date:  # inclusive end date — Pitfall 4
            stmt = stmt.where(Reading.datetime_ < datetime.combine(self.end_date + timedelta(days=1), datetime.min.time()))
        if self.am_pm:
            stmt = stmt.where(Reading.am_pm == self.am_pm)
        if self.bp_category:
            stmt = stmt.where(Reading.bp_category == self.bp_category)
        return stmt

class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    # attribute is datetime_/map_value; JSON key is datetime/map — Pitfall 3
    datetime: datetime = Field(validation_alias=AliasChoices("datetime_", "datetime"))
    systolic: int
    diastolic: int
    pulse: int
    am_pm: str
    bp_category: str
    pulse_category: str
    map: float = Field(validation_alias=AliasChoices("map_value", "map"))
    pulse_pressure: int
    notes: str | None = None

router = APIRouter()

@router.get("/readings", response_model=list[ReadingOut])
def list_readings(filters: Annotated[ReadingFilters, Depends()], db=Depends(get_db)):
    stmt = filters.apply(select(Reading)).order_by(Reading.datetime_)
    return db.scalars(stmt).all()
```
Naive datetimes serialize as `"2025-02-22T11:26:00"` (no `Z`, no offset) — JS parses these as local time, preserving DATA-05 end-to-end.

### 2. `GET /stats/summary` — one aggregate query + zero-filled clinical-order categories
```python
# Source: SQLAlchemy 2.0 func aggregates — [CITED: docs.sqlalchemy.org]
from sqlalchemy import func, select

CLINICAL_ORDER = ["Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"]

@router.get("/stats/summary", response_model=StatsSummary)
def stats_summary(filters: Annotated[ReadingFilters, Depends()], db=Depends(get_db)):
    agg = filters.apply(select(
        func.count(Reading.id),
        func.avg(Reading.systolic), func.min(Reading.systolic), func.max(Reading.systolic),
        func.avg(Reading.diastolic), func.min(Reading.diastolic), func.max(Reading.diastolic),
        func.avg(Reading.pulse), func.min(Reading.pulse), func.max(Reading.pulse),
    ))
    row = db.execute(agg).one()
    cat_rows = dict(db.execute(
        filters.apply(select(Reading.bp_category, func.count(Reading.id)).group_by(Reading.bp_category))
    ).all())
    count = row[0]
    categories = [  # zero-fill ALL six in clinical order — chart + strip always complete
        {"category": c, "count": cat_rows.get(c, 0),
         "percent": round(100 * cat_rows.get(c, 0) / count, 1) if count else 0.0}
        for c in CLINICAL_ORDER
    ]
    latest = db.scalar(select(func.max(Reading.datetime_)))  # UNFILTERED — D-11 anchor
    ...  # assemble StatsSummary: count, systolic/diastolic/pulse {avg (round 1), min, max} or nulls when count==0, categories, latest_reading
```
`latest_reading` is intentionally unfiltered: the D-11 empty state and preset anchoring both need "the newest reading that exists," not "newest in the empty filter set."

### 3. zustand store — the future agent command schema
```typescript
// Source: zustand 5 docs pattern — [CITED: github.com/pmndrs/zustand]
import { create } from "zustand";

export type ChartId = "bp_timeline" | "pulse_trend" | "bp_categories" | "am_pm_comparison";
export type DatePreset = "7d" | "30d" | "90d" | "all" | "custom";
export type BPCategory = "Hypotension" | "Normal" | "Elevated" | "Stage 1" | "Stage 2" | "Hypertensive Crisis";

interface FilterState {
  activeChart: ChartId;                 // D-02/D-03
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null }; // "YYYY-MM-DD"
  amPm: "all" | "AM" | "PM";            // D-19 single-select
  bpCategory: "all" | BPCategory;       // D-19 single-select
  setActiveChart: (c: ChartId) => void; // each action ↔ one future voice command
  setDatePreset: (p: Exclude<DatePreset, "custom">) => void;
  setCustomRange: (from: string, to: string) => void;
  setAmPm: (v: "all" | "AM" | "PM") => void;
  setBpCategory: (v: "all" | BPCategory) => void;
  showAllData: () => void;              // D-11 big button
}

export const useFilters = create<FilterState>((set) => ({
  activeChart: "bp_timeline",
  datePreset: "all",   // safe default; see Open Question 1 on preset anchoring
  customRange: { from: null, to: null },
  amPm: "all",
  bpCategory: "all",
  setActiveChart: (activeChart) => set({ activeChart }),
  setDatePreset: (datePreset) => set({ datePreset, customRange: { from: null, to: null } }),
  setCustomRange: (from, to) => set({ datePreset: "custom", customRange: { from, to } }),
  setAmPm: (amPm) => set({ amPm }),
  setBpCategory: (bpCategory) => set({ bpCategory }),
  showAllData: () => set({ datePreset: "all", customRange: { from: null, to: null }, amPm: "all", bpCategory: "all" }),
}));
// Pure, testable, and OUTSIDE the store: resolveFilters(state, latestReadingDate)
//   → { start_date?, end_date?, am_pm?, bp_category? } for the query key/params.
```

### 4. Query hooks with flicker-free filter changes
```typescript
// Source: TanStack Query v5 — [CITED: tanstack.com/query/latest]
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useReadings(resolved: ResolvedFilters) {
  return useQuery({
    queryKey: ["readings", resolved],
    queryFn: () => api.getReadings(resolved),
    placeholderData: keepPreviousData, // v5 rename — Pitfall 13
    staleTime: 5 * 60_000,             // data changes only on (Phase 5) uploads
  });
}
```

### 5. BP Timeline — bands behind lines, real time axis, click-persistent tooltip
```tsx
// Source: Recharts 3 API + 3.0 migration guide (z-order = JSX order; trigger="click" verified)
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={points} accessibilityLayer /* default true; explicit for clarity */>
    {/* D-08 bands FIRST so lines draw on top — Pitfall 7. Systolic-threshold zones (Assumption A1) */}
    <ReferenceArea y1={40}  y2={90}  fill="var(--cat-hypotension)" fillOpacity={0.10} label={{ value: "Hypotension", position: "insideTopLeft", fontSize: 14 }} />
    <ReferenceArea y1={90}  y2={120} fill="var(--cat-normal)"    fillOpacity={0.10} />
    <ReferenceArea y1={120} y2={130} fill="var(--cat-elevated)"  fillOpacity={0.10} />
    <ReferenceArea y1={130} y2={140} fill="var(--cat-stage1)"    fillOpacity={0.10} />
    <ReferenceArea y1={140} y2={180} fill="var(--cat-stage2)"    fillOpacity={0.10} />
    <ReferenceArea y1={180} y2={220} fill="var(--cat-crisis)"    fillOpacity={0.10} />
    <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]}
           tickFormatter={(ts) => fmtShortDate(ts)} tick={{ fontSize: 16 }} />
    <YAxis domain={[40, 220]} ticks={[40, 90, 120, 130, 140, 180, 220]} tick={{ fontSize: 16 }} /> {/* D-05 fixed */}
    <Tooltip trigger="click" content={<BigTooltip />} /> {/* persists; BigTooltip has ≥48px Close — Pitfall 6 */}
    <Line dataKey="systolic"  stroke="var(--line-systolic)"  strokeWidth={3}
          dot={{ r: 5 }} activeDot={{ r: 10 }} isAnimationActive={!prefersReducedMotion} />
    <Line dataKey="diastolic" stroke="var(--line-diastolic)" strokeWidth={3}
          dot={{ r: 5 }} activeDot={{ r: 10 }} isAnimationActive={!prefersReducedMotion} />
    {/* D-07 line-end labels: custom <text> at the last point per series (Assumption A4) */}
  </LineChart>
</ResponsiveContainer>
```

### 6. Endpoint tests reusing Phase 1 fixtures
```python
# Source: FastAPI testing docs (dependency_overrides) — [CITED: fastapi.tiangolo.com/advanced/testing-dependencies]
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.deps import get_db

@pytest.fixture
def client(session):  # `session` = existing in-memory fixture in tests/conftest.py
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_bp_category_filter_uses_canonical_label(client, session):
    ...  # seed Reading rows via session, then:
    r = client.get("/readings", params={"bp_category": "Hypertensive Crisis"})
    assert r.status_code == 200
    assert all(x["bp_category"] == "Hypertensive Crisis" for x in r.json())
```

### 7. Tailwind v4 theme + class dark mode
```css
/* Source: tailwindcss.com/docs/dark-mode (verified) + v4 @theme tokens */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --text-base: 1.125rem;        /* 18px body floor — ACC-01 */
  --color-ink: #14213d;         /* navy text/lines */
  --color-foam: #f2f7f5;        /* pastel canvas only — D-13 */
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x opt-in `accessibilityLayer` | Default ON in 3.0; arrow-key nav; z-order by JSX order (`isFront`/`alwaysShow` removed) | Recharts 3.0 (2025) | Free keyboard nav; band ordering matters |
| TanStack Query `keepPreviousData: true` | `placeholderData: keepPreviousData` | v5 | Pitfall 13 |
| Tailwind `tailwind.config.js` `darkMode: 'class'` | CSS-first: `@custom-variant dark (...)` | Tailwind 4 | Verified exact syntax |
| react-day-picker 9 (`react-day-picker`) | v10 renamed to `@daypicker/react`, removed v9 deprecations | 2026-05-08 | Stay on 9.14.0 this project |
| TypeScript 5.x only | TS 6.x/7.x (native compiler) now `latest` on npm | Early–mid 2026 | Must pin ~5.9 per CLAUDE.md (Pitfall 11) |
| CRA scaffolding | `npm create vite@latest` (create-vite 9.1.1) | long-standing | Use `react-ts` template |

**Deprecated/outdated:** Recharts 2.x patterns (`alwaysShow`, `isFront`, opt-in a11y); v4 React Query option names; Tailwind JS config for dark mode.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AHA bands behind the BP Timeline are horizontal y-axis zones at the *systolic* thresholds (40–90–120–130–140–180–220), with the note that a reading's true category (hypotension gate + severity-max on both values) is shown in its tooltip/chip | Code Example 5, DASH-05 | If the user expected diastolic-threshold bands or a different visualization, band edges change — cheap to adjust; confirm at UI-SPEC or first demo |
| A2 | AM vs PM chart is computed client-side from the filtered `/readings` rows; when the AM/PM filter isolates one period, the chart shows only that period's bars (consistent with DASH-07 "filters applied consistently") | Architecture, DASH-04 | If both periods should always show, exempt this chart from the amPm filter — one-line change in its selector |
| A3 | Recharts `XAxis type="number" scale="time"` renders correct proportional time spacing for this dataset | Pitfall 5, Example 5 | Fallback: compute tick positions manually or accept category axis with gap markers; verify visually in first chart task |
| A4 | D-07 line-end labels implemented as custom SVG `<text>` rendered at each series' last data point (Recharts `LabelList`/custom layer pattern) | Example 5 | Alternative: absolutely-positioned HTML labels over the chart; both are ~20 LOC |
| A5 | The `dataviz` project skill referenced in CONTEXT.md discretion does not exist in this repo or user skills directory (verified absent); visual refinement flows through `/gsd-ui-phase 2` UI-SPEC instead | Discretion handling | None — UI-SPEC covers it |
| A6 | Candidate palette hex values (navy `#14213D`, foam `#F2F7F5`, category colors deep green/amber/orange/red/blue-grey) are starting points only; exact values must be contrast-verified during UI-SPEC | Patterns | ACC-01 requires recorded WCAG ratios before ship — treat palette as unlocked until checked |

## Open Questions

1. **What anchors the date presets — today or the newest reading?**
   - What we know: Data ends 2025-06-13 (verified in dev.db); today is 2026-07-14. Presets computed from "today" return zero rows — the 7/30/90-day buttons would all show the D-11 empty state forever until new uploads arrive, and even then batches arrive weeks late.
   - What's unclear: The user locked the four presets (D-17) but not their reference point. Phase 3's API-05 resolves symbolic ranges server-side — whatever Phase 2 chooses must match.
   - Recommendation: **Anchor presets to `latest_reading`** ("last 30 days of data"). Label honestly in the filter-bar sentence (e.g. "30 days · to Jun 13 2025"). Record as a decision so Phase 3's server-side resolver uses the same anchor. Default preset on first load: "30 days" once anchoring is confirmed, else "all".

2. **Default `datePreset` on load**
   - What we know: D-03 locks BP Timeline as default hero; no decision locks the default date range.
   - Recommendation: Depends on Question 1 — "all" is the only always-safe default; "30d (anchored)" is the better product answer.

3. **Where `frontend/` npm test/lint wiring surfaces in CI**
   - What we know: No CI exists yet; backend tests run via pytest locally.
   - Recommendation: Out of scope to build CI this phase; just ensure `npm test -- --run` and `npm run build` pass locally as plan verification steps.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 8 (needs ^20.19 ‖ ≥22.12) | ✓ | v24.14.0 | — |
| npm | Frontend install | ✓ | 11.9.0 | — |
| Python venv (backend/.venv) | API + tests | ✓ | Python 3.12.1 | — |
| pandas/SQLAlchemy/pydantic/pytest in venv | Existing suite | ✓ | 3.0.3 / 2.0.51 / 2.13.4 / 9.1.1 | — |
| fastapi / uvicorn / httpx in venv | This phase's endpoints + tests | ✗ | — | **Wave 0 install task** (versions verified on PyPI) |
| Seeded dev DB | Frontend has real data day one | ✓ | dev.db: 132 readings, 2025-02-22 → 2025-06-13 | `python -m app.seed` re-runs |
| Real OMRON export in data/ | (Phase 1 blocker follow-up) | ✓ | "Your Requested OMRON Report…Jun 18 2025.xlsx" present | — |
| npm registry network access | Installs | ✓ | verified this session | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** fastapi/uvicorn/httpx → plain pip install into the existing venv (Wave 0).

**Note for the planner (out-of-phase observation):** STATE.md still lists "real OMRON export not yet present in data/" as a blocker, but the file now exists and dev.db contains the 132 real readings. The Phase 1 follow-up (verify real format, unskip golden-master) appears done or partially done — worth a one-line confirmation, not Phase 2 work.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 9.1.1 (installed); config in `backend/pyproject.toml [tool.pytest.ini_options]`, testpaths=["tests"] |
| Framework (frontend) | Vitest 4.1.10 + @testing-library/react 16.3.2 + jsdom — **Wave 0: does not exist yet** |
| Quick run command (backend) | `cd backend && .venv/bin/python -m pytest tests/test_api_readings.py -x -q` |
| Full suite (backend) | `cd backend && .venv/bin/python -m pytest -q` |
| Quick/full (frontend) | `cd frontend && npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Filters (each param, combinations, inclusive end date, canonical labels, 422 on bad enum/date) | integration (TestClient) | `pytest tests/test_api_readings.py -x -q` | ❌ Wave 0 |
| API-01 | Response JSON keys `datetime`/`map` (alias correctness), naive ISO format | unit | same file | ❌ Wave 0 |
| API-02 | Aggregates correct, zero-filled six categories in clinical order, percents sum, empty-set nulls, `latest_reading` unfiltered | integration | `pytest tests/test_api_stats.py -x -q` | ❌ Wave 0 |
| DASH-07 | Preset → concrete range resolution (anchoring, boundaries, custom range) | unit (frontend) | `npm test -- --run src/lib/dates.test.ts` | ❌ Wave 0 |
| DASH-07/D-19 | Store transitions (preset↔custom exclusivity, showAllData, single-select toggles) | unit (frontend) | `npm test -- --run src/store/filters.test.ts` | ❌ Wave 0 |
| DASH-03/D-10 | Category color map completeness + count/percent label formatting | unit (frontend) | `npm test -- --run src/lib/palette.test.ts` | ❌ Wave 0 |
| DASH-01/02/04/05/06 | Chart rendering, band placement, fixed axes | manual-only — Recharts renders 0×0 in jsdom (Pitfall 2); visual verification against seeded data + human-verify checkpoint | — | — |
| DASH-08/09/11 | Strip/table/header render filtered data | component test for table slicing/sort logic; visual for the rest | `npm test -- --run` | ❌ Wave 0 |
| ACC-01/02 | 48px targets, 18px text, contrast, keyboard walk, focus visibility | manual audit (keyboard-only pass + contrast checker) — justified: axe-style automation is a larger investment than this phase warrants; do record contrast ratios | — | — |

### Sampling Rate
- **Per task commit:** relevant quick command (backend file or frontend file)
- **Per wave merge:** `cd backend && .venv/bin/python -m pytest -q` AND `cd frontend && npm test -- --run && npm run build`
- **Phase gate:** both suites green + manual keyboard/contrast audit + visual chart check before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Install fastapi/uvicorn/httpx into `backend/.venv` (+ pyproject deps)
- [ ] `backend/tests/test_api_readings.py`, `backend/tests/test_api_stats.py` — extend existing `conftest.py` with the `client` dependency-override fixture (Code Example 6)
- [ ] Scaffold `frontend/` (create-vite react-ts), pin TS ~5.9, wire Vitest config + `src/tests/setup.ts`
- [ ] `frontend/src/lib/dates.test.ts`, `src/store/filters.test.ts`, `src/lib/palette.test.ts`

## Security Domain

`security_enforcement: true`, ASVS level 1. This phase is read-only, unauthenticated-by-design (enforcement is Phase 5), no secrets touched.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | design-only | `verify_token` no-op dependency attached to the router NOW so Phase 5 flips one function, never retrofits routes |
| V3 Session Management | no | Bearer-token model arrives Phase 5 (per CLAUDE.md — no cookies) |
| V4 Access Control | partial | Single shared-access model; router-level dependency is the enforcement point |
| V5 Input Validation | **yes** | FastAPI/Pydantic: `date` types, `Literal` enums for am_pm/bp_category → automatic 422s; no free-text params; no reflected output |
| V6 Cryptography | no | Nothing cryptographic this phase |
| V10 Malicious Code | yes | Package legitimacy audit above; no postinstall scripts; slopcheck run |

### Known Threat Patterns for FastAPI + React
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter params | Tampering | SQLAlchemy ORM parameterized queries only (locked); params are typed `date`/`Literal`, never interpolated |
| Overly-broad CORS | Info disclosure | `CORSMiddleware` with explicit origins from `Settings.cors_origins` (dev: `http://localhost:5173`); no `allow_credentials`, no `*` |
| Health data exposure via API | Info disclosure | Accepted for this phase per scope (auth enforced Phase 5); DB never publicly exposed; no trackers (SEC-03 discipline starts now — zero third-party scripts in index.html) |
| XSS via notes field rendered in table/tooltip | Tampering | React escapes by default — never `dangerouslySetInnerHTML` for reading data |
| Secrets in frontend | Info disclosure | Only `VITE_API_URL` in frontend env; no API keys exist in this phase |
| DoS on unauthenticated endpoints | DoS | Deferred: slowapi rate limiting is Phase 5 with the gate; local/dev exposure only this phase |

## Sources

### Primary (HIGH confidence)
- npm registry via `npm view` (2026-07-14) — versions, peerDeps, engines, dist-tags, publish times, postinstall checks for all 13 frontend packages
- PyPI via `pip index versions` (2026-07-14) — fastapi 0.139.0, uvicorn 0.51.0, httpx 0.28.1
- Local codebase inspection — `backend/app/{models,derivations,config,db}.py`, `tests/conftest.py`, `pyproject.toml`, dev.db queries (132 readings; ranges; category distribution)
- https://tailwindcss.com/docs/dark-mode — `@custom-variant dark` exact syntax (fetched)
- https://github.com/recharts/recharts/wiki/3.0-migration-guide — accessibilityLayer default true, z-order = JSX order, `alwaysShow`/`isFront` removed, Tooltip `portal`/`axisId` (fetched)
- https://github.com/recharts/recharts/wiki/Recharts-and-accessibility — single tab stop + arrow-key navigation, VoiceOver QuickNav caveat (fetched)
- https://daypicker.dev/upgrading — v10 = rename/cleanup release (fetched)
- slopcheck 0.6.1 scan output (both ecosystems)

### Secondary (MEDIUM confidence)
- WebSearch cross-check: Recharts Tooltip `trigger="click"` shows-and-stays behavior; recharts issue #3573 (no built-in outside-click dismiss); keyboard-tooltip issues on PieChart (#6338 — not used in this phase)
- CLAUDE.md stack audit (PyPI/npm verified 2026-07-07 by prior research) — re-spot-checked this session, one drift found (uvicorn 0.50.2 → 0.51.0)

### Tertiary (LOW confidence)
- Recharts time-scale axis (`type="number" scale="time"`) exact rendering behavior — long-standing API from training knowledge, not re-verified against 3.9 docs this session (Assumption A3)
- JS `Date` UTC-vs-local parsing rules — ECMAScript spec knowledge, stable for a decade

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version re-verified on the correct registry this session; peerDeps checked against React 19
- Architecture: HIGH — thin CRUD API + well-trodden React patterns; all locked decisions have direct library support
- Recharts interaction details: MEDIUM-HIGH — accessibilityLayer/z-order/click-tooltip verified via wiki + search; time-axis and line-end-label patterns are assumed code patterns needing visual verification in the first chart task
- Pitfalls: HIGH — most verified against docs or the local codebase (aliases, module-level engine, seeded data ranges)

**Research date:** 2026-07-14
**Valid until:** ~2026-08-14 (stable stack; re-check npm `latest` drift if planning slips)
