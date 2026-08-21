---
phase: 8
slug: manual-entry-forms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`frontend/package.json`) + `@testing-library/react` 16.3.2 |
| **Config file** | `frontend/vite.config.ts` (Vitest config colocated with Vite — no separate `vitest.config.ts`) |
| **Quick run command** | `cd frontend && npx vitest run src/components/AddRecordPage.test.tsx` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~10-20 seconds (existing suite is small, single-user app) |

Backend test suite (`cd backend && python -m pytest`) is unaffected — this phase makes no backend
changes; Phase 7's `test_api_labs.py` / `test_api_incidents.py` / `test_api_procedures.py` already
cover the contract this phase's forms consume and need no changes. Run once at phase gate as a
regression check only.

---

## Sampling Rate

- **After every task commit:** `cd frontend && npx vitest run src/components/AddRecordPage.test.tsx` (plus `src/lib/dates.test.ts` if `isValidDateText`/`combineLocalDateTime` were touched that task)
- **After every plan wave:** `cd frontend && npx vitest run` (full frontend suite)
- **Before `/gsd-verify-work`:** Full frontend suite green; backend suite (`cd backend && python -m pytest`) green as a regression check even though this phase doesn't touch backend code
- **Max feedback latency:** ~20 seconds

---

## Per-Requirement Verification Map

*(Task IDs are assigned by the planner in Step 8 and are not yet known at validation-strategy time — each plan's task list MUST reference these rows by Requirement ID so Wave 0 coverage stays traceable. The planner should copy this table into the phase's plans with Task ID/Plan/Wave columns filled in.)*

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|--------------------|-------------|--------|
| OVERLAY-02 | Caregiver submits a Lab via the form; ≥48px targets, no drag/precision input; confirmation appears; form clears | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "Lab"` | ❌ W0 | ⬜ pending |
| OVERLAY-02 | Caregiver submits an Incident via the form (date + native time input combine correctly into naive-local ISO) | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "Incident"` | ❌ W0 | ⬜ pending |
| OVERLAY-02 | Caregiver submits a Procedure via the form | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "Procedure"` | ❌ W0 | ⬜ pending |
| OVERLAY-02 | Submit stays disabled (`aria-disabled`) until required fields are valid, mirroring `DateRangePicker`'s `canApply` contract | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "disabled"` | ❌ W0 | ⬜ pending |
| OVERLAY-02 | Record shows up "immediately, without a page reload" — the POST response drives the confirmation directly, no forced refetch | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "immediately"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/AddRecordPage.test.tsx` — new file. Mock only `postLab` / `postIncident` / `postProcedure` at the `api/client` module boundary (mirrors `CommandBar.test.tsx`'s "the ONLY mock" convention — real `useMutation`, real `QueryClientProvider`, real `ApiError` class so the error-branch tests exercise the true type). Cover: type-switch discard, disabled-until-valid per type, successful submit → confirmation + form clear (via the `key` remount), and the generic-error branch on a rejected mutation.
- [ ] `frontend/src/lib/dates.test.ts` — extend (existing file) with cases for the newly-exported `isValidDateText` (if promoted per RESEARCH.md Pattern 2) and any new `combineLocalDateTime` helper (date + time → naive-local ISO string, seconds always `:00`).
- [ ] No framework install needed — Vitest + Testing Library are already fully configured and exercising this exact component/hook shape (`CommandBar.test.tsx`, `UploadPage.test.tsx`).

---

## Manual-Only Verifications

*All phase behaviors have automated verification per the map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌) references above
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter once the planner's task list satisfies all rows above

**Approval:** pending
