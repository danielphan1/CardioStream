# Phase 8: Manual-Entry Forms - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Caregivers can populate the labs, incidents, and procedures tables (Bearer-gated API shipped in Phase 7) through accessible, ≥48px-target forms — the tables are otherwise unreachable. A submitted record shows up in the app's data immediately, without a page reload.

In scope: one new "Add Record" page reachable from the Header nav, with a 3-way type switcher (Lab / Incident / Procedure) that swaps the field set below; POST to the corresponding Phase 7 endpoint (`/labs`, `/incidents`, `/procedures`); inline post-submit confirmation; the date/datetime input controls each form needs.

Out of scope (explicitly deferred, confirmed carried forward from Phase 7): edit/delete on any of these three resources (REQUIREMENTS.md Out-of-Scope: "a future consideration, not required for launch"); resource-specific GET filters or a records list/browse view (not this phase's job — Phase 9's overlay is where entered records become visible on the dashboard); voice/agent-driven data entry ("log a reading of 120 over 80" — PROJECT.md Out of Scope, needs the paid API, deferred to v2).

</domain>

<decisions>
## Implementation Decisions

### Page structure & navigation
- **D-01:** One new "Add Record" view, added to the existing `useView` zustand union (currently `"dashboard" | "upload"`) and a matching Header nav button — mirrors the exact pattern `upload` already established (view-swap, no react-router, no URL change). NOT three separate nav destinations, NOT an inline dashboard panel.
- **D-02:** Inside that single view, a 3-way segmented control (Lab / Incident / Procedure) — ≥48px, `aria-pressed`, single-select — mirrors `FilterBar`'s existing segmented-button pattern exactly (inactive = sky card + ink border, active = accent fill). Selecting a type swaps the field set below it.

### Post-submit behavior
- **D-03:** On successful POST, the form clears and stays on the "Add Record" view — it does NOT navigate back to the dashboard. Rationale: caregivers often log multiple related things in one sitting (e.g. a hospitalization plus follow-up labs), so staying put and resetting for the next entry avoids repeated navigation.
- **D-04:** Confirmation renders inline, mirroring `UploadPage`'s `role="status"` confirmation-sentence pattern (e.g. "Added 1 incident.") — not a toast/snackbar. Consistent with the one existing confirmation-UI precedent in this codebase.
- **D-05 (mechanical, follows from Phase 7 D-02):** The confirmation and any local state update use the full created record returned by the POST response directly — no forced refetch is required to prove the record was saved. Whether the visible readings/charts also need a query invalidation to reflect the new record is a Phase 9 (overlay) concern, not this phase's — this phase's success criterion is the form/confirmation loop, not chart visibility.

### Validation UX
- **D-06:** Submit button is disabled (`aria-disabled`, dashed-border-when-disabled) until all required fields for the currently-selected type are valid — mirrors `DateRangePicker`'s `canApply`/`aria-disabled` pattern exactly. No error message is ever shown for a field the caregiver hasn't touched yet; the disabled Submit is the only signal until they've attempted to fill the form.
- **Required-field floor per type (locked in Phase 7 D-03, carried forward, not re-discussed):** Lab needs `date` + `test_name`; Incident needs `datetime` + `incident_type`; Procedure needs `date` + `procedure_name`. Everything else per resource is optional and has no client-side required-ness.

### Date / time input
- **D-07:** Lab and Procedure `date` fields reuse the exact single-date half of `DateRangePicker`'s pattern (typed `YYYY-MM-DD` text input + oversized react-day-picker calendar, `parseDateOnly`/`formatDateParam` round-trip validation — never the bare `Date` constructor on a date-only string, per that component's existing Pitfall-1 guard).
- **D-08:** Incident's `datetime` field is that same date control PLUS a separate time input alongside it (client-side combines date + time into the single ISO-ish naive-local string the backend's `datetime` field expects). A native `<input type="time">` is acceptable for the time half — the DateRangePicker-style custom treatment applies to the date portion only; only the date part had a known off-by-one pitfall to guard against, not the time part.
- **Locked constraint carried from PROJECT.md/DATA-05 (not re-discussed):** naive local datetimes end-to-end — no timezone handling/conversion anywhere in the new date/time inputs, matching how Phase 7's backend already treats `datetime_` fields.

