---
phase: 09-multi-dataset-overlay-filtering
plan: 07
subsystem: ui
tags: [react, typescript, tanstack-query, wcag-contrast, overlay, gap-closure]

# Dependency graph
requires:
  - phase: 09-06
    provides: Dashboard() end-to-end overlay wiring (hooks, ChartDeck markers, OverlayToggle, OverlayEventsList) that 09-VERIFICATION.md found 2 BLOCKER-class gaps in
provides:
  - "Toggle-off correctness: labsEvents/incidentsEvents/proceduresEvents/overlayEvents in App.tsx are useMemo-gated on overlayDatasets.{type}, short-circuiting to [] the instant a toggle flips off regardless of stale TanStack Query cached data (closes Gap 1 / CR-1)"
  - "OverlayEventsList's own merged useMemo independently enforces the same {type}.enabled gate as defense-in-depth, so the component is correct even if a future caller forgets the App.tsx-level gate"
  - "Theme-aware --overlay-chip-text CSS token (mirrors the existing --cat-chip-text pattern) replaces hardcoded white text on the active OverlayToggle button and the OverlayEventsList Type badge, clearing WCAG's 3:1/4.5:1 floors in dark mode (closes Gap 2 / CR-2)"
  - "agent-parity.test.ts DatasetToken/OverlayDataset reachability + backend-token-parity coverage at the same depth as ChartToken/bpCategory (closes WR-3)"
  - "Human-verified sign-off that the chart-marker half of the Gap 1 fix (no automated test path — Recharts renders 0x0 in jsdom) holds on both BP Timeline and Pulse Trend hero charts"
