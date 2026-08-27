// Persistent, non-dismissible "assistant unavailable" indicator (Phase 6,
// LIVE-02/LIVE-03, D-09..D-11). ONE shared component — no props, no
// voice-specific or text-specific variant (D-10): it reads only the shared
// store plus its own useHealth() poll. Markup is the UI-SPEC-exact target
// from 06-UI-SPEC.md's Phase-Specific Component Contract — treated as
// literal, not a paraphrase. Mirrors CommandBar.tsx's own established
// convention of mounting/unmounting a live region rather than always
// rendering it with toggled content.
import { BotOff } from "lucide-react";
import { useEffect } from "react";

import { useHealth } from "../hooks/useHealth";
import { AGENT_UNAVAILABLE_BANNER_COPY } from "../lib/copy";
import { useAgentStatus } from "../store/agentStatus";

export function AgentStatusBanner() {
  const health = useHealth();
  const unavailable = useAgentStatus((s) => s.unavailable);
  const syncFromHealth = useAgentStatus((s) => s.syncFromHealth);

  // The ONLY place syncFromHealth is invoked from a live poll result
  // (D-05/D-08's entry point into the shared store).
  useEffect(() => {
    if (health.data) {
      syncFromHealth(health.data.agent_reachable, health.data.agent_configured);
    }
  }, [health.data, syncFromHealth]);

  // Fail-safe default (06-UI-SPEC.md): a /health fetch failure itself
  // renders the SAME banner, never a different error state.
  const showBanner = unavailable || health.isError;
  if (!showBanner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mt-3 flex items-center gap-3 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] p-4 text-[18px] text-[var(--color-ink)] shadow-[var(--shadow-elevation)] transition-opacity duration-200 motion-reduce:transition-none"
    >
      <BotOff aria-hidden="true" className="h-6 w-6 shrink-0" />
      <span>{AGENT_UNAVAILABLE_BANNER_COPY}</span>
    </div>
  );
}
