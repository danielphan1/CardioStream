---
phase: 08-manual-entry-forms
reviewed: 2026-08-21T09:55:12Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - frontend/src/App.tsx
  - frontend/src/api/client.ts
  - frontend/src/api/types.ts
  - frontend/src/components/AddRecordPage.test.tsx
  - frontend/src/components/AddRecordPage.tsx
  - frontend/src/components/DateRangePicker.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/records/IncidentFields.test.tsx
  - frontend/src/components/records/IncidentFields.tsx
  - frontend/src/components/records/LabFields.test.tsx
  - frontend/src/components/records/LabFields.tsx
  - frontend/src/components/records/ProcedureFields.test.tsx
  - frontend/src/components/records/ProcedureFields.tsx
  - frontend/src/components/records/SingleDateField.tsx
  - frontend/src/hooks/useCreateRecord.ts
  - frontend/src/lib/dates.test.ts
  - frontend/src/lib/dates.ts
  - frontend/src/store/view.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-21T09:55:12Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 8 adds the caregiver "Add Record" surface: three field-set components
(Lab/Incident/Procedure), an `AddRecordPage` container that gates a shared
Submit button on a reported draft body, `useCreateRecord` mutation wrappers,
new wire types, and a Header/view-store change to a three-state nav
(dashboard/upload/records). The field-set components themselves are well
structured — required-field gating, naive-local datetime construction, and
optional-field omission all match their locked contracts and are covered by
targeted unit tests.

The container (`AddRecordPage.tsx`), however, has a real async race: none of
the three `useMutation` calls are guarded against the user switching record
type (or double-clicking Submit) while a request is in flight. A stale
mutation callback resolving after the user has already moved to a different
record type will silently wipe out whatever the user has since typed into
the new field-set and show a confirmation/error banner for the wrong record
type — a genuine data-loss bug (CR-01). There is also no guard against
duplicate submissions from a double-click/double-tap, which is a particularly
relevant risk given the primary user population's limited hand mobility
(WR-01). Separately, `LabFields` mishandles whitespace-only input in its
three optional numeric fields, silently coercing it to `0` instead of
treating it as empty (WR-02).

## Critical Issues

### CR-01: Switching record type (or a slow response) during a pending submit clobbers the newly-mounted field-set's data and shows a stale confirmation

**File:** `frontend/src/components/AddRecordPage.tsx:73-113`
**Issue:**
`handleTypeChange` (lines 73-77) can run at any time — there is no check on
`createLab.isPending`, `createIncident.isPending`, or
`createProcedure.isPending` before allowing a type switch (the three type
buttons at lines 130-140 are never disabled). Meanwhile, `handleSubmit`'s
`onSuccess`/`onError` callbacks (lines 86-112) unconditionally call
`setSubmitState`, `setDraftBody(null)`, and `setResetSeq((n) => n + 1)` on
the shared `AddRecordPage` state once the mutation resolves — regardless of
whether `recordType` has changed since the mutation was fired.

Concrete sequence:
1. User fills in the Lab form and clicks "Add Lab Result". `createLab.mutate(...)` fires.
2. Before the response returns, the user clicks "Incident" (`handleTypeChange`
   is not blocked by the pending mutation). A fresh, empty `IncidentFields`
   mounts (`key={fieldsKey}` changes because `recordType` changed).
3. The user starts typing incident details.
4. The Lab POST resolves. Its stale `onSuccess` handler fires:
   `setSubmitState({ status: "success", noun: "lab result" })` — a
   confirmation banner for a record the user is no longer looking at — and
   `setResetSeq((n) => n + 1)`, which changes `fieldsKey` for the
   *currently-mounted* `IncidentFields` and forces React to unmount/remount
   it, discarding everything the user has typed since step 3, with no
   warning.

The same clobbering happens even without a type switch: `setDraftBody(null)`
in the callback stomps on `draftBody` that may already have been
re-populated by the newly-mounted field-set's own `useEffect` by the time the
stale response arrives.

