// Unit tests for lib/responsive.ts — shouldUseCardLayout boundary behavior
// (ReadingsTable mobile card-layout reflow, /impeccable critique P1,
// 2026-08-27).
import { describe, expect, it } from "vitest";

import { shouldUseCardLayout } from "./responsive";

describe("shouldUseCardLayout", () => {
  it("not yet measured (width 0) -> false", () => {
    expect(shouldUseCardLayout(0)).toBe(false);
  });

  it("desktop width (1024) -> false", () => {
    expect(shouldUseCardLayout(1024)).toBe(false);
  });

  it("exactly at breakpoint (640) -> false (boundary is exclusive)", () => {
    expect(shouldUseCardLayout(640)).toBe(false);
  });

  it("just below breakpoint (639) -> true", () => {
    expect(shouldUseCardLayout(639)).toBe(true);
  });

  it("common phone width (390) -> true", () => {
    expect(shouldUseCardLayout(390)).toBe(true);
  });
});
