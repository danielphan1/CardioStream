// Behavior tests for ShellNav (16.1-03). The first five re-home the demo-mode
// assertions Header.test.tsx owns today, because plan 16.1-06 deletes that
// file; the rest cover what ShellNav adds (aria-current, the Readings
// destination, the includeGuide gate, and the 48px floor).
//
// Reads from the REAL useAuth/useView/useTheme/useSpeech/useGuide zustand
// stores and a REAL useHealth()/QueryClientProvider; only getHealth is mocked
// at the api/client boundary (same "mock only the boundary" discipline as
// Header.test.tsx and AgentStatusBanner.test.tsx).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { useView } from "../store/view";
import { ShellNav } from "./ShellNav";

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

function renderShellNav(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

/** The write surfaces are present while /health is still loading (demo
 *  defaults false), so a demo-mode absence assertion has to wait for the query
 *  to settle or it passes against the wrong state. */
async function awaitDemoSuppression() {
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  mockGetHealth.mockReset();
  // useView is a real module-level store shared across tests in this file.
  useView.setState({ view: "dashboard" });
});

describe("ShellNav hidden write destinations (D-04, re-homed from Header.test.tsx)", () => {
  it("hides Upload when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderShellNav(<ShellNav />);

    await awaitDemoSuppression();
    // Dashboard is still there — the write surface vanished, not the nav.
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("hides Add Record when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderShellNav(<ShellNav />);

    await awaitDemoSuppression();
    expect(
      screen.queryByRole("button", { name: "Add Record" }),
    ).not.toBeInTheDocument();
  });

  it("shows Upload and Add Record when demo: false (unchanged current behavior)", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderShellNav(<ShellNav />);

    expect(
      await screen.findByRole("button", { name: "Upload" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Record" }),
    ).toBeInTheDocument();
  });

  it("still shows Log out when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderShellNav(<ShellNav />);

    await awaitDemoSuppression();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeInTheDocument();
  });

  it("still shows the Theme, Voice Replies and Guide toggles when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderShellNav(<ShellNav />);

    await awaitDemoSuppression();
    expect(screen.getByRole("button", { name: /Light|Dark/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Voice Replies/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guide" })).toBeInTheDocument();
  });
});

describe("ShellNav selected destination", () => {
  it("marks only the item matching the current view with aria-current=page", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    useView.setState({ view: "upload" });
    renderShellNav(<ShellNav />);

    const upload = await screen.findByRole("button", { name: "Upload" });
    expect(upload).toHaveAttribute("aria-current", "page");

    for (const name of ["Dashboard", "Readings", "Add Record"]) {
      expect(screen.getByRole("button", { name })).not.toHaveAttribute(
        "aria-current",
      );
    }
  });

  it("navigates to the Readings destination and fires onNavigate", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const onNavigate = vi.fn();
    renderShellNav(<ShellNav onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "Readings" }));

    expect(useView.getState().view).toBe("readings");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("ShellNav includeGuide gate (UI-SPEC 5.2 superseding note)", () => {
  it("renders exactly one guide-toggle-button at the default includeGuide (the rail)", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderShellNav(<ShellNav />);

    await screen.findByRole("button", { name: "Guide" });
    expect(document.querySelectorAll("#guide-toggle-button")).toHaveLength(1);
  });

  it("renders no Guide control and no guide-toggle-button under includeGuide=false (the nav panel)", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderShellNav(<ShellNav includeGuide={false} />);

    await screen.findByRole("button", { name: "Upload" });
    expect(screen.queryByRole("button", { name: "Guide" })).toBeNull();
    expect(document.querySelectorAll("#guide-toggle-button")).toHaveLength(0);
  });

  it("keeps Theme, Voice Replies and Log out under includeGuide=false", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderShellNav(<ShellNav includeGuide={false} />);

    await screen.findByRole("button", { name: "Upload" });
    expect(screen.getByRole("button", { name: /Light|Dark/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Voice Replies/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeInTheDocument();
  });
});

describe("ShellNav accessibility floor", () => {
  it("every control carries min-h-12 (the 48px floor)", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderShellNav(<ShellNav />);

    await screen.findByRole("button", { name: "Upload" });
    const buttons = container.querySelectorAll("button");
    // 4 destinations + Theme / Voice Replies / Guide / Log out.
    expect(buttons).toHaveLength(8);
    for (const button of Array.from(buttons)) {
      expect(button.className).toContain("min-h-12");
    }
  });
});
