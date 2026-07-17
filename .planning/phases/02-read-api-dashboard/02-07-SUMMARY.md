---
phase: 02-read-api-dashboard
plan: 07
subsystem: frontend-dashboard
tags: [react, typescript, tailwind, zustand, tanstack-query, recharts, accessibility]
requires:
  - phase: 02-read-api-dashboard
    plan: 03
    provides: "store/filters.ts (activeChart/setActiveChart), useResolvedFilters, useReadings, useStats, lib/dates.ts presetLabel"
  - phase: 02-read-api-dashboard
    plan: 04
    provides: "BPTimeline, PulseTrend, CategoryBars, AmPmComparison with hero/mini variant contracts"
  - phase: 02-read-api-dashboard
    plan: 05
    provides: "Header (DASH-11) and FilterBar with latestReading anchor"
  - phase: 02-read-api-dashboard
    plan: 06
    provides: "StatsStrip, ReadingsTable, EmptyState prop contracts"
provides:
  - "ChartDeck: hero slot + three live mini buttons with animated rotation (D-02/D-03/D-04)"
  - "Fully assembled App.tsx: Header → FilterBar → StatsStrip → chart region → ReadingsTable wired to live API data"
  - "Centralized loading (aria-busy skeleton), error (UI-SPEC copy + Try again), and empty (guided EmptyState) states"
  - "Human-verified phase goal: all four charts explorable with consistent filters (ROADMAP SC1–SC5 evidence)"
affects:
  - "Phase 3 (agent mutates the same filter store the assembled dashboard subscribes to)"
tech-stack:
  added: []
  patterns:
    - "Data fetched once at App level (useResolvedFilters + useReadings + useStats); all components stay presentational"
    - "Chart registry const array maps four ChartIds to title/ariaName/element; hero derived from store activeChart"
    - "Whole-card <button> minis with pointer-events-none chart wrapper (Pitfall 8 — button owns activation)"
    - "Mount-fade keyed on activeChart with motion-reduce:transition-none for the reduced-motion contract"
key-files:
  created:
    - frontend/src/components/ChartDeck.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/tests/smoke.test.tsx
decisions:
  - "CategoryBars stats prop narrowed inside ChartDeck (null-guard entry) — App only renders the deck after both queries succeed, so the guard is type narrowing, not a reachable UI state"
  - "Swap animation implemented as a keyed mount-fade (opacity + scale, 250ms ease-in-out) on hero and affected mini only; instant under prefers-reduced-motion"
  - "Error panel refetches BOTH queries from one Try again button; ApiError details never rendered (T-02-11)"
  - "Smoke test wraps App in a fresh QueryClientProvider (retry: false) with stubbed fetch — asserts the h1, never chart internals (Pitfall 2)"
metrics:
  duration: 6min execution + human-verify checkpoint
  tasks: 3
  files: 3
  completed: 2026-07-17
---

# Phase 2 Plan 07: ChartDeck Rotation + App Assembly Summary

Hero/mini rotating ChartDeck plus the fully data-wired App assembly make the Phase 2 goal true in a browser — human checkpoint approved all 10 visual/functional/keyboard checks, discharging the deferred .dark spot check and the ACC-01/ACC-02 interactive audit.

## What Was Built

