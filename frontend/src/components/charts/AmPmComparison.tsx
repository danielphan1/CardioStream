/**
 * AM vs PM comparison — grouped bars of average systolic/diastolic/pulse
 * (DASH-04, Assumption A2). Aggregation is client-side via groupAmPm
 * (≤132 filtered rows — trivial).
 *
 * BP (mmHg) and pulse (bpm) have different LOCKED domains (UI-SPEC fixed
 * axis bounds: BP [40,220], pulse [30,120]), so the hero renders TWO
 * side-by-side BarCharts. Bars render from the domain floor by design —
 * D-05 positional consistency: a 125 avg systolic bar tops out at the same
 * height as a 125 reading on the timeline, never rescaled.
 *
 * ACC: AM/PM are disambiguated by direct "AM"/"PM" text labels above each
 * bar plus the rounded value on the bar — never color alone. When the AM/PM
 * filter isolates one period, groupAmPm returns a single row and only that
 * period's bars render (A2) — no errors on 1-row (or 0-row) data.
 *
 * Mini: single simplified BP chart only (no labels/axes/second panel).
 * Parent supplies the fixed height (Pitfall 2).
 */
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { Reading } from "../../api/types";
import { groupAmPm, prefersReducedMotion } from "../../lib/chartData";

export type AmPmComparisonProps = {
  readings: Reading[];
  variant: "hero" | "mini";
};

type MeasureRow = {
  measure: string;
  AM?: number;
  PM?: number;
};

type ValueLabelGlyphProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
};

/** "AM"/"PM" above the bar (16px ink) + rounded avg just inside the top. */
function makeBarLabels(period: "AM" | "PM") {
  return function BarLabels({ x, y, width, value }: ValueLabelGlyphProps) {
    if (x === undefined || y === undefined || width === undefined) return null;
    if (value === undefined || value === null) return null;
    const cx = Number(x) + Number(width) / 2;
    return (
      <g>
        <text
          x={cx}
          y={Number(y) - 6}
          fontSize={16}
          fill="var(--color-ink)"
          textAnchor="middle"
        >
          {period}
        </text>
        <text
          x={cx}
          y={Number(y) + 20}
          fontSize={16}
          fontWeight={700}
          fill="var(--cat-chip-text)"
          textAnchor="middle"
        >
          {Math.round(Number(value))}
        </text>
      </g>
    );
  };
}

export default function AmPmComparison({
  readings,
  variant,
}: AmPmComparisonProps) {
  const hero = variant === "hero";
  const animate = prefersReducedMotion() === false;

  const rows = groupAmPm(readings);
  const am = rows.find((r) => r.period === "AM");
  const pm = rows.find((r) => r.period === "PM");

  const bpData: MeasureRow[] = [
    { measure: "Systolic", AM: am?.systolic, PM: pm?.systolic },
    { measure: "Diastolic", AM: am?.diastolic, PM: pm?.diastolic },
  ];
  const pulseData: MeasureRow[] = [
    { measure: "Pulse", AM: am?.pulse, PM: pm?.pulse },
  ];

  // UI-SPEC color assignment: AM bars = systolic navy, PM = diastolic teal.
  const amBar = (withLabels: boolean) => (
    <Bar dataKey="AM" fill="var(--line-systolic)" isAnimationActive={animate}>
      {withLabels && <LabelList dataKey="AM" content={makeBarLabels("AM")} />}
    </Bar>
  );
  const pmBar = (withLabels: boolean) => (
    <Bar dataKey="PM" fill="var(--line-diastolic)" isAnimationActive={animate}>
      {withLabels && <LabelList dataKey="PM" content={makeBarLabels("PM")} />}
    </Bar>
  );

  if (!hero) {
    // Mini: single simplified BP chart — no labels, axes, or second panel.
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bpData} accessibilityLayer={false}>
          <XAxis dataKey="measure" hide />
          <YAxis domain={[40, 220]} hide />
          {amBar(false)}
          {pmBar(false)}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="flex h-full w-full gap-6">
      <div className="flex h-full flex-1 flex-col">
        <p
          className="m-0 text-center"
          style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink)" }}
        >
          Blood pressure (mmHg)
        </p>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bpData}
              accessibilityLayer
              margin={{ top: 28, right: 8, bottom: 8, left: 0 }}
            >
              <XAxis dataKey="measure" tick={{ fontSize: 16 }} />
              {/* D-05 locked BP domain — bars start at the 40 floor. */}
              <YAxis
                domain={[40, 220]}
                ticks={[40, 90, 120, 130, 140, 180, 220]}
                tick={{ fontSize: 16 }}
              />
              {amBar(true)}
              {pmBar(true)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex h-full flex-1 flex-col">
        <p
          className="m-0 text-center"
          style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink)" }}
        >
          Pulse (bpm)
        </p>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={pulseData}
              accessibilityLayer
              margin={{ top: 28, right: 8, bottom: 8, left: 0 }}
            >
              <XAxis dataKey="measure" tick={{ fontSize: 16 }} />
              {/* D-05 locked pulse domain — bars start at the 30 floor. */}
              <YAxis
                domain={[30, 120]}
                ticks={[30, 60, 90, 120]}
                tick={{ fontSize: 16 }}
              />
              {amBar(true)}
              {pmBar(true)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
