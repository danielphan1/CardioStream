// Behavior tests for NavPanel (16.1-05, UI-SPEC §5.2) — one per bullet of the
// plan's behaviour block. The focus and no-trap assertions are the ones that
// matter: a regression there strands a keyboard or switch-access user away
// from the mic, and that user is the primary user (D-03/D-04, T-16.1-19).
//
// Reads from the REAL zustand stores and a REAL useHealth()/QueryClientProvider
// (ShellNav needs one); only getHealth is mocked at the api/client boundary.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { DISMISSABLE_FADE_MS } from "../hooks/useDismissable";
import { useView } from "../store/view";
import { NavPanel } from "./NavPanel";

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

type PanelProps = React.ComponentProps<typeof NavPanel>;

const DEFAULTS: PanelProps = {
  open: true,
  onClose: () => {},
  clearanceAbove: 120,
};

function renderPanel(props: Partial<PanelProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const merged: PanelProps = { ...DEFAULTS, ...props };
  const tree = (p: PanelProps) => (
    <QueryClientProvider client={queryClient}>
      <NavPanel {...p} />
    </QueryClientProvider>
  );
  const result = render(tree(merged));
  return {
    ...result,
    setProps: (next: Partial<PanelProps>) =>
      result.rerender(tree({ ...merged, ...next })),
  };
}

/** The panel restores focus to the slim bar's menu trigger by id, so the tests
 *  that exercise that path need a real target in the document. */
function appendTrigger(): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = "menu-trigger-button";
  document.body.appendChild(button);
  return button;
}

beforeEach(() => {
  mockGetHealth.mockReset();
  mockGetHealth.mockResolvedValue(health({ demo: false }));
  useView.setState({ view: "dashboard" });
});

afterEach(() => {
  vi.useRealTimers();
  document.getElementById("menu-trigger-button")?.remove();
});

describe("NavPanel mounting", () => {
  it("renders nothing at all when it has never been open", () => {
    const { container } = renderPanel({ open: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the Close control, the Menu heading and ShellNav's controls when open", async () => {
    renderPanel();

    expect(
      await screen.findByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveAccessibleName("Menu");
    // The panel's own accessible name comes from that heading.
    expect(document.getElementById("nav-panel")).toHaveAttribute(
      "aria-labelledby",
      heading.id,
    );
    for (const name of ["Dashboard", "Readings", "Upload", "Add Record"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("stays mounted for the full exit fade and then unmounts", () => {
    vi.useFakeTimers();
    // A never-settling /health keeps this fake-timer test free of async state
    // updates it would otherwise have to flush.
    mockGetHealth.mockReturnValue(new Promise(() => {}));
    const { container, setProps } = renderPanel();

    expect(container.querySelector("#nav-panel")).not.toBeNull();

    setProps({ open: false });
    act(() => {
      vi.advanceTimersByTime(DISMISSABLE_FADE_MS - 1);
    });
    expect(container.querySelector("#nav-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector("#nav-panel")).toBeNull();
  });
});

describe("NavPanel dismissal (§5.2 routes a/b/c)", () => {
  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await screen.findByRole("button", { name: "Close" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from the sticky Close button", async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(await screen.findByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when any destination is selected, and navigates", async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(await screen.findByRole("button", { name: "Readings" }));

    expect(useView.getState().view).toBe("readings");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("NavPanel focus management (D-03/D-04, T-16.1-19)", () => {
  it("lands focus on the Close button on open", async () => {
    renderPanel();

    const close = await screen.findByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);
  });

  it("returns focus to the menu trigger on close", async () => {
    const trigger = appendTrigger();
    const { setProps } = renderPanel();

    await screen.findByRole("button", { name: "Close" });
    expect(document.activeElement).not.toBe(trigger);

    setProps({ open: false });

    expect(document.activeElement).toBe(trigger);
  });

  it("traps no focus: it is a disclosure, not a modal", async () => {
    const { container } = renderPanel();

    await screen.findByRole("button", { name: "Close" });
    // No modal semantics, and no key handler that would cycle focus back in —
    // a trap would lock a switch-access user away from the mic.
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(container.querySelectorAll("[aria-modal]")).toHaveLength(0);
    expect(document.getElementById("nav-panel")).toHaveAttribute(
      "role",
      "group",
    );

    // Focus moved outside the panel stays outside.
    const outside = appendTrigger();
    outside.focus();
    fireEvent.keyDown(outside, { key: "Tab" });
    expect(document.activeElement).toBe(outside);
  });
});

describe("NavPanel contents that must NOT be here", () => {
  it("renders no page-title heading and no status badge: both live in the slim bar", async () => {
    mockGetHealth.mockResolvedValue(health({ demo: true }));
    renderPanel();

    await screen.findByRole("button", { name: "Close" });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    // T-16.1-18: the provenance badge must be reachable without opening
    // anything, so it is never behind this disclosure.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders no Guide control, but keeps Theme, Voice Replies and Log out", async () => {
    const { container } = renderPanel();

    await screen.findByRole("button", { name: "Close" });
    // §5.2 superseding note / T-16.1-19a: the Guide is an always-visible
    // slim-bar control, so the two overlays can never stack and GuideOverlay's
    // id-based focus restore always has a target.
    expect(screen.queryByRole("button", { name: "Guide" })).toBeNull();
    expect(container.querySelectorAll("#guide-toggle-button")).toHaveLength(0);

    expect(screen.getByRole("button", { name: /Light|Dark/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voice Replies/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeInTheDocument();
  });
});

describe("NavPanel backdrop (T-16.1-20)", () => {
  it("is a separate aria-hidden full-viewport element, not the panel's own box", async () => {
    const { container } = renderPanel();

    await screen.findByRole("button", { name: "Close" });
    expect(container.children).toHaveLength(2);
    const [backdrop, panel] = Array.from(container.children);
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop.className).toContain("fixed inset-0");
    expect(panel).toHaveAttribute("id", "nav-panel");
    // The panel's own box is offset by the measured band height, so it cannot
    // guarantee opaque coverage on its own — hence the split element.
    expect(panel).toHaveStyle({ top: "120px" });
  });
});
