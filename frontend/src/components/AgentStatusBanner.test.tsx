// Behavior tests for AgentStatusBanner (Phase 6, LIVE-02/LIVE-03, D-08,
// D-09..D-11) — reads from the REAL useAgentStatus store and a REAL
// useHealth()/QueryClientProvider; only getHealth is mocked at the api/client
// boundary (mirrors CommandBar.test.tsx's "mock only the boundary"
// discipline). Store reset in beforeEach, same as every other store test.
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { AGENT_UNAVAILABLE_BANNER_COPY } from "../lib/copy";
import { useAgentStatus } from "../store/agentStatus";
import { AgentStatusBanner } from "./AgentStatusBanner";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, getHealth: vi.fn() };
});

const mockGetHealth = getHealth as unknown as Mock;

function health(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return { status: "ok", agent_configured: true, agent_reachable: true, ...overrides };
}

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentStatusBanner />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetHealth.mockReset();
  useAgentStatus.setState({ unavailable: false });
});

describe("AgentStatusBanner reachable case", () => {
  it("renders nothing while the assistant is reachable", async () => {
    mockGetHealth.mockResolvedValue(health());
    renderBanner();

    await waitFor(() =>
      expect(useAgentStatus.getState().unavailable).toBe(false),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders nothing on a fresh boot (agent_reachable: null) — optimistic default", async () => {
    mockGetHealth.mockResolvedValue(
      health({ agent_reachable: null, agent_configured: true }),
    );
    renderBanner();

    await waitFor(() => expect(mockGetHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("AgentStatusBanner unavailable case (LIVE-02)", () => {
  it("renders the persistent card with role=status when the store says unavailable", () => {
    useAgentStatus.setState({ unavailable: true });
    mockGetHealth.mockResolvedValue(health());
    renderBanner();

    const card = screen.getByRole("status");
    expect(card).toHaveTextContent(AGENT_UNAVAILABLE_BANNER_COPY);
  });

  it("renders the banner when /health reports agent_reachable: false", async () => {
    mockGetHealth.mockResolvedValue(
      health({ agent_reachable: false, agent_configured: true }),
    );
    renderBanner();

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent(
      AGENT_UNAVAILABLE_BANNER_COPY,
    );
  });

  it("renders the banner when /health reports agent_configured: false", async () => {
    mockGetHealth.mockResolvedValue(
      health({ agent_configured: false, agent_reachable: null }),
    );
    renderBanner();

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeNull());
  });

  it("renders the SAME banner (fail-safe default) when the /health fetch itself errors", async () => {
    mockGetHealth.mockRejectedValue(new Error("network down"));
    renderBanner();

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent(
      AGENT_UNAVAILABLE_BANNER_COPY,
    );
  });

  it("never renders a dismiss/retry button anywhere in the card (D-11)", () => {
    useAgentStatus.setState({ unavailable: true });
    mockGetHealth.mockResolvedValue(health());
    renderBanner();

    expect(screen.queryByRole("status")?.querySelector("button")).toBeNull();
  });
});
