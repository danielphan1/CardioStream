// Dates panel (16.1-07, UI-SPEC 5.3/5.5) — the date-preset segmented group
// plus the custom-range disclosure, lifted out of FilterBar.tsx so the Dates
// trigger has a body to open. Markup, aria wiring, class strings and pulse
// treatment are verbatim: this is a relocation, not a rewrite, which is also
// what keeps the existing group behaviour intact.
//
// It reads its own slice of the filter store rather than taking props — that
// is what lets FilterSurface render it with no wiring of its own.
//
// The class constants below are copied rather than imported from FilterBar:
// four short string literals beat a cross-import between two sibling popover
// bodies.
import { useState } from "react";

import { useAgentPulseFlash } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import type { DatePreset } from "../lib/dates";
import { useFilters } from "../store/filters";
import { DateRangePicker } from "./DateRangePicker";

// Shared control styling contract (13-UI-SPEC.md accent rules): inactive =
// mist card with depth text plus a 2px depth border; active = accent fill.
const inactiveClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-mist)] text-[var(--color-depth)] border border-[var(--color-hairline)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-label bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";

// Visible label prefix (UI-SPEC 3) — mirrors ShowPanel.tsx's own "Show:" span.
const headingClass = "text-label text-[var(--color-depth)]";

const DAY_PRESETS: { key: Exclude<DatePreset, "custom">; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All" },
];

export function DatesPanel() {
  const datePreset = useFilters((s) => s.datePreset);
  const customRange = useFilters((s) => s.customRange);
  const setDatePreset = useFilters((s) => s.setDatePreset);
  const setCustomRange = useFilters((s) => s.setCustomRange);

  // The custom option opens a keyboard-friendly inline disclosure (not a
  // popover of its own — no focus-trap complexity, D-18).
  const [customOpen, setCustomOpen] = useState(false);

  const pulsing = useAgentPulseFlash();

  const pulseClass = (field: PulseField) =>
    pulsing.includes(field)
      ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
      : "";

  return (
    <div>
      {/* Date preset segmented row (D-17) — unchanged button markup and
          unchanged visible heading prefix (UI-SPEC 3). */}
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

      {/* The typed-range disclosure — an inline expanding section, not a
          popover. Part of the "dateRange" group, so it pulses with the
          presets (D-08). Its Apply button keeps its accent fill: it is the one
          real commit action in the app, and UI-SPEC 5.5 leaves it alone. */}
      {customOpen && (
        <div className={`mt-4${pulseClass("dateRange")}`}>
          <DateRangePicker
            from={customRange.from}
            to={customRange.to}
            onApply={setCustomRange}
          />
        </div>
      )}
    </div>
  );
}
