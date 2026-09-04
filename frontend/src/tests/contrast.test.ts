// WCAG contrast regression test for the Phase 13 "Slack Water" (light) /
// "Night Watch" (dark) brass, hazard, and panel token trio. Mirrors
// index.css's :root/.dark hex literals so a future token edit that
// regresses contrast fails this test rather than shipping.
import { hex } from "wcag-contrast";
import { describe, expect, it } from "vitest";

const LIGHT = {
  deck: "#F5F7F6",
  mist: "#E3EBE9",
  brass: "#8A5A1E",
  brassText: "#FFFFFF",
  hazard: "#9C2B22",
  hazardText: "#FFFFFF",
  panel: "#101C2E",
  panelText: "#F5F7F6",
};

const DARK = {
  deck: "#0A121F",
  mist: "#101D30",
  brass: "#D9A356",
  brassText: "#0A121F",
  hazard: "#E2685A",
  hazardText: "#0A121F",
  panel: "#050A12",
  panelText: "#F5F7F6",
};

describe("light theme — brass contrast floors", () => {
  it("brass text on brass fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.brassText, LIGHT.brass)).toBeGreaterThanOrEqual(4.5);
  });

  it("brass against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.brass, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });

  it("brass against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.brass, LIGHT.mist)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme — brass contrast floors", () => {
  it("brass text on brass fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.brassText, DARK.brass)).toBeGreaterThanOrEqual(4.5);
  });

  it("brass against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.brass, DARK.deck)).toBeGreaterThanOrEqual(3);
  });

  it("brass against mist clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.brass, DARK.mist)).toBeGreaterThanOrEqual(3);
  });
});

describe("light theme — hazard contrast floors", () => {
  it("hazard text on hazard fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.hazardText, LIGHT.hazard)).toBeGreaterThanOrEqual(4.5);
  });

  it("hazard against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.hazard, LIGHT.deck)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme — hazard contrast floors", () => {
  it("hazard text on hazard fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.hazardText, DARK.hazard)).toBeGreaterThanOrEqual(4.5);
  });

  it("hazard against deck clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.hazard, DARK.deck)).toBeGreaterThanOrEqual(3);
  });
});

describe("light theme — panel contrast floors", () => {
  it("panel text on panel fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.panelText, LIGHT.panel)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("dark theme — panel contrast floors", () => {
  it("panel text on panel fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.panelText, DARK.panel)).toBeGreaterThanOrEqual(4.5);
  });
});
