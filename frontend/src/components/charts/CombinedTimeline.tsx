/**
 * CombinedTimeline — systolic, diastolic, and pulse on ONE chart with two
 * independent axes, plus event markers (Phase 14, D-01/D-03/D-04).
 *
 * Supersedes BPTimeline and PulseTrend, which were mutually exclusive hero
 * charts. That exclusivity is the direct reason the client could not "only see
 * the blood pressures and pulses" — this component is the phase's payload.
 *
 * Carried over unchanged from BPTimeline because each was hard-won:
 * - Bands render BEFORE the Lines: Recharts 3 z-order is JSX order (Pitfall 7).
 * - Fixed clinical domains, never auto-fit (D-05 / DASH-06).
 * - Numeric time x-axis (Pitfall 5) so a 3-week gap looks wider than 12 hours.
 * - Band-label chips are TWO sibling ReferenceAreas sharing y1/y2 — a tint at
 *   the default zIndex plus an invisible label-host at DefaultZIndexes.axis
 *   (500). A ReferenceArea's own `label` is never promoted to Recharts' label
 *   layer, so without the explicit zIndex the chip paints in layer 100 and the
 *   Lines (400) cross straight through it. Do not collapse this back into one
 *   element (impeccable P1, 2026-08-28 — corrects an earlier wrong fix).
 * - Elevated and Stage 1 never get chips: those bands span 10 of the 180
 *   domain units (~22px at hero height), too thin to hold one.
 *
 * New in Phase 14 — dual axes, and two rules about them that were established
 * by test, not by assumption:
 *
 * 1. Both YAxis elements are always mounted and hidden with `hide`, never
 *    conditionally unmounted, so a `yAxisId` can never fail to resolve.
 * 2. Event markers bind to whichever axis is VISIBLE, not to a fixed one.
 *    A `ReferenceLine` anchored to a `hide`-den axis renders nothing at all —
 *    no warning, no error, the marker just disappears. Pinning markers to
 *    "mmHg" therefore lost every event whenever Chris unchecked Blood
 *    Pressure, which is precisely the "pulse and hospital stays" combination
 *    he asked for. `markerAxis` below is the fix.
 *
 * Parent supplies the fixed height (h-[420px]).
 */
import { useState } from "react";
import {
  DefaultZIndexes,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

import type { BPCategory, Reading } from "../../api/types";
import {
  estimateChipWidth,
  isDotCrowded,
  prefersReducedMotion,
  toTimePoints,
} from "../../lib/chartData";
import { fmtShortDate } from "../../lib/dates";
import type { OverlayEvent } from "../../lib/overlayEvents";
import { OVERLAY_META } from "../../lib/overlayMeta";
import { categoryColor, CHIP_TEXT } from "../../lib/palette";
import { useElementWidth } from "../../hooks/useElementWidth";

import ChartTooltip from "./ChartTooltip";

export type CombinedTimelineProps = {
  readings: Reading[];
  overlayEvents?: OverlayEvent[];
  showBP: boolean;
  showPulse: boolean;
};

/** Axis ids. Referenced by every Line, band, and marker — a typo here fails
 *  silently in Recharts, so they are constants rather than inline strings. */
const MMHG = "mmHg";
const BPM = "bpm";

type BandLabelChipProps = {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
};

const CHIP_FONT_SIZE = 14;
const CHIP_PAD_X = 6;
const CHIP_PAD_Y = 3;
const CHIP_OFFSET = 6;

/** Solid category-color pill drawn behind its own text so the label fully
 *  occludes any line segment behind it (a bare <text> glyph's inter-glyph gaps
 *  read as "the line cuts through the word" even when technically on top). */
function makeBandLabelChip(cat: BPCategory) {
  return function BandLabelChip({ viewBox }: BandLabelChipProps) {
    if (viewBox?.x === undefined || viewBox?.y === undefined) return null;
    const textWidth = estimateChipWidth(cat, CHIP_FONT_SIZE);
    const chipWidth = textWidth + CHIP_PAD_X * 2;
    const chipHeight = CHIP_FONT_SIZE + CHIP_PAD_Y * 2;
    const x = viewBox.x + CHIP_OFFSET;
    const y = viewBox.y + CHIP_OFFSET;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={chipWidth}
          height={chipHeight}
          rx={chipHeight / 2}
          fill={categoryColor(cat)}
        />
        <text
          x={x + chipWidth / 2}
          y={y + chipHeight / 2}
          fontSize={CHIP_FONT_SIZE}
          fontWeight={600}
          fill={CHIP_TEXT}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {cat}
        </text>
      </g>
    );
  };
}

type EndLabelGlyphProps = {
  x?: number | string;
  y?: number | string;
  index?: number;
};

/** D-07 / A4: direct line-end label at the series' final point only. */
function makeEndLabel(lastIndex: number, text: string, fill: string) {
  return function EndLabel({ x, y, index }: EndLabelGlyphProps) {
    if (index !== lastIndex || x === undefined || y === undefined) return null;
    return (
      <text
        x={Number(x) + 12}
        y={Number(y)}
        fontSize={20}
        fontWeight={600}
        fill={fill}
        dominantBaseline="middle"
      >
        {text}
      </text>
    );
  };
}

/** The six AHA bands, systolic-threshold y-spans (Assumption A1). `chip` is
 *  false where the band is too thin to hold a label. */
