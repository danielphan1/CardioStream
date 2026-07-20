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
import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import type { AgentReply, ClarifyContext } from "../api/types";
import { useAgent } from "../hooks/useAgent";
import { applyAgentFilters, composeConfirmation } from "../lib/agent";
import { useFilters } from "../store/filters";

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
  }

  function onSuccess(reply: AgentReply) {
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
    const trimmed = text.trim();
    if (trimmed === "") return; // trimmed-empty → no-op (D-04)
    // D-03: keep text visible, lock the controls, show the Working… state.
    setStatus("working");
    mutate({ text: trimmed, context: clarifyContext }, { onSuccess, onError });
  }

  const working = status === "working";
  const placeholder = `Try: "${EXAMPLES[exampleIdx]}"`;

  return (
    <section
      aria-label="Command bar"
      // The full-width sky band + content-column gutters come from the App
      // wrapper (D-01) — the section itself stays bg-transparent so there is
      // exactly one bg layer. Only vertical padding + the working ring live here.
      className={`py-4 ${
        working ? "rounded-lg ring-2 ring-[var(--color-accent)]" : ""
      }`}
    >
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={working}
          aria-label="Type a dashboard command"
          placeholder={placeholder}
          className="min-h-12 flex-grow rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-4 text-[18px] text-[var(--color-ink)] disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={working}
          className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)] disabled:opacity-70"
        >
          Send
        </button>
      </form>

      {/* Working… indicator (D-03) — spinner + ≥18px label, both shown while the
          round-trip is in flight. */}
      {working && (
        <p className="mt-3 flex items-center gap-2 text-[18px] text-[var(--color-ink)]">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-ink)] border-t-transparent"
          />
          Working…
        </p>
      )}

      {/* Reply region (D-05/D-06) — announced politely, persists until the next
          submit. message renders as a plain React text node only (T-03-16: no
          raw HTML injection). The state glyph is a separate aria-hidden span so
          it never contaminates the announced/queried message string. */}
      {!working && message !== "" && (
        <p
          aria-live="polite"
          className="mt-3 flex items-start gap-2 text-[18px] text-[var(--color-ink)]"
        >
          {MARKER[status] !== "" && (
            <span aria-hidden="true" className="font-bold">
              {MARKER[status]}
            </span>
          )}
          <span>{message}</span>
        </p>
      )}
    </section>
  );
}
