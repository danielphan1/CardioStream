// Behavior tests for CommandBar (D-01..D-07, D-12; VOICE-06/07/08) — locks the
// idle→working→confirmed/clarify/error state machine, the store side effects of
// an applied command, the D-12 one-turn clarify-context round-trip, D-03 text
// persistence, and VOICE-07 friendly-copy-for-every-failure contract.
//
// postAgent is the ONLY mock: real useAgent, a real QueryClientProvider, and the
// real zustand stores (reset between tests) so the mutation path and store
// effects are exercised end to end. ApiError stays real so `instanceof` in the
// component's onError works.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ApiError } from "../api/client";
import { postAgent } from "../api/client";
import type { AgentReply } from "../api/types";
import { useAgentPulse } from "../lib/agent";
import { useAgentStatus } from "../store/agentStatus";
import { useFilters } from "../store/filters";
import { useSpeech } from "../store/speech";
import {
  FakeRecognition,
  installFakeRecognition,
} from "../tests/fakeRecognition";
import {
  FakeUtterance,
  installFakeSpeechSynthesis,
} from "../tests/fakeSpeechSynthesis";
import { CommandBar } from "./CommandBar";

// Keep the real module (ApiError, getJson, …) — replace only postAgent.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, postAgent: vi.fn() };
});

const mockPostAgent = postAgent as unknown as Mock;

function reply(overrides: Partial<AgentReply> = {}): AgentReply {
  return {
    kind: "applied",
    filters: null,
    message: "",
    context: null,
    ...overrides,
  };
}

function renderBar(latestReading: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandBar latestReading={latestReading} />
    </QueryClientProvider>,
  );
}

function typeAndSubmit(value: string) {
  const input = screen.getByRole("textbox", {
    name: "Type a dashboard command",
  });
  fireEvent.change(input, { target: { value } });
  // Enter-key submit (D-04): submitting the form is what the Enter key does in
  // a single-line input with a submit button.
  fireEvent.submit(input.closest("form")!);
}

