// Incidents overlay read hook (OVERLAY-04) — mirrors useReadings.ts's shape
// but adds an `enabled` gate (incidents only fetch when the "Incidents"
// overlay toggle is on) and keys narrowly on { start_date, end_date} only —
// IncidentFilters (backend/app/deps.py) accepts nothing else, so keying on
// the full ResolvedFilters would cause needless refetches on AM/PM or
// category changes with zero server-side effect (T-09-06).
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getIncidents } from "../api/client";

type DateWindow = { start_date?: string; end_date?: string };

export function useIncidents(window: DateWindow, enabled: boolean) {
  return useQuery({
    queryKey: ["incidents", window],
    queryFn: () => getIncidents(window),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
