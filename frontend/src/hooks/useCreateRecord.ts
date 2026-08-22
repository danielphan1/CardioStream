// TanStack v5 mutation wrappers around postLab/postIncident/postProcedure
// (OVERLAY-02). Mirrors useAgent.ts's exact one-line-per-hook shape, plus an
// onSuccess cache invalidation (OVERLAY-04) so a caregiver's newly submitted
// record surfaces in the overlay immediately instead of waiting out
// useLabs/useIncidents/useProcedures' 5-minute staleTime.
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { postIncident, postLab, postProcedure } from "../api/client";

export function useCreateLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postLab,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labs"] }),
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}

export function useCreateProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postProcedure,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedures"] }),
  });
}
