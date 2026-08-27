// Readings table (DASH-09, D-23/D-24) — the zero-precision data fallback:
// every reading reachable by big-button paging, no pagination chrome, no
// inner scrollbars. Newest-first, 20 rows at a time, +20 per "Show 20 more".
//
// The ONLY client math in this component is sorting and slicing — all
// numbers render verbatim from the Reading payload. The derived medical
// fields (MAP, pulse pressure, pulse categorization) are deliberately
// EXCLUDED from the columns (D-24).
//
// Security (T-02-08): `notes` is the one free-text field in the payload.
// It renders exclusively as a React text node — no HTML injection path.
//
// Mobile layout (/impeccable critique P1, 2026-08-27): below 640px the
// rightmost "Category" column — clinically the most important field —
// clipped off-screen with no way to reach it. A horizontal scrollbar was
// rejected: it requires a swipe/drag gesture, which the project's primary
// user (a C4 quadriplegic with no reliable hand mobility) cannot reliably
// perform, and CLAUDE.md's accessibility constraints hard-ban drag
// interactions anywhere in the product. Instead, the same 6 fields reflow
// into a stacked card-per-reading list (`role="list"`/`role="listitem"`)
// below 640px — no new gesture, no lost column, same content in a
// different container. Uses the container's live measured width (not a
// CSS media query) via `useElementWidth`, so the same component behaves
// identically in tests (jsdom width=0 -> table) and in the browser (real
// narrow width -> cards).
import { useEffect, useState } from "react";

import type { Reading } from "../api/types";
import { useElementWidth } from "../hooks/useElementWidth";
import { categoryColor, CHIP_TEXT } from "../lib/palette";
import { shouldUseCardLayout } from "../lib/responsive";

const PAGE_SIZE = 20;

type ReadingsTableProps = {
  readings: Reading[];
};

/** "June 3, 2025" for the Date column (UI-SPEC date form). */
function fmtDateCell(iso: string): string {
  // Naive local ISO with a time component parses local (DATA-05 contract).
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "7:42 AM" for the Time column. */
function fmtTimeCell(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ReadingsTable({ readings }: ReadingsTableProps) {
  const { ref, width } = useElementWidth<HTMLElement>();
  const cardLayout = shouldUseCardLayout(width);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Filter change swaps the readings array identity — reset the expansion
  // so stale "Show 20 more" state never leaks across filter sets.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [readings]);

  // Naive local ISO strings sort chronologically — string compare is safe.
  const sorted = [...readings].sort((a, b) =>
    b.datetime.localeCompare(a.datetime),
  );
  const shown = sorted.slice(0, visible);
  const allShown = visible >= sorted.length;

  return (
    <section
      ref={ref}
      className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]"
    >
      {cardLayout ? (
        <div role="list" aria-label="Readings" className="flex flex-col gap-4">
          {shown.map((r) => (
            <ReadingCard key={r.id} reading={r} />
          ))}
        </div>
      ) : (
        <table className="w-full text-left">
          <caption className="sr-only">Readings</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-xl font-bold">
                Date
              </th>
              <th scope="col" className="p-2 text-xl font-bold">
                Time
              </th>
              <th scope="col" className="p-2 text-xl font-bold">
                AM/PM
              </th>
              <th scope="col" className="p-2 text-xl font-bold">
                Blood pressure
              </th>
              <th scope="col" className="p-2 text-xl font-bold">
                Pulse
              </th>
              <th scope="col" className="p-2 text-xl font-bold">
                Category
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <ReadingRow key={r.id} reading={r} />
            ))}
          </tbody>
        </table>
      )}

      {allShown ? (
        <p className="mt-4 text-center text-lg">
          Showing all {sorted.length} readings
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-4 min-h-12 w-full rounded-xl bg-[var(--color-accent)] px-6 text-control font-bold text-[var(--color-accent-text)]"
        >
          Show 20 more
        </button>
      )}
    </section>
  );
}

function ReadingRow({ reading: r }: { reading: Reading }) {
  const hasNote = r.notes !== null && r.notes !== "";
  return (
    <>
      <tr className="border-t border-[var(--color-foam)]">
        <td className="p-2 text-lg">{fmtDateCell(r.datetime)}</td>
        <td className="p-2 text-lg">{fmtTimeCell(r.datetime)}</td>
        <td className="p-2 text-lg">{r.am_pm}</td>
        <td className="p-2 text-lg">
          {r.systolic} / {r.diastolic}
        </td>
        <td className="p-2 text-lg">{r.pulse}</td>
        <td className="p-2">
          {/* Display-only chip — UI-SPEC table-chip exemption allows
              shorter than 48px. Solid category fill + contrast text pair. */}
          <span
            className="inline-block rounded-full px-3 py-1 text-lg"
            style={{
              backgroundColor: categoryColor(r.bp_category),
              color: CHIP_TEXT,
            }}
          >
            {r.bp_category}
          </span>
        </td>
      </tr>
      {hasNote && (
        <tr>
          {/* Plain React text node — notes is free text (T-02-08). */}
          <td colSpan={6} className="p-2 pt-0 text-lg">
            Note: {r.notes}
          </td>
        </tr>
      )}
    </>
  );
}

/** Stacked-card rendering of one reading for the sub-640px layout — same 6
 * fields as ReadingRow, reusing the identical formatters/palette so the two
 * views can never drift. */
function ReadingCard({ reading: r }: { reading: Reading }) {
  const hasNote = r.notes !== null && r.notes !== "";
  return (
    <div
      role="listitem"
      className="rounded-xl border border-[var(--color-foam)] p-4"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <dt className="text-lg font-bold">Date</dt>
        <dd className="text-lg">{fmtDateCell(r.datetime)}</dd>

        <dt className="text-lg font-bold">Time</dt>
        <dd className="text-lg">{fmtTimeCell(r.datetime)}</dd>

        <dt className="text-lg font-bold">AM/PM</dt>
        <dd className="text-lg">{r.am_pm}</dd>

        <dt className="text-lg font-bold">Blood pressure</dt>
        <dd className="text-lg">
          {r.systolic} / {r.diastolic}
        </dd>

        <dt className="text-lg font-bold">Pulse</dt>
        <dd className="text-lg">{r.pulse}</dd>

        <dt className="text-lg font-bold">Category</dt>
        <dd className="text-lg">
          <span
            className="inline-block rounded-full px-3 py-1 text-lg"
            style={{
              backgroundColor: categoryColor(r.bp_category),
              color: CHIP_TEXT,
            }}
          >
            {r.bp_category}
          </span>
        </dd>
      </dl>
      {hasNote && (
        <p className="mt-2 text-lg">
          {/* Plain React text node — notes is free text (T-02-08). */}
          Note: {r.notes}
        </p>
      )}
    </div>
  );
}
