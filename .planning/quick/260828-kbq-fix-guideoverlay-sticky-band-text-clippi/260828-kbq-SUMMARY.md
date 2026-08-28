---
phase: quick-260828-kbq
plan: 01
subsystem: ui
tags: [react, guide-overlay, accessibility, layout, playwright]

requires: []
provides:
  - "GuideOverlay's scrollable region is structurally constrained (fixed inset-x-0 bottom-0 + inline top offset) so its own coordinate space can never contain the CommandBar+AgentStatusBanner band's pixels, at any scroll position"
affects: [guide-overlay, dashboard-header]

tech-stack:
  added: []
  patterns:
    - "Reserved-clearance overlays should constrain their own scrollable container's CSS top/bottom edges (fixed inset-x-0 bottom-0 + inline top: clearanceAbove) rather than padding a full-viewport container — the latter only fixes initial position, not ongoing scroll safety"

key-files:
  created: []
  modified:
    - frontend/src/components/GuideOverlay.tsx
    - frontend/src/components/GuideOverlay.test.tsx

key-decisions:
  - "Replaced GuideOverlay's fixed inset-0 + paddingTop hack with fixed inset-x-0 bottom-0 + inline top: clearanceAbove — makes the band-clipping bug geometrically impossible rather than another offset calculation"
  - "scrollMarginTop re-derived to depend only on CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER (the band is no longer in this container's coordinate space at all, so it's not part of what scrollIntoView needs to clear)"
  - "Verified live via Playwright rect-overlap checks against an isolated worktree-local dev stack (own frontend dev server + own backend/SQLite instance), not the shared main-checkout dev servers, since worktree file edits are invisible to processes running from the main checkout"

requirements-completed: []

duration: 15min
completed: 2026-08-28
---

# Quick Task 260828-kbq: Fix GuideOverlay sticky-band text clipping Summary

**Constrained GuideOverlay's scrollable viewport to a `fixed inset-x-0 bottom-0` + inline `top: clearanceAbove` box (replacing `fixed inset-0` + internal `paddingTop`), making it geometrically impossible for scrolled guide text to render behind the CommandBar+AgentStatusBanner band.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-28T21:45:01Z
- **Completed:** 2026-08-28T22:00:14Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Fixed the P0 text-clipping bug from the 2026-08-28T20-51-49Z impeccable critique: GuideOverlay's outer scrollable region now starts (`top`) at `clearanceAbove ?? DEFAULT_CLEARANCE_ABOVE` instead of spanning the full viewport and being padded — the region's own `overflow-y-auto` box can no longer physically contain the band's pixels at any scroll position.
- Re-derived `paddingTop` (now a small fixed `CLEARANCE_BUFFER`, decoupled from `clearanceAbove`/`CLOSE_BAR_HEIGHT`) and `scrollMarginTop` (now `CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER` only) for the new mechanism, and corrected every stale comment describing the old full-viewport/padding approach.
- Added two automated tests locking the new structural contract (inline `top` style, no `inset-0` className) — all 10 GuideOverlay.test.tsx tests pass (8 pre-existing + 2 new).
- Live-verified via Playwright against a real running dev server (both the worktree's own isolated frontend+backend stack): zero rect overlaps between visible guide `h2`/`p` text and the CommandBar+AgentStatusBanner band across an 8-step full scroll sweep AND the jump-nav-then-scroll repro, at both 1440x900 and 390x844, with the AgentStatusBanner actually rendered (matching this dev environment's real billing-gated-agent state). Screenshots at both widths visually confirm no clipped text.

## Task Commits

Each task's underlying code change was committed atomically once (per this plan's own Task 3 instructions, which override the generic per-task-commit default with an explicit single-commit protocol):

