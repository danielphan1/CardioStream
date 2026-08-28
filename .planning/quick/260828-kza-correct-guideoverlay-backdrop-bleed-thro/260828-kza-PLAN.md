---
phase: quick-260828-kza
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
    - "While the Guide overlay is open, sampling document.elementFromPoint across the FULL vertical range from y=0 to the guide region's own top offset -- at multiple x positions, at both an unstuck-band window scroll position (windowScrollY=0) and a stuck-band window scroll position (windowScrollY scrolled down), and at multiple internal guide scrollTop values including 0 -- never resolves to the Dashboard's root wrapper, Header, FilterBar, or any dashboard-specific content (chip labels, \"All data / All times / All categories\", etc.) -- only ever to the new full-viewport backdrop element or the CommandBar+AgentStatusBanner band itself. Confirmed live via elementFromPoint (what's actually painted), not via getBoundingClientRect() overlap math, which is unreliable for scrolled-out-of-view/clipped children."
    - "The prior fix's own guarantee still holds, re-verified via elementFromPoint (not rect math): at every sampled guide-internal scroll position, the point at the center of every visible guide h2/p element resolves back to that same element (or a descendant), never to something inside the CommandBar+AgentStatusBanner band -- the original text-clipping bug has not been reintroduced by this change."
    - "GuideOverlay's outer structure is now two elements: a plain, non-scrolling, non-interactive, always-`fixed inset-0` backdrop (`aria-hidden=\"true\"`, no role) providing unconditional full-viewport opaque coverage, and the existing scrollable `[role=\"region\"][aria-label=\"Site guide\"]` element (unchanged `fixed inset-x-0 bottom-0` + inline `top: clearanceAbove` positioning, Close bar, and section content) -- the region's own box is no longer relied on as the sole source of backdrop opacity."
    - "Screenshots at both a default desktop width (1440x900) and a narrow width (390x844), at more than one scroll state, visually confirm: no dashboard content visible anywhere in the guide overlay, and no clipped guide text under the band."
    - "GuideOverlay's focus-management, Escape-to-close, `inert` handling in App.tsx, the `clearanceAbove` measurement (useClearanceHeight), and the CommandBar band's sticky/z-index logic in App.tsx are byte-for-byte unchanged."
    - "Full frontend test suite, tsc -b, and oxlint pass with zero regressions against the captured baseline (30 files / 361 tests passing pre-fix, expected >=363 after this fix's 2 new tests; tsc exit 0; oxlint exit 0 with exactly the 3 pre-existing unrelated warnings in records/{ProcedureFields,LabFields,IncidentFields}.tsx)."
  artifacts:
    - path: "frontend/src/components/GuideOverlay.tsx"
      provides: "A new `div[aria-hidden=\"true\"]` backdrop element (`fixed inset-0`, opaque `bg-[var(--color-foam)]`, z-index below the CommandBar band's z-[60]) rendered as a sibling before the existing `[role=\"region\"][aria-label=\"Site guide\"]` scrollable container -- restores unconditional full-viewport coverage the prior fix lost, without reverting the prior fix's own `fixed inset-x-0 bottom-0` clipping-safety structure"
      contains: "aria-hidden=\"true\""
    - path: "frontend/src/components/GuideOverlay.test.tsx"
      provides: "Automated assertions locking the two-element structural contract: a `div[aria-hidden=\"true\"]` backdrop exists when open, is a distinct DOM node from `[role=\"region\"]`, has no `role` attribute, and its className is full-viewport (`inset-0`) rather than the region's `inset-x-0 bottom-0`"
      contains: "aria-hidden"
  key_links:
    - from: "frontend/src/components/GuideOverlay.tsx (new backdrop div, fixed inset-0)"
      to: "the previously-unowned gap between the CommandBar band's on-screen rectangle and the guide region's own `top: clearanceAbove` offset"
      via: "unconditional full-viewport coverage independent of clearanceAbove's accuracy or the band's current stuck/unstuck state"
      pattern: "inset-0"
    - from: "frontend/src/components/GuideOverlay.tsx (backdrop z-index)"
      to: "frontend/src/App.tsx's CommandBar band (`sticky top-0 z-[60]`, untouched)"
      via: "backdrop stays at a lower z-index (z-40) than both the band (z-60) and the scrollable region (z-50), so the band always paints on top of the backdrop wherever it currently sits"
      pattern: "z-\\[60\\]"
