// Custom date range entry (D-18): oversized react-day-picker calendar
// (≥48px day cells) PLUS direct typed YYYY-MM-DD entry for keyboard users.
// All string↔Date conversion goes through parseDateOnly/formatDateParam —
// never the Date constructor on a date-only string (RESEARCH Pitfall 1:
// UTC-midnight parsing causes an off-by-one day in negative-offset zones).
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import { formatDateParam, isValidDateText, parseDateOnly } from "../lib/dates";

type DateRangePickerProps = {
  from: string | null;
  to: string | null;
  onApply: (from: string, to: string) => void;
};

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

export function DateRangePicker({ from, to, onApply }: DateRangePickerProps) {
  const [fromText, setFromText] = useState(from ?? "");
  const [toText, setToText] = useState(to ?? "");

  const fromValid = isValidDateText(fromText);
  const toValid = isValidDateText(toText);
  const fromError = fromText !== "" && !fromValid;
  const toError = toText !== "" && !toValid;
  const canApply = fromValid && toValid;

  const selected: DateRange | undefined = fromValid
    ? {
        from: parseDateOnly(fromText),
        to: toValid ? parseDateOnly(toText) : undefined,
      }
    : undefined;

  function handleSelect(range: DateRange | undefined) {
    if (range?.from) setFromText(formatDateParam(range.from));
    if (range?.to) setToText(formatDateParam(range.to));
  }

  function handleApply() {
    if (!canApply) return; // aria-disabled guard — never send invalid params
    onApply(fromText, toText);
  }

  const inputClass =
    "min-h-12 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-control font-bold text-[var(--color-ink)]">
          From
          <input
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={fromText}
            onChange={(e) => setFromText(e.target.value)}
            aria-invalid={fromError}
            className={inputClass}
          />
          {fromError && (
            <span role="alert" className="text-[18px] font-normal">
              Enter a date like 2025-06-13
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-control font-bold text-[var(--color-ink)]">
          To
          <input
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={toText}
            onChange={(e) => setToText(e.target.value)}
            aria-invalid={toError}
            className={inputClass}
          />
          {toError && (
            <span role="alert" className="text-[18px] font-normal">
              Enter a date like 2025-06-13
            </span>
          )}
        </label>
      </div>

      <div style={rdpSizing} className="text-[18px] text-[var(--color-ink)]">
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected?.from}
        />
      </div>

      <button
        type="button"
        onClick={handleApply}
        aria-disabled={!canApply}
        className={
          canApply
            ? "min-h-12 self-start rounded-xl bg-[var(--color-accent)] px-6 text-control font-bold text-[var(--color-accent-text)]"
            : "min-h-12 cursor-not-allowed self-start rounded-xl border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-sky)] px-6 text-control font-bold text-[var(--color-ink)]"
        }
      >
        Apply
      </button>
    </div>
  );
}
