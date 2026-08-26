---
phase: 11-full-site-guide-instructions-tab
plan: 05
subsystem: ui
tags: [react, typescript, accessibility, resize-observer, inert, focus-management]

# Dependency graph
requires:
  - phase: 11-full-site-guide-instructions-tab
    provides: "GuideOverlay.tsx (11-04) and the guide store (11-02) this plan wires into App.tsx"
provides:
  - "GuideOverlay mounted as an always-present sibling in Dashboard(), UploadView(), and RecordsView() — reachable from every authenticated view, CommandBar never unmounts (GUIDE-03)"
  - "CommandBar band promoted to sticky top-0 z-[60] only while the guide is open, rendering above the overlay"
  - "useClearanceHeight — a ResizeObserver-backed hook (App.tsx) that measures the real, live height of whatever sits above GuideOverlay (Header, + CommandBar on Dashboard) and passes it as clearanceAbove, replacing a guessed fixed padding"
  - "inert applied to Header and each view's main content while the guide is open, excluding invisible-behind-the-overlay controls from Tab order and the screen-reader tree"
affects: [12-visual-refresh]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-measured layout clearance over guessed fixed padding: when one always-visible element (CommandBar) must render above a full-screen overlay while everything else behind it is hidden, don't guess the obstruction's height in px — measure it with ResizeObserver and pass it down as a prop, because that height varies with viewport width (wrapping) and with async content (AgentStatusBanner)"
    - "inert for 'temporarily hidden behind an opaque overlay, not a real modal': GuideOverlay deliberately has no dialog role/focus-trap (CommandBar must stay reachable), so the correct exclusion mechanism for the *other*, now-invisible page content is the inert HTML attribute — not a focus trap, not aria-hidden alone"

key-files:
  created: []
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/GuideOverlay.tsx
    - frontend/src/tests/setup.ts

key-decisions:
  - "Task 2's mandatory manual verification (16-step walkthrough, `<verify><human-check>`) was performed by Claude via Claude-in-Chrome browser automation rather than the orchestrator asking the user to run it manually — every step was driven and inspected programmatically (DOM rects, aria-pressed, focus tracing, dark mode, ~500px mobile width), with real bugs found and fixed along the way, then the user gave final sign-off on the complete, re-verified result rather than the raw checklist"
  - "Two real bugs found during verification, both fixed with explicit user approval before proceeding (AskUserQuestion at each decision point), not silently patched: (1) the pt-24→pt-56 static clearance estimate from 11-04 overlapped the guide's own 'Site Guide' heading — root cause was that CommandBar's sticky positioning can never actually reach top:0 while the fixed, scroll-capturing overlay is open, so it stays pinned below the (hidden) site header, and that combined height varies continuously with viewport width; (2) Tab order from the guide's Close button walked into the underlying, now-invisible dashboard/Upload/Add-Record content (Filters, Charts, header buttons, etc.) with no visible focus indicator, before ever reaching CommandBar"
  - "Chose live ResizeObserver measurement (useClearanceHeight) over a larger fixed-padding guess for the clearance bug — a fixed value can't be correct at every viewport width simultaneously; a 12px CLEARANCE_BUFFER absorbs the brief settle-lag between a layout change (e.g. AgentStatusBanner's async /health-driven mount) and the observer's callback"
  - "Chose the inert HTML attribute over restructuring DOM order or adding a manual tabindex sweep for the Tab-order bug — it's the standards-based mechanism for exactly this case (content that's still mounted but currently not visible/interactive), removes affected content from both the tab sequence and the accessibility tree in one attribute, and needed no changes to Header.tsx or the page components themselves (just a wrapping div in App.tsx)"
  - "Left GUIDE-02/GUIDE-03 as Pending through Wave 1/2 despite 11-02 and 11-03 each marking their own claimed requirement complete independently — both are multi-plan requirements (11-05 also claims all four IDs) not truly satisfiable until the guide is actually wired into App.tsx and manually verified; the orchestrator reverted both at the wave-1 merge conflict and this plan is the one that closes them all out"

patterns-established:
  - "Manual/human-verify checkpoint plans (autonomous: false, gate=blocking) can be substantially de-risked by having Claude perform the browser-driven verification itself via Claude-in-Chrome before asking for human sign-off — the human still gives final approval, but arrives at a pre-verified, bug-fixed result with evidence (DOM measurements, screenshots, focus traces) rather than a blank checklist"

