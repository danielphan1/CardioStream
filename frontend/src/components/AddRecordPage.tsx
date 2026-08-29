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
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  "min-h-12 rounded-xl px-4 text-control bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-control bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";

/**
 * Mount-fade wrapper mirroring ChartDeck.tsx's own `FadeSwap` (same
 * double-rAF `shown` state + 250ms opacity/scale transition, motion-reduce
 * gated). Kept LOCAL to this file rather than imported/shared — see this
 * quick task's plan for why. Unlike ChartDeck's version, this wrapper drops
 * the `h-full w-full` sizing classes: AddRecordPage's field-set block is a
 * natural-height form section, not a fixed-size chart slot.
 */
function FadeSwap({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <div
      className={`transition-[opacity,transform] duration-[250ms] ease-in-out motion-reduce:transition-none ${
        shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

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

  // Guards against CR-01's async race: a mutation resolving after the user
  // has switched record type (or the user double-submitting) must not
  // clobber whatever is now mounted. isSubmitting blocks type switches while
  // a request is in flight, and each onSuccess/onError below re-checks the
  // snapshotted submittedType before touching shared state.
  const isSubmitting =
    createLab.isPending || createIncident.isPending || createProcedure.isPending;

  function handleTypeChange(next: RecordType) {
    if (isSubmitting) return; // don't allow switching mid-flight
    setRecordType(next);
    setDraftBody(null);
    setSubmitState({ status: "idle" });
  }

  function handleSubmit() {
    // aria-disabled does not prevent a click handler from firing (mirrors
    // DateRangePicker.tsx's handleApply discipline) — the guard must live
    // here, not just in the disabled className/attribute.
    if (draftBody === null || isSubmitting) return;
    const noun = NOUN[recordType];
    // Snapshot the type being submitted so the async callbacks below can
    // detect staleness if the user has since moved to a different record
    // type (e.g. by a future relaxation of the isSubmitting guard).
    const submittedType = recordType;
    if (recordType === "lab") {
      createLab.mutate(draftBody as LabResultCreate, {
        onSuccess: () => {
          if (submittedType !== recordType) return;
          setSubmitState({ status: "success", noun });
          setDraftBody(null);
          setResetSeq((n) => n + 1);
        },
        onError: () => {
          if (submittedType !== recordType) return;
          setSubmitState({ status: "error", noun });
        },
      });
    } else if (recordType === "incident") {
      createIncident.mutate(draftBody as IncidentCreate, {
        onSuccess: () => {
          if (submittedType !== recordType) return;
          setSubmitState({ status: "success", noun });
          setDraftBody(null);
          setResetSeq((n) => n + 1);
        },
        onError: () => {
          if (submittedType !== recordType) return;
          setSubmitState({ status: "error", noun });
        },
      });
    } else {
      createProcedure.mutate(draftBody as ProcedureCreate, {
        onSuccess: () => {
          if (submittedType !== recordType) return;
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
  }

  const canSubmit = draftBody !== null && !isSubmitting;

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-8 bg-[var(--color-foam)] px-4 py-8 md:px-8 xl:px-16">
      <div className="flex flex-col gap-4">
        <h2 className="text-h2 leading-tight text-[var(--color-ink)]">
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
            aria-disabled={isSubmitting}
            onClick={() => handleTypeChange(key)}
            className={
              (recordType === key ? activeClass : inactiveClass) +
              (isSubmitting ? " cursor-not-allowed opacity-60" : "")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div key={fieldsKey}>
        <FadeSwap>
          {recordType === "lab" && (
            <LabFields onDraftChange={setDraftBody} />
          )}
          {recordType === "incident" && (
            <IncidentFields onDraftChange={setDraftBody} />
          )}
          {recordType === "procedure" && (
            <ProcedureFields onDraftChange={setDraftBody} />
          )}
        </FadeSwap>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        aria-disabled={!canSubmit}
        aria-busy={isSubmitting}
        className={
          canSubmit
            ? "min-h-12 self-start rounded-xl bg-[var(--color-accent)] px-6 text-control text-[var(--color-accent-text)]"
            : "min-h-12 cursor-not-allowed self-start rounded-xl border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-control text-[var(--color-ink)]"
        }
      >
        {isSubmitting ? "Saving…" : SUBMIT_LABEL[recordType]}
      </button>

      {submitState.status === "success" && (
        <section
          role="status"
          aria-label="Add record result"
          className="flex items-start gap-2 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-[var(--color-ink)] shadow-[var(--shadow-elevation)]"
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
          className="flex items-start gap-2 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-lg text-[var(--color-ink)] shadow-[var(--shadow-elevation)]"
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
