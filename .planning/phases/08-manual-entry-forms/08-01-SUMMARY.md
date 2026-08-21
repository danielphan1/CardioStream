---
phase: 08-manual-entry-forms
plan: 01
subsystem: api
tags: [typescript, react-query, react-day-picker, fastapi-contract, vitest]

# Dependency graph
requires:
  - phase: 07-records-backend
    provides: LabResult/Incident/Procedure Pydantic schemas and Bearer-gated POST /labs, /incidents, /procedures routes
provides:
  - Byte-matching TS mirrors of backend/app/schemas.py's Lab/Incident/Procedure create/read shapes
  - postLab/postIncident/postProcedure typed POST wrappers reusing the existing postJson path
  - Single-source isValidDateText (promoted out of DateRangePicker) and new combineLocalDateTime helper
  - Standalone SingleDateField component (single-date extraction of DateRangePicker)
  - useCreateLab/useCreateIncident/useCreateProcedure mutation hooks
affects: [08-02-field-sets, 08-03-add-record-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "postJson<TBody,TRes> generic reused verbatim for every new resource POST wrapper — no per-resource HTTP logic"
    - "Single-date form control extracted from the range picker as its own component rather than wrapped"
    - "One promoted date-validity function shared by every date input in the app"

key-files:
  created:
    - frontend/src/components/records/SingleDateField.tsx
    - frontend/src/hooks/useCreateRecord.ts
  modified:
    - frontend/src/api/types.ts
    - frontend/src/api/client.ts
    - frontend/src/lib/dates.ts
    - frontend/src/lib/dates.test.ts
    - frontend/src/components/DateRangePicker.tsx

key-decisions:
  - "isValidDateText has exactly one implementation (lib/dates.ts); DateRangePicker.tsx imports it instead of defining its own copy"
  - "combineLocalDateTime always appends ':00' seconds and never calls .toISOString(), preserving the DATA-05 naive-local contract"
  - "SingleDateField.tsx is a standalone extraction (not a wrapper around DateRangePicker) per D-07/RESEARCH Pitfall 2"

patterns-established:
  - "New create/read resource pairs mirror backend/app/schemas.py field-for-field, appended to api/types.ts under the file's established 'byte-identical mirror' convention"
  - "New resource POST wrappers are one-line calls into postJson, matching postAgent/postAuth exactly"
  - "New useMutation hooks mirror useAgent.ts's one-line-per-hook shape"

requirements-completed: [OVERLAY-02]

# Metrics
duration: ~15min
completed: 2026-08-21
---

# Phase 8 Plan 1: API Contracts & Date Foundation Summary

**Byte-accurate TS mirrors of Phase 7's Lab/Incident/Procedure Pydantic schemas, typed postJson POST wrappers, a promoted single-source isValidDateText plus new combineLocalDateTime helper, a standalone SingleDateField component, and three useCreateRecord mutation hooks.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-21
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created, 3 modified... plus DateRangePicker.tsx = 5 modified + 2 created = 7 total files touched)

## Accomplishments
- `api/types.ts` gained `LabResult`/`LabResultCreate`, `Incident`/`IncidentCreate`, `Procedure`/`ProcedureCreate` — field names and required/optional split verified against `backend/app/schemas.py` line-for-line, including the `datetime` (not `datetime_`) JSON key on `Incident`/`IncidentCreate`.
- `api/client.ts` gained `postLab`, `postIncident`, `postProcedure` — each a one-line call into the existing `postJson` generic, with zero new HTTP machinery, zero new error handling, and the same Bearer-attach/401→logout path every other write already uses.
- `isValidDateText` moved from a private function inside `DateRangePicker.tsx` into a named export in `lib/dates.ts`; `DateRangePicker.tsx` now imports it (one implementation, not two). `combineLocalDateTime(dateText, timeText)` was added alongside it, producing the codebase's naive-local seconds-included format (`"2025-04-01T08:00:00"`) and never calling `.toISOString()`.
- `SingleDateField.tsx` was created as a standalone single-date input (typed `YYYY-MM-DD` text + oversized `DayPicker mode="single"` calendar), extracted from `DateRangePicker`'s single-date half — it does not import or wrap `DateRangePicker`.
- `useCreateRecord.ts` was created with `useCreateLab`, `useCreateIncident`, `useCreateProcedure`, each a one-line `useMutation({ mutationFn: ... })` mirroring `useAgent.ts` exactly.

