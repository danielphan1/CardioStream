// Command bar (D-01..D-07, D-12; VOICE-06/07/08) — the primary control, a
// full-width text box between the header and the filter bar. Phase 4 mounts a
// mic button + live transcript into THIS bar without restructuring.
//
// Interaction contract:
//   - D-01 top billing, full-width surface
//   - D-02 rotating example placeholder (≥18px) teaches the vocabulary; the
//     accessible name is a real aria-label, never the placeholder (Pitfall 8)
//   - D-03 submitted text stays visible with a Working… spinner + bar highlight
//     during the round-trip; clears only when a command is applied
//   - D-04 submit via a ≥48px labeled Send button AND the Enter key
//   - D-05/D-06 the reply resolves in the bar itself, in an aria-live region,
//     persisting until the next command
//   - D-07 applied replies show the frontend-composed full-state echo, with the
//     D-16 stats-bar pointer appended when present
//   - D-12 clarify replies store a one-turn context resent with the next submit
//   - VOICE-07 429/network/unclear render fixed friendly copy — never a raw error
//
// State machine + clarify context live in local useState (PATTERNS: like
// FilterBar's customOpen), NOT the zustand store, which stays the pure command
// schema. Only server-composed AppliedFilters reach the store (T-03-16/17).
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import type { AgentReply, ClarifyContext } from "../api/types";
import { useAgent } from "../hooks/useAgent";
import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { applyAgentFilters, composeConfirmation } from "../lib/agent";
import { WAKE_WORD } from "../lib/voice";
import { useAgentStatus } from "../store/agentStatus";
import { useFilters } from "../store/filters";
import { useSpeech } from "../store/speech";

type CommandBarProps = {
  latestReading: string | null;
};

type Status = "idle" | "working" | "confirmed" | "clarify" | "error";

// Real commands the box teaches by example (D-02). Kept short and concrete so
// the placeholder reads as an invitation, not documentation.
const EXAMPLES = [
  "show my pulse",
  "last 30 days, mornings only",
  "show blood pressure",
  "show all data",
];

// Fixed friendly copy for every client-visible failure (VOICE-07). error.message
// (which may leak status/stack) is NEVER rendered — only these strings are.
const RATE_LIMIT_COPY =
  "One moment — a lot of commands at once. Try again in a few seconds.";
const OFFLINE_COPY =
  "Couldn't reach the assistant. The buttons below still work. Try: 'show my pulse'.";
// D-14 hard-failure fallback: shown when voice enters the fatal paused state
// (mic denied/revoked, no hardware, restart-loop exhausted). A peer of the fixed
// copy above — the raw recognizer error is NEVER rendered (VOICE-07). The text
// input below stays fully usable so the caregiver is never trapped (VOICE-08).
const VOICE_PAUSED_COPY = "Voice paused — tap to resume";

// Non-color state markers (aria-hidden — the aria-live text carries the meaning
// for screen readers; the glyph is a purely visual reinforcement, no color-only
// signaling). Confirmed gets a check; clarify a question; errors stay calm.
const MARKER: Record<Status, string> = {
  idle: "",
  working: "",
  confirmed: "✓",
  clarify: "?",
  error: "!",
};

