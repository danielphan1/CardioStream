// The only logic in GreetingHeader worth a test: the time buckets and the
// singular/plural + loading contract on the subtitle (an invented count on a
// health surface is worse than a blank).
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { GreetingHeader, greetingFor } from "./GreetingHeader";

// The component reads the stats query itself; stub that boundary, not fetch.
const mockStats = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useStats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useStats")>();
  return { ...actual, useResolvedFilters: () => ({}), useStats: mockStats };
});

function renderHeader(data: { count: number } | undefined, isPending: boolean) {
  mockStats.mockReturnValue({ data, isPending });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GreetingHeader />
    </QueryClientProvider>,
  );
}

describe("greetingFor", () => {
  it.each([
    [0, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ])("hour %i reads %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe("GreetingHeader subtitle", () => {
  it("states no count while loading", () => {
    renderHeader(undefined, true);
    expect(
      screen.getByText("Your blood pressure and pulse, at a glance."),
    ).toBeInTheDocument();
  });

  // The count is now its own bold element inside the subtitle (quick
  // 261005-mj2): the number was the only fact on the line and the quietest
  // thing on it. The COPY is unchanged, but splitting it across a child
  // element means Testing Library's getNodeText — which joins only an
  // element's DIRECT text-node children — no longer sees the whole sentence
  // on the <p>. So the copy is matched by regex on the remainder, and the
  // interpolated VALUE is asserted separately on the count element. Both
  // halves are required: the old single assertion proved the wording AND the
  // number, and regex-on-remainder alone would let a wrong-number bug ship.
  it("uses the singular for exactly one reading", () => {
    renderHeader({ count: 1 }, false);
    expect(
      screen.getByText(/^reading matches the filters below\.$/),
    ).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveTextContent("1");
  });

  it("uses the plural otherwise", () => {
    renderHeader({ count: 132 }, false);
    expect(
      screen.getByText(/^readings match the filters below\.$/),
    ).toBeInTheDocument();
    expect(screen.getByText("132")).toHaveTextContent("132");
  });

  it("sets the count in full ink at 700, not in the muted remainder", () => {
    renderHeader({ count: 132 }, false);
    const countEl = screen.getByText("132");
    expect(countEl).toHaveTextContent("132");
    expect(countEl).toHaveClass("font-bold");
    expect(countEl.className).toContain("var(--color-depth)");
    // The sentence around it stays quiet — the promotion is a contrast between
    // the two, so a muted parent is half the assertion.
    expect(countEl.parentElement?.className).toContain("var(--color-muted)");
  });
});
