// Behavior tests for GuideOverlay (D-01..D-13; 11-UI-SPEC.md's Phase-Specific
// Component Contract) — locks the closed→null / open→full-content render,
// Escape/Close→setOpen(false), the absence of modal/focus-trap semantics,
// presence of all 9 section headings, the Upload/Add-a-Record "By voice:"
// omission (D-13), and full VOICE_COMMAND_CATEGORIES coverage in the "What
// Can I Say" section (D-08/D-09/D-10) — sourced from voiceCommands.ts, never
// re-authored here.
//
// No QueryClientProvider needed — this component makes no network calls.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { VOICE_COMMAND_CATEGORIES } from "../lib/voiceCommands";
import { useGuide } from "../store/guide";
import { GuideOverlay } from "./GuideOverlay";

beforeEach(() => {
  useGuide.setState({ open: false });
});

describe("GuideOverlay", () => {
  it("renders nothing when closed", () => {
    render(<GuideOverlay />);
    expect(
      screen.queryByRole("region", { name: "Site guide" }),
    ).not.toBeInTheDocument();
  });

  it("renders the region and h1 when open", () => {
    useGuide.setState({ open: true });
    render(<GuideOverlay />);
    expect(
      screen.getByRole("region", { name: "Site guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Site Guide" }),
    ).toBeInTheDocument();
  });

  it("renders all 9 section headings", () => {
    useGuide.setState({ open: true });
    render(<GuideOverlay />);
    const headings = [
      "Command Bar",
      "Filters",
      "Charts",
      "Overlay",
      "Voice Replies",
      "Upload",
      "Add a Record",
      "What Can I Say",
      "About This Guide",
    ];
    for (const name of headings) {
      expect(
        screen.getByRole("heading", { name }),
      ).toBeInTheDocument();
    }
  });

  it("pressing Escape closes the guide", () => {
    useGuide.setState({ open: true });
    render(<GuideOverlay />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useGuide.getState().open).toBe(false);
  });

  it("clicking the Close button closes the guide", () => {
    useGuide.setState({ open: true });
    render(<GuideOverlay />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(useGuide.getState().open).toBe(false);
  });

  it("has no dialog/modal semantics", () => {
    useGuide.setState({ open: true });
    const { container } = render(<GuideOverlay />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-modal")).toBeNull();
  });

  it("omits 'By voice:' for the Upload and Add a Record sections", () => {
    useGuide.setState({ open: true });
    const { container } = render(<GuideOverlay />);
    const upload = container.querySelector("#upload");
    const addRecord = container.querySelector("#add-a-record");
    expect(upload?.textContent).not.toContain("By voice:");
    expect(addRecord?.textContent).not.toContain("By voice:");
  });

  it("renders every VOICE_COMMAND_CATEGORIES example phrase", () => {
    useGuide.setState({ open: true });
    render(<GuideOverlay />);
    for (const c of VOICE_COMMAND_CATEGORIES) {
      expect(screen.getByText(`"${c.example}"`)).toBeInTheDocument();
    }
  });

  it("sets the region's inline top style from clearanceAbove, or the default fallback", () => {
    useGuide.setState({ open: true });
    const { container, unmount } = render(
      <GuideOverlay clearanceAbove={300} />,
    );
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect((region as HTMLElement).style.top).toBe("300px");
    unmount();

    const { container: container2 } = render(<GuideOverlay />);
    const region2 = container2.querySelector('[role="region"]');
    expect(region2).not.toBeNull();
    expect((region2 as HTMLElement).style.top).toBe("261px");
  });

  it("constrains the region to fixed inset-x-0 bottom-0, never inset-0", () => {
    useGuide.setState({ open: true });
    const { container } = render(<GuideOverlay />);
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    const className = (region as HTMLElement).className;
    expect(className).not.toMatch(/\binset-0\b/);
    expect(className).toMatch(/\binset-x-0\b/);
    expect(className).toMatch(/\bbottom-0\b/);
  });

  it("renders a full-viewport aria-hidden backdrop distinct from the Close icon", () => {
    useGuide.setState({ open: true });
    const { container } = render(<GuideOverlay />);
    const backdrop = container.querySelector('div[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    const className = (backdrop as HTMLElement).className;
    expect(className).toMatch(/\bfixed\b/);
    expect(className).toMatch(/\binset-0\b/);
    expect(className).not.toMatch(/\binset-x-0\b/);
    expect(className).not.toMatch(/\bbottom-0\b/);
  });

  it("backdrop is decorative (no role) and a distinct DOM node from the region", () => {
    useGuide.setState({ open: true });
    const { container } = render(<GuideOverlay />);
    const backdrop = container.querySelector('div[aria-hidden="true"]');
    const region = container.querySelector('[role="region"]');
    expect(backdrop).not.toBeNull();
    expect(region).not.toBeNull();
    expect(backdrop?.getAttribute("role")).toBeNull();
    expect(backdrop === region).toBe(false);
  });

  it("keeps the region mounted immediately after close, then removes it once the exit fade completes", async () => {
    useGuide.setState({ open: true });
    render(<GuideOverlay />);
    expect(
      screen.getByRole("region", { name: "Site guide" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    // Still present immediately after the close click -- the exit fade has
    // not finished, so the delayed-unmount mechanism must keep it mounted.
    expect(
      screen.getByRole("region", { name: "Site guide" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Site guide" }),
      ).not.toBeInTheDocument();
    });
  });

  it("gives both the backdrop and the region a motion-reduce-gated opacity transition", () => {
    useGuide.setState({ open: true });
    const { container } = render(<GuideOverlay />);
    const backdrop = container.querySelector('div[aria-hidden="true"]');
    const region = container.querySelector('[role="region"]');
    expect(backdrop).not.toBeNull();
    expect(region).not.toBeNull();
    for (const el of [backdrop, region]) {
      const className = (el as HTMLElement).className;
      expect(className).toMatch(/transition-opacity/);
      expect(className).toMatch(/motion-reduce:transition-none/);
    }
  });
});
