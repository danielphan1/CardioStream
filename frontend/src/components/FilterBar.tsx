// Filter bar (DASH-07 UI half; D-17/D-19/D-20) — the exact interactive
// surface Phase 3 voice commands will mirror. Time of Day, BP Category, and
// Pulse Category are real multi-select checkboxes (Phase 15) — every group is
// ≥48px and 20px-labeled.
//
// The date machinery moved to DatesPanel.tsx in Phase 16.1 (plan 16.1-07): it
// owns its own trigger in the filter row, so the two surfaces are separate
// popover bodies rather than one 624px band.
//
// All filter state lives in the zustand store (store/filters.ts), so this
// component takes no props at all — which is what lets FilterSurface render
// it as a popover body with no wiring.
//
// THE D-20 STATE SENTENCE IS DELIBERATELY NOT HERE (16.1-UI-SPEC 5.4). It
// moved to FilterStateBlock.tsx, which the shell renders unconditionally in
// the content column, because the primary user cannot see a sentence inside a
// popover he has not opened. This file therefore carries no live region of
// its own: three regions across two components became exactly one. Do not
// reintroduce one here.
import { useAgentPulseFlash } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import { TIME_OF_DAY_ORDER } from "../lib/dates";
import {
  categoryColor,
  categoryTint,
  CLINICAL_ORDER,
  PULSE_CLINICAL_ORDER,
  pulseCategoryColor,
  pulseCategoryTint,
} from "../lib/palette";
import { useFilters } from "../store/filters";

// Plain checkbox control (Time of Day) — reused verbatim from
// ShowPanel.tsx's boxClass so the two surfaces share one control language.
const boxClass =
  "min-h-12 flex items-center gap-2 rounded-xl py-2 px-4 text-label " +
  "bg-[var(--color-mist)] text-[var(--color-depth)] " +
  "border border-[var(--color-hairline)] shadow-[var(--shadow-elevation)] cursor-pointer";

// Visible label prefix (UI-SPEC §3) — every group gets one now, mirroring
// ShowPanel.tsx's own "Show:" prefix span.
const headingClass = "text-label text-[var(--color-depth)]";

export function FilterBar() {
  const bpCategory = useFilters((s) => s.bpCategory);
  const pulseCategory = useFilters((s) => s.pulseCategory);
  const timeOfDay = useFilters((s) => s.timeOfDay);
  const toggleBpCategory = useFilters((s) => s.toggleBpCategory);
  const togglePulseCategory = useFilters((s) => s.togglePulseCategory);
  const toggleTimeOfDay = useFilters((s) => s.toggleTimeOfDay);

  const pulsing = useAgentPulseFlash();

  // Chart switches are intentionally NOT pulsed here — ChartDeck's keyed
  // mount-fade already signals agent-driven chart changes (CONTEXT).
  const pulseClass = (field: PulseField) =>
    pulsing.includes(field)
      ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
      : "";

  // No surface chrome of its own: FilterSurface supplies the mist fill, the
  // border and the padding. The groups stack in a column so each gets a full
  // row inside the 560px popover, which is also 5.5's reading order.
  return (
      <div className="flex flex-col gap-4">
        {/* Time of Day segment (Phase 15) — real multi-select checkboxes,
            replacing the old AM/PM single-select buttons; claims the
            "Time of day" aria-label the removed group used to own. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={headingClass}>Time of Day:</span>
          <div
            role="group"
            aria-label="Time of day"
            className={`flex flex-wrap gap-2${pulseClass("timeOfDay")}`}
          >
            {TIME_OF_DAY_ORDER.map((bucket) => (
              <label key={bucket} className={boxClass}>
                <input
                  type="checkbox"
                  checked={timeOfDay[bucket]}
                  onChange={() => toggleTimeOfDay(bucket, !timeOfDay[bucket])}
                  className="h-[26px] w-[26px] flex-none cursor-pointer accent-[var(--color-accent)]"
                />
                {bucket}
              </label>
            ))}
          </div>
        </div>

        {/* BP Category segment — real checkboxes (Phase 15), re-treated in
            Phase 16.1 per UI-SPEC section 4.4. Selection is carried by THREE
            simultaneous changes — a 12% tint of the category's own hue as
            fill, a 2px border in that same hue, and the native tick — plus a
            category dot present in BOTH states, so clinical identity (D-14)
            never disappears. The accent goes nowhere near these chips: a teal
            border on the green Normal chip is the exact combination the
            client rejected. The old 3px ink box-shadow ring is gone; it only
            existed because both states used to be solid clinical fills that
            could differ by colour alone, and dropping it leaves
            :focus-visible's outline as the only ring on the control. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={headingClass}>BP Category:</span>
          <div
            role="group"
            aria-label="Blood pressure category"
            className={`flex flex-wrap gap-2${pulseClass("bpCategory")}`}
          >
            {CLINICAL_ORDER.map((cat) => (
              <label
                key={cat}
                className="min-h-12 flex items-center gap-2 rounded-full border px-4 text-label text-[var(--color-depth)] cursor-pointer"
                style={{
                  backgroundColor: bpCategory[cat]
                    ? categoryTint(cat)
                    : "var(--color-deck)",
                  borderColor: bpCategory[cat]
                    ? categoryColor(cat)
                    : "var(--color-hairline)",
                }}
              >
                <input
                  type="checkbox"
                  checked={bpCategory[cat]}
                  onChange={() => toggleBpCategory(cat, !bpCategory[cat])}
                  className="h-[26px] w-[26px] flex-none cursor-pointer"
                  style={{ accentColor: "var(--color-depth)" }}
                />
                {/* 12px category dot — rendered in both rest and selected
                    states. Same markup as StatsStrip's legend dot so the two
                    surfaces cannot drift. */}
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor(cat) }}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        {/* Pulse Category segment (Phase 15, brand new) — structurally
            identical to BP Category, mapping over the pulse clinical order. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={headingClass}>Pulse Category:</span>
          <div
            role="group"
            aria-label="Pulse category"
            className={`flex flex-wrap gap-2${pulseClass("pulseCategory")}`}
          >
            {PULSE_CLINICAL_ORDER.map((cat) => (
              <label
                key={cat}
                className="min-h-12 flex items-center gap-2 rounded-full border px-4 text-label text-[var(--color-depth)] cursor-pointer"
                style={{
                  backgroundColor: pulseCategory[cat]
                    ? pulseCategoryTint(cat)
                    : "var(--color-deck)",
                  borderColor: pulseCategory[cat]
                    ? pulseCategoryColor(cat)
                    : "var(--color-hairline)",
                }}
              >
                <input
                  type="checkbox"
                  checked={pulseCategory[cat]}
                  onChange={() =>
                    togglePulseCategory(cat, !pulseCategory[cat])
                  }
                  className="h-[26px] w-[26px] flex-none cursor-pointer"
                  style={{ accentColor: "var(--color-depth)" }}
                />
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: pulseCategoryColor(cat) }}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
      </div>
  );
}
