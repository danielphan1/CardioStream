// Procedures overlay read hook (OVERLAY-04) — mirrors useReadings.ts's shape
// but adds an `enabled` gate (procedures only fetch when the "Procedures"
// overlay toggle is on) and keys narrowly on { start_date, end_date } only —
// ProcedureFilters (backend/app/deps.py) accepts nothing else, so keying on
// the full ResolvedFilters would cause needless refetches on AM/PM or
// category changes with zero server-side effect (T-09-06).
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getProcedures } from "../api/client";

type DateWindow = { start_date?: string; end_date?: string };

export function useProcedures(window: DateWindow, enabled: boolean) {
  return useQuery({
    queryKey: ["procedures", window],
    queryFn: () => getProcedures(window),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
