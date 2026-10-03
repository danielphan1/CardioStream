// Behavior tests for AssistantPopup (quick 261002-kem) — the four properties
// that make the assistant dismissible WITHOUT costing the primary user his
// primary input method:
//   1. open by default (a first visit behaves as the old pinned band)
//   2. Close hides the card, and the dismissal persists to localStorage
//   3. the Command Bar stays MOUNTED while the card is hidden, so the live
//      SpeechRecognition session survives being dismissed
//   4. a wake-word hit re-opens the card by itself (hands-free recovery)
//
// Only the two api/client boundaries CommandBar + AgentStatusBanner reach are
// mocked (postAgent, getHealth); the real stores, the real useDismissable and a
// real QueryClientProvider run, mirroring CommandBar.test.tsx's discipline.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getHealth } from "../api/client";
import type { HealthStatus } from "../api/types";
import { useAgentStatus } from "../store/agentStatus";
import { useAssistant } from "../store/assistant";
import { useSpeech } from "../store/speech";
import {
  FakeRecognition,
  installFakeRecognition,
} from "../tests/fakeRecognition";
import { installFakeSpeechSynthesis } from "../tests/fakeSpeechSynthesis";
import { AssistantPopup } from "./AssistantPopup";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, getHealth: vi.fn(), postAgent: vi.fn() };
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

function renderPopup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantPopup latestReading={null} />
    </QueryClientProvider>,
  );
}

const panel = () => document.getElementById("assistant-panel")!;
const trigger = () =>
  screen.getByRole("button", { name: /Assistant/, expanded: undefined });
const commandBar = () =>
  document.querySelector('section[aria-label="Command bar"]');

let getRec: () => FakeRecognition | null;

beforeEach(() => {
  mockGetHealth.mockResolvedValue(health());
  localStorage.clear();
  useAssistant.setState({ open: true });
  useAgentStatus.setState({ unavailable: false });
  useSpeech.setState({ enabled: true, isSpeaking: false, primed: false });
  installFakeSpeechSynthesis();
  getRec = installFakeRecognition();
});

afterEach(() => {
  delete (window as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
});

describe("AssistantPopup", () => {
  it("starts open, with the Command Bar visible and the trigger expanded", () => {
    renderPopup();

    expect(panel()).not.toHaveAttribute("hidden");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("textbox", { name: "Type a dashboard command" }),
    ).toBeInTheDocument();
  });

  it("hides the card on Close but keeps the Command Bar mounted", async () => {
    renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // `hidden` lands after the 250ms exit fade (useDismissable's delayed
    // unmount gate), which is what takes the card out of the a11y tree and the
    // tab order.
    await waitFor(() => expect(panel()).toHaveAttribute("hidden"));
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    // The load-bearing half: the component (and therefore the live recognizer
    // session inside useVoiceCommand) is still mounted.
    expect(commandBar()).not.toBeNull();
    // ...but no longer reachable by role, since `hidden` removes it from the
    // accessibility tree.
    expect(
      screen.queryByRole("textbox", { name: "Type a dashboard command" }),
    ).toBeNull();
  });

  it("returns focus to the trigger when the card is closed", async () => {
    renderPopup();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(document.getElementById("assistant-toggle-button")).toHaveFocus(),
    );
  });

  it("closes on Escape", async () => {
    renderPopup();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(panel()).toHaveAttribute("hidden"));
  });

  it("persists the dismissal so a reload starts closed", async () => {
    const first = renderPopup();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(panel()).toHaveAttribute("hidden"));
    first.unmount();

    // What main.tsx does before first paint on the next load.
    act(() => useAssistant.getState().initAssistant());
    renderPopup();

    expect(panel()).toHaveAttribute("hidden");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("re-opens on the trigger after a dismissal", async () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(panel()).toHaveAttribute("hidden"));

    fireEvent.click(trigger());

    expect(panel()).not.toHaveAttribute("hidden");
    expect(useAssistant.getState().open).toBe(true);
  });

  it("re-opens itself when the wake word fires while dismissed (hands-free)", async () => {
    renderPopup();

    // Arm the session while the card is open (the mic lives inside it), then
    // dismiss: the recognizer keeps listening.
    fireEvent.click(screen.getByRole("button", { name: "Start voice control" }));
    const rec = getRec()!;
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(panel()).toHaveAttribute("hidden"));

    act(() => rec.emitResult("dashboard show my pulse", false));

    expect(panel()).not.toHaveAttribute("hidden");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    // The stripped transcript is visible again, in the card it re-opened.
    expect(screen.getByText("show my pulse")).toBeInTheDocument();
  });

  it("keeps both controls above the 48px target floor (CLAUDE.md)", () => {
    renderPopup();

    // min-h-14 = 56px on the trigger, min-h-12 = 48px on Close.
    expect(trigger().className).toContain("min-h-14");
    expect(screen.getByRole("button", { name: "Close" }).className).toContain(
      "min-h-12",
    );
  });
});
