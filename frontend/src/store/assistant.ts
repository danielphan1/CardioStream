// zustand assistant store (quick 261002-kem) — tracks the floating assistant
// popup's open/closed state. Shape is store/guide.ts's
// (`open`/`setOpen`/`toggleOpen`) so the FAB, the Close control and
// CommandBar's wake-word effect all have the obvious method to call.
//
// Unlike the guide, this one PERSISTS: the user dismisses the popup to stop it
// appearing, and that has to survive a reload to mean anything. Persistence is
// the codebase's hand-rolled localStorage pattern (theme.ts / speech.ts /
// auth.ts / filters.ts), not zustand's persist middleware, and
// initAssistant() is called from main.tsx before first paint exactly as
// initTheme/initSpeech/initFilters are — so a dismissed popup never flashes
// open on the way in.
//
// Default is OPEN when nothing is stored: a first visit behaves as the pinned
// Command Bar band did.
//
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
// Deliberately NOT part of store/filters.ts: that store is the agent command
// schema, and transient UI state must never become reachable or mutable by
// model output.
import { create } from "zustand";

const STORAGE_KEY = "hv-assistant-open";

// localStorage access can throw (Chromium with site data blocked throws
// SecurityError on mere access; older Safari private mode throws on setItem),
// so both directions are guarded and the popup degrades to session-only state
// rather than breaking the bootstrap.
function readStoredOpen(): boolean {
  try {
    // Only the explicit "false" written below closes it — anything else
    // (absent key, garbage from an older build) falls back to the open default.
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function storeOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? "true" : "false");
  } catch {
    /* persistence unavailable — the state still applies for this session */
  }
}

export interface AssistantState {
  open: boolean;
  /** Used by the Close control, the FAB and CommandBar's wake-word effect. */
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  /** Called once from main.tsx before first paint. */
  initAssistant: () => void;
}

export const useAssistant = create<AssistantState>((set, get) => ({
  open: true,
  setOpen: (open) => {
    // No-op guard: the wake-word effect calls setOpen(true) on every
    // "triggered" transition, and an already-open popup should not write to
    // localStorage (or re-render every subscriber) for it.
    if (get().open === open) return;
    storeOpen(open);
    set({ open });
  },
  toggleOpen: () => get().setOpen(!get().open),
  initAssistant: () => set({ open: readStoredOpen() }),
}));
