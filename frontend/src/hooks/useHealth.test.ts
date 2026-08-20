// Behavior tests for useHealth (Phase 6, LIVE-03/D-05) — mirrors
// useVoiceCommand.test.ts's "mock only the boundary" discipline: getHealth
// is the ONLY mock, real QueryClientProvider, real query behavior.
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { useHealth } from "./useHealth";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, getHealth: vi.fn() };
});

const mockGetHealth = getHealth as unknown as Mock;

function health(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return { status: "ok", agent_configured: true, agent_reachable: true, ...overrides };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockGetHealth.mockReset();
});

describe("useHealth (LIVE-03 proactive page-load check)", () => {
  it("fetches /health on mount without any explicit trigger", async () => {
    mockGetHealth.mockResolvedValue(health());
    const { result } = renderHook(() => useHealth(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetHealth).toHaveBeenCalledTimes(1);
  });

  it("surfaces the resolved HealthStatus body verbatim", async () => {
    mockGetHealth.mockResolvedValue(
      health({ agent_configured: false, agent_reachable: null }),
    );
    const { result } = renderHook(() => useHealth(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      status: "ok",
      agent_configured: false,
      agent_reachable: null,
    });
  });

  it("surfaces isError when the /health fetch itself fails (fail-safe default)", async () => {
    mockGetHealth.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useHealth(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
