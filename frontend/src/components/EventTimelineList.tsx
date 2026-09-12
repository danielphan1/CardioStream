// Events-only view (Phase 14, D-05) — what the timeline slot renders when no
// vitals series is checked.
//
// This is the literal answer to the client's "versus the hospital stays": with
// no lines to plot, a chart would be an axis with nothing on it, which reads as
// broken. A dated list is the honest rendering of the same selection.
//
// Deliberately NOT interactive — clicking an event for full detail is
// OVERLAY-07, still a v2 item.
import type { OverlayDataset } from "../api/types";
import type { OverlayEvent } from "../lib/overlayEvents";
import { buildEmptyMessage } from "../lib/overlayEvents";
import { OVERLAY_META } from "../lib/overlayMeta";

type EventTimelineListProps = {
  events: OverlayEvent[];
  enabledTypes: OverlayDataset[];
};

export function EventTimelineList({
  events,
  enabledTypes,
}: EventTimelineListProps) {
  if (events.length === 0) {
    return (
      <section
        aria-label="Events by date"
        className="rounded-xl bg-[var(--color-mist)] p-6 shadow-[var(--shadow-elevation)]"
      >
        <p className="text-[18px] text-[var(--color-depth)]">
          {enabledTypes.length > 0
            ? buildEmptyMessage(enabledTypes)
            : "Nothing selected — pick a dataset to see it."}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Events by date"
      className="rounded-xl bg-[var(--color-mist)] p-6 shadow-[var(--shadow-elevation)]"
    >
      <ul className="flex flex-col">
        {events.map((evt) => {
          const { glyph, color, tableLabel } = OVERLAY_META[evt.type];
          return (
            <li
              key={`${evt.type}-${evt.id}`}
              // Stacks below 640px rather than crushing four columns onto a
              // phone — the same reflow ReadingsTable took in 260827-2v2.
              className="flex min-h-12 flex-col gap-1 border-b border-[var(--color-deck)] py-3 sm:grid sm:grid-cols-[minmax(150px,auto)_24px_1fr] sm:items-center sm:gap-4"
            >
              <span className="text-[18px] text-[var(--color-depth)]">
                {evt.dateCell}
              </span>
              <span
                aria-hidden="true"
                className="hidden text-[18px] leading-none sm:block"
                style={{ color }}
              >
                {glyph}
              </span>
              <span className="text-[18px] text-[var(--color-depth)]">
                {/* The type is carried as visible TEXT, not by the glyph —
                    the glyph is aria-hidden and decorative. */}
                <span className="font-semibold">{tableLabel}:</span>{" "}
                {evt.whatHappened}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[18px] text-[var(--color-depth)]">
        Showing all {events.length}{" "}
        {events.length === 1 ? "event" : "events"} in this date range.
      </p>
    </section>
  );
}
