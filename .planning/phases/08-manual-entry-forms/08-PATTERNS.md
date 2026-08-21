# Phase 8: Manual-Entry Forms - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 13 (7 new, 6 modified)
**Analogs found:** 13 / 13 (all strong; one — `SingleDateField.tsx` — is an *extraction*, not a straight copy, see note)

This phase is 100% frontend composition of patterns that already exist and pass review in this
exact codebase. RESEARCH.md already did deep original-source reading (backend schemas/routers,
every named frontend analog) — this file re-verifies those excerpts against the live files and
adds the concrete line-numbered "copy from here" map the planner needs.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/store/view.ts` | store | event-driven | *(itself — extend in place)* | exact (mechanical extension) |
| `frontend/src/components/Header.tsx` | component (nav) | event-driven | *(itself — extend in place)* | exact (mechanical extension, reshape needed — see Pitfall 1) |
| `frontend/src/App.tsx` | component (view router) | event-driven | *(itself — extend in place)* | exact (mechanical extension) |
| `frontend/src/components/AddRecordPage.tsx` | component (page/container) | CRUD | `frontend/src/components/UploadPage.tsx` | exact — same state-union + inline-confirmation shape, POST instead of file upload |
| `frontend/src/components/records/LabFields.tsx` | component (form field-set) | CRUD | `frontend/src/components/DateRangePicker.tsx` (validity-gating shape) + `frontend/src/components/FilterBar.tsx` (control styling) | role-match |
| `frontend/src/components/records/IncidentFields.tsx` | component (form field-set) | CRUD | same as LabFields, plus native `<input type="time">` (no existing analog — new primitive, low risk) | role-match |
| `frontend/src/components/records/ProcedureFields.tsx` | component (form field-set) | CRUD | same as LabFields | role-match |
| `frontend/src/components/records/SingleDateField.tsx` | component (form control) | transform | `frontend/src/components/DateRangePicker.tsx` | role-match — extraction of the single-date half, not a straight copy (see Pitfall 2) |
| `frontend/src/hooks/useCreateRecord.ts` | hook | CRUD | `frontend/src/hooks/useAgent.ts` | exact — identical `useMutation({ mutationFn: postX })` one-liner shape, ×3 |
| `frontend/src/api/types.ts` | config (type defs) | transform | itself, `IngestSummary`/`RejectedRow` section (lines 56-68) | exact — same "byte-identical mirror of backend/app/schemas.py" convention |
| `frontend/src/api/client.ts` | service (HTTP wrapper) | request-response | itself, `postAgent`/`postAuth` wrapper section (lines 133-143) | exact — same one-line `postJson<TBody,TRes>` wrapper shape |
| `frontend/src/lib/dates.ts` | utility | transform | itself + `DateRangePicker.tsx`'s local `isValidDateText` (lines 19-25) to promote in | exact |
| `frontend/src/components/AddRecordPage.test.tsx` | test | request-response | `frontend/src/components/UploadPage.test.tsx` + `frontend/src/components/CommandBar.test.tsx` | exact — same "mock only the api/client function" convention |

## Pattern Assignments

### `frontend/src/store/view.ts` (store, event-driven) — MODIFY

**Analog:** itself (mechanical union extension)

Current file, verbatim (`frontend/src/store/view.ts` lines 1-20):
```typescript
// zustand view store (D-05) — swaps the two post-auth caregiver surfaces
// ("dashboard" | "upload") with a plain state flip, NOT react-router (no URL
// change, no Vercel rewrite; 05-RESEARCH.md Pattern 4). Ephemeral by design:
// unlike theme/auth there is NO localStorage persistence — a reload always
// returns to the dashboard. UI state ONLY — server data lives in TanStack Query
// (CLAUDE.md separation).
import { create } from "zustand";

export type View = "dashboard" | "upload";

interface ViewState {
  view: View;
  go: (view: View) => void;
}

export const useView = create<ViewState>((set) => ({
  // Chris's dashboard is always the landing surface; upload is caregiver-only.
  view: "dashboard",
  go: (view) => set({ view }),
}));
```

**Change:** widen `View` to `"dashboard" | "upload" | "records"`. No other change — `go()` already
accepts any `View` value; no new store, no new action needed (D-01).

---

### `frontend/src/components/Header.tsx` (component/nav, event-driven) — MODIFY

**Analog:** itself — but the CURRENT pattern is a **binary** toggle (`onDashboard` boolean flips
one button's label/action). D-01 says "mirrors the exact pattern," but literally reusing the
ternary does not generalize to three destinations without a reshape (RESEARCH Pitfall 1).

**Imports pattern** (lines 14-19):
```tsx
import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, Sailboat, Sun, Upload } from "lucide-react";

