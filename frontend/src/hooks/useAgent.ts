// TanStack v5 mutation wrapper around postAgent (VOICE-08). No query cache for
// agent replies (RESEARCH anti-pattern) — the reply is an imperative action,
// not cacheable server state; reply handling lives at the call site's onSuccess.
import { useMutation } from "@tanstack/react-query";

import { postAgent } from "../api/client";

export function useAgent() {
  return useMutation({ mutationFn: postAgent });
}
