// TanStack v5 mutation wrappers around postLab/postIncident/postProcedure
// (OVERLAY-02). Mirrors useAgent.ts's exact one-line-per-hook shape — no
// query cache, no wrapper logic beyond the mutationFn.
import { useMutation } from "@tanstack/react-query";

import { postIncident, postLab, postProcedure } from "../api/client";

export function useCreateLab() {
  return useMutation({ mutationFn: postLab });
}

export function useCreateIncident() {
  return useMutation({ mutationFn: postIncident });
}

export function useCreateProcedure() {
  return useMutation({ mutationFn: postProcedure });
}