requirements-completed: [GUIDE-01, GUIDE-02, GUIDE-03, GUIDE-04]

# Metrics
duration: ~6h (includes iterative browser-driven verification, two bug-fix cycles with user approval, and re-verification)
completed: 2026-08-26
---

# Phase 11: Full Site Guide / Instructions Tab Summary

**Full-screen, text-only Site Guide wired into every authenticated view via a live-measured (ResizeObserver) clearance and `inert`-based focus exclusion — CommandBar never unmounts, and Tab order goes straight to it instead of wandering through hidden dashboard content.**

## Performance

- **Duration:** ~6h total across Task 1 (automated) + Task 2 (checkpoint: browser-driven manual verification, two bug-fix cycles, re-verification)
- **Started:** 2026-08-25T18:14:02-07:00 (Task 1 commit)
- **Completed:** 2026-08-26T00:38-07:00 (fix commit) / this SUMMARY
- **Tasks:** 2/2 (Task 1 automated wiring; Task 2 checkpoint — human-verify, completed with Claude-driven verification + fixes + final user approval)
- **Files modified:** 4 (App.tsx, GuideOverlay.tsx, tests/setup.ts across this plan's fix commit; App.tsx alone in Task 1's commit)

## Accomplishments
- `GuideOverlay` mounted as an always-present sibling in `Dashboard()`, `UploadView()`, and `RecordsView()` — the Guide button opens it from every authenticated view (GUIDE-01)
- CommandBar band promoted to `sticky top-0 z-[60]` only while the guide is open, verified to render above the overlay both visually and via computed z-index/position, at desktop and mobile widths
- Found and fixed a real overlap bug: the guide's own "Site Guide" heading was hidden behind the CommandBar band, both in the original 96px estimate and the first fixed-padding fix (224px) — root-caused to CommandBar's `sticky` positioning never truly reaching `top:0` while the overlay is open, and to that clearance varying with viewport width
- Replaced the guess with `useClearanceHeight`, a small ResizeObserver-backed hook that measures Header (+ CommandBar, where present) live and passes the real value into `GuideOverlay`'s `clearanceAbove` prop — verified correct at desktop width and at ~500px mobile width, on Dashboard, Upload, and Add Record
- Found and fixed a real keyboard-accessibility bug: Tab from the guide's Close button walked into invisible, hidden-behind-the-overlay dashboard/header controls (with no visible focus indicator) before reaching CommandBar — fixed with the `inert` HTML attribute on Header and each view's main content while the guide is open; verified Shift+Tab from Close now lands directly on CommandBar's Send button, and forward-Tab past the guide's content no longer enters hidden controls
- All 16 of the plan's manual verification steps re-confirmed passing, most via direct browser automation (DOM measurements, `aria-pressed`, focus tracing, dark-mode screenshot, mobile-width screenshot) rather than only visual inspection

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx — mount GuideOverlay + CommandBar band stacking promotion** - `671c396` (feat)
2. **Task 2: Manual verification — overlay stacking, CommandBar reachability, cross-view coverage** - checkpoint; findings fixed in `ffc58c8` (fix)

**Plan metadata:** this file (SUMMARY.md) + REQUIREMENTS.md GUIDE-01–04 completion, committed together after this file is written.

## Files Created/Modified
- `frontend/src/App.tsx` - Mounts `GuideOverlay` in all three view functions; `useClearanceHeight` hook (ResizeObserver over Header/CommandBar); `inert` wrappers around Header and main content while the guide is open
- `frontend/src/components/GuideOverlay.tsx` - `clearanceAbove` prop drives `paddingTop` via inline style instead of a fixed Tailwind class; `CLOSE_BAR_HEIGHT`/`DEFAULT_CLEARANCE_ABOVE`/`CLEARANCE_BUFFER` constants
- `frontend/src/tests/setup.ts` - `ResizeObserver` stub for jsdom (no-op observe/unobserve/disconnect)

## Decisions Made
See `key-decisions` in frontmatter above — summarized: (1) Claude performed the mandated manual verification itself via browser automation before asking for sign-off; (2) both bugs found were fixed with the standards-based mechanism (live measurement, `inert`) rather than a wider workaround; (3) GUIDE-02/03 completion was deliberately deferred past Waves 1–2 to this plan, the one that actually makes them end-to-end true.

