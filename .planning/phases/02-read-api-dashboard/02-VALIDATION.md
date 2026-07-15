---
phase: 2
slug: read-api-dashboard
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
updated: 2026-07-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x (backend) / vitest 4.x (frontend) |
| **Config file** | backend: none — Wave 0 installs fastapi/httpx test deps; frontend: none — Wave 0 scaffolds Vite + Vitest |
| **Quick run command** | `cd backend && .venv/bin/python -m pytest -q` |
| **Full suite command** | `cd backend && .venv/bin/python -m pytest -q && cd ../frontend && npm test -- --run && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the side touched (backend pytest / frontend vitest)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Plans 02-01 and 02-02 (backend read API + frontend scaffold, including all Wave 0 items) executed and verified green before this revision — see their SUMMARYs. Rows below cover the remaining plans 02-03..02-07. All frontend commands run from `frontend/` (plan `<automated>` blocks prefix them with `cd /Users/dp/Documents/GitHub/Health-Visualizer/frontend &&`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-03-T1 | 02-03 | 1 | DASH-07 | T-02-09 | resolveFilters emits only closed-union params; anchor never "today" | unit (vitest, TDD) | `npm test -- --run src/lib/dates.test.ts` | ✅ in-task | ⬜ pending |
| 02-03-T2 | 02-03 | 1 | DASH-07 | T-02-09 | filter store = closed-union agent command schema | unit (vitest, TDD) | `npm test -- --run src/store/filters.test.ts` | ✅ in-task | ⬜ pending |
| 02-03-T3 | 02-03 | 1 | DASH-07, DASH-08 | T-02-09 | palette keyed by closed six-label union; no free strings | unit + build + grep | `npm test -- --run && npm run build && grep -c "var(--cat-" src/lib/palette.ts && grep -c "keepPreviousData" src/hooks/useReadings.ts` | ✅ in-task | ⬜ pending |
| 02-04-T1 | 02-04 | 2 | DASH-01..04, DASH-06 | — | pure data shaping, no DOM/Recharts imports | unit (vitest, TDD) | `npm test -- --run src/lib/chartData.test.ts` | ✅ in-task | ⬜ pending |
| 02-04-T2 | 02-04 | 2 | DASH-01, DASH-05, DASH-06 | T-02-08 | React/SVG text nodes only; no dangerouslySetInnerHTML | build + grep | `npm run build && grep -c "ReferenceArea" src/components/charts/BPTimeline.tsx && grep -c "chart-band" src/index.css && grep -c "min-h-12" src/components/charts/ChartTooltip.tsx` | n/a (grep gate) | ⬜ pending |
| 02-04-T3 | 02-04 | 2 | DASH-02, DASH-03, DASH-04, DASH-06 | T-02-08 | closed palette map; zero hex literals in charts | build + unit + grep | `npm run build && npm test -- --run && grep -c "ReferenceLine" src/components/charts/PulseTrend.tsx && grep -c "Cell" src/components/charts/CategoryBars.tsx` | n/a (grep gate) | ⬜ pending |
| 02-05-T1 | 02-05 | 2 | DASH-11 | T-02-08 | token-driven header; no hex, no URLs | build + grep | `npm run build && grep -c "Chris's Health Dashboard" src/components/Header.tsx && grep -c "aria-hidden" src/components/Header.tsx` | n/a (grep gate) | ⬜ pending |
| 02-05-T2 | 02-05 | 2 | DASH-07 | T-02-08 | closed-union labels; React text nodes only | build + grep | `npm run build && grep -c "aria-pressed" src/components/FilterBar.tsx && grep -c "min-h-12" src/components/FilterBar.tsx` | n/a (grep gate) | ⬜ pending |
| 02-05-T3 | 02-05 | 2 | DASH-07 | T-02-10 | strict regex + parseDateOnly round-trip before any value reaches the store | build + grep | `npm run build && grep -c "DayPicker" src/components/DateRangePicker.tsx && grep -c "parseDateOnly" src/components/DateRangePicker.tsx` | n/a (grep gate) | ⬜ pending |
| 02-06-T1 | 02-06 | 2 | DASH-08 | T-02-11 | stats payload rendered verbatim; no error objects rendered | build + grep | `npm run build && grep -c "aria-busy" src/components/StatsStrip.tsx && grep -c "Show all data" src/components/EmptyState.tsx` | n/a (grep gate) | ⬜ pending |
| 02-06-T2 | 02-06 | 2 | DASH-09 | T-02-08 | free-text notes rendered as React text node only | unit (RTL, TDD) + build | `npm test -- --run src/components/ReadingsTable.test.tsx && npm run build` | ✅ in-task | ⬜ pending |
| 02-07-T1 | 02-07 | 3 | DASH-07 | T-02-08 | no HTML injection surface | build + grep | `npm run build && grep -c "setActiveChart" src/components/ChartDeck.tsx && grep -c "motion-reduce" src/components/ChartDeck.tsx` | n/a (grep gate) | ⬜ pending |
| 02-07-T2 | 02-07 | 3 | DASH-07 | T-02-11 | UI-SPEC error copy only; no raw error.message rendered | integration (smoke) + build + grep | `npm test -- --run && npm run build && grep -c "useResolvedFilters" src/App.tsx && grep -c "Couldn't load the readings" src/App.tsx` | ✅ in-task (smoke updated) | ⬜ pending |
| 02-07-T3 | 02-07 | 3 | ACC-01, ACC-02, DASH-01..09, DASH-11 | T-02-03 | human checkpoint (accept: unauthenticated read API until Phase 5) | human-verify | — (manual; see Manual-Only Verifications) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Backend deps install: `fastapi[standard]`, `uvicorn[standard]`, `httpx` into `backend/.venv` (delivered in 02-01)
- [x] `backend/tests/test_readings_api.py` — stubs for API-01 (filters, ordering) (delivered + green in 02-01)
- [x] `backend/tests/test_stats_api.py` — stubs for API-02 (summary stats, zero-filled categories) (delivered + green in 02-01)
- [x] Frontend scaffold: Vite react-ts template + Vitest + @testing-library/react wiring (delivered in 02-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart visual rendering (bands z-order, axis ranges, line-end labels) | DASH-01..04 | Visual output; Recharts renders SVG that unit tests can't judge for correctness | Load dashboard with seeded dev.db; confirm all four charts render full data range (systolic 60–211) without clipping — covered by 02-07 Task 3 checkpoint steps 3–6 |
| ≥48px targets, ≥18px text, focus visibility, keyboard navigation | ACC-01, ACC-02 | Requires human visual/interaction inspection | Tab through entire dashboard; verify visible focus ring, operate all filters by keyboard — covered by 02-07 Task 3 checkpoint step 10 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`npm test -- --run` everywhere)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — 2026-07-15 (targeted revision per plan-checker W2; per-task map filled from plans 02-03..02-07 `<automated>` blocks)
