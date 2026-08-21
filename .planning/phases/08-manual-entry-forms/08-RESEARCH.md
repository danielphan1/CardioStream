# Phase 8: Manual-Entry Forms - Research

**Researched:** 2026-08-21
**Domain:** React 19 form UI over an already-shipped FastAPI create API (no new packages, no backend changes)
**Confidence:** HIGH

## Summary

Phase 7 already shipped `POST /labs`, `POST /incidents`, `POST /procedures` — Bearer-gated,
Pydantic-validated, returning the full created record. This phase is pure frontend: a new
"Add Record" view (third value in the existing `useView` union), a 3-way type switcher, three
field-sets, and an inline success/error confirmation — all built from patterns and libraries
already in this codebase. **No new npm packages are required.**

The research below reads the actual Phase 7 backend code (routers, Pydantic schemas, SQLAlchemy
models) to pin the exact request/response JSON contracts, and reads every frontend file
CONTEXT.md names as a template (`FilterBar`, `DateRangePicker`, `UploadPage`, `Header`,
`api/client.ts`, `useAgent.ts`) to ground the recommended implementation in code that already
exists and already passes review/tests in this repo.

Two things CONTEXT.md leaves under-specified that this research resolves concretely:
1. **Header nav is currently a binary toggle** (`Upload` ⇄ `Back to dashboard`), not extensible
   to a third destination by "mirroring the exact pattern" literally — Architecture Patterns
   below gives the exact three-state shape.
2. **`DateRangePicker` is a *range* picker** (two inputs, `mode="range"` `DayPicker`) — D-07's
   "reuse the single-date half of DateRangePicker's pattern" requires extracting/duplicating a
   single-date primitive, not reusing the component as-is. Architecture Patterns below gives the
   exact extraction plan (promote `isValidDateText` to `lib/dates.ts`, build a new `mode="single"`
   date field).

**Primary recommendation:** One new `AddRecordPage.tsx` (type switcher + confirmation, mirrors
`UploadPage.tsx`'s state-union shape) driving three field-set subcomponents (`LabFields` /
`IncidentFields` / `ProcedureFields`), each backed by a `useMutation({ mutationFn: postX })` hook
mirroring `useAgent.ts` exactly, calling three new typed wrappers in `api/client.ts` built on the
existing `postJson` helper — zero new HTTP machinery.

## Project Constraints (from CLAUDE.md)

These are enforced, non-negotiable directives that apply to this phase's work:

- **Fixed stack** — React (Vite) + TanStack Query + zustand + Recharts is locked; no new UI
  library, no react-router, no alternate form library (e.g. no react-hook-form/formik — this
  codebase hand-rolls small forms with plain `useState`, see `DateRangePicker.tsx`).
- **Security** — All Claude/API calls go through the backend; N/A here (no agent involvement in
  this phase). API keys never touch the frontend; N/A here (no new keys).
