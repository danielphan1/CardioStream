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
import { useEffect, useState } from "react";

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
  const [entered, setEntered] = useState(false);

  // Escape dismisses while visible (D-09 — hover-free, precision-free path).
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  // Opacity+scale-in entrance (impeccable animate survey gap #2), mirroring
  // ChartDeck.tsx's FadeSwap double-rAF technique: because this component's
  // own `return null` below causes React to remove/insert the dialog subtree
  // on every visibility flip (not a Recharts-side remount), the initial
  // opacity-0/scale-95 styles need one full paint before flipping to
  // opacity-100/scale-100 for the transition to actually run. Resets to
  // `false` whenever `visible` goes false so the entrance replays on the
  // next open rather than staying at its last value.
  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [visible]);

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
      className={`flex flex-col gap-2 rounded-xl p-4 shadow-[var(--shadow-elevation)] duration-[150ms] ease-out motion-safe:transition-[opacity,transform] motion-reduce:transition-opacity ${
        entered
          ? "opacity-100 motion-safe:scale-100"
          : "opacity-0 motion-safe:scale-95"
      }`}
      style={{
        background: "var(--color-sky)",
        color: "var(--color-ink)",
        border: "2px solid var(--color-ink)",
        // Rule 1 fix (discovered during Task 2 live verification): Recharts'
        // TooltipBoundingBox wrapper hardcodes `pointer-events: none` on its
        // ancestor div (recharts-tooltip-wrapper) so hover tooltips never
        // steal pointer events from the chart underneath. For THIS
        // click-persistent tooltip that default silently makes the Close
        // button unclickable via real pointer/mouse events (Escape still
        // worked, masking the bug in keyboard-only testing). CSS lets a
        // descendant opt back in explicitly — `pointer-events: auto` here
        // restores real click handling for this dialog and its Close button
        // without touching BPTimeline.tsx/PulseTrend.tsx's <Tooltip> usage.
        pointerEvents: "auto",
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
        onClick={(e) => {
          // Rule 1 fix (discovered during Task 2 live verification): the
          // owning chart's <LineChart onClick={() => setDismissed(false)}>
          // re-shows the tooltip on ANY click inside the chart's wrapper
          // div, not just clicks on data points. Because this dialog now
          // receives real pointer events (see the pointerEvents: "auto" fix
          // above), a Close click bubbles past this button, through the
          // Recharts wrapper, into that handler — undoing the dismissal in
          // the same event. stopPropagation keeps the click scoped to this
          // button's own onClose call without touching BPTimeline.tsx /
          // PulseTrend.tsx's <LineChart onClick> (out of this plan's scope).
          e.stopPropagation();
          onClose();
        }}
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
