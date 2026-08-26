---
phase: 11-full-site-guide-instructions-tab
plan: 03
subsystem: ui
tags: [react, typescript, vitest, voice-commands, command-bar]

# Dependency graph
requires:
  - phase: 03-agent-via-text-input
    provides: CommandBar.tsx's original inline EXAMPLES array (extraction source)
provides:
  - "frontend/src/lib/voiceCommands.ts — the single shared source of voice-command copy (VOICE_COMMAND_CATEGORIES, SIMILAR_PHRASINGS_NOTE, EXAMPLES) for both CommandBar's placeholder rotation and Plan 11-04's GuideOverlay 'What Can I Say' section"
affects: [11-04-full-site-guide-instructions-tab, GuideOverlay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-not-duplicated data: EXAMPLES = VOICE_COMMAND_CATEGORIES.map((c) => c.example) so a flat consumer (CommandBar) and a grouped consumer (future GuideOverlay) can never drift, referentially enforced and tested"

key-files:
  created:
    - frontend/src/lib/voiceCommands.ts
    - frontend/src/lib/voiceCommands.test.ts
  modified:
    - frontend/src/components/CommandBar.tsx

key-decisions:
  - "voiceCommands.ts locks the 8-category id/label order exactly as specified in 11-UI-SPEC.md's Copywriting Contract (charts, date-range, am-pm, bp-category, overlay, reset, speech, guide); example phrase wording within each category was Claude's Discretion per 11-CONTEXT.md"
  - "EXAMPLES is a derived array (.map), not an independently authored duplicate, enforced by a referential-equality test — this is the mechanism that makes GUIDE-02's 'one shared source, never a second divergent list' actually true going forward"

patterns-established:
  - "Shared category-reference module pattern: a typed array of {id, label, example} objects as the single source of truth, with any flat/derived view computed via .map rather than hand-authored"

requirements-completed: [GUIDE-02]

# Metrics
duration: 5min
completed: 2026-08-26
---

# Phase 11 Plan 03: Shared Voice Command Reference Module Summary

**Extracted CommandBar's inline 4-item EXAMPLES array into a new `frontend/src/lib/voiceCommands.ts` module exposing an 8-category `VOICE_COMMAND_CATEGORIES` reference (locked order per 11-UI-SPEC.md) plus a derived `EXAMPLES` list and a fixed `SIMILAR_PHRASINGS_NOTE`, then rewired `CommandBar.tsx` to import from it with zero behavior change.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-26T00:53:00Z (approx, worktree setup + context read)
- **Completed:** 2026-08-26T00:56:28Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Created `frontend/src/lib/voiceCommands.ts` exporting `VoiceCommandCategory`, `VOICE_COMMAND_CATEGORIES` (8 categories, exact locked order), `SIMILAR_PHRASINGS_NOTE`, and a referentially-derived `EXAMPLES` list — the single shared source GUIDE-02 requires
- Covered the module with `voiceCommands.test.ts` (7 tests: category count, exact id sequence, non-empty labels/examples, EXAMPLES length + referential derivation, exact locked note string)
- Rewired `CommandBar.tsx` to import `EXAMPLES` from the new module instead of authoring it inline — placeholder rotation mechanics, array length, and rendered format are byte-for-byte unchanged (verified by the existing 21-test `CommandBar.test.tsx` suite passing unmodified)

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED → GREEN cycle per its `tdd="true"` attribute):

1. **Task 1: lib/voiceCommands.ts + voiceCommands.test.ts**
   - `c79ee45` — `test(11-03): add failing test for voiceCommands.ts shared module` (RED)
   - `bd3ffe1` — `feat(11-03): add shared voiceCommands.ts module` (GREEN)
2. **Task 2: CommandBar.tsx — replace inline EXAMPLES with the shared import** - `8d02489` (refactor)

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the full RED → GREEN cycle:
- RED gate: `c79ee45` (`test(11-03): ...`) — confirmed failing (`Failed to resolve import "./voiceCommands"`) before any implementation existed
- GREEN gate: `bd3ffe1` (`feat(11-03): ...`) — 7/7 tests passing after implementation
- No REFACTOR commit — the initial implementation was already clean; no cleanup pass was needed

Gate sequence verified in `git log`: test → feat → (Task 2's own refactor commit for the CommandBar rewire).

## Files Created/Modified
- `frontend/src/lib/voiceCommands.ts` - New shared module: 8-category voice-command reference, fixed similar-phrasings note, derived EXAMPLES list
- `frontend/src/lib/voiceCommands.test.ts` - 7 tests covering category count/order, label/example non-emptiness, EXAMPLES referential derivation, and the exact locked note string
- `frontend/src/components/CommandBar.tsx` - Removed the inline `const EXAMPLES = [...]` block; added `import { EXAMPLES } from "../lib/voiceCommands";` (alphabetically ordered among the existing `../lib/*` imports)

## Decisions Made
- Followed 11-PATTERNS.md's pre-resolved category list and phrase wording verbatim (e.g. `"show stage 2 readings"` for bp-category, `"show incidents"` for overlay) since the pattern map had already worked out concrete, locked-compliant example text — no need to re-derive from scratch.
- No REFACTOR commit for Task 1: the GREEN implementation was already minimal and clean (a straightforward data module), so a separate refactor pass would have been a no-op.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed frontend npm dependencies from the existing lockfile**
- **Found during:** Task 1, first verification run
- **Issue:** The worktree had no `frontend/node_modules` — `npx vitest`/`npx tsc` failed immediately with `ERR_MODULE_NOT_FOUND` for `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` before any test could even attempt to run.
- **Fix:** Ran `npm ci` in `frontend/` against the existing, unmodified `package-lock.json` — this restores dependencies already declared and pinned in the repo, not a new/unverified package install, so it is a legitimate Rule 3 blocking-issue fix (not the package-manager-install exclusion, which applies to installing packages not already in the lockfile).
- **Files modified:** None tracked (node_modules is gitignored; no package.json/package-lock.json changes).
- **Verification:** `npx vitest run` and `npx tsc --noEmit` both ran successfully afterward.
- **Committed in:** N/A (no file changes to commit — node_modules is gitignored, confirmed via `git status --short` showing no untracked node_modules entries)

---

**Total deviations:** 1 auto-fixed (1 blocking — dependency install)
**Impact on plan:** No scope creep; this was a one-time environment-setup step required to run any verification command in this fresh worktree, with zero effect on the plan's actual deliverables.

## Issues Encountered
None beyond the dependency-install deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `frontend/src/lib/voiceCommands.ts` is ready for Plan 11-04's `GuideOverlay` "What Can I Say" section to import `VOICE_COMMAND_CATEGORIES` and `SIMILAR_PHRASINGS_NOTE` directly — no further extraction or refactoring needed on this module.
- `CommandBar.tsx`'s placeholder rotation is verified unchanged in behavior (21/21 existing tests green), so Plan 11-04 can proceed without any CommandBar regression risk from this plan.
- No blockers for downstream plans in this phase.

---
*Phase: 11-full-site-guide-instructions-tab*
*Completed: 2026-08-26*
