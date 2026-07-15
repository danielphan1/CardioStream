// Stats query hooks — DASH-07, DASH-08.
//
// `useResolvedFilters` is the store → params bridge every dashboard component
// uses: it subscribes to the zustand filter store, fetches the preset anchor
// (`latest_reading` is UNFILTERED in every stats response, so the
// empty-filter query is the stable anchor — TanStack dedupes it with the
// main stats query whenever filters are empty), and applies
// lib/dates.ts `resolveFilters` (anchored to the newest reading, never today).
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getStatsSummary } from "../api/client";
import type { ResolvedFilters } from "../api/types";
import { resolveFilters } from "../lib/dates";
import { useFilters } from "../store/filters";

export function useStats(resolved: ResolvedFilters) {
  return useQuery({
    queryKey: ["stats", resolved],
    queryFn: () => getStatsSummary(resolved),
    placeholderData: keepPreviousData, // v5 rename — Pitfall 13
    staleTime: 5 * 60_000, // data changes only on (Phase 5) uploads
  });
}

/**
 * Subscribe to the filter store and resolve it into concrete query params.
 * Returns `ResolvedFilters` ready for useReadings/useStats query keys.
 */
export function useResolvedFilters(): ResolvedFilters {
  const datePreset = useFilters((s) => s.datePreset);
  const customRange = useFilters((s) => s.customRange);
  const amPm = useFilters((s) => s.amPm);
  const bpCategory = useFilters((s) => s.bpCategory);

  // Unfiltered stats query = the stable preset anchor (latest_reading).
  const { data: anchor } = useQuery({
    queryKey: ["stats", {}],
    queryFn: () => getStatsSummary({}),
    staleTime: Infinity, // latest_reading changes only on (Phase 5) uploads
  });

  return resolveFilters(
    { datePreset, customRange, amPm, bpCategory },
    anchor?.latest_reading ?? null,
  );
}
