// Readings query hook — server state stays in TanStack Query (CLAUDE.md
// separation). Keyed on the RESOLVED filters so every filter combination has
// its own cache entry; keepPreviousData avoids blank flashes on filter
// changes (UI-SPEC loading contract, RESEARCH Pitfall 13 v5 rename).
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getReadings } from "../api/client";
import type { ResolvedFilters } from "../api/types";

export function useReadings(resolved: ResolvedFilters) {
  return useQuery({
    queryKey: ["readings", resolved],
    queryFn: () => getReadings(resolved),
    placeholderData: keepPreviousData, // v5 rename — Pitfall 13
    staleTime: 5 * 60_000, // data changes only on (Phase 5) uploads
  });
}
