// Shared form-field primitives: the label+input styling and the label+input
// primitive itself, used by the three record field-sets (records/LabFields,
// records/IncidentFields, records/ProcedureFields), records/SingleDateField
// and DateRangePicker.
//
// Lives in components/ rather than components/records/ because DateRangePicker
// is a dashboard control, not a record field-set — a shared home has to sit
// above both.
//
// The label↔control association is IMPLICIT, via the wrapping <label>. There
// is deliberately no id/htmlFor mechanism: every test here queries by
// accessible name, and adding ids would change how that name is computed.
//
// Module-private on purpose: every consumer now goes through TextField, so
// these two class strings have no callers outside this file. The calendar's
// rdpSizing lives in its own module (a file exporting both a component and a
// non-component breaks Fast Refresh).

/** Text-input styling at the accessibility floor (≥48px target, 18px text).
 *  One definition — this literal was previously copied into five components. */
const inputClass =
  "min-h-12 rounded-xl border-2 border-[var(--color-depth)] bg-[var(--color-deck)] px-3 text-[18px] text-[var(--color-depth)]";

/** Stacked label wrapper — the label text sits above its own control. */
const labelClass = "flex flex-col gap-1 text-label text-[var(--color-depth)]";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Only IncidentFields' Time field needs anything but "text". */
  type?: "text" | "time";
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
  maxLength?: number;
  /** Renders a <textarea> instead of an <input> — the three Notes fields. */
  multiline?: boolean;
  /** Drives aria-invalid. Omit entirely to leave the attribute off, which is
   *  what the fields that have no validity state already do. */
  invalid?: boolean;
  /** Inline validation message, rendered inside the <label> as role="alert". */
  error?: string;
};

/** Label + control, the exact shape every typed field in this app already had. */
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
  maxLength,
  multiline,
  invalid,
  error,
}: TextFieldProps) {
  return (
    <label className={labelClass}>
      {label}
      {multiline ? (
        <textarea
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className={inputClass + " min-h-24 py-2"}
        />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className={inputClass}
        />
      )}
      {error && (
        <span role="alert" className="text-[18px] font-normal">
          {error}
        </span>
      )}
    </label>
  );
}
