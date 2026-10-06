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

/** Open recolours the 1px border to the accent and adds a 2px accent INNER
 *  ring while the fill stays mist: the accent is reserved for selection, and
 *  "open" is not a selection. The ring, not the border width, is what carries
 *  the weight now that idle boundaries are 1px hairlines (quick 261003-hev).
 *  Focus stays on the sitewide ring, untouched.
 *
 *  That recolour no longer SNAPS, and nothing in this file says so:
 *  `.press-swell` (index.css) carries a --dur-state ease on colour,
 *  background-color, border-color and box-shadow, and box-shadow is what
 *  Tailwind's `ring-*` compiles to. A Tailwind easing utility added here
 *  would be DEAD CODE — that class is unlayered, so its `transition`
 *  shorthand beats any such utility on the same element. Both triggers
 *  already carry `press-swell`, so both already ease their open state. */
const stateClass = (isOpen: boolean) =>
  isOpen
    ? "border-[var(--color-accent)] ring-2 ring-inset ring-[var(--color-accent)]"
    : "border-[var(--color-hairline)]";

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
          className={`press-swell flex min-h-12 items-center gap-2 rounded-xl border bg-[var(--color-mist)] px-4 text-label text-[var(--color-depth)] ${stateClass(
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
          className={`press-swell flex min-h-12 items-center gap-2 rounded-xl border bg-[var(--color-mist)] px-4 text-label text-[var(--color-depth)] ${stateClass(
            filtersOpen,
          )}${filtersPulse}`}
        >
          <SlidersHorizontal aria-hidden="true" size={24} />
          Filters
          {count > 0 && (
            /* The one accent-filled text surface in the app below 20px/700,
               which is exactly why the accent token is held to the 4.5:1
               normal-text floor. Do not shrink it or lighten its weight. */
            /* The badge SETTLES IN rather than appearing, so a filter landing
               by voice is visible as well as announced — the primary user is
               often looking at the trigger when the agent changes something
               behind it. `key={count}` is what makes the animation replay on
               every count change instead of only on the 0-to-1 mount: a new
               key is a new element, and a new element runs its animation from
               the start. The badge stays aria-hidden and the count stays in
               the trigger's accessible name, so the number is never announced
               twice. */
            <span
              key={count}
              aria-hidden="true"
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-base text-[var(--color-accent-text)] motion-safe:animate-[count-settle_var(--dur-state)_var(--ease-swell)]"
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
