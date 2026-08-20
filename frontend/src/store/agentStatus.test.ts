// Unit tests for the agentStatus zustand store (Phase 6, D-05/D-07/D-08) —
// the store is testable without React via useAgentStatus.getState(). Mirrors
// filters.test.ts's setState-reset-in-beforeEach convention.
import { beforeEach, describe, expect, it } from "vitest";

import { useAgentStatus } from "./agentStatus";

beforeEach(() => {
  useAgentStatus.setState({ unavailable: false });
});

describe("useAgentStatus initial state", () => {
  it("defaults to unavailable: false (no false-positive flash before the first response)", () => {
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });
});

describe("reportOutcome (D-07)", () => {
  it('sets unavailable to true on kind "unavailable"', () => {
    useAgentStatus.getState().reportOutcome("unavailable");
    expect(useAgentStatus.getState().unavailable).toBe(true);
  });

  it('clears unavailable on kind "applied" (any real reply clears it instantly)', () => {
    useAgentStatus.setState({ unavailable: true });
    useAgentStatus.getState().reportOutcome("applied");
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });

  it('clears unavailable on kind "clarify"', () => {
    useAgentStatus.setState({ unavailable: true });
    useAgentStatus.getState().reportOutcome("clarify");
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });

  it('clears unavailable on kind "refuse"', () => {
    useAgentStatus.setState({ unavailable: true });
    useAgentStatus.getState().reportOutcome("refuse");
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });

  it('clears unavailable on kind "unclear"', () => {
    useAgentStatus.setState({ unavailable: true });
    useAgentStatus.getState().reportOutcome("unclear");
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });
});

describe("syncFromHealth (D-05/D-08)", () => {
  it("reachable=true, configured=true → unavailable false", () => {
    useAgentStatus.getState().syncFromHealth(true, true);
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });

  it("reachable=false, configured=true → unavailable true", () => {
    useAgentStatus.getState().syncFromHealth(false, true);
    expect(useAgentStatus.getState().unavailable).toBe(true);
  });

  it("reachable=null, configured=true → unavailable false (optimistic cold-boot default)", () => {
    useAgentStatus.getState().syncFromHealth(null, true);
    expect(useAgentStatus.getState().unavailable).toBe(false);
  });

  it("reachable=null, configured=false → unavailable true (no key is a known immediate fact)", () => {
    useAgentStatus.getState().syncFromHealth(null, false);
    expect(useAgentStatus.getState().unavailable).toBe(true);
  });
});
