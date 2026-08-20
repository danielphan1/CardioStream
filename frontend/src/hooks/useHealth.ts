// RED stub — intentionally incomplete (TDD RED phase). GREEN implementation
// follows in the next commit.
import { useQuery } from "@tanstack/react-query";

import { getHealth } from "../api/client";

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: getHealth });
}
