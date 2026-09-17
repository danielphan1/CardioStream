---
phase: 15-unified-filter-surface-multi-select-checkboxes-pulse-categor
plan: 07
subsystem: frontend
tags: [filters, empty-state, guide, voice-commands, copy]
dependency-graph:
  requires: ["15-04"]
  provides: ["EmptyState/App/useStats wired to v3 multi-select filter shape", "Guide copy describing time-of-day and pulse-category filtering"]
  affects: ["frontend/src/components/EmptyState.tsx", "frontend/src/App.tsx", "frontend/src/hooks/useStats.ts", "frontend/src/lib/voiceCommands.ts", "frontend/src/components/GuideOverlay.tsx"]
tech-stack:
  added: []
  patterns: ["zero-or-all collapse via a function-local `selected()` helper (mirrors lib/agent.ts composeConfirmation's pattern)"]
key-files:
  created: []
  modified:
    - frontend/src/components/EmptyState.tsx
    - frontend/src/App.tsx
    - frontend/src/hooks/useStats.ts
    - frontend/src/lib/voiceCommands.ts
    - frontend/src/lib/voiceCommands.test.ts
    - frontend/src/components/GuideOverlay.tsx
decisions:
  - "EmptyState's template omits an amPmPrefix segment entirely (unlike 15-UI-SPEC.md §8's literal table, which still shows one) — the store dropped amPm with no v3 destination back in plan 15-04 ('resolved Option B'), so there is no amPm value left to prefix with; the plan's own locked action text confirms this by specifying the template without that segment."
metrics:
  duration: ~25min
  completed: 2026-09-17
---

# Phase 15 Plan 07: Wire EmptyState/App/useStats + retire Guide AM/PM copy Summary

Wired the read-only consumers of the v3 multi-select filter store (EmptyState's zero-result copy, App.tsx's call site, useStats.ts's `useResolvedFilters` bridge) and corrected the Guide's "What Can I Say" list and Filters help text to describe time-of-day and pulse-category filtering instead of the retired AM/PM binary.

## What Was Built

**Task 1 — EmptyState + App.tsx + useStats.ts (commit `50dd66e`)**

- `EmptyState.tsx`: `EmptyStateProps` changed from scalar `amPm`/`bpCategory` props to three selection maps (`bpCategory`, `pulseCategory`, `timeOfDay`, all `Record<Category, boolean>`). A function-local `selected()` helper (same shape as `lib/agent.ts composeConfirmation`'s helper) extracts the true keys from each map. Three zero-or-all-collapsing clause builders replace the old `amPmSegment`/`categoryClause`: `timeOfDayPrefix` (`"morning and evening "` style, lowercased), `bpCategoryClause` (`" in Stage 1 and Stage 2"` style), `pulseCategoryClause` (`" with Tachycardia pulse"` style) — each `""` when 0 or all keys in its group are selected. The rendered sentence template is now `There are no {timeOfDayPrefix}readings in {presetLabel}{bpCategoryClause}{pulseCategoryClause}.{newestSentence}`.
- `App.tsx`: `Dashboard()`'s filter-store subscriptions swap `amPm` for `timeOfDay` and add `pulseCategory`; the `<EmptyState>` call site passes `timeOfDay`/`bpCategory`/`pulseCategory` instead of `amPm`/`bpCategory`.
- `useStats.ts`: `useResolvedFilters()` drops its `amPm` subscription, adds `pulseCategory`/`timeOfDay` subscriptions, and passes the v3-shaped object (`datePreset`, `customRange`, `bpCategory`, `pulseCategory`, `timeOfDay`) into `lib/dates.ts`'s `resolveFilters` — which already accepted this exact shape (built by an earlier plan), so this was pure wiring with zero changes needed in `dates.ts`.

**Task 2 — Guide copy retiring AM/PM wording (commit `a5e515c`)**

- `voiceCommands.ts`: `{ id: "am-pm", label: "Filtering by AM or PM", ... }` renamed to `{ id: "time-of-day", label: "Filtering by time of day", ... }` (example phrase `"mornings only"` kept — it already routes to the `time_of_day` field per an earlier plan's prompt rewrite). New entry `{ id: "pulse-category", label: "Filtering by pulse category", example: "show tachycardia readings" }` inserted immediately after `bp-category`. `VOICE_COMMAND_CATEGORIES` now has 10 entries (was 9); `EXAMPLES` derives automatically (unchanged mechanism).
- `voiceCommands.test.ts`: length assertions (`9` → `10`) and the locked id-sequence array updated to `datasets, show-only, date-range, time-of-day, bp-category, pulse-category, chart-view, reset, speech, guide`.
- `GuideOverlay.tsx`'s `id="filters"` section: body paragraph rewritten from "...by morning (AM) or evening (PM), or by blood pressure category." to "...by time of day, by blood pressure category, or by pulse category." The "By click" example now says `Tap a filter checkbox (like "Last 30 Days" or "Morning")` — matching plan 15-05's exact checkbox label casing (`Morning`, not `Mornings`) rather than the old chip-era wording. The "By voice" line and the separate `id="charts"` section (a pre-existing, out-of-scope Phase-14-era inaccuracy) were left untouched, per the plan's explicit instruction.

## Verification

- `cd frontend && npx tsc --noEmit` — zero errors (after both tasks and combined)
- `cd frontend && npx vitest run src/lib/voiceCommands.test.ts` — 7/7 passed
- `grep -n "AM or PM\|morning (AM)" frontend/src/lib/voiceCommands.ts frontend/src/components/GuideOverlay.tsx` — zero matches
- Full frontend suite (`npx vitest run`): 484/502 passed, 18 failed — all 18 failures are in `src/lib/agent.ts`-adjacent files (`agent.test.ts`, `agent-parity.test.ts`), none of which this plan's `files_modified` list touches. Confirmed pre-existing: `store/filters.ts` already had no `amPm`/`setAmPm` before this plan started (removed by an earlier plan in a previous wave), and `agent.ts` — owned by the parallel-running sibling plan 15-06 — still calls `s.setAmPm(...)`. This plan neither introduced nor is responsible for fixing those failures; documented here rather than a separate `deferred-items.md` to avoid a cross-worktree write race with 15-06's own worktree touching the same phase directory concurrently.

## Deviations from Plan

None — plan executed exactly as written. The one thing worth flagging is not a deviation but a clarification: 15-UI-SPEC.md §8's literal empty-state template table still shows an `amPmPrefix` piece (`"AM "` / `"PM "`), left over from before `amPm` was fully retired from the store (plan 15-04, "resolved Option B — no v3 destination"). This plan's own action text explicitly specifies the template *without* that segment, so `EmptyState.tsx` was built to match the plan's locked instruction, not the now-superseded piece of the UI-SPEC table.

## Known Stubs

None.

## Threat Flags

None — this plan is entirely read-side wiring and copy changes to already-validated store/query state (per the plan's own threat model, T-15-11, disposition `accept`).

## Self-Check: PASSED

- FOUND: frontend/src/components/EmptyState.tsx
- FOUND: frontend/src/App.tsx
- FOUND: frontend/src/hooks/useStats.ts
- FOUND: frontend/src/lib/voiceCommands.ts
- FOUND: frontend/src/lib/voiceCommands.test.ts
- FOUND: frontend/src/components/GuideOverlay.tsx
- FOUND: commit 50dd66e
- FOUND: commit a5e515c
