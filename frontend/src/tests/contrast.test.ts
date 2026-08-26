// WCAG contrast regression test for the new terracotta/coral accent pair
// (D-03). Mirrors index.css's :root/.dark hex literals so a future token
// edit that regresses contrast fails this test rather than shipping.
import { hex } from "wcag-contrast";
import { describe, expect, it } from "vitest";

const LIGHT = {
  foam: "#F2F7F5",
  sky: "#E2EDF2",
  accent: "#B94927",
  accentText: "#FFFFFF",
};

const DARK = {
  foam: "#0B1626",
  sky: "#13233A",
  accent: "#DA6F4E",
  accentText: "#0B1626",
};

describe("light theme — accent contrast floors", () => {
  it("accent text on accent fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(LIGHT.accentText, LIGHT.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("accent against foam clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.foam)).toBeGreaterThanOrEqual(3);
  });

  it("accent against sky clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.sky)).toBeGreaterThanOrEqual(3);
  });
});

describe("dark theme — accent contrast floors", () => {
  it("accent text on accent fill clears AA normal text (4.5:1, WCAG 1.4.3)", () => {
    expect(hex(DARK.accentText, DARK.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("accent against foam clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.accent, DARK.foam)).toBeGreaterThanOrEqual(3);
  });

  it("accent against sky clears non-text UI floor (3:1, WCAG 1.4.11)", () => {
    expect(hex(DARK.accent, DARK.sky)).toBeGreaterThanOrEqual(3);
  });
});
