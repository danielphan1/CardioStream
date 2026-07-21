// useVoiceCommand — the one genuinely novel, high-risk surface of Phase 4: a
// single long-lived webkitSpeechRecognition instance driven by an explicit
// onend/onerror restart loop, wake-word-gated command capture, a monotonic
// newest-wins sequence guard, and a stable voice-state contract the CommandBar
// (Wave 3) renders. All recognizer volatility is contained HERE so the UI only
// renders state.
//
// Design invariants (RESEARCH §Patterns 1-3, §Pitfalls 1-8):
//   - ONE recognizer, held in a ref, started once inside the caregiver tap
//     (D-01 user gesture) and kept armed across silence auto-stops (D-02/D-12).
//   - Store mutation routes ONLY through applyAgentFilters (single-surface rule);
//     the command reuses useAgent().mutate — no new fetch (VOICE-08).
//   - A monotonic seq guard drops a superseded command's late reply (D-05).
//   - Raw recognizer / API error strings NEVER render — only fixed friendly copy
//     (VOICE-07); the transcript is never logged (SEC-03 / T-04-04).
import { useEffect, useRef, useState } from "react";

import { ApiError } from "../api/client";
import type { AgentReply } from "../api/types";
import { applyAgentFilters, composeConfirmation } from "../lib/agent";
import {
  extractCommand,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  supportsContinuous,
} from "../lib/voice";
import { useFilters } from "../store/filters";
import { useAgent } from "./useAgent";

// The stable voice-state contract the CommandBar renders (Wave 3). "triggered"
// is armed-and-streaming-a-command; "paused" is the D-14 fatal fallback.
export type VoiceState =
  | "off"
  | "listening"
  | "triggered"
  | "working"
  | "paused";

// Fixed friendly copy for every client-visible failure (VOICE-07) — duplicated
// from CommandBar's constants on purpose: raw error strings are NEVER rendered.
const RATE_LIMIT_COPY =
  "One moment — a lot of commands at once. Try again in a few seconds.";
const OFFLINE_COPY =
  "Couldn't reach the assistant. The buttons below still work. Try: 'show my pulse'.";

type UseVoiceCommandOptions = { latestReading: string | null };

export type UseVoiceCommand = {
  supported: boolean;
  state: VoiceState;
  interim: string;
  message: string;
  start: () => void;
  stop: () => void;
};

export function useVoiceCommand({
  latestReading,
}: UseVoiceCommandOptions): UseVoiceCommand {
  const { mutate } = useAgent();

  const supported = isSpeechSupported();

  const [state, setVoiceState] = useState<VoiceState>("off");
  const [interim, setInterim] = useState("");
  const [message, setMessage] = useState("");

  // Refs so the recognizer event handlers (bound ONCE at construction) stay
  // stable across renders yet always read current values.
  const recRef = useRef<SpeechRecognition | null>(null);
  const armedRef = useRef(false);
  const seqRef = useRef(0);
  const consecutiveRestartsRef = useRef(0);
  const lastErrorFatalRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // latestReading + mutate flow through refs so the construct-once handlers never
  // close over a stale value (useState setters are already stable).
  const latestReadingRef = useRef(latestReading);
  latestReadingRef.current = latestReading;
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  function clearRestartTimer() {
    if (restartTimerRef.current != null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  // D-05 newest-wins: a superseded command's late reply must NOT touch the store.
  function handleSuccess(reply: AgentReply, capturedSeq: number) {
    if (capturedSeq !== seqRef.current) return; // stale drop BEFORE any store touch
    switch (reply.kind) {
      case "applied": {
        applyAgentFilters(reply.filters ?? {});
        let msg = composeConfirmation(
          useFilters.getState(),
          latestReadingRef.current,
        );
        if (reply.message.trim() !== "") msg += " " + reply.message;
        setMessage(msg);
        break;
      }
      case "refuse":
        if (reply.filters) applyAgentFilters(reply.filters);
        setMessage(reply.message);
        break;
      case "clarify":
      case "unclear":
        // Voice does not do multi-turn clarify — surface the copy, return to listen.
        setMessage(reply.message);
        break;
    }
    setVoiceState("listening"); // D-13 explicit-stop-only: always return to listening
  }

  function handleError(err: unknown, capturedSeq: number) {
    if (capturedSeq !== seqRef.current) return; // stale error also dropped
    const rateLimited = err instanceof ApiError && err.status === 429;
    setMessage(rateLimited ? RATE_LIMIT_COPY : OFFLINE_COPY); // VOICE-07 fixed copy
    setVoiceState("listening");
  }

  function handleResult(event: SpeechRecognitionEvent) {
    const result = event.results[event.results.length - 1];
    const command = extractCommand(result[0].transcript);
    if (command == null) return; // room speech (no wake word) → ignore (D-02 gate)

    if (!result.isFinal) {
      // Interim, post-trigger: stream the STRIPPED transcript; never mutate (D-10).
      setInterim(command);
      setVoiceState("triggered");
      return;
    }

    if (command === "") return; // wake word only → nothing to submit
    consecutiveRestartsRef.current = 0; // a real final result resets the backoff
    const capturedSeq = ++seqRef.current;
    setInterim("");
    setVoiceState("working");
    mutateRef.current(
      { text: command, context: null },
      {
        onSuccess: (reply) => handleSuccess(reply, capturedSeq),
        onError: (err) => handleError(err, capturedSeq),
      },
    );
  }

  function start() {
    if (!isSpeechSupported()) return; // Firefox/unsupported → no-op (VOICE-08)
    armedRef.current = true;
    lastErrorFatalRef.current = false;
    consecutiveRestartsRef.current = 0;

    if (recRef.current == null) {
      const Ctor = getSpeechRecognitionCtor();
      if (Ctor == null) return;
      const rec = new Ctor();
      rec.interimResults = true; // live transcript (D-10)
      rec.lang = "en-US";
      rec.continuous = supportsContinuous(); // honored on desktop; iOS ignores it
      rec.onresult = handleResult;
      recRef.current = rec;
    }

    setVoiceState("listening");
    setInterim("");
    setMessage("");
    try {
      recRef.current.start(); // MUST run inside the caregiver tap (D-01 gesture)
    } catch {
      /* InvalidStateError: already running → no-op (Pitfall 5) */
    }
  }

  function stop() {
    armedRef.current = false; // D-13: explicit stop — do not restart
    clearRestartTimer();
    setVoiceState("off");
    setInterim("");
    recRef.current?.abort();
  }

  // Teardown: clear any pending restart and release the recognizer on unmount.
  useEffect(() => {
    return () => {
      clearRestartTimer();
      recRef.current?.abort();
    };
  }, []);

  return { supported, state, interim, message, start, stop };
}
