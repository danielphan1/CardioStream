---
phase: 06-agent-availability-liveness-detection
plan: 02
subsystem: ui
tags: [react, zustand, tanstack-query, tailwind, accessibility, lucide-react]

# Dependency graph
requires:
  - phase: 06-agent-availability-liveness-detection (Plan 01, same wave, independent — no direct code dependency)
    provides: "backend AgentReply.kind==\"unavailable\" and /health agent_reachable wire contract (this plan implements the frontend mirror independently, from 06-CONTEXT.md/06-RESEARCH.md's locked field names, not by reading Plan 01's code)"
provides:
  - "frontend/src/api/types.ts: AgentReply.kind extended with \"unavailable\"; new HealthStatus type"
  - "frontend/src/api/client.ts: getHealth() typed wrapper for GET /health"
  - "frontend/src/lib/copy.ts: AGENT_UNAVAILABLE_BANNER_COPY, the single-sourced banner string"
  - "frontend/src/store/agentStatus.ts: one shared `unavailable` boolean store, written by reportOutcome (D-07) and syncFromHealth (D-05/D-08), last-write-wins"
  - "frontend/src/hooks/useHealth.ts: TanStack Query poll of /health (refetchInterval 60s, page-load fetch, hidden-tab pause via FocusManager defaults)"
  - "frontend/src/components/AgentStatusBanner.tsx: the one new visible surface this phase adds, mounted in Dashboard() only"
affects: ["06-03 (Plan 03's reactive D-07 wiring into CommandBar/useVoiceCommand consumes useAgentStatus.reportOutcome built here)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared zustand store field written by two independent entry points (poll + reactive), last-write-wins, instead of two stores OR'd together in the consuming component"
    - "TanStack Query refetchInterval + default FocusManager/refetchOnWindowFocus for pause-while-hidden/resume-on-focus polling, no hand-rolled visibilitychange listener"
    - "Fixed, single-sourced UI copy constants in lib/copy.ts, never inlined or paraphrased"

key-files:
  created:
    - frontend/src/lib/copy.ts
    - frontend/src/store/agentStatus.ts
    - frontend/src/store/agentStatus.test.ts
    - frontend/src/hooks/useHealth.ts
    - frontend/src/hooks/useHealth.test.ts
    - frontend/src/components/AgentStatusBanner.tsx
    - frontend/src/components/AgentStatusBanner.test.tsx
  modified:
    - frontend/src/api/types.ts
    - frontend/src/api/client.ts
    - frontend/src/App.tsx

key-decisions:
  - "Cold-boot agent_reachable=null treated as optimistic default (no banner) per RESEARCH Pitfall 4's recommendation — matches Plan 01's backend implementation of the same default"
  - "AgentStatusBanner takes no props and has no voice/text variant (D-10) — single shared surface"
  - "syncFromHealth is invoked from exactly one place (AgentStatusBanner's useEffect on health.data) — not duplicated anywhere else"

patterns-established:
  - "Sibling zustand store per small UI-status concern (store/agentStatus.ts alongside store/theme.ts, store/filters.ts, store/view.ts)"
  - "TanStack Query hook mirrors useReadings.ts's exact shape for any new periodic server-state poll"

requirements-completed: [LIVE-01, LIVE-02, LIVE-03]

# Metrics
duration: ~15min
completed: 2026-08-20
---

# Phase 6 Plan 02: Agent Liveness Wire Contract, Store, Poll & Banner Summary

**Frontend `unavailable` state built end to end: extended AgentReply/HealthStatus wire types, a last-write-wins zustand store fed by both a reactive outcome reporter and a TanStack Query `/health` poll, and the one new visible `AgentStatusBanner` surface — mounted in `Dashboard()`, calm, non-dismissible, fail-safe on fetch errors.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-20T18:16:00Z (approx)
- **Completed:** 2026-08-20T18:20:00Z
- **Tasks:** 2
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments
- `AgentReply.kind` and a new `HealthStatus` type extend the wire contract byte-for-byte with backend Plan 06-01's schema (field names confirmed against `06-01-PLAN.md`'s frontmatter, not by reading merged backend code — this plan and Plan 01 are independent wave-1 plans)
- `store/agentStatus.ts`: one `unavailable` boolean, two writers (`reportOutcome`, `syncFromHealth`), last-write-wins — avoids the OR-of-two-stores staleness bug RESEARCH Pattern 4 identified
- `useHealth()` polls `/health` every 60s with zero hand-rolled visibility code — TanStack Query's installed `FocusManager` + default `refetchOnWindowFocus`/`staleTime: 0` already satisfy D-08's pause/resume contract
- `AgentStatusBanner` renders the UI-SPEC-exact calm card (role="status", `BotOff` icon, fixed copy, no dismiss/retry control) or `null`, mounted once in `Dashboard()` only, fail-safe on `/health` fetch errors
- 20 new tests (10 store, 3 hook, 7 component), full suite 191/191 green, no regressions

