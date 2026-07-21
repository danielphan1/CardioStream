// Ambient Web Speech API declarations (04-01, VOICE-01). TS's lib.dom ships
// SpeechRecognitionResult/ResultList/Alternative but NOT the recognizer itself,
// its event, its error event, or the webkit-prefixed window constructors — declare
// the minimal shape lib/voice.ts and the Wave-2 useVoiceCommand hook consume, so
// `tsc -b` and the ctor lookup compile without `as any` casts.

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

// Chrome/Edge expose the unprefixed constructor; Safari/iOS the webkit-prefixed
// one (both optional — Firefox has neither → VOICE-08 text fallback).
interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
