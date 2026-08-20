// Liveness poll hook (Phase 6, LIVE-03/D-05/D-08) — mirrors useReadings.ts's
// exact TanStack Query shape, NOT useVoiceCommand.ts's hand-rolled
// visibilitychange listener (RESEARCH Pattern 3): a plain useQuery already
// fetches on mount (LIVE-03's proactive page-load check, for free) and, via
// the installed FocusManager + default refetchOnWindowFocus/staleTime,
// already pauses refetchInterval ticks while the tab is hidden and refetches
// immediately on foreground return (D-08) — no custom listener needed.
import { useQuery } from "@tanstack/react-query";

import { getHealth } from "../api/client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 60_000, // D-05 ~60s anchor, matches D-03's breaker cooldown
    staleTime: 0, // explicit: refetchOnWindowFocus (default true) needs this
    // to fire an immediate refetch on every foreground return (D-08)
  });
}