1. **Task 1: Constrain GuideOverlay's scrollable viewport to start below the reserved clearance** — implemented with a full RED→GREEN TDD cycle (verified failing tests against the unfixed source, then verified all 10 tests passing against the fix), but per Task 3's explicit instructions the actual git commit was deferred to the plan's single final commit (not committed separately).
2. **Task 2: Live-verify no clipping via DOM rect-overlap checks and screenshots at two viewport widths** — no code commit (live verification only); the process uncovered and fixed two bugs in the verification *script itself* (not GuideOverlay.tsx — see Deviations), and confirmed zero overlaps once corrected.
3. **Task 3: Final regression sweep and commit** — `a32c78c` (fix): both `GuideOverlay.tsx` and `GuideOverlay.test.tsx` in one commit, exactly as the plan's own verify steps require.

**Plan metadata:** deferred to the orchestrator's later docs-commit step (per this executor's constraints — SUMMARY.md/STATE.md are not committed here).

_Note: This plan's Task 3 explicitly defines its own single-commit protocol (with automated verify checks requiring exactly one commit containing exactly two files) — this took precedence over the generic per-task-commit default._

## Files Created/Modified

- `frontend/src/components/GuideOverlay.tsx` — Outer `[role="region"]` changed from `fixed inset-0` (+ computed `paddingTop`) to `fixed inset-x-0 bottom-0` with inline `style={{ top: clearanceAbove ?? DEFAULT_CLEARANCE_ABOVE }}`; content wrapper's `paddingTop` simplified to a fixed `CLEARANCE_BUFFER`; `sectionScrollStyle`'s `scrollMarginTop` re-derived to `CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER` only; all comments describing the old mechanism rewritten to describe the new one.
- `frontend/src/components/GuideOverlay.test.tsx` — Two new tests: inline `top` style reflects `clearanceAbove` (or the `261px` default), and className uses `inset-x-0`/`bottom-0` and never `inset-0`.

## Decisions Made