beforeEach(() => {
  mockPostAgent.mockReset();
  installFakeSpeechSynthesis();
  useFilters.setState({
    activeChart: "bp_timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
  useAgentStatus.setState({ unavailable: false });
  useSpeech.setState({ enabled: true, isSpeaking: false, primed: false });
});

afterEach(() => {
  vi.clearAllTimers();
});

describe("CommandBar", () => {
  it("submits the trimmed text with null context via Enter (D-04)", async () => {
    mockPostAgent.mockResolvedValue(reply({ kind: "unclear", message: "?" }));
    renderBar();

    typeAndSubmit("show my pulse");

    await waitFor(() => expect(mockPostAgent).toHaveBeenCalledTimes(1));
    // Assert on the first arg only — React Query passes a second context arg.
    expect(mockPostAgent.mock.calls[0][0]).toEqual({
      text: "show my pulse",
      context: null,
    });
  });

  it("keeps the submitted text visible and locks controls while working (D-03)", async () => {
    // Never-resolving promise → the bar stays in the working state.
    mockPostAgent.mockReturnValue(new Promise<AgentReply>(() => {}));
    renderBar();

    typeAndSubmit("show my pulse");

    const input = screen.getByRole("textbox", {
      name: "Type a dashboard command",
    }) as HTMLInputElement;
    expect(await screen.findByText("Working…")).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input.value).toBe("show my pulse"); // text NOT cleared during working
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("applies filters, echoes full state, and clears the input (D-07)", async () => {
    mockPostAgent.mockResolvedValue(
      reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
    );
    renderBar();

    typeAndSubmit("show my pulse");

    const region = await screen.findByText(/^Showing pulse/);
    expect(region).toBeInTheDocument();
    // Store side effect: the chart actually switched.
    expect(useFilters.getState().activeChart).toBe("pulse_trend");
    // D-03: applied is the only kind that clears the input.
    const input = screen.getByRole("textbox", {
      name: "Type a dashboard command",
    }) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("appends the D-16 stats-bar pointer to the confirmation when present", async () => {
    mockPostAgent.mockResolvedValue(
      reply({
        kind: "applied",
        filters: { activeChart: "bp_timeline" },
        message: "Your averages are in the stats bar below.",
      }),
    );
    renderBar();

    typeAndSubmit("what's my average bp");

    const region = await screen.findByText(/Showing blood pressure/);
    expect(region.textContent).toMatch(
      /Your averages are in the stats bar below\.$/,
    );
  });

  it("resends the clarify context on the follow-up submit (D-12)", async () => {
    const context = {
      original_text: "show me the numbers",
      question: "Which chart?",
    };
    mockPostAgent
      .mockResolvedValueOnce(reply({ kind: "clarify", message: "Which chart?", context }))
      .mockResolvedValueOnce(
        reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
      );
    renderBar();

    typeAndSubmit("show me the numbers");
    // The clarifying question surfaces in the bar.
    expect(await screen.findByText("Which chart?")).toBeInTheDocument();

    typeAndSubmit("pulse");

    await waitFor(() => expect(mockPostAgent).toHaveBeenCalledTimes(2));
    // Second call carries the stored one-turn context verbatim (first arg only).
    expect(mockPostAgent.mock.calls[1][0]).toEqual({
      text: "pulse",
      context,
    });
  });

  it("renders an unclear reply verbatim and keeps the text for editing (D-11)", async () => {
    mockPostAgent.mockResolvedValue(
      reply({
        kind: "unclear",
        message: "Didn't catch that. Try: 'show my pulse' or 'last 30 days'.",
      }),
    );
    renderBar();

    typeAndSubmit("asdfghjkl");

    expect(
      await screen.findByText(
        "Didn't catch that. Try: 'show my pulse' or 'last 30 days'.",
      ),
    ).toBeInTheDocument();
    const input = screen.getByRole("textbox", {
      name: "Type a dashboard command",
    }) as HTMLInputElement;
    expect(input.value).toBe("asdfghjkl"); // NOT cleared — user can edit & retry
  });

  it("renders an unavailable reply and reports it to agentStatus, keeping the text for retry (D-07/LIVE-01)", async () => {
    mockPostAgent.mockResolvedValue(
      reply({
        kind: "unavailable",
        message:
          "The assistant isn't connected right now. The buttons below still work — use them to change the view.",
      }),
    );
    renderBar();

    typeAndSubmit("show my pulse");

    expect(
      await screen.findByText(
        "The assistant isn't connected right now. The buttons below still work — use them to change the view.",
      ),
    ).toBeInTheDocument();
    const input = screen.getByRole("textbox", {
      name: "Type a dashboard command",
    }) as HTMLInputElement;
    expect(input.value).toBe("show my pulse"); // NOT cleared — user can retry
    expect(useAgentStatus.getState().unavailable).toBe(true);
  });

  it("clears agentStatus.unavailable the instant any other reply kind succeeds (D-07)", async () => {
    useAgentStatus.setState({ unavailable: true });
    mockPostAgent.mockResolvedValue(reply({ kind: "applied", filters: null }));
    renderBar();

    typeAndSubmit("show my pulse");

    await waitFor(() => expect(mockPostAgent).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(useAgentStatus.getState().unavailable).toBe(false),
    );
  });

  it("maps a 429 to fixed friendly copy, never the raw error (VOICE-07)", async () => {
    mockPostAgent.mockRejectedValue(new ApiError(429, "/agent"));
    renderBar();

    typeAndSubmit("show my pulse");

    expect(
      await screen.findByText(
        "One moment — a lot of commands at once. Try again in a few seconds.",
      ),
    ).toBeInTheDocument();
    // The raw ApiError message must never surface.
    expect(screen.queryByText(/API request failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/429/)).not.toBeInTheDocument();
  });

  it("maps a network failure to offline copy with an example command (VOICE-07)", async () => {
    mockPostAgent.mockRejectedValue(new ApiError(0, "/agent"));
    renderBar();

    typeAndSubmit("show my pulse");

    const region = await screen.findByText(/Couldn't reach the assistant/);
    expect(region.textContent).toContain("show my pulse");
  });

  it("exposes accessible names and a polite live region", async () => {
    mockPostAgent.mockResolvedValue(
      reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
    );
    renderBar();

    // Input has a real accessible name independent of the placeholder (Pitfall 8).
    expect(
      screen.getByRole("textbox", { name: "Type a dashboard command" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();

    typeAndSubmit("show my pulse");
    const region = await screen.findByText(/^Showing pulse/);
    // The announced reply lives in an aria-live=polite container (D-05/D-06).
    expect(region.closest("[aria-live='polite']")).not.toBeNull();
  });

  it("speaks the exact on-screen confirmation text on an applied reply (TTS-01)", async () => {
    mockPostAgent.mockResolvedValue(
      reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
    );
    renderBar();

    typeAndSubmit("show my pulse");

    await screen.findByText(/^Showing pulse/);
    // onSubmit's primeSpeech() call creates an earlier utterance (text === " ")
    // first — assert on the LAST instance, not the instance count.
    expect(FakeUtterance.instances.at(-1)?.text).toMatch(/^Showing pulse/);
  });

  it("does not speak new content for clarify/refuse/unclear/unavailable replies, only the priming utterance", async () => {
    mockPostAgent.mockResolvedValue(
      reply({
        kind: "unclear",
        message: "Didn't catch that. Try: 'show my pulse' or 'last 30 days'.",
      }),
    );
    renderBar();

    typeAndSubmit("asdfghjkl");

    await screen.findByText(
      "Didn't catch that. Try: 'show my pulse' or 'last 30 days'.",
    );
    // Only the priming utterance (" ") fired from onSubmit — no real speech.
    expect(FakeUtterance.instances).toHaveLength(1);
    expect(FakeUtterance.instances[0].text).toBe(" ");
  });

  it("renders the Speaking… indicator when isSpeaking is true and hides it when false", () => {
    renderBar();

    act(() => useSpeech.setState({ isSpeaking: true }));
    expect(screen.getByText("Speaking…")).toBeInTheDocument();

    act(() => useSpeech.setState({ isSpeaking: false }));
    expect(screen.queryByText("Speaking…")).toBeNull();
  });

  it("Cancel on the text path re-enables the input/Send button and shows Cancelled. (impeccable critique P2)", async () => {
    mockPostAgent.mockReturnValue(new Promise<AgentReply>(() => {}));
    renderBar();

    typeAndSubmit("show my pulse");

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    const input = screen.getByRole("textbox", {
      name: "Type a dashboard command",
    }) as HTMLInputElement;
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Cancelled.")).toBeInTheDocument();
  });

  it("drops a stale text-path reply that arrives after Cancel (impeccable critique P2)", async () => {
    let resolveReply!: (r: AgentReply) => void;
    mockPostAgent.mockReturnValueOnce(
      new Promise<AgentReply>((res) => {
        resolveReply = res;
      }),
    );
    renderBar();

    typeAndSubmit("show my pulse");

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    await act(async () => {
      resolveReply(
        reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
      );
    });

    expect(screen.queryByText(/^Showing pulse/)).not.toBeInTheDocument();
    expect(useFilters.getState().activeChart).toBe("bp_timeline");
  });
});

// Voice layer mounted on the SAME bar (D-06): mic button, 3-state indicator
// (color + word + icon, D-07), live green transcript (D-10/D-11), reduced-motion
// fallback (D-09), and the D-14 paused fallback that keeps the text input usable.
// jsdom has no SpeechRecognition, so FakeRecognition is installed here (the outer
// suite leaves it absent → supported=false → text-only, exercising VOICE-08).
describe("CommandBar voice layer (D-06/D-07/D-10/D-11/D-14)", () => {
  let getRec: () => FakeRecognition | null;

  beforeEach(() => {
    getRec = installFakeRecognition();
  });

  afterEach(() => {
    delete (window as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  });

  function startSession(): FakeRecognition {
    fireEvent.click(
      screen.getByRole("button", { name: "Start voice control" }),
    );
    return getRec()!;
  }

  it("swaps the mic aria-label from Start to Stop when a session opens (D-01/D-13)", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: "Start voice control" }),
    ).toBeInTheDocument();

    startSession();

    expect(
      screen.getByRole("button", { name: "Stop voice control" }),
    ).toBeInTheDocument();
  });

  it("shows the armed hint interpolating the wake word while listening (D-10)", () => {
    renderBar();
    startSession();

    expect(
      screen.getByText('LISTENING — say "dashboard…"'),
    ).toBeInTheDocument();
  });

  it("ignores room speech without the wake word — no command is sent (D-02)", () => {
    mockPostAgent.mockResolvedValue(reply());
    renderBar();
    const rec = startSession();

    act(() => rec.emitResult("what a nice day", false));
    act(() => rec.emitResult("please pass the salt", true));

    // Room speech never becomes a command; the bar stays armed.
    expect(mockPostAgent).not.toHaveBeenCalled();
    expect(
      screen.getByText('LISTENING — say "dashboard…"'),
    ).toBeInTheDocument();
  });

  it("streams the stripped interim transcript once triggered (D-10/D-11)", () => {
    renderBar();
    const rec = startSession();

    act(() => rec.emitResult("dashboard show my pulse", false));

    // Word stripped; the armed hint is replaced by the live transcript.
    expect(screen.getByText("show my pulse")).toBeInTheDocument();
    expect(
      screen.queryByText('LISTENING — say "dashboard…"'),
    ).not.toBeInTheDocument();
  });

  it("shows the WORKING… word while the command round-trips (D-11)", async () => {
    // Never-resolving promise → the bar stays in the working state.
    mockPostAgent.mockReturnValue(new Promise<AgentReply>(() => {}));
    renderBar();
    const rec = startSession();

    act(() => rec.emitResult("dashboard show my pulse", true));

    expect(await screen.findByText("WORKING…")).toBeInTheDocument();
  });

  it("replaces the transcript with the confirmation in one spot (D-11)", async () => {
    mockPostAgent.mockResolvedValue(
      reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
    );
    renderBar();
    const rec = startSession();

    act(() => rec.emitResult("dashboard show my pulse", true));

    expect(await screen.findByText(/^Showing pulse/)).toBeInTheDocument();
    // Charts switched via the store; the transcript is gone (one spot, D-11).
    expect(useFilters.getState().activeChart).toBe("pulse_trend");
    expect(screen.queryByText("show my pulse")).not.toBeInTheDocument();
  });

  it("enters the paused fallback on a fatal error, keeping the text input usable (D-14/VOICE-08)", () => {
    renderBar();
    const rec = startSession();

    act(() => rec.emitError("not-allowed"));

    // D-14 fixed copy (never the raw recognizer error) + the text box still works.
    expect(
      screen.getByText(
        "Voice is paused — tap the mic to start listening again.",
      ),
    ).toBeInTheDocument();
    const input = screen.getByRole("textbox", {
      name: "Type a dashboard command",
    }) as HTMLInputElement;
    expect(input).not.toBeDisabled();
  });

  it("Cancel on the voice path returns to listening and shows Cancelled — listening again. (impeccable critique P2)", async () => {
    mockPostAgent.mockReturnValue(new Promise<AgentReply>(() => {}));
    renderBar();
    const rec = startSession();

    act(() => rec.emitResult("dashboard show my pulse", true));
    await screen.findByText("WORKING…");

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(
      screen.getByText("Cancelled — listening again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("WORKING…")).not.toBeInTheDocument();
  });

  it("shows the cat-normal armed fill on the mic button only while a voice session is open (impeccable critique P2)", () => {
    renderBar();

    const offButton = screen.getByRole("button", {
      name: "Start voice control",
    });
    expect(offButton.className).not.toContain("cat-normal");

    startSession();

    const armedButton = screen.getByRole("button", {
      name: "Stop voice control",
    });
    expect(armedButton.className).toContain("cat-normal");
  });
});
