// zustand theme store — D-15: manual light/dark toggle via the `.dark` class
// on <html>, persisted to localStorage key "hv-theme".
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "hv-theme";

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// localStorage access can throw (Chromium with site data blocked throws
// SecurityError on mere access; older Safari private mode throws on setItem).
// Guard both directions so theme persistence degrades gracefully instead of
// blanking the app at bootstrap (main.tsx calls initTheme before render).
function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* persistence unavailable — theme still applies for this session */
  }
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "light",
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    applyTheme(next);
    storeTheme(next);
    set({ theme: next });
  },
  initTheme: () => {
    const theme = readStoredTheme();
    applyTheme(theme);
    set({ theme });
  },
}));