## Deviations from Plan

### Auto-fixed Issues (all found during Task 2's own mandated verification, with explicit user approval before each fix)

**1. [Rule 1 - Bug found during verification] Guide content overlapped by CommandBar band**
- **Found during:** Task 2, step 6 of the manual verification (and again at mobile width after the first fix)
- **Issue:** `GuideOverlay`'s `pt-24` (11-04's estimate), then a first-pass `pt-56` fix, both undercounted the real obstruction — measured overlap: -101px (desktop, pt-24) and -120px to -186px (mobile widths, pt-56, header wraps to 2-3 rows and grows taller)
- **Fix:** Live ResizeObserver measurement (`useClearanceHeight` in App.tsx) passed to `GuideOverlay` as `clearanceAbove`, replacing the guessed constant; small `CLEARANCE_BUFFER` (12px) for settle-lag
- **Files modified:** frontend/src/App.tsx, frontend/src/components/GuideOverlay.tsx
- **Verification:** Re-measured clearance ≥0 at desktop width and at ~500px mobile width, on Dashboard, Upload, and Add Record views; screenshots confirm no visual overlap
- **Committed in:** `ffc58c8`

**2. [Rule 1 - Bug found during verification] Tab order walked into invisible hidden content**
- **Found during:** Task 2, step 12 (Tab order check)
- **Issue:** Tab from the guide's Close button was not trapped (correct) but did not reach CommandBar next as the plan expected — it entered the underlying Header and main dashboard/Upload/Add-Record content, all hidden behind the guide's opaque overlay, with no visible focus indicator
- **Fix:** `inert` HTML attribute on Header and each view's main content, active only while the guide is open
- **Files modified:** frontend/src/App.tsx
- **Verification:** Shift+Tab from Close now lands on CommandBar's Send button directly; forward-Tab past the guide's last ToC link no longer enters hidden content (falls through to `document.body`, i.e. correctly excluded)
- **Committed in:** `ffc58c8`

**3. [Rule 3 - Blocking] ResizeObserver undefined in jsdom test environment**
- **Found during:** Post-fix `npm test` run (2 pre-existing tests threw `ReferenceError: ResizeObserver is not defined`)
- **Issue:** jsdom doesn't implement `ResizeObserver`; `useClearanceHeight`'s effect crashed on mount in any test that renders `App`/`Dashboard`
- **Fix:** No-op `ResizeObserver` stub added to `src/tests/setup.ts`
- **Files modified:** frontend/src/tests/setup.ts
- **Verification:** All 323 frontend tests pass (was 321/323 immediately after the App.tsx change, before the stub)
- **Committed in:** `ffc58c8`

---

**Total deviations:** 3 auto-fixed (2 bugs found during the plan's own mandated verification, 1 blocking test-environment fix)
**Impact on plan:** All three fixes were required for GUIDE-03/GUIDE-04 to actually be true, not scope creep — the plan's own Task 2 exists specifically to catch exactly this class of issue (CSS stacking/Tab order jsdom cannot assert), and it did. Touches `components/GuideOverlay.tsx` (owned by Plan 11-04) and a new file (`tests/setup.ts`) beyond the plan's declared `files_modified: [App.tsx]` — both necessary to actually fix what verification found.

## Issues Encountered
- Live browser-automation measurement of ResizeObserver timing was itself noisy in the Claude-in-Chrome automated tab context (callbacks appeared to stall until forced animation frames ran) — traced conclusively to the automation tab's rendering throttling, not a defect in the fix: an isolated test `ResizeObserver` on the same element fired correctly once `requestAnimationFrame` cycles were forced, and the applied padding independently reached the mathematically correct value. Real, normally-rendering focused browser tabs don't have this throttling. Resolved by testing with realistic (non-rapid-fire) timing and confirming via final screenshots/measurements at both desktop and mobile widths.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 (Full Site Guide / Instructions Tab) is functionally complete: GUIDE-01 through GUIDE-04 all verified end-to-end, including at mobile viewport width and in dark mode.
- Phase 12 (Visual Refresh) can build on a Guide feature whose stacking/accessibility contract is now solid — no known open issues to carry forward.

---
*Phase: 11-full-site-guide-instructions-tab*
*Completed: 2026-08-26*
