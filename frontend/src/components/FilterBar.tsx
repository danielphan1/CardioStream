// Filter bar (DASH-07 UI half; D-17/D-19/D-20) — the exact interactive
// surface Phase 3 voice commands will mirror. Every control is a ≥48px,
// 20px-labeled, single-select button with aria-pressed state; the current
// filter state is always readable left-to-right as a sentence.
//
// All filter state lives in the zustand store (store/filters.ts) — this
// component only takes `latestReading` for the honest preset-anchor date
// (RESEARCH Open Question 1: presets anchor to the newest reading).
import { useEffect, useState } from "react";

import { useAgentPulse } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import { fmtLongDate, presetLabel } from "../lib/dates";
import type { DatePreset } from "../lib/dates";
import { categoryColor, CHIP_TEXT, CLINICAL_ORDER } from "../lib/palette";
import { useFilters } from "../store/filters";
import { DateRangePicker } from "./DateRangePicker";

type FilterBarProps = {
  latestReading: string | null;
};

// Shared control styling contract (UI-SPEC accent rules): inactive = sky
// card with ink text + 2px ink border; active = reserved navy accent fill.
const inactiveClass =
  "min-h-12 rounded-xl px-4 text-control font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-control font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";

const DAY_PRESETS: { key: Exclude<DatePreset, "custom">; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All" },
];

const AM_PM_OPTIONS: { value: "all" | "AM" | "PM"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

export function FilterBar({ latestReading }: FilterBarProps) {
  const datePreset = useFilters((s) => s.datePreset);
  const customRange = useFilters((s) => s.customRange);
  const amPm = useFilters((s) => s.amPm);
  const bpCategory = useFilters((s) => s.bpCategory);
  const setDatePreset = useFilters((s) => s.setDatePreset);
  const setCustomRange = useFilters((s) => s.setCustomRange);
  const setAmPm = useFilters((s) => s.setAmPm);
  const setBpCategory = useFilters((s) => s.setBpCategory);

  // "Custom…" opens a keyboard-friendly inline disclosure (not a popover —
  // no focus-trap complexity, D-18).
  const [customOpen, setCustomOpen] = useState(false);

  // D-08 pulse: when an agent command touches a filter group, the matching
  // control group flashes briefly so the agent and the manual controls read as
  // one system. `seq` bumps on every apply (even when the same fields repeat),
  // so this effect re-fires reliably. The animation is gated behind
  // `motion-safe:` — reduced-motion users get NO pulse — and a static
  // `ring-2` fallback keeps the change perceivable without motion.
  const pulseSeq = useAgentPulse((s) => s.seq);
  const pulseFields = useAgentPulse((s) => s.fields);
  const [pulsing, setPulsing] = useState<PulseField[]>([]);
  useEffect(() => {
    if (pulseSeq === 0) return; // no apply yet
    setPulsing(pulseFields);
    const t = setTimeout(() => setPulsing([]), 1500);
    return () => clearTimeout(t);
  }, [pulseSeq, pulseFields]);

  // Chart switches are intentionally NOT pulsed here — ChartDeck's keyed
  // mount-fade already signals agent-driven chart changes (CONTEXT).
  const pulseClass = (field: PulseField) =>
    pulsing.includes(field)
      ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
      : "";

  const isDayPreset =
    datePreset === "7d" || datePreset === "30d" || datePreset === "90d";

  // Filter-state sentence (D-20): reads left-to-right, always visible,
  // honest about the newest-reading anchor for day presets.
  const sentenceParts = [presetLabel(datePreset)];
  if (isDayPreset && latestReading !== null) {
    sentenceParts.push(`to ${fmtLongDate(latestReading)}`);
  }
  sentenceParts.push(amPm === "all" ? "All times" : amPm);
  sentenceParts.push(bpCategory === "all" ? "All categories" : bpCategory);
  const sentence = sentenceParts.join(" · ");

  return (
    <section className="bg-[var(--color-sky)] p-4">
      <div className="flex flex-wrap gap-4">
        {/* Date preset segmented row (D-17) */}
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

        {/* AM/PM segment (D-19) */}
        <div
          role="group"
          aria-label="Time of day"
          className={`flex flex-wrap gap-2${pulseClass("amPm")}`}
        >
          {AM_PM_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={amPm === value}
              onClick={() => setAmPm(value)}
              className={amPm === value ? activeClass : inactiveClass}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category chip row (D-19) — single-select toggle; clinical colors
            are information (D-14), so inactive chips stay solid-colored. */}
        <div
          role="group"
          aria-label="Blood pressure category"
          className={`flex flex-wrap gap-2${pulseClass("bpCategory")}`}
        >
          {CLINICAL_ORDER.map((cat) => {
            const isActive = bpCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  if (isActive) {
                    // Tapping the active chip again returns to all categories
                    setBpCategory("all");
                  } else {
                    setBpCategory(cat);
                  }
                }}
                className="min-h-12 rounded-full px-4 text-[20px] font-bold"
                style={{
                  backgroundColor: categoryColor(cat),
                  color: CHIP_TEXT,
                  // 3px ink ring on the active chip — box-shadow so the
                  // :focus-visible outline stays independently visible.
                  boxShadow: isActive
                    ? "0 0 0 3px var(--color-ink)"
                    : undefined,
                }}
              >
                {cat}
              </button>
            );
          })}
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
      <p aria-live="polite" className="mt-4 text-[18px] text-[var(--color-ink)]">
        {sentence}
      </p>
    </section>
  );
}
