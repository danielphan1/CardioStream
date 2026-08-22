/**
 * Pure data-shaping functions merging LabResult/Incident/Procedure arrays
 * into one merged, sorted `OverlayEvent[]` plus the UI-SPEC-locked copy
 * strings for the overlay events section (OVERLAY-04/OVERLAY-06).
 *
 * NO React, NO Recharts imports — same governing constraint as chartData.ts
 * (Recharts renders 0×0 in jsdom); chart/table components only lay out JSX
 * around these outputs.
 *
 * Date contract (Pitfall 1): LabResult.date / Procedure.date are date-only
 * columns ("YYYY-MM-DD") and MUST route through parseDateOnly, never bare
 * `new Date()` (UTC-midnight off-by-one in negative-offset timezones).
 * Incident.datetime is a naive-local ISO WITH a time component and routes
 * through plain `new Date()`, matching toTimePoints' existing convention.
 */
import type { Incident, LabResult, OverlayDataset, Procedure } from "../api/types";
import { fmtLongDate, parseDateOnly } from "./dates";
import { OVERLAY_META, OVERLAY_ORDER } from "./overlayMeta";

/** One shaped overlay event — chart `ReferenceLine` markers (Plan 09-05)
 * and the accessible events table (Plan 09-04) both consume this. */
export type OverlayEvent = {
  id: number;
  ts: number; // epoch ms
  type: OverlayDataset;
  dateCell: string;
  whatHappened: string;
  notes: string | null;
};

/** "June 3, 2025" from a date-only "YYYY-MM-DD" string (Pitfall 1 — routes
 * through parseDateOnly, never bare `new Date()`). Mirrors the pattern
 * already used by ReadingsTable.tsx's fmtDateCell / lib/agent.ts's
 * fmtLongDateOnly. */
function fmtLongDateOnly(dateOnly: string): string {
  return parseDateOnly(dateOnly).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function labsToEvents(labs: LabResult[]): OverlayEvent[] {
  return labs.map((l) => ({
    id: l.id,
    ts: parseDateOnly(l.date).getTime(),
    type: "labs",
    dateCell: fmtLongDateOnly(l.date),
    whatHappened:
      l.test_name + (l.result != null ? ` — ${l.result}${l.unit ? ` ${l.unit}` : ""}` : ""),
    notes: l.notes,
  }));
}

export function incidentsToEvents(incidents: Incident[]): OverlayEvent[] {
  return incidents.map((i) => {
    const time = new Date(i.datetime).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return {
      id: i.id,
      ts: new Date(i.datetime).getTime(),
      type: "incidents",
      dateCell: `${fmtLongDate(i.datetime)}, ${time}`,
      whatHappened: i.incident_type + (i.duration ? ` — ${i.duration}` : ""),
      notes: i.notes,
    };
  });
}

export function proceduresToEvents(procedures: Procedure[]): OverlayEvent[] {
  return procedures.map((p) => ({
    id: p.id,
    ts: parseDateOnly(p.date).getTime(),
    type: "procedures",
    dateCell: fmtLongDateOnly(p.date),
    whatHappened:
      p.procedure_name +
      (p.location ? ` — ${p.location}` : "") +
      (p.outcome ? `; ${p.outcome}` : ""),
    notes: p.notes,
  }));
}

/** Merges the three per-type arrays and sorts strictly descending by `ts`
 * (newest-first, matches ReadingsTable's convention), correctly
 * interleaving mixed types regardless of input array order. */
export function mergeOverlayEvents(
  labs: OverlayEvent[],
  incidents: OverlayEvent[],
  procedures: OverlayEvent[],
): OverlayEvent[] {
  return [...labs, ...incidents, ...procedures].sort((a, b) => b.ts - a.ts);
}

/** Joins plural nouns with "or" for 2 items, Oxford-comma+"or" for 3+. */
function joinWithOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

/** "No labs recorded in this date range." / "No labs or incidents recorded
 * in this date range." / "No labs, incidents, or procedures recorded in
 * this date range." — lowercase plural nouns, fixed labs→incidents→
 * procedures order regardless of input array order (Copywriting Contract). */
export function buildEmptyMessage(onTypes: OverlayDataset[]): string {
  const ordered = OVERLAY_ORDER.filter((t) => onTypes.includes(t));
  return `No ${joinWithOr(ordered)} recorded in this date range.`;
}

/** "Couldn't load {type} — try again in a moment." — isolated per dataset
 * (Copywriting Contract). */
export function buildErrorMessage(type: OverlayDataset): string {
  return `Couldn't load ${type} — try again in a moment.`;
}

/** "{list} overlaid" joining the ON datasets' capitalized labels in fixed
 * labs→incidents→procedures order; "No overlays selected" when none are ON
 * (D-20 sentence pattern, mirrors FilterBar's own live-state sentence). */
export function buildOverlaySentence(
  overlayDatasets: Record<OverlayDataset, boolean>,
): string {
  const on = OVERLAY_ORDER.filter((t) => overlayDatasets[t]);
  if (on.length === 0) return "No overlays selected";
  return `${on.map((t) => OVERLAY_META[t].label).join(", ")} overlaid`;
}