import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";
import { useView } from "../store/view";
```
Add `ClipboardPlus` (or similar, confirmed present in `node_modules/lucide-react`) to the
lucide-react import for the new "Add Record" button icon.

**Current binary toggle to reshape** (lines 117-181):
```tsx
const view = useView((s) => s.view);
const go = useView((s) => s.go);
...
const onDashboard = view === "dashboard";
...
{/* View toggle (D-06): "Upload" on the dashboard, "Back to dashboard"
    on the upload view. Discreet — exempt from the 48px floor. */}
<button
  type="button"
  onClick={() => go(onDashboard ? "upload" : "dashboard")}
  className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold text-[var(--color-ink)]"
>
  <Upload aria-hidden="true" size={24} />
  {onDashboard ? "Upload" : "Back to dashboard"}
</button>
```

**Required reshape (three-state):** when `onDashboard`, render BOTH "Upload" and "Add Record"
buttons (each keeping the exact existing className/icon+text/48px-exempt discreet styling); when
NOT on dashboard (either `"upload"` or `"records"`), render exactly one "Back to dashboard"
button. No direct upload↔records cross-link (matches the existing single-back-link convention).
Copy the button's className verbatim for the new "Add Record" button — only `onClick`, icon, and
label text change.

**Button styling contract to copy verbatim for every new/changed button** (shared across
Upload/Log out/theme-toggle, lines 158-194): `flex items-center gap-2 rounded-lg border-2
border-[var(--color-ink)] bg-[var(--color-sky)] px-4 py-2 text-[20px] font-bold
text-[var(--color-ink)]` — 2px ink border, sky surface, icon + text label, exempt from the 48px
floor (comment at lines 5-12 explains the exemption rationale: "occasional caregiver admin, never
operated by Chris").

---

### `frontend/src/App.tsx` (component/view router, event-driven) — MODIFY

**Analog:** itself — `UploadView` is the exact template for the new `RecordsView`.

**Imports** (lines 11-28) — add `AddRecordPage` alongside the existing `UploadPage` import.

**Template to copy** (`UploadView`, lines 140-150):
```tsx
/** The caregiver upload surface (D-05, post-auth). The Header persists across
 *  both views; UploadPage mounts no data hooks so switching here fires no fetch.
 *  Foam background matches the dashboard's min-h-screen wrapper. */
function UploadView() {
  return (
    <div className="min-h-screen bg-[var(--color-foam)]">
      <Header />
      <UploadPage />
    </div>
  );
}
```
Copy this verbatim as `RecordsView`, swapping `UploadPage` for `AddRecordPage`.

**Branch to extend** (`App()`, lines 157-163):
```tsx
function App() {
  const token = useAuth((s) => s.token);
  const view = useView((s) => s.view);
  if (token === null) return <LoginGate />;
  if (view === "upload") return <UploadView />;
  return <Dashboard />;
}
```
Add `if (view === "records") return <RecordsView />;` alongside the existing `"upload"` branch,
before the `Dashboard` fallback.

---

### `frontend/src/components/AddRecordPage.tsx` (component/page, CRUD) — NEW

**Analog:** `frontend/src/components/UploadPage.tsx` (full file read, 197 lines)

**Imports pattern** (`UploadPage.tsx` lines 14-24):
```tsx
import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileUp,
  TriangleAlert,
} from "lucide-react";

import { ApiError, postFile } from "../api/client";
import type { IngestSummary } from "../api/types";
import { fmtLongDate } from "../lib/dates";
```
For `AddRecordPage`, swap `postFile`/`IngestSummary` for the three new `useCreate*` hooks and
`LabResult | Incident | Procedure` types; keep `CheckCircle2`/`TriangleAlert` for the same
confirmation/error iconography.

**State-union pattern to mirror exactly** (lines 53-58):
```tsx
type UploadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: IngestSummary }
  // "not-omron" = a 400 (bad/unparseable file); "generic" = any other failure.
  | { status: "error"; kind: "not-omron" | "generic" };
