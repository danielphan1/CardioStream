// Injectable SpeechSynthesis test double (10-02, TTS-01..05). jsdom has no
// SpeechSynthesis/SpeechSynthesisUtterance — this fake mirrors
// tests/fakeRecognition.ts's shape/conventions (static instance registry,
// vi.fn() mocks, an install*() helper) so store/speech.test.ts (and later
// useVoiceCommand.test.ts) can drive synthetic onstart/onend/onerror events.

export class FakeUtterance {
  // Every instance the code-under-test constructs is registered here so a
  // test can grab the one speak() created (see FakeUtterance.instances.at(-1)).
  static instances: FakeUtterance[] = [];

  text: string;
  lang = "";

  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
    FakeUtterance.instances.push(this);
  }

  /** Fire a synthetic onstart. */
  emitStart(): void {
    this.onstart?.();
  }

  /** Fire a synthetic onend. */
  emitEnd(): void {
    this.onend?.();
  }

  /** Fire a synthetic onerror (Safari may fire this instead of onend after cancel()). */
  emitError(): void {
    this.onerror?.();
  }
}

export const fakeSpeechSynthesis = {
  speak: vi.fn((u: FakeUtterance) => void u),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
};

/**
 * Install FakeUtterance as `window.SpeechSynthesisUtterance` and
 * fakeSpeechSynthesis as `window.speechSynthesis`, resetting the instance
 * registry and clearing both mock call logs.
 */
export function installFakeSpeechSynthesis(): void {
  FakeUtterance.instances = [];
  fakeSpeechSynthesis.speak.mockClear();
  fakeSpeechSynthesis.cancel.mockClear();
  fakeSpeechSynthesis.getVoices.mockClear();
  (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
    FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
  (window as { speechSynthesis?: unknown }).speechSynthesis = fakeSpeechSynthesis;
}
