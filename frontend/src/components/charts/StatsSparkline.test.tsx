// Behavior tests for StatsSparkline — the one genuinely new piece of UI
// this phase introduces (13-11-PLAN.md Task 1). Covers the 4 documented
// behaviors: renders without throwing for >=2 points, returns null for < 2
// points (including empty), and always carries aria-hidden="true" on the
// wrapper when it does render (never exposed to the accessibility tree —
// it summarizes a trend the real chart below already exposes accessibly).
//
// Per this codebase's existing convention (smoke.test.tsx Pitfall 2 note),
// jsdom has no real layout — ResponsiveContainer measures a 0x0 container,
// so Recharts' internal SVG does not paint. These tests assert the
// component's own contract (no-throw, null-return, aria-hidden wrapper),
// not Recharts' internal SVG output.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatsSparkline from "./StatsSparkline";

describe("StatsSparkline", () => {
  it("renders without throwing for 5 values, wrapped in an aria-hidden div", () => {
    const { container } = render(
      <StatsSparkline values={[110, 115, 108, 120, 118]} color="var(--line-systolic)" />,
    );
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("h-9", "w-full");
  });

  it("renders null for a single value (not enough points to draw a trend)", () => {
    const { container } = render(
      <StatsSparkline values={[110]} color="var(--line-systolic)" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders null for an empty values array", () => {
    const { container } = render(
      <StatsSparkline values={[]} color="var(--line-systolic)" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never exposes the sparkline subtree to the accessibility tree", () => {
    const { container } = render(
      <StatsSparkline values={[80, 82, 79]} color="var(--line-diastolic)" />,
    );
    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
    // Every descendant is inside the aria-hidden wrapper — nothing escapes it.
    expect(container.firstElementChild).toBe(wrapper);
  });
});
