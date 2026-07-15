---
phase: 02-read-api-dashboard
plan: 02
subsystem: frontend-foundation
tags: [react, vite, typescript, tailwind4, design-tokens, zustand, tanstack-query, accessibility]
requires:
  - phase: 02-read-api-dashboard plan 01
    provides: "backend/app/schemas.py JSON contract (Reading keys datetime/map, six canonical BP labels, StatsSummary shape)"
provides:
  - "frontend/ Vite react-ts scaffold building and testing green on locked versions (React 19.2, Vite 8, TS ~5.9, Recharts 3.9, zustand 5, Query 5, Tailwind 4)"
  - "Complete two-theme nautical token system in index.css: surfaces, chart series, six clinical category vars, band opacity, chip text (D-12/D-13/D-14)"
  - "zustand theme store with .dark class toggle + localStorage persistence (D-15)"
  - "Typed API client (getReadings/getStatsSummary) + TS types mirroring backend schemas.py exactly"
affects:
  - "02-03..02-06: all later frontend plans consume these tokens/types without inventing values"
tech-stack:
  added:
    - "react 19.2.7 / vite 8.1.4 / typescript ~5.9.3 (pinned — template shipped 6.0.2)"
    - "recharts 3.9, zustand 5.0, @tanstack/react-query 5.101, react-day-picker 9.14"
    - "lucide-react, @fontsource/atkinson-hyperlegible (self-hosted font, SEC-03)"
    - "tailwindcss 4.3 + @tailwindcss/vite, vitest 4.1 + RTL + jest-dom + jsdom"
  patterns:
    - "Tailwind 4 CSS-first: @custom-variant dark rebinds dark: to .dark class (Pitfall 12)"
    - "All chart/category colors are CSS custom properties so Recharts SVG flips with the theme class"
    - "zustand = UI state only; TanStack Query = server state (CLAUDE.md separation)"
