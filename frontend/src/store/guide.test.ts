// Unit tests for the guide zustand store (D-01..D-05) — the store is
// testable without React via useGuide.getState(). Mirrors
// agentStatus.test.ts's setState-reset-in-beforeEach convention.
import { beforeEach, describe, expect, it } from "vitest";

import { useGuide } from "./guide";

beforeEach(() => {
  useGuide.setState({ open: false });
});

describe("useGuide initial state", () => {
  it("defaults to open: false (guide starts closed)", () => {
    expect(useGuide.getState().open).toBe(false);
  });
});

describe("setOpen", () => {
  it("sets open to true with no side effects beyond state", () => {
    useGuide.getState().setOpen(true);
    expect(useGuide.getState().open).toBe(true);
  });

  it("sets open to false", () => {
    useGuide.setState({ open: true });
    useGuide.getState().setOpen(false);
    expect(useGuide.getState().open).toBe(false);
  });
});

describe("toggleOpen", () => {
  it("flips open from false to true", () => {
    useGuide.getState().toggleOpen();
    expect(useGuide.getState().open).toBe(true);
  });

  it("flips open from true to false", () => {
    useGuide.setState({ open: true });
    useGuide.getState().toggleOpen();
    expect(useGuide.getState().open).toBe(false);
  });
});
