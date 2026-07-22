---
phase: 05-upload-auth-gate-deployment
plan: 05
subsystem: ui
tags: [react, zustand, upload, multipart, file-picker, vitest, tdd, accessibility]

# Dependency graph
requires:
  - phase: 05-04
    provides: "auth store (useAuth), client.ts postFile('/upload', file) multipart helper + ApiError, App LoginGate wrapper"
provides:
  - "useView zustand store (dashboard|upload swap, no react-router, D-05)"
  - "Header discreet Upload/Back-to-dashboard toggle + Log out control with focus-trapped confirm dialog (D-06, D-03)"
  - "UploadPage: immediate .xlsx ingest, plain-language IngestSummary sentences, value-free reject disclosure, friendly 400/generic error copy (DASH-10, D-08, D-09, D-10)"
  - "IngestSummary/RejectedRow frontend types mirroring locked backend etl.py shape"
affects: [05-06, 05-07, deployment, upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "zustand view-state routing (no react-router) — ephemeral, no localStorage"
    - "Result rendered as plain-language sentences (not numeric stat-tiles) per D-09"
    - "Controlled disclosure (button + aria-expanded) for value-free reject reasons"
    - "Focus-trapped confirm dialog: Escape/backdrop cancel, focus returns to trigger"

key-files:
  created:
    - frontend/src/store/view.ts
    - frontend/src/components/UploadPage.tsx
    - frontend/src/components/UploadPage.test.tsx
  modified:
    - frontend/src/components/Header.tsx
    - frontend/src/App.tsx
    - frontend/src/api/types.ts

key-decisions:
  - "Reject disclosure implemented as a controlled <button aria-expanded> + conditional list rather than a native <details>, so the aria-expanded contract is deterministic and testable in jsdom (accessibility intent preserved)"
  - "Added IngestSummary/RejectedRow to api/types.ts (not present before) mirroring the locked backend etl.py shape"

patterns-established:
  - "View routing via zustand swap (D-05): useView.go('upload'|'dashboard'), Header persists across both post-auth views"
  - "D-09 five-rule sentence assembly with pluralization (reading/readings, was/were); Updated sentence only when updated>0; through-date only when total>0"

requirements-completed: [DASH-10, API-03, SEC-01]

# Metrics
duration: 12min
completed: 2026-07-22
---

# Phase 5 Plan 05: Caregiver Upload Surface & Access Controls Summary

**Caregiver upload page that ingests an OMRON .xlsx immediately and reports a plain-language IngestSummary, reached via a discreet zustand view-swap Header control, with a focus-trapped logout confirm dialog.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-22T14:12:00Z
- **Completed:** 2026-07-22T14:20:00Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `store/view.ts`: tiny ephemeral zustand `useView` store swapping `"dashboard" | "upload"` with no react-router and no localStorage (D-05).
- `Header.tsx`: discreet, never-accent-filled "Upload"/"Back to dashboard" toggle and "Log out" control; logout opens a focus-trapped confirm dialog (Escape + backdrop cancel, focus returns to the Log out control, confirm calls `useAuth.logout()`) justified by the no-expiry token (D-03, D-06).
- `UploadPage.tsx`: styled "Choose a file" label wrapping a visually-hidden native `.xlsx` input (D-07); selecting a file calls `postFile('/upload', file)` immediately (D-08); success renders the locked `IngestSummary` as plain-language sentences with pluralization (D-09) plus an optional value-free reject disclosure (D-10); a 400 maps to the non-OMRON notice and any other failure to the generic notice — never a status code or traceback (T-05-13).
- `App.tsx`: post-auth zustand view swap renders `<UploadView>` (Header + UploadPage) when `view === "upload"`, else the existing Dashboard.

## Task Commits

1. **Task 1: view store + Header Upload/Log-out controls + logout confirm dialog** - `7e018d6` (feat)
2. **Task 2 (TDD RED): failing UploadPage tests + IngestSummary type** - `7c558b6` (test)
3. **Task 2 (TDD GREEN): UploadPage immediate ingest + summary + App view-switch** - `7b60447` (feat)

_TDD gate sequence satisfied: test(RED) → feat(GREEN). No refactor commit needed (implementation clean on first pass)._

## Files Created/Modified
- `frontend/src/store/view.ts` - useView zustand store, dashboard|upload swap (D-05)
- `frontend/src/components/UploadPage.tsx` - file picker → immediate ingest → plain-language summary + reject disclosure + friendly errors
- `frontend/src/components/UploadPage.test.tsx` - behavior tests (summary sentences, pluralization, reject disclosure, 400/generic error copy, loading line)
- `frontend/src/components/Header.tsx` - added Upload/Back toggle, Log out control, logout confirm dialog
- `frontend/src/App.tsx` - view swap renders UploadPage when view === "upload"
- `frontend/src/api/types.ts` - added IngestSummary/RejectedRow (mirror of locked backend etl.py shape)

## Decisions Made
- Reject disclosure uses a controlled `<button aria-expanded>` + conditional list instead of a native `<details>`/`<summary>`. The plan's `<action>` suggested `<details>`, but native `<summary>` does not expose a reliable button role / `aria-expanded` in jsdom, and the plan's own behavior contract ("`aria-expanded` wired") and acceptance test drive the button form. The accessibility intent (keyboard-operable, expandable, `aria-expanded` reflecting state) is fully preserved.
- Added `IngestSummary`/`RejectedRow` to `api/types.ts` — they were not yet exported for the frontend; mirrored verbatim from the locked backend `etl.py` shape (`added/updated/unchanged/rejected/total/latest`, `row_index/reason`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused `useRef` import in UploadPage.tsx**
- **Found during:** Task 2 (GREEN)
- **Issue:** `tsc -b` and `oxlint` flagged an unused `useRef` import left from an earlier draft.
- **Fix:** Dropped `useRef` from the react import (only `useState` is used).
- **Files modified:** frontend/src/components/UploadPage.tsx
- **Verification:** `npx tsc -b` clean, `npx oxlint` exit 0.
- **Committed in:** `7b60447` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking). Plus 1 documented design choice (controlled disclosure vs. native `<details>`).
**Impact on plan:** No scope creep. The disclosure form is an equivalent, more testable implementation of the specified behavior.

## Issues Encountered
- Worktree lacked `frontend/node_modules`; symlinked it to the main checkout's gitignored `frontend/node_modules` (not committed) so vitest/tsc/oxlint run. Resolved per prior-wave guidance.

## Known Stubs
None — the upload flow is fully wired end-to-end (`postFile` from Plan 04, live `IngestSummary` rendering). No placeholder data.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The caregiver upload surface and access controls are complete and behind the auth gate; ready for the deployment plan (05-06/05-07) and the manual live-upload verification checklist.
- Full frontend suite green (171 tests), `tsc -b` clean, `oxlint` clean.

---
*Phase: 05-upload-auth-gate-deployment*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created files exist on disk; all task commits (7e018d6, 7c558b6, 7b60447) present in git history.