key-files:
  created:
    - frontend/package.json (locked deps, test script)
    - frontend/vite.config.ts (tailwindcss + react plugins, vitest jsdom config)
    - frontend/src/index.css (full light+dark token set, 18px floor, :focus-visible ring)
    - frontend/src/store/theme.ts (hv-theme localStorage, .dark classList toggle)
    - frontend/src/api/types.ts (Reading, StatsSummary, BPCategory, ChartId, ResolvedFilters)
    - frontend/src/api/client.ts (getJson on VITE_API_URL, ApiError)
    - frontend/src/tests/setup.ts, frontend/src/tests/smoke.test.tsx
    - frontend/.env.development (VITE_API_URL=http://localhost:8000)
  modified:
    - frontend/src/main.tsx (@fontsource 400/700 imports, QueryClientProvider, initTheme before render)
    - frontend/src/App.tsx (temporary shell — real layout in 02-06)
    - frontend/index.html (title; zero third-party resources)
decisions:
  - "TypeScript pinned ~5.9.0 before first install — create-vite template scaffolded 6.0.2 (Pitfall 11, CLAUDE.md lock)"
  - "Color tokens live on :root/.dark as plain custom properties (not @theme) so .dark overrides cascade; @theme carries only --text-base and --font-sans"
  - "ResolvedFilters is a type alias (not interface) so it satisfies the getJson Record<string, string | undefined> params signature"
  - "Hex values kept uppercase exactly as the UI-SPEC tables print them (verifier-greppable literal fidelity)"
metrics:
  duration: "~17 min (post-checkpoint continuation)"
  completed: "2026-07-15"
  tasks: "3/3 (Task 1 = human checkpoint, approved)"
---

# Phase 2 Plan 02: Frontend Scaffold + Design Tokens Summary

**One-liner:** Vite react-ts scaffold on the locked stack (TS pinned ~5.9 against a 6.0.2 template default) with the complete two-theme nautical token system, self-hosted Atkinson Hyperlegible, zustand theme store, and a typed API client mirroring the backend schemas.

## What Was Built

- **Task 1 (checkpoint, approved):** Human verified legitimacy of `lucide-react`, `@fontsource/atkinson-hyperlegible`, and the `vitest` [SUS] false-positive before any npm install ran (threat T-02-SC).
- **Task 2 (38a3b7e):** `npm create vite@latest frontend -- --template react-ts`; TypeScript re-pinned to `~5.9.0` before the first install (template shipped `~6.0.2` — Pitfall 11 confirmed live). Installed the exact audited dependency set; wired `@tailwindcss/vite` + Vitest (jsdom, globals, setup file with jest-dom matchers) into `vite.config.ts`; smoke test renders `<App />` as the suite floor. `index.html` titled "Chris's Health Dashboard" with zero third-party script/stylesheet URLs (SEC-03). `npx tsc --version` → 5.9.3; build + tests exit 0.
- **Task 3 (9332ba4):** `index.css` defines the full UI-SPEC token contract — `@custom-variant dark (&:where(.dark, .dark *))`, `@theme` with the 18px body floor and Atkinson Hyperlegible stack, all surface/chart/category custom properties on `:root` with `.dark` overrides (exact contrast-computed hex pairs, D-12/D-13/D-14), `--band-opacity` 0.10/0.14, and the global 3px `:focus-visible` ring (ACC-02). `store/theme.ts` toggles `.dark` on `<html>` and persists to localStorage `hv-theme` (D-15). `api/types.ts` mirrors `backend/app/schemas.py` verbatim (JSON keys `datetime`/`map`, six category labels with spaces, `ChartId` vocabulary, `ResolvedFilters`). `api/client.ts` wraps fetch on `VITE_API_URL` with `ApiError` (no raw status text reaches UI). `main.tsx` imports the self-hosted font 400/700, wraps `<App />` in `QueryClientProvider`, calls `initTheme()` before render.

## Verification Results

- `npx tsc --version` → **Version 5.9.3** ✓
- `npm run build` → exit 0 (fonts bundled as local woff/woff2 — no CDN) ✓
- `npm test -- --run` → 1 file, 1 test passed ✓
- `grep 'src="http\|href="http' index.html` → no matches ✓
- `grep -c -- "--cat-crisis" src/index.css` → 2; `grep -c "Hypertensive Crisis" src/api/types.ts` → 1 ✓
- Manual `.dark` devtools spot check deferred to 02-06 full visual verification (per plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `vitest/globals` to tsconfig.app.json types**
- **Found during:** Task 2
- **Issue:** Plan specifies `globals: true` Vitest config; `tsc -b` (part of `npm run build`) fails on global `test`/`expect` without the type reference
- **Fix:** `"types": ["vite/client", "vitest/globals"]` in tsconfig.app.json
- **Commit:** 38a3b7e

**2. [Rule 1 - Cleanup] Removed dead scaffold assets**
- **Found during:** Task 3
- **Issue:** Replacing the scaffold `App.tsx` orphaned `App.css`, `src/assets/{hero.png,react.svg,vite.svg}`, and `public/icons.svg` (referenced only by the demo shell)
- **Fix:** Deleted intentionally; `public/favicon.svg` kept (referenced by index.html)
- **Commit:** 9332ba4

**3. Template drift (informational):** create-vite 9.1.1 now ships oxlint instead of ESLint and no `vite-env.d.ts` (tsconfig uses `types: ["vite/client"]`). Kept oxlint as scaffolded; created `src/vite-env.d.ts` anyway to match the plan's file list. Template also shipped TS `~6.0.2` — pinned per plan (not a deviation; the plan anticipated this as Pitfall 11).

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Temporary app shell (h1 only, no data wired) | frontend/src/App.tsx | Intentional per plan — real dashboard layout lands in plan 02-06; API client/query wiring consumed by plans 02-03..05 |

## Threat Flags

None — no new endpoints or trust-boundary surface. Only `VITE_API_URL` exists in frontend env (T-02-06 mitigated); zero third-party resources verified by grep (T-02-07 mitigated); all installs were human-approved or RESEARCH-audited (T-02-SC mitigated).

## Self-Check: PASSED

All key files exist on disk; commits 38a3b7e and 9332ba4 present in git log.
