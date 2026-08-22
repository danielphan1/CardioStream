// Accessible overlaid-events table (OVERLAY-06) — the keyboard/screen-reader
// equivalent of every overlaid lab/incident/procedure marker, independent of
// chart-marker rendering limits. Directly templated on ReadingsTable.tsx's
// accessible-table contract (big-button paging, plain-text-node, no
// dangerouslySetInnerHTML — T-02-08 discipline).
//
// Conditional mount: renders null when no overlay dataset is ON (mirrors
// AgentStatusBanner's "if (!showBanner) return null" convention) — nothing to
// show at D-07's neutral default.
//
// Per-type error isolation: one dataset's fetch error never suppresses
// another dataset's rows — each type contributes independently to the
// merged, sorted table, and the error surfaces as its own role="alert" line.
import { useEffect, useMemo, useState } from "react";

import type { OverlayDataset } from "../api/types";
import type { OverlayEvent } from "../lib/overlayEvents";
import { buildEmptyMessage, buildErrorMessage, mergeOverlayEvents } from "../lib/overlayEvents";
import { OVERLAY_META, OVERLAY_ORDER } from "../lib/overlayMeta";

const PAGE_SIZE = 20;

type DatasetProps = {
  enabled: boolean;
  events: OverlayEvent[];
  isError: boolean;
};

type OverlayEventsListProps = {
  labs: DatasetProps;
  incidents: DatasetProps;
  procedures: DatasetProps;
};

export function OverlayEventsList({
  labs,
  incidents,
  procedures,
}: OverlayEventsListProps) {
  const byType: Record<OverlayDataset, DatasetProps> = {
    labs,
    incidents,
    procedures,
  };
  const onTypes = OVERLAY_ORDER.filter((t) => byType[t].enabled);

  const errorNotes = onTypes
    .filter((t) => byType[t].isError)
    .map((t) => buildErrorMessage(t));

  // Deviation (Rule 1 — bug fix): memoize on the actual per-dataset event
  // array/isError identities, NOT re-derive `merged` fresh every render as a
  // plain local variable. A plain spread+sort would produce a new array
  // reference on every render (including the re-render triggered by clicking
  // "Show 20 more"), which would make the reset-on-identity-change effect
  // below fire on every render and immediately clobber the just-expanded
  // page size back to PAGE_SIZE. useMemo keeps the reference stable across
  // re-renders caused by internal state changes, only recomputing when the
  // underlying data actually changes — matching ReadingsTable's own
  // stable-prop-identity assumption.
  //
  // `.enabled` gates (Gap 1 / CR-1 fix, defense-in-depth): App.tsx is the
  // primary gate for stale cached data surviving a toggle-off, but this
  // component is the reusable/testable unit and must independently enforce
  // the same invariant so it stays correct even if a future caller forgets
  // the App.tsx-level gate.
  const merged = useMemo(
    () =>
      mergeOverlayEvents(
        labs.enabled && !labs.isError ? labs.events : [],
        incidents.enabled && !incidents.isError ? incidents.events : [],
        procedures.enabled && !procedures.isError ? procedures.events : [],
      ),
    [
      labs.enabled,
      labs.events,
      labs.isError,
      incidents.enabled,
      incidents.events,
      incidents.isError,
      procedures.enabled,
      procedures.events,
      procedures.isError,
    ],
  );

  const healthyOnTypes = onTypes.filter((t) => !byType[t].isError);
  const emptyMessage =
    merged.length === 0 && healthyOnTypes.length > 0
      ? buildEmptyMessage(healthyOnTypes)
      : null;

  const [visible, setVisible] = useState(PAGE_SIZE);

  // Filter/refetch swaps the merged array identity — reset expansion so a
  // stale "Show 20 more" state never leaks across a new data set.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [merged]);

  if (onTypes.length === 0) return null;

  const shown = merged.slice(0, visible);
  const allShown = visible >= merged.length;

  return (
    <section aria-label="Overlaid events">
      <h2 className="mb-4 text-2xl leading-tight font-bold text-[var(--color-ink)]">
        Overlaid events
      </h2>
      {errorNotes.map((msg) => (
        <p key={msg} role="alert" className="mb-2 text-[18px] text-[var(--color-ink)]">
          {msg}
        </p>
      ))}
      {merged.length === 0 ? (
        emptyMessage && (
          <p className="text-[18px] text-[var(--color-ink)]">{emptyMessage}</p>
        )
      ) : (
        <section className="rounded-lg bg-[var(--color-sky)] p-6">
          <table className="w-full text-left">
            <caption className="sr-only">Overlaid events</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-xl font-bold">
                  Date
                </th>
                <th scope="col" className="p-2 text-xl font-bold">
                  Type
                </th>
                <th scope="col" className="p-2 text-xl font-bold">
                  What happened
                </th>
                <th scope="col" className="p-2 text-xl font-bold">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((evt) => (
                <OverlayEventRow key={`${evt.type}-${evt.id}`} event={evt} />
              ))}
            </tbody>
          </table>

          {allShown ? (
            <p className="mt-4 text-center text-lg">
              Showing all {merged.length} overlaid events
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mt-4 min-h-12 w-full rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)]"
            >
              Show 20 more
            </button>
          )}
        </section>
      )}
    </section>
  );
}

function OverlayEventRow({ event }: { event: OverlayEvent }) {
  const { Icon, color, tableLabel } = OVERLAY_META[event.type];
  return (
    <tr className="border-t border-[var(--color-foam)]">
      <td className="p-2 text-lg">{event.dateCell}</td>
      <td className="p-2">
        <span
          className="inline-block rounded-full px-3 py-1 text-lg"
          style={{ backgroundColor: color, color: "white" }}
        >
          <Icon aria-hidden="true" size={16} /> {tableLabel}
        </span>
      </td>
      <td className="p-2 text-lg">{event.whatHappened}</td>
      {/* Plain React text node — notes is free text (T-09-08). */}
      <td className="p-2 text-lg">{event.notes ?? ""}</td>
    </tr>
  );
}
