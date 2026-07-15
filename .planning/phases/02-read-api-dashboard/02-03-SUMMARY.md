---
phase: 02-read-api-dashboard
plan: 03
subsystem: frontend-state
tags: [zustand, tanstack-query, dates, palette, dash-07]
requires:
  - phase: 02-read-api-dashboard
    plan: 01
    provides: "GET /readings + /stats/summary filter contract (start_date/end_date/am_pm/bp_category), unfiltered latest_reading"
  - phase: 02-read-api-dashboard
    plan: 02
    provides: "frontend scaffold, api/types.ts + api/client.ts, index.css category tokens, zustand/react-query installed"
provides:
  - "useFilters zustand store — THE Phase 3 agent command schema (activeChart, datePreset, customRange, amPm, bpCategory + machine-callable setters)"
  - "resolveFilters + parseDateOnly/formatDateParam + fmtLongDate/fmtShortDate/fmtTooltipTitle + presetLabel in lib/dates.ts"
  - "CLINICAL_ORDER + categoryColor + CHIP_TEXT single-source palette (CSS vars only)"
  - "useReadings/useStats query hooks (keepPreviousData) + useResolvedFilters store→params bridge"
affects: [02-04, 02-05, 02-06, 02-07, phase-03-agent]
tech-stack:
  added: []
  patterns:
    - "Two-key TanStack pattern: queryKey ['readings'|'stats', resolvedFilters]; empty-filter stats query = stable preset anchor (staleTime Infinity)"
    - "Split-parse all date-only strings via parseDateOnly; new Date() only for naive ISO datetimes (Pitfall 1)"
    - "Presets anchor to latest_reading, never today (Pitfall 9) — Phase 3 API-05 must copy this anchor"
key-files:
  created:
    - frontend/src/lib/dates.ts
    - frontend/src/lib/dates.test.ts
    - frontend/src/store/filters.ts
    - frontend/src/store/filters.test.ts
    - frontend/src/lib/palette.ts
    - frontend/src/lib/palette.test.ts
    - frontend/src/hooks/useReadings.ts
    - frontend/src/hooks/useStats.ts
  modified: []
decisions:
  - "Date presets anchor to latest_reading (newest reading), never today — recorded in lib/dates.ts docstring for Phase 3's server-side resolver (RESEARCH Open Question 1 / Pitfall 9)"
  - "Default datePreset is 'all' — always-safe first load shows Chris's full range (RESEARCH Open Question 2)"
  - "DatePreset type is defined in lib/dates.ts and re-exported by store/filters.ts (keeps lib → store dependency direction clean while satisfying the interface contract)"
  - "Day preset with null latestReading omits date keys (behaves as 'all' until the anchor query resolves) — defensive fallback"
metrics:
  duration: 6min
  tasks: 3
  files: 8
  completed: 2026-07-15
---

# Phase 02 Plan 03: Filter State Foundations Summary

Zustand filter store shaped as the Phase 3 agent command schema, pure preset-to-range date resolution anchored to the newest reading, single-source CSS-var category palette, and TanStack Query hooks with keepPreviousData — all unit-tested (25 tests green) and building clean.

## What Was Built

- **`lib/dates.ts`** (TDD): `parseDateOnly`/`formatDateParam` split-parse date-only strings into local components (never `new Date("YYYY-MM-DD")` — Pitfall 1); `fmtLongDate`/`fmtShortDate`/`fmtTooltipTitle` match UI-SPEC copy exactly ("June 13, 2025", "Jun 13", "June 3, 2025 · 7:42 AM"); `resolveFilters` turns store state + `latest_reading` anchor into inclusive `start_date`/`end_date` params (30d anchored to 2025-06-13 → 2025-05-15..2025-06-13); `presetLabel` is the single D-20 label source for FilterBar (02-05) and EmptyState (02-07).
- **`store/filters.ts`** (TDD): the exact RESEARCH Code Example 3 shape with `ChartId`/`BPCategory` imported from `api/types`. Preset↔custom exclusivity (setDatePreset clears customRange; setCustomRange flips to "custom"), D-19 single-select amPm/bpCategory, `showAllData` resets filters but leaves `activeChart` untouched (D-11). Default `datePreset: "all"`.
- **`lib/palette.ts`**: `CLINICAL_ORDER` (six verbatim labels, clinical order, matches backend), `categoryColor` → `var(--cat-...)` strings referencing the exact index.css token names, `CHIP_TEXT`. Zero hex values — themes flip via CSS vars.
- **`hooks/useReadings.ts` / `hooks/useStats.ts`**: two-key query pattern (`["readings", resolved]` / `["stats", resolved]`) with `placeholderData: keepPreviousData` (v5 rename — Pitfall 13) and 5-min staleTime. `useResolvedFilters` subscribes to the store field-by-field, fetches the unfiltered stats anchor (`queryKey: ["stats", {}]`, `staleTime: Infinity` — latest_reading is unfiltered in every stats response, so TanStack dedupes it with the main stats query when filters are empty), and returns `resolveFilters(state, anchor?.latest_reading ?? null)`.