- **ChartDeck** (`frontend/src/components/ChartDeck.tsx`): const registry mapping the four `ChartId`s to `{ title, ariaName, element }` (Blood Pressure, Pulse, BP Categories, AM vs PM). Hero slot is `h-[420px]` with a 24px/700 title heading, rendering the store's `activeChart` at `variant="hero"` (BP Timeline default, D-03). The other three charts render in fixed registry order as whole-card `<button>` minis (`grid md:grid-cols-3 gap-6`, stacked below 768px) — visible 20px title, `aria-label="Show {name} chart"`, `h-36` chart area behind a `pointer-events-none` wrapper. Click calls `setActiveChart(id)`; the swap is a 250ms opacity+scale mount-fade keyed to the affected slots, `motion-reduce:transition-none` (D-02/D-04).
- **App assembly** (`frontend/src/App.tsx`): data wired once at App level — `useResolvedFilters()` feeding `useReadings` and `useStats`; everything below stays presentational. Layout per UI-SPEC vertical order inside one `<main>` (`max-w-screen-xl`, `px-4 md:px-8 xl:px-16`, `space-y-8`): Header → FilterBar (latestReading anchor) → StatsStrip → chart region → ReadingsTable. Chart region states: initial pending → skeleton hero + mini placeholders with `aria-busy="true"`; either query error → "Couldn't load the readings" panel with 18px body and accent `min-h-12` Try again refetching both queries (no raw error rendering, T-02-11); zero results → guided `EmptyState` using the shared `presetLabel` helper while FilterBar stays visible (D-11); otherwise → live ChartDeck.
- **Smoke test** (`frontend/src/tests/smoke.test.tsx`): App rendered in a fresh `QueryClientProvider` (retry off) with `vi.stubGlobal` fetch returning `[]` for /readings and a zero-count StatsSummary for /stats/summary; asserts "Chris's Health Dashboard" renders.

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | ChartDeck — hero slot, live mini buttons, animated rotation | 549774d | feat |
| 2 | App assembly — layout, data wiring, loading/error/empty states, smoke test | 65374a2 | feat |
| 3 | Visual + accessibility verification checkpoint | approved by human | checkpoint |

## Human Verification (Task 3 checkpoint)

**Result: approved — all 10 steps passed in a real browser.**

- Page load, header, BP Timeline default hero, three live minis, populated stats strip, 20-row table — all present. The prior UAT report "page does not load" (UAT test 6) **did NOT reproduce**.
- BP Timeline: AHA bands behind lines, full 60–211 systolic range without clipping on the fixed 40–220 axis, dots at every reading, persistent click-tooltips closing via 48px button and Escape (no hover-only behavior).
- Rotation verified for all three minis, ~250ms animated swap; Pulse hero shows the dashed 60 bpm bradycardia line; BP Categories shows six clinical-order labeled bars; AM vs PM shows grouped bars.
- Filters update charts, stats strip, and table together (DASH-07); zero-result combination shows the guided empty state with "Show all data" restore; custom-range calendar cells ≥48px with typed-date entry.
- Stats parity: UI tiles match `GET /stats/summary?am_pm=AM` exactly (ROADMAP SC3).
- Dark theme flips to #0B1626 with readable text/charts/chips and survives reload — discharges the .dark visual spot check deferred since plan 02-02.
- Keyboard-only pass (ACC-02): full Tab walk with visible 3px focus rings, hero chart as a single tab stop with ArrowLeft/ArrowRight point navigation, Escape closes tooltips, all targets ≥48px (ACC-01) — no drag, hover, or precision interactions anywhere.

## Verification

- `npm test -- --run` — full suite green, including the rewritten smoke test
- `npm run build` — tsc + vite exit 0
- Grep gates: ChartDeck contains `setActiveChart`, `motion-reduce`, `variant="hero"`, `variant="mini"`, `pointer-events-none`, `h-[420px]`, `h-36`, aria-label mini buttons, four registry entries. App.tsx contains `useResolvedFilters`, `EmptyState`, "Couldn't load the readings", "Try again", `aria-busy`, source-order Header → FilterBar → StatsStrip → ChartDeck → ReadingsTable, and no raw `error.message` rendering.
- Human checkpoint (above) is the evidence source for ROADMAP SC1–SC5 and closes the 02-VERIFICATION.md `deferred:` items.

## Deviations from Plan

None - plan executed exactly as written. (Chart-level interaction fixes such as the Recharts keyboard wrapper belong to plan 02-04, not this plan.)

## Known Stubs

None — every component is wired to live API data; all loading/error/empty states render their contracted UI-SPEC presentation.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface. T-02-11 mitigated (UI-SPEC error copy only; ApiError never rendered — grep-asserted). T-02-08 carried (React text nodes only). T-02-03 accepted per phase scope (auth gate lands in Phase 5). T-02-SC honored (zero new packages).

## Next Phase Readiness

Phase 2 is functionally complete: the manual filter state shape that Phase 3's `/agent` endpoint will mutate is live and human-verified. The agent can drive `store/filters.ts` (activeChart, date preset/custom range, AM/PM, category) from outside the React tree with every subscriber already proven consistent.

## Self-Check: PASSED

All 3 key files exist on disk; commits 549774d and 65374a2 present in git log; checkpoint approval recorded above.
