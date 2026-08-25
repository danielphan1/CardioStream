// zustand speech store (10-02, D-01..D-06, TTS-01..05) — two concerns in one
// file, mirroring store/agentStatus.ts's "written from multiple entry points,
// read identically everywhere" shape:
//   1. `enabled` — persisted mute/quiet on-off preference (D-02/D-03),
//      templated on store/theme.ts's guarded localStorage read/write.
//   2. `isSpeaking` + `primed` + `speak()`/`primeSpeech()`/`cancelForBackground()`
//      — the ephemeral utterance-lifecycle controller both `CommandBar.onApplied`
//      (Plan 10-03, text-input path) and `useVoiceCommand.handleSuccess`
//      (Plan 10-04, voice path) call `speak()` from, and CommandBar's
//      "Speaking…" indicator plus useVoiceCommand's mic-pause effect both
//      subscribe to `isSpeaking`.
// UI state ONLY — server data lives in TanStack Query (CLAUDE.md separation).
import { create } from "zustand";

const STORAGE_KEY = "hv-speech";

// localStorage access can throw (Chromium with site data blocked throws
// SecurityError on mere access; older Safari private mode throws on setItem).
// Guard both directions exactly like store/theme.ts so speech persistence
// degrades gracefully instead of blanking the app at bootstrap (main.tsx
// calls initSpeech before render).
function readStoredEnabled(): boolean {
  try {
    // Only the literal string "off" turns speech off; missing key or any
    // other value defaults to on (TTS-02 — on by default).
    return localStorage.getItem(STORAGE_KEY) === "off" ? false : true;
  } catch {
    return true;
  }
}

function storeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* persistence unavailable — preference still applies for this session */
  }
}

// Deliberately independent of lib/voice.ts's isSpeechSupported() (which
// checks the RECOGNIZER, not the synthesizer) — Firefox has speechSynthesis
// but no SpeechRecognition; conflating the two checks would silently disable
// TTS for Firefox typists.
function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Monotonic guard for stale onend/onerror events from a superseded/cancelled
// utterance (Pitfall 2) — module-level `let` because no test needs to reset
// an absolute value, only relative newest-wins behavior.
let seq = 0;

// Strong reference to the in-flight utterance for its lifetime — some browser
// implementations can garbage-collect an utterance that's referenced only by
// a function-local variable, silently dropping onend/onerror (Pitfall 5).
// Deliberately write-only (assigned, never read) — the `void` below is a
// no-op read solely to satisfy `noUnusedLocals`, not a behavioral change.
let currentUtterance: SpeechSynthesisUtterance | null = null;
void currentUtterance;

interface SpeechState {
  enabled: boolean;
  isSpeaking: boolean;
  // Page-session-scoped gesture-unlock flag (Pitfall 1). Deliberately STORE
  // STATE (a zustand field), NOT a bare module-level `let` — a module-level
  // `let` would leak "already primed" across it() blocks within the same
  // test file (Vitest keeps one module instance per file) and produce
  // order-dependent test flakiness; store state lets every test file reset
  // it via setState({ primed: false }) in beforeEach.
  primed: boolean;
  initSpeech: () => void;
  setEnabled: (enabled: boolean) => void; // used by the header toggle (click-driven) and the agent's ToggleSpeech action
  toggleEnabled: () => void; // used by the header button
  primeSpeech: () => void;
  // NOTE: never log the `text` parameter anywhere in this function — SEC-03 /
  // T-04-04 transcript-never-logged precedent extends to spoken confirmations.
  speak: (text: string) => void;
  cancelForBackground: () => void;
}

export const useSpeech = create<SpeechState>((set, get) => ({
  enabled: true,
  isSpeaking: false,
  primed: false,

  initSpeech: () => set({ enabled: readStoredEnabled() }),

  setEnabled: (enabled) => {
    storeEnabled(enabled);
    // Muting mid-utterance silences immediately (RESEARCH Assumption A2).
    if (!enabled) get().cancelForBackground();
    set({ enabled });
  },

  toggleEnabled: () => get().setEnabled(!get().enabled),

  primeSpeech: () => {
    if (get().primed || !isSpeechSynthesisSupported()) return;
    set({ primed: true });
    try {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    } catch {
      /* unsupported/blocked — TTS silently stays off; aria-live still fires (D-04) */
    }
  },

  speak: (text) => {
    if (!get().enabled || text.trim() === "") return; // TTS-02 muted / nothing to say
    if (!isSpeechSynthesisSupported()) return;
    const mySeq = ++seq;
    // TTS-03: always cancel first — safe no-op if nothing is playing, and the
    // only way to guarantee just one utterance ever plays at a time.
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    currentUtterance = utter;
    const finish = () => {
      if (mySeq !== seq) return; // stale event from a since-cancelled utterance (Pitfall 2)
      set({ isSpeaking: false });
      currentUtterance = null;
    };
    utter.onstart = () => {
      if (mySeq !== seq) return; // stale event — a newer utterance has already superseded this one
      set({ isSpeaking: true });
    };
    utter.onend = finish;
    utter.onerror = finish; // Safari may fire error, not end, after cancel() (Pitfall 2)
    window.speechSynthesis.speak(utter);
  },

  cancelForBackground: () => {
    seq++; // supersede any in-flight onend/onerror from the cancelled utterance (Pitfall 6)
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    currentUtterance = null;
    set({ isSpeaking: false }); // synchronous — does not wait for onend/onerror
  },
}));
