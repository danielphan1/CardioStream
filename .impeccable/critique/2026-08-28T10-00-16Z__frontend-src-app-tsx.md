---
target: frontend/src/App.tsx
total_score: 33
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-28T10-00-16Z
slug: frontend-src-app-tsx
---
Method: dual-agent (Assessment A: design review · Assessment B: detector + browser evidence — run as two isolated subagents, synthesized here; one Assessment B finding independently re-verified in the parent context via live DOM/zIndex-layer inspection and a screenshot before synthesis)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | Submitting a command while the agent is already known-unavailable still runs a full "Working…" round trip to a guaranteed failure, live-reproduced. |
| 2 | Match Between System and Real World | 4/4 | Clinical terminology (AHA categories, AM/PM, bradycardia threshold) matches the real domain precisely; zero internal jargon leaks to the user. |
| 3 | User Control and Freedom | 3/4 | Cancel/Escape/close paths exist everywhere checked, but table/overlay-list pagination is append-only ("Show 20 more") with no way back up except manual scroll. |
| 4 | Consistency and Standards | 4/4 | The One-Signal and Dashed-Border rules verified live — Terracotta only ever appears on primary/active/pressed states across every screenshot taken. |
| 5 | Error Prevention | 2/4 | Send/Enter stay fully "armed" even when `unavailable` is already true client-side; live-tested and confirmed it still runs the doomed round trip instead of short-circuiting. |
| 6 | Recognition Rather Than Recall | 4/4 | Filter-state sentence, overlay sentence, and rotating command-example placeholders externalize state well. |
| 7 | Flexibility and Efficiency of Use | 3/4 | Voice/click/keyboard converge on identical state (strong), but there's no jump-to-date or search in ReadingsTable for a caregiver scanning months of history. |
| 8 | Aesthetic and Minimalist Design | 2/4 | BP Timeline band-label chips (today's own P3 fix) render *underneath* the plotted lines, not above them — confirmed by DOM inspection and a live screenshot; "Hypertensive Crisis," "Normal," and "Hypotension" are now harder to read than before the fix, not easier. |
| 9 | Help Users Recognize/Diagnose/Recover from Errors | 4/4 | Verified: no raw error text, status code, or stack trace ever reaches the DOM in any failure path inspected. |
| 10 | Help and Documentation | 4/4 | GuideOverlay is thorough, sectioned, jump-linkable, voice-vocabulary-specific. |
| **Total** | | **33/40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** Not a reskinned generic dashboard. The clinical Y-domains are hard-locked to real AHA thresholds (40/90/120/130/140/180/220 mmHg; a labeled 60bpm bradycardia line) and never auto-fit — only sensible if the data is known to be medical. The command bar's state machine is bespoke engineering around the Web Speech API's real quirks, not a generic search-box-with-mic. ReadingsTable's table→card mobile reflow was explicitly built to avoid a swipe/drag gesture *because the named primary user cannot perform one* — a decision traceable to one specific person's motor limitations, not a copied breakpoint. Where the UI leans generic (login gate, logout-confirm modal, skeleton loaders), that's appropriate — auth chrome doesn't need to be bespoke.

**Deterministic scan:** Both the static CLI scan (`detect.mjs --json` over `App.tsx` + `components/`) and a live browser-injected DOM scan came back clean — 0 findings from either engine, and the CLI scan's rule-firing was sanity-checked against a scratch file to confirm it's actually running, not silently no-op'ing. Neither pass is a false negative in the sense of "broken tooling" — it's a real, if narrow, coverage gap: neither engine's rule set covers "chip renders in the wrong z-index layer" or "a card is nested inside another card," which is exactly the category both of today's live findings fall into.

**Visual overlays:** Assessment B's live-server/detect.js injection succeeded and independently agreed with the CLI (zero findings). More importantly, direct DOM+screenshot evidence — gathered by both Assessment B and, separately, re-verified in this synthesis pass — settles a disagreement between the two assessments (see below). No overlay is currently live in a browser tab; both live-server instances used for evidence-gathering were stopped per protocol.

**Where the assessments diverged, and how it was resolved:** Assessment A's design review listed the BP Timeline chip/band interaction as a **strength**, describing it as "verified live: solid category-color chip pills sit legibly on 10–14%-opacity band tints, and systolic/diastolic lines stay fully readable crossing through every band, including labeled ones." Assessment B's browser evidence found the opposite: sampling both line paths at 600 points via `getPointAtLength`/`getScreenCTM` against each chip's `getBoundingClientRect()`, it found the systolic line crossing the "Normal" chip and the diastolic line crossing the "Hypotension" chip. Given the direct contradiction, this synthesis pass independently re-verified in a fresh browser tab: `svg.recharts-surface`'s `zIndex-layer_100` (the same layer as the `ReferenceArea` band backgrounds) contains the band-label chips, while `zIndex-layer_400` — which paints *after* layer 100 in DOM/SVG order — contains the actual `Line` series paths. The chip's own code comment claims Recharts renders `ReferenceArea` labels in a `zIndex-layer_2000` "label layer" that's always above the `Line` layer; that claim is empirically false for this component — `zIndex-layer_2000` in the live DOM contains only axis tick labels. A screenshot confirms the visual result: the "Hypertensive Crisis," "Normal," and "Hypotension" chips are all harder to read than plain text would have been, because the line paints on top of the chip's own opaque fill. Assessment A's "verified live" claim did not hold up under closer, tool-assisted inspection — the detector-and-evidence half of this critique caught a real regression the design-review half's visual pass missed.

## Overall Impression

The engineering discipline behind this dashboard's accessibility constraints remains genuinely strong — the honest, pre-emptive agent-unavailable banner, the width-measured (not media-query) mobile table reflow, and the four-outcome command-bar state machine are all real, considered work. But this specific critique lands at a slightly *lower* score than the last one (33/40 vs. 35/40) despite three of the last critique's four fixes landing cleanly, because the fourth — today's own BP Timeline band-label fix — shipped with an incorrect assumption about Recharts' rendering layers and made the exact problem it was meant to solve measurably worse, and because this pass surfaced a real accessibility gap (silent voice-command failures) that the product's own core value proposition — "entirely by voice" — can't really afford.

## What's Working

- **The command bar's single `aria-live` state machine** — one region resolves armed-hint → transcript → working → confirmation/error, never overlapping, with a real Cancel affordance closing the one "stuck round-trip" trap.
- **The honest agent-unavailable design** — a persistent, non-dismissible, plain-language banner shown *before* the user wastes a command, backed by a product doc (PRODUCT.md) that documents the real $0-credit production limitation rather than hiding it.
- **ReadingsTable's width-measured mobile reflow** — verified live producing a clean stacked-card view with zero clipped columns once settled, built specifically because the primary user cannot perform a swipe/drag gesture.

## Priority Issues

**[P1] BP Timeline band-label chips render underneath the plotted lines — today's own P3 fix made the labels harder to read, not easier**
Why it matters: This is a live, verified regression from a fix shipped this session. The chip's opaque fill was meant to fully occlude any line crossing behind it; instead it renders in Recharts' `zIndex-layer_100` (same as the `ReferenceArea` backgrounds), one layer *below* the `Line` series' `zIndex-layer_400`, so the line paints over the chip. "Hypertensive Crisis," "Normal," and "Hypotension" are all now muddier/harder to read than the original bare-text version — worse than the problem it replaced, on data that's clinically meaningful.
Fix: Move the band-label chip rendering out of the `ReferenceArea`'s own `label` prop (which stays pinned to that `ReferenceArea`'s zIndex layer) and into a `<Customized>` component or a manually-positioned overlay `<g>` rendered after the `<Line>` elements in JSX order, so it lands in a layer that actually paints above `zIndex-layer_400` — verify against the live DOM's `zIndex-layer_*` groups directly, not against Recharts' generic zIndex documentation, since that documentation describes a different code path than `ReferenceArea label`.
Suggested command: /impeccable harden

