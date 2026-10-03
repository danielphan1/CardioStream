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

  it("uses the singular for exactly one reading", () => {
    renderHeader({ count: 1 }, false);
    expect(
      screen.getByText("1 reading matches the filters below."),
    ).toBeInTheDocument();
  });

  it("uses the plural otherwise", () => {
    renderHeader({ count: 132 }, false);
    expect(
      screen.getByText("132 readings match the filters below."),
    ).toBeInTheDocument();
  });
});
