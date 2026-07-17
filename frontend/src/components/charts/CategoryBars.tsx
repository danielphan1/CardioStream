/**
 * BP Categories — horizontal (layout="vertical") bars in clinical order
 * with AHA severity colors (DASH-03, D-10, D-14).
 *
 * - Data comes from categoryBarData(stats): /stats/summary already serves
 *   all six labels, clinical order, zero-filled — bars ALWAYS match the
 *   stats strip numbers (D-10).
 * - Full "Stage 1 — 34 readings (26%)" labels render OUTSIDE the bar in ink
 *   at 18px so text never sits on mid-contrast fills (UI-SPEC).
 * - No Tooltip by design: the labels ARE the values (D-10 matches the
 *   strip), so there is nothing extra to inspect.
 *
 * Parent supplies the fixed height (Pitfall 2).
 */
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { StatsSummary } from "../../api/types";
import { categoryBarData, prefersReducedMotion } from "../../lib/chartData";
import { categoryColor } from "../../lib/palette";

export type CategoryBarsProps = {
  stats: StatsSummary;
  variant: "hero" | "mini";
};

type BarLabelGlyphProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
};

export default function CategoryBars({ stats, variant }: CategoryBarsProps) {
  const hero = variant === "hero";
  const rows = categoryBarData(stats);
  const animate = prefersReducedMotion() === false;

  // D-10 full label drawn just past the bar end, ink color, 18px. The
  // 300px right margin below reserves room for the longest label
  // ("Hypertensive Crisis — NN readings (NN%)") even on the widest bar.
  const barLabel = ({ x, y, width, height, index }: BarLabelGlyphProps) => {
    if (
      index === undefined ||
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return null;
    }
    const row = rows[index];
    if (row === undefined) return null;
    return (
      <text
        x={Number(x) + Number(width) + 8}
        y={Number(y) + Number(height) / 2}
        fontSize={18}
        fill="var(--color-ink)"
        dominantBaseline="middle"
      >
        {row.label}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={rows}
        accessibilityLayer={hero}
        margin={hero ? { top: 8, right: 300, bottom: 8, left: 8 } : undefined}
      >
        <XAxis
          type="number"
          domain={[0, "dataMax"]}
          allowDecimals={false}
          tick={{ fontSize: 16 }}
          hide={!hero}
        />
        {/* Category names live in the D-10 label — ticks stay hidden. */}
        <YAxis type="category" dataKey="category" hide />
        <Bar dataKey="count" isAnimationActive={animate}>
          {rows.map((row) => (
            <Cell key={row.category} fill={categoryColor(row.category)} />
          ))}
          {hero && <LabelList content={barLabel} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
