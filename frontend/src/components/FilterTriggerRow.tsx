// FilterTriggerRow (16.1-07, UI-SPEC 5.3) — the two controls that replaced the
// 624px filter band: "Dates: {preset}" and "Filters" with a count badge. The
// filter system is now smaller than the chart it filters.
//
// THE AGENT PULSE IS CONSUMED HERE, and that placement is the requirement
// rather than a convenience. These triggers are always rendered; the popover
// contents are not. An agent-applied filter change with the popover CLOSED is
// the normal case, so a ring that lived inside the popover would signal
// nothing at the moment it matters most. Together with the always-visible
// state block below this row, that is the whole feedback channel for a
// voice-driven change (T-16.1-29).
//
// At ≥768px each trigger's anchored surface is rendered immediately after it,
// inside its own relative wrapper, which is what makes Tab flow trigger,
// contents, next control with nothing trapped. Below 768px the surfaces are
// full-viewport panels that App.tsx renders as siblings of <main> instead —
// they cannot live here, because <main> is inert while they are open.
import { CalendarDays, SlidersHorizontal } from "lucide-react";

import { useAgentPulseFlash } from "../lib/agent";
import type { PulseField } from "../lib/agent";
import { presetLabel } from "../lib/dates";
import { activeFilterCount } from "../lib/showSentence";
import { useFilters } from "../store/filters";
import { FilterSurface } from "./FilterSurface";

// The groups the Filters trigger speaks for. Date is absent on purpose — it
// owns the other trigger, which states its own state in words.
const FILTER_PULSE_FIELDS: PulseField[] = [
  "bpCategory",
  "pulseCategory",
  "timeOfDay",
  "datasets",
];

// Reused verbatim from FilterBar's own groups, so an agent-driven change reads
// as the same system wherever it lands.
const PULSE_RING =
  " ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse";

/** Open adds a 2px accent border and a 2px accent INNER ring while the fill
 *  stays mist: the accent is reserved for selection, and "open" is not a
 *  selection. Focus stays on the sitewide ring, untouched. */
const stateClass = (isOpen: boolean) =>
  isOpen
    ? "border-[var(--color-accent)] ring-2 ring-inset ring-[var(--color-accent)]"
    : "border-[var(--color-depth)]";

export function FilterTriggerRow({
  openOverlay,
  onOpen,
  onClose,
  isWide,
}: {
  /** The shell's single overlay state. Only "filters" and "dates" concern this
   *  row; "nav" and null both read as closed. */
  openOverlay: "nav" | "filters" | "dates" | null;
  /** Opens the named surface. */
  onOpen: (which: "filters" | "dates") => void;
  /** Closes whatever is open — also route (d), a second press on the trigger
   *  that opened it. */
  onClose: () => void;
  /** ≥768px. Picks the anchored presentation and, below it, suppresses these
   *  surfaces entirely so App.tsx can render the panels outside <main>. */
  isWide: boolean;
}) {
  const datePreset = useFilters((s) => s.datePreset);
  const timeOfDay = useFilters((s) => s.timeOfDay);
  const bpCategory = useFilters((s) => s.bpCategory);
  const pulseCategory = useFilters((s) => s.pulseCategory);
  const visibleDatasets = useFilters((s) => s.visibleDatasets);

  // Groups that differ from their shipped default, never individual ticks —
  // seven ticked chips still total 1. Both this badge and the trigger's
  // accessible name below derive from this ONE function, so they cannot
  // disagree about what is applied (T-16.1-32).
  const count = activeFilterCount({
    timeOfDay,
    bpCategory,
    pulseCategory,
    visibleDatasets,
  });

  const pulsing = useAgentPulseFlash();
  const datesPulse = pulsing.includes("dateRange") ? PULSE_RING : "";
  const filtersPulse = pulsing.some((field) =>
    FILTER_PULSE_FIELDS.includes(field),
  )
    ? PULSE_RING
    : "";

  const datesOpen = openOverlay === "dates";
  const filtersOpen = openOverlay === "filters";

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <button
          id="dates-trigger-button"
          type="button"
          aria-expanded={datesOpen}
          aria-controls="dates-popover"
          onClick={() => (datesOpen ? onClose() : onOpen("dates"))}
          className={`flex min-h-12 items-center gap-2 rounded-xl border-2 bg-[var(--color-mist)] px-4 text-label text-[var(--color-depth)] ${stateClass(
            datesOpen,
          )}${datesPulse}`}
        >
          <CalendarDays aria-hidden="true" size={24} />
          {`Dates: ${presetLabel(datePreset)}`}
        </button>
        {isWide && (
          <FilterSurface
            kind="dates"
            presentation="anchored"
            open={datesOpen}
            onClose={onClose}
          />
        )}
      </div>

      <div className="relative">
        {/* The count lives in the accessible name, so the badge itself is
            hidden from assistive tech — otherwise the number is announced
            twice. No badge at all at rest: there is no "0" state to read. */}
        <button
          id="filters-trigger-button"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="filters-popover"
          aria-label={
            count > 0 ? `Filters, ${count} applied` : "Filters, none applied"
          }
          onClick={() => (filtersOpen ? onClose() : onOpen("filters"))}
          className={`flex min-h-12 items-center gap-2 rounded-xl border-2 bg-[var(--color-mist)] px-4 text-label text-[var(--color-depth)] ${stateClass(
            filtersOpen,
          )}${filtersPulse}`}
        >
          <SlidersHorizontal aria-hidden="true" size={24} />
          Filters
          {count > 0 && (
            /* The one accent-filled text surface in the app below 20px/700,
               which is exactly why the accent token is held to the 4.5:1
               normal-text floor. Do not shrink it or lighten its weight. */
            <span
              aria-hidden="true"
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-base text-[var(--color-accent-text)]"
            >
              {count}
            </span>
          )}
        </button>
        {isWide && (
          <FilterSurface
            kind="filters"
            presentation="anchored"
            open={filtersOpen}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
