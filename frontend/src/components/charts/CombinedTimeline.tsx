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
 * - Phase 16 (D-01–D-05): bold rolling-average trend lines mount only when
 *   `hasTrend` (`points.length >= 7`). Raw-line dimming is gated on the SAME
 *   `hasTrend` — dimming a raw line only makes sense when a bold trend line
 *   exists above it to support; never dim with nothing on top. The end-label
 *   pill moves from the raw line to the trend line via that same gate and
 *   must never render on both at once.
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
 * Parent supplies the height: a viewport-relative clamp with a 420px floor,
 * so the chart grows on tall screens and never shrinks below its original size.
 */
import { useState } from "react";
import {
  Area,
  ComposedChart,
  DefaultZIndexes,
  Line,
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
  resolveLabelY,
  rollingAverage,
  toTimePoints,
} from "../../lib/chartData";
import type { TimePoint } from "../../lib/chartData";
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

/** Render data for the chart once trend lines exist (D-02) — a strict
 *  superset of TimePoint, so bands/axes/markers/tooltip (which never read
 *  these keys) are unaffected. */
type TrendPoint = TimePoint & {
  systolicTrend?: number;
  diastolicTrend?: number;
  pulseTrend?: number;
};

// Below this rendered width the 112px right margin — sized for the widest
// end-label pill — costs more than the pills are worth: at a 390px viewport
// the chart is 318px, and 318 - 112 - 60 - 60 leaves 86px of drawable plot.
// Under this width the pills come off and `SeriesKey` identifies the series
// instead, so nothing is lost but the inline placement (quick 261003-iuc).
const COMPACT_WIDTH_PX = 520;

// Peak alpha of the gradient area under each line, fading to 0 at the axis.
// Deliberately low: these fills sit ON TOP of the six clinical bands, and the
// reason the gradients were deferred in 261003-hev was that a heavy fill over
// a tinted band turns to mud. The lines themselves paint after the areas at
// full strength, so no series' contrast against its ground changes.
const AREA_PEAK_OPACITY = 0.14;

// One gradient per series. Ids are referenced by `url(#...)`, so they must
// stay unique within the document — there is only ever one timeline mounted.
const SERIES_FILLS = [
  { id: "fill-systolic", color: "var(--line-systolic)" },
  { id: "fill-diastolic", color: "var(--line-diastolic)" },
  { id: "fill-pulse", color: "var(--line-pulse)" },
] as const;

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

const END_LABEL_HEIGHT = CHIP_FONT_SIZE + CHIP_PAD_Y * 2;

/** D-07 / A4: direct line-end label at the series' final point only.
 *  Same solid-pill treatment as makeBandLabelChip and for the same reason —
 *  when filtering narrows the plotted range, series' end values converge and
 *  bare colored text overlaps itself or reads poorly over a band tint. A pill
 *  keeps each label legible and its own series' color regardless of what's
 *  behind or beside it.
 *
 *  Convergence doesn't stop at the line: with fewer points on screen the
 *  pills themselves can end up close enough to overlap each other (live-
 *  verified — "Pulse" clipped the top of "Systolic" at a 7-day filter).
 *  `placedYs` is one array shared by all three series' EndLabel instances via
 *  closure — CombinedTimeline creates it fresh per render and every
 *  makeEndLabel call for that render pushes into the same array — so each
 *  later label nudges down past every earlier one already placed. */