### Claude's Discretion
- Exact spacing/visual chrome of the segmented type-switcher beyond the FilterBar color/border contract already locked (D-02) — pixel-level polish, not a product decision.
- Whether switching type mid-fill (e.g. Lab → Incident) silently discards partially-entered field values or asks for confirmation first — low-stakes UX detail; default to silent discard (simplest, consistent with the "form is disposable until submitted" model D-03/D-06 already implies) unless research/planning surfaces a stronger reason otherwise.
- Exact component/file naming and whether the three field-sets are one component with conditional rendering or three small subcomponents switched by the parent — implementation-location detail, not a product decision.
- Exact request-body construction / which `use{Labs,Incidents,Procedures}` hooks or a shared `useCreateRecord`-style hook wraps the three `postJson` calls — standard pattern, no user preference expressed.
- Whether any client-side max-length is added to free-text fields (`notes`, etc.) given Phase 7's SECURITY.md T-07-04 accepted an unbounded backend `Text` column — adding a soft client-side cap is a reasonable UX nicety but not required; Claude's call during planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level requirements & state
- `.planning/PROJECT.md` — Core Value, v1.1 milestone goal, accessibility constraints (≥48px targets, ≥18px body text, high contrast, keyboard nav, no drag/hover-only/precision interactions), "manual entry forms are in scope; agent-parsed entry is not" boundary
- `.planning/REQUIREMENTS.md` §Multi-Dataset Filtering & Overlay (OVERLAY) — OVERLAY-02 (this phase's sole requirement: "Accessible manual-entry forms for labs, incidents, and procedures (≥48px targets, no drag/precision input) — the tables are otherwise unreachable"); OVERLAY-01 (Phase 7, the API this phase's forms POST to); OVERLAY-03..06 (Phase 9, what consumes this phase's entered data next); Out-of-Scope table ("Edit/delete on labs, incidents, procedures records")
- `.planning/ROADMAP.md` §Phase 8 — Goal, Depends on (Phase 7), 4 Success Criteria, "UI hint: yes"

### Phase 7 (immediately prior — API this phase consumes)
- `.planning/phases/07-records-backend-labs-incidents-procedures-crud/07-CONTEXT.md` — D-01..D-04 (API shape, POST full-record response contract, per-resource required-field floor, date-range-only GET filters)
- `.planning/phases/07-records-backend-labs-incidents-procedures-crud/07-SECURITY.md` — T-07-04 accepted-risk rationale (unbounded free-text columns) relevant to any client-side max-length decision

### Existing code this phase extends (read before implementing)
- `frontend/src/store/view.ts` — the `useView` zustand union to extend with a new view value (D-01)
- `frontend/src/components/Header.tsx` — nav button pattern to mirror for the new "Add Record" entry point (D-01)
- `frontend/src/components/FilterBar.tsx` — segmented ≥48px `aria-pressed` button pattern to mirror for the type switcher (D-02); `inactiveClass`/`activeClass` styling contract
- `frontend/src/components/DateRangePicker.tsx` — the date-input pattern to reuse for Lab/Procedure `date` and the date-half of Incident `datetime` (D-07/D-08); `parseDateOnly`/`formatDateParam` from `frontend/src/lib/dates.ts`
- `frontend/src/components/UploadPage.tsx` — the confirmation-sentence (`role="status"`) pattern to mirror (D-04); also the "only UI-SPEC copy renders, never raw error text" discipline for any submit-failure messaging
- `frontend/src/api/client.ts` — `postJson`/`ApiError` helpers (Bearer attachment already handled, per `postJson`'s existing test coverage) — the three new create calls should use this, not a new fetch wrapper
- `frontend/src/api/types.ts` — where the three new `*Create` request types and `*Out` response types (mirroring backend Pydantic schemas from Phase 7) should be added
- `frontend/src/hooks/useReadings.ts` — the `useQuery`/`queryKey` TanStack Query convention (per-filter cache keys, `staleTime`) to mirror if/when this phase adds `use{Labs,Incidents,Procedures}` read hooks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/store/view.ts` — clean two-value union, straightforward to extend to a third view value.
- `frontend/src/components/FilterBar.tsx` — direct template for the segmented type-switcher (D-02); `inactiveClass`/`activeClass` constants are copy-pasteable.
- `frontend/src/components/DateRangePicker.tsx` — direct template for date entry (D-07); the `isValidDateText`/`parseDateOnly`/`formatDateParam` round-trip guard is the exact off-by-one-day protection needed for the new forms' date fields too.
- `frontend/src/components/UploadPage.tsx` — direct template for the loading/success/error `useState` union shape and inline confirmation rendering (D-04); also the file's `assembleSentences`-style "compose plain-language confirmation from the response object" approach.
- `frontend/src/api/client.ts` `postJson` — already handles Bearer attachment and `ApiError` typing; no new HTTP wrapper needed.

### Established Patterns
- View-swap via zustand `useView`, never react-router (D-05 in Phase 5's context, still the convention) — UI state only, server data stays in TanStack Query.
- `≥48px` / `aria-pressed` / non-color-only state signaling on every interactive control — established in `FilterBar` and reiterated as a hard constraint in `OVERLAY-02` itself.
- "Only fixed, UI-authored copy renders — never raw error text or a status code" — established in `UploadPage`'s error-kind mapping (D-10, T-05-13 in that phase); any new form's failure states should follow the same discipline (map to `not-omron`-style fixed copy per failure kind, not backend error passthrough).
- Naive local date/datetime handling, `parseDateOnly`/`formatDateParam` — never the bare `Date` constructor on a date-only string (DATA-05, Pitfall 1 from Phase 5 research).

### Integration Points
- `frontend/src/App.tsx` — where the `view === "records"` (or similar) branch would be added alongside the existing `view === "upload"` branch (~line 161).
- `frontend/src/components/Header.tsx` — where a new nav button/`go("records")` call is added alongside the existing dashboard/upload toggle (~line 117-125).
- `frontend/src/api/types.ts` and `frontend/src/api/client.ts` — where the three new request/response types and POST helper functions are added, following the existing `IngestSummary`/`postFile` shape.
- **Note for planning:** `frontend/src/hooks/useReadings.ts` currently comments "data changes only on (Phase 5) uploads" as the justification for its 5-minute `staleTime` — this phase adds a second mutation source (record creation). Not this phase's problem to fix (it doesn't touch `useReadings` at all), but flagging so Phase 9 planning doesn't inherit a stale assumption about what invalidates cached data.

</code_context>

<specifics>
## Specific Ideas

No particular visual/copy references beyond what's captured in Decisions — the four locked decisions (single view + type switcher, clear-and-stay confirmation, disable-until-valid submit, DateRangePicker-pattern date entry) fully specify the shape. Exact copy wording, spacing, and the type-switcher's pixel-level styling are deferred to planning / the UI-SPEC pass (ROADMAP.md flags "UI hint: yes" for this phase, same as Phase 6).

</specifics>

<deferred>
## Deferred Ideas

- A records list/browse view (seeing what's already been entered) — not this phase's success criteria; Phase 9's overlay is where entered records become visible against the dashboard timeline.
- Client-side max-length caps on free-text fields — left to Claude's discretion during planning (see Decisions), not locked as a requirement either way.
- Warning-before-discard when switching record type mid-fill — left to Claude's discretion (default: silent discard), not locked.

### Reviewed Todos (not folded)
None — no todos in the project matched Phase 8's scope (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 8-Manual-Entry Forms*
*Context gathered: 2026-08-20*
