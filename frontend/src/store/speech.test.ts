// Unit tests for the speech zustand store (Phase 10, D-01..D-06, TTS-01..05)
// — the store is testable without React via useSpeech.getState()/.setState().
// Mirrors agentStatus.test.ts's setState-reset-in-beforeEach convention and
// fakeRecognition.ts's install*()/emit*() driver pattern (here via
// fakeSpeechSynthesis.ts).
import { beforeEach, describe, expect, it } from "vitest";

import {
  FakeUtterance,
  fakeSpeechSynthesis,
  installFakeSpeechSynthesis,
} from "../tests/fakeSpeechSynthesis";
import { useSpeech } from "./speech";

beforeEach(() => {
  localStorage.clear();
  installFakeSpeechSynthesis();
  useSpeech.setState({ enabled: true, isSpeaking: false, primed: false });
});

describe("useSpeech initial state", () => {
  it("defaults to enabled: true even with no prior localStorage write (TTS-02)", () => {
    expect(useSpeech.getState().enabled).toBe(true);
  });
});

describe("initSpeech (D-03 persistence)", () => {
  it('reads localStorage "off" as enabled: false', () => {
    localStorage.setItem("hv-speech", "off");
    useSpeech.getState().initSpeech();
    expect(useSpeech.getState().enabled).toBe(false);
  });

  it("defaults to enabled: true when the key is missing", () => {
    useSpeech.getState().initSpeech();
    expect(useSpeech.getState().enabled).toBe(true);
  });

  it('defaults to enabled: true for any value other than "off"', () => {
    localStorage.setItem("hv-speech", "garbage");
    useSpeech.getState().initSpeech();
    expect(useSpeech.getState().enabled).toBe(true);
  });
});

describe("setEnabled (D-03 persistence)", () => {
  it('writes "off" to localStorage when disabling', () => {
    useSpeech.getState().setEnabled(false);
    expect(localStorage.getItem("hv-speech")).toBe("off");
  });

  it('writes "on" to localStorage when enabling', () => {
    useSpeech.getState().setEnabled(false);
    useSpeech.getState().setEnabled(true);
    expect(localStorage.getItem("hv-speech")).toBe("on");
  });

  it("updates the enabled state", () => {
    useSpeech.getState().setEnabled(false);
    expect(useSpeech.getState().enabled).toBe(false);
  });

  it("a throwing localStorage never blocks the call (guarded try/catch)", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => useSpeech.getState().setEnabled(false)).not.toThrow();
      expect(useSpeech.getState().enabled).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("silences an in-progress utterance immediately when muting (RESEARCH A2)", () => {
    useSpeech.getState().speak("hello");
    FakeUtterance.instances.at(-1)!.emitStart();
    expect(useSpeech.getState().isSpeaking).toBe(true);

    useSpeech.getState().setEnabled(false);

    expect(useSpeech.getState().isSpeaking).toBe(false);
    expect(fakeSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});

describe("toggleEnabled", () => {
  it("flips the current enabled value via setEnabled", () => {
    expect(useSpeech.getState().enabled).toBe(true);
    useSpeech.getState().toggleEnabled();
    expect(useSpeech.getState().enabled).toBe(false);
    expect(localStorage.getItem("hv-speech")).toBe("off");
    useSpeech.getState().toggleEnabled();
    expect(useSpeech.getState().enabled).toBe(true);
    expect(localStorage.getItem("hv-speech")).toBe("on");
  });
});

describe("speak (TTS-03 cancel-before-speak)", () => {
  it("no-ops when enabled is false", () => {
    useSpeech.getState().setEnabled(false);
    fakeSpeechSynthesis.cancel.mockClear();
    useSpeech.getState().speak("hello");
    expect(fakeSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('no-ops when text.trim() === ""', () => {
    useSpeech.getState().speak("   ");
    expect(fakeSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it("calls speechSynthesis.cancel() before speak()", () => {
    useSpeech.getState().speak("hello");
    expect(fakeSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(fakeSpeechSynthesis.speak).toHaveBeenCalled();
  });

  it("flips isSpeaking true on onstart", () => {
    useSpeech.getState().speak("hello");
    expect(useSpeech.getState().isSpeaking).toBe(false);
    FakeUtterance.instances.at(-1)!.emitStart();
    expect(useSpeech.getState().isSpeaking).toBe(true);
  });

  it("flips isSpeaking false on onend", () => {
    useSpeech.getState().speak("hello");
    FakeUtterance.instances.at(-1)!.emitStart();
    FakeUtterance.instances.at(-1)!.emitEnd();
    expect(useSpeech.getState().isSpeaking).toBe(false);
  });

  it("flips isSpeaking false on onerror (Safari may fire error instead of end after cancel — Pitfall 2)", () => {
    useSpeech.getState().speak("hello");
    FakeUtterance.instances.at(-1)!.emitStart();
    FakeUtterance.instances.at(-1)!.emitError();
    expect(useSpeech.getState().isSpeaking).toBe(false);
  });

  it("seq guard: a stale onend from a superseded utterance never flips isSpeaking back to false (Pitfall 2)", () => {
    useSpeech.getState().speak("first");
    const first = FakeUtterance.instances.at(-1)!;
    first.emitStart();

    useSpeech.getState().speak("second"); // supersedes "first"
    const second = FakeUtterance.instances.at(-1)!;
    second.emitStart();

    expect(useSpeech.getState().isSpeaking).toBe(true);

    first.emitEnd(); // stale event from the now-cancelled first utterance

    expect(useSpeech.getState().isSpeaking).toBe(true); // must not flip false
  });
});

describe("primeSpeech (Pitfall 1 gesture-unlock)", () => {
  it("plays exactly one empty utterance the first time it's called", () => {
    useSpeech.getState().primeSpeech();
    expect(fakeSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(useSpeech.getState().primed).toBe(true);
  });

  it("is a no-op on every later call", () => {
    useSpeech.getState().primeSpeech();
    useSpeech.getState().primeSpeech();
    useSpeech.getState().primeSpeech();
    expect(fakeSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
  });
});

describe("cancelForBackground", () => {
  it("cancels speechSynthesis and forces isSpeaking false immediately", () => {
    useSpeech.getState().speak("hello");
    FakeUtterance.instances.at(-1)!.emitStart();
    expect(useSpeech.getState().isSpeaking).toBe(true);

    useSpeech.getState().cancelForBackground();

    expect(fakeSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(useSpeech.getState().isSpeaking).toBe(false);
  });

  it("supersedes a late onend/onerror from the just-cancelled utterance", () => {
    useSpeech.getState().speak("hello");
    const utter = FakeUtterance.instances.at(-1)!;
    utter.emitStart();

    useSpeech.getState().cancelForBackground();
    expect(useSpeech.getState().isSpeaking).toBe(false);

    utter.emitEnd(); // late event from the cancelled utterance

    expect(useSpeech.getState().isSpeaking).toBe(false); // still false, not resurrected
  });
});
