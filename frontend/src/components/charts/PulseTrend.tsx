/**
 * Pulse Trend — single pulse line with the 60 bpm bradycardia reference
 * line (DASH-02, DASH-06).
 *
 * - Fixed clinical y-domain [30, 120] (D-05) covers the seeded pulse range
 *   42–69; the ~88% bradycardic readings sit meaningfully BELOW the dashed
 *   60 bpm line instead of being auto-fit into ambiguity.
 * - Single-series chart reuses the systolic navy (UI-SPEC chart colors).
 * - Same time x-axis, click-persistent hero tooltip (pulse row first), and
 *   mini rules (accessibilityLayer off, no Tooltip, axes hidden) as
 *   BPTimeline.
 *
 * Parent supplies the fixed height (Pitfall 2).
 */
import { useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Reading } from "../../api/types";
import { prefersReducedMotion, toTimePoints } from "../../lib/chartData";
import { fmtShortDate } from "../../lib/dates";
import type { OverlayEvent } from "../../lib/overlayEvents";
import { OVERLAY_META } from "../../lib/overlayMeta";

import ChartTooltip from "./ChartTooltip";

export type PulseTrendProps = {
  readings: Reading[];
  variant: "hero" | "mini";
  overlayEvents?: OverlayEvent[];
};

export default function PulseTrend({
  readings,
  variant,
  overlayEvents,
}: PulseTrendProps) {
  const hero = variant === "hero";
  const points = toTimePoints(readings);
  const [dismissed, setDismissed] = useState(false);
  const animate = prefersReducedMotion() === false;

  return (
    // Click or arrow-key move re-shows the tooltip; Close/Escape dismisses
    // (D-09) — same local-state pattern as BPTimeline.
    <div
      className="h-full w-full"
      onKeyDown={
        hero
          ? (e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                setDismissed(false);
              }
            }
          : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          accessibilityLayer={hero}
          onClick={hero ? () => setDismissed(false) : undefined}
          margin={hero ? { top: 8, right: 16, bottom: 8, left: 0 } : undefined}
        >
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtShortDate}
            tick={{ fontSize: 16 }}
            hide={!hero}
          />
          {/* D-05 fixed pulse domain — never auto-fit (DASH-06). */}
          <YAxis
            domain={[30, 120]}
            ticks={[30, 60, 90, 120]}
            tick={{ fontSize: 16 }}
            hide={!hero}
          />
          <ReferenceLine
            y={60}
            stroke="var(--ref-bradycardia)"
            strokeDasharray="6 4"
            label={
              hero
                ? {
                    value: "60 bpm — Bradycardia",
                    position: "insideBottomRight",
                    fontSize: 16,
                    fill: "var(--ref-bradycardia)",
                  }
                : undefined
            }
          />
          {hero && (
            <Tooltip
              trigger="click"
              content={
                <ChartTooltip
                  pulseFirst
                  dismissed={dismissed}
                  onClose={() => setDismissed(true)}
                />
              }
            />
          )}
          <Line
            dataKey="pulse"
            stroke="var(--line-systolic)"
            strokeWidth={3}
            dot={{ r: 5 }}
            activeDot={{ r: 10 }}
            isAnimationActive={animate}
          />
          {hero &&
            overlayEvents?.map((evt) => {
              const meta = OVERLAY_META[evt.type];
              return (
                <ReferenceLine
                  key={`${evt.type}-${evt.id}`}
                  x={evt.ts}
                  stroke={meta.color}
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                  label={{
                    value: meta.glyph,
                    position: "top",
                    fontSize: 14,
                    fill: meta.color,
                  }}
                />
              );
            })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