---

<objective>
Correct the regression introduced by quick task 260828-kbq (commit a32c78c): that fix genuinely
resolved the GuideOverlay P0 text-clipping bug (confirmed, do not re-touch) but, in shrinking the
overlay's outer `[role="region"]` element from `fixed inset-0` to `fixed inset-x-0 bottom-0` +
inline `top: clearanceAbove`, it also shrank that element's own opaque background out of the region
above `top` -- leaving a real, unowned gap where neither the CommandBar+AgentStatusBanner band nor
the guide's own background paints anything. Live DOM inspection confirmed the real Dashboard's root
wrapper (and visible FilterBar/BP-category chip content) bleeds through that gap.

Root cause: the prior fix conflated two responsibilities into one element's box -- (1) an opaque
backdrop that must cover the ENTIRE viewport unconditionally (covering Header and anything else in
normal document flow, regardless of the band's stuck/unstuck state or clearanceAbove's accuracy),
and (2) a scrollable content region that must start below the band so guide text can never clip
under it. This plan splits those into two separate elements: a plain always-`fixed inset-0` backdrop
(new), plus the existing scrollable region (unchanged from the prior fix).

Purpose: restore the Guide as a fully opaque, trustworthy help surface -- it must never let live
dashboard content show through underneath it -- while keeping the prior fix's clipping-safety intact.
Output: `frontend/src/components/GuideOverlay.tsx` (two-element split + corrected comments),
`frontend/src/components/GuideOverlay.test.tsx` (new structural assertions), live elementFromPoint
evidence (two viewport widths, multiple scroll states) that neither bug reproduces.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@frontend/src/components/GuideOverlay.tsx
@frontend/src/components/GuideOverlay.test.tsx
@frontend/src/App.tsx
@.planning/quick/260828-kbq-fix-guideoverlay-sticky-band-text-clippi/260828-kbq-PLAN.md
@.planning/quick/260828-kbq-fix-guideoverlay-sticky-band-text-clippi/260828-kbq-SUMMARY.md

## Why getBoundingClientRect() overlap checks are not trustworthy for this bug

