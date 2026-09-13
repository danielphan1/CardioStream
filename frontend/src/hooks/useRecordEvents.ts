// Read hooks for the three record/event datasets — labs, incidents and
// procedures (OVERLAY-04). One shared body; the three exports differ only in
// their query key and fetcher.
//
// Mirrors useReadings.ts's shape but adds an `enabled` gate (a dataset only
// fetches when its Show-panel box is on) and keys narrowly on
// { start_date, end_date } only — LabFilters / IncidentFilters /
// ProcedureFilters (backend/app/deps.py) accept nothing else, so keying on the
// full ResolvedFilters would cause needless refetches on AM/PM or category
// changes with zero server-side effect (T-09-06).
//
// The "labs" / "incidents" / "procedures" key strings are load-bearing:
// useCreateRecord.ts invalidates against those exact literals.
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getIncidents, getLabs, getProcedures } from "../api/client";

type DateWindow = { start_date?: string; end_date?: string };

function useRecordEvents<T>(
  key: string,
  fetcher: (window: DateWindow) => Promise<T>,
  window: DateWindow,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [key, window],
    queryFn: () => fetcher(window),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useLabs(window: DateWindow, enabled: boolean) {
  return useRecordEvents("labs", getLabs, window, enabled);
}

export function useIncidents(window: DateWindow, enabled: boolean) {
  return useRecordEvents("incidents", getIncidents, window, enabled);
}

export function useProcedures(window: DateWindow, enabled: boolean) {
  return useRecordEvents("procedures", getProcedures, window, enabled);
}
