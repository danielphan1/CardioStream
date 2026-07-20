# Deferred Items — Phase 03 (agent-via-text-input)

Out-of-scope discoveries logged during execution. NOT fixed in-place (scope
boundary: only issues directly caused by the current task's changes are auto-fixed).

## From plan 03-04 execution (2026-07-20)

### D1 — Pre-existing type error in `frontend/src/lib/agent.ts` (from plan 03-02)

- **File/line:** `frontend/src/lib/agent.ts:56`
- **Symptom:** `tsc -b` (the real build via `npm run build`) fails with
  `TS2367: This comparison appears to be unintentional because the types
  '"7d" | "30d" | "90d" | "all"' and '"custom"' have no overlap.`
- **Cause:** `applyAgentFilters` guards with `f.datePreset !== "custom"`, but
  `AppliedFilters.datePreset` (api/types.ts) is typed `"7d" | "30d" | "90d" |
  "all" | null` — it has no `"custom"` member, so the comparison is dead code.
- **Why not fixed here:** `agent.ts` is owned by plan 03-02, not 03-04. The
  plan 03-04 verify command `npx tsc --noEmit` uses the solution-style
  `tsconfig.json` (references only) and passes vacuously (exit 0), so it does
  not surface this. Only `tsc -b` / `npm run build` does. Out of scope per the
  executor scope boundary.
- **Suggested fix (for the owning plan / a follow-up):** drop the redundant
  `&& f.datePreset !== "custom"` clause (customRange is already handled by the
  separate `f.customRange` branch), OR widen `AppliedFilters.datePreset` to
  include `"custom"` if the backend ever emits it. Functionally the current code
  is correct — the dead comparison is always true — so this is a type-hygiene /
  build-green fix, not a behavior bug.