- **Accessibility (non-negotiable)** — every primary action reachable... Note: PROJECT.md's
  "every feature operable by voice" is scoped to *Chris's* primary dashboard surface; caregiver
  data-admin screens (`UploadPage`, and now this phase's forms) are an established exception —
  see Architectural Responsibility Map and Pitfall 1 below. The ≥48px / ≥18px / high-contrast /
  keyboard-navigable / no-drag-or-precision floor is NOT waived for this phase's actual form
  controls — OVERLAY-02's requirement text locks it explicitly, and CONTEXT.md D-02/D-06/D-07
  already encode it into the design (segmented control, disabled-submit pattern, oversized
  calendar).
- **Quality** — Tests required for ETL derivations; N/A here (no ETL/derivation logic added).
  The applicable quality bar for this phase is component-level behavior tests (see Validation
  Architecture).
- **Compatibility** — Voice input Chrome/Edge + Safari/iOS; N/A here (no voice surface added by
  this phase — voice-driven data entry is AGENT-02, explicitly deferred to v2).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page structure & navigation**
- **D-01:** One new "Add Record" view, added to the existing `useView` zustand union (currently
  `"dashboard" | "upload"`) and a matching Header nav button — mirrors the exact pattern `upload`
  already established (view-swap, no react-router, no URL change). NOT three separate nav
  destinations, NOT an inline dashboard panel.
- **D-02:** Inside that single view, a 3-way segmented control (Lab / Incident / Procedure) —
  ≥48px, `aria-pressed`, single-select — mirrors `FilterBar`'s existing segmented-button pattern
  exactly (inactive = sky card + ink border, active = accent fill). Selecting a type swaps the
  field set below it.

**Post-submit behavior**
- **D-03:** On successful POST, the form clears and stays on the "Add Record" view — it does NOT
  navigate back to the dashboard. Rationale: caregivers often log multiple related things in one
  sitting (e.g. a hospitalization plus follow-up labs), so staying put and resetting for the next
  entry avoids repeated navigation.
- **D-04:** Confirmation renders inline, mirroring `UploadPage`'s `role="status"`
  confirmation-sentence pattern (e.g. "Added 1 incident.") — not a toast/snackbar. Consistent
  with the one existing confirmation-UI precedent in this codebase.
- **D-05 (mechanical, follows from Phase 7 D-02):** The confirmation and any local state update
  use the full created record returned by the POST response directly — no forced refetch is
  required to prove the record was saved. Whether the visible readings/charts also need a query
  invalidation to reflect the new record is a Phase 9 (overlay) concern, not this phase's — this
  phase's success criterion is the form/confirmation loop, not chart visibility.

**Validation UX**
- **D-06:** Submit button is disabled (`aria-disabled`, dashed-border-when-disabled) until all
  required fields for the currently-selected type are valid — mirrors `DateRangePicker`'s
  `canApply`/`aria-disabled` pattern exactly. No error message is ever shown for a field the
  caregiver hasn't touched yet; the disabled Submit is the only signal until they've attempted
  to fill the form.
- **Required-field floor per type (locked in Phase 7 D-03, carried forward, not re-discussed):**
  Lab needs `date` + `test_name`; Incident needs `datetime` + `incident_type`; Procedure needs
  `date` + `procedure_name`. Everything else per resource is optional and has no client-side
  required-ness.

**Date / time input**
- **D-07:** Lab and Procedure `date` fields reuse the exact single-date half of
  `DateRangePicker`'s pattern (typed `YYYY-MM-DD` text input + oversized react-day-picker
  calendar, `parseDateOnly`/`formatDateParam` round-trip validation — never the bare `Date`
  constructor on a date-only string, per that component's existing Pitfall-1 guard).
- **D-08:** Incident's `datetime` field is that same date control PLUS a separate time input
  alongside it (client-side combines date + time into the single ISO-ish naive-local string the
  backend's `datetime` field expects). A native `<input type="time">` is acceptable for the time
  half — the DateRangePicker-style custom treatment applies to the date portion only; only the
  date part had a known off-by-one pitfall to guard against, not the time part.
- **Locked constraint carried from PROJECT.md/DATA-05 (not re-discussed):** naive local
  datetimes end-to-end — no timezone handling/conversion anywhere in the new date/time inputs,
  matching how Phase 7's backend already treats `datetime_` fields.

### Claude's Discretion
- Exact spacing/visual chrome of the segmented type-switcher beyond the FilterBar color/border
  contract already locked (D-02) — pixel-level polish, not a product decision.
- Whether switching type mid-fill (e.g. Lab → Incident) silently discards partially-entered
  field values or asks for confirmation first — low-stakes UX detail; default to silent discard
  (simplest, consistent with the "form is disposable until submitted" model D-03/D-06 already
  implies) unless research/planning surfaces a stronger reason otherwise.
- Exact component/file naming and whether the three field-sets are one component with
  conditional rendering or three small subcomponents switched by the parent — implementation-
  location detail, not a product decision.
- Exact request-body construction / which `use{Labs,Incidents,Procedures}` hooks or a shared
  `useCreateRecord`-style hook wraps the three `postJson` calls — standard pattern, no user
  preference expressed.
- Whether any client-side max-length is added to free-text fields (`notes`, etc.) given Phase
  7's SECURITY.md T-07-04 accepted an unbounded backend `Text` column — adding a soft client-side
  cap is a reasonable UX nicety but not required; Claude's call during planning.

### Deferred Ideas (OUT OF SCOPE)
- A records list/browse view (seeing what's already been entered) — not this phase's success
  criteria; Phase 9's overlay is where entered records become visible against the dashboard
  timeline.
- Client-side max-length caps on free-text fields — left to Claude's discretion during planning,
  not locked as a requirement either way.
- Warning-before-discard when switching record type mid-fill — left to Claude's discretion
  (default: silent discard), not locked.
- Edit/delete on any of labs/incidents/procedures (REQUIREMENTS.md Out-of-Scope).
- Resource-specific GET filters or a records list/browse view.
- Voice/agent-driven data entry ("log a reading of 120 over 80") — PROJECT.md Out of Scope,
  needs the paid API, deferred to v2 (AGENT-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVERLAY-02 | Accessible manual-entry forms for labs, incidents, and procedures (≥48px targets, no drag/precision input) — the tables are otherwise unreachable | Standard Stack (reuse of `FilterBar`/`DateRangePicker`/`UploadPage` patterns, all already ≥48px-compliant), Architecture Patterns (type switcher, single-date field extraction, key-based form reset), Code Examples (exact request/response shapes read from Phase 7's live backend code), Common Pitfalls (Header 3-way nav gap, DateRangePicker-is-a-range-picker gap, NaN→null JSON.stringify trap), Security Domain (V5 input validation posture, unchanged trust boundary from Phase 7) |
</phase_requirements>

## Architectural Responsibility Map

This is a Vite React SPA with no server-side rendering — "Frontend Server (SSR)" is not a tier
in this project; all frontend work below is Browser/Client tier. The API tier is fully built
(Phase 7) and untouched by this phase.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Type-switcher UI (Lab/Incident/Procedure segmented control) | Browser/Client (`AddRecordPage.tsx`) | — | Pure client-side view state, ephemeral, no server round-trip |
| Field-set rendering + local validation (required-field gating) | Browser/Client (`LabFields.tsx` / `IncidentFields.tsx` / `ProcedureFields.tsx`) | — | Mirrors `DateRangePicker`'s `canApply` pattern; purely presentational + local `useState` |
| Date-only / date+time input widgets | Browser/Client (`lib/dates.ts` extraction + new single-date field) | — | Pure client-side text/calendar parsing; no new server concern |
| Record creation (`POST /labs` \| `/incidents` \| `/procedures`) | API/Backend (already shipped, Phase 7) | Browser/Client (`useMutation` call site) | Backend owns validation (Pydantic required/optional split) and persistence (SQLAlchemy insert); frontend only submits and renders the returned record |
| Bearer token attachment on every request | Browser/Client (`api/client.ts` `authHeaders()`, already shipped) | — | No change needed — `postJson` already attaches the token for every POST |
| Post-submit confirmation copy | Browser/Client (`AddRecordPage.tsx`) | — | Composed client-side from the POST response, mirrors `UploadPage`'s `assembleSentences` |
| Header nav entry point | Browser/Client (`Header.tsx`) | — | Pure client-side view-swap trigger, no server involvement |
| Field validation (required + type correctness) | API/Backend (Pydantic, already shipped) | Browser/Client (pre-flight UX gating) | Backend is the authority (422 on bad body); the client-side `canApply`-style gate is a UX nicety that must never be trusted as the only defense — it isn't, since the backend independently validates every field |

## Standard Stack

### Core

No new libraries. This phase is built entirely from packages already installed and already used
elsewhere in this exact codebase:

| Library | Version (installed) | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------|
| react / react-dom | 19.2.7 | Component tree | Already the whole frontend |
| zustand | 5.0.14 | `useView` extension | Already owns view-swap state (`store/view.ts`) — this phase adds one union member, no new store |
| @tanstack/react-query | 5.101.2 | `useMutation` for the three create calls | `hooks/useAgent.ts` already establishes `useMutation({ mutationFn: postX })` as this codebase's POST-mutation pattern — reuse it verbatim, don't reinvent with raw `useState` |
| react-day-picker | 9.14.0 | Single-date calendar for Lab/Procedure `date` and the date-half of Incident `datetime` | Already the calendar engine behind `DateRangePicker`; this phase needs `mode="single"` instead of `mode="range"` — same library, different mode |
| lucide-react | 1.24.0 | New icons (nav button, field-set headers) | Already the icon set for the whole app; confirmed available icons for this phase: `ClipboardPlus`, `FilePlus2`, `FlaskConical`, `Siren`, `Stethoscope`, `AlertTriangle` (verified present in `node_modules/lucide-react/dist/esm/icons/`) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | 4.3.2 | All styling | Reuse existing utility classes/color tokens (`--color-sky`, `--color-ink`, `--color-accent`, `--color-accent-text`) — never invent new hex values |
| @testing-library/react + vitest | 16.3.2 / 4.1.10 | Component tests for the new form | Mirrors `UploadPage.test.tsx` and `CommandBar.test.tsx` conventions exactly (see Validation Architecture) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useMutation` (TanStack Query) for the 3 POST calls | Raw `async`/`useState` status union, mirroring `UploadPage.tsx` | Both patterns already exist in this codebase (`useAgent.ts` vs `UploadPage.tsx`). `useMutation` is the closer analog (creating a resource via POST, not uploading a file) and gives `isPending`/`isError`/`mutate(body, {onSuccess, onError})` for free — recommended. Raw `useState` is equally valid if the planner prefers zero new hook files; flagged as Claude's Discretion in CONTEXT.md. |
| Extracting a shared single-date `<DateInput>` component (used by both `DateRangePicker` and this phase) | Duplicating the ~15-line `isValidDateText`/typed-input+calendar block directly inside the new field-set files | Extraction is cleaner (one validator, one bug-fix surface) but touches `DateRangePicker.tsx` (a file this phase doesn't otherwise need to modify) and expands phase scope. Minimum-footprint option: promote just the pure function `isValidDateText` from `DateRangePicker.tsx` into `lib/dates.ts` as a named export (trivial, zero behavior change, both files then import the same validator) and duplicate only the ~10 lines of single-date-mode JSX. See Architecture Patterns below. |
| A single flat `useState` object holding all three types' fields at once in the parent `AddRecordPage` | Each field-set as its own subcomponent owning its own local `useState` | The subcomponent-per-type shape gets "silent discard on type switch" for free via React's unmount/remount on conditional render — no explicit discard/confirm logic needed. A flat shared state object requires manually clearing the previous type's fields on every switch. Recommended: subcomponent-per-type. |

**Installation:** None — no `npm install` needed this phase.

**Version verification:** All versions above read directly from `frontend/package.json`
(already-installed, in-repo) — no registry lookup needed since nothing new is being added.
`[VERIFIED: package.json]`

## Package Legitimacy Audit

**N/A — this phase installs no new packages.** Every library used is already present in
`frontend/package.json` and was audited in prior phases. No `slopcheck`/registry verification
run; nothing to gate behind a `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
Caregiver interaction
        │
        ▼
┌─────────────────────────┐
│ Header.tsx               │  "Add Record" nav button (new, discreet,
│ (view-swap trigger)      │  exempt from 48px — mirrors "Upload")
└───────────┬──────────────┘
            │ go("records")
            ▼
┌──────────────────────────────────────────┐
│ store/view.ts — useView (zustand)          │  "dashboard" | "upload" | "records"
└───────────┬────────────────────────────────┘
            │ App.tsx reads view === "records"
            ▼
┌──────────────────────────────────────────────────────────┐
│ AddRecordPage.tsx                                          │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 3-way segmented type switcher (Lab/Incident/Procedure)│  │ role="group", aria-pressed
│  └───────────────────┬────────────────────────────────┘   │
│                       │ recordType state (local useState)   │
│                       ▼                                     │
│  ┌─────────────┐ ┌─────────────────┐ ┌───────────────────┐ │
│  │ LabFields    │ │ IncidentFields   │ │ ProcedureFields    │ │  conditionally
│  │ (own state)  │ │ (own state)      │ │ (own state)         │ │  mounted by type;
│  └──────┬───────┘ └────────┬─────────┘ └──────────┬──────────┘ │  key={type+resetSeq}
│         │ draft fields      │ draft fields          │ draft fields│  forces remount
│         └───────────────────┴───────────────────────┘             │  (silent discard +
│                              │                                     │   post-submit clear)
│                              ▼                                     │
│                   canSubmit boolean (bubbled up via onValidityChange)
│                              │
│                    Submit button (aria-disabled until canSubmit)
└──────────────────────────────┬─────────────────────────────────────┘
                                │ mutate(body)
                                ▼
┌───────────────────────────────────────────┐
│ useCreateLab / useCreateIncident /           │  useMutation({ mutationFn: postLab })
│ useCreateProcedure  (hooks/useCreateRecord.ts)│  mirrors hooks/useAgent.ts
└───────────────────┬───────────────────────────┘
                     │ postJson<TBody,TRes>("/labs"|"/incidents"|"/procedures", body)
                     ▼
┌───────────────────────────────────────────┐
│ api/client.ts postJson                       │  Bearer attach (authHeaders), 401→logout
│ (already shipped — no change to its internals)│  (already shipped, T-05-11)
└───────────────────┬───────────────────────────┘
                     │ HTTP POST + Authorization: Bearer <token>
                     ▼
┌───────────────────────────────────────────┐
│ FastAPI: verify_token → LabResultCreate/       │  already shipped (Phase 7)
│ IncidentCreate/ProcedureCreate → SQLAlchemy    │  422 on validation failure,
│ insert → commit/refresh → *Out response         │  200 + full record on success
└───────────────────┬───────────────────────────┘
                     │ onSuccess(record) / onError(err)
                     ▼
┌───────────────────────────────────────────┐
│ AddRecordPage: role="status" confirmation      │  D-04 — "Added 1 incident."
│ sentence; field-set remounts via key bump (D-03)│  never raw error text (D-10-style)
└───────────────────────────────────────────┘
```

### Recommended Project Structure

```
frontend/src/
├── store/
│   └── view.ts                    # MODIFY: View = "dashboard" | "upload" | "records"
├── components/
│   ├── Header.tsx                 # MODIFY: 3-state nav (see Pitfall 1)
│   ├── AddRecordPage.tsx          # NEW: type switcher + submit + confirmation container
│   └── records/                   # NEW directory — one subfolder keeps the 3 field-sets
│       │                          # visually grouped without cluttering components/
│       ├── LabFields.tsx          # NEW: date + test_name + result/unit/range_low/range_high/notes
│       ├── IncidentFields.tsx     # NEW: date+time + incident_type + duration/notes
│       ├── ProcedureFields.tsx    # NEW: date + procedure_name + location/outcome/notes
│       └── SingleDateField.tsx    # NEW: mode="single" DayPicker + typed text input
│                                  #      (the D-07 extraction target — see Pitfall 2)
├── hooks/
│   └── useCreateRecord.ts         # NEW: useCreateLab / useCreateIncident / useCreateProcedure
├── api/
│   ├── types.ts                   # MODIFY: add LabResult(Create), Incident(Create), Procedure(Create)
│   └── client.ts                  # MODIFY: add postLab, postIncident, postProcedure
├── lib/
│   └── dates.ts                   # MODIFY: promote isValidDateText here (named export);
│                                  #         add combineLocalDateTime(dateText, timeText)
└── App.tsx                        # MODIFY: add RecordsView, branch on view === "records"
```

### Pattern 1: Three-state Header nav (resolves the binary-toggle gap)

**What:** `Header.tsx` currently renders exactly one button whose label/action flips based on
`onDashboard` (`"Upload"` ⇄ `"Back to dashboard"`). CONTEXT.md D-01 says "a matching Header nav
button — mirrors the exact pattern `upload` already established," but the current pattern is a
**binary** toggle, not directly extensible to a third destination.

**When to use:** Implementing the Header change for this phase.

**Recommended shape:**
```tsx
// Source: frontend/src/components/Header.tsx (existing structure, extended)
const view = useView((s) => s.view);
const go = useView((s) => s.go);
const onDashboard = view === "dashboard";

{onDashboard ? (
  <>
    <button type="button" onClick={() => go("upload")} /* existing Upload button, unchanged */>
      <Upload aria-hidden="true" size={24} />
      Upload
    </button>
    <button type="button" onClick={() => go("records")} /* new */
      className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]">
      <ClipboardPlus aria-hidden="true" size={24} />
      Add Record
    </button>
  </>
) : (
  <button type="button" onClick={() => go("dashboard")} /* existing "Back to dashboard" button, unchanged text/style */>
    <Upload aria-hidden="true" size={24} />
    Back to dashboard
  </button>
)}
```
On the dashboard, both "Upload" and "Add Record" are visible; on either non-dashboard view, one
"Back to dashboard" affordance is shown (no direct upload↔records cross-link — simplest, matches
the existing single-back-link convention). Both buttons keep the established discreet styling
(2px ink border, sky surface, icon+text, exempt from the 48px floor — same exemption already
applied to Upload/Log out, justified by "occasional caregiver admin, never operated by Chris,"
Header.tsx's own comment).

### Pattern 2: Single-date field extraction (resolves the range-picker gap)

**What:** `DateRangePicker.tsx` is a *range* picker: two text inputs (`from`/`to`) plus a
`mode="range"` `DayPicker`. D-07 asks for "the exact single-date half of DateRangePicker's
pattern" — there is no single-date component to import as-is.

**When to use:** Lab/Procedure `date` field, and the date-half of Incident's `datetime`.

**Minimum-footprint extraction (recommended):**
1. In `lib/dates.ts`, add a named export promoting the existing local function verbatim:
   ```ts
   // Source: promoted from frontend/src/components/DateRangePicker.tsx lines 19-25
   const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

   /** Strict "YYYY-MM-DD" check: regex shape + round-trip through parseDateOnly
    * so impossible dates like 2025-02-31 (which JS rolls over) are rejected. */
   export function isValidDateText(s: string): boolean {
     return DATE_RE.test(s) && formatDateParam(parseDateOnly(s)) === s;
   }
   ```
   Update `DateRangePicker.tsx` to import `isValidDateText` from `lib/dates.ts` instead of
   defining it locally (one-line change, zero behavior change) — now there is exactly one copy
   of this validator, not two.
2. New `SingleDateField.tsx` mirrors `DateRangePicker`'s typed-input + calendar block, but with
   `mode="single"` on `DayPicker` and one text input instead of two:
   ```tsx
   // Source: adapted from frontend/src/components/DateRangePicker.tsx (single-value mode)
   import { DayPicker } from "react-day-picker";
   import { formatDateParam, isValidDateText, parseDateOnly } from "../../lib/dates";

   type SingleDateFieldProps = {
     label: string;
     value: string; // "" or "YYYY-MM-DD"
     onChange: (value: string) => void;
   };

   export function SingleDateField({ label, value, onChange }: SingleDateFieldProps) {
     const valid = value === "" || isValidDateText(value);
     return (
       <label className="flex flex-col gap-1 text-[20px] font-bold text-[var(--color-ink)]">
         {label}
         <input
           type="text"
           inputMode="numeric"
           placeholder="YYYY-MM-DD"
           value={value}
           onChange={(e) => onChange(e.target.value)}
           aria-invalid={value !== "" && !valid}
           className="min-h-12 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]"
         />
         <div style={rdpSizing /* same CSS-var block as DateRangePicker */} className="text-[18px]">
           <DayPicker
             mode="single"
             selected={isValidDateText(value) ? parseDateOnly(value) : undefined}
             onSelect={(d) => d && onChange(formatDateParam(d))}
             defaultMonth={isValidDateText(value) ? parseDateOnly(value) : undefined}
           />
         </div>
       </label>
     );
   }
   ```
   The `rdpSizing` CSS-var object (48px day cells) is a plain object literal — duplicate it here
   or extract to a tiny shared constant; either is fine, it's not logic that can drift.

### Pattern 3: Form reset via `key` remount (unifies D-03 clear-and-stay + silent discard)

**What:** Both "clear the form after a successful submit" (D-03) and "silently discard
partially-entered fields when switching type" (Claude's Discretion, default: silent discard) are
the same underlying need: throw away a field-set's local state and start fresh.

**When to use:** `AddRecordPage.tsx`'s render of whichever field-set is active.

```tsx
// Source: React key-remount pattern, applied to this codebase's field-set shape
const [recordType, setRecordType] = useState<"lab" | "incident" | "procedure">("lab");
const [resetSeq, setResetSeq] = useState(0); // bumped on every successful submit

// Switching type already remounts for free (conditional render swaps the component tree).
// Bumping resetSeq on success forces a remount of the SAME type's field-set too.
const fieldsKey = `${recordType}-${resetSeq}`;

{recordType === "lab" && <LabFields key={fieldsKey} onValidityChange={setCanSubmit} onDraftChange={setDraft} />}
{recordType === "incident" && <IncidentFields key={fieldsKey} onValidityChange={setCanSubmit} onDraftChange={setDraft} />}
{recordType === "procedure" && <ProcedureFields key={fieldsKey} onValidityChange={setCanSubmit} onDraftChange={setDraft} />}

// onSuccess handler:
function handleCreated(record: LabResult | Incident | Procedure) {
  setConfirmation(/* composed sentence */);
  setResetSeq((n) => n + 1); // remounts the current field-set with fresh internal state
}
```
No manual "clear all fields" function is needed inside each field-set component — remounting via
`key` change gives a fresh `useState` initial value automatically. This also means switching type
mid-fill requires **zero** extra discard logic: the conditional render (`recordType === "lab" &&
...`) already unmounts the previous type's component when the type changes.

### Pattern 4: `useMutation` wrapper per resource (mirrors `hooks/useAgent.ts`)

```ts
// Source: pattern verbatim from frontend/src/hooks/useAgent.ts
import { useMutation } from "@tanstack/react-query";
import { postIncident, postLab, postProcedure } from "../api/client";

export function useCreateLab() {
  return useMutation({ mutationFn: postLab });
}
export function useCreateIncident() {
  return useMutation({ mutationFn: postIncident });
}
export function useCreateProcedure() {
  return useMutation({ mutationFn: postProcedure });
}
```
Call site (mirrors `CommandBar.tsx`'s `mutate(text, {...})` usage):
```tsx
const { mutate, isPending } = useCreateLab();
mutate(body, {
  onSuccess: (record) => handleCreated(record),
  onError: () => setError("generic"), // never render ApiError details (D-10-style discipline)
});
```

### Anti-Patterns to Avoid

- **A single `POST /records` with a type discriminator:** explicitly rejected by Phase 7's D-01
  ("Not a single combined `/records` endpoint"). The three endpoints are separate; the frontend
  must call each by its own path/type, never invent a combined shape.
- **`<input type="date">` / `<input type="datetime-local">`:** explicitly rejected in
  08-DISCUSSION-LOG.md ("less custom code, but native datetime-local has known inconsistent
  styling/behavior across Chrome vs Safari") — this project already committed to the typed-text +
  calendar pattern for dates. (Native `<input type="time">` for the time-only half IS accepted,
  D-08 — the rejected option was specifically `datetime-local` and bare `date`.)
- **Trusting the disabled-Submit gate as the only validation:** the backend independently 422s a
  malformed body (FastAPI/Pydantic), and the client gate is a UX nicety, not a security boundary.
  Never skip building the request body correctly because "the button was disabled so it can't be
  wrong" — always build the body defensively (see Pitfall 3, the NaN→null trap).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bearer token attachment on POST | A new fetch wrapper | `api/client.ts`'s existing `postJson` | Already handles the Bearer header, `ApiError` typing, and 401→logout centrally; a second wrapper would fork that discipline |
| Date-only string parsing | `new Date("YYYY-MM-DD")` anywhere | `parseDateOnly`/`formatDateParam` from `lib/dates.ts` | `new Date("YYYY-MM-DD")` parses as UTC midnight — off by one day in negative-offset timezones (documented Pitfall 1 in this exact codebase, already guarded against in `DateRangePicker`) |
| "Is this a valid calendar date" check | A hand-rolled regex-only check | `isValidDateText` (promoted to `lib/dates.ts`, Pattern 2) | The round-trip through `parseDateOnly`/`formatDateParam` is what rejects JS's silent date rollover (e.g. `2025-02-31` → `2025-03-03`) that a regex alone would miss |
| POST mutation state machine (loading/success/error) | A new bespoke `useState` union AND a new fetch call, per resource | `useMutation` (TanStack Query, already a project dependency) mirroring `hooks/useAgent.ts` | Gives `isPending`/`isError`/`mutate(body, {onSuccess, onError})` for free; this codebase already has the precedent for POST-via-`useMutation` (`useAgent.ts`) distinct from POST-via-raw-`useState` (`UploadPage.tsx`, which predates `useAgent.ts`'s pattern) |
| Segmented single-select button group | A new radio-button-styled control | `FilterBar`'s existing `role="group"` + `aria-pressed` + `inactiveClass`/`activeClass` pattern | Already the established, accessible (≥48px, non-color-only state signaling) pattern in this exact codebase for exactly this UI shape |

**Key insight:** Every primitive this phase needs — POST wrapper, date parsing, mutation state,
segmented control, disabled-until-valid submit — already exists somewhere in this codebase.
The entire phase is composition of existing, already-reviewed patterns, not new invention.

## Common Pitfalls

### Pitfall 1: Blindly "mirroring" the Header's current toggle breaks with a third view

**What goes wrong:** The current `Header.tsx` toggle button computes its label/action from a
single boolean (`onDashboard`). Naively extending the existing ternary to handle three views
(e.g. nesting more ternaries) produces confusing or unreachable states (e.g. no way back to
dashboard from "records," or "records" and "upload" fighting over the same button).
**Why it happens:** CONTEXT.md's D-01 says "mirrors the exact pattern," which reads as "reuse
the code," but the *pattern* (binary toggle) doesn't generalize to three states without a
reshape.
**How to avoid:** Use the two-buttons-on-dashboard / one-back-button-elsewhere shape from
Architecture Pattern 1 above. Keep every button's existing style/exemption (discreet, non-48px,
icon+text) — only the branching logic changes.
**Warning signs:** If the planner's task list has a single-line "update the Header toggle" task
instead of an explicit rewrite of the conditional block, this pitfall wasn't caught.

### Pitfall 2: `DateRangePicker` cannot be reused as-is for a single date

**What goes wrong:** Importing `<DateRangePicker>` directly into the Lab/Procedure field-set and
trying to use only its `from` value produces a component with a visible (and confusing) unused
"To" field, `mode="range"` calendar selection behavior, and an `onApply(from, to)` callback shape
that doesn't match a single-date need.
**Why it happens:** D-07's wording ("reuse the exact single-date half") describes the *pattern*
(typed input + calendar + round-trip validation), not the literal component, but it's easy to
read as "import `DateRangePicker`."
**How to avoid:** Extract per Architecture Pattern 2 — promote `isValidDateText` to `lib/dates.ts`
(shared), build a small new `SingleDateField` with `mode="single"`.
**Warning signs:** A plan task that says "reuse `<DateRangePicker>` for the Lab date field"
verbatim — should instead say "extract/adapt the single-date pattern."

### Pitfall 3: `JSON.stringify` silently turns `NaN` into `null` — a data-loss trap on optional numeric fields

**What goes wrong:** `LabResultCreate.result`/`range_low`/`range_high` are optional floats. If
the form does `Number(resultText)` on a non-empty-but-non-numeric string (e.g. a stray typo),
the result is `NaN`. `JSON.stringify({ result: NaN })` produces `{"result":null}` — no error is
thrown, no 422 comes back (the field is `Optional`), and the caregiver's typo is silently saved
as "no result" instead of being caught.
**Why it happens:** `NaN` is a valid JS number, `JSON.stringify` coerces `NaN`/`Infinity` to
`null` per the JSON spec, and Pydantic happily accepts `null` for an `Optional[float]` field —
nothing in the chain raises an error.
**How to avoid:** For each optional numeric field, gate on "empty string OR a value that passes
`Number.isFinite(Number(text))`" — treat non-empty-but-non-numeric as **invalid** and either
block Submit or surface it, exactly like the required-field gate already does for `date`/
`test_name`. Don't rely on the required-field validity check alone; extend the same disabled-
Submit logic to cover optional numeric fields' format validity too.
**Warning signs:** A submitted lab result with `result: null` when the caregiver is certain they
typed a number — silent data loss, hard to debug after the fact.

### Pitfall 4: Native `<input type="time">` needs no extra format validation, but IS still required-checked

**What goes wrong:** Assuming the time field needs the same regex/round-trip treatment as the
date field (over-building), OR assuming an empty time value is fine because "the browser handles
it" (under-building — an empty `<input type="time">` value is just `""`, and Incident's
`datetime` is a required field).
**Why it happens:** Confusing "format is self-validated by the browser" (true — `.value` is
always either `""` or well-formed `"HH:MM"`) with "presence is guaranteed" (false — it can be
empty).
**How to avoid:** Only check `timeText !== ""` for the time half; combine with the date half's
existing `isValidDateText` check for the overall Incident-required-fields gate. No new time regex
needed.
**Warning signs:** A submitted incident with a truncated `datetime` string (e.g. just the date, no
`T...` suffix) reaching the backend and getting a 422 — meaning the client-side gate let an
incomplete datetime through.

### Pitfall 5: Constructing `Incident.datetime` in the wrong string shape

**What goes wrong:** Sending `"2025-04-01T08:00"` (no seconds) or a `Date`-object-derived
`.toISOString()` (which appends `Z` / UTC-converts) as the `datetime` field.
**Why it happens:** Native `<input type="time">`'s `.value` is `"HH:MM"` (no seconds); it's easy
to concatenate `${date}T${time}` and stop there, or to reach for `.toISOString()` out of habit.
**How to avoid:** Pydantic's `datetime` field *does* accept `"...T08:00"` (no seconds) as valid
ISO 8601 — it will not 422 — but the project's own test fixtures
(`backend/tests/test_api_incidents.py`) and every existing naive-local datetime in this codebase
consistently include `:00` seconds (e.g. `"2025-04-01T08:00:00"`). Build the combined string as
`` `${dateText}T${timeText}:00` `` for consistency with the rest of the codebase's naive-local
format, and **never** call `.toISOString()` (that appends `Z`/UTC-converts, violating DATA-05's
naive-local-everywhere contract — the same rule `ReadingOut`/`IncidentOut`'s docstrings already
pin: "no `Z`/offset — never add timezone handling").
**Warning signs:** A `Z` suffix or a `+00:00` offset anywhere in a submitted `datetime` string.

## Code Examples

Verified patterns read directly from this repository's Phase 7 backend code (not training-data
assumptions):

### Exact POST /labs request/response shapes
```python
# Source: backend/app/schemas.py (read verbatim, lines 59-68 / 44-57)
class LabResultCreate(BaseModel):
    date: DateType          # required — "YYYY-MM-DD"
    test_name: str          # required
    result: float | None = None
    unit: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    notes: str | None = None

class LabResultOut(BaseModel):
    id: int
    date: DateType
    test_name: str
    result: float | None = None
    unit: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    notes: str | None = None
```
Response is `LabResultOut` (the full record, including server-assigned `id`) — `POST /labs`
returns 200, not 201 (`backend/app/routers/labs.py`, `response_model=LabResultOut`, default
FastAPI status).

### Exact POST /incidents request/response shapes (note the `datetime` key, not `datetime_`)
```python
# Source: backend/app/schemas.py lines 85-91 / 71-83
class IncidentCreate(BaseModel):
    datetime: DateTimeType  # required — naive local ISO, e.g. "2025-04-01T08:00:00"
    incident_type: str      # required
    duration: str | None = None
    notes: str | None = None

class IncidentOut(BaseModel):
    id: int
    datetime: DateTimeType  # JSON key is "datetime", aliased from ORM attr datetime_
    incident_type: str
    duration: str | None = None
    notes: str | None = None
```
Confirmed by `backend/tests/test_api_incidents.py::test_post_incident_minimal_fields_creates_and_returns_record`:
`client.post("/incidents", json={"datetime": "2025-04-01T08:00:00", "incident_type": "fall"})`.

### Exact POST /procedures request/response shapes
```python
# Source: backend/app/schemas.py lines 107-114 / 94-105
class ProcedureCreate(BaseModel):
    date: DateType           # required
    procedure_name: str      # required
    location: str | None = None
    outcome: str | None = None
    notes: str | None = None

class ProcedureOut(BaseModel):
    id: int
    date: DateType
    procedure_name: str
    location: str | None = None
    outcome: str | None = None
    notes: str | None = None
```

### Recommended TS mirror types (add to `frontend/src/api/types.ts`)
```ts
// Byte-identical mirror of backend/app/schemas.py's *Out / *Create models (same
// convention this file already uses for Reading/StatsSummary — see file header comment).
export type LabResult = {
  id: number;
  date: string; // "YYYY-MM-DD"
  test_name: string;
  result: number | null;
  unit: string | null;
  range_low: number | null;
  range_high: number | null;
  notes: string | null;
};

export type LabResultCreate = {
  date: string;
  test_name: string;
  result?: number | null;
  unit?: string | null;
  range_low?: number | null;
  range_high?: number | null;
  notes?: string | null;
};

export type Incident = {
  id: number;
  datetime: string; // naive local ISO, no Z/offset (DATA-05)
  incident_type: string;
  duration: string | null;
  notes: string | null;
};

export type IncidentCreate = {
  datetime: string;
  incident_type: string;
  duration?: string | null;
  notes?: string | null;
};

export type Procedure = {
  id: number;
  date: string;
  procedure_name: string;
  location: string | null;
  outcome: string | null;
  notes: string | null;
};

export type ProcedureCreate = {
  date: string;
  procedure_name: string;
  location?: string | null;
  outcome?: string | null;
  notes?: string | null;
};
```

### Recommended `api/client.ts` additions
```ts
// Source: pattern verbatim from existing postAuth/postAgent wrappers in this same file
export function postLab(body: LabResultCreate): Promise<LabResult> {
  return postJson<LabResultCreate, LabResult>("/labs", body);
}
export function postIncident(body: IncidentCreate): Promise<Incident> {
  return postJson<IncidentCreate, Incident>("/incidents", body);
}
export function postProcedure(body: ProcedureCreate): Promise<Procedure> {
  return postJson<ProcedureCreate, Procedure>("/procedures", body);
}
```

## State of the Art

No "old vs. new" axis applies — this phase composes existing, currently-current patterns already
in this exact codebase (built weeks ago in Phase 5–7 of the same project). There is no external
ecosystem drift to account for.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A soft client-side `maxLength` (e.g. ~1000 chars for `notes`, ~200 for shorter fields like `test_name`/`incident_type`/`duration`/`location`/`outcome`/`procedure_name`) is a reasonable UX guard, though not required — no existing free-text *entry* precedent exists in this codebase to anchor an exact number (only free-text *display* exists, in `ReadingsTable`'s read-only `notes` column) | Standard Stack / CONTEXT.md Claude's Discretion | Low — purely a UX nicety, not a security or correctness boundary (backend already accepts unbounded `Text`, T-07-04 accepted risk); worst case is a caregiver hits an unexpected client-side cap and has to shorten their note |
| A2 | Recommending a dedicated `components/records/` subfolder (rather than flat `components/`) for the three field-set files is a naming/organization choice, not validated against any existing multi-file-per-feature precedent in this codebase (every other feature is a flat file in `components/`) | Architecture Patterns / Recommended Project Structure | Low — pure file-organization preference; planner/executor can flatten into `components/` directly with zero functional difference |

**If this table is empty:** N/A — two low-risk organizational/UX assumptions logged above; no
assumption here touches the API contract (which was read verbatim from source, not assumed) or
any compliance/security-sensitive claim.

## Open Questions (RESOLVED)

1. **Exact confirmation sentence richness (minimal count-only vs. echoing back submitted values)**
   (RESOLVED — Plan 08-03)
   - What we know: D-04 gives one literal example, "Added 1 incident." — a minimal, count-only
     style matching `UploadPage`'s value-free confirmation discipline.
   - What's unclear: Whether echoing back the caregiver's own just-typed values (e.g. "Added 1
     incident — fall, April 1.") is desired as a stronger confirmation, or whether that drifts
     from the established "never echo raw values back" convention (which in `UploadPage`'s case
     specifically meant never echoing *health/clinical* values, not necessarily caregiver-authored
     labels like an incident type).
   - Recommendation: Default to the literal minimal form from D-04 ("Added 1 {type}.") as the safe
     baseline; a richer version is a reasonable enhancement the planner/UI-SPEC pass can choose to
     add, since it's not a health-value disclosure concern (the caregiver just typed it themselves).
   - **Resolution:** Plan 08-03's `AddRecordPage.tsx` adopted the minimal count-only form verbatim
     — a fixed `"Added 1 {noun}."` sentence built from a local `NOUN` map keyed on `recordType`,
     with no echo of any caregiver-typed field value.

2. **Whether the Submit button and its aria-disabled styling should live once in `AddRecordPage`
   or be duplicated per field-set** (RESOLVED — Plan 08-03)
   - What we know: D-06 locks the `aria-disabled`/dashed-border pattern; the validity computation
     differs per type (different required fields).
   - What's unclear: Exact prop contract for bubbling "is this field-set currently valid" up to
     the single shared Submit button (Architecture Pattern 3 sketches an `onValidityChange`
     callback prop, but a `useState` "draft" object + a pure `isValid(type, draft)` function
     computed in the parent is an equally valid alternative).
   - Recommendation: Either shape works; the callback-prop shape (Pattern 3) keeps each field-set
     fully self-contained (including its own local validity logic), which pairs naturally with the
     key-remount reset mechanism (Pattern 3) since the field-set already owns its own state.
   - **Resolution:** Plan 08-03 adopted a single shared Submit button living once in
     `AddRecordPage.tsx`, gated on an `onDraftChange: (body: XCreate | null) => void` callback
     each field-set reports up (Plan 08-02) — not duplicated per field-set, and not a separate
     `onValidityChange` prop (the draft body itself doubles as the validity signal: non-null means
     valid).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend toolchain | ✓ | v24.14.0 (repo pins engines `^20.19.0 \|\| >=22.12.0`; local runtime is newer than CLAUDE.md's recommended Node 22 LTS but within Vite 8's supported range) | — |
| npm | Package scripts | ✓ | 11.9.0 | — |
| Existing npm dependencies (react-day-picker, zustand, @tanstack/react-query, lucide-react) | All new components/hooks | ✓ | See Standard Stack table | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — this phase adds no new external dependency.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`frontend/package.json`) + `@testing-library/react` 16.3.2 |
| Config file | `frontend/vite.config.ts` (Vitest config colocated with Vite — no separate `vitest.config.ts`) |
| Quick run command | `cd frontend && npx vitest run src/components/AddRecordPage.test.tsx` |
| Full suite command | `cd frontend && npx vitest run` |

Backend test suite (`cd backend && python -m pytest`) is unaffected — this phase makes no backend
changes; Phase 7's `test_api_labs.py`/`test_api_incidents.py`/`test_api_procedures.py` already
cover the contract this phase's forms consume and need no changes.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVERLAY-02 | Caregiver submits a Lab via the form; ≥48px targets, no drag/precision input; confirmation appears; form clears | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "Lab"` | ❌ Wave 0 — new file |
| OVERLAY-02 | Caregiver submits an Incident via the form (date + native time input combine correctly into naive-local ISO) | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "Incident"` | ❌ Wave 0 — new file |
| OVERLAY-02 | Caregiver submits a Procedure via the form | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "Procedure"` | ❌ Wave 0 — new file |
| OVERLAY-02 | Submit stays disabled (`aria-disabled`) until required fields are valid, mirroring `DateRangePicker`'s `canApply` contract | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "disabled"` | ❌ Wave 0 |
| OVERLAY-02 | Record shows up "immediately, without a page reload" — the POST response drives the confirmation directly, no forced refetch | component | `npx vitest run src/components/AddRecordPage.test.tsx -t "immediately"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/components/AddRecordPage.test.tsx`
  (plus `src/lib/dates.test.ts` if `isValidDateText`/`combineLocalDateTime` were touched that
  task)
- **Per wave merge:** `cd frontend && npx vitest run` (full frontend suite)
- **Phase gate:** Full frontend suite green before `/gsd-verify-work`; backend suite
  (`cd backend && python -m pytest`) green as a regression check even though this phase doesn't
  touch backend code

### Wave 0 Gaps
- [ ] `frontend/src/components/AddRecordPage.test.tsx` — new file. Mock only `postLab` /
  `postIncident` / `postProcedure` at the `api/client` module boundary (mirrors
  `CommandBar.test.tsx`'s "the ONLY mock" convention — real `useMutation`, real
  `QueryClientProvider`, real `ApiError` class so the error-branch tests exercise the true type).
  Cover: type-switch discard, disabled-until-valid per type, successful submit → confirmation +
  form clear (via the `key` remount), and the generic-error branch on a rejected mutation.
- [ ] `frontend/src/lib/dates.test.ts` — extend (existing file) with cases for the newly-exported
  `isValidDateText` (if promoted per Pattern 2) and any new `combineLocalDateTime` helper (date +
  time → naive-local ISO string, seconds always `:00`).
- [ ] No framework install needed — Vitest + Testing Library are already fully configured and
  exercising this exact component/hook shape (`CommandBar.test.tsx`, `UploadPage.test.tsx`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no new auth surface — every POST already flows through the existing Bearer-token `postJson` path (SEC-01), untouched by this phase |
| V3 Session Management | No | No session/token logic touched |
| V4 Access Control | No | Router-level `Depends(verify_token)` gating on `/labs`, `/incidents`, `/procedures` was established and audited in Phase 7 (T-07-01, closed); this phase adds no new route, only a client that calls the existing ones |
| V5 Input Validation | Yes — client-side UX layer only | Backend (Pydantic `*Create` models) remains the actual validation authority, already audited (Phase 7 T-07-02/T-07-03/T-07-05, all closed/accepted). This phase's client-side "disable Submit until valid" gate is a UX nicety, not a trust boundary — see Pitfall 3 for the one genuine correctness risk (NaN→null silent coercion) this phase must guard against on the client side |
| V6 Cryptography | No | Not touched |
| V7 Error Handling and Logging | Yes | Mirror the established "only fixed UI-authored copy renders — never a status code, `ApiError` message, or raw backend 422 detail" discipline (`UploadPage.tsx`'s D-10/T-05-13 precedent) for this phase's submit-failure branch |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Silent client-side data coercion (NaN→null on optional numeric fields) | Tampering (data integrity, not a security exploit but a correctness/DoS-of-trust concern for a health record) | Explicit `Number.isFinite` gate before including an optional numeric field in the request body (Pitfall 3) — the backend cannot distinguish "caregiver meant null" from "caregiver's typo silently became null," so the client must not let that ambiguity through |
| Free-text field injection (`notes`, `test_name`, `incident_type`, etc.) rendered back in the confirmation sentence or (later, Phase 9) on the dashboard | Tampering (XSS) | React's JSX text-node rendering already auto-escapes (same T-02-08 precedent as `ReadingsTable`'s `notes` column) — never use `dangerouslySetInnerHTML` anywhere in the new confirmation or field-set components; not a new risk since Phase 7's backend already accepts this exact free text unmodified (T-07-03, closed) |
| Trusting the disabled-Submit UX gate as a security boundary | Tampering (client-side validation bypass) | Not a new risk — Pydantic already independently validates every field server-side (422 on a malformed/incomplete body) regardless of what the disabled-Submit button allowed through; this phase changes nothing about that existing backend authority |

This phase introduces **no new trust boundary** — it is a client that calls three already-audited,
already-gated endpoints. The only genuinely new client-side correctness concern is Pitfall 3
(NaN→null), which is a data-integrity nicety, not an exploitable vulnerability (the caregiver is
already an authenticated, trusted actor per this app's single-user threat model, T-07-04's
accepted-risk rationale).

## Sources

### Primary (HIGH confidence)
- `backend/app/schemas.py` (read verbatim) — `LabResultCreate`/`LabResultOut`,
  `IncidentCreate`/`IncidentOut`, `ProcedureCreate`/`ProcedureOut` exact field sets and types
- `backend/app/routers/labs.py`, `incidents.py`, `procedures.py` (read verbatim) — exact
  request/response flow, `response_model` contracts, no-manual-try/except discipline
- `backend/app/models.py` (read verbatim) — column types/nullability underlying the schemas
- `backend/tests/test_api_labs.py`, `test_api_incidents.py`, `test_api_procedures.py` (read
  verbatim) — confirmed exact JSON request/response shapes via real assertions, including the
  naive-local datetime format (`"2025-04-01T08:00:00"`) and inclusive end-date semantics
- `backend/app/deps.py`, `backend/app/main.py`, `backend/app/auth.py` (read verbatim) — router
  gating, `verify_token` 401 behavior, no rate limiting on the three new routes
- `.planning/phases/07-records-backend-labs-incidents-procedures-crud/07-SECURITY.md` (read
  verbatim) — closed/accepted threat register this phase inherits (T-07-01..T-07-05)
- `frontend/src/components/FilterBar.tsx`, `DateRangePicker.tsx`, `UploadPage.tsx`, `Header.tsx`,
  `App.tsx` (read verbatim) — exact patterns this phase mirrors/extends
- `frontend/src/api/client.ts`, `api/types.ts`, `store/view.ts`, `store/auth.ts`,
  `hooks/useAgent.ts`, `hooks/useStats.ts`, `hooks/useReadings.ts` (read verbatim) — existing
  HTTP/mutation/store conventions
- `frontend/src/index.css` (read verbatim) — confirmed `--text-base: 1.125rem` (18px) is the
  Tailwind base-font override, so `text-lg`/`text-base` utility classes already satisfy the
  ≥18px body-font floor project-wide
- `frontend/package.json` (read verbatim) — confirmed all libraries this phase needs are already
  installed dependencies; no new install required
- `node_modules/lucide-react/dist/esm/icons/` (directory listing) — confirmed icon availability:
  `clipboard-plus`, `file-plus-2`, `flask-conical`, `siren`, `stethoscope`, `alert-triangle`

### Secondary (MEDIUM confidence)
- `frontend/src/components/CommandBar.test.tsx` (read verbatim) — confirmed the "mock only the
  `api/client` function, real hook, real `QueryClientProvider`" test convention that
  `AddRecordPage.test.tsx` should follow
- `frontend/src/components/UploadPage.test.tsx` (read verbatim) — confirmed the
  confirmation-sentence/error-mapping test style to mirror

### Tertiary (LOW confidence)
- None — every claim above traces to a file actually read in this repository during this
  research session; no unverified web search was needed since this phase is 100% internal
  composition of an already-built, already-documented codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every version read directly from the installed
  `package.json`, not inferred
- Architecture: HIGH — every pattern (Header 3-state nav, single-date extraction, key-remount
  reset, `useMutation` wrapper) is grounded in code read verbatim from this repository, with the
  two genuine gaps (binary-toggle Header, range-only DateRangePicker) explicitly identified and
  resolved with concrete code
- Pitfalls: HIGH — Pitfalls 1/2 come directly from reading the actual current code and finding
  the gap between CONTEXT.md's literal wording and what the code supports; Pitfall 3 (NaN→null)
  is a well-known, verifiable JS/JSON-spec behavior, not speculative

**Research date:** 2026-08-21
**Valid until:** No external expiry — this research is grounded entirely in this repository's own
code, which only changes when this repository changes. Re-verify only if Phase 7's backend
contract (`backend/app/schemas.py`) changes before Phase 8 executes.