function makeEndLabel(
  lastIndex: number,
  text: string,
  color: string,
  placedYs: number[],
) {
  return function EndLabel({ x, y, index }: EndLabelGlyphProps) {
    if (index !== lastIndex || x === undefined || y === undefined) return null;
    const labelY = resolveLabelY(Number(y), placedYs);
    placedYs.push(labelY);
    const chipWidth = estimateChipWidth(text, CHIP_FONT_SIZE) + CHIP_PAD_X * 2;
    const chipX = Number(x) + CHIP_OFFSET;
    const chipTop = labelY - END_LABEL_HEIGHT / 2;
    return (
      <g>
        <rect
          x={chipX}
          y={chipTop}
          width={chipWidth}
          height={END_LABEL_HEIGHT}
          rx={END_LABEL_HEIGHT / 2}
          fill={color}
        />
        <text
          x={chipX + chipWidth / 2}
          y={labelY}
          fontSize={CHIP_FONT_SIZE}
          fontWeight={700}
          fill={CHIP_TEXT}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {text}
        </text>
      </g>
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

/** The series key that replaces the end-label pills below COMPACT_WIDTH_PX.
 *  Rendered ABOVE the chart, not below it: below, it lands at the very bottom
 *  of the scroll and the fixed Assistant button sits on top of the last entry
 *  at maximum scroll, so "Pulse" could never be read at 390px.
 *  Not a Recharts <Legend>: this has to mirror the pills exactly, dash pattern
 *  included, because the dash — not the hue — is what separates pulse from
 *  systolic in greyscale and under colour-vision deficiency (see the Line
 *  below). A <Legend> would also eat vertical space from the plot, which is
 *  the one thing in short supply at this width. */
function SeriesKey({ showBP, showPulse }: { showBP: boolean; showPulse: boolean }) {
  const entries = [
    ...(showBP
      ? [
          { label: "Systolic", color: "var(--line-systolic)", dashed: false },
          { label: "Diastolic", color: "var(--line-diastolic)", dashed: false },
        ]
      : []),
    ...(showPulse ? [{ label: "Pulse", color: "var(--line-pulse)", dashed: true }] : []),
  ];
  return (
    <ul className="m-0 flex shrink-0 list-none flex-wrap gap-x-5 gap-y-1 p-0">
      {entries.map(({ label, color, dashed }) => (
        <li
          key={label}
          className="flex items-center gap-2"
          style={{ fontSize: 18, color: "var(--color-depth)" }}
        >
          <svg width="26" height="12" aria-hidden="true" focusable="false">
            <line
              x1="1"
              y1="6"
              x2="25"
              y2="6"
              stroke={color}
              strokeWidth="4"
              strokeDasharray={dashed ? "7 4" : undefined}
            />
          </svg>
          {label}
        </li>
      ))}
    </ul>
  );
}

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
  const hasTrend = points.length >= 7;
  const crowded = isDotCrowded(width, points.length);
  // `width` is 0 until the ResizeObserver first fires (and stays 0 in jsdom),
  // so `compact` is false by default — the full-width layout is what renders
  // when the width is simply not known yet.
  const compact = width > 0 && width < COMPACT_WIDTH_PX;

  // D-01/D-02: bold rolling-average trend lines, merged onto a superset of
  // `points` so bands/axes/markers/tooltip (which never read the new keys)
  // are unaffected.
  const systolicTrend = rollingAverage(points, "systolic");
  const diastolicTrend = rollingAverage(points, "diastolic");
  const pulseTrend = rollingAverage(points, "pulse");
  const trendPoints: TrendPoint[] = points.map((p, i) => ({
    ...p,
    systolicTrend: systolicTrend[i],
    diastolicTrend: diastolicTrend[i],
    pulseTrend: pulseTrend[i],
  }));

  // Anchor markers to a VISIBLE axis — a ReferenceLine on a hidden axis
  // renders nothing (see the header note). ChartDeck only mounts this
  // component when at least one vital is on, so one of these is always shown;
  // the mmHg fallback keeps the id valid even if that ever stops holding.
  const markerAxis = showBP ? MMHG : showPulse ? BPM : MMHG;

  // Shared across all three end-label pills for THIS render only — see
  // makeEndLabel's collision-avoidance note. Recreated fresh every render;
  // never persisted across renders.
  const endLabelYs: number[] = [];

  return (
    // Click or arrow-key move onto a (new) point re-shows the tooltip;
    // Close/Escape set dismissed (D-09 persistence contract). The keydown
    // bubbles up from Recharts' focusable accessibilityLayer chart.
    <div
      ref={ref}
      className="flex h-full w-full flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          setDismissed(false);
        }
      }}
    >
      <p className="m-0 shrink-0" style={{ fontSize: 18, color: "var(--color-depth)" }}>
        {hasTrend
          ? "Bold lines show a 7-reading rolling average. Lighter lines show each individual reading."
          : `Trend line needs at least 7 readings to show. You have ${points.length} here, so only individual readings are shown.`}
      </p>
      {compact && <SeriesKey showBP={showBP} showPulse={showPulse} />}
      <div className="min-h-0 flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={trendPoints}
          accessibilityLayer
          onClick={() => setDismissed(false)}
          // right: fits the widest end-label pill ("Diastolic" ≈ 96px) with
          // headroom so it never clips against the SVG edge. When `compact`
          // drops the pills there is nothing left to reserve it for, and
          // handing those 100px back to the plot is the whole point.
          margin={{ top: 8, right: compact ? 12 : 112, bottom: 8, left: 0 }}
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

          {/* Gradient fills under each series (deferred from 261003-hev,
              requested in 261003-iuc). These paint BEFORE the Lines, so the
              strokes stay full-strength on top and no series' contrast against
              its ground changes — AREA_PEAK_OPACITY explains why the alpha is
              as low as it is. The fill follows whichever line is the prominent
              one: the bold trend once 7+ readings exist, the raw line until
              then, mirroring where the end-label pill goes. */}
          <defs>
            {SERIES_FILLS.map(({ id, color }) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={AREA_PEAK_OPACITY} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {showBP && (
            <Area
              yAxisId={MMHG}
              dataKey="systolic"
              stroke="none"
              fill="url(#fill-systolic)"
              isAnimationActive={animate}
              activeDot={false}
              tooltipType="none"
            />
          )}
          {showBP && (
            <Area
              yAxisId={MMHG}
              dataKey="diastolic"
              stroke="none"
              fill="url(#fill-diastolic)"
              isAnimationActive={animate}
              activeDot={false}
              tooltipType="none"
            />
          )}
          {showPulse && (
            <Area
              yAxisId={BPM}
              dataKey="pulse"
              stroke="none"
              fill="url(#fill-pulse)"
              isAnimationActive={animate}
              activeDot={false}
              tooltipType="none"
            />
          )}

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
              strokeWidth={hasTrend ? 2 : 3}
              strokeOpacity={hasTrend ? 0.85 : 1}
              dot={crowded ? false : { r: 5 }}
              activeDot={{ r: 10 }}
              isAnimationActive={animate}
            >
              {!hasTrend && !compact && (
                <LabelList
                  content={makeEndLabel(lastIndex, "Systolic", "var(--line-systolic)", endLabelYs)}
                />
              )}
            </Line>
          )}
          {showBP && (
            <Line
              yAxisId={MMHG}
              dataKey="diastolic"
              stroke="var(--line-diastolic)"
              strokeWidth={hasTrend ? 2 : 3}
              strokeOpacity={hasTrend ? 0.85 : 1}
              dot={crowded ? false : { r: 5 }}
              activeDot={{ r: 10 }}
              isAnimationActive={animate}
            >
              {!hasTrend && !compact && (
                <LabelList
                  content={makeEndLabel(lastIndex, "Diastolic", "var(--line-diastolic)", endLabelYs)}
                />
              )}
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
              strokeWidth={hasTrend ? 2 : 3}
              strokeOpacity={hasTrend ? 0.85 : 1}
              strokeDasharray="9 5"
              dot={crowded ? false : { r: 5 }}
              activeDot={{ r: 10 }}
              isAnimationActive={animate}
            >
              {!hasTrend && !compact && (
                <LabelList
                  content={makeEndLabel(lastIndex, "Pulse", "var(--line-pulse)", endLabelYs)}
                />
              )}
            </Line>
          )}

          {/* D-01/D-02: bold rolling-average trend lines, only once 7+
              readings exist — the end-label pill moves here from the raw
              line via the same `hasTrend` gate, never both at once. */}
          {showBP && hasTrend && (
            <Line
              yAxisId={MMHG}
              dataKey="systolicTrend"
              stroke="var(--line-systolic)"
              strokeWidth={4}
              dot={false}
              activeDot={false}
              isAnimationActive={animate}
            >
              {!compact && (
                <LabelList
                  content={makeEndLabel(lastIndex, "Systolic", "var(--line-systolic)", endLabelYs)}
                />
              )}
            </Line>
          )}
          {showBP && hasTrend && (
            <Line
              yAxisId={MMHG}
              dataKey="diastolicTrend"
              stroke="var(--line-diastolic)"
              strokeWidth={4}
              dot={false}
              activeDot={false}
              isAnimationActive={animate}
            >
              {!compact && (
                <LabelList
                  content={makeEndLabel(lastIndex, "Diastolic", "var(--line-diastolic)", endLabelYs)}
                />
              )}
            </Line>
          )}
          {showPulse && hasTrend && (
            <Line
              yAxisId={BPM}
              dataKey="pulseTrend"
              stroke="var(--line-pulse)"
              strokeWidth={4}
              strokeDasharray="9 5"
              dot={false}
              activeDot={false}
              isAnimationActive={animate}
            >
              {!compact && (
                <LabelList
                  content={makeEndLabel(lastIndex, "Pulse", "var(--line-pulse)", endLabelYs)}
                />
              )}
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
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