- Followed the plan's required fix direction exactly (structural container constraint, not another offset calculation) — no deviation from the specified `fixed inset-x-0 bottom-0` + inline `top` approach.
- For live verification, stood up an isolated dev stack from within the worktree (frontend `vite --port 5175`, backend `uvicorn` on port `8001` against a fresh local SQLite DB, both torn down after) rather than reusing the shared main-checkout dev servers on 5173/8000 — worktree file edits are invisible to processes running from the main checkout's working directory, and this plan's own constraints explicitly called for isolated servers when needed.
- Backend `.env`/`.env.development.local` used during verification were created directly (both already git-ignored: `backend/.env` via `.gitignore:15`, `frontend/.env.development.local` via `frontend/.gitignore`'s `*.local` pattern) and deleted immediately after verification completed — no trace left in the repo or working tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Verification script's "in viewport" check didn't account for the guide region's own overflow-clip boundary**
- **Found during:** Task 2
- **Issue:** The plan's literal action text specifies checking element visibility via `rect.bottom > 0 && rect.top < viewportHeight` (full browser viewport). Before this fix, the guide region spanned the full viewport (`fixed inset-0`), so that check was equivalent to the region's own clip boundary. After the fix, the region only spans `[clearanceAbove, viewportHeight]` — a plain full-viewport check let elements that were actually clipped/invisible above the region's own top edge (their raw, unclipped `getBoundingClientRect()` still reports a position above `clearanceAbove`) register as false-positive overlaps against the band.
- **Fix:** Added an additional visibility check intersecting each candidate element's rect with the guide region's own `getBoundingClientRect()` bounds (not just the browser viewport) before testing for band overlap — matching what the fix's own invariant guarantees (nothing can be visually painted outside the region's own clipped box).
- **Files modified:** Scratch verification script only (`/private/tmp/.../scratchpad/kbq-verify/verify.mjs`, deleted after use per the plan's cleanup step) — no `GuideOverlay.tsx`/`.test.tsx` changes.
- **Verification:** Re-ran the corrected script; overlap count dropped from 8/7 (1440/390) to 6/6, isolating the remaining false positives to the next issue below.

**2. [Rule 3 - Blocking issue] Verification script compared each element's full unclipped rect instead of its visible (clipped) portion**
- **Found during:** Task 2
- **Issue:** A text line straddling the region's own top clip boundary mid-scroll has a `getBoundingClientRect()` spanning both above and below that boundary; comparing the FULL rect against the band's rect produced a false-positive overlap even though only the below-boundary sliver is actually painted (and that sliver never touches the band).
- **Fix:** Clipped each candidate element's rect to the intersection of the region's own box, the browser viewport, and the element's own bounds before testing for band overlap — comparing only the genuinely visible portion, matching what a human eye or a screenshot would actually show.
- **Files modified:** Scratch verification script only (deleted after use) — no `GuideOverlay.tsx`/`.test.tsx` changes.
- **Verification:** Re-ran the corrected script; overlap count dropped to 0/0 at both viewports across all 8 scroll steps and the jump-nav-then-scroll repro.

**3. [Rule 3 - Blocking issue] Verification script wrote the auth token to localStorage as a JSON string, not a raw string**
- **Found during:** Task 2 (after standing up the isolated worktree-local backend, to reproduce the plan's explicit "AgentStatusBanner rendered" condition)
- **Issue:** `frontend/src/store/auth.ts` reads `localStorage.getItem("hv-token")` as a raw string (no `JSON.parse`); the script wrote it via `JSON.stringify(token)`, adding literal quote characters that made the token invalid, causing 401s on `/readings`/`/stats/summary` and blocking the whole verification run (LoginGate never bypassed).
- **Fix:** Changed the script's `addInitScript` to `localStorage.setItem("hv-token", token)` (no `JSON.stringify`).
- **Files modified:** Scratch verification script only (deleted after use) — no `GuideOverlay.tsx`/`.test.tsx` changes.
- **Verification:** Re-ran; LoginGate bypassed successfully, dashboard rendered, verification proceeded to completion with zero overlaps.

---

**Total deviations:** 3 auto-fixed (all Rule 3, all confined to the ephemeral scratch verification script — zero changes to the shipped `GuideOverlay.tsx`/`.test.tsx` beyond Task 1's originally-planned fix).
**Impact on plan:** None on the shipped fix. All three issues were bugs in the throwaway Playwright test harness used to verify the fix, not bugs in the fix itself — Task 1's implementation required no changes beyond what the plan specified once the verification script itself was corrected.

## Issues Encountered

- The shared main-checkout dev servers (port 5173 frontend, port 8000 backend) were running from `/Users/dp/Documents/GitHub/Health-Visualizer` (not this worktree), so they could not see this worktree's edits. Resolved by starting an isolated frontend dev server (port 5175) and backend (port 8001, fresh SQLite DB, `.env` scoped to CORS-allow port 5175) from within the worktree, both torn down after Task 2 completed.
- The isolated backend's CORS policy (`CORS_ORIGINS=["http://localhost:5175"]`) initially blocked the browser's `/health` fetch until the isolated backend was actually reachable at the matching origin — resolved by pointing the worktree frontend's `VITE_API_URL` at the isolated backend via a git-ignored `.env.development.local` override.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The GuideOverlay P0 clipping bug is fully resolved and live-verified at both a default desktop width and a narrow mobile width, including the exact jump-nav-then-scroll repro from the original critique.
- No follow-up work identified for this specific bug. The guide's structural fix (`fixed inset-x-0 bottom-0` + inline `top` offset) is a general-purpose pattern that could be reused for any future overlay needing to reserve space below a fixed/sticky obstruction.

---
*Quick task: 260828-kbq*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: `frontend/src/components/GuideOverlay.tsx`
- FOUND: `frontend/src/components/GuideOverlay.test.tsx`
- FOUND: commit `a32c78c` (fix(frontend): constrain GuideOverlay scroll viewport below the sticky CommandBar band)
