---
phase: quick-260828-kbq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/GuideOverlay.tsx
  - frontend/src/components/GuideOverlay.test.tsx
autonomous: true

must_haves:
  truths:
    - "While the Guide overlay is open, scrolling the guide's own [role=\"region\"][aria-label=\"Site guide\"] container through its full scroll range never places any visible <h2>/<p> element inside the CommandBar+AgentStatusBanner band's on-screen rectangle -- confirmed live via getBoundingClientRect() overlap checks against the running dev server, not by reading source, at both a default desktop width (1440x900) and a narrow width (390x844)."
    - "The guide's outer scrollable container is structurally constrained to start below the reserved clearance (a CSS `top` offset on a `fixed inset-x-0 bottom-0` element), not merely padded internally on a full-viewport `fixed inset-0` element -- so scrolled content can never physically render behind the band regardless of scroll position, matching the required fix direction."
    - "Jump-nav (clicking a 'Jump to a section' link, e.g. #command-bar) still lands each section's heading visibly below the sticky Close bar with no residual clipping, using a re-derived scrollMarginTop that accounts only for the Close bar's own height now that the band is no longer inside this container's coordinate space."
    - "GuideOverlay's focus-management (close-button focus on open, guide-toggle-button focus restore on close), Escape-to-close, and the callers' `inert` handling on Header/main are byte-for-byte unchanged."
    - "Full frontend test suite, tsc -b, and oxlint pass with zero regressions against the captured baseline (30 files / 359 tests passing; tsc exit 0; oxlint exit 0 with exactly the 3 pre-existing unrelated warnings in records/{ProcedureFields,LabFields,IncidentFields}.tsx)."
  artifacts:
    - path: "frontend/src/components/GuideOverlay.tsx"
      provides: "Outer [role=\"region\"] element uses `fixed inset-x-0 bottom-0` plus an inline `top` style derived from `clearanceAbove ?? DEFAULT_CLEARANCE_ABOVE`, replacing `fixed inset-0` with a full-height internal paddingTop hack; scrollMarginTop re-derived to use only CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER; all stale comments describing the old full-viewport/padding mechanism corrected to describe the new top-offset mechanism"
      contains: "inset-x-0 bottom-0"
    - path: "frontend/src/components/GuideOverlay.test.tsx"
      provides: "Automated assertion locking the new structural contract: the region's inline top style reflects the clearanceAbove prop (or the DEFAULT_CLEARANCE_ABOVE fallback when omitted), and its className no longer contains inset-0"
      contains: "style.top"
  key_links:
    - from: "frontend/src/App.tsx (useClearanceHeight(headerRef, commandBarRef) -> guideClearance -> <GuideOverlay clearanceAbove={guideClearance} />)"
      to: "frontend/src/components/GuideOverlay.tsx (clearanceAbove prop)"
      via: "unchanged prop threading and unchanged measurement/caller logic in App.tsx -- GuideOverlay now consumes clearanceAbove as the scrollable container's own CSS `top` offset instead of as internal paddingTop input"
      pattern: "clearanceAbove"
---

<objective>
Fix the GuideOverlay P0 text-clipping bug from the 2026-08-28T20-51-49Z impeccable critique: while
the Guide is open on Dashboard, ordinary scrolling of the guide's own content passes paragraph/heading
text underneath the fixed CommandBar+AgentStatusBanner band (opaque, `z-[60]`, above the guide's
`z-50`). The band visually clips text mid-sentence as it scrolls past -- not just on initial load.

