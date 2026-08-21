/**
 * Date parsing, formatting, and filter resolution — the ONE module all
 * dashboard plans use for dates (DASH-07, D-17, D-18).
 *
 * Parsing rules (RESEARCH Pitfall 1):
 * - Date-only strings ("YYYY-MM-DD") are ALWAYS split-parsed into local
 *   components via `parseDateOnly` — `new Date("YYYY-MM-DD")` parses as UTC
 *   midnight and is off by one day in negative-offset timezones.
 * - API datetimes ("2025-06-13T09:21:00", naive ISO with a time component)
 *   parse with `new Date()` directly — the spec says local time, which is
 *   exactly the DATA-05 naive-local contract.
 *
 * DECISION (RESEARCH Open Question 1 / Pitfall 9): date presets anchor to the
 * NEWEST READING (`latest_reading` from /stats/summary), never to today.
 * The seeded data ends 2025-06-13; today-anchored presets would render an
 * empty dashboard forever. Phase 3's server-side resolver (API-05) MUST copy
 * this same anchor so voice commands and manual filters resolve identically.
 */
import type { BPCategory, ResolvedFilters } from "../api/types";

export type DatePreset = "7d" | "30d" | "90d" | "all" | "custom";

/** The date-relevant slice of the filter store (store/filters.ts). */
export type FilterDateState = {
  datePreset: DatePreset;
  customRange: { from: string | null; to: string | null };
  amPm: "all" | "AM" | "PM";
  bpCategory: "all" | BPCategory;
};

const PRESET_DAYS: Partial<Record<DatePreset, number>> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Split-parse a "YYYY-MM-DD" string to a LOCAL-midnight Date (Pitfall 1). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date's LOCAL components as "YYYY-MM-DD" for query params. */
export function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict "YYYY-MM-DD" check: regex shape + round-trip through parseDateOnly
 * so impossible dates like 2025-02-31 (which JS rolls over) are rejected. */
export function isValidDateText(s: string): boolean {
  return DATE_RE.test(s) && formatDateParam(parseDateOnly(s)) === s;
}

/** Combine a "YYYY-MM-DD" date and "HH:MM" time into the codebase's naive-local,
 * seconds-included datetime string (DATA-05) — NEVER `.toISOString()`, which
 * appends `Z`/UTC-converts and would violate this file's naive-local contract. */
export function combineLocalDateTime(dateText: string, timeText: string): string {
  return `${dateText}T${timeText}:00`;
}

/** "June 13, 2025" — UI-SPEC long date form. */
export function fmtLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "Jun 13" — axis tick form from epoch ms. */
export function fmtShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "June 3, 2025 · 7:42 AM" — UI-SPEC tooltip title (D-09). */
export function fmtTooltipTitle(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${fmtLongDate(iso)} · ${time}`;
}

/**
 * Single source of preset display labels (D-20). FilterBar (02-05) and
 * App/EmptyState (02-07) import this instead of re-deriving labels.
 */
export function presetLabel(preset: DatePreset): string {
  switch (preset) {
    case "all":
      return "All data";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "custom":
      return "Custom range";
  }
}

/**
 * Resolve the filter store state into concrete /readings + /stats/summary
 * query params. N-day presets are ANCHORED TO THE NEWEST READING: the range
 * is anchor − (N − 1) days through anchor, inclusive (backend end_date is
 * inclusive — Pitfall 4 semantics). When `latestReading` is null and a day
 * preset is active, date keys are omitted (behaves as "all" until the anchor
 * arrives — defensive fallback).
 */
export function resolveFilters(
  state: FilterDateState,
  latestReading: string | null,
): ResolvedFilters {
  const resolved: ResolvedFilters = {};

  const days = PRESET_DAYS[state.datePreset];
  if (days !== undefined && latestReading !== null) {
    const anchor = parseDateOnly(latestReading.slice(0, 10));
    const start = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - (days - 1),
    );
    resolved.start_date = formatDateParam(start);
    resolved.end_date = formatDateParam(anchor);
  } else if (state.datePreset === "custom") {
    if (state.customRange.from !== null) resolved.start_date = state.customRange.from;
    if (state.customRange.to !== null) resolved.end_date = state.customRange.to;
  }
  // "all" (and day presets without an anchor): no date keys.

  if (state.amPm !== "all") resolved.am_pm = state.amPm;
  if (state.bpCategory !== "all") resolved.bp_category = state.bpCategory;

  return resolved;
}
