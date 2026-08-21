// AddRecordPage (Plan 08-03, OVERLAY-02) — the container that closes the loop
// CONTEXT.md D-01 through D-08 describe: mounts exactly one of Plan 08-02's
// three field-sets by type, gates a shared Submit button on the mounted
// field-set's reported draft body, calls the matching Plan 08-01
// useCreateLab/useCreateIncident/useCreateProcedure mutation hook, and
// renders the D-03/D-04-locked inline confirmation-and-clear / error loop.
//
// Reset mechanics (D-03, RESEARCH Pattern 3): `key={`${recordType}-${resetSeq}`}`
// on the mounted field-set gives both post-submit clearing AND silent
// type-switch discard for free via React's unmount/remount — no manual clear
// function needed.
//
// Error discipline (T-08-04, mirrors UploadPage's D-10/T-05-13): only one
// fixed, UI-authored sentence per record-type noun ever renders on a rejected
// mutation — never `err.message`, `err.status`, or a backend 422 detail.
import { useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import type { IncidentCreate, LabResultCreate, ProcedureCreate } from "../api/types";
import { useCreateIncident, useCreateLab, useCreateProcedure } from "../hooks/useCreateRecord";
import { IncidentFields } from "./records/IncidentFields";
import { LabFields } from "./records/LabFields";
import { ProcedureFields } from "./records/ProcedureFields";

type RecordType = "lab" | "incident" | "procedure";

type DraftBody = LabResultCreate | IncidentCreate | ProcedureCreate | null;

type SubmitState =
  | { status: "idle" }
  | { status: "success"; noun: string }
  | { status: "error"; noun: string };

const NOUN: Record<RecordType, string> = {
  lab: "lab result",
  incident: "incident",
  procedure: "procedure",
};

const SUBMIT_LABEL: Record<RecordType, string> = {
  lab: "Add Lab Result",
  incident: "Add Incident",
  procedure: "Add Procedure",
};

const TYPE_OPTIONS: { key: RecordType; label: string }[] = [
  { key: "lab", label: "Lab" },
  { key: "incident", label: "Incident" },
  { key: "procedure", label: "Procedure" },
];

// Type-switcher styling — mirrors FilterBar's exact inactiveClass/activeClass
// constants verbatim (D-02, UI-SPEC "AddRecordPage.tsx layout").
const inactiveClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";

export function AddRecordPage() {
  const [recordType, setRecordType] = useState<RecordType>("lab");
  const [resetSeq, setResetSeq] = useState(0);
  const [draftBody, setDraftBody] = useState<DraftBody>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  // React hook rules — all three mutation hooks are always called; only one
  // is ever invoked per submit, selected by recordType.
  const createLab = useCreateLab();
  const createIncident = useCreateIncident();
  const createProcedure = useCreateProcedure();

  const fieldsKey = `${recordType}-${resetSeq}`;

  function handleTypeChange(next: RecordType) {
    setRecordType(next);
    setDraftBody(null);
    setSubmitState({ status: "idle" });
  }

  function handleSubmit() {
    // aria-disabled does not prevent a click handler from firing (mirrors
    // DateRangePicker.tsx's handleApply discipline) — the guard must live
    // here, not just in the disabled className/attribute.
    if (draftBody === null) return;
    const noun = NOUN[recordType];
    if (recordType === "lab") {
      createLab.mutate(draftBody as LabResultCreate, {
        onSuccess: () => {
          setSubmitState({ status: "success", noun });
          setDraftBody(null);
          setResetSeq((n) => n + 1);
        },
        onError: () => setSubmitState({ status: "error", noun }),
      });
    } else if (recordType === "incident") {
      createIncident.mutate(draftBody as IncidentCreate, {
        onSuccess: () => {
          setSubmitState({ status: "success", noun });
          setDraftBody(null);
          setResetSeq((n) => n + 1);
        },
        onError: () => setSubmitState({ status: "error", noun }),
      });
    } else {
      createProcedure.mutate(draftBody as ProcedureCreate, {
        onSuccess: () => {
          setSubmitState({ status: "success", noun });
          setDraftBody(null);
          setResetSeq((n) => n + 1);
        },
        onError: () => setSubmitState({ status: "error", noun }),
      });
    }
  }

  const canSubmit = draftBody !== null;

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-8 bg-[var(--color-foam)] px-4 py-8 md:px-8 xl:px-16">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold leading-tight text-[var(--color-ink)]">
          Add a record
        </h2>
        <p className="text-lg text-[var(--color-ink)]">
          Log a new lab result, incident, or procedure. Choose a type below,
          then fill in the details.
        </p>
      </div>

      <div role="group" aria-label="Record type" className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={recordType === key}
            onClick={() => handleTypeChange(key)}
            className={recordType === key ? activeClass : inactiveClass}
          >
            {label}
          </button>
        ))}
      </div>

      {recordType === "lab" && (
        <LabFields key={fieldsKey} onDraftChange={setDraftBody} />
      )}
      {recordType === "incident" && (
        <IncidentFields key={fieldsKey} onDraftChange={setDraftBody} />
      )}
      {recordType === "procedure" && (
        <ProcedureFields key={fieldsKey} onDraftChange={setDraftBody} />
      )}

      <button
        type="button"
        onClick={handleSubmit}
        aria-disabled={!canSubmit}
        className={
          canSubmit
            ? "min-h-12 self-start rounded-lg bg-[var(--color-accent)] px-6 text-[20px] font-bold text-[var(--color-accent-text)]"
            : "min-h-12 cursor-not-allowed self-start rounded-lg border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-[20px] font-bold text-[var(--color-ink)]"
        }
      >
        {SUBMIT_LABEL[recordType]}
      </button>

      {submitState.status === "success" && (
        <section
          role="status"
          aria-label="Add record result"
          className="flex items-start gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-[var(--color-ink)]"
        >
          <CheckCircle2 aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
          <p className="text-lg text-[var(--color-ink)]">
            Added 1 {submitState.noun}.
          </p>
        </section>
      )}

      {submitState.status === "error" && (
        <section
          role="alert"
          aria-label="Add record notice"
          className="flex items-start gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-lg text-[var(--color-ink)]"
        >
          <TriangleAlert aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-bold">
              Something went wrong saving that {submitState.noun}.
            </span>{" "}
            Nothing was added — please try again.
          </p>
        </section>
      )}
    </main>
  );
}
