// Behavior tests for useVoiceCommand (D-01/D-02/D-03/D-05/D-10, VOICE-08) driven
// against the injectable FakeRecognition (jsdom has no SpeechRecognition). Mirrors
// CommandBar.test's "mock only the boundary" discipline: postAgent is the ONLY
// mock — real useAgent, a real QueryClientProvider, and the real zustand stores
// (reset in beforeEach) so the mutation path and store effects run end to end.
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { postAgent } from "../api/client";
import type { AgentReply } from "../api/types";
import { useAgentPulse } from "../lib/agent";
import { useFilters } from "../store/filters";
import {
  FakeRecognition,
  installFakeRecognition,
} from "../tests/fakeRecognition";
import { useVoiceCommand } from "./useVoiceCommand";

// Keep the real module (ApiError, getJson, …) — replace only postAgent.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, postAgent: vi.fn() };
});

const mockPostAgent = postAgent as unknown as Mock;

function reply(overrides: Partial<AgentReply> = {}): AgentReply {
  return { kind: "applied", filters: null, message: "", context: null, ...overrides };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

function renderVoice(latestReading: string | null = null) {
  return renderHook(() => useVoiceCommand({ latestReading }), { wrapper });
}

beforeEach(() => {
  mockPostAgent.mockReset();
  installFakeRecognition();
  useFilters.setState({
    activeChart: "bp_timeline",
    datePreset: "all",
    customRange: { from: null, to: null },
    amPm: "all",
    bpCategory: "all",
  });
  useAgentPulse.setState({ seq: 0, fields: [] });
});

afterEach(() => {
  vi.clearAllTimers();
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("useVoiceCommand session (D-01/D-02)", () => {
  it("opens ONE recognizer on start() and configures it (single-start session)", () => {
    const { result } = renderVoice();
    act(() => result.current.start());

    expect(FakeRecognition.instances).toHaveLength(1);
    const rec = FakeRecognition.instances[0];
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(rec.interimResults).toBe(true);
    expect(rec.lang).toBe("en-US");
    expect(result.current.state).toBe("listening");
    expect(result.current.supported).toBe(true);
  });

  it("does NOT recreate the recognizer across a second start() (singleton)", () => {
    const { result } = renderVoice();
    act(() => result.current.start());
    act(() => result.current.start());
    expect(FakeRecognition.instances).toHaveLength(1);
  });
});

describe("useVoiceCommand wake word gate (D-02)", () => {
  it("ignores room speech with no wake word — no mutate, stays listening", () => {
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    act(() => rec.emitResult("pick up milk later", false));

    expect(mockPostAgent).not.toHaveBeenCalled();
    expect(result.current.state).toBe("listening");
    expect(result.current.interim).toBe("");
  });
});

describe("useVoiceCommand interim transcript (D-10)", () => {
  it("streams the STRIPPED interim transcript post-trigger without mutating", () => {
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    act(() => rec.emitResult("dashboard show pulse", false));

    expect(result.current.interim).toBe("show pulse"); // wake word stripped
    expect(result.current.state).toBe("triggered");
    expect(mockPostAgent).not.toHaveBeenCalled();
  });
});

describe("useVoiceCommand final submit (D-03)", () => {
  it("submits the stripped command through the shared mutation exactly once", async () => {
    mockPostAgent.mockResolvedValue(
      reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }),
    );
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    await act(async () => {
      rec.emitResult("dashboard show pulse", true);
    });

    expect(mockPostAgent).toHaveBeenCalledTimes(1);
    expect(mockPostAgent.mock.calls[0][0]).toEqual({
      text: "show pulse",
      context: null,
    });
    // Applied reply mutated the store through applyAgentFilters and set the echo.
    expect(useFilters.getState().activeChart).toBe("pulse_trend");
    expect(result.current.message).toMatch(/^Showing pulse/);
    expect(result.current.state).toBe("listening"); // D-13 back to listening
  });
});

describe("useVoiceCommand newest wins (D-05)", () => {
  it("drops a superseded command's late reply — only the newest mutates the store", async () => {
    let resolveFirst!: (r: AgentReply) => void;
    mockPostAgent
      .mockReturnValueOnce(
        new Promise<AgentReply>((res) => {
          resolveFirst = res;
        }),
      )
      .mockResolvedValueOnce(
        reply({ kind: "applied", filters: { activeChart: "bp_categories" } }),
      );

    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    // First command in-flight (never resolves yet).
    act(() => rec.emitResult("dashboard show blood pressure categories", true));
    // Second (newest) command resolves immediately.
    await act(async () => {
      rec.emitResult("dashboard show pulse trend", true);
    });
    expect(useFilters.getState().activeChart).toBe("bp_categories");

    // The stale first reply lands LATE — it must not overwrite the newest view.
    await act(async () => {
      resolveFirst(reply({ kind: "applied", filters: { activeChart: "pulse_trend" } }));
    });
    expect(useFilters.getState().activeChart).toBe("bp_categories");
  });
});

describe("useVoiceCommand restart resilience (D-12/D-13/D-14, Pitfall 2/5)", () => {
  it("recoverable error + onend restarts the recognizer after backoff (D-12)", () => {
    vi.useFakeTimers();
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    expect(rec.start).toHaveBeenCalledTimes(1);

    act(() => rec.emitError("no-speech")); // recoverable — not fatal
    act(() => rec.onend?.()); // browser auto-stopped on silence (Pitfall 1)
    expect(result.current.state).toBe("listening"); // no flicker to off

    act(() => vi.advanceTimersByTime(200)); // computeBackoff(0) === 200ms
    expect(rec.start).toHaveBeenCalledTimes(2); // invisible restart
    vi.useRealTimers();
  });

  it("fatal not-allowed enters paused with no restart (D-14)", () => {
    vi.useFakeTimers();
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    act(() => rec.emitError("not-allowed")); // fatal — permission denied
    expect(result.current.state).toBe("paused");
    expect(result.current.message).toMatch(/paused/i); // fixed copy, never raw error
    expect(result.current.supported).toBe(true); // session closed, capability intact

    act(() => rec.onend?.()); // onend fires after the fatal error
    act(() => vi.advanceTimersByTime(5000));
    expect(rec.start).toHaveBeenCalledTimes(1); // NO restart on fatal
    vi.useRealTimers();
  });

  it("onend after an explicit stop() does not restart — stays off (D-13)", () => {
    vi.useFakeTimers();
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    act(() => result.current.stop());
    expect(result.current.state).toBe("off");

    act(() => rec.onend?.()); // late onend from the aborted session
    act(() => vi.advanceTimersByTime(5000));
    expect(rec.start).toHaveBeenCalledTimes(1); // no relaunch (D-13)
    vi.useRealTimers();
  });

  it("backoff grows on rapid restarts and resets after a successful final result", () => {
    vi.useFakeTimers();
    mockPostAgent.mockReturnValue(new Promise<AgentReply>(() => {})); // hold in-flight
    const { result } = renderVoice();
    act(() => result.current.start()); // start #1
    const rec = FakeRecognition.instances[0];

    // First silence cycle → computeBackoff(0) === 200ms.
    act(() => rec.onend?.());
    act(() => vi.advanceTimersByTime(200));
    expect(rec.start).toHaveBeenCalledTimes(2);

    // Second silence, still no result → computeBackoff(1) === 400ms (grown).
    act(() => rec.onend?.());
    act(() => vi.advanceTimersByTime(200)); // not yet
    expect(rec.start).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(200)); // 400ms total
    expect(rec.start).toHaveBeenCalledTimes(3);

    // A real final result resets the consecutive-restart counter → back to base.
    act(() => rec.emitResult("dashboard show pulse", true));
    act(() => rec.onend?.());
    act(() => vi.advanceTimersByTime(200)); // base backoff again after reset
    expect(rec.start).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("holds the restart loop while the tab is hidden, resumes on return (Pitfall 2)", () => {
    vi.useFakeTimers();
    const { result } = renderVoice();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    // Background the tab: a silence onend must NOT schedule a restart.
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    act(() => rec.onend?.());
    act(() => vi.advanceTimersByTime(2000));
    expect(rec.start).toHaveBeenCalledTimes(1); // held while hidden

    // Foreground again → visibilitychange resumes the session honestly.
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(rec.start).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("useVoiceCommand unsupported fallback (VOICE-08)", () => {
  it("is a no-op with state 'off' when SpeechRecognition is unavailable (Firefox)", () => {
    delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    const { result } = renderVoice();

    expect(result.current.supported).toBe(false);
    expect(result.current.state).toBe("off");
    act(() => result.current.start());
    expect(FakeRecognition.instances).toHaveLength(0);
    expect(result.current.state).toBe("off");
  });
});
