// zustand agent-liveness store (Phase 6, D-05/D-07/D-08) — ONE shared
// `unavailable` boolean, written by two entry points, last-write-wins:
//   - reportOutcome(kind): called from CommandBar/useVoiceCommand the moment
//     a real /agent reply lands (D-07's instant clear-or-set).
//   - syncFromHealth(reachable, configured): called from AgentStatusBanner's
//     useHealth() poll effect (D-05/D-08's proactive load + recurring check).
//
// Deliberately NOT two independent stores OR'd together in a consuming
// component (RESEARCH Pattern 4's explicitly-rejected design) — that shape
// has a latent staleness bug: a /health poll confirming recovery would have
// no way to clear a reactive-only flag. One field, read identically by every
// consumer regardless of whether the triggering path was voice or text
// (D-10 — no separate voice/text field or variant).
//
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

import type { AgentReply } from "../api/types";

interface AgentStatusState {
  unavailable: boolean;
  reportOutcome: (kind: AgentReply["kind"]) => void;
  syncFromHealth: (reachable: boolean | null, configured: boolean) => void;
}

// RED stub — intentionally not implemented yet (TDD RED phase).
export const useAgentStatus = create<AgentStatusState>((set) => ({
  unavailable: false,
  reportOutcome: () => set({ unavailable: false }),
  syncFromHealth: () => set({ unavailable: false }),
}));