export function CommandBar({ latestReading }: CommandBarProps) {
  const { mutate } = useAgent();

  // Voice layer on the SAME bar (D-06): the hook owns every recognizer volatility
  // and exposes a stable state contract; this component only renders it. Firefox /
  // unsupported → supported=false → the mic is absent and the text path is the
  // whole story (VOICE-08).
  const {
    supported,
    state: voiceState,
    interim,
    message: voiceMessage,
    start,
    stop,
  } = useVoiceCommand({ latestReading });
  const isSpeaking = useSpeech((s) => s.isSpeaking);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [clarifyContext, setClarifyContext] = useState<ClarifyContext | null>(
    null,
  );
  const [exampleIdx, setExampleIdx] = useState(0);

  // Rotate the placeholder only while the box is idle and empty (D-02): a
  // ~6s interval, cleared on unmount and whenever the user starts typing or a
  // reply lands, so the example never changes under an active command.
  useEffect(() => {
    if (status !== "idle" || text !== "") return;
    const id = setInterval(() => {
      setExampleIdx((i) => (i + 1) % EXAMPLES.length);
    }, 6000);
    return () => clearInterval(id);
  }, [status, text]);

  function onApplied(reply: AgentReply) {
    // Reset-first then present-value deltas happen inside applyAgentFilters;
    // compose the echo from POST-apply store state, never from model text (D-07).
    applyAgentFilters(reply.filters ?? {});
    let msg = composeConfirmation(useFilters.getState(), latestReading);
    if (reply.message.trim() !== "") {
      msg += " " + reply.message; // D-16 stats-bar pointer, appended verbatim
    }
    setMessage(msg);
    setStatus("confirmed");
    setText(""); // D-03 clears only on an applied command
    setClarifyContext(null);
    useSpeech.getState().speak(msg); // TTS-01: speak the exact echoed confirmation
  }

  function onSuccess(reply: AgentReply) {
    // D-07: report every real /agent reply to the shared liveness store —
    // instant-clear for any reachable kind, instant-set for "unavailable" —
    // before the per-kind branching below (store's own comparison decides).
    useAgentStatus.getState().reportOutcome(reply.kind);
    switch (reply.kind) {
      case "applied":
        onApplied(reply);
        break;
      case "clarify":
        // D-12: remember original + question for one turn; resend on next submit.
        setMessage(reply.message);
        setStatus("clarify");
        setClarifyContext(reply.context);
        setText(""); // make room for the answer
        break;
      case "refuse":
        // D-10 useful-action: a refusal may still switch to a relevant chart.
        if (reply.filters) applyAgentFilters(reply.filters);
        setMessage(reply.message);
        setStatus("confirmed");
        setText("");
        setClarifyContext(null);
        break;
      case "unclear":
        // D-11: friendly "didn't catch that" — keep the text so the user can
        // edit and retry. Visually calm (marker "!", not a red alarm).
        setMessage(reply.message);
        setStatus("error");
        setClarifyContext(null);
        break;
      case "unavailable":
        // LIVE-01: the agent/breaker is unreachable — same text-preservation
        // treatment as "unclear" (not "refuse"'s clearing), so the caregiver
        // never loses their typed command while the assistant is down.
        setMessage(reply.message);
        setStatus("error");
        setClarifyContext(null);
        break;
    }
  }

  function onError(err: unknown) {
    // VOICE-07: fixed local copy for every failure; error.message never renders.
    const rateLimited = err instanceof ApiError && err.status === 429;
    setMessage(rateLimited ? RATE_LIMIT_COPY : OFFLINE_COPY);
    setStatus("error");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    useSpeech.getState().primeSpeech(); // TTS-05 Pitfall 1: gesture-unlock on every real submit
    const trimmed = text.trim();
    if (trimmed === "") return; // trimmed-empty → no-op (D-04)
    // D-03: keep text visible, lock the controls, show the Working… state.
    setStatus("working");
    mutate({ text: trimmed, context: clarifyContext }, { onSuccess, onError });
  }

  const working = status === "working";
  const voiceWorking = voiceState === "working";
  const anyWorking = working || voiceWorking;
  // A session is open (mic tap stops it) while armed/streaming/working; when off
  // or paused the mic tap starts/resumes it (D-01/D-13).
  const sessionOpen =
    voiceState === "listening" ||
    voiceState === "triggered" ||
    voiceState === "working" ||
    voiceState === "speaking";
  const placeholder = `Try: "${EXAMPLES[exampleIdx]}"`;

  // The whole bar transforms to signal state (D-06): the existing accent ring is
  // retained for WORKING; armed/listening adds a green ring with a motion-safe
  // pulse and a static ring-2 fallback for reduced motion (D-09), copying the
  // FilterBar pulseClass structure. Colors are existing tokens only (no hex).
  const ringClass = anyWorking
    ? "rounded-lg ring-2 ring-[var(--color-accent)]"
    : voiceState === "listening" || voiceState === "triggered"
      ? "rounded-lg ring-2 ring-[var(--cat-normal)] motion-safe:animate-pulse"
      : "";

  // One announced line, one thing at a time (D-06/D-11). Every state pairs a
  // WORD + ICON + COLOR — never color alone (D-07). Green (--cat-normal) is the
  // armed hint and the live transcript; the confirmation replaces the transcript
  // in this same spot; off falls back to the text-command message.
  let lineText = "";
  let lineGreen = false;
  let lineGlyph: "mic" | "micoff" | "marker" | null = null;
  if (voiceState === "triggered") {
    lineText = interim; // stripped command streaming in green (D-10/D-11)
    lineGreen = true;
    lineGlyph = "mic";
  } else if (voiceState === "listening") {
    if (voiceMessage !== "") {
      lineText = voiceMessage; // confirmation replaces the transcript (D-11)
      lineGlyph = "mic";
    } else {
      lineText = `LISTENING — say "${WAKE_WORD}…"`; // armed hint (D-10)
      lineGreen = true;
      lineGlyph = "mic";
    }
  } else if (voiceState === "paused") {
    lineText = VOICE_PAUSED_COPY; // D-14 fixed copy
    lineGlyph = "micoff";
  } else if (voiceState === "speaking") {
    // Leave this slot blank — the Speaking… indicator below is the sole
    // visible signal for this sub-state (10-UI-SPEC.md).
    lineText = "";
    lineGlyph = null;
  } else {
    lineText = message; // voice off → the text path owns the region
    lineGlyph = MARKER[status] !== "" ? "marker" : null;
  }

  function onMicClick() {
    if (sessionOpen) stop();
    else {
      useSpeech.getState().primeSpeech(); // TTS-05 Pitfall 1: gesture-unlock for voice-first users
      start(); // synchronous start inside the tap (D-01 user gesture)
    }
  }

  return (
    <section
      aria-label="Command bar"
      // The full-width sky band + content-column gutters come from the App
      // wrapper (D-01) — the section itself stays bg-transparent so there is
      // exactly one bg layer. Only vertical padding + the state ring live here.
      className={`py-4 ${ringClass}`}
    >
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
        {/* Mic button (D-01/D-13) — a ≥48px (min-h-12 min-w-12) ink-bordered
            control, NOT an accent fill; its glyph + aria-label swap with state.
            Absent on Firefox/unsupported so the text path stands alone (VOICE-08). */}
        {supported && (
          <button
            type="button"
            onClick={onMicClick}
            aria-label={sessionOpen ? "Stop voice control" : "Start voice control"}
            className="flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] text-[var(--color-ink)]"
          >
            {voiceState === "paused" ? (
              <MicOff aria-hidden="true" className="h-6 w-6" />
            ) : (
              <Mic aria-hidden="true" className="h-6 w-6" />
            )}
          </button>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={anyWorking}
          aria-label="Type a dashboard command"
          placeholder={placeholder}
          className="min-h-12 flex-grow rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-4 text-[18px] text-[var(--color-ink)] disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={anyWorking}
          className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)] disabled:opacity-70"
        >
          Send
        </button>
      </form>

      {/* Working… indicator (D-03/D-11) — spinner + ≥18px WORD, shown while a text
          OR voice command round-trips. The spin is motion-safe with a static ring
          glyph fallback under prefers-reduced-motion (D-09). The voice path shows
          the WORKING… word so the state reads by word, not color alone (D-07). */}
      {anyWorking && (
        <p className="mt-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-ink)]">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-5 rounded-full border-2 border-[var(--color-ink)] border-t-transparent motion-safe:animate-spin"
          />
          {voiceWorking ? "WORKING…" : "Working…"}
        </p>
      )}

      {/* Speaking… indicator (D-05) — a third, independent conditional block.
          Plain paragraph, no aria-live: the meaning is already announced by
          the confirmation region below (and, when unmuted, by the audio
          itself) — a second live announcement here would double-speak the
          same event for screen-reader users. */}
      {isSpeaking && (
        <p className="mt-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-ink)]">
          <Volume2
            aria-hidden="true"
            className="h-5 w-5 motion-safe:animate-pulse motion-reduce:animate-none"
          />
          Speaking…
        </p>
      )}

      {/* One announced region (D-05/D-06/D-11) — the armed hint, the live green
          transcript, the WORKING/paused word, and the confirmation all resolve in
          THIS spot, one at a time. Text renders as a plain node only (T-03-16: no
          raw HTML). The glyph is aria-hidden visual reinforcement; the WORD is the
          announced meaning (color + word + icon triad, never color alone, D-07). */}
      {!anyWorking && lineText !== "" && (
        <p
          aria-live="polite"
          className={`mt-3 flex items-start gap-2 text-[18px] ${
            lineGreen ? "text-[var(--cat-normal)]" : "text-[var(--color-ink)]"
          }`}
        >
          {lineGlyph === "mic" && (
            <Mic aria-hidden="true" className="h-6 w-6 shrink-0" />
          )}
          {lineGlyph === "micoff" && (
            <MicOff aria-hidden="true" className="h-6 w-6 shrink-0" />
          )}
          {lineGlyph === "marker" && (
            <span aria-hidden="true" className="font-bold">
              {MARKER[status]}
            </span>
          )}
          <span>{lineText}</span>
        </p>
      )}
    </section>
  );
}
