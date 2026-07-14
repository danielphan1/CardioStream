# Phase 2: Read API & Dashboard - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Anyone can see and manually explore Chris's data across all four charts — the manual filter state that voice commands will later mutate. This phase delivers: read-only FastAPI endpoints (`GET /readings` filterable by start_date/end_date/am_pm/bp_category; `GET /stats/summary` for the same filter set), and the React dashboard created fresh in `frontend/` — four charts (BP Timeline, Pulse Trend, BP Categories, AM vs PM), filter controls, summary stats strip, readings table, and the "Chris's Health Dashboard" header. Requirements: API-01, API-02, DASH-01..09, DASH-11, ACC-01, ACC-02. The zustand filter-state shape designed here becomes the Phase 3 agent command schema. No agent endpoint, no voice, no upload, no auth *enforcement* (design the auth dependency hook now, enforce in Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Project-wide directive (supersedes earlier wording)
- **D-01:** **The Tableau prototype is no longer a reference.** This is a standalone project — do not consider Tableau as an example for anything (layout, styling, header) for the rest of the project. The four chart *types* remain (they're requirements), but DASH-11's "matching the Tableau prototype styling" and the roadmap's "matching the Tableau prototype" wording are overridden: the header is simply "Chris's Health Dashboard" styled per the nautical theme below.

### Chart presentation
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

### Visual style & colors (nautical theme)
- **D-12:** **Naval/nautical theme** — sailboats, ocean, water. Ocean-like colors, minimalistic: pastels + navy.
- **D-13:** **Pastels are canvas only**: pastel ocean tones (foam, seafoam, pale sky) for backgrounds, cards, surfaces. **Navy and deep tones carry all text, data lines, and interactive elements** — this is how the theme coexists with the non-negotiable high-contrast constraint (WCAG-safe contrast wherever information lives).
- **D-14:** BP category colors **keep clinical semantics** — recognizable green/yellow/orange/red severity (plus blue-grey Hypotension), tuned deeper/slightly desaturated to harmonize with the ocean palette. Never recolor severity into an ocean ramp.
- **D-15:** **Both light and dark themes ship in this phase** with a large accessible toggle. Light = airy nautical (pale foam/sky + navy); dark = "night sea" (navy-black + light text + pastel accents, contrast-checked). Theme toggle becomes a voice command later.
- **D-16:** Nautical imagery is **subtle motifs only**: a sailboat/anchor mark in the header, wave-curve section dividers, nautically-styled empty states. Chart canvases stay clean — no illustrations behind data.

### Filter controls
- **D-17:** Date presets (7/30/90 days/All) are a **segmented row of four large buttons**, active one filled navy — state always visible, each button maps 1:1 to a future voice command.
- **D-18:** Custom date range uses **From/To fields opening an oversized calendar picker with ≥48px day cells**, plus direct typed entry for keyboard users.
- **D-19:** AM/PM and BP category are **single-select button groups**: AM/PM as `[All | AM | PM]` segmented buttons; categories as one row of large chips — tap to isolate a category, tap again to return to all. No multi-select (keeps state and voice phrasing simple).
- **D-20:** Filters live in a **horizontal bar between the header and the hero chart**, wrapping on narrow screens — current filter state is always glanceable.

### Stats strip & readings table
- **D-21:** Stats strip shows **the full `/stats/summary` payload**: avg/min/max for systolic, diastolic, and pulse; reading count; and % per category for the current filter set (API-02 rendered as tiles).
- **D-22:** Stats strip sits **between the filter bar and the hero chart** — set a filter, see the numbers, then the chart shape.
- **D-23:** Readings table shows the **newest 20 rows with a giant "Show 20 more" button** — no pagination chrome, no inner scrollbars. Newest-first sort.
- **D-24:** Table columns: **Date, Time, AM/PM, BP as "128 / 74", Pulse, and a BP-category chip** in the category's clinical color with contrast-safe text; Notes shown only when present. MAP/pulse-pressure/pulse-category are not table columns.

### Claude's Discretion
- Exact pastel/navy hex values and the contrast-validated palette (must pass WCAG at ≥18px text), exact fixed-axis bounds, tooltip layout, animation easing, wave-divider implementation, table "Show more" increment mechanics, API response JSON shapes and query-param validation details, zustand store shape internals (as long as it cleanly maps to chart + date range + am/pm + category), where the readings table and AM/PM chart sit below the fold, responsive breakpoints. The `dataviz` skill and a `/gsd-ui-phase 2` UI-SPEC (roadmap hints UI: yes) can refine visuals within these locked decisions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project stack & requirements
- `CLAUDE.md` — Locked stack with versions: FastAPI 0.139 + Pydantic v2, SQLAlchemy 2.0 sync, React 19 + Vite 8 + TS 5.9, Recharts 3.9 (`accessibilityLayer` default on), zustand 5 (filter/UI state), TanStack Query 5 (server state), Tailwind 4 optional; CORS/deployment notes.
- `.planning/REQUIREMENTS.md` — API-01, API-02, DASH-01..09, DASH-11, ACC-01, ACC-02 definitions (this phase's scope).
- `.planning/ROADMAP.md` — Phase 2 goal + five success criteria (note: "matching the Tableau prototype" in criterion 1 is overridden by D-01).
- `.planning/PROJECT.md` — Data characteristics (132 readings, ~88% bradycardia, systolic 60–211), accessibility constraints, architecture sketch.

### Phase 1 outputs to build on
- `.planning/phases/01-data-foundation/01-CONTEXT.md` — Locked Phase 1 decisions: category names/boundaries (D-01..D-04), naive local time, result-summary shape.
- `backend/app/models.py` — `Reading` model (note `datetime_`/`map_value` attribute names vs `datetime`/`map` column names); portable column types.
- `backend/app/derivations.py` — Exact category label strings the API and frontend MUST reuse verbatim: "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"; "Bradycardia", "Normal", "Tachycardia".
- `backend/app/config.py` + `backend/app/db.py` — pydantic-settings and session patterns to extend for the API.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/` package (models, config, db, derivations, ETL) — the FastAPI app mounts on top of this; no `main.py`/routes exist yet.
- Seeded SQLite dev DB (`python -m app.seed`) with 132 real readings locally / synthetic sample on fresh clones — endpoints have real data to serve from day one.
- `backend/tests/` pytest suite + `conftest.py` fixtures — extend for endpoint tests (TestClient requires httpx per CLAUDE.md).

### Established Patterns
- SQLAlchemy 2.0 typed declarative, sync engine, portable types — API queries go through the ORM, one codebase for SQLite dev + Postgres prod.
- Naive local datetimes end-to-end (DATA-05) — API date filtering and JSON serialization must not introduce timezone conversion.
- pydantic-settings `get_settings()` cached accessor — extend Settings for CORS origins etc. rather than new config mechanisms.

### Integration Points
- `frontend/` directory is created fresh this phase (D-15 from Phase 1 reserved it); Vite `react-ts` template per CLAUDE.md.
- The zustand filter store shape (active chart + date range + am_pm + bp_category) is the contract Phase 3's agent command schema mirrors — design it as if a machine will mutate it, because one will.
- Auth: design a FastAPI dependency stub (e.g. `verify_token`) on routes now; Phase 5 turns it on. Never retrofit.

</code_context>

<specifics>
## Specific Ideas

- The rotating hero interaction is the user's signature idea: minis are live previews, and clicking one *rotates* it with the hero (the demoted chart takes the mini slot).
- Theme in one sentence: a calm coastal instrument panel — pastel ocean canvas, navy ink, clinical severity colors where health meaning lives, a hint of sail in the chrome.
- The filter bar should read left-to-right like a sentence of the current state: "Last 30 days · AM · All categories".

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Read API & Dashboard*
*Context gathered: 2026-07-14*