## Task Commits

Each task was committed atomically:

1. **Task 1: API contracts — Lab/Incident/Procedure TS types and postJson wrappers** - `819bb60` (feat)
2. **Task 2: Promote isValidDateText, add combineLocalDateTime, extend dates.test.ts** - `777420c` (refactor)
3. **Task 3: SingleDateField component and useCreateRecord mutation hooks** - `754a3b8` (feat)

_Plan metadata commit (SUMMARY.md) follows this summary._

## Files Created/Modified
- `frontend/src/api/types.ts` - Added six new exported types mirroring backend/app/schemas.py's Lab/Incident/Procedure create/read shapes
- `frontend/src/api/client.ts` - Added postLab/postIncident/postProcedure wrappers, imported the six new types
- `frontend/src/lib/dates.ts` - Promoted isValidDateText (named export), added combineLocalDateTime
- `frontend/src/lib/dates.test.ts` - Added isValidDateText and combineLocalDateTime describe blocks (4 + 1 new cases)
- `frontend/src/components/DateRangePicker.tsx` - Removed local DATE_RE/isValidDateText definition, imports isValidDateText from lib/dates instead
- `frontend/src/components/records/SingleDateField.tsx` (new) - Standalone single-date field component for Lab/Procedure/Incident forms
- `frontend/src/hooks/useCreateRecord.ts` (new) - useCreateLab/useCreateIncident/useCreateProcedure mutation hooks

## Decisions Made
- Did NOT mark `OVERLAY-02` complete in `.planning/REQUIREMENTS.md` despite it appearing in this plan's frontmatter `requirements:` field. Per REQUIREMENTS.md's own text, `OVERLAY-02` is "Accessible manual-entry forms for labs, incidents, and procedures ... the tables are otherwise unreachable" — a Phase-8-wide requirement satisfied only once a caregiver can actually submit a form (Plans 08-02/08-03). This plan is explicitly non-visual foundation work ("touches zero UI a caregiver will see" per its own objective). Marking the requirement complete here would be inaccurate; leaving it `[ ] Pending` for whichever later plan in this phase actually ships the forms to flip.
- Otherwise followed the plan's exact field mappings, wrapper shapes, and extraction approach — no other deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed frontend dependencies (`npm install`)**
- **Found during:** Task 1 verification
- **Issue:** The worktree's `frontend/node_modules` did not exist, so `npx tsc -b` failed with "This is not the tsc command you are looking for" (npx couldn't resolve the locally-pinned `typescript` binary).
- **Fix:** Ran `npm install` in `frontend/` — a standard install of the existing, unmodified `package.json`/`package-lock.json`, not a new/unpinned package. Installed 185 packages matching the lockfile already committed to the repo.
- **Files modified:** None tracked (node_modules is gitignored; package-lock.json was not modified since it already matched).
- **Verification:** `npx tsc -b` and `npx vitest run` both ran successfully afterward.
- **Committed in:** N/A (no tracked file changes from the install itself)

---

**Total deviations:** 1 auto-fixed (1 blocking — routine dependency install, not a new package)
**Impact on plan:** No scope creep. This was a one-time environment-setup step required to run the plan's own verification commands.

## Issues Encountered
None beyond the dependency-install deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-02 (field-sets) and Plan 08-03 (page container + nav) can now import a fixed, already-typed contract: `LabResult(Create)`/`Incident(Create)`/`Procedure(Create)` types, `postLab`/`postIncident`/`postProcedure`, `isValidDateText`/`combineLocalDateTime`, `SingleDateField`, and `useCreateLab`/`useCreateIncident`/`useCreateProcedure` — no later plan should need to touch `api/types.ts`, `api/client.ts`, or `lib/dates.ts` again per this plan's stated purpose.
- Full verification passes: `cd frontend && npx tsc -b` exits 0; `cd frontend && npx vitest run` passes 200/200 (17 test files) with zero regressions from the `DateRangePicker.tsx` import-source change.
- No blockers.

---
*Phase: 08-manual-entry-forms*
*Completed: 2026-08-21*

## Self-Check: PASSED

All created/modified files verified present on disk; all four commits (819bb60, 777420c, 754a3b8, 0a9ed9f) verified present in `git log --oneline`. No missing items.