Root cause (already verified live via DOM/rect inspection during the critique, restated here as the
fix's starting point): GuideOverlay's outer container is `fixed inset-0 overflow-y-auto` -- it spans
the FULL viewport and is merely padded down via a computed `paddingTop`. That padding only solves the
initial-mount position and the `scrollIntoView` jump-target case (via `scrollMarginTop`); it does not
stop a user's ordinary continued scroll from moving already-passed content back into the same screen
rectangle the band occupies, because the guide's scrollable viewport spans that same full-viewport
space the band paints over.

The fix is structural, not another offset calculation: constrain the guide's own scrollable viewport
to start below the reserved clearance (`fixed inset-x-0 bottom-0` + inline `top: clearanceAbove`)
instead of padding a full-viewport container. This guarantees scrolled content can never physically
occupy the band's pixels, regardless of the band's own sticky/z-index mechanics.

Purpose: restore the Guide as a trustworthy help surface -- it is the one place that teaches Chris
(voice-primary, no reliable pointer) what he can say, and this P0 currently cuts its own explanatory
text off mid-sentence during ordinary use.
Output: `frontend/src/components/GuideOverlay.tsx` (structural fix + corrected comments),
`frontend/src/components/GuideOverlay.test.tsx` (new assertion locking the structural contract),
live-verified DOM/screenshot evidence (two viewport widths) that the clipping no longer reproduces.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.impeccable/critique/2026-08-28T20-51-49Z__frontend-src-app-tsx.md
@frontend/src/components/GuideOverlay.tsx
@frontend/src/components/GuideOverlay.test.tsx
@frontend/src/App.tsx

## Pre-flight regression baseline (captured at planning time, 2026-08-28)

- `cd frontend && npx vitest run` -> **30 test files passed, 359 tests passed**.
- `cd frontend && npx tsc -b` -> exit 0, zero errors.
- `cd frontend && npx oxlint` -> exit 0, exactly 3 pre-existing warnings, all
  `react-hooks(exhaustive-deps)` in `src/components/records/{ProcedureFields,LabFields,IncidentFields}.tsx`
  (unrelated to this fix, do not touch).
- Frontend dev server already running and reachable at `http://localhost:5173/` (200). Backend dev
  server already running and reachable at `http://localhost:8000/docs` (200). Re-verify both are still
  up before Task 2; if either is down, start it per CLAUDE.md's stack (`cd frontend && npm run dev`;
  `cd backend && uvicorn app.main:app --reload`, after `alembic upgrade head`/seed if the DB is empty).
- Playwright's Chromium binary is already cached at `~/Library/Caches/ms-playwright/chromium-1234` on
  this machine -- installing `playwright` with `npm install --no-save` in a scratch directory resolves
  instantly with no browser download, exactly as used successfully in the prior
  `260828-4nj-fix-bp-timeline-band-label-chip-z-order-` quick task. Never add `playwright` to
  `frontend/package.json`.
- `backend/.env`'s `SITE_PASSWORD` is the value to POST to `http://localhost:8000/auth` for a fresh
  Bearer token; `frontend/src/store/auth.ts` reads that token from `localStorage["hv-token"]` at store
  init -- `page.addInitScript` setting that key before navigation bypasses `LoginGate`.
