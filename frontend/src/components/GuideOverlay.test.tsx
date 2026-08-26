// Behavior tests for GuideOverlay (D-01..D-13; 11-UI-SPEC.md's Phase-Specific
// Component Contract) — locks the closed→null / open→full-content render,
// Escape/Close→setOpen(false), the absence of modal/focus-trap semantics,
// presence of all 9 section headings, the Upload/Add-a-Record "By voice:"
// omission (D-13), and full VOICE_COMMAND_CATEGORIES coverage in the "What
// Can I Say" section (D-08/D-09/D-10) — sourced from voiceCommands.ts, never
// re-authored here.
//
// No QueryClientProvider needed — this component makes no network calls.
import { fireEvent, render, screen } from "@testing-library/react";
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
});
