/**
 * Click-persistent large-text tooltip content for the hero charts
 * (D-09, RESEARCH Pitfall 6, UI-SPEC tooltip copy).
 *
 * Recharts has no built-in outside-click dismiss for `trigger="click"`
 * tooltips — the explicit ≥48px Close button IS the required UX, plus
 * Escape while visible. The owning chart passes `dismissed`/`onClose`
 * (local state: chart click or arrow-key move re-shows, Close/Escape hides).
 *
 * T-02-08 (XSS): every value — including free-text notes — renders as a
 * React text node; raw-HTML injection props are forbidden. Chip colors come
 * from the closed palette map keyed by the six-label union, never from
 * response strings interpolated into styles.
 */
import { useEffect } from "react";

import type { TimePoint } from "../../lib/chartData";
import { fmtTooltipTitle } from "../../lib/dates";
import { categoryColor, CHIP_TEXT } from "../../lib/palette";

export type ChartTooltipProps = {
  /** Injected by Recharts <Tooltip content={...}>. */
  active?: boolean;
  /** Injected by Recharts — entries whose .payload is our TimePoint. */
  payload?: ReadonlyArray<{ payload?: TimePoint }>;
  /** Owning chart's local dismissed state (Close/Escape sets it). */
  dismissed?: boolean;
  /** Called on Close click and on Escape while visible. */
  onClose: () => void;
  /** PulseTrend leads with the pulse row (its primary series). */
  pulseFirst?: boolean;
};

export default function ChartTooltip({
  active,
  payload,
  dismissed = false,
  onClose,
  pulseFirst = false,
}: ChartTooltipProps) {
  const reading = payload?.[0]?.payload?.reading;
  const visible = Boolean(active) && !dismissed && reading !== undefined;

  // Escape dismisses while visible (D-09 — hover-free, precision-free path).
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  if (!visible || reading === undefined) return null;

  const bpRow = (
    <p key="bp" className="m-0" style={{ fontSize: 18 }}>
      BP {reading.systolic} / {reading.diastolic}
    </p>
  );
  const pulseRow = (
    <p key="pulse" className="m-0" style={{ fontSize: 18 }}>
      Pulse {reading.pulse}
    </p>
  );

  return (
    <div
      role="dialog"
      aria-label={`Reading details, ${fmtTooltipTitle(reading.datetime)}`}
      className="flex flex-col gap-2 rounded-lg p-4 shadow-lg"
      style={{
        background: "var(--color-sky)",
        color: "var(--color-ink)",
        border: "2px solid var(--color-ink)",
      }}
    >
      <p className="m-0" style={{ fontSize: 20, fontWeight: 700 }}>
        {fmtTooltipTitle(reading.datetime)}
      </p>
      {pulseFirst ? [pulseRow, bpRow] : [bpRow, pulseRow]}
      <span
        className="self-start rounded-full px-3 py-1"
        style={{
          background: categoryColor(reading.bp_category),
          color: CHIP_TEXT,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {reading.bp_category}
      </span>
      {reading.notes !== null && reading.notes !== "" && (
        <p className="m-0" style={{ fontSize: 18 }}>
          {reading.notes}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="min-h-12 min-w-12 self-end rounded-lg px-5"
        style={{
          background: "var(--color-accent)",
          color: "var(--color-accent-text)",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Close
      </button>
    </div>
  );
}
