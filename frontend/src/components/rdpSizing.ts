// react-day-picker v9 CSS custom properties — day cells at the 48px target
// floor, selected-day styling on the accent tokens (theme-aware via index.css).
//
// Shared by DateRangePicker and records/SingleDateField, which each carried a
// verbatim copy (SingleDateField's own comment admitted the duplication).
// Its own module rather than components/fields.tsx because a file that exports
// both a component and a non-component breaks React Fast Refresh —
// oxlint's react(only-export-components).
import type { CSSProperties } from "react";

export const rdpSizing = {
  "--rdp-day-width": "48px",
  "--rdp-day-height": "48px",
  "--rdp-day_button-width": "48px",
  "--rdp-day_button-height": "48px",
  "--rdp-accent-color": "var(--color-brass)",
  "--rdp-accent-background-color": "var(--color-mist)",
} as CSSProperties;
