// Filter bar (DASH-07 UI half; D-17/D-19/D-20) — the exact interactive
// surface Phase 3 voice commands will mirror. Date stays single-select
// exclusive buttons; Time of Day, BP Category, and Pulse Category are real
// multi-select checkboxes (Phase 15) — every group is ≥48px, 20px-labeled,
// and the current filter state is always readable left-to-right as a
// sentence.
//
// All filter state lives in the zustand store (store/filters.ts) — this
// component only takes `latestReading` for the honest preset-anchor date
// (RESEARCH Open Question 1: presets anchor to the newest reading).
import { useState } from "react";

import { useAgentPulseFlash } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import {
  fmtLongDate,
  presetLabel,
  selectedOrAll,
  TIME_OF_DAY_ORDER,
} from "../lib/dates";
import type { DatePreset } from "../lib/dates";
import {
  categoryColor,
  CHIP_TEXT,
  CLINICAL_ORDER,
  PULSE_CLINICAL_ORDER,
  pulseCategoryColor,
} from "../lib/palette";
import { joinWithAnd } from "../lib/showSentence";
import { useFilters } from "../store/filters";
import { DateRangePicker } from "./DateRangePicker";

type FilterBarProps = {
  latestReading: string | null;
};

// Shared control styling contract (13-UI-SPEC.md accent rules): inactive =
// mist card with depth text + 2px depth border; active = brass accent fill.
const inactiveClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-mist)] text-[var(--color-depth)] border-2 border-[var(--color-depth)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-brass)] text-[var(--color-brass-text)] border-2 border-[var(--color-brass)]";

// Plain checkbox control (Time of Day) — reused verbatim from
// ShowPanel.tsx's boxClass so the two surfaces share one control language.
const boxClass =
  "min-h-12 flex items-center gap-3 rounded-xl py-2 pl-3.5 pr-4 text-label " +
  "bg-[var(--color-mist)] text-[var(--color-depth)] " +
  "border-2 border-[var(--color-depth)] shadow-[var(--shadow-elevation)] cursor-pointer";

// Visible label prefix (UI-SPEC §3) — every group gets one now, mirroring
// ShowPanel.tsx's own "Show:" prefix span.
const headingClass = "text-label text-[var(--color-depth)]";

const DAY_PRESETS: { key: Exclude<DatePreset, "custom">; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All" },
];