```
`AddRecordPage` should define an analogous union, e.g. `{status:"idle"|"success"|"error"}` plus
local `recordType`/`resetSeq` state per RESEARCH Architecture Pattern 3 (key-remount reset). D-04
confirmation is simpler than Upload's (no per-row disclosure needed) — one composed sentence
("Added 1 incident.") is sufficient per D-04's literal example.

**Confirmation `role="status"` pattern to copy** (lines 122-137):
```tsx
{state.status === "success" && (
  <section
    role="status"
    aria-label="Upload result"
    className="flex flex-col gap-4 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-[var(--color-ink)]"
  >
    <div className="flex items-start gap-2">
      <CheckCircle2 aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-2">
        {assembleSentences(state.summary).map((sentence) => (
          <p key={sentence} className="text-lg text-[var(--color-ink)]">
            {sentence}
          </p>
        ))}
      </div>
    </div>
    ...
  </section>
)}
```
Copy this section shape verbatim (`role="status"`, same border/sky/icon treatment) for the new
"Added N {type}." confirmation (D-04). `aria-label` should change to something like "Add record
result".

**Error `role="alert"` + "never raw error text" discipline to copy** (lines 170-194):
```tsx
{state.status === "error" && (
  <section
    role="alert"
    aria-label="Upload notice"
    className="flex items-start gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-lg text-[var(--color-ink)]"
  >
    <TriangleAlert aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
    {state.kind === "not-omron" ? (
      <p>
        <span className="font-bold">This doesn't look like an OMRON export.</span>{" "}
        Nothing was added. Please choose the .xlsx file you exported from your OMRON app.
      </p>
    ) : (
      <p>
        <span className="font-bold">Something went wrong reading that file.</span>{" "}
        Nothing was added — please try again.
      </p>
    )}
  </section>
)}
```
`AddRecordPage`'s submit-failure branch only needs the generic-copy half (`useMutation`'s
`onError` cannot yet distinguish a 422 caregiver-input error from a network failure without a
`.kind` computed the same way `UploadPage.handleFile`'s `catch` block does it — see the try/catch
excerpt below); a single fixed "Something went wrong saving that record. Nothing was saved —
please try again." is sufficient (D-04 does not ask for a 422-specific message).

**try/catch → fixed-copy mapping discipline** (lines 66-83, applies to the `onError` callback of
whichever `useCreate*` hook is called):
```tsx
try {
  const summary = await postFile<IngestSummary>("/upload", file);
  setState({ status: "success", summary });
} catch (err) {
  // Only UI-SPEC copy renders (T-05-13). A 400 is the never-500 backstop's
  // "not-omron" signal; everything else collapses to the generic notice.
  const kind =
    err instanceof ApiError && err.status === 400 ? "not-omron" : "generic";
  setState({ status: "error", kind });
}
```
With `useMutation`, the equivalent is the `onError` callback of `mutate(body, {onSuccess, onError})`
(see `useCreateRecord.ts` / `CommandBar.tsx` pattern below) — never render `err.message` or
`err.status` directly.

**Container chrome** (lines 85-95) — copy the `<main>` wrapper class verbatim:
```tsx
<main className="mx-auto flex max-w-[720px] flex-col gap-8 bg-[var(--color-foam)] px-4 py-8 md:px-8 xl:px-16">
```

---

### `frontend/src/components/records/{Lab,Incident,Procedure}Fields.tsx` (component, CRUD) — NEW

**Analogs:** `frontend/src/components/DateRangePicker.tsx` (validity-gating shape) +
`frontend/src/components/FilterBar.tsx` (control styling contract)

**`canApply`/`aria-disabled` validity-gate pattern to mirror** (`DateRangePicker.tsx` lines 42-46,
60-63, 116-127 — this is D-06's exact locked analog):
```tsx
const fromValid = isValidDateText(fromText);
const toValid = isValidDateText(toText);
const fromError = fromText !== "" && !fromValid;
const toError = toText !== "" && !toValid;
const canApply = fromValid && toValid;
...
function handleApply() {
  if (!canApply) return; // aria-disabled guard — never send invalid params
  onApply(fromText, toText);
}
...
<button
  type="button"
  onClick={handleApply}
  aria-disabled={!canApply}
  className={
    canApply
      ? "min-h-12 self-start rounded-lg bg-[var(--color-accent)] px-6 text-[20px] font-bold text-[var(--color-accent-text)]"
      : "min-h-12 cursor-not-allowed self-start rounded-lg border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-[20px] font-bold text-[var(--color-ink)]"
  }
