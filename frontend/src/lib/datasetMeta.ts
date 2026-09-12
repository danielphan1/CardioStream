// Single shared label/kind/colour/stroke map for all FIVE Show-panel datasets
// (Phase 14, D-01/D-02). Extends the OVERLAY_META pattern rather than replacing
// it: the three event types keep their own module because the event hooks,
// OverlayEventsList, and the chart markers legitimately deal in events only.
//
// Event colours are READ FROM OVERLAY_META, never re-declared — the exact
// drift overlayMeta.ts's own header comment exists to prevent.
import type { ComponentType } from "react";
import { Activity, HeartPulse } from "lucide-react";

import type { OverlayDataset, SeriesDataset } from "../api/types";
import { OVERLAY_META } from "./overlayMeta";

/** Fixed render order — vitals first, then events, matching the reading order
 *  of the chart itself. Never sorted, never derived from selection. */
export const DATASET_ORDER: SeriesDataset[] = [
  "blood_pressure",
  "pulse",
  "labs",
  "incidents",
  "procedures",
];

type DatasetEntry = {
  label: string;
  /** Vitals plot as lines on an axis; events plot as vertical date markers. */
  kind: "vital" | "event";
  Icon: ComponentType<{ size?: number; "aria-hidden"?: "true" | "false" }>;
  /** CSS var string — theme-aware, resolved at paint (see index.css). */
  color: string;
  /** SVG strokeDasharray for vitals; undefined means a solid line.
   *  Pulse is dashed because its luminance ratio against systolic is only
   *  ~1.9:1 — in greyscale the stroke pattern, not the hue, separates them. */
  dash?: string;
  /** Marker glyph for events; vitals use a line swatch instead. */
  glyph?: string;
};

const isEvent = (d: SeriesDataset): d is OverlayDataset =>
  d === "labs" || d === "incidents" || d === "procedures";

export const DATASET_META: Record<SeriesDataset, DatasetEntry> = {
  blood_pressure: {
    label: "Blood Pressure",
    kind: "vital",
    Icon: Activity,
    color: "var(--line-systolic)",
  },
  pulse: {
    label: "Pulse",
    kind: "vital",
    Icon: HeartPulse,
    color: "var(--line-pulse)",
    dash: "9 5",
  },
  labs: {
    label: OVERLAY_META.labs.label,
    kind: "event",
    Icon: OVERLAY_META.labs.Icon,
    color: OVERLAY_META.labs.color,
    glyph: OVERLAY_META.labs.glyph,
  },
  incidents: {
    // Stays "Incidents", not "Hospital stays" (D-07): this dataset also holds
    // falls and seizures, so Chris's phrase would mislabel them. His wording
    // still reaches it by voice — prompt.py maps "hospital stays" to incidents.
    label: OVERLAY_META.incidents.label,
    kind: "event",
    Icon: OVERLAY_META.incidents.Icon,
    color: OVERLAY_META.incidents.color,
    glyph: OVERLAY_META.incidents.glyph,
  },
  procedures: {
    label: OVERLAY_META.procedures.label,
    kind: "event",
    Icon: OVERLAY_META.procedures.Icon,
    color: OVERLAY_META.procedures.color,
    glyph: OVERLAY_META.procedures.glyph,
  },
};

/** The three event types, in DATASET_ORDER, that are currently switched on. */
export function enabledEventTypes(
  visible: Record<SeriesDataset, boolean>,
): OverlayDataset[] {
  return DATASET_ORDER.filter(
    (d): d is OverlayDataset => isEvent(d) && visible[d],
  );
}

/** True when at least one vitals series is on — the chart has something to
 *  plot. False means the timeline slot renders the dated event list instead. */
export function hasVitals(visible: Record<SeriesDataset, boolean>): boolean {
  return visible.blood_pressure || visible.pulse;
}
