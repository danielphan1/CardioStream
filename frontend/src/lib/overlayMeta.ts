// Single shared icon/color/glyph map for the three overlay dataset types
// (OVERLAY-03/04). Every downstream render surface — Plan 09-04's
// OverlayToggle/OverlayEventsList, Plan 09-05's chart markers — imports from
// here instead of re-declaring a 3-4-way duplicated inline map. All values are
// locked verbatim from 09-UI-SPEC.md's Marker & Icon Contract table — do not
// re-derive.
import type { ComponentType } from "react";
import { AlertTriangle, ClipboardList, FlaskConical } from "lucide-react";

import type { OverlayDataset } from "../api/types";

export const OVERLAY_ORDER: OverlayDataset[] = [
  "labs",
  "incidents",
  "procedures",
];

export const OVERLAY_META: Record<
  OverlayDataset,
  {
    label: string;
    tableLabel: string;
    Icon: ComponentType<{ size?: number; "aria-hidden"?: string }>;
    color: string;
    glyph: string;
  }
> = {
  labs: {
    label: "Labs",
    tableLabel: "Lab",
    Icon: FlaskConical,
    color: "var(--overlay-labs)",
    glyph: "◆",
  },
  incidents: {
    label: "Incidents",
    tableLabel: "Incident",
    Icon: AlertTriangle,
    color: "var(--overlay-incidents)",
    glyph: "▲",
  },
  procedures: {
    label: "Procedures",
    tableLabel: "Procedure",
    Icon: ClipboardList,
    color: "var(--overlay-procedures)",
    glyph: "■",
  },
};
