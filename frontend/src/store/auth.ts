// zustand auth store (SEC-01) — holds the shared-password Bearer token issued
// by /auth, persisted to localStorage key "hv-token" so a returning caregiver
// stays logged in with NO auto-expiry (D-02). UI state ONLY — server data lives
// in TanStack Query (CLAUDE.md separation).
//
// Mirrors store/theme.ts: the same try/catch localStorage guards (Chromium with
// site data blocked throws SecurityError on mere access; older Safari private
// mode throws on setItem) so auth persistence degrades gracefully instead of
// blanking the app at bootstrap. Exposed via useAuth.getState() for out-of-tree
// access from api/client.ts (mirrors useTheme.getState() in main.tsx).
import { create } from "zustand";

const STORAGE_KEY = "hv-token";

// Read the persisted token at store init so a reload keeps the session (D-02).
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* persistence unavailable — token still applies for this session */
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* persistence unavailable — state still clears for this session */
  }
}

interface AuthState {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  // Returning caregiver stays logged in (D-02, no expiry).
  token: readStoredToken(),
  login: (token) => {
    storeToken(token);
    set({ token });
  },
  // D-03: clear both the persisted key and in-memory state so a 401 (or a
  // manual logout) returns cleanly to the LoginGate.
  logout: () => {
    clearStoredToken();
    set({ token: null });
  },
}));
