// Behavior tests for ChartTooltip's entrance transition (impeccable animate
// survey gap #2) — locks the opacity+scale-in entrance (opacity 0->1, scale
// 0.96->1, ~150ms via double-rAF, mirroring ChartDeck.tsx's FadeSwap) and the
// motion-safe/motion-reduce class split (opacity always transitions; scale
// only ever applies under motion-safe). Does not re-test D-09's existing
// click/Escape/Close dismiss logic beyond a baseline sanity check.
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Reading } from "../../api/types";
import { toTimePoints } from "../../lib/chartData";
import ChartTooltip from "./ChartTooltip";

const readingFixture: Reading = {
  id: 1,
  datetime: "2026-08-28T09:00:00",
  systolic: 120,
  diastolic: 80,
  pulse: 70,
  am_pm: "AM",
  bp_category: "Normal",
  pulse_category: "Normal",
  map: 93,
  pulse_pressure: 40,
  notes: null,
};

// ChartTooltip's `payload` prop mirrors Recharts' injected shape: each entry
// wraps a full TimePoint (ts/systolic/diastolic/pulse/reading), not a bare
// Reading — reuse the same toTimePoints() helper BPTimeline/PulseTrend use.
const [fixture] = toTimePoints([readingFixture]);

describe("ChartTooltip", () => {
  it("renders nothing when inactive (baseline sanity check)", () => {
    render(<ChartTooltip onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts at opacity-0 and transitions to opacity-100 shortly after becoming visible", async () => {
    render(
      <ChartTooltip
        active
        payload={[{ payload: fixture }]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog").className).toMatch(/opacity-0/);
    await waitFor(() =>
      expect(screen.getByRole("dialog").className).toMatch(/opacity-100/),
    );
  });

  it("splits the transition-property between motion-safe and motion-reduce", async () => {
    render(
      <ChartTooltip
        active
        payload={[{ payload: fixture }]}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("dialog").className).toMatch(/opacity-100/),
    );
    const className = screen.getByRole("dialog").className;
    expect(className).toMatch(/motion-safe:transition-\[opacity,transform\]/);
    expect(className).toMatch(/motion-reduce:transition-opacity/);
    expect(className).toMatch(/motion-safe:scale-/);
  });
});
