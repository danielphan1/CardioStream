// Behavior tests for LeftRail (16.1-05, UI-SPEC §5.1). Reads from the REAL
// zustand stores and a REAL useHealth()/QueryClientProvider; only getHealth is
// mocked at the api/client boundary (the same "mock only the boundary"
// discipline as Header.test.tsx and ShellNav.test.tsx).
//
// LeftRail is rendered DIRECTLY here, not through the shell: plan 16.1-06 owns
// the useMediaQuery choice between this rail and SlimTopBar, and jsdom has no
// matchMedia at all, so the shell would always pick the slim bar and the rail
// would never mount. Rendering the component itself is what keeps this
// coverage real rather than vacuous.
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { useHealth } from "../hooks/useHealth";
import { LeftRail } from "./LeftRail";

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

/** Wave-2 trap: `data?.demo ?? false` is false while /health is still in
 *  flight, so a demo-mode ABSENCE assertion passes against the loading state
 *  unless the query has settled. This probe shares the surrounding
 *  QueryClient's ["health"] cache entry and renders a marker only once that
 *  entry has data, so the absence assertions below run on the settled tree. */
function HealthProbe() {
  return <span>{useHealth().data ? "health-settled" : "health-loading"}</span>;
}

function renderRail(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
      <HealthProbe />
    </QueryClientProvider>,
  );
}

/** The rail's root is the first child React renders — the element carrying the
 *  width, the border and the `inert` passthrough. */
function railRoot(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("rail root not rendered");
  return root;
}

beforeEach(() => {
  mockGetHealth.mockReset();
});

describe("LeftRail title (§5.1)", () => {
  it("renders exactly one h1 named 'Chris's Health Dashboard'", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderRail(<LeftRail />);

    await screen.findByText("health-settled");
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName("Chris's Health Dashboard");
    // The same type token as SlimTopBar, so the outline is not
    // viewport-dependent.
    expect(container.querySelector("h1")?.className).toContain("text-label");
  });
});

describe("LeftRail demo badge (D-08, re-homed from Header.test.tsx)", () => {
  it("shows a role=status 'Guest Demo · Synthetic Data' badge when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderRail(<LeftRail />);

    const badge = await screen.findByRole("status");
    expect(badge).toHaveTextContent("Guest Demo · Synthetic Data");
    // It must be allowed to wrap across the 208px item width, never truncate.
    expect(badge.className).not.toContain("whitespace-nowrap");
    expect(badge.className).not.toContain("truncate");
  });

  it("shows no badge at all once /health has settled with demo: false", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderRail(<LeftRail />);

    await screen.findByText("health-settled");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("LeftRail surface (§5.0/§5.1 Flat-Sea Rule)", () => {
  it("is a 240px rail with a hairline border on its right edge only", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderRail(<LeftRail />);

    await screen.findByText("health-settled");
    const root = railRoot(container);
    expect(root.className).toContain("w-60");
    // 1px --color-hairline since the "Open Water" re-skin (quick 261003-hev);
    // it was a 2px --color-depth edge. Still one edge, still only on the
    // right — the Flat-Sea Rule this test guards is about WHICH edges carry a
    // boundary, not how thick it is.
    expect(root.className).toContain("border-r");
    expect(root.className).not.toContain("border-r-2");
    expect(root.className).toContain("border-[var(--color-hairline)]");
    expect(root.className).toContain("shrink-0");
  });

  it("is flat and unlayered: no elevation class and no stacking offset", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderRail(<LeftRail />);

    await screen.findByText("health-settled");
    const root = railRoot(container);
    // Flat-Sea: a control surface, not an island.
    expect(root.className).not.toContain("shadow-");
    // §5.0 relies on the rail staying on the automatic layer so the guide's
    // backdrop covers it completely.
    expect(root.className).not.toMatch(/(^|\s)z-/);
  });

  it("scrolls vertically but never horizontally (No-Off-Screen Rule)", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderRail(<LeftRail />);

    await screen.findByText("health-settled");
    const root = railRoot(container);
    expect(root.className).toContain("overflow-y-auto");
    expect(root.className).not.toContain("overflow-x");
  });
});

describe("LeftRail inert passthrough (§5.0)", () => {
  it("carries the inert attribute when inert is true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderRail(<LeftRail inert />);

    await screen.findByText("health-settled");
    expect(railRoot(container)).toHaveAttribute("inert");
  });

  it("carries no inert attribute when inert is false", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    const { container } = renderRail(<LeftRail inert={false} />);

    await screen.findByText("health-settled");
    expect(railRoot(container)).not.toHaveAttribute("inert");
  });
});

describe("LeftRail controls", () => {
  it("renders ShellNav's four destinations and four utilities", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: false }));
    renderRail(<LeftRail />);

    await screen.findByText("health-settled");
    for (const name of [
      "Dashboard",
      "Readings",
      "Upload",
      "Add Record",
      "Guide",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Light|Dark/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voice Replies/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeInTheDocument();
    // The rail keeps the Guide, and it is the only one in the DOM (§5.2).
    expect(document.querySelectorAll("#guide-toggle-button")).toHaveLength(1);
  });
});
