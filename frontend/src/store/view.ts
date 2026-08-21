// zustand view store (D-05) — swaps the two post-auth caregiver surfaces
// ("dashboard" | "upload") with a plain state flip, NOT react-router (no URL
// change, no Vercel rewrite; 05-RESEARCH.md Pattern 4). Ephemeral by design:
// unlike theme/auth there is NO localStorage persistence — a reload always
// returns to the dashboard. UI state ONLY — server data lives in TanStack Query
// (CLAUDE.md separation).
import { create } from "zustand";

export type View = "dashboard" | "upload" | "records";

interface ViewState {
  view: View;
  go: (view: View) => void;
}

export const useView = create<ViewState>((set) => ({
  // Chris's dashboard is always the landing surface; upload is caregiver-only.
  view: "dashboard",
  go: (view) => set({ view }),
}));