affects: [phase-9-reverification, phase-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-dataset event arrays derived via useMemo, gated on the store's toggle flag rather than trusting TanStack Query's enabled:false to clear .data — enabled:false only stops future fetches, it never clears previously-cached data, so any downstream consumer that reads .data unconditionally will keep rendering stale content past a toggle-off"
    - "Defense-in-depth gating: the same {type}.enabled check is applied at both the composition root (App.tsx) and the reusable leaf component (OverlayEventsList) so the leaf stays correct independent of caller discipline"
    - "Theme-aware ink tokens (--overlay-chip-text, mirroring --cat-chip-text) instead of hardcoded text colors, so light/dark contrast is defined once in index.css and consumed via var() everywhere a colored chip/button needs readable ink"

key-files:
  created: []
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/OverlayEventsList.tsx
    - frontend/src/components/OverlayEventsList.test.tsx
    - frontend/src/components/OverlayToggle.tsx
    - frontend/src/components/OverlayToggle.test.tsx
    - frontend/src/index.css
    - frontend/src/lib/agent-parity.test.ts

key-decisions:
  - "Fixed the gate at both App.tsx (primary) and OverlayEventsList.tsx (defense-in-depth) rather than only the composition root, per 09-VERIFICATION.md's explicit instruction — the reusable component must independently enforce the invariant"
  - "Manual verification (not an automated test) is the sole verification path for the chart-marker half of the fix, since Recharts renders 0x0 in jsdom (09-VALIDATION.md's Manual-Only Verifications table) — the automated regression test in OverlayEventsList.test.tsx covers the table-row half of the identical useMemo fix"
  - "Bundled a low-cost, mechanically-scoped fix for WR-3 (agent-parity.test.ts DatasetToken/OverlayDataset coverage gap) into this gap-closure plan rather than opening a separate plan, since it required no new files and mirrors an existing test pattern exactly"

requirements-completed: [OVERLAY-03, OVERLAY-04, OVERLAY-06]

# Metrics
duration: ~1h35min (Tasks 1-3 committed in a prior session; this session resumed after the blocking human-verify checkpoint, re-confirmed both automated suites green, and recorded the user's approval)
completed: 2026-08-22
---

# Phase 09 Plan 07: Gap-Closure — Stale-Toggle-Off Data & Dark-Mode Contrast Summary

**Gated overlay event arrays on their own toggle flag (not just query error state) to kill stale-cache chart markers/table rows on toggle-off, replaced hardcoded white ink with a theme-aware `--overlay-chip-text` token to fix a 1.58:1-2.07:1 dark-mode WCAG contrast failure, and closed agent-parity.test.ts's DatasetToken coverage gap.**

## Performance

- **Duration:** ~1h35min total across two sessions (Tasks 1-3 committed 2026-08-22 13:23-13:56; this session resumed after the `checkpoint:human-verify` gate, re-confirmed both automated suites green, and recorded the user's "everything passes" approval)
- **Started:** 2026-08-22T13:23:32-07:00 (prior commit 024e1a6, plan creation)
- **Completed:** 2026-08-22 (this summary)
- **Tasks:** 4 completed (3 auto + 1 blocking checkpoint)
- **Files modified:** 7

## Accomplishments
- `App.tsx`'s `labsEvents`/`incidentsEvents`/`proceduresEvents`/`overlayEvents` are now `useMemo`-wrapped and gated on `overlayDatasets.{type}`, short-circuiting to `[]` the instant a toggle flips off — closes the root cause of Gap 1 (TanStack Query's `enabled: false` stops future fetches but never clears previously-cached `.data`, so un-gated derivations kept rendering stale content past toggle-off)
- Renamed `App.tsx`'s shadowed local `const window = ...` to `dateWindow` while touching the same block (closes 09-REVIEW.md IN-1 as a same-touch cleanup)
- `OverlayEventsList.tsx`'s `merged` useMemo independently gates on `labs.enabled`/`incidents.enabled`/`procedures.enabled` alongside the existing `!isError` checks — defense-in-depth so the component stays correct even if a future caller forgets the App.tsx-level gate
- New regression test in `OverlayEventsList.test.tsx` (`describe("stale-cache toggle-off regression (Gap 1 / CR-1)")`) simulates the exact "toggle on, fetch succeeds, toggle off while a second dataset stays on" scenario with a `rerender` that restates a stale (unchanged) events array alongside `enabled: false` — proves the table-row half of the fix and fails if the `.enabled` gate is reverted
- `--overlay-chip-text` token added to `index.css` (`#FFFFFF` in `:root`, `#0B1626` in `.dark`), mirroring the existing `--cat-chip-text` pattern; independently recomputes to ~8.75:1–11.47:1 contrast in dark mode (previously 1.58:1–2.07:1), clearing both the 3:1 UI-component and 4.5:1 normal-text WCAG floors
- `OverlayToggle.tsx`'s active-button style and `OverlayEventsList.tsx`'s Type badge both consume `var(--overlay-chip-text)` instead of hardcoded `text-white` / `color: "white"`
- `agent-parity.test.ts` gained a `DATASETS` const and matching `it.each` reachability coverage (`applyAgentFilters({ overlayDataset, overlayState: "on" })`) plus a backend-`DatasetToken`-vs-frontend-`OverlayDataset` parity test, at the same coverage depth as the existing `ChartToken`/`bpCategory` tests
- `cd frontend && npx tsc --noEmit` — clean, 0 errors (re-verified this session)
- `cd frontend && npx vitest run` — 269/269 tests passed across 24 files (re-verified this session)
- `cd backend && pytest` — 253 passed, 7 skipped, 35 deselected (re-verified this session; backend untouched by this plan, confirms no regression)
- Full manual verification (Task 4, all 7 `<how-to-verify>` steps: Labs+Incidents both ON on BP Timeline, Labs toggled OFF with Incidents staying ON, same check repeated on Pulse Trend, reverse pairing, Procedures substitution) completed and approved by the user ("everything passes") — the toggled-off dataset's chart markers disappear immediately while the still-on dataset's markers remain visible, on both hero charts

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Gap 1 — gate overlay event arrays on toggle state, not just query error state** - `2e83a34` (fix)
2. **Task 2: Fix Gap 2 — theme-aware ink token replaces hardcoded white text in dark mode** - `5b33797` (fix)
3. **Task 3: Close WR-3 — agent-parity.test.ts DatasetToken/OverlayDataset reachability coverage** - `7e0b910` (test)
4. **Task 4: Manual verification — toggled-off dataset's chart markers disappear while a second dataset's markers remain** - no code commit (verification-only task); user responded "everything passes" after all 7 `<how-to-verify>` steps passed

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `frontend/src/App.tsx` - `dateWindow` rename (unshadows global `window`); `labsEvents`/`incidentsEvents`/`proceduresEvents`/`overlayEvents` converted to `useMemo`, each gated on its `overlayDatasets.{type}` flag
- `frontend/src/components/OverlayEventsList.tsx` - `merged` useMemo gains `{type}.enabled` gates (defense-in-depth) alongside existing `!isError` checks; Type badge ink switched to `var(--overlay-chip-text)`
- `frontend/src/components/OverlayEventsList.test.tsx` - new stale-cache toggle-off regression test; updated Type-badge test asserting the new ink token and absence of hardcoded `"white"`
- `frontend/src/components/OverlayToggle.tsx` - active-button `activeClass` drops `text-white`; inline style adds `color: "var(--overlay-chip-text)"`
- `frontend/src/components/OverlayToggle.test.tsx` - new test asserting the active button's style contains the token and its className excludes `text-white`
- `frontend/src/index.css` - `--overlay-chip-text` token pair added to `:root` and `.dark`, mirroring `--cat-chip-text`
- `frontend/src/lib/agent-parity.test.ts` - `DATASETS` const, `it.each(DATASETS)` reachability block, backend `DatasetToken`-vs-frontend-`OverlayDataset` parity test

## Decisions Made
- Gated the fix at both the composition root (App.tsx) and the reusable leaf (OverlayEventsList.tsx) rather than only one, per 09-VERIFICATION.md's explicit instruction that the reusable/testable unit must independently enforce the invariant
- Relied on manual verification (Task 4) as the sole verification path for the chart-marker half of Gap 1, since Recharts renders 0x0 in jsdom — no automated test can exercise ReferenceLine marker presence/absence in this codebase
- Bundled WR-3's low-cost fix (agent-parity.test.ts coverage gap) into this plan rather than a separate plan, since it required no new files and mirrors an existing, already-established test pattern exactly

## Deviations from Plan

None - plan executed exactly as written across all 4 tasks (3 automated fixes + 1 manual-verification checkpoint).

## Known Stubs

None — this is a gap-closure plan correcting existing wiring/tokens; no new data source or stub introduced.

## Issues Encountered

None. The checkpoint (Task 4) required a running dev environment and human interaction with the live dashboard — the user completed all 7 verification steps and responded "everything passes," which is treated as an unambiguous approval of the plan's `<resume-signal>` ("approved").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both BLOCKER-class gaps from 09-VERIFICATION.md (stale-cache toggle-off data; dark-mode contrast failure) are closed and human-verified
- WR-3 (agent-parity.test.ts coverage depth) is closed as a bundled low-cost fix
- Full backend + frontend automated suites are green (269/269 frontend, 253 passed/7 skipped backend)
- Human verification of the chart-marker toggle-off scenario (the one behavior in this fix with no automated test path in this codebase) is explicitly signed off
- Phase 09 (multi-dataset-overlay-filtering) is ready for re-verification against 09-VERIFICATION.md's original 5 must-haves, now that both gaps are closed
- WR-1 (voice/text confirmation banner doesn't mention overlay changes) remains deferred — not a regression, tracked separately per this plan's "Deferred" section

---
*Phase: 09-multi-dataset-overlay-filtering*
*Completed: 2026-08-22*

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: frontend/src/App.tsx
- FOUND: frontend/src/components/OverlayEventsList.tsx
- FOUND: frontend/src/components/OverlayEventsList.test.tsx
- FOUND: frontend/src/components/OverlayToggle.tsx
- FOUND: frontend/src/components/OverlayToggle.test.tsx
- FOUND: frontend/src/index.css
- FOUND: frontend/src/lib/agent-parity.test.ts
- FOUND: 2e83a34 (Task 1 commit)
- FOUND: 5b33797 (Task 2 commit)
- FOUND: 7e0b910 (Task 3 commit)
