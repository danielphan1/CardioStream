/**
 * StatsSparkline — a genuinely decorative per-tile trend sparkline for
 * StatsStrip's stat cards (13-UI-SPEC.md Component Language item 2, D-04).
 *
 * This is new build work, not a re-skin (13-PATTERNS.md) — there is no
 * direct analog elsewhere in the codebase. It follows CombinedTimeline.tsx's
 * mini-variant gating (no axes, no click-to-persist popover) and
 * CombinedTimeline.tsx's decorative/aria-hidden/contrast-exemption precedent, but
 * is simpler:
 * this component has no "hero" branch at all — it is always the minimal
 * decorative shape, never keyboard-focusable, never a second source of
 * truth versus the real chart below it or the strip's own avg/min/max
 * numbers.
 *
 * Caller supplies `values` verbatim (no derivation performed here — mirrors
 * ReadingsTable.tsx's "the only client math is sort/slice" discipline) and
 * `color`, a `var(--...)` CSS custom-property string reusing that metric's
 * own existing chart-series/category color — never a new hex value invented
 * here.
 */
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export type StatsSparklineProps = {
  values: number[];
  color: string;
};

export default function StatsSparkline({ values, color }: StatsSparklineProps) {
  // Fewer than 2 points can't draw a trend — avoid an empty/degenerate chart.
  if (values.length < 2) return null;

  const data = values.map((v, i) => ({ i, v }));

  return (
    <div aria-hidden="true" className="h-9 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} accessibilityLayer={false}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.2}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