**[P1] Voice commands fail in silence**
Why it matters: `onApplied` calls `useSpeech.getState().speak()`, but the `clarify`/`refuse`/`unclear`/`unavailable` branches in `CommandBar.tsx`'s `onSuccess`/`onError` do not. For a voice-primary user who may not be looking at the screen, a failed voice command produces dead air — indistinguishable from not having been heard at all. This directly undercuts the product's stated core value ("Chris can see and explore his own health data entirely by voice").
Fix: Speak the same message text on at least the `unclear`/`unavailable` outcomes, matching the pattern already used for `onApplied`.
Suggested command: /impeccable harden

**[P2] ReadingsTable's mobile card layout still nests a card inside a card (carried over, unaddressed since the last critique)**
Why it matters: Below 640px, every visible row is a bordered/rounded `ReadingCard` sitting inside the table's own bordered/rounded/shadowed outer `<section>` — two layers of "xl radius + framing" stacked on every row, working against DESIGN.md's own restraint ethos. Re-confirmed today via forced-width DOM inspection and a 360px screenshot; unrelated to and not fixed by any change landed since the last critique flagged it.
Fix: When card layout is active, drop the outer `<section>`'s own `shadow-elevation`/padding (let it go flush) since each row already carries its own card treatment — or drop `ReadingCard`'s border/rounding in favor of a plain `gap-4` + hairline divider.
Suggested command: /impeccable polish