export function FilterBar({ latestReading }: FilterBarProps) {
  const datePreset = useFilters((s) => s.datePreset);
  const customRange = useFilters((s) => s.customRange);
  const bpCategory = useFilters((s) => s.bpCategory);
  const pulseCategory = useFilters((s) => s.pulseCategory);
  const timeOfDay = useFilters((s) => s.timeOfDay);
  const setDatePreset = useFilters((s) => s.setDatePreset);
  const setCustomRange = useFilters((s) => s.setCustomRange);
  const toggleBpCategory = useFilters((s) => s.toggleBpCategory);
  const togglePulseCategory = useFilters((s) => s.togglePulseCategory);
  const toggleTimeOfDay = useFilters((s) => s.toggleTimeOfDay);

  // "Custom…" opens a keyboard-friendly inline disclosure (not a popover —
  // no focus-trap complexity, D-18).
  const [customOpen, setCustomOpen] = useState(false);

  const pulsing = useAgentPulseFlash();

  // Chart switches are intentionally NOT pulsed here — ChartDeck's keyed
  // mount-fade already signals agent-driven chart changes (CONTEXT).
  const pulseClass = (field: PulseField) =>
    pulsing.includes(field)
      ? " rounded-lg ring-2 ring-[var(--color-brass)] motion-safe:animate-pulse"
      : "";

  const isDayPreset =
    datePreset === "7d" || datePreset === "30d" || datePreset === "90d";

  // Filter-state sentence (D-20): reads left-to-right, always visible,
  // honest about the newest-reading anchor for day presets. Each group
  // collapses to "All …" under the zero-or-all convention; a strict subset
  // joins with joinWithAnd (no Oxford comma — spoken text).
  const sentenceParts = [presetLabel(datePreset)];
  if (isDayPreset && latestReading !== null) {
    sentenceParts.push(`to ${fmtLongDate(latestReading)}`);
  }
  const timeOfDaySegment = selectedOrAll(timeOfDay, "All times of day");
  sentenceParts.push(
    Array.isArray(timeOfDaySegment)
      ? joinWithAnd(timeOfDaySegment)
      : timeOfDaySegment,
  );
  const bpCategorySegment = selectedOrAll(bpCategory, "All categories");
  sentenceParts.push(
    Array.isArray(bpCategorySegment)
      ? joinWithAnd(bpCategorySegment)
      : bpCategorySegment,
  );
  const pulseCategorySegment = selectedOrAll(
    pulseCategory,
    "All pulse categories",
  );
  sentenceParts.push(
    Array.isArray(pulseCategorySegment)
      ? joinWithAnd(pulseCategorySegment)
      : pulseCategorySegment,
  );
  const sentence = sentenceParts.join(" · ");

  return (
    <section className="bg-[var(--color-mist)] p-4">
      <div className="flex flex-wrap gap-4">
        {/* Date preset segmented row (D-17) — unchanged button markup, new
            visible heading prefix (UI-SPEC §3). */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={headingClass}>Date:</span>
          <div
            role="group"
            aria-label="Date range"
            className={`flex flex-wrap gap-2${pulseClass("dateRange")}`}
          >
            {DAY_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={datePreset === key}
                onClick={() => {
                  setDatePreset(key);
                  setCustomOpen(false);
                }}
                className={datePreset === key ? activeClass : inactiveClass}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={datePreset === "custom"}
              aria-expanded={customOpen}
              onClick={() => setCustomOpen((open) => !open)}
              className={datePreset === "custom" ? activeClass : inactiveClass}
            >
              Custom…
            </button>
          </div>
        </div>

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
                  className="h-[26px] w-[26px] flex-none cursor-pointer accent-[var(--color-brass)]"
                />
                {bucket}
              </label>
            ))}
          </div>
        </div>

        {/* BP Category segment — converted from aria-pressed buttons to real
            checkboxes (Phase 15); clinical colors stay solid regardless of
            checked state (D-14) — the checked ring is a second, non-color
            signal alongside the native tick. */}
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
                className="min-h-12 flex items-center gap-2 rounded-full px-4 text-label cursor-pointer"
                style={{
                  backgroundColor: categoryColor(cat),
                  color: CHIP_TEXT,
                  // 3px ink ring on the checked chip — box-shadow so the
                  // :focus-visible outline stays independently visible.
                  boxShadow: bpCategory[cat]
                    ? "0 0 0 3px var(--color-depth)"
                    : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={bpCategory[cat]}
                  onChange={() => toggleBpCategory(cat, !bpCategory[cat])}
                  className="h-[26px] w-[26px] flex-none cursor-pointer"
                  style={{ accentColor: CHIP_TEXT }}
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
                className="min-h-12 flex items-center gap-2 rounded-full px-4 text-label cursor-pointer"
                style={{
                  backgroundColor: pulseCategoryColor(cat),
                  color: CHIP_TEXT,
                  boxShadow: pulseCategory[cat]
                    ? "0 0 0 3px var(--color-depth)"
                    : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={pulseCategory[cat]}
                  onChange={() =>
                    togglePulseCategory(cat, !pulseCategory[cat])
                  }
                  className="h-[26px] w-[26px] flex-none cursor-pointer"
                  style={{ accentColor: CHIP_TEXT }}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Custom range disclosure — inline expanding section, not a popover.
          Part of the "dateRange" group, so it pulses with the presets (D-08). */}
      {customOpen && (
        <div className={`mt-4${pulseClass("dateRange")}`}>
          <DateRangePicker
            from={customRange.from}
            to={customRange.to}
            onApply={setCustomRange}
          />
        </div>
      )}

      {/* Filter-state sentence (D-20) — announced politely on change */}
      <p aria-live="polite" className="mt-4 text-[18px] text-[var(--color-depth)]">
        {sentence}
      </p>
    </section>
  );
}
