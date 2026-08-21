---
phase: 9
slug: multi-dataset-overlay-filtering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x (backend) / Vitest 4.x + @testing-library/react 16.3.2 (frontend) |
| **Config file** | `backend/pyproject.toml` (pytest) / `frontend/vite.config.ts` `test` block (no separate vitest.config.ts) |
| **Quick run command** | `cd backend && pytest tests/test_agent_schemas.py tests/test_agent_service.py -x` / `cd frontend && npx vitest run src/store/filters.test.ts src/lib/agent-parity.test.ts` |
| **Full suite command** | `cd backend && pytest` / `cd frontend && npm test -- --run` |
| **Estimated runtime** | ~30 seconds combined |

---

## Sampling Rate

- **After every task commit:** Run the scoped unit test file(s) touched by that task
- **After every plan wave:** Run `cd backend && pytest` + `cd frontend && npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-XX-XX | TBD | TBD | OVERLAY-03 | V5 | `ToggleDataset` parses/round-trips through `AgentOutput`, case-drift normalizes | unit | `pytest backend/tests/test_agent_schemas.py -x` | ✅ (extend existing file) | ⬜ pending |
| 09-XX-XX | TBD | TBD | OVERLAY-03 | — | `setOverlayDataset` mutates `overlayDatasets`; reachable via `applyAgentFilters` | unit | `npx vitest run src/store/filters.test.ts src/lib/agent-parity.test.ts` | ✅ (extend existing files — Pitfall 4) | ⬜ pending |
| 09-XX-XX | TBD | TBD | OVERLAY-03 | — | `interpret()` maps `ToggleDataset` → `AppliedFilters(overlayDataset, overlayState)` | unit | `pytest backend/tests/test_agent_service.py -x` | ✅ (extend existing file) | ⬜ pending |
| 09-XX-XX | TBD | TBD | OVERLAY-04 | — | `useLabs`/`useIncidents`/`useProcedures` fetch only when `enabled`, key on date window only | unit | `pytest backend/tests/test_api_labs.py backend/tests/test_api_incidents.py backend/tests/test_api_procedures.py -x` (regression only) | ✅ existing, no new backend test needed | ⬜ pending |
| 09-XX-XX | TBD | TBD | OVERLAY-04 | — | Overlay markers render with distinct shape+color per type (no color-only) | manual/visual | N/A — Recharts renders 0×0 in jsdom (documented project constraint) | ❌ Wave 0 note: manual-verify only | ⬜ pending |
| 09-XX-XX | TBD | TBD | OVERLAY-05 | — | Overlay toggle row shows dimmed/annotated-but-interactive state on BP Categories/AM-PM | component test | `npx vitest run src/components/OverlayToggle.test.tsx` (new) | ❌ Wave 0 gap | ⬜ pending |
| 09-XX-XX | TBD | TBD | OVERLAY-06 | — | Accessible events table renders every overlaid event across all ON datasets | component test | `npx vitest run src/components/OverlayEventsList.test.tsx` (new) | ❌ Wave 0 gap | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs, plan IDs, and wave numbers finalized by the planner; requirement→test mapping above sourced from RESEARCH.md.*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/OverlayToggle.test.tsx` (or wherever the toggle row lands) — covers OVERLAY-03 (click reachability) + OVERLAY-05 (doesn't-apply-here state)
- [ ] `frontend/src/components/OverlayEventsList.test.tsx` — covers OVERLAY-06
- [ ] `frontend/src/lib/agent-parity.test.ts` extension — covers the structural gate that fails the build if `setOverlayDataset` isn't added to `STORE_ACTIONS`/`CASES`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| `ReferenceLine` marker shape/color/position correctness on BP Timeline & Pulse Trend | OVERLAY-03, OVERLAY-04 | Recharts renders 0×0 in jsdom — pre-existing, documented project constraint (`lib/chartData.ts` docstring); no automated visual-rendering path exists anywhere in this codebase | Load the dashboard, toggle each of labs/incidents/procedures on, confirm markers appear on the hero chart (BP Timeline and Pulse Trend) at the correct date with distinguishable shape+color per type, and confirm nothing renders on `ChartDeck` mini previews |
| Voice command routing for `toggle_dataset` against the live Claude model | OVERLAY-03 | Anthropic account has $0 credits this session (pre-existing project blocker) — cannot exercise the live model | Once credits are available, speak "add incidents" / "hide labs" / "show procedures" and confirm the correct dataset toggles ON/OFF; covered by mocked-client unit tests in the interim |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
