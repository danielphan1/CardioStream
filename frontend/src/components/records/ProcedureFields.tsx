// Procedure field-set (Plan 08-02, OVERLAY-02). Identical structure/contract
// to LabFields.tsx, scoped to Procedure's simpler field set (no numeric
// guard needed). Owns its own local input state; reports the ready-to-POST
// ProcedureCreate body (or null) up to whichever parent mounts it via
// onDraftChange, per the locked field-set prop contract
// (08-02-PLAN.md <interface_contract>).
import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";

import { isValidDateText } from "../../lib/dates";
import type { ProcedureCreate } from "../../api/types";
import { SingleDateField } from "./SingleDateField";

type ProcedureFieldsProps = {
  onDraftChange: (body: ProcedureCreate | null) => void;
};

const inputClass =
  "min-h-12 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";
const labelClass = "flex flex-col gap-1 text-control font-bold text-[var(--color-ink)]";

export function ProcedureFields({ onDraftChange }: ProcedureFieldsProps) {
  const [dateText, setDateText] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [location, setLocation] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");

  const dateValid = isValidDateText(dateText);
  const procedureNameValid = procedureName.trim() !== "";
  const canSubmit = dateValid && procedureNameValid;

  useEffect(() => {
    // Conditional spread, not `key: undefined` — an object literal with an
    // explicit `undefined` value still lists that key in Object.keys(), even
    // though JSON.stringify would drop it on the wire. The field-set contract
    // requires the key itself be absent for an empty optional field.
    const body: ProcedureCreate = {
      date: dateText,
      procedure_name: procedureName.trim(),
      ...(location.trim() !== "" ? { location: location.trim() } : {}),
      ...(outcome.trim() !== "" ? { outcome: outcome.trim() } : {}),
      ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
    };
    onDraftChange(canSubmit ? body : null);
  }, [dateText, procedureName, location, outcome, notes, onDraftChange]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-[20px] font-bold text-[var(--color-ink)]">
        <Stethoscope aria-hidden="true" size={24} />
        Procedure details
      </h3>

      <SingleDateField label="Date" value={dateText} onChange={setDateText} />

      <label className={labelClass}>
        Procedure name
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. MRI, Catheter change"
          value={procedureName}
          onChange={(e) => setProcedureName(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Location
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. City Hospital"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Outcome
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. Completed without complications"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Notes
        <textarea
          maxLength={1000}
          placeholder="Optional notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass + " min-h-24 py-2"}
        />
      </label>
    </div>
  );
}