## Task Commits

Each task was executed as a full TDD RED → GREEN cycle, committed atomically:

1. **Task 1: Wire contract + agentStatus store** —
   - `08c74b0` (test): failing test for agentStatus store (RED stub)
   - `aaf03cc` (feat): agentStatus store + wire contract implementation (GREEN)
2. **Task 2: useHealth poll + AgentStatusBanner + Dashboard mount** —
   - `dfd8057` (test): failing tests for useHealth + AgentStatusBanner (RED stubs)
   - `4c9994b` (feat): useHealth + AgentStatusBanner implementation + App.tsx mount (GREEN)

**Plan metadata:** committed by the orchestrator after this SUMMARY (worktree mode — STATE.md/ROADMAP.md updates deferred to post-merge).

_Note: both tasks used the full RED→GREEN TDD cycle per their `tdd="true"` attribute — RED commits contain a genuinely failing test against an intentionally incomplete stub, verified with `vitest run` before the GREEN commit replaced the stub with the real implementation._

## Files Created/Modified
- `frontend/src/api/types.ts` — `AgentReply.kind` gains `"unavailable"`; new `HealthStatus` type
- `frontend/src/api/client.ts` — `getHealth()` typed wrapper (mirrors `getStatsSummary`)
- `frontend/src/lib/copy.ts` — new file, `AGENT_UNAVAILABLE_BANNER_COPY` (the third independently-worded "can't reach the assistant" string in this codebase)
- `frontend/src/store/agentStatus.ts` — new zustand store, one `unavailable` field, `reportOutcome`/`syncFromHealth` writers
- `frontend/src/store/agentStatus.test.ts` — 10 tests covering every `<behavior>` bullet
- `frontend/src/hooks/useHealth.ts` — new TanStack Query hook, `refetchInterval: 60_000`, `staleTime: 0`
- `frontend/src/hooks/useHealth.test.ts` — 3 tests (page-load fetch, body passthrough, fail-safe isError)
- `frontend/src/components/AgentStatusBanner.tsx` — new component, UI-SPEC-exact markup
- `frontend/src/components/AgentStatusBanner.test.tsx` — 7 tests (reachable/null-boot render-nothing, unavailable/error render-card, no-button D-11)
- `frontend/src/App.tsx` — `<AgentStatusBanner />` mounted in `Dashboard()`, immediately after `<CommandBar>`, inside the same wrapper `div`

## Decisions Made
- Confirmed the optimistic cold-boot default (`agent_reachable: null` → no banner) as RESEARCH Pitfall 4 recommended, consistent with what Plan 01's backend plan describes
- Kept `syncFromHealth` invocation to exactly one call site (`AgentStatusBanner`'s `useEffect`) so there is a single, auditable entry point from the poll into the shared store
- Did not touch `CommandBar.tsx`/`useVoiceCommand.ts` — the reactive D-07 wiring (calling `reportOutcome` from a real `/agent` reply) is explicitly Plan 03's scope per this plan's own objective ("ahead of Plan 03's reactive D-07 wiring")

## Deviations from Plan

None — plan executed exactly as written. One environment-only adjustment (not a code deviation): this worktree had no `node_modules` installed (correctly gitignored); a symlink to the main checkout's `frontend/node_modules` was created locally to run `vitest`/`tsc` in this session. This is a local dev-environment convenience, not a tracked file — nothing was added to git, and it has no bearing on the merged code.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. This is a pure frontend change consuming an existing ungated `/health` route.

## Manual Verification Pending

Task 2's `<human-check>` (visual/calm-judgment verification — icon, weight, single ~200ms fade-in, no clinical/red color) was not performed in this autonomous execution wave. Per `config.json`'s `human_verify_mode: "end-of-phase"`, this is deferred to the phase's end-of-phase human verification pass, not blocking this plan's completion. All automated acceptance criteria and behavior tests pass.

## Next Phase Readiness
- `useAgentStatus.reportOutcome` is exported and ready for Plan 03 to wire into `CommandBar.tsx`'s `onSuccess` switch and `useVoiceCommand.ts`'s `handleSuccess` switch (the reactive D-07 half of this phase)
- The wire contract (`AgentReply.kind: "unavailable"`, `HealthStatus.agent_reachable`) is defined on the frontend independently of backend Plan 01 — once both wave-1 plans merge, the contract must line up field-for-field (already cross-checked against `06-01-PLAN.md`'s frontmatter `key_links`/`must_haves` during this plan's execution, not assumed)
- No blockers

---
*Phase: 06-agent-availability-liveness-detection*
*Completed: 2026-08-20*
