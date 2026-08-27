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
  classifyError,
  computeBackoff,
  extractCommand,
  getSpeechRecognitionCtor,
  isSpeechSupported,
  supportsContinuous,
} from "../lib/voice";
import { useAgentStatus } from "../store/agentStatus";
import { useFilters } from "../store/filters";
import { useSpeech } from "../store/speech";
import { useAgent } from "./useAgent";

// The stable voice-state contract the CommandBar renders (Wave 3). "triggered"
// is armed-and-streaming-a-command; "speaking" is the TTS-04 mic-paused state
// (Plan 10-04); "paused" is the D-14 fatal fallback.
export type VoiceState =
  | "off"
  | "listening"
  | "triggered"
  | "working"
  | "speaking"
  | "paused";

// Fixed friendly copy for every client-visible failure (VOICE-07) — duplicated
// from CommandBar's constants on purpose: raw error strings are NEVER rendered.
const RATE_LIMIT_COPY =
  "One moment — a lot of commands at once. Try again in a few seconds.";
const OFFLINE_COPY =
  "Couldn't reach the assistant. The buttons below still work. Try: 'show my pulse'.";
// D-14 fatal fallback: a mic-permission/hardware error closes the session until a
// fresh start(). Fixed friendly copy only — the raw recognizer error NEVER renders.
const PAUSED_COPY =
  "Voice is paused — tap the mic to start listening again.";

type UseVoiceCommandOptions = { latestReading: string | null };

export type UseVoiceCommand = {
  supported: boolean;
  state: VoiceState;
  interim: string;
  message: string;
  start: () => void;
  stop: () => void;
  cancel: () => void;
};