## Verification

- `npm test -- --run` — 4 files, 25 tests passed (14 dates, 6 store, 4 palette, 1 existing smoke)
- `npm run build` — exit 0 (tsc -b + vite build)
- 30d/anchor test asserts the exact pair start_date "2025-05-15" / end_date "2025-06-13" (inclusive-range contract matching backend Pitfall-4 semantics)
- `grep -c "var(--cat-" src/lib/palette.ts` = 7 (≥6); no `#` hex literal in palette.ts
- useReadings contains `placeholderData: keepPreviousData` + `["readings"`; useStats contains `["stats"`, `useResolvedFilters`, and `staleTime: Infinity` on the anchor query

## TDD Gate Compliance

Tasks 1 and 2 followed RED → GREEN:
- Task 1: `test(02-03)` 4f8474c (failing — module absent) → `feat(02-03)` 90eec8e (14 tests pass)
- Task 2: `test(02-03)` 3ed189d (failing — module absent) → `feat(02-03)` a7ee2ca (6 tests pass)

No refactor commits needed — implementations were minimal on first pass.

## Deviations from Plan

**1. [Rule 3 - Blocking] Restored frontend node_modules in the worktree**
- **Found during:** Task 1 setup
- **Issue:** Fresh git worktree has no `node_modules`; tests/build cannot run
- **Fix:** `npm ci` from the existing committed `package-lock.json` — no new packages added or versions changed (T-02-SC respected)
- **Files modified:** none (node_modules is gitignored)
- **Commit:** n/a

**2. [Minor structural] `DatePreset` defined in `lib/dates.ts`, re-exported by `store/filters.ts`**
- **Found during:** Task 1
- **Issue:** The interface contract has both `dates.ts` (`presetLabel(preset: DatePreset)`, Task 1) and `filters.ts` (Task 2) using `DatePreset`, but Task 1 executes first — defining it in the store would invert the dependency (lib importing store)
- **Fix:** Single definition in `lib/dates.ts`; `store/filters.ts` does `export type { DatePreset }` so consumers importing from the store still work per the contract
- **Files modified:** frontend/src/lib/dates.ts, frontend/src/store/filters.ts
- **Commits:** 90eec8e, a7ee2ca

## Known Stubs

None — all modules are fully wired: hooks call the real `api/client.ts` functions, the palette references real index.css tokens, and `resolveFilters` is consumed by `useResolvedFilters`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | 4f8474c | test(02-03): add failing tests for date resolution and formatters |
| 1 (GREEN) | 90eec8e | feat(02-03): implement lib/dates.ts — split-parse helpers, formatters, resolveFilters |
| 2 (RED) | 3ed189d | test(02-03): add failing tests for the zustand filter store |
| 2 (GREEN) | a7ee2ca | feat(02-03): implement store/filters.ts — the Phase 3 agent command schema |
| 3 | c871188 | feat(02-03): add category palette and TanStack Query hooks |

## Notes for Wave-2 Plans (02-04..02-07)

- Import `presetLabel` from `lib/dates.ts` — do not re-derive preset labels
- Import `CLINICAL_ORDER`/`categoryColor`/`CHIP_TEXT` from `lib/palette.ts` — never hardcode category colors
- Use `useResolvedFilters()` once near the top of the dashboard tree and pass the result to `useReadings`/`useStats`
- `requirements: [DASH-07]` is the state half only — the UI half (filter controls) lands in 02-05

## Self-Check: PASSED

All 8 created files exist on disk; all 5 task commits (4f8474c, 90eec8e, 3ed189d, a7ee2ca, c871188) present in git log.