- GuideOverlay is mounted from three call sites in `frontend/src/App.tsx`: `Dashboard` (clearanceAbove
  = header height + the CommandBar+AgentStatusBanner section's own height, via
  `useClearanceHeight(headerRef, commandBarRef)`), `UploadView` and `RecordsView` (clearanceAbove =
  header height only, via `useClearanceHeight(headerRef)` -- no sticky band exists on these two views,
  since the `sticky top-0 z-[60]` class only ever applies to Dashboard's CommandBar section). This
  plan's fix must keep working correctly on all three call sites -- do not special-case Dashboard.
- The sticky band itself is `frontend/src/App.tsx`'s `<section ref={commandBarRef} className={...
  guideOpen ? " sticky top-0 z-[60]" : ""}>`, wrapping `<CommandBar />` (own root:
  `<section aria-label="Command bar">`) and `<AgentStatusBanner />` (own root: `role="status"`) inside
  an inner `<div className="mx-auto max-w-[1280px] ...">`. For live-rect checks, treat the band's
  on-screen rectangle as the union of `section[aria-label="Command bar"]`'s rect and, if present,
  `[role="status"]`'s rect (AgentStatusBanner currently always renders in this dev environment because
  the Claude agent is billing-gated to $0 credits -- STATE.md blocker -- matching "the exact banner
  state the product is in right now" per the critique).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Constrain GuideOverlay's scrollable viewport to start below the reserved clearance</name>
  <files>frontend/src/components/GuideOverlay.tsx, frontend/src/components/GuideOverlay.test.tsx</files>
  <behavior>
    - Test A (structural contract, replaces reliance on the old paddingTop formula): render
      `<GuideOverlay clearanceAbove={300} />` with the guide open; assert the `[role="region"]`
      element's resolved inline `top` style is `"300px"`. Render `<GuideOverlay />` (no prop) with the
      guide open; assert the same element's inline `top` style is `"261px"` (the existing
      `DEFAULT_CLEARANCE_ABOVE` fallback, unchanged numeric value). Against the current (unfixed)
      source, which has no inline `top` style at all, both assertions FAIL -- confirming RED.
    - Test B (locks the structural class change): assert the region element's className does NOT
      match `/\binset-0\b/` and DOES contain both `inset-x-0` and `bottom-0`. Against current source
      this FAILS (className currently contains `inset-0`) -- confirming RED.
    - Add both as new `it(...)` cases inside the existing `describe("GuideOverlay", ...)` block,
      following the file's existing `container.querySelector('[role="region"]')` pattern (see the "has
      no dialog/modal semantics" test for the exact querying convention). Do not delete or weaken any
      pre-existing test -- all 7 existing tests must keep passing unmodified.
  </behavior>
  <action>
    First add the two test cases described above to GuideOverlay.test.tsx and run them to confirm RED
    against the current source (`cd frontend && npx vitest run src/components/GuideOverlay.test.tsx`).

    Then edit GuideOverlay.tsx with these four changes, per the critique's required fix direction:

    1. Outer `[role="region"]` div (currently `className="fixed inset-0 z-50 overflow-y-auto
    bg-[var(--color-foam)]"`, no inline style): change className to `"fixed inset-x-0 bottom-0 z-50
    overflow-y-auto bg-[var(--color-foam)]"` and add `style={{ top: clearanceAbove ??
    DEFAULT_CLEARANCE_ABOVE }}`. This is the structural fix -- the scrollable region itself now starts
    at screen position `clearanceAbove` and spans down to the viewport's bottom edge, so its own
    coordinate space can never contain the band's pixels (which live above that offset), regardless of
    scroll position. This works identically for Dashboard (clearanceAbove = header + band height) and
    for UploadView/RecordsView (clearanceAbove = header height only, no band present there).

    2. Content wrapper's `paddingTop` (currently `Math.max(0, (clearanceAbove ??
    DEFAULT_CLEARANCE_ABOVE) - CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER)`): this formula existed to push
    content down within a full-viewport container and is no longer correct now that the container
    itself starts below the clearance -- the sticky Close bar already reserves its own normal-flow
    height (CLOSE_BAR_HEIGHT) at the top of this now-shorter container, so content naturally starts
    right after it with no clearanceAbove-dependent math needed. Replace the paddingTop value with a
    small fixed breathing-room amount decoupled from `clearanceAbove` and `CLOSE_BAR_HEIGHT` --
    `CLEARANCE_BUFFER` (12px) is a reasonable choice reusing the existing constant for its buffer role,
    but use your judgment and document whatever value you land on. The formula must not reference
    `clearanceAbove` or `CLOSE_BAR_HEIGHT` together the way the old one did (that combination was the
    padding hack this fix replaces).

    3. `sectionScrollStyle`'s `scrollMarginTop` (currently `Math.max(0, (clearanceAbove ??
    DEFAULT_CLEARANCE_ABOVE) + CLEARANCE_BUFFER)`): re-derive so it accounts only for the sticky Close
    bar's own height plus a small buffer -- `Math.max(0, CLOSE_BAR_HEIGHT + CLEARANCE_BUFFER)` -- since
    the band itself is no longer inside this scrollable region's coordinate space at all once change 1
    is applied. This still ensures `scrollIntoView` (triggered by the "Jump to a section" nav links)
    positions each section's heading below the sticky Close bar, just without the now-irrelevant
    clearanceAbove term.

    4. Update every comment describing the old mechanism to describe the new one accurately: the
       `CLOSE_BAR_HEIGHT`/`DEFAULT_CLEARANCE_ABOVE`/`CLEARANCE_BUFFER` constant-block comment (lines
       ~32-40), the `clearanceAbove` prop's JSDoc (lines ~43-52, still correct that it's the caller's
       measured height, but its consumption changed from "padding input" to "container top offset"),
       the large paddingTop comment (lines ~133-152, currently explains why a fixed Tailwind class
       "can't do this correctly" via a now-obsolete argument about CommandBar being unable to reach
       `sticky top:0` while the guide is open -- replace with an explanation of the new structural
       mechanism and why it makes that whole class of problem impossible rather than merely offset),
       and the `sectionScrollStyle` comment (lines ~98-113, currently argues for using the FULL
       clearanceAbove rather than clearanceAbove-minus-CLOSE_BAR_HEIGHT -- replace with the new
       Close-bar-only rationale). Leave the file's top-of-file header comment (lines 1-9, about
       landmark-region/no-modal semantics) untouched -- unrelated to this bug.

    Do not touch: focus-management (the two `useEffect` blocks handling close-button focus and
    guide-toggle-button focus restore), the Escape-to-close `useEffect`, the `if (!open) return null`
    early return, any section content/copy, `SECTIONS`, or App.tsx's `inert`/measurement/caller logic.

    Re-run `cd frontend && npx vitest run src/components/GuideOverlay.test.tsx` and confirm all 9
    tests (7 existing + Test A + Test B) pass (GREEN).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/GuideOverlay.test.tsx</automated>
  </verify>
  <done>All 9 GuideOverlay.test.tsx tests pass. The region element's className contains `inset-x-0` and
  `bottom-0`, never `inset-0`. Its inline `top` style equals the `clearanceAbove` prop when provided,
  or `261px` (DEFAULT_CLEARANCE_ABOVE) when omitted. `scrollMarginTop` no longer references
  `clearanceAbove`. `paddingTop` no longer combines `clearanceAbove` and `CLOSE_BAR_HEIGHT`.
  Focus-management, Escape handling, and all section content are byte-for-byte unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Live-verify no clipping via DOM rect-overlap checks and screenshots at two viewport widths</name>
  <files>frontend/src/components/GuideOverlay.tsx</files>
  <action>
    Do not trust Task 1's code change by inspection alone -- this is the step that actually caught the
    original bug (a static screenshot would not have). Confirm empirically against the live, running
    app, at both a default desktop width and a narrow width.

    Confirm both dev servers are still up (`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`
    and `http://localhost:8000/docs`, both expect 200; restart per this plan's context notes if not).
    Read `SITE_PASSWORD` from `backend/.env`, POST it to `http://localhost:8000/auth`, extract the
    `token` field.

    In a scratch/temp directory outside `frontend/` (never touching `frontend/package.json`), run `npm
    install --no-save playwright@1.62.1` (resolves instantly from cache per this plan's context notes).

    Write a Node ESM script in that scratch directory that, for EACH of two viewport configs --
    `{ width: 1440, height: 900 }` (desktop) and `{ width: 390, height: 844 }` (narrow) -- does the
    following against a fresh page:

    1. `page.addInitScript` to set `localStorage["hv-token"]` to the token obtained above, before
       navigation (bypasses LoginGate, per `frontend/src/store/auth.ts`).
    2. Navigate to `http://localhost:5173/` (fall back to `5174` if that's the live one).
    3. Wait for `section[aria-label="Command bar"]` to appear (confirms Dashboard rendered).
    4. Click `#guide-toggle-button` (Header's Guide button) to open the guide.
    5. Wait for `[role="region"][aria-label="Site guide"]` to appear.
    6. Define `bandRect()` as the union of `section[aria-label="Command bar"]`'s
       `getBoundingClientRect()` and, if `[role="status"]` exists in the DOM, its
       `getBoundingClientRect()` too (min of the lefts/tops, max of the rights/bottoms).
    7. Get the guide region element; compute `maxScroll = region.scrollHeight - region.clientHeight`.
       Set `region.scrollTop` to 8 evenly-spaced values from 0 to `maxScroll` inclusive (fractions 0,
       1/7, 2/7, ... 1). After EACH scroll step, query every `h2`/`p` inside the region that is
       currently within the viewport (`rect.bottom > 0 && rect.top < viewportHeight`), get each one's
       `getBoundingClientRect()`, and check for axis-aligned-bounding-box overlap against `bandRect()`
       (overlap iff NOT (a.right <= b.left OR a.left >= b.right OR a.bottom <= b.top OR a.top >=
       b.bottom)). Record any overlaps found, tagged with the scroll step and the offending element's
       text content.
    8. Additionally reproduce the exact jump-nav repro from the critique: click the "Command Bar"
       jump-to-section link (`a[href="#command-bar"]`), then immediately scroll the region down by a
       further fixed increment (e.g. `region.scrollTop += 400`) without resetting -- this is the
       "already-passed content scrolls back under the band" scenario the bug description calls out.
       Re-run the same overlap check after this step.
    9. Take a screenshot of the guide region at one of the middle scroll steps, saved to a PNG in the
       scratch directory (name it per viewport width, e.g. `guide-scroll-1440.png` /
       `guide-scroll-390.png`).
    10. Log a structured pass/fail result per viewport (list of any overlaps found, or "no overlaps").

    Run the script with `node <script>.mjs`. Inspect the logged results for both viewports: there must
    be ZERO recorded overlaps across all scroll steps and the jump-nav-then-scroll repro, at both
    widths. If any overlap is found, the Task 1 fix is incomplete -- diagnose (likely candidates: the
    `top` style not applying, a stale `clearanceAbove` measurement, or the band rect union missing an
    element) and fix GuideOverlay.tsx, re-run Task 1's vitest command, then re-run this script from
    scratch. Do not stop and do not mark this task done until both viewports show zero overlaps.

    Read both captured screenshots (the Read tool renders PNGs visually) and visually confirm no text
    is cut off by or hidden behind the band in either.

    Once both the geometric (rect-overlap) check and the visual screenshot check pass at both widths,
    delete the scratch script and screenshots -- session-local verification artifacts, never committed.
  </action>
  <verify>
    <automated>MISSING — live-DOM/live-screenshot verification against a running browser has no pre-existing automated test harness in this repo; this task's own live inspection (structured rect-overlap log + screenshot read, at two viewport widths) IS the verification, performed directly against the running app as described in the action steps above.</automated>
  </verify>
  <done>The logged rect-overlap check reports zero overlaps between any visible guide-content
  h2/p element and the CommandBar+AgentStatusBanner band's rectangle, across all 8 general scroll
  steps AND the jump-nav-then-scroll repro, at both 1440x900 and 390x844. Both screenshots, visually
  reviewed, show no clipped/cut-off text. Whatever code change (if any) was needed beyond Task 1's
  initial implementation to achieve this is left in the committed GuideOverlay.tsx. No scratch
  verification files remain in the repo.</done>
</task>

<task type="auto">
  <name>Task 3: Final regression sweep and commit</name>
  <files>frontend/src/components/GuideOverlay.tsx, frontend/src/components/GuideOverlay.test.tsx</files>
  <action>
    Re-run the full verification set in case Task 2 iterated the implementation: `cd frontend && npx
    vitest run`, `npx tsc -b`, `npx oxlint`. Confirm against the baseline captured in this plan's
    context: vitest shows 30 test files passed and at least 361 tests passed (359 baseline + the 2
    new Task 1 assertions), zero failures; tsc -b exits 0 with zero errors; oxlint exits 0 with exactly
    the same 3 pre-existing unrelated warnings in `src/components/records/{ProcedureFields,LabFields,
    IncidentFields}.tsx` and zero new warnings, especially not in GuideOverlay.tsx.

    Confirm the working tree shows changes to exactly `frontend/src/components/GuideOverlay.tsx` and
    `frontend/src/components/GuideOverlay.test.tsx` (`git status --porcelain -- frontend`) -- the
    working tree may also show unrelated pre-existing untracked/modified files (`PRODUCT.md`, impeccable
    critique markdown, `frontend/.impeccable/`, a modified `frontend/.gitignore`); none of those belong
    in this commit.

    Stage and commit only the two GuideOverlay files: `git add frontend/src/components/GuideOverlay.tsx
    frontend/src/components/GuideOverlay.test.tsx`, then commit with message:
    `fix(frontend): constrain GuideOverlay scroll viewport below the sticky CommandBar band (impeccable P0)`
  </action>
  <verify>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer && git show --stat HEAD | grep -c "GuideOverlay"</automated>
    <automated>test "$(cd /Users/dp/Documents/GitHub/Health-Visualizer && git show --name-only --format='' HEAD | wc -l | tr -d ' ')" = "2"</automated>
  </verify>
  <done>A single new commit on the current branch contains exactly `frontend/src/components/
  GuideOverlay.tsx` and `frontend/src/components/GuideOverlay.test.tsx` -- no `PRODUCT.md`, no
  critique markdown, no `frontend/.impeccable/`, no `frontend/.gitignore` change, no scratch
  verification script or screenshot, no other unrelated file. vitest/tsc/oxlint all clean per the
  baseline comparison above.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None new | Pure client-side layout/positioning fix to an already-shipped, already-open overlay component. No new input parser, network call, external data source, or shipped dependency. Task 2's use of Playwright is a local, ephemeral dev-tooling step (installed `--no-save` in a scratch directory, never touching `frontend/package.json` or the commit), not a change to the deployed app's trust surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-kbq-01 | Tampering | GuideOverlay.tsx (new inline `style={{ top: ... }}`) | accept | `clearanceAbove` is a locally-computed `ResizeObserver` measurement of the app's own Header/CommandBar DOM elements (App.tsx), never user-controlled input; the fallback is a fixed literal constant (261). No new input path is introduced. |
| T-quick-kbq-02 | Denial of Service (rendering) | GuideOverlay.tsx (container height derived from `top`/`bottom-0`) | accept | If `clearanceAbove` measures larger than the viewport height (e.g. an extreme narrow/short viewport), the scrollable container's own height shrinks toward zero rather than breaking -- worst case is a very short scroll area, not a crash or unbounded growth; not user-triggerable beyond normal window resizing. |
| T-quick-kbq-SC | Tampering (supply chain) | Task 2's ephemeral `npm install --no-save playwright@1.62.1` in a scratch directory | accept | Same well-known, Microsoft-maintained package already used for evidence-gathering in this project's prior `260828-4nj` quick task and impeccable critique sessions; resolves from local cache, never added to `frontend/package.json`/`package-lock.json`, never committed. |
</threat_model>

<verification>
Run from the repo root after all three tasks complete:

`cd frontend && npx vitest run` (>=361 tests, zero failures) — `npx tsc -b` (exit 0) — `npx oxlint`
(exit 0, only the 3 pre-existing unrelated warnings) — `git show --stat HEAD` (exactly the two
GuideOverlay files).

Task 2's live-DOM/screenshot verification at both 1440x900 and 390x844 is the substantive proof this
plan exists to produce and is not deferrable to a human checkpoint or reducible to a static screenshot:
the executing agent must itself confirm, via browser automation against the running dev server, that
(a) zero rect overlaps occur between visible guide-content text and the CommandBar+AgentStatusBanner
band across a full scroll sweep and the jump-nav-then-scroll repro, at both widths, and (b) screenshots
at both widths visually confirm no clipped text.
</verification>

<success_criteria>
- [ ] GuideOverlay's outer `[role="region"]` uses `fixed inset-x-0 bottom-0` with an inline `top` style
      derived from `clearanceAbove ?? DEFAULT_CLEARANCE_ABOVE`, never `fixed inset-0`
- [ ] `paddingTop` no longer combines `clearanceAbove` and `CLOSE_BAR_HEIGHT`; `scrollMarginTop` no
      longer references `clearanceAbove` at all -- both re-derived for the new mechanism
- [ ] All stale comments describing the old full-viewport/padding mechanism are corrected to describe
      the new top-offset mechanism; `CLOSE_BAR_HEIGHT`/`DEFAULT_CLEARANCE_ABOVE`/`CLEARANCE_BUFFER`
      constants are kept and accurately documented for their (possibly repurposed) roles
- [ ] Focus-management, Escape-to-close, and `inert` handling are byte-for-byte unchanged
- [ ] GuideOverlay.test.tsx locks the new structural contract (top style + no-inset-0 className) via
      automated assertions; all pre-existing tests still pass unmodified
- [ ] Live DOM inspection (Task 2) confirms zero rect overlaps between visible guide text and the band
      across a full scroll sweep plus the jump-nav-then-scroll repro, at 1440x900 AND 390x844
- [ ] Live screenshots at both widths, visually reviewed, show no clipped/cut-off text
- [ ] Full test suite green (>=361 tests), zero regressions; tsc -b and oxlint clean against baseline
- [ ] Exactly two files (GuideOverlay.tsx, GuideOverlay.test.tsx) committed in one commit; no scratch
      verification artifacts left in the repo
</success_criteria>

<output>
Create `.planning/quick/260828-kbq-fix-guideoverlay-sticky-band-text-clippi/260828-kbq-SUMMARY.md` when done.
</output>
