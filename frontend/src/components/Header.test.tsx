// Behavior tests for Header's demo-mode surfaces (Phase 19, D-04/D-08) — reads
// from the REAL useAuth/useView/useTheme/useSpeech/useGuide zustand stores and
// a REAL useHealth()/QueryClientProvider; only getHealth is mocked at the
// api/client boundary (mirrors AgentStatusBanner.test.tsx's "mock only the
// boundary" discipline).
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { Header } from "./Header";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, getHealth: vi.fn() };
});

const mockGetHealth = getHealth as unknown as Mock;

function health(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    status: "ok",
    agent_configured: true,
    agent_reachable: true,
    demo: false,
    ...overrides,
  };
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetHealth.mockReset();
});

describe("Header demo badge (D-08)", () => {
  it("shows a role=status 'Guest Demo · Synthetic Data' badge when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderWithQueryClient(<Header />);

    const badge = await screen.findByRole("status");
    expect(badge).toHaveTextContent("Guest Demo · Synthetic Data");
  });

  it("shows no badge at all when demo: false", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderWithQueryClient(<Header />);

    await screen.findByText("Chris's Health Dashboard");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Header hidden write buttons (D-04)", () => {
  it("hides Upload and Add Record when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderWithQueryClient(<Header />);

    await screen.findByRole("status");
    expect(
      screen.queryByRole("button", { name: "Upload" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Record" }),
    ).not.toBeInTheDocument();
  });

  it("shows Upload and Add Record when demo: false (unchanged current behavior)", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderWithQueryClient(<Header />);

    expect(
      await screen.findByRole("button", { name: "Upload" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Record" }),
    ).toBeInTheDocument();
  });

  it("still shows Log out and the theme/voice/guide toggles when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderWithQueryClient(<Header />);

    await screen.findByRole("status");
    expect(
      screen.getByRole("button", { name: /Log out/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Light|Dark/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Voice Replies/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guide" })).toBeInTheDocument();
  });
});