**[P2] Command bar runs a doomed round trip and then duplicates the outage message already on screen**
Why it matters: Live-reproduced: typing a command while `unavailable` is already true (banner already showing) still runs the full submit → "Working…" → error cycle, and the resulting inline reply ("The assistant isn't connected right now…") sits directly above the persistent `AgentStatusBanner` ("Voice and text commands aren't working right now…") — two different sentences stating the same fact, visible at once. This is also a Single-Focus cognitive-load failure (two elements competing to tell the user the same thing).
Fix: Short-circuit submission when `unavailable` is already known client-side — skip the network round trip and the redundant inline reply entirely.
Suggested command: /impeccable distill

**[P3] Initial-mount flash briefly exposes the exact failure the mobile card layout exists to prevent**
Why it matters: `shouldUseCardLayout` deliberately returns `false` when width is unmeasured (`width <= 0`), so on a genuinely narrow first load the table renders in its 6-column form before `ResizeObserver` fires — live-reproduced on a real 500px-wide tab: the Category column clips off-screen for one frame before resolving to card layout. Brief, but a real (if momentary) contradiction of the project's own No-Off-Screen Rule at exactly the widths that rule exists to protect, and Alex-the-caregiver's one-handed-phone usage pattern is precisely who's most likely to see it.
Fix: Seed the initial width guess from `window.innerWidth` (available synchronously) instead of defaulting to the wider table layout.
Suggested command: /impeccable harden

## Persona Red Flags

**Chris (voice-primary, no reliable pointer)**: The silent-failure gap (P1 above) hits him hardest — he has no way to "check the screen" the way a caregiver would, so a failed voice command reads as the system simply not responding. His one on-demand help resource, the Guide, is visual-only text — not voice-triggerable, not read aloud — so at the moment he's most stuck (having forgotten a command phrase), his only path is a caregiver reading the screen for him, which is exactly the dependency the product exists to remove. A visible Cancel button exists for a stuck round-trip; a `cancelVoice()` function exists in code, but no spoken cancel phrase appears to be taught anywhere in the Guide's command categories — worth confirming this isn't a click-only escape hatch.

**Sam (accessibility-dependent — screen reader / keyboard-only)**: Strengths confirmed in code: `aria-pressed` on every toggle, disciplined singular `aria-live` regions, correct `inert` handling during the Guide overlay, and the category chip's deliberate use of `boxShadow` (not `outline`) so `:focus-visible` is never swallowed by the selection ring. Gap: overlay-event `ReferenceLine` markers on the hero charts are unlikely to be reachable through Recharts' `accessibilityLayer` (which wires up data series, not arbitrary reference lines) — mitigated by the separate `OverlayEventsList` table, but that's a fallback, not parity. The now-confirmed muddy chip-behind-line rendering (P1 above) is also a low-vision concern: it reduces contrast/legibility on exactly the data a low-vision user is working hardest to read.

**Alex (power caregiver — mouse/keyboard, reviews months of history)**: No search or jump-to-date in ReadingsTable beyond 20-row "Show 20 more" — reviewing data since "early 2025" could take many clicks to reach an old reading. Once multiple overlay datasets are on, the merged OverlayEventsList has no per-type filter. The initial-mount table flash (P3 above) is most visible to exactly her described usage pattern (one-handed phone use while attending to Chris).

## Minor Observations

- Header's six "chrome" utility controls are explicitly exempted from the 48px floor per DESIGN.md — in live screenshots they read comfortably tap-sized regardless, so the exemption isn't visually costing anyone.
- The rotating command-bar placeholder correctly pauses once the user types (verified: the effect bails on non-empty text).
- Category-chip clinical order (Hypotension → Crisis) is consistent across FilterBar, StatsStrip, ChartBars, and ReadingsTable — checked all four, no drift.
- Dark/light theme parity for header/command bar/filter bar/banner was visually confirmed live at a real narrow viewport in both themes.
- Six simultaneous BP-category chip toggles (medically locked, can't be trimmed) sit beside a 5-way date row and 3-way AM/PM row — 14 buttons before a chart renders. The filter-sentence summary mitigates most of the cost, but the row's visual weight could still be reduced (`/impeccable quieter`).
- The three independently-worded "assistant unavailable" strings across the codebase are a deliberate, documented decision (a `lib/copy.ts` comment cites a prior UI-SPEC precedent) — noted for context, but the user-facing redundancy in the P2 finding above stands regardless of the intent behind it.

## Questions to Consider

- If the production agent may sit at zero credits indefinitely, should Send/mic visibly soft-disable using the design system's own Dashed-Border "not ready" language, instead of staying in full "ready" appearance until a round trip proves otherwise?
- Chris's core value proposition is exploring his data "entirely by voice" — is a visual-only, un-narrated Guide an acceptable single point of failure for relearning a forgotten command, or does his one help resource need to work in his one input modality?
- With 14 simultaneous filter/overlay buttons rendered permanently above the fold, and full voice/typed coverage for the same actions, is the always-visible FilterBar still earning its space over a progressive-disclosure alternative?