>
  Apply
</button>
```
Each field-set component computes its own `canSubmit` boolean from its own required fields (Lab:
`date` + `test_name`; Incident: `date` + `time` + `incident_type`; Procedure: `date` +
`procedure_name`) and bubbles it up via an `onValidityChange` callback prop (RESEARCH Architecture
Pattern 3/Open Question 2) so `AddRecordPage`'s single shared Submit button can reuse this exact
dashed-border-vs-accent-fill `aria-disabled` styling.

**Text-input styling to copy** (`DateRangePicker.tsx` line 65-66, also present in
`SingleDateField.tsx`'s extraction):
```tsx
const inputClass =
  "min-h-12 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";
```
Use this for every plain text/number input in the three field-sets (`test_name`, `result`, `unit`,
`range_low`, `range_high`, `incident_type`, `duration`, `procedure_name`, `location`, `outcome`,
`notes`).

**Label wrapper pattern to copy** (`DateRangePicker.tsx` lines 71-87):
```tsx
<label className="flex flex-col gap-1 text-[20px] font-bold text-[var(--color-ink)]">
  From
  <input
    type="text"
    ...
    aria-invalid={fromError}
    className={inputClass}
  />
  {fromError && (
    <span role="alert" className="text-[18px] font-normal">
      Enter a date like 2025-06-13
    </span>
  )}
</label>
```
D-06 explicitly says no error message shows for an untouched field — the disabled Submit is the
only signal — so field-sets should generally SKIP the `{fieldError && <span role="alert">...}`
half of this pattern (unlike `DateRangePicker`, which does show inline errors); only the
`aria-invalid` attribute (no visible text) is warranted per D-06, unless the planner decides a
touched-and-invalid state needs surfacing for the numeric-field NaN guard (Pitfall 3 below).

**NaN→null trap (Pitfall 3, RESEARCH.md) — apply in every optional-numeric-field handler:**
`LabFields`'s `result`/`range_low`/`range_high` must gate on `Number.isFinite(Number(text))`
before including the field in the request body — `JSON.stringify({ result: NaN })` silently
becomes `{"result":null}`, which the backend's `Optional[float]` happily accepts with no 422. Treat
a non-empty-but-non-numeric value as invalid (block Submit), same rigor as the required-field
gate.

---

### `frontend/src/components/records/SingleDateField.tsx` (component, transform) — NEW

**Analog:** `frontend/src/components/DateRangePicker.tsx` — this is an EXTRACTION target, not a
straight copy (D-07's "reuse the exact single-date half" describes the pattern, not the literal
range-picker component — RESEARCH Pitfall 2).

**Full source block to adapt** (`DateRangePicker.tsx` lines 1-36 imports/setup, 68-114 render):
```tsx
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import { formatDateParam, parseDateOnly } from "../lib/dates";
...
// v9 CSS custom properties — day cells at the 48px target floor, selected-day
// styling on the accent tokens (theme-aware via index.css).
const rdpSizing = {
  "--rdp-day-width": "48px",
  "--rdp-day-height": "48px",
  "--rdp-day_button-width": "48px",
  "--rdp-day_button-height": "48px",
  "--rdp-accent-color": "var(--color-accent)",
  "--rdp-accent-background-color": "var(--color-sky)",
} as React.CSSProperties;
...
<div style={rdpSizing} className="text-[18px] text-[var(--color-ink)]">
  <DayPicker
    mode="range"          {/* → change to mode="single" */}
    selected={selected}
    onSelect={handleSelect}
    defaultMonth={selected?.from}
  />
</div>
```
Change `mode="range"` → `mode="single"`, `selected: DateRange | undefined` → `selected: Date |
undefined`, single `value`/`onChange` prop pair instead of `from`/`to`. The `rdpSizing` object is a
plain literal — duplicate it in the new file (not logic that can drift).

**Validator to promote, not duplicate** (`DateRangePicker.tsx` lines 19-25):
```tsx
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict "YYYY-MM-DD" check: regex shape + round-trip through parseDateOnly
 * so impossible dates like 2025-02-31 (which JS rolls over) are rejected. */
