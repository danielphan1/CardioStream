// Lab result field-set (Plan 08-02, OVERLAY-02). Owns its own local input
// state; reports the ready-to-POST LabResultCreate body (or null) up to
// whichever parent mounts it via onDraftChange, per the locked field-set
// prop contract (08-02-PLAN.md <interface_contract>).
//
// Pitfall 3 guard (RESEARCH.md): result/range_low/range_high are optional
// numeric fields. A non-empty-but-non-numeric value must block Submit
// entirely (canSubmit = false), not silently coerce to null via
// JSON.stringify(NaN) === "null".
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

import { isValidDateText } from "../../lib/dates";
import type { LabResultCreate } from "../../api/types";
import { SingleDateField } from "./SingleDateField";

type LabFieldsProps = {
  onDraftChange: (body: LabResultCreate | null) => void;
};

const inputClass =
  "min-h-12 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";
const labelClass = "flex flex-col gap-1 text-control font-bold text-[var(--color-ink)]";

/** Empty (or whitespace-only) string is valid (field untouched/optional); otherwise must parse
 * as a finite number (Pitfall 3 guard — never let a non-empty-but-non-numeric value silently
 * become null). Trimmed first: `Number("   ")` is `0`, a finite number, so an untrimmed check
 * would treat whitespace-only input as valid and silently write a fabricated 0. */
function numericFieldValid(text: string): boolean {
  const t = text.trim();
  return t === "" || Number.isFinite(Number(t));
}

export function LabFields({ onDraftChange }: LabFieldsProps) {
  const [dateText, setDateText] = useState("");
  const [testName, setTestName] = useState("");
  const [resultText, setResultText] = useState("");
  const [unit, setUnit] = useState("");
  const [rangeLowText, setRangeLowText] = useState("");
  const [rangeHighText, setRangeHighText] = useState("");
  const [notes, setNotes] = useState("");

  const dateValid = isValidDateText(dateText);
  const testNameValid = testName.trim() !== "";
  const canSubmit =
    dateValid &&
    testNameValid &&
    numericFieldValid(resultText) &&
    numericFieldValid(rangeLowText) &&
    numericFieldValid(rangeHighText);

  useEffect(() => {
    // Conditional spread, not `key: undefined` — an object literal with an
    // explicit `undefined` value still lists that key in Object.keys(), even
    // though JSON.stringify would drop it on the wire. The field-set contract
    // requires the key itself be absent for an empty optional field.
    const body: LabResultCreate = {
      date: dateText,
      test_name: testName.trim(),
      ...(resultText.trim() !== "" ? { result: Number(resultText.trim()) } : {}),
      ...(unit.trim() !== "" ? { unit: unit.trim() } : {}),
      ...(rangeLowText.trim() !== "" ? { range_low: Number(rangeLowText.trim()) } : {}),
      ...(rangeHighText.trim() !== "" ? { range_high: Number(rangeHighText.trim()) } : {}),
      ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
    };
    onDraftChange(canSubmit ? body : null);
  }, [dateText, testName, resultText, unit, rangeLowText, rangeHighText, notes, onDraftChange]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-[20px] font-bold text-[var(--color-ink)]">
        <FlaskConical aria-hidden="true" size={24} />
        Lab result details
      </h3>

      <SingleDateField label="Date" value={dateText} onChange={setDateText} />

      <label className={labelClass}>
        Test name
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. A1C, Cholesterol panel"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Result
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 5.4"
          value={resultText}
          onChange={(e) => setResultText(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Unit
        <input
          type="text"
          maxLength={20}
          placeholder="e.g. mg/dL"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Normal range — low
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 4.0"
          value={rangeLowText}
          onChange={(e) => setRangeLowText(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Normal range — high
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 6.0"
          value={rangeHighText}
          onChange={(e) => setRangeHighText(e.target.value)}
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