export function useVoiceCommand({
  latestReading,
}: UseVoiceCommandOptions): UseVoiceCommand {
  const { mutate } = useAgent();

  const supported = isSpeechSupported();
  // TTS-04: drives the mic pause/resume effect below (armedRef-gated).
  const isSpeaking = useSpeech((s) => s.isSpeaking);

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
  // TTS-04: last-seen isSpeaking value, mirrored from the store on every real
  // transition (Pattern 2) — also guards onend against the abort-driven race
  // (Pitfall 4).
  const speakingRef = useRef(false);

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

  // D-14: a fatal recognizer error closes the session without restarting. armed
  // goes false so onend can't relaunch the loop; the bar shows fixed copy only.
  function enterPaused() {
    armedRef.current = false;
    seqRef.current++; // supersede any in-flight reply so it can't mutate post-pause (D-05)
    clearRestartTimer();
    setVoiceState("paused");
    setMessage(PAUSED_COPY);
  }

  // D-12 invisible restart: schedule rec.start() after the growing backoff. Held
  // while the tab is hidden (Pitfall 2); InvalidStateError swallowed (Pitfall 5).
  function scheduleRestart() {
    clearRestartTimer();
    const delay = computeBackoff(consecutiveRestartsRef.current++);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!armedRef.current) return; // stopped mid-wait → do not relaunch (D-13)
      if (typeof document !== "undefined" && document.hidden) return; // backgrounded
      try {
        recRef.current?.start();
      } catch {
        /* InvalidStateError: already running → no-op (Pitfall 5) */
      }
    }, delay);
  }

  // D-05 newest-wins: a superseded command's late reply must NOT touch the store.
  function handleSuccess(reply: AgentReply, capturedSeq: number) {
    if (capturedSeq !== seqRef.current) return; // stale drop BEFORE any store touch
    // D-07: report every non-stale reply to the shared liveness store — instant
    // clear for any reachable kind, instant set for "unavailable" (store's own
    // comparison decides). Placed AFTER the stale-drop guard above (T-06-07).
    useAgentStatus.getState().reportOutcome(reply.kind);
    switch (reply.kind) {
      case "applied": {
        applyAgentFilters(reply.filters ?? {});
        let msg = composeConfirmation(
          useFilters.getState(),
          latestReadingRef.current,
        );
        if (reply.message.trim() !== "") msg += " " + reply.message;
        setMessage(msg);
        useSpeech.getState().speak(msg); // TTS-01 voice path — one of exactly two speak() call sites (D-06)
        break;
      }
      case "refuse":
        if (reply.filters) applyAgentFilters(reply.filters);
        setMessage(reply.message);
        break;
      case "clarify":
      case "unclear":
      case "unavailable":
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

    if (command === "") {
      setInterim("");
      setVoiceState("listening"); // wake word only → nothing to submit, don't get stuck
      return;
    }
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
      // Fatal → paused (D-14); recoverable → do nothing here, onend drives restart.
      rec.onerror = (event) => {
        if (classifyError(event.error) === "fatal") {
          lastErrorFatalRef.current = true;
          enterPaused();
        }
      };
      // D-12/D-13: the recognizer stops on silence (iOS Pitfall 1) or after any
      // error. While still armed and not fatal, invisibly relaunch with backoff;
      // an explicit stop() (armed=false) leaves the session off — no flicker.
      rec.onend = () => {
        if (!armedRef.current) return; // caregiver tapped stop → stay off (D-13)
        if (speakingRef.current) return; // TTS owns the resume — suppress the natural restart loop (Pitfall 4)
        if (lastErrorFatalRef.current) {
          enterPaused();
          return;
        }
        if (typeof document !== "undefined" && document.hidden) return; // held hidden
        scheduleRestart();
      };
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
    seqRef.current++; // supersede any in-flight reply so it can't resurrect the UI (D-05)
    clearRestartTimer();
    setVoiceState("off");
    setInterim("");
    recRef.current?.abort();
  }

  // impeccable critique P2, 2026-08-27: a user-control-and-freedom escape hatch
  // for a stuck round-trip. Only acts while "working" — supersedes the pending
  // reply via the SAME seq guard stop() uses (handleSuccess/handleError's
  // capturedSeq !== seqRef.current check), so a late reply/error is silently
  // dropped. Unlike stop(), the live recognizer session is left exactly as-is
  // (no abort(), no armedRef/clearRestartTimer touch) — it returns to
  // "listening", not "off".
  function cancel() {
    if (state !== "working") return;
    seqRef.current++;
    setInterim("");
    setMessage("Cancelled — listening again.");
    setVoiceState("listening");
  }

  // TTS-04: pause the mic while the dashboard speaks, resume right after — ONLY
  // when a voice session is genuinely open (armedRef gate, Pitfall 3). Never
  // touches armedRef itself, so D-13's explicit-stop-only invariant holds.
  useEffect(() => {
    if (isSpeaking === speakingRef.current) return; // no-op on unrelated re-render
    speakingRef.current = isSpeaking;
    if (!armedRef.current) return; // text-only path — never touch an inactive/absent recognizer
    if (isSpeaking) {
      clearRestartTimer(); // suppress any pending backoff restart (onend guard covers the rest — Pitfall 4)
      setVoiceState("speaking");
      recRef.current?.abort();
    } else {
      setVoiceState("listening");
      try {
        recRef.current?.start(); // resume right after speech ends (TTS-04)
      } catch {
        /* InvalidStateError: already running → no-op (Pitfall 5) */
      }
    }
  }, [isSpeaking]);

  // Pitfall 2: never listen in the background. When the tab hides, drop the pending
  // restart and hold; when it returns to the foreground and we're still armed, resume
  // the loop honestly. Listeners + the restart timer + the recognizer are all torn
  // down on unmount (mirrors the FilterBar/CommandBar cleanup convention).
  useEffect(() => {
    function onVisibility() {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (hidden) {
        useSpeech.getState().cancelForBackground(); // Pitfall 6 — proactively cancel; iOS onend/onerror may never fire
        clearRestartTimer(); // background → stop trying to restart
        recRef.current?.abort(); // stop the LIVE session — never listen in the background (T-04-05)
        return;
      }
      if (armedRef.current && !lastErrorFatalRef.current) {
        try {
          recRef.current?.start(); // foreground again → resume the session
        } catch {
          /* InvalidStateError: already running → no-op (Pitfall 5) */
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      clearRestartTimer();
      recRef.current?.abort();
    };
  }, []);

  return { supported, state, interim, message, start, stop, cancel };
}