function isValidDateText(s: string): boolean {
  return DATE_RE.test(s) && formatDateParam(parseDateOnly(s)) === s;
}
```
Move this (named export) into `lib/dates.ts`; update `DateRangePicker.tsx` to import it instead of
defining it locally (one-line change, zero behavior change — now one copy, not two). Both
`DateRangePicker.tsx` and the new `SingleDateField.tsx` then import the same function.

---

### `frontend/src/hooks/useCreateRecord.ts` (hook, CRUD) — NEW

**Analog:** `frontend/src/hooks/useAgent.ts` (full file, 10 lines) — exact shape to replicate ×3

```ts
// Source: frontend/src/hooks/useAgent.ts, verbatim
import { useMutation } from "@tanstack/react-query";

import { postAgent } from "../api/client";

export function useAgent() {
  return useMutation({ mutationFn: postAgent });
}
```
New file mirrors this exactly, once per resource:
```ts
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

**Call-site pattern to mirror** — `CommandBar.tsx`'s `mutate(text, {...})` usage (confirmed via
`CommandBar.test.tsx`'s mock convention, lines 28-31/84-96): call `mutate(body, { onSuccess:
(record) => ..., onError: () => ... })` from within the relevant field-set's submit handler or
`AddRecordPage`'s shared submit function — never a raw `useState` + manual `async`/`await` (that
is `UploadPage.tsx`'s older, pre-`useAgent.ts` pattern; RESEARCH explicitly recommends
`useMutation` as the closer analog for "creating a resource via POST").

---

### `frontend/src/api/types.ts` (config/types, transform) — MODIFY

**Analog:** itself — the `IngestSummary`/`RejectedRow` section (lines 50-68) is the established
"byte-identical mirror of backend/app/schemas.py" convention; the file header (lines 1-5) states
this convention explicitly for the whole file.

**Exact backend contract to mirror** (`backend/app/schemas.py`, read verbatim, lines 44-114):
```python
class LabResultOut(BaseModel):
    id: int
    date: DateType
    test_name: str
    result: float | None = None
    unit: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    notes: str | None = None

class LabResultCreate(BaseModel):
    date: DateType
    test_name: str
    result: float | None = None
    unit: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    notes: str | None = None

class IncidentOut(BaseModel):
    id: int
    datetime: DateTimeType = Field(validation_alias=AliasChoices("datetime_", "datetime"))
    incident_type: str
    duration: str | None = None
    notes: str | None = None

class IncidentCreate(BaseModel):
    datetime: DateTimeType
    incident_type: str
    duration: str | None = None
    notes: str | None = None

class ProcedureOut(BaseModel):
    id: int
    date: DateType
    procedure_name: str
    location: str | None = None
    outcome: str | None = None
    notes: str | None = None

class ProcedureCreate(BaseModel):
    date: DateType
    procedure_name: str
    location: str | None = None
    outcome: str | None = None
    notes: str | None = None
```
Note: `IncidentOut`/`IncidentCreate`'s JSON key is `datetime` (not `datetime_`) — confirmed by the
`AliasChoices` bridge and by `backend/tests/test_api_incidents.py`'s literal
`{"datetime": "2025-04-01T08:00:00", "incident_type": "fall"}` POST body.

**TS mirror to add** (following the exact style of `IngestSummary`, lines 61-68):
```ts
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
// Incident / Procedure follow the same shape — see RESEARCH.md Code Examples
// for the complete verbatim block (already correct, copy directly).
```
`Incident`'s `datetime: string` field must stay a naive-local ISO string with no `Z`/offset — same
`DATA-05` comment convention already on `Reading.datetime` (line 17: `// naive local ISO, no
Z/offset (DATA-05)`).

---

### `frontend/src/api/client.ts` (service, request-response) — MODIFY

**Analog:** itself — `postAgent`/`postAuth` one-line wrapper section (lines 133-143)

```ts
// Source: frontend/src/api/client.ts lines 133-143, verbatim
export function postAgent(body: AgentRequest): Promise<AgentReply> {
  return postJson<AgentRequest, AgentReply>("/agent", body);
}

export function postAuth(password: string): Promise<{ token: string }> {
  return postJson<{ password: string }, { token: string }>("/auth", {
    password,
  });
}
```
Add three more wrappers in this exact one-line shape:
```ts
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

