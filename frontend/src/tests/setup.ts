// Vitest setup — registers jest-dom matchers on Vitest's expect (plan 02-02).
import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver (real browsers universally do) —
// stub it so components that measure live layout (e.g. App.tsx's
// useClearanceHeight, 11-05) don't throw ReferenceError in tests. No test
// asserts on actual measured sizes; jsdom's getBoundingClientRect always
// returns zeroed rects regardless, so a no-op observer is sufficient.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
