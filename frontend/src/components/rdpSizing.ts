// react-day-picker v9 CSS custom properties — day cells at the 48px target
// floor, selected-day styling on the accent tokens (theme-aware via index.css).
//
// MUST be spread onto <DayPicker> itself, never onto a wrapper element.
// react-day-picker declares every one of these on `.rdp-root` in its own
// stylesheet, and a declaration ON an element beats a value inherited from an
// ancestor — so from a wrapper the whole object is silently discarded and the
// calendar renders at the library's 42px default in its default `blue`.
// DayPicker forwards `props.style` to the root element, which is the one place
// these win. (Found in 261003-iuc; same shape as the `.chart-band` fill-opacity
// bug — the rule has to name the element that actually paints.)
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
  "--rdp-accent-color": "var(--color-accent)",
  "--rdp-accent-background-color": "var(--color-mist)",
  // Defaults to --rdp-accent-color upstream, but spelled out so the today ring
  // cannot silently drift back to the library blue if that default changes.
  "--rdp-today-color": "var(--color-accent)",
} as CSSProperties;