**`postJson` itself — no changes needed, already handles everything this phase needs** (lines
76-99):
```ts
export async function postJson<TBody, TRes>(
  path: string,
  body: TBody,
): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new ApiError(res.status, path);
  }
  try {
    return (await res.json()) as TRes;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}
```
Bearer attachment (`authHeaders()`, lines 30-33) and 401→logout (`handleUnauthorized`, lines
39-41) are already centralized — do not build a second HTTP wrapper.

**Backend confirms the response contract this client expects** (`backend/app/routers/labs.py`
lines 41-51, mirrored in `incidents.py`/`procedures.py`):
```python
@router.post("/labs", response_model=LabResultOut)
def create_lab(body: LabResultCreate, db: Annotated[Session, Depends(get_db)]) -> LabResult:
    """Create a lab result and return the full stored record, including its id."""
    row = LabResult(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
```
Default FastAPI status is 200 (not 201) — `postJson`'s `!res.ok` check (anything outside 200-299)
already handles this correctly with zero changes; do not special-case 201.

---

### `frontend/src/lib/dates.ts` (utility, transform) — MODIFY

**Analog:** itself — `parseDateOnly`/`formatDateParam` (lines 38-49) are the exact functions
`SingleDateField` and `isValidDateText` build on; this file's own module docstring (lines 1-18)
already documents the off-by-one pitfall this phase must respect.

```ts
// Source: frontend/src/lib/dates.ts lines 38-49, verbatim — reuse unchanged
/** Split-parse a "YYYY-MM-DD" string to a LOCAL-midnight Date (Pitfall 1). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date's LOCAL components as "YYYY-MM-DD" for query params. */
export function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
```
Add the promoted `isValidDateText` (see `SingleDateField.tsx` section above) and a new
`combineLocalDateTime(dateText, timeText)` helper for Incident's `datetime` field:
```ts
/** Combine a "YYYY-MM-DD" date and "HH:MM" time (native <input type="time">
 * value) into the naive-local ISO shape this codebase's datetime fields use
 * everywhere else — seconds always ":00", NEVER .toISOString() (that appends
 * Z/UTC-converts, violating DATA-05). */
export function combineLocalDateTime(dateText: string, timeText: string): string {
  return `${dateText}T${timeText}:00`;
}
```
This mirrors the exact naive-local string format confirmed in
`backend/tests/test_api_incidents.py` (`"2025-04-01T08:00:00"`) and in `Reading.datetime`'s own
comment convention in `api/types.ts` line 17.

---

### `frontend/src/components/AddRecordPage.test.tsx` (test) — NEW

**Analogs:** `frontend/src/components/CommandBar.test.tsx` (mock convention) +
`frontend/src/components/UploadPage.test.tsx` (assertion style)

