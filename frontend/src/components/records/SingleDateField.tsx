// Standalone single-date input (D-07): oversized react-day-picker calendar
// (≥48px day cells) PLUS direct typed YYYY-MM-DD entry for keyboard users.
// Extracted from DateRangePicker.tsx's single-date half — not a wrapper
// around the range component. Validation reuses the one promoted
// isValidDateText from lib/dates.ts (never redefined here); the text field and
// the calendar sizing come from the one shared components/fields.tsx (this
// file used to carry a verbatim copy of DateRangePicker's rdpSizing).
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { formatDateParam, isValidDateText, parseDateOnly } from "../../lib/dates";
import { TextField } from "../fields";
import { rdpSizing } from "../rdpSizing";

type SingleDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function SingleDateField({ label, value, onChange }: SingleDateFieldProps) {
  const valid = isValidDateText(value);

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={label}
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        value={value}
        onChange={onChange}
        invalid={value !== "" && !valid}
      />

      <div style={rdpSizing} className="text-[18px] text-[var(--color-depth)]">
        <DayPicker
          mode="single"
          selected={valid ? parseDateOnly(value) : undefined}
          onSelect={(d) => d && onChange(formatDateParam(d))}
          defaultMonth={valid ? parseDateOnly(value) : undefined}
        />
      </div>
    </div>
  );
}
