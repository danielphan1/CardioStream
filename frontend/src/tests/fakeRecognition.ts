// Injectable SpeechRecognition test double (04-01, VOICE-01). jsdom has no
// SpeechRecognition, so Wave-2 hook tests install this fake into the window global
// and drive synthetic onresult/onend/onerror events. Shape follows 04-RESEARCH
// §Code Examples verbatim: start/stop/abort as vi.fn(), stop() fires onend, plus
// emitResult/emitError drivers. Mirrors the thin test-global convention in setup.ts.

export class FakeRecognition {
  // Every instance the code-under-test constructs is registered here so a test can
  // grab the one the hook created (see installFakeRecognition's getter).
  static instances: FakeRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";

  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  /** Fire a synthetic onresult with a results-array-shaped payload (interim or final). */
  emitResult(transcript: string, isFinal: boolean): void {
    this.onresult?.({
      results: [Object.assign([{ transcript }], { isFinal })],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent);
  }

  /** Fire a synthetic onerror with the given error string (e.g. "no-speech"). */
  emitError(error: string): void {
    this.onerror?.({ error } as SpeechRecognitionErrorEvent);
  }
}

/**
 * Install FakeRecognition as `window.webkitSpeechRecognition`, resetting the
 * instance registry. Returns a getter for the LAST-constructed instance so the
 * test can drive the recognizer the hook creates after this call.
 */
export function installFakeRecognition(): () => FakeRecognition | null {
  FakeRecognition.instances = [];
  (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
    FakeRecognition as unknown as SpeechRecognitionConstructor;
  return () => FakeRecognition.instances.at(-1) ?? null;
}
