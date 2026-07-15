// zustand theme store — D-15: manual light/dark toggle via the `.dark` class
// on <html>, persisted to localStorage key "hv-theme".
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "hv-theme";

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
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
    localStorage.setItem(STORAGE_KEY, next);
    set({ theme: next });
  },
  initTheme: () => {
    const theme: Theme =
      localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    applyTheme(theme);
    set({ theme });
  },
}));
