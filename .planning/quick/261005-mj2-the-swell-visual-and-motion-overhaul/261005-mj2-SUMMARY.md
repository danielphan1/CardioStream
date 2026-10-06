---
quick_id: 261005-mj2
slug: the-swell-visual-and-motion-overhaul
status: complete
date: 2026-10-05
commits:
  - 9af497a docs(261005-mj2) plan the Swell visual and motion overhaul
  - 783986e feat(261005-mj2) add the Swell motion token layer and app-wide press feedback
  - 9894d5e feat(261005-mj2) make the nav selection travel and promote the greeting count
  - 70bb9cd feat(261005-mj2) stage the data surfaces on the swell
  - c3119d6 docs(261005-mj2) un-blind the chart-swap structural gate
---

# Quick Task 261005-mj2 — "The Swell"

Visual + motion overhaul of the frontend. Amplifies DESIGN.md's "Open Water"
identity with the motion identity it never had; replaces nothing.

Direction and motion budget were client decisions, taken before planning:
**amplify, do not replace**, and **expressive but settles** — no looping motion
anywhere behind data, the login horizon being the only continuous ambient
motion in the app.

## What shipped

**Token layer** (`index.css`, +345 lines). `--ease-swell` plus four job-named
durations (`--dur-press`/`--dur-state`/`--dur-travel`/`--dur-crest`),
`--stagger-step`, `--dur-flip`, and `--sheen`/`--horizon` in both themes. Four
keyframes, each **re-declared inert inside the reduced-motion query** rather
than killed by a global `animation: none` reset, so every animation becomes a
no-op with its final state intact. Themed browser surfaces that were previously
all browser defaults: `::selection`, `caret-color`, `scrollbar-color` plus the
`-webkit-` pseudos for Safari/iOS, and tabular numerals on table cells.

**Press feedback** on every button in the app — 33 buttons across 21 files.
Fires on tap, click and keyboard activation, so it is safe for a user with no
reliable pointer and is not a hover affordance. `.press-swell` is deliberately
unlayered: Tailwind v4 emits utilities inside cascade layers and unlayered CSS
beats layered CSS, so the rule always wins and cannot be half-copied at a call
site.

**Navigation.** The rail's selected destination no longer hard-snaps — an accent
pill travels to it with a 2px tide-mark at its leading edge, `transform` only,
measured in `useLayoutEffect`. The label's colour flips at `--dur-flip`
(mid-travel) so it never sits accent-on-accent in flight. `aria-current` remains
the announced signal; the pill is decoration over it.

**Orientation.** The greeting's reading count was the quietest thing on its own
line and is now full ink at 700. The three filter-state sentences became
line-level pills.

**Data surfaces.** KPI cards crest in left-to-right and count their values up,
each card starting its count when it becomes visible rather than while still
transparent; the dark Readings tile gained a sky waterline. The chart view swap
is directional — outgoing drifts out the way it came, incoming enters from the
other side. The assistant crests in from its anchored corner. `ReadingsTable`
no longer nests a card inside a card.

## Decisions worth keeping

**The state ribbon is line-level, not facet-level — and that is a correctness
decision, not a visual compromise.** The brief asked for a pill per filter facet.
That is not implementable: `FilterStateBlock.test.tsx` asserts exact sentence
text via `getByText`, and Testing Library's `getNodeText` joins only an
element's *direct* text-node children, so splitting a sentence across child
`<span>`s makes the matched text empty. `:57` independently asserts exactly
three `<p>` elements. Those assertions test the contract clause "copy stays
derived from `buildFilterSentence`/`buildShowSentence`", not old markup, so the
brief's own escape hatch applied. Each existing `<p>` became one pill with its
sentence intact as a single text node. **`FilterStateBlock.test.tsx` is
byte-unchanged from baseline** — verified against `ce16b63`, and gated.

**The chart swap's committed children render under a keyed `Fragment`, never a
keyed `div`.** A div there has auto height, which breaks the `h-full` chain to
`ResponsiveContainer`, measures 0, and renders the timeline **blank in the
browser while the suite stays green** — Recharts draws nothing under jsdom, so
no automated gate can catch it. The `FadeSwap` header comment says this at
length; do not condense it.

**`FadeSwap` renders live children while the swap key is unchanged.** A
date-filter change does not alter `key`, so a stored node would have frozen the
chart to a stale snapshot — a data bug on a health surface. Found during
planning, not by a test.

## Defects caught before execution

Two plan-check rounds found 23 issues. Three would have shipped silently:

1. **Two verify gates contained the HTML entity `&lt;button`** and passed with
   zero work done — the only coverage gates on the 21-file press-feedback edit.
2. **The chart-swap exit animation was architecturally impossible as first
   planned.** `ChartDeck`'s remount key sat on the wrapper div, so `FadeSwap`
   was replaced rather than updated and could never observe a swap or hold
   outgoing children. `must_haves.truths[4]` would have been false.
3. **The fix for (2) risked the blank timeline** described above.

A fourth was caught during execution verification: `StatsStrip.test.tsx:173`
asserts `.animate-pulse`, which the `motion-safe:` prefix defeats — the rendered
token becomes `motion-safe:animate-pulse`. Fixed to `[class*="animate-pulse"]`
with `toHaveLength(4)` kept, since the count-of-four skeleton cells is the real
gate.

## Verification (run on `main`, post-merge, not taken on report)

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean but for one **pre-existing** warning
  (`GreetingHeader.tsx:17`, fast-refresh/only-export-components, present at
  baseline `ce16b63`).
- `npm test -- --run` — **52 files / 790 tests passing** (baseline 784, +6).
- `npm run build` — succeeds. The >500 kB chunk warning is pre-existing
  (Recharts).
- **Reduced motion verified against the built bundle**, which no gate covered:
  all four keyframes survive Lightning CSS minification with 2 declarations
  each (live + inert), so the reduced-motion path holds in production.
- All gates pass on `main`: press coverage 0 files missing; swap structural
  (code-only) pass; locked clinical/overlay/series hues **0 changed lines**
  since baseline; zero component hex; zero mid font-weights; zero sub-18px
  text; zero sub-48px targets; zero ungated animations at `src` scope; zero
  `hover:`, zero Sky text-fills, zero `disabled:opacity`.

## Open / not done

- **One unexplained test flake.** The first full-suite run on `main` reported
  3 failed / 787 passed. Not reproducible: 4 subsequent full runs passed 790
  (one under deliberate 4-core CPU contention), and the three timing-dependent
  files (`StatsStrip`, `ChartDeck`, `GreetingHeader`) passed 5/5 in isolation.
  That run's duration was anomalous (37s vs 12.6s in the worktree) and it
  coincided with worktree removal. **The failing test names were not captured**
  — only the tail was. The suspect mechanism is the new timing-dependent
  assertions (`useCountUp`'s `waitFor`, the `data-swap-phase` exit→in wait). If
  it recurs, capture the names before anything else.
- **No browser verification.** The Chrome extension was not connected for this
  session, so nothing here was confirmed visually. Every motion claim is
  verified structurally (tokens, gates, tests, built CSS) and **not** by eye.
  The plan's `<human-check>` walk is outstanding, including its reminder to
  confirm `document.visibilityState === "visible"` first — a hidden tab freezes
  rAF and would make both the count-up and the tide-mark look broken when they
  are not.
- The executor hit a session rate limit after committing Tasks 1 and 2 and
  completing Task 3's edits; Task 3 was verified and committed by the
  orchestrator, and the full gate set was re-run on `main` afterwards.
