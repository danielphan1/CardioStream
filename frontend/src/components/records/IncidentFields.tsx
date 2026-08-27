// Incident field-set (Plan 08-02, OVERLAY-02). Owns its own local input
// state; reports the ready-to-POST IncidentCreate body (or null) up to
// whichever parent mounts it via onDraftChange, per the locked field-set
// prop contract (08-02-PLAN.md <interface_contract>).
//
// Pitfall 4 (RESEARCH.md): the native <input type="time"> needs no extra
// format validation — its .value is browser-guaranteed to be either "" or
// well-formed "HH:MM" — but IS still required-checked (presence-only:
// timeText !== "").
//
// Pitfall 5 (RESEARCH.md): the combined datetime string is built via
// combineLocalDateTime (literal `${date}T${time}:00`) — never a
// Date-object ISO conversion, which would append `Z`/UTC-convert and
// violate DATA-05's naive-local-everywhere contract.
import { useEffect, useState } from "react";
import { Siren } from "lucide-react";

import { combineLocalDateTime, isValidDateText } from "../../lib/dates";
import type { IncidentCreate } from "../../api/types";
import { SingleDateField } from "./SingleDateField";

type IncidentFieldsProps = {
  onDraftChange: (body: IncidentCreate | null) => void;
};

const inputClass =
  "min-h-12 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";
const labelClass = "flex flex-col gap-1 text-control font-bold text-[var(--color-ink)]";

export function IncidentFields({ onDraftChange }: IncidentFieldsProps) {
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  const dateValid = isValidDateText(dateText);
  const timeValid = timeText !== "";
  const incidentTypeValid = incidentType.trim() !== "";
  const canSubmit = dateValid && timeValid && incidentTypeValid;

  useEffect(() => {
    // Only pass the body to onDraftChange when canSubmit is true — calling
    // combineLocalDateTime with an incomplete dateText/timeText is harmless
    // as long as the result is discarded (never let an incomplete combined
    // string reach onDraftChange as non-null).
    if (!canSubmit) {
      onDraftChange(null);
      return;
    }
    // Conditional spread, not `key: undefined` — an object literal with an
    // explicit `undefined` value still lists that key in Object.keys(), even
    // though JSON.stringify would drop it on the wire. The field-set contract
    // requires the key itself be absent for an empty optional field.
    const body: IncidentCreate = {
      datetime: combineLocalDateTime(dateText, timeText),
      incident_type: incidentType.trim(),
      ...(duration.trim() !== "" ? { duration: duration.trim() } : {}),
      ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
    };
    onDraftChange(body);
  }, [dateText, timeText, incidentType, duration, notes, onDraftChange]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-[20px] font-bold text-[var(--color-ink)]">
        <Siren aria-hidden="true" size={24} />
        Incident details
      </h3>

      <SingleDateField label="Date" value={dateText} onChange={setDateText} />

      <label className={labelClass}>
        Time
        <input
          type="time"
          value={timeText}
          onChange={(e) => setTimeText(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        What happened
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. Fall, Hospitalization, Seizure"
          value={incidentType}
          onChange={(e) => setIncidentType(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Duration
        <input
          type="text"
          maxLength={100}
          placeholder="e.g. 2 hours, 3 days"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
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
