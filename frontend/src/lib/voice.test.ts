// Unit tests for lib/voice.ts — the pure voice primitives (VOICE-01, D-02/D-03/
// D-04/D-10/D-12). No DOM lifecycle here: extractCommand/classifyError/computeBackoff
// are stateless; the capability/iOS cases stub window/navigator globals and restore
// them afterward. Mirrors the agent.test.ts pure-helper structure.
import { afterEach, describe, expect, it } from "vitest";

import {
  BACKOFF_CAP_MS,
  WAKE_WORD,
  classifyError,
  computeBackoff,
  extractCommand,
  getSpeechRecognitionCtor,
  isIOS,
  isSpeechSupported,
  supportsContinuous,
} from "./voice";

const ORIGINAL_PLATFORM = navigator.platform;

function setPlatform(platform: string): void {
  Object.defineProperty(navigator, "platform", {
    value: platform,
    configurable: true,
  });
}

afterEach(() => {
  setPlatform(ORIGINAL_PLATFORM);
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("WAKE_WORD (D-04)", () => {
  it("is the single 'dashboard' constant", () => {
    expect(WAKE_WORD).toBe("dashboard");
  });
});

describe("extractCommand (D-02/D-03/D-10)", () => {
  it("strips the wake word and returns the command", () => {
    expect(extractCommand("dashboard show pulse")).toBe("show pulse");
  });

  it("strips leading punctuation/space after the wake word (D-03)", () => {
    expect(extractCommand("dashboard, show pulse")).toBe("show pulse");
  });

  it("returns null for room speech with no wake word (D-02)", () => {
    expect(extractCommand("pick up milk later")).toBeNull();
  });

  it("is case-insensitive on the wake word but preserves command casing", () => {
    expect(extractCommand("Dashboard show Pulse")).toBe("show Pulse");
  });

  it("returns '' when only the wake word was said — distinct from null (D-10)", () => {
    expect(extractCommand("dashboard")).toBe("");
  });

  it("matches the wake word mid-utterance (leading room speech dropped)", () => {
    expect(extractCommand("um, dashboard show my blood pressure")).toBe(
      "show my blood pressure",
    );
  });
});

describe("classifyError (D-12)", () => {
  it.each(["no-speech", "aborted", "network"])(
    "classifies '%s' as recoverable",
    (err) => {
      expect(classifyError(err)).toBe("recoverable");
    },
  );

  it.each([
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "language-not-supported",
    "bad-grammar",
  ])("classifies '%s' as fatal", (err) => {
    expect(classifyError(err)).toBe("fatal");
  });

  it("defaults unknown error strings to recoverable", () => {
    expect(classifyError("some-future-error")).toBe("recoverable");
  });
});

describe("capability detection (VOICE-08)", () => {
  it("isSpeechSupported is false when neither ctor exists (Firefox)", () => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
    expect(isSpeechSupported()).toBe(false);
    expect(getSpeechRecognitionCtor()).toBeNull();
  });

  it("resolves the webkit-prefixed ctor when present", () => {
    class FakeCtor {}
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
      FakeCtor;
    expect(isSpeechSupported()).toBe(true);
    expect(getSpeechRecognitionCtor()).toBe(FakeCtor);
  });

  it("prefers the unprefixed ctor over the webkit one", () => {
    class Std {}
    class Webkit {}
    (window as { SpeechRecognition?: unknown }).SpeechRecognition = Std;
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
      Webkit;
    expect(getSpeechRecognitionCtor()).toBe(Std);
  });
});

describe("supportsContinuous / isIOS", () => {
  it("supportsContinuous is false on iOS", () => {
    setPlatform("iPhone");
    expect(isIOS()).toBe(true);
    expect(supportsContinuous()).toBe(false);
  });

  it("supportsContinuous is true off iOS", () => {
    setPlatform("Linux x86_64");
    expect(isIOS()).toBe(false);
    expect(supportsContinuous()).toBe(true);
  });
});

describe("computeBackoff (D-12)", () => {
  it("starts at the 200ms base", () => {
    expect(computeBackoff(0)).toBe(200);
  });

  it("grows exponentially from the base", () => {
    expect(computeBackoff(1)).toBe(400);
    expect(computeBackoff(2)).toBe(800);
  });

  it("never exceeds the 2000ms cap", () => {
    expect(computeBackoff(10)).toBe(BACKOFF_CAP_MS);
    expect(computeBackoff(100)).toBeLessThanOrEqual(BACKOFF_CAP_MS);
  });
});
