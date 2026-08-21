# Phase 8: Manual-Entry Forms - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 8-Manual-Entry Forms
**Areas discussed:** Page structure, Post-submit behavior, Validation UX, Date/time input

---

## Page structure

| Option | Description | Selected |
|--------|-------------|----------|
| One "Add Record" view, type switcher inside | New Header nav item opens a single page with a 3-way segmented control (Lab / Incident / Procedure) at top, swapping the field set below. One nav destination, one mental model. | ✓ |
| Three separate nav destinations | Three distinct Header entries or a sub-menu, each a dedicated full-page form. More nav clutter but zero ambiguity about which form is active. | |
| Inline on the dashboard | A collapsible "Add a record" panel embedded directly in the main dashboard view — no navigation away at all. | |

**User's choice:** One "Add Record" view, type switcher inside (recommended option).
**Notes:** Mirrors the existing `useView` dashboard/upload pattern.

---

## Post-submit behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Clear form, stay, show inline confirmation | Mirrors UploadPage's confirmation-sentence style ("Added 1 incident."); form resets and stays ready for the next entry — caregivers often log multiple things in one sitting. | ✓ |
| Redirect to dashboard after submit | Shows a brief success toast/banner, then automatically returns to the main dashboard view — treats each entry as a one-off task. | |
| Stay on form, keep values, just confirm | Form fields stay populated with what was just submitted (not cleared), alongside the confirmation. | |

**User's choice:** Clear form, stay, show inline confirmation (recommended option).
**Notes:** None.

---

## Validation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Disable submit until valid | Mirrors DateRangePicker's aria-disabled pattern — Submit button is visibly disabled (dashed border) until all required fields pass; no error state ever shown for a field not yet touched. | ✓ |
| Inline errors on blur/submit | Submit is always clickable; leaving a required field empty (or submitting) shows a role=alert inline message under that field. | |

**User's choice:** Disable submit until valid (recommended option).
**Notes:** None.

---

## Date/time input

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse DateRangePicker's pattern + add a time field for Incident | Lab/Procedure dates use the exact typed-YYYY-MM-DD + calendar pattern already proven in DateRangePicker. Incident gets that same date control plus a separate native time input alongside it. | ✓ |
| Simple native inputs everywhere | Plain `<input type="date">` for Lab/Procedure, `<input type="datetime-local">` for Incident — less custom code, but native datetime-local has known inconsistent styling/behavior across Chrome vs Safari. | |

**User's choice:** Reuse DateRangePicker's pattern + add a time field for Incident (recommended option).
**Notes:** None.

---

## Claude's Discretion

- Exact spacing/visual chrome of the segmented type-switcher beyond FilterBar's locked color/border contract.
- Whether switching record type mid-fill silently discards partially-entered values or asks for confirmation first (default: silent discard).
- Exact component/file naming and whether the three field-sets are one component with conditional rendering or three subcomponents.
- Exact request-body construction / hook shape wrapping the three `postJson` calls.
- Whether any client-side max-length is added to free-text fields.

## Deferred Ideas

- A records list/browse view (seeing what's already been entered) — belongs to Phase 9's overlay, not this phase.
- Client-side max-length caps on free-text fields — left to Claude's discretion, not locked either way.
- Warning-before-discard when switching record type mid-fill — left to Claude's discretion (default: silent discard).
