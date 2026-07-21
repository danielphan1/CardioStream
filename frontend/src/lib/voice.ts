// Pure, DOM-light voice helpers (VOICE-01, D-02/D-03/D-04/D-10/D-12). These are
// backend-free, unit-tested primitives; Wave 2's useVoiceCommand hook and Wave 3's
// CommandBar UI consume them UNCHANGED (mirrors the agent.ts pure-helper home).
//
// Trust boundary (T-04-01): the wake-word gate here is the FIRST filter that keeps
// room speech off the network — extractCommand emits only a plain command string;
// it never constructs AppliedFilters. The server /agent Pydantic structured-outputs
// validation stays the sole authority (Phase 3). Nothing here logs the transcript
// (T-04-04 / SEC-03).

// D-04: the single named constant — the ONE interpolation source for the trigger
// word, changeable in exactly one place (UAT tuning knob).
export const WAKE_WORD = "dashboard";

// Backoff schedule bounds (D-12): base delay and hard cap for the restart loop.
export const BACKOFF_BASE_MS = 200;
export const BACKOFF_CAP_MS = 2000;

/**
 * Wake-word gate + strip (D-02/D-03/D-10). Case-insensitive on the trigger word;
 * the returned command preserves the ORIGINAL casing of the remainder.
 *
 * Returns:
 *   - `null`  when the wake word is absent → ignored room speech (D-02).
 *   - `""`    when only the wake word was said → armed-but-empty, DISTINCT from
 *             `null` so the caller can arm without submitting (D-10). Mirror the
 *             agent.ts `!= null` discipline: "" is a valid present value.
 *   - the stripped command otherwise, with leading punctuation/space removed and
 *     the trailing text trimmed.
 */
export function extractCommand(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  const idx = lower.indexOf(WAKE_WORD);
  if (idx === -1) return null; // untriggered → ignore (D-02)
  return transcript
    .slice(idx + WAKE_WORD.length)
    .replace(/^[\s,.:;-]+/, "") // strip the comma/space that follows the word (D-03)
    .trim();
}

/**
 * Recoverable-vs-fatal recognizer error classification (D-12). Recoverable errors
 * feed the invisible restart loop; fatal errors enter the D-14 paused fallback.
 * Unknown strings default to "recoverable" — a stuck loop is bounded by the
 * backoff cap, whereas a wrongly-fatal error would strand the session.
 */
export function classifyError(error: string): "recoverable" | "fatal" {
  switch (error) {
    case "no-speech": // silence timeout — the common iOS/desktop case
    case "aborted": // often self-induced by our own stop()/restart churn
    case "network": // transient connectivity blip
      return "recoverable";
    case "not-allowed": // permission denied/revoked — needs a fresh user gesture
    case "service-not-allowed":
    case "audio-capture": // no mic hardware
    case "language-not-supported":
    case "bad-grammar":
      return "fatal";
    default:
      return "recoverable";
  }
}

/**
 * iOS detection (Code Examples §Feature detection). iOS Safari ignores
 * `continuous = true`, so this drives supportsContinuous below. Guards against a
 * missing `navigator` (non-browser contexts) for safe import.
 */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.platform) ||
    // iPadOS 13+ reports as "MacIntel" but exposes touch — treat as iOS.
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

/**
 * The webkit-prefixed recognizer constructor lookup (Chrome/Edge unprefixed,
 * Safari/iOS webkit-prefixed). Returns `null` on Firefox / unsupported browsers →
 * text-only fallback (VOICE-08). Centralized so no UA sniffing leaks elsewhere.
 */
export function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** True when the browser exposes a SpeechRecognition constructor (VOICE-08). */
export function isSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/**
 * Whether real `continuous = true` is honored. Desktop Chrome/Edge honor it; iOS
 * does not (must run the onend restart loop instead), so this is `!isIOS()`.
 */
export function supportsContinuous(): boolean {
  return !isIOS();
}

/**
 * Restart-loop backoff (D-12). Grows exponentially from BACKOFF_BASE_MS to prevent
 * tight `no-speech` loops and to space out the Chrome-Android restart beep, capped
 * at BACKOFF_CAP_MS. `computeBackoff(0) === 200`. Callers reset `consecutiveRestarts`
 * to 0 after a successful final result.
 */
export function computeBackoff(consecutiveRestarts: number): number {
  const grown = BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveRestarts);
  return Math.min(grown, BACKOFF_CAP_MS);
}
