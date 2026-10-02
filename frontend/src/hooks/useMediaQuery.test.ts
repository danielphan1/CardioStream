// Unit tests for useMediaQuery (16.1-03). The absent-matchMedia case is the
// load-bearing one: jsdom genuinely does not implement matchMedia (verified
// empirically — `typeof window.matchMedia === "undefined"` under this setup),
// so without the guard every component test that renders the shell throws.
// Stub-and-restore technique mirrors chartData.test.ts's prefersReducedMotion
// tests.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMediaQuery } from "./useMediaQuery";

/** A minimal controllable MediaQueryList: `fire(next)` emits a `change` event
 *  to every registered listener, so the re-render path is exercised for real
 *  rather than mocked out. */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;
  let removeCalls = 0;

  const factory = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
      removeCalls += 1;
      listeners.delete(cb);
    },
  })) as unknown as typeof window.matchMedia;

  return {
    factory,
    fire(next: boolean) {
      matches = next;
      for (const cb of listeners) {
        cb({ matches: next } as MediaQueryListEvent);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
    get removeCalls() {
      return removeCalls;
    },
  };
}

/** Installs a stub for the duration of `body`, always restoring the original
 *  (which is `undefined` in jsdom — assigning it back is still correct). */
function withMatchMedia(
  stub: ReturnType<typeof stubMatchMedia>,
  body: () => void,
): void {
  const original = window.matchMedia;
  window.matchMedia = stub.factory;
  try {
    body();
  } finally {
    window.matchMedia = original;
  }
}

describe("useMediaQuery", () => {
  it("returns false when matchMedia is unavailable (jsdom guard) and does not throw", () => {
    expect(typeof window.matchMedia).toBe("undefined");
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);
  });

  it("returns the current matches value when matchMedia is available", () => {
    const stub = stubMatchMedia(true);
    withMatchMedia(stub, () => {
      const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
      expect(result.current).toBe(true);
    });
  });

  it("re-renders with the new value on a change event and removes the listener on unmount", () => {
    const stub = stubMatchMedia(false);
    withMatchMedia(stub, () => {
      const { result, unmount } = renderHook(() =>
        useMediaQuery("(min-width: 1024px)"),
      );
      expect(result.current).toBe(false);
      expect(stub.listenerCount).toBe(1);

      act(() => stub.fire(true));
      expect(result.current).toBe(true);

      unmount();
      expect(stub.removeCalls).toBeGreaterThanOrEqual(1);
      expect(stub.listenerCount).toBe(0);
    });
  });
});
