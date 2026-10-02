// Behavior tests for SlimTopBar (16.1-05, UI-SPEC §5.2). Reads from the REAL
// useGuide zustand store and a REAL useHealth()/QueryClientProvider; only
// getHealth is mocked at the api/client boundary (the same "mock only the
// boundary" discipline as Header.test.tsx and ShellNav.test.tsx).
//
// The first block re-homes the demo-badge assertions Header.test.tsx owns
// today (plan 16.1-06 deletes that file). The last block is the compensating
// unit coverage for the Guide control, which was browser-only while it lived
// in the header: moving it into this bar (§5.2 superseding note) is what makes
// it unit-testable, because jsdom has no matchMedia so the shell always picks
// this slim-bar branch.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { useHealth } from "../hooks/useHealth";
import { useGuide } from "../store/guide";
import { SlimTopBar } from "./SlimTopBar";

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
 *  entry has data. */
function HealthProbe() {
  return <span>{useHealth().data ? "health-settled" : "health-loading"}</span>;
}

function renderBar(props: Partial<React.ComponentProps<typeof SlimTopBar>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SlimTopBar menuOpen={false} onToggleMenu={() => {}} {...props} />
      <HealthProbe />
    </QueryClientProvider>,
  );
}

function barRoot(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("bar root not rendered");
  return root;
}

beforeEach(() => {
  mockGetHealth.mockReset();
  mockGetHealth.mockResolvedValue(health({ demo: false }));
});

afterEach(() => {
  // useGuide is a real module-level store shared across tests in this file —
  // reset it so the Guide cases below cannot leak into each other.
  useGuide.setState({ open: false });
});

describe("SlimTopBar title and surface (§5.2)", () => {
  it("renders exactly one h1 named 'Chris's Health Dashboard'", async () => {
    const { container } = renderBar();

    await screen.findByText("health-settled");
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName("Chris's Health Dashboard");
    expect(container.querySelector("h1")?.className).toContain("text-label");
  });

  it("is a flat bar with a 64px floor, not a fixed height", async () => {
    const { container } = renderBar();

    await screen.findByText("health-settled");
    const root = barRoot(container);
    expect(root.className).toContain("min-h-16");
    // A floor, never a fixed height — the bar must be free to wrap.
    expect(root.className).toContain("flex-wrap");
    expect(root.className).not.toMatch(/(^|\s)h-16(\s|$)/);
    expect(root.className).not.toContain("shadow-");
  });
});

describe("SlimTopBar demo badge (D-08/T-16.1-18, re-homed from Header.test.tsx)", () => {
  it("shows a role=status 'Guest Demo · Synthetic Data' badge when demo: true", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderBar();

    const badge = await screen.findByRole("status");
    expect(badge).toHaveTextContent("Guest Demo · Synthetic Data");
  });

  it("puts that badge in the bar itself, never behind the menu disclosure", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    const { container } = renderBar();

    const badge = await screen.findByRole("status");
    // Reachable with nothing open: it is a data-provenance disclosure, so it
    // cannot itself sit behind a disclosure control.
    expect(barRoot(container).contains(badge)).toBe(true);
    expect(
      screen.getByRole("button", { name: "Menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows no badge at all once /health has settled with demo: false", async () => {
    renderBar();

    await screen.findByText("health-settled");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("SlimTopBar menu trigger (§5.2)", () => {
  it("is an icon-plus-text 48px control with the stable trigger id", async () => {
    renderBar();

    await screen.findByText("health-settled");
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger).toHaveAttribute("id", "menu-trigger-button");
    expect(trigger).toHaveAttribute("aria-controls", "nav-panel");
    expect(trigger.className).toContain("min-h-12");
    // Never accent-filled: this is header chrome, not a destination.
    expect(trigger.className).not.toContain("--color-accent");
  });

  it("reports the panel collapsed when menuOpen is false", async () => {
    renderBar({ menuOpen: false });

    await screen.findByText("health-settled");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("reports the panel expanded when menuOpen is true", async () => {
    renderBar({ menuOpen: true });

    await screen.findByText("health-settled");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("calls onToggleMenu exactly once per activation", async () => {
    const onToggleMenu = vi.fn();
    renderBar({ onToggleMenu });

    await screen.findByText("health-settled");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(onToggleMenu).toHaveBeenCalledTimes(1);
  });
});

describe("SlimTopBar Guide control (§5.2 superseding note, 2026-10-01)", () => {
  it("mounts exactly one guide-toggle-button, as a 48px icon-plus-text control", async () => {
    renderBar();

    await screen.findByText("health-settled");
    const guide = screen.getByRole("button", { name: "Guide" });
    expect(guide).toHaveAttribute("id", "guide-toggle-button");
    expect(guide.className).toContain("min-h-12");
    // GuideOverlay's focus-restore and the agent's voice setOpen path both
    // resolve this id, so it must be unique and permanently mounted.
    expect(document.querySelectorAll("#guide-toggle-button")).toHaveLength(1);
  });

  it("reflects the guide store's open state", async () => {
    renderBar();

    await screen.findByText("health-settled");
    const guide = screen.getByRole("button", { name: "Guide" });
    expect(guide).toHaveAttribute("aria-pressed", "false");

    act(() => {
      useGuide.setState({ open: true });
    });
    expect(guide).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the guide store open and closed again on activation", async () => {
    renderBar();

    await screen.findByText("health-settled");
    const guide = screen.getByRole("button", { name: "Guide" });

    fireEvent.click(guide);
    expect(useGuide.getState().open).toBe(true);

    fireEvent.click(guide);
    expect(useGuide.getState().open).toBe(false);
  });

  it("is never accent-filled in either state, and keeps the label 'Guide'", async () => {
    renderBar();

    await screen.findByText("health-settled");
    const guide = screen.getByRole("button", { name: "Guide" });
    expect(guide.className).not.toContain("--color-accent");

    act(() => {
      useGuide.setState({ open: true });
    });
    // The pressed state plus the label carries the state; the overlay's own
    // Close control owns the dismiss verb (Copywriting Contract).
    expect(guide.className).not.toContain("--color-accent");
    expect(guide).toHaveAccessibleName("Guide");
  });
});
