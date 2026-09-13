// Custom date range entry (D-18): oversized react-day-picker calendar
// (≥48px day cells) PLUS direct typed YYYY-MM-DD entry for keyboard users.
// All string↔Date conversion goes through parseDateOnly/formatDateParam —
// never the Date constructor on a date-only string (RESEARCH Pitfall 1:
// UTC-midnight parsing causes an off-by-one day in negative-offset zones).
import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import { formatDateParam, isValidDateText, parseDateOnly } from "../lib/dates";
import { TextField } from "./fields";
import { rdpSizing } from "./rdpSizing";

type DateRangePickerProps = {
  from: string | null;
  to: string | null;
  onApply: (from: string, to: string) => void;
};

const DATE_ERROR_COPY = "Enter a date like 2025-06-13";

export function DateRangePicker({ from, to, onApply }: DateRangePickerProps) {
  const [fromText, setFromText] = useState(from ?? "");
  const [toText, setToText] = useState(to ?? "");

  // Entrance fade (impeccable animate survey gap #3): FilterBar's
  // `{customOpen && <DateRangePicker .../>}` conditional always mounts a
  // fresh instance, so `shown` starts false on every open with no key or
  // reset effect needed. Double rAF mirrors ChartDeck.tsx's `FadeSwap` —
  // guarantees the initial opacity-0 paints before the toggle to
  // opacity-100 so the transition actually runs. No exit animation: the
  // panel unmounts instantly on close, unchanged from before this fix.
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

  return (
    <div
      className={`flex flex-col gap-4 transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex flex-wrap gap-4">
        <TextField
          label="From"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          value={fromText}
          onChange={setFromText}
          invalid={fromError}
          error={fromError ? DATE_ERROR_COPY : undefined}
        />
        <TextField
          label="To"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          value={toText}
          onChange={setToText}
          invalid={toError}
          error={toError ? DATE_ERROR_COPY : undefined}
        />
      </div>

      <div style={rdpSizing} className="text-[18px] text-[var(--color-depth)]">
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
            ? "min-h-12 self-start rounded-xl bg-[var(--color-brass)] px-6 text-label text-[var(--color-brass-text)]"
            : "min-h-12 cursor-not-allowed self-start rounded-xl border-2 border-dashed border-[var(--color-depth)] bg-[var(--color-mist)] px-6 text-label text-[var(--color-depth)]"
        }
      >
        Apply
      </button>
    </div>
  );
}