A scrolled-out-of-view or clipped child can report `getBoundingClientRect()` coordinates that
appear to overlap something even though it is not actually painted there (this is exactly the false
positive kbq's own verification script hit and had to work around -- see its SUMMARY's Deviations
#1/#2). `document.elementFromPoint(x, y)` reports what is ACTUALLY painted at a screen coordinate and
is the primary check for both the new bleed-through verification and the re-verification of the
original clipping fix in this plan. Rect math may be used only as a coarse pre-filter to shortlist
candidate elements, never as the pass/fail signal itself.

## Pre-flight regression baseline (captured at planning time, 2026-08-28)

- `cd frontend && npx vitest run` -> **30 test files passed, 361 tests passed** (this already includes
  kbq's 2 new tests -- 359 pre-kbq baseline + 2).
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
  instantly with no browser download. Never add `playwright` to `frontend/package.json`.
- `backend/.env`'s `SITE_PASSWORD` is the value to POST to `http://localhost:8000/auth` for a fresh
  Bearer token; `frontend/src/store/auth.ts` reads that token from `localStorage["hv-token"]` **as a
  raw string** at store init -- do NOT `JSON.stringify()` it when setting it via `page.addInitScript`
  (kbq's own verification script hit exactly this bug -- see its SUMMARY's Deviation #3 -- and it
  silently breaks auth with 401s, not an obvious signal).
- GuideOverlay is mounted from three call sites in `frontend/src/App.tsx`: `Dashboard` (clearanceAbove
  = header height + the CommandBar+AgentStatusBanner section's own height, via
  `useClearanceHeight(headerRef, commandBarRef)`), `UploadView` and `RecordsView` (clearanceAbove =
  header height only -- no sticky band exists on these two views, since the `sticky top-0 z-[60]`
  class only ever applies to Dashboard's CommandBar section). Live verification (Task 2) only needs to
  exercise Dashboard, since that is the only call site where the band exists at all.
- The sticky band itself is `frontend/src/App.tsx`'s `<section ref={commandBarRef} className={...
  guideOpen ? " sticky top-0 z-[60]" : ""}>` -- note the `sticky`/`z-[60]` classes are applied
  UNCONDITIONALLY whenever `guideOpen` is true (not conditioned on scroll amount), wrapping
  `<CommandBar />` and `<AgentStatusBanner />` inside an inner `<div className="mx-auto
  max-w-[1280px] ...">`. For live checks, treat the band's on-screen rectangle as the union of
  `section[aria-label="Command bar"]`'s rect and, if present, `[role="status"]`'s rect
  (AgentStatusBanner currently always renders in this dev environment because the Claude agent is
  billing-gated to $0 credits -- STATE.md blocker).
- Because the band only becomes visually "stuck" (pinned to viewport y=0) once the underlying page's
  own `window.scrollY` has scrolled past the band's static in-flow offset (roughly Header's height),
  and the reported bug's screenshot showed the band ALREADY stuck with dashboard content bleeding
  through underneath, Task 2's verification must exercise BOTH window-scroll states -- `window.scrollY
  = 0` (band in its normal, unstuck, in-flow position) and a scrolled-down state (band stuck at
  y=0) -- not just the guide's own internal `scrollTop`. `window.scrollTo()` is not blocked by the
  `inert` attribute on Header/main (inert only affects focus/hit-testing of that subtree, not
  programmatic document scroll).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Split GuideOverlay into an always-full-viewport backdrop plus the existing scrollable region</name>
  <files>frontend/src/components/GuideOverlay.tsx, frontend/src/components/GuideOverlay.test.tsx</files>
  <behavior>
    - Test C (backdrop exists and is full-viewport): with the guide open, query
      `container.querySelector('div[aria-hidden="true"]')` (scoped to `div` specifically, not the
      Close button's `<X aria-hidden="true">` svg icon, which would otherwise be a false match).
      Assert it is not null, its className matches `/\bfixed\b/` and `/\binset-0\b/`, and it does
      NOT match `/\binset-x-0\b/` or `/\bbottom-0\b/` (distinguishing it from the region). Against the
      current (unfixed) source, which has no such element, this FAILS -- confirming RED.
    - Test D (backdrop is decorative and distinct from the region): assert the same backdrop
      element's `getAttribute("role")` is `null` (it is not a landmark, unlike the region), and that
      it is a different DOM node than `container.querySelector('[role="region"]')` (`expect(backdrop
      === region).toBe(false)` or equivalent `.not.toBe()`). Against current source this FAILS
      (querySelector returns null for the backdrop selector) -- confirming RED.
    - Add both as new `it(...)` cases inside the existing `describe("GuideOverlay", ...)` block. Do
      not delete or weaken any of the 9 existing tests -- all must keep passing unmodified (the
      existing "constrains the region to fixed inset-x-0 bottom-0, never inset-0" test already scopes
      its query to `[role="region"]` specifically and is unaffected by adding a second, differently
      classed/queried element).
  </behavior>
  <action>
    First add Test C and Test D to GuideOverlay.test.tsx and run them to confirm RED against the
    current source (`cd frontend && npx vitest run src/components/GuideOverlay.test.tsx`).

    Then edit GuideOverlay.tsx with these changes:

    1. Change the component's `return` to wrap its output in a Fragment (`<>...</>`) so it can render
       two top-level siblings instead of one. As the FIRST child (before the existing `[role="region"]`
       div), add a new plain backdrop element: `<div aria-hidden="true" className="fixed inset-0 z-40
       bg-[var(--color-foam)]" />`. No `role`, no children, no interactive content -- this is a
       decorative, non-scrolling, always-full-viewport opaque backdrop. It guarantees coverage of the
       ENTIRE viewport unconditionally -- Header, the CommandBar band's un-stuck in-flow position, and
       any gap between the band's stuck rectangle and the region's `top` offset -- regardless of
       `clearanceAbove`'s accuracy or the band's current stuck/unstuck state. `z-40` keeps it below
       the CommandBar band's `z-[60]` (App.tsx, untouched) and below the region's own `z-50`, though
       the two never spatially overlap where it matters (the band always renders above the backdrop
       wherever it currently sits, since App.tsx applies `z-[60]` to the band unconditionally whenever
       `guideOpen` is true).
    2. Leave the existing `[role="region"]` element and everything inside it (className, inline `top`
       style, Close bar, all section content, `sectionScrollStyle`) completely unchanged from the
       prior fix -- it no longer needs to be the sole source of backdrop opacity (the new backdrop
       behind it now guarantees that), but there is no reason to remove its own `bg-[var(--color-foam)]`
       background either. Do not modify its className or style.
    3. Update the large structural comment currently above/around the outer `[role="region"]` div
       (the one explaining why `fixed inset-x-0 bottom-0` + `top: clearanceAbove` makes clipping
       impossible): add a preceding note that a separate `fixed inset-0` backdrop element (added in
       step 1, above this region in the JSX) now provides unconditional full-viewport opaque coverage
       independently of this region's own `top` offset -- so this region's box no longer needs to
       (and, per the regression this plan corrects, must not be relied on to) serve as the app's only
       opaque backdrop. Keep the rest of that comment's explanation of why the region itself is safe
       against scroll-based text clipping -- that reasoning is still accurate and untouched by this
       change.
    4. Do not touch: focus-management (the two `useEffect` blocks), the Escape-to-close `useEffect`,
       the `if (!open) return null` early return, `SECTIONS`, any section content/copy,
       `clearanceAbove`/`DEFAULT_CLEARANCE_ABOVE`/`CLOSE_BAR_HEIGHT`/`CLEARANCE_BUFFER`, or
       `sectionScrollStyle`. Do not touch `App.tsx`.

    Re-run `cd frontend && npx vitest run src/components/GuideOverlay.test.tsx` and confirm all 11
    tests (9 existing + Test C + Test D) pass (GREEN).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/GuideOverlay.test.tsx</automated>
  </verify>
  <done>All 11 GuideOverlay.test.tsx tests pass. A `div[aria-hidden="true"]` backdrop with `fixed
  inset-0` className (no `inset-x-0`/`bottom-0`) renders as a sibling before `[role="region"]`
  whenever the guide is open. The `[role="region"]` element's own className/style/content are
  byte-for-byte unchanged from the prior (kbq) fix. Focus-management, Escape handling, and App.tsx are
  untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Live-verify no bleed-through and no reintroduced clipping via elementFromPoint, at two viewport widths and multiple scroll states</name>
  <files>frontend/src/components/GuideOverlay.tsx</files>
  <action>
    Do not trust Task 1's code change by inspection alone -- this class of bug was NOT caught by
    kbq's own verification, which only checked band/text overlap, never full-viewport coverage.
    Confirm empirically against the live, running app.

    Confirm both dev servers are still up (`curl -s -o /dev/null -w "%{http_code}"
    http://localhost:5173/` and `http://localhost:8000/docs`, both expect 200; restart per this
    plan's context notes if not). Read `SITE_PASSWORD` from `backend/.env`, POST it to
    `http://localhost:8000/auth`, extract the `token` field.

    In a scratch/temp directory outside `frontend/` (never touching `frontend/package.json`), run
    `npm install --no-save playwright@1.62.1` (resolves instantly from cache per this plan's context
    notes).

    Write a Node ESM script in that scratch directory that, for EACH of two viewport configs --
    `{ width: 1440, height: 900 }` (desktop) and `{ width: 390, height: 844 }` (narrow) -- does the
    following against a fresh page:

    1. `page.addInitScript` to set `localStorage["hv-token"]` to the RAW token string obtained above
       (`localStorage.setItem("hv-token", token)`, no `JSON.stringify`), before navigation (bypasses
       LoginGate).
    2. Navigate to `http://localhost:5173/` (fall back to `5174` if that's the live one). Wait for
       `section[aria-label="Command bar"]` to appear (confirms Dashboard rendered).
    3. Click `#guide-toggle-button` (Header's Guide button) to open the guide. Wait for
       `[role="region"][aria-label="Site guide"]` to appear.
    4. Confirm the new backdrop exists: `document.querySelector('div[aria-hidden="true"].fixed')` (or
       equivalent). If it is missing, fail this run immediately and diagnose Task 1's change before
       continuing -- there is no point running the sweep against a build missing the fix.
    5. Get the guide region element; compute `regionTop = region.getBoundingClientRect().top`.
    6. Define `bandRect()` as the union of `section[aria-label="Command bar"]`'s
       `getBoundingClientRect()` and, if `[role="status"]` exists in the DOM, its
       `getBoundingClientRect()` too (min of the lefts/tops, max of the rights/bottoms).
    7. For EACH of two window-scroll states -- `window.scrollTo(0, 0)` (band unstuck, its natural
       in-flow position) and `window.scrollTo(0, 800)` (band stuck, pinned at viewport y=0 -- this is
       the exact condition the reported bug was observed under) -- AND for EACH of two guide-internal
       scroll states (`region.scrollTop = 0`, and `region.scrollTop = Math.floor((region.scrollHeight
       - region.clientHeight) / 2)`) -- run BOTH checks below (8 combinations total per viewport, 16
       across both viewports):

       a. BLEED-THROUGH CHECK (this plan's core new assertion): sample `document.elementFromPoint(x,
          y)` at `x` in {15%, 50%, 85%} of the viewport width, and `y` stepped every ~20px from 0 up
          to (not including) `regionTop`. At EVERY sampled point, the resolved element must satisfy
          `el.closest('div[aria-hidden="true"].fixed') !== null` (it's the backdrop) OR
          `el.closest('section[aria-label="Command bar"]') !== null` OR `el.closest('[role="status"]')
          !== null` (it's part of the band). Record any point that satisfies none of these as a FAIL,
          tagged with viewport/window-scroll/guide-scroll/x/y and a short snippet of the resolved
          element's outerHTML.

       b. CLIPPING RE-CHECK (repeats kbq's own verification intent, this time via elementFromPoint
          rather than rect-overlap math, per this plan's constraint that rect math alone is
          unreliable): query every `h2`/`p` element inside the guide region. For each whose OWN
          `getBoundingClientRect()` vertical center falls within `[regionTop, viewportHeight]` (a
          coarse pre-filter only, not the pass/fail signal), compute that center point and call
          `document.elementFromPoint(centerX, centerY)`. The resolved element must BE that same
          h2/p element (or a descendant of it, e.g. inline text/strong). Record any mismatch as a
          FAIL, tagged the same way.

    8. Take one screenshot per (viewport, window-scroll-state) combination at guide-internal
       scrollTop=0 (4 screenshots total: `guide-bleed-1440-scrollY0.png`,
       `guide-bleed-1440-scrollY800.png`, `guide-bleed-390-scrollY0.png`,
       `guide-bleed-390-scrollY800.png`).
    9. Log a structured pass/fail summary (list of any FAILs found, or "no failures") per viewport.

    Run the script with `node <script>.mjs`. Inspect the logged results: there must be ZERO recorded
    bleed-through FAILs and ZERO clipping-recheck FAILs across all 8 combinations at both viewports
    (16 total). If any FAIL is found, the Task 1 fix is incomplete -- diagnose (likely candidates: the
    backdrop's `z-40` losing to something, the backdrop not actually rendering, or the band-rect union
    missing an element) and fix GuideOverlay.tsx, re-run Task 1's vitest command, then re-run this
    script from scratch. Do not stop and do not mark this task done until both checks show zero
    failures at both widths.

    Read all 4 captured screenshots (the Read tool renders PNGs visually) and visually confirm: no
    dashboard content (FilterBar, BP-category chip labels like "Hypotension"/"Normal", "All data · All
    times · All categories", etc.) is visible anywhere in the guide overlay's area, and no guide text
    is clipped/cut off by the band.

    Once both the elementFromPoint checks and the visual screenshot checks pass at both widths, delete
    the scratch script and screenshots -- session-local verification artifacts, never committed.
  </action>
  <verify>
    <automated>MISSING — live-DOM/live-screenshot verification against a running browser has no pre-existing automated test harness in this repo; this task's own live inspection (structured elementFromPoint FAIL log + screenshot read, at two viewport widths and four window/guide-scroll combinations each) IS the verification, performed directly against the running app as described in the action steps above.</automated>
  </verify>
  <done>The logged elementFromPoint sweep reports zero bleed-through FAILs (every sampled point from
  y=0 to the region's own top offset resolves to the backdrop or the band, never dashboard content)
  and zero clipping-recheck FAILs (every visible guide h2/p's center point resolves back to that same
  element, never the band), across all 8 window-scroll x guide-scroll combinations at both 1440x900
  and 390x844. All 4 screenshots, visually reviewed, show no dashboard bleed-through and no clipped
  guide text. Whatever code change (if any) was needed beyond Task 1's initial implementation to
  achieve this is left in the committed GuideOverlay.tsx. No scratch verification files remain in the
  repo.</done>
</task>

<task type="auto">
  <name>Task 3: Final regression sweep and commit</name>
  <files>frontend/src/components/GuideOverlay.tsx, frontend/src/components/GuideOverlay.test.tsx</files>
  <action>
    Re-run the full verification set in case Task 2 iterated the implementation: `cd frontend && npx
    vitest run`, `npx tsc -b`, `npx oxlint`. Confirm against the baseline captured in this plan's
    context: vitest shows 30 test files passed and at least 363 tests passed (361 baseline + the 2 new
    Task 1 assertions), zero failures; tsc -b exits 0 with zero errors; oxlint exits 0 with exactly
    the same 3 pre-existing unrelated warnings in `src/components/records/{ProcedureFields,LabFields,
    IncidentFields}.tsx` and zero new warnings, especially not in GuideOverlay.tsx.

    Confirm the working tree shows changes to exactly `frontend/src/components/GuideOverlay.tsx` and
    `frontend/src/components/GuideOverlay.test.tsx` (`git status --porcelain -- frontend`) -- the
    working tree may also show unrelated pre-existing untracked files (e.g. a stray
    `.planning/quick/260828-kbq-.../260828-kbq-SUMMARY.md`); those do not belong in this commit and
    are outside `frontend/` in any case.

    Stage and commit only the two GuideOverlay files: `git add frontend/src/components/GuideOverlay.tsx
    frontend/src/components/GuideOverlay.test.tsx`, then commit with message:
    `fix(frontend): split GuideOverlay backdrop from scroll region to stop dashboard bleed-through (impeccable P0)`
  </action>
  <verify>
    <automated>cd /Users/dp/Documents/GitHub/Health-Visualizer && git show --stat HEAD | grep -c "GuideOverlay"</automated>
    <automated>test "$(cd /Users/dp/Documents/GitHub/Health-Visualizer && git show --name-only --format='' HEAD | wc -l | tr -d ' ')" = "2"</automated>
  </verify>
  <done>A single new commit on the current branch contains exactly `frontend/src/components/
  GuideOverlay.tsx` and `frontend/src/components/GuideOverlay.test.tsx` -- no other file. vitest/tsc/
  oxlint all clean per the baseline comparison above.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None new | Pure client-side layout/positioning fix (adding a decorative backdrop element) to an already-shipped, already-open overlay component. No new input parser, network call, external data source, or shipped dependency. Task 2's use of Playwright is a local, ephemeral dev-tooling step (installed `--no-save` in a scratch directory, never touching `frontend/package.json` or the commit), not a change to the deployed app's trust surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-kza-01 | Information Disclosure | GuideOverlay.tsx (missing full-viewport backdrop -- the regression this plan fixes) | mitigate | The new `div[aria-hidden="true"]` `fixed inset-0` backdrop, unconditional on `clearanceAbove`'s accuracy or the band's stuck state, is the direct mitigation: it guarantees Chris's own health-dashboard content (chip labels, filter state) can never visually bleed through behind the help overlay, verified live via elementFromPoint sweep in Task 2. |
| T-quick-kza-02 | Tampering | GuideOverlay.tsx (new static `className`, no new props/inputs) | accept | The backdrop's className is a fixed literal string with no dynamic/user-controlled input; no new attack surface introduced. |
| T-quick-kza-SC | Tampering (supply chain) | Task 2's ephemeral `npm install --no-save playwright@1.62.1` in a scratch directory | accept | Same well-known, Microsoft-maintained package already used for evidence-gathering in this project's prior `260828-kbq`/`260828-4nj` quick tasks; resolves from local cache, never added to `frontend/package.json`/`package-lock.json`, never committed. |
</threat_model>

<verification>
Run from the repo root after all three tasks complete:

`cd frontend && npx vitest run` (>=363 tests, zero failures) — `npx tsc -b` (exit 0) — `npx oxlint`
(exit 0, only the 3 pre-existing unrelated warnings) — `git show --stat HEAD` (exactly the two
GuideOverlay files).

Task 2's live elementFromPoint/screenshot verification at both 1440x900 and 390x844, across both an
unstuck-band and a stuck-band window-scroll state, is the substantive proof this plan exists to
produce and is not deferrable to a human checkpoint or reducible to a static screenshot or rect-math
check: the executing agent must itself confirm, via browser automation against the running dev
server, that (a) zero bleed-through occurs anywhere in the full vertical range from y=0 to the guide
region's own top offset, at both widths and window-scroll states, and (b) the original clipping fix
still holds (visible guide text always resolves to itself under elementFromPoint, never to the band).
</verification>

<success_criteria>
- [ ] GuideOverlay renders two elements when open: a plain `fixed inset-0` `aria-hidden="true"`
      backdrop (new) and the existing `fixed inset-x-0 bottom-0` scrollable `[role="region"]`
      (unchanged from the prior fix)
- [ ] The backdrop's z-index stays below the CommandBar band's `z-[60]` (App.tsx, untouched)
- [ ] All stale single-element comments are corrected to describe the two-element split; the
      region's own comment explaining clipping-safety is otherwise undisturbed
- [ ] Focus-management, Escape-to-close, `inert` handling, and `clearanceAbove`/`useClearanceHeight`
      are byte-for-byte unchanged
- [ ] GuideOverlay.test.tsx locks the new structural contract (backdrop exists, full-viewport,
      no role, distinct from the region) via automated assertions; all 9 pre-existing tests still pass
      unmodified
- [ ] Live elementFromPoint sweep (Task 2) confirms zero bleed-through across the full y=0-to-region-top
      range, at both 1440x900 and 390x844, at both an unstuck-band and a stuck-band window-scroll state
- [ ] Live elementFromPoint re-check (Task 2) confirms the original clipping fix still holds -- guide
      text never resolves to the band -- at the same combinations
- [ ] Live screenshots at both widths and both window-scroll states, visually reviewed, show no
      dashboard bleed-through and no clipped guide text
- [ ] Full test suite green (>=363 tests), zero regressions; tsc -b and oxlint clean against baseline
- [ ] Exactly two files (GuideOverlay.tsx, GuideOverlay.test.tsx) committed in one commit; no scratch
      verification artifacts left in the repo
</success_criteria>

<output>
Create `.planning/quick/260828-kza-correct-guideoverlay-backdrop-bleed-thro/260828-kza-SUMMARY.md` when done.
</output>