**Mock-only-the-api/client-function convention to copy** (`CommandBar.test.tsx` lines 27-33):
```tsx
// Keep the real module (ApiError, getJson, …) — replace only postAgent.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, postAgent: vi.fn() };
});

const mockPostAgent = postAgent as unknown as Mock;
```
For `AddRecordPage.test.tsx`, mock `postLab`/`postIncident`/`postProcedure` the same way, keeping
the real `ApiError` class so `instanceof` checks in the component's `onError` are exercised
truthfully (same rationale as `UploadPage.test.tsx`'s header comment, lines 10-11: "the real
ApiError runs so the 400-vs-generic branch is exercised through the true error type").

**QueryClientProvider render wrapper to copy** (`CommandBar.test.tsx` lines 45-54):
```tsx
function renderBar(latestReading: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandBar latestReading={latestReading} />
    </QueryClientProvider>,
  );
}
```
`AddRecordPage` uses `useMutation` (via `useCreateRecord.ts`), so it needs this same
`QueryClientProvider` wrapper — `UploadPage.test.tsx` does NOT need one (it uses raw
`useState`/`await`, no TanStack Query), so `CommandBar.test.tsx` is the correct render-wrapper
analog even though `UploadPage.test.tsx` is the correct assertion-style analog.

**Confirmation/error assertion style to copy** (`UploadPage.test.tsx` lines 56-74, 158-173):
```tsx
const panel = await screen.findByRole("status");
expect(panel.textContent).toContain("Added 12 new readings.");
...
const notice = await screen.findByRole("alert");
expect(notice.textContent).toContain("This doesn't look like an OMRON export.");
expect(screen.queryByText(/400/)).not.toBeInTheDocument();
expect(screen.queryByText(/API request failed/)).not.toBeInTheDocument();
```
Apply this same `role="status"`/`role="alert"` + "never a status code or raw ApiError text"
assertion pattern to the new form's confirmation/error tests.

## Shared Patterns

### Segmented single-select control (≥48px, `aria-pressed`, non-color-only state)
**Source:** `frontend/src/components/FilterBar.tsx` lines 25-28 (styling contract) + 93-125
(structure)
**Apply to:** `AddRecordPage.tsx`'s 3-way type switcher (D-02)
```tsx
const inactiveClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";
...
<div role="group" aria-label="Record type" className="flex flex-wrap gap-2">
  {TYPES.map(({ key, label }) => (
    <button
      key={key}
      type="button"
      aria-pressed={recordType === key}
      onClick={() => setRecordType(key)}
      className={recordType === key ? activeClass : inactiveClass}
    >
      {label}
    </button>
  ))}
</div>
```

### Bearer-authenticated POST via `postJson` (never a new fetch wrapper)
**Source:** `frontend/src/api/client.ts` lines 30-33 (`authHeaders`), 76-99 (`postJson`)
**Apply to:** `postLab`/`postIncident`/`postProcedure` wrapper functions (`api/client.ts`)
```ts
function authHeaders(): Record<string, string> {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```
Already handles Bearer attachment for every new POST call with zero changes needed.

### "Only fixed UI-authored copy renders — never raw error text" discipline
**Source:** `frontend/src/components/UploadPage.tsx` lines 76-82 (comment + implementation),
reiterated at `frontend/src/App.tsx` line 8-10 ("Error presentation is centralized here (T-02-11):
only the UI-SPEC copy renders — never raw error messages, status codes, or stack traces")
**Apply to:** every submit-failure branch in `AddRecordPage.tsx`
```tsx
const kind =
  err instanceof ApiError && err.status === 400 ? "not-omron" : "generic";
setState({ status: "error", kind });
```
Never render `err.message`, `err.status`, or any backend 422 `detail` string directly.

### `useMutation` POST wrapper (mirrors `hooks/useAgent.ts`)
**Source:** `frontend/src/hooks/useAgent.ts` (full file, 10 lines)
**Apply to:** `hooks/useCreateRecord.ts`'s three exported hooks
```ts
export function useAgent() {
  return useMutation({ mutationFn: postAgent });
}
```

### Naive-local date/datetime handling — never the bare `Date` constructor on a date-only string
**Source:** `frontend/src/lib/dates.ts` lines 1-18 (module docstring, Pitfall 1), 38-49
(`parseDateOnly`/`formatDateParam`)
**Apply to:** `SingleDateField.tsx`, `IncidentFields.tsx`'s `combineLocalDateTime` call, every new
date/time input
```ts
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
```

### `role="status"` inline confirmation (never a toast/snackbar)
**Source:** `frontend/src/components/UploadPage.tsx` lines 122-137
**Apply to:** `AddRecordPage.tsx`'s post-submit confirmation (D-04)

## No Analog Found

None. Every file this phase touches has at least a role-match analog already read verbatim above.
The one partial exception is noted inline, not a gap:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `frontend/src/components/records/SingleDateField.tsx` | component | transform | Not a reusable-as-is analog — `DateRangePicker.tsx` is a *range* picker (D-07 itself acknowledges this, asking for "the exact single-date half"). Treat as an extraction (Pitfall 2 above), not a copy-paste. Confidence remains HIGH because every sub-piece (validator, `DayPicker` config, input styling) is read verbatim from the existing file. |
| Native `<input type="time">` half of `IncidentFields.tsx` | — | transform | No existing time-input precedent in this codebase (only date-only pickers exist so far). Low risk — D-08 explicitly accepts the plain native control with no custom treatment; Pitfall 4/5 (RESEARCH.md) cover its two correctness traps (empty-value required-check, `:00`-seconds format). |

## Metadata

**Analog search scope:** `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/api/`,
`frontend/src/lib/`, `frontend/src/store/`, `backend/app/schemas.py`,
`backend/app/routers/{labs,incidents,procedures}.py` (all read verbatim, not summarized from
RESEARCH.md alone — cross-checked line-for-line during this pass)
**Files scanned:** 17 (13 frontend source files read in full + 3 backend router files + 1 backend
schemas file)
**Pattern extraction date:** 2026-08-21