This is a silent data-loss bug in a form used by caregivers to log a
disabled user's health incidents/labs/procedures — exactly the kind of
input that is costly to lose and re-enter.

**Fix:** Guard the async callbacks against staleness (e.g., snapshot
`recordType` at submit time and bail if it no longer matches when the
callback fires), and/or disable the type-switch buttons and Submit button
while any mutation is pending:

```tsx
const isSubmitting =
  createLab.isPending || createIncident.isPending || createProcedure.isPending;

function handleTypeChange(next: RecordType) {
  if (isSubmitting) return; // don't allow switching mid-flight
  setRecordType(next);
  setDraftBody(null);
  setSubmitState({ status: "idle" });
}

function handleSubmit() {
  if (draftBody === null || isSubmitting) return;
  const noun = NOUN[recordType];
  const submittedType = recordType; // snapshot for staleness check
  createLab.mutate(draftBody as LabResultCreate, {
    onSuccess: () => {
      if (submittedType !== recordType) return; // user has moved on — don't clobber
      setSubmitState({ status: "success", noun });
      setDraftBody(null);
      setResetSeq((n) => n + 1);
    },
    onError: () => {
      if (submittedType !== recordType) return;
      setSubmitState({ status: "error", noun });
    },
  });
}
```

## Warnings

### WR-01: No guard against duplicate submission while a mutation is pending

**File:** `frontend/src/components/AddRecordPage.tsx:79-116`
**Issue:** `canSubmit` (line 115) is only `draftBody !== null` — it does not
factor in `createLab.isPending`/`createIncident.isPending`/
`createProcedure.isPending`. The Submit button (lines 153-164) stays fully
clickable while a request is in flight, so a double-click/double-tap fires
two POSTs for the same record. Given the target user's limited hand mobility
and the fact that caregivers may be operating this form under time pressure,
a duplicate-tap is a realistic scenario, and the result is a duplicate health
record silently created in the database with no dedup on the backend
contract shown here.
**Fix:**
```tsx
const isSubmitting = createLab.isPending || createIncident.isPending || createProcedure.isPending;
const canSubmit = draftBody !== null && !isSubmitting;
```
and reflect the pending state visually (e.g., `aria-busy={isSubmitting}` and a
"Saving…" label) so the caregiver gets feedback instead of being able to spam
the button.

### WR-02: Whitespace-only text in Lab's optional numeric fields silently becomes `0`

**File:** `frontend/src/components/records/LabFields.tsx:27-29,54-64`
**Issue:** `numericFieldValid` (lines 27-29) only special-cases the exact
empty string `""`; any other string, including one that is whitespace-only
(e.g., `" "` or `"  "`), falls through to `Number.isFinite(Number(text))`.
`Number("   ")` evaluates to `0`, which is finite, so a whitespace-only
`Result`/`Normal range — low`/`Normal range — high` value is treated as
**valid** input. The same lack-of-trim shows up in the body-construction
ternaries (lines 57, 59, 60): `resultText !== ""` is true for `"   "`, so
`{ result: Number("   ") }` → `{ result: 0 }` is silently included in the
POST body. A caregiver who accidentally leaves a stray space in a numeric
field (e.g., after clearing a value with backspace-then-space, or via
autocomplete/voice-dictation artifacts) gets a fabricated `result: 0` (or
`range_low`/`range_high: 0`) written to a medical record with no error shown
anywhere — this is a real health-data-correctness bug, not a cosmetic one.
**Fix:** Trim before both the validity check and the body construction:
```tsx
function numericFieldValid(text: string): boolean {
  const t = text.trim();
  return t === "" || Number.isFinite(Number(t));
}
// ...
...(resultText.trim() !== "" ? { result: Number(resultText.trim()) } : {}),
...(rangeLowText.trim() !== "" ? { range_low: Number(rangeLowText.trim()) } : {}),
...(rangeHighText.trim() !== "" ? { range_high: Number(rangeHighText.trim()) } : {}),
```

