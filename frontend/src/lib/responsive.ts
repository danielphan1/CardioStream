/**
 * Pure breakpoint predicate for the ReadingsTable mobile card-layout reflow
 * (DASH-09, /impeccable critique P1, 2026-08-27).
 *
 * NO React, NO DOM imports — the caller measures the container's live
 * rendered width (via `useElementWidth`) and passes the number in here, so
 * this stays as testable as chartData.ts's pure functions.
 */

/** Tailwind's `sm` breakpoint (already used by StatsStrip's `sm:grid-cols-2`
 * and documented in DESIGN.md's breakpoint scale) — reused here as the
 * table/card cutover width rather than inventing a new value. */
export const CARD_LAYOUT_MAX_WIDTH_PX = 640;

/**
 * Whether ReadingsTable should render stacked cards instead of the
 * 6-column table. `width <= 0` means "not yet measured" (the
 * ResizeObserver in `useElementWidth` hasn't fired yet) and deliberately
 * returns false: the table renders first and only flips to cards once a
 * real narrow width is confirmed, avoiding a layout flash. This also
 * matches what jsdom always reports (see `frontend/src/tests/setup.ts`'s
 * no-op ResizeObserver stub), which is why the existing
 * ReadingsTable.test.tsx suite needs zero changes — jsdom's measured width
 * is always 0, so shouldUseCardLayout(0) is false and the table always
 * renders in tests.
 */
export function shouldUseCardLayout(width: number): boolean {
  return width > 0 && width < CARD_LAYOUT_MAX_WIDTH_PX;
}
