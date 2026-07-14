---
phase: 2
slug: read-api-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | API-01, API-02, DASH-01..09, DASH-11, ACC-01, ACC-02 | — | — | unit/integration | see infrastructure above | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend deps install: `fastapi[standard]`, `uvicorn[standard]`, `httpx` into `backend/.venv`
- [ ] `backend/tests/test_readings_api.py` — stubs for API-01 (filters, ordering)
- [ ] `backend/tests/test_stats_api.py` — stubs for API-02 (summary stats, zero-filled categories)
- [ ] Frontend scaffold: Vite react-ts template + Vitest + @testing-library/react wiring

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart visual rendering (bands z-order, axis ranges, line-end labels) | DASH-01..04 | Visual output; Recharts renders SVG that unit tests can't judge for correctness | Load dashboard with seeded dev.db; confirm all four charts render full data range (systolic 60–211) without clipping |
| ≥48px targets, ≥18px text, focus visibility, keyboard navigation | ACC-01, ACC-02 | Requires human visual/interaction inspection | Tab through entire dashboard; verify visible focus ring, operate all filters by keyboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
