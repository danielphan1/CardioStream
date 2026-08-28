/**
 * BP Timeline — dual systolic/diastolic lines over real time
 * (DASH-01, DASH-05, DASH-06; RESEARCH Code Example 5).
 *
 * - Six AHA ReferenceArea bands render BEFORE the Lines: Recharts 3 z-order
 *   is JSX order (Pitfall 7), so bands sit BEHIND the data (D-08).
 * - Fixed clinical y-domain [40, 220] (D-05) — covers the seeded range
 *   (systolic 60–211, diastolic 42–129) with no auto-fit clipping (DASH-06).
 * - Numeric time x-axis (Pitfall 5) so a 3-week gap looks wider than a
 *   12-hour gap; visual spacing verified at the 02-07 checkpoint (A3).
 * - Hero: click-persistent tooltip (D-09) + line-end labels (D-07/A4).
 *   Mini: accessibilityLayer off, no Tooltip, axes/labels hidden (Pitfall 8).
 * - Band-label chips (four of six bands) render via a custom SVG label
 *   content function at Recharts' zIndex=2000 label layer — always above
 *   the zIndex=400 Line layer — so the chip's own solid background fully
 *   occludes any line crossing behind it (impeccable P3, 2026-08-28).
 *
 * Parent supplies the fixed height (hero h-[420px], mini h-36 — Pitfall 2).
 */
import { useState } from "react";
import {
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

export type BPTimelineProps = {
  readings: Reading[];
  variant: "hero" | "mini";
  overlayEvents?: OverlayEvent[];
};

type BandLabelChipProps = {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
};

/** Band-label chip glyph metrics (D-08 hero-only band identification). */
const CHIP_FONT_SIZE = 14;
const CHIP_PAD_X = 6;
const CHIP_PAD_Y = 3;
const CHIP_OFFSET = 6;

/**
 * Hero-only band-label chip (D-08): a solid category-color pill rendered
 * behind its own text so the label fully occludes any line segment drawn
 * behind it. Recharts' `label` zIndex layer (2000) already paints above the
 * `Line` zIndex layer (400, `recharts/zIndex/DefaultZIndexes`) — the old
 * bare-text label was already drawn on top of the lines, but a bare `<text>`
 * glyph's transparent inter-glyph gaps still visually read as "the line
 * cuts through the word" even when technically on top. An opaque rect
 * behind the text fully occludes whatever line segment is directly behind
 * it instead (/impeccable critique P3, 2026-08-28).
 *
 * The chip reuses the same `categoryColor(cat)`/`CHIP_TEXT` pair FilterBar
 * and StatsStrip already use for this category's own chip — not an
 * invented treatment.
 *
 * Elevated and Stage 1 are deliberately excluded from ever rendering a
 * chip: those two bands span only 10 of the [40, 220] domain units (~22px
 * tall at hero height) — too thin to hold even a chip without visually
 * dominating the band (/impeccable critique P1, 2026-08-27). The Y-axis
 * ticks already mark every boundary (40/90/120/130/140/180/220)
 * numerically, and the tooltip/chip remain the authoritative category
 * source per D-08.
 */
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
          fontWeight={700}
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

/**
 * D-07 / A4: direct line-end label — an SVG <text> drawn only at the
 * series' final point, 20px bold, in the line's own CSS var color.
 */
function makeEndLabel(lastIndex: number, text: string, fill: string) {
  return function EndLabel({ x, y, index }: EndLabelGlyphProps) {
    if (index !== lastIndex || x === undefined || y === undefined) return null;
    return (
      <text
        x={Number(x) + 12}
        y={Number(y)}
        fontSize={20}
        fontWeight={700}
        fill={fill}
        dominantBaseline="middle"
      >
        {text}
      </text>
    );
  };
}

export default function BPTimeline({
  readings,
  variant,
  overlayEvents,
}: BPTimelineProps) {
  const hero = variant === "hero";
  const points = toTimePoints(readings);
  const lastIndex = points.length - 1;
  const [dismissed, setDismissed] = useState(false);
  const animate = prefersReducedMotion() === false;
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const crowded = isDotCrowded(width, points.length);

  return (
    // Click or arrow-key move onto a (new) point re-shows the tooltip;
    // Close/Escape set dismissed (D-09 persistence contract). The keydown
    // bubbles up from Recharts' focusable accessibilityLayer chart.
    <div
      ref={ref}
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
          margin={hero ? { top: 8, right: 96, bottom: 8, left: 0 } : undefined}
        >
        {/* Bands FIRST — behind the lines (Pitfall 7). Systolic-threshold
            y-spans per UI-SPEC / Assumption A1. */}
        <ReferenceArea
          y1={40}
          y2={90}
          fill={categoryColor("Hypotension")}
          className="chart-band"
          label={hero ? makeBandLabelChip("Hypotension") : undefined}
        />
        <ReferenceArea
          y1={90}
          y2={120}
          fill={categoryColor("Normal")}
          className="chart-band"
          label={hero ? makeBandLabelChip("Normal") : undefined}
        />
        <ReferenceArea
          y1={120}
          y2={130}
          fill={categoryColor("Elevated")}
          className="chart-band"
          label={undefined}
        />
        <ReferenceArea
          y1={130}
          y2={140}
          fill={categoryColor("Stage 1")}
          className="chart-band"
          label={undefined}
        />
        <ReferenceArea
          y1={140}
          y2={180}
          fill={categoryColor("Stage 2")}
          className="chart-band"
          label={hero ? makeBandLabelChip("Stage 2") : undefined}
        />
        <ReferenceArea
          y1={180}
          y2={220}
          fill={categoryColor("Hypertensive Crisis")}
          className="chart-band"
          label={hero ? makeBandLabelChip("Hypertensive Crisis") : undefined}
        />
        {/* Real time axis (Pitfall 5) — proportional gaps, verify at 02-07 (A3). */}
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmtShortDate}
          tick={{ fontSize: 16 }}
          hide={!hero}
        />
        {/* D-05 fixed clinical domain — never auto-fit (DASH-06). */}
        <YAxis
          domain={[40, 220]}
          ticks={[40, 90, 120, 130, 140, 180, 220]}
          tick={{ fontSize: 16 }}
          hide={!hero}
        />
        {hero && (
          <Tooltip
            trigger="click"
            content={
              <ChartTooltip
                dismissed={dismissed}
                onClose={() => setDismissed(true)}
              />
            }
          />
        )}
        <Line
          dataKey="systolic"
          stroke="var(--line-systolic)"
          strokeWidth={3}
          dot={crowded ? false : { r: 5 }}
          activeDot={{ r: 10 }}
          isAnimationActive={animate}
        >
          {hero && (
            <LabelList
              content={makeEndLabel(lastIndex, "Systolic", "var(--line-systolic)")}
            />
          )}
        </Line>
        <Line
          dataKey="diastolic"
          stroke="var(--line-diastolic)"
          strokeWidth={3}
          dot={crowded ? false : { r: 5 }}
          activeDot={{ r: 10 }}
          isAnimationActive={animate}
        >
          {hero && (
            <LabelList
              content={makeEndLabel(lastIndex, "Diastolic", "var(--line-diastolic)")}
            />
          )}
        </Line>
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
