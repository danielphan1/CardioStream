// zustand guide store (D-01..D-05) — tracks the full-screen site-guide
// overlay's open/closed state. Ephemeral by design, explicitly modeled on
// store/view.ts's no-persistence pattern (NOT store/speech.ts's persisted
// `enabled`) — nothing in 11-CONTEXT.md asks the guide to reopen on reload,
// D-01 frames it as a per-session overlay, not a durable preference. Uses
// speech.ts-style `setOpen`/`toggleOpen` action names so both the agent
// fan-out (lib/agent.ts's applyAgentFilters) and the Header click button
// have obvious methods to call. UI state ONLY — server data lives in
// TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

export interface GuideState {
  open: boolean;
  setOpen: (open: boolean) => void; // used by the agent's guideOpen delta and the Header button
  toggleOpen: () => void; // used by the Header "Guide" button
}

export const useGuide = create<GuideState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggleOpen: () => get().setOpen(!get().open),
}));
