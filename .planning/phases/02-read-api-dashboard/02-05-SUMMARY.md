---
phase: 02-read-api-dashboard
plan: 05
subsystem: ui
tags: [react, tailwind, zustand, react-day-picker, lucide-react, accessibility]

# Dependency graph
requires:
  - phase: 02-03
    provides: "zustand filter/theme stores, lib/dates helpers (presetLabel, parseDateOnly, formatDateParam, fmtLongDate), lib/palette (CLINICAL_ORDER, categoryColor, CHIP_TEXT), index.css design tokens"
provides:
  - "Header component (DASH-11): sailboat mark, 32px title, labeled Sun/Moon theme toggle, wave-curve divider"
  - "FilterBar component (DASH-07 UI): date presets, AM/PM segment, category chips, aria-live filter-state sentence, Custom disclosure"
  - "DateRangePicker component (D-18): 48px-cell react-day-picker range calendar + strict typed YYYY-MM-DD entry"
affects: [02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared control styling contract: inactive = sky card + 2px ink border, active = reserved accent fill, min-h-12 + 20px/700 labels"
    - "Single-select toggle chips: tap active chip returns to 'all'; clinical colors never greyed out (D-14)"
    - "Inline disclosure instead of popover for the custom range (keyboard-friendly, no focus trap)"
    - "Date strings only cross the string↔Date boundary via parseDateOnly/formatDateParam (Pitfall 1)"

key-files:
  created:
    - frontend/src/components/Header.tsx
    - frontend/src/components/FilterBar.tsx
    - frontend/src/components/DateRangePicker.tsx
  modified: []

key-decisions:
  - "Active chip ring rendered as box-shadow (visually a 3px ink outline) so the :focus-visible outline stays independently visible when a chip is both active and focused"
  - "Apply button uses aria-disabled + onClick guard instead of the disabled attribute so keyboard users can still focus it and hear why it is unavailable"
  - "Selecting a day preset closes the Custom disclosure to keep the bar's visible state consistent with the sentence"

# Metrics
duration: 4min
completed: 2026-07-17
---

# Phase 2 Plan 05: Header & Filter Controls Summary

**Nautical header with labeled theme toggle plus a fully keyboard-operable filter bar (presets, AM/PM, category chips, 48px-cell custom calendar) wired to the 02-03 zustand store.**

## What Was Built

### Task 1 — Header (`frontend/src/components/Header.tsx`)
- `<header>` on foam: `Sailboat` lucide icon (`aria-hidden`, ink color) beside the 32px/700 "Chris's Health Dashboard" title (DASH-11, D-01 — standalone nautical design, not the Tableau prototype).
- Theme toggle (D-15): single `min-h-12` button, always icon + 20px text label (`Sun` + "Light" / `Moon` + "Dark"), `aria-pressed={theme === "dark"}`, styled as an inactive control (accent fill is reserved and excludes the toggle). Calls `toggleTheme()` from `useTheme`.
- Wave-curve SVG divider (D-16): decorative, `aria-hidden`, filled `var(--color-sky)` so it flips to deep sea in dark theme automatically. Zero hex literals in the file.

### Task 2 — FilterBar (`frontend/src/components/FilterBar.tsx`)
- Date preset row (D-17): "7 days" / "30 days" / "90 days" / "All" call `setDatePreset`; "Custom…" toggles an inline DateRangePicker disclosure (`aria-expanded`) and shows active when `datePreset === "custom"`. Group has `role="group" aria-label="Date range"`.
- AM/PM segment (D-19): `[All | AM | PM]` via `setAmPm`, same accent/aria-pressed pattern, `aria-label="Time of day"`.
- Category chips (D-19/D-14): generated from `CLINICAL_ORDER` with solid `categoryColor` fills and `CHIP_TEXT` text; single-select toggle — tapping the active chip calls `setBpCategory("all")`; active chip gets a 3px ink ring; inactive chips stay solid-colored (clinical colors are information).
- Filter-state sentence (D-20): always-visible 18px `aria-live="polite"` line, e.g. "Last 30 days · to June 13, 2025 · AM · All categories", using the shared `presetLabel` helper and the honest newest-reading anchor (`fmtLongDate(latestReading)`) for day presets.
- Props: only `{ latestReading: string | null }` — all filter state via `useFilters` selectors; no fetching.

### Task 3 — DateRangePicker (`frontend/src/components/DateRangePicker.tsx`)
- Labeled From/To text inputs (`inputMode="numeric"`, placeholder "YYYY-MM-DD", 18px, `min-h-12`) with strict validation: `/^\d{4}-\d{2}-\d{2}$/` + `formatDateParam(parseDateOnly(s)) === s` round-trip (rejects rollover dates like 2025-02-31). Invalid input shows the 18px inline error "Enter a date like 2025-06-13" — never a crash, never an invalid query param (threat T-02-10 mitigation).
- `<DayPicker mode="range">` from react-day-picker 9 with `react-day-picker/style.css` imported here; day cells sized 48px via v9 CSS custom properties (`--rdp-day-width/height`, `--rdp-day_button-width/height`) and accent-token selected styling. Range selection fills both inputs through `formatDateParam`.
- Apply button: accent fill when both dates valid; otherwise `aria-disabled` with visible dashed-border sky styling (still contrast-passing) and an onClick guard. All conversions via `parseDateOnly`/`formatDateParam` — zero `new Date("` on date-only strings.

## Verification

- `npm run build` green after each task (tsc + vite).
- `npm test -- --run`: 25/25 tests passing (no regressions).
- Grep gates all pass: Header `aria-hidden` ×4, no hex/http; FilterBar `aria-pressed` ×5, `min-h-12` ×3, `aria-live`, `CLINICAL_ORDER`, exact preset labels, explicit `setBpCategory("all")` toggle branch; DateRangePicker `DayPicker`, `mode="range"`, style.css import, `--rdp-day` sizing ×4, zero `new Date("`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task order swapped: DateRangePicker (Task 3) implemented before FilterBar (Task 2)**
- **Found during:** Task 2 setup
- **Issue:** FilterBar imports DateRangePicker, so Task 2's `npm run build` gate cannot pass until Task 3's file exists
- **Fix:** Implemented and committed DateRangePicker first, then FilterBar; both tasks executed exactly as specified otherwise
- **Files modified:** none beyond planned files
- **Commits:** ae3f53d (Task 3), 879a5b2 (Task 2)

No other deviations — all three components match the plan's actions and interface contract.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | f7cc7d0 | feat(02-05): add nautical header with labeled theme toggle |
| 3 | ae3f53d | feat(02-05): add DateRangePicker with 48px calendar and typed entry |
| 2 | 879a5b2 | feat(02-05): add FilterBar with presets, AM/PM segment, category chips |

## Next Phase Readiness

- `Header` (no props) and `FilterBar` (`latestReading` prop) are ready for App composition in 02-07.
- Filter mutations flow exclusively through the 02-03 store actions — the exact surface the Phase 3 agent handler will mirror.
- Interactive behavior (toggle, chips, calendar) is verified at the 02-07 end-of-phase human checkpoint per config `human_verify_mode: end-of-phase`.

## Threat Flags

None — no new network endpoints, auth paths, or file access; the only free-text surface (typed dates) carries the planned T-02-10 mitigation.

## Self-Check: PASSED

All 3 created files exist on disk; all 3 task commits (f7cc7d0, ae3f53d, 879a5b2) present in git log.
