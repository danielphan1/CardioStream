// Standalone single-date input (D-07): oversized react-day-picker calendar
// (≥48px day cells) PLUS direct typed YYYY-MM-DD entry for keyboard users.
// Extracted from DateRangePicker.tsx's single-date half — not a wrapper
// around the range component. Validation reuses the one promoted
// isValidDateText from lib/dates.ts (never redefined here).
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { formatDateParam, isValidDateText, parseDateOnly } from "../../lib/dates";

type SingleDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

// v9 CSS custom properties — day cells at the 48px target floor, selected-day
// styling on the accent tokens (theme-aware via index.css). Duplicated
// verbatim from DateRangePicker.tsx (plain literal, not logic that can drift).
const rdpSizing = {
  "--rdp-day-width": "48px",
  "--rdp-day-height": "48px",
  "--rdp-day_button-width": "48px",
  "--rdp-day_button-height": "48px",
  "--rdp-accent-color": "var(--color-accent)",
  "--rdp-accent-background-color": "var(--color-sky)",
} as React.CSSProperties;

const inputClass =
  "min-h-12 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";

export function SingleDateField({ label, value, onChange }: SingleDateFieldProps) {
  const valid = isValidDateText(value);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-[20px] font-bold text-[var(--color-ink)]">
        {label}
        <input
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={value !== "" && !valid}
          className={inputClass}
        />
      </label>

      <div style={rdpSizing} className="text-[18px] text-[var(--color-ink)]">
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