const BANDS: { cat: BPCategory; y1: number; y2: number; chip: boolean }[] = [
  { cat: "Hypotension", y1: 40, y2: 90, chip: true },
  { cat: "Normal", y1: 90, y2: 120, chip: true },
  { cat: "Elevated", y1: 120, y2: 130, chip: false },
  { cat: "Stage 1", y1: 130, y2: 140, chip: false },
  { cat: "Stage 2", y1: 140, y2: 180, chip: true },
  { cat: "Hypertensive Crisis", y1: 180, y2: 220, chip: true },
];

export default function CombinedTimeline({
  readings,
  overlayEvents,
  showBP,
  showPulse,
}: CombinedTimelineProps) {
  const points = toTimePoints(readings);
  const lastIndex = points.length - 1;
  const [dismissed, setDismissed] = useState(false);
  const animate = prefersReducedMotion() === false;
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const crowded = isDotCrowded(width, points.length);

  // Anchor markers to a VISIBLE axis — a ReferenceLine on a hidden axis
  // renders nothing (see the header note). ChartDeck only mounts this
  // component when at least one vital is on, so one of these is always shown;
  // the mmHg fallback keeps the id valid even if that ever stops holding.
  const markerAxis = showBP ? MMHG : showPulse ? BPM : MMHG;

  return (
    // Click or arrow-key move onto a (new) point re-shows the tooltip;
    // Close/Escape set dismissed (D-09 persistence contract). The keydown
    // bubbles up from Recharts' focusable accessibilityLayer chart.
    <div
      ref={ref}
      className="h-full w-full"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          setDismissed(false);
        }
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          accessibilityLayer
          onClick={() => setDismissed(false)}
          margin={{ top: 8, right: 96, bottom: 8, left: 0 }}
        >
          {/* Bands FIRST — behind the lines (Pitfall 7). Blood-pressure
              context, so they follow the blood_pressure dataset (D-04). */}
          {showBP &&
            BANDS.map(({ cat, y1, y2 }) => (
              <ReferenceArea
                key={`band-${cat}`}
                yAxisId={MMHG}
                y1={y1}
                y2={y2}
                fill={categoryColor(cat)}
                className="chart-band"
                label={undefined}
              />
            ))}
          {showBP &&
            BANDS.filter((b) => b.chip).map(({ cat, y1, y2 }) => (
              <ReferenceArea
                key={`chip-${cat}`}
                yAxisId={MMHG}
                y1={y1}
                y2={y2}
                fill="transparent"
                stroke="none"
                zIndex={DefaultZIndexes.axis}
                label={makeBandLabelChip(cat)}
              />
            ))}

          {/* Real time axis (Pitfall 5) — proportional gaps. */}
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtShortDate}
            tick={{ fontSize: 16 }}
          />

          {/* Both axes ALWAYS mounted — see the file header for why. Fixed
              clinical domains, never auto-fit (D-05 / DASH-06). */}
          <YAxis
            yAxisId={MMHG}
            domain={[40, 220]}
            ticks={[40, 90, 120, 130, 140, 180, 220]}
            tick={{ fontSize: 16 }}
            hide={!showBP}
          />
          <YAxis
            yAxisId={BPM}
            orientation="right"
            domain={[30, 120]}
            ticks={[30, 60, 90, 120]}
            tick={{ fontSize: 16 }}
            hide={!showPulse}
          />

          {showPulse && (
            <ReferenceLine
              yAxisId={BPM}
              y={60}
              stroke="var(--ref-bradycardia)"
              strokeDasharray="6 4"
              label={{
                value: "60 bpm — Bradycardia",
                position: "insideBottomRight",
                fontSize: 16,
                fill: "var(--ref-bradycardia)",
              }}
            />
          )}

          <Tooltip
            trigger="click"
            content={
              <ChartTooltip
                pulseFirst={!showBP}
                dismissed={dismissed}
                onClose={() => setDismissed(true)}
              />
            }
          />

          {showBP && (
            <Line
              yAxisId={MMHG}
              dataKey="systolic"
              stroke="var(--line-systolic)"
              strokeWidth={3}
              dot={crowded ? false : { r: 5 }}
              activeDot={{ r: 10 }}
              isAnimationActive={animate}
            >
              <LabelList
                content={makeEndLabel(lastIndex, "Systolic", "var(--line-systolic)")}
              />
            </Line>
          )}
          {showBP && (
            <Line
              yAxisId={MMHG}
              dataKey="diastolic"
              stroke="var(--line-diastolic)"
              strokeWidth={3}
              dot={crowded ? false : { r: 5 }}
              activeDot={{ r: 10 }}
              isAnimationActive={animate}
            >
              <LabelList
                content={makeEndLabel(lastIndex, "Diastolic", "var(--line-diastolic)")}
              />
            </Line>
          )}
          {showPulse && (
            // Dashed is NOT decoration: pulse/systolic luminance ratio is only
            // ~1.9:1 light and ~1.1:1 dark (see contrast.test.ts), so in
            // greyscale and under colour-vision deficiency the stroke pattern
            // is what separates these two series, not the hue.
            <Line
              yAxisId={BPM}
              dataKey="pulse"
              stroke="var(--line-pulse)"
              strokeWidth={3}
              strokeDasharray="9 5"
              dot={crowded ? false : { r: 5 }}
              activeDot={{ r: 10 }}
              isAnimationActive={animate}
            >
              <LabelList
                content={makeEndLabel(lastIndex, "Pulse", "var(--line-pulse)")}
              />
            </Line>
          )}

          {/* Markers bind to the VISIBLE axis — see markerAxis above. */}
          {overlayEvents?.map((evt) => {
            const meta = OVERLAY_META[evt.type];
            return (
              <ReferenceLine
                key={`${evt.type}-${evt.id}`}
                yAxisId={markerAxis}
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