### WR-03: `useEffect` in all three field-sets omits `onDraftChange` from its dependency array

**File:** `frontend/src/components/records/LabFields.tsx:49-64`, `frontend/src/components/records/IncidentFields.tsx:42-62`, `frontend/src/components/records/ProcedureFields.tsx:33-46`
**Issue:** Each field-set's draft-reporting `useEffect` calls `onDraftChange`
inside the effect body but lists only the local field values in the
dependency array, never `onDraftChange` itself. This currently "works"
because `AddRecordPage` passes the raw `setDraftBody` state setter (which
React guarantees is referentially stable), but it is a latent bug: the
effect closes over whatever `onDraftChange` was on the render that scheduled
it, and if any future caller passes a non-memoized inline callback (e.g.
`onDraftChange={(b) => doSomething(b)}`), the effect will silently use a
stale closure on re-renders where only `onDraftChange` changed identity, and
`react-hooks/exhaustive-deps` lint will flag it.
**Fix:** Add `onDraftChange` to each dependency array:
```tsx
}, [dateText, testName, resultText, unit, rangeLowText, rangeHighText, notes, onDraftChange]);
```

## Info

### IN-01: Type assertions bypass compiler safety when dispatching mutations by record type

**File:** `frontend/src/components/AddRecordPage.tsx:86,95,104`
**Issue:** `createLab.mutate(draftBody as LabResultCreate, ...)` (and the
`IncidentCreate`/`ProcedureCreate` equivalents) assert the shape of
`draftBody` rather than narrowing it. The invariant that `draftBody` always
matches `recordType` is currently maintained only by convention (the
`key={fieldsKey}` remount-on-switch pattern plus each field-set's own
internal gating), with nothing in the type system enforcing it. A future
edit that breaks that invariant (e.g., removing the `key` prop, or reusing a
field-set instance across types) would compile cleanly and fail at runtime
or send the wrong shape to the backend.
**Fix:** Model `DraftBody` as a discriminated union tagged by `recordType`
(e.g., `{ type: "lab"; body: LabResultCreate } | ...`) so the compiler can
narrow it in each branch instead of relying on `as`.

### IN-02: "Back to dashboard" button reuses the Upload icon when returning from the Add Record view

**File:** `frontend/src/components/Header.tsx:196-204`
**Issue:** The single "Back to dashboard" button (shown whenever
`view !== "dashboard"`) always renders the `Upload` icon, even when the
current view is `"records"` (Add Record), not `"upload"`. The icon is
`aria-hidden="true"` so screen-reader users are unaffected (the text label
is correct), but sighted users navigating away from the Add Record page see
an upload-cloud icon next to "Back to dashboard," which reads as a leftover
from the two-state (`dashboard`/`upload`) version of this control that
wasn't fully updated for the Phase 8 three-state nav.
**Fix:** Pick an icon independent of the specific non-dashboard view (e.g. a
generic `ArrowLeft`/`Home` icon), or branch on `view` to choose `Upload` vs
`ClipboardPlus` to match the page being left.

### IN-03: Success/error banner from a previous submission is not cleared when a new submit starts

**File:** `frontend/src/components/AddRecordPage.tsx:79-113`
**Issue:** `submitState` is only reset to `{ status: "idle" }` on
`handleTypeChange`. If a submission errors and the caregiver edits the same
field-set and clicks Submit again (without switching type), the stale error
banner (`role="alert"`) remains on screen for the entire duration of the
retry, then is either replaced by a fresh error or a success message once
the new mutation settles. Momentarily leaving a stale error/alert visible
while a new attempt is in flight is a minor, avoidable UX/accessibility
rough edge (a screen-reader user re-focusing the alert mid-retry hears the
old message).
**Fix:** Clear `submitState` to `{ status: "idle" }` at the start of
`handleSubmit`, before calling `.mutate(...)`.

---

_Reviewed: 2026-08-21T09:55:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
