---
target: frontend/src/App.tsx (CardioStream dashboard)
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-08-27T20-44-31Z
slug: frontend-src-app-tsx
---
Method: dual-agent (Assessment A: design review · Assessment B: detector + browser evidence — run as two isolated subagents, synthesized here)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3/4 | `AgentStatusBanner`'s "Assistant unavailable right now" reads as transient, but per PRODUCT.md it's a permanent $0-credit condition — no duration/severity signal, sitting directly under a CommandBar still displaying fully "armed" voice affordances. |
| 2 | Match Between System and Real World | 4/4 | Plain-English filter sentence, real clinical category names, zero internal jargon (Foam/Sky/Terracotta) ever surfaces to the user. |
| 3 | User Control and Freedom | 3/4 | The new Cancel button closes the "stuck round-trip" trap well, but there's no single "reset all filters" action — clearing date+AM/PM+category takes 2-3 separate taps across groups. |
| 4 | Consistency and Standards | 4/4 | The one-accent/one-elevation/2px-ink-border/xl-radius system is enforced rigorously across Header, FilterBar, OverlayToggle, CommandBar. |
| 5 | Error Prevention | 3/4 | Dashed-border-for-disabled and the new Cancel affordance are good, but `OverlayToggle`'s `opacity-60` dimming visually signals "disabled" for buttons its own code comment says "never disable" — inverts the system's own disabled-state rule. |
| 6 | Recognition Rather Than Recall | 4/4 | Filter-state sentence always visible, rotating example placeholders teach vocabulary, EmptyState names the exact filters causing zero results. |
| 7 | Flexibility and Efficiency of Use | 3/4 | Voice/text/click parity is excellent, but no saved/favorite filter combo despite PRODUCT.md's own example query being obviously repeatable, and zero session persistence. |
| 8 | Aesthetic and Minimalist Design | 4/4* | Airy Nautical restraint is real — one accent, two neutral surfaces, decorative elements never behind data. *See detector finding below (nested-cards on mobile) — scored by Assessment A before that evidence existed; would likely nudge to 3/4 on a re-score. |
| 9 | Help Users Recognize/Diagnose/Recover from Errors | 3/4 | Copy is calm and word-based, but `OFFLINE_COPY` invites a retry that cannot succeed in production — misdiagnosing a permanent outage as transient. |
| 10 | Help and Documentation | 4/4 | `GuideOverlay` is thorough and well-scoped — jump-to-section nav, by-click AND by-voice instructions, a dedicated phrase library. |
| **Total** | | **35/40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** Unmistakably authored for this product, not a reskinned admin template — the AHA six-category clinical palette drives filter chips, stat percentages, and timeline bands identically everywhere; the Command Bar has literal top billing above the filter bar; pagination is a full-width "Show 20 more" button rather than a numbered pager because precise small-target tapping is a real constraint here; the honest `AgentStatusBanner` refuses to hide agent failure behind a silent retry. The one place specificity breaks down is currency with its own stated reality: the interface still presents voice as fully live while PRODUCT.md documents the production agent as permanently unreachable — a generic dashboard wouldn't have this tension, because a generic dashboard doesn't stake its identity on voice being the primary channel.

**Deterministic scan:** CLI scan (`detect.mjs --json` over `App.tsx` + `components/`) came back clean — 0 findings, exit code 0. The live browser overlay, however, found **20 `nested-cards` hits, all one rule**: `frontend/src/components/ReadingsTable.tsx`'s mobile stacked-card layout (`shouldUseCardLayout`, sub-640px) renders each `ReadingCard` (`rounded-xl border border-[var(--color-foam)] p-4`) nested inside the table's own outer card (`rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]`) — 20 instances = 20 visible rows, an exact match. This is real DOM nesting, not a false positive, and it's a genuine coverage gap between the two tools: a static per-file scan can't resolve that a `.map()`-rendered child component ends up nested inside its parent's card without actually rendering the tree, which is exactly what the browser overlay did that the CLI scan structurally cannot. Neither Assessment caught this independently — B found it via the browser, A's own browser-resize attempts didn't reflow to the narrow width where it appears, so this is the detector genuinely surfacing something the LLM review missed.

**Visual overlays:** No overlay is currently live in a browser tab — Assessment B's live-server instance was stopped after evidence-gathering per protocol. The finding above is reported textually; re-running `/impeccable audit` or `/impeccable critique` with a live session would re-surface the visual overlay if useful.

## Overall Impression

This is a genuinely well-executed, identity-specific dashboard with real engineering discipline behind its accessibility constraints (the Cancel affordance, the card-layout reflow, the pulse-sync between voice and manual filters). The single biggest opportunity is closing the gap between what the UI visually promises (a live, armed voice assistant) and what PRODUCT.md documents as the current permanent reality (zero API credits, every real call fails) — right now the one user with no fallback path is the one most exposed to that gap.

## What's Working

- **`CommandBar`'s single-region state machine**: one `aria-live` slot resolves armed-hint -> transcript -> working -> confirmation/error, never overlapping; today's Cancel-button fix closes the one real "stuck with no way out" trap.
- **`FilterBar`'s D-08 pulse system**: an agent-driven filter change and a manual chip click converge into the exact same visual event, answering "does voice feel bolted on" concretely rather than just claiming parity.
- **`ReadingsTable`'s `shouldUseCardLayout` reflow**: a constraint-driven solution (no horizontal-scroll drag gesture) that keeps the clinically-important Category column reachable on narrow screens.

## Priority Issues

**[P0] The UI still presents voice as fully live while inviting a guaranteed-to-fail retry**
Why it matters: Per PRODUCT.md this is a permanent $0-credit condition, not a network blip — "the buttons below still work" isn't reassurance for Chris specifically, since he cannot reliably use buttons, and the mic/placeholder/ring all still present the bar as armed.
Fix: Branch on `agent_configured` (already threaded through `syncFromHealth`) to show a distinct, honest "voice understanding is off right now" state that suppresses the vocabulary-teaching placeholder and stops suggesting a retry.
Suggested command: /impeccable clarify

**[P1] Zero state persistence — any reload or iOS tab-reclaim silently erases the whole session**
Why it matters: CLAUDE.md names Safari/iOS auto-stop/tab-reclaim as the project's #1 device-test risk. Chris cannot quickly redo a multi-step voice sequence after an involuntary reload, and nothing tells him state was lost versus intentionally reset.
Fix: Wrap `store/filters.ts` in zustand's `persist` middleware (localStorage) so a recognizer-triggered reload doesn't discard a voice-built view.
Suggested command: /impeccable harden

**[P2] `OverlayToggle`'s dimming contradicts the design system's own disabled-state rule**
Why it matters: DESIGN.md's Named Rule is explicit — a disabled/not-ready action gets a dashed border, never a lowered-opacity solid one. `OverlayToggle.tsx` applies `opacity-60` to buttons its own comment says "never disable," which reads as off-limits to anyone skimming by appearance.
Fix: Drop the opacity dimming; the existing `NOTE_COPY` ("Overlays aren't shown on this chart...") already carries the meaning by word, matching the system's own doctrine.
Suggested command: /impeccable harden

**[P2] `ReadingsTable`'s mobile card layout nests a card inside a card, doubling the chrome**
Why it matters: Below 640px, every visible row is a bordered/rounded `ReadingCard` sitting inside the table's own bordered/rounded/shadowed outer section — two layers of "xl radius + framing" stacked on every single row, working against DESIGN.md's own restraint ethos ("every element earns its pixel"). Invisible to both the prior mobile-layout fix's own verification and to a static text scan; only the live browser overlay caught it.
Fix: When `cardLayout` is active, drop the outer `<section>`'s own `shadow-elevation`/padding (let it go flush) since each row already carries its own card treatment — or drop `ReadingCard`'s border/rounding and use a plain `gap-4` + hairline divider instead.
Suggested command: /impeccable polish

**[P3] BP Timeline band labels collide with the plotted lines they identify**
Why it matters: The prior fix solved label-vs-label collision by dropping two labels; it didn't address label-vs-data collision for the remaining four — observed live on the default "All data" view, where the diastolic line cuts directly through "Hypotension."
Fix: Give band labels a small solid-color chip backing (reusing the existing category-chip pill treatment) instead of bare SVG text on the plot surface, or park them in a fixed gutter outside the data area.
Suggested command: /impeccable polish

## Persona Red Flags

**Chris (voice-primary, no reliable pointer)**: Two compounding failures specific to him — (1) the agent outage leaves him with no operable path today, since nothing resolves his voice command and "the buttons below still work" isn't true for him; (2) missing state persistence means any involuntary Safari/iOS reload wipes a voice-built session with no memory and no caregiver-independent recovery.

**Sam (accessibility-dependent user)**: `OverlayToggle`'s opacity-disabled-but-actually-enabled mismatch is exactly the kind of appearance-based misread that hurts a user relying on visual affordance cues over exploration; the `ReadingsTable` card-in-card doubling adds visual noise right where a low-vision user is already working hardest (the narrow, stacked-card view). Separately, `bandLabel`/axis-tick text in the charts sits below DESIGN.md's own stated 18px floor — likely an intended chart-internals carve-out, but the rule as written doesn't say so.

**Alex (power/repeat user — the caregiver)**: No persisted filters/overlays means redoing the same daily setup every session; no single "clear all filters" action; toggling all three overlays requires three separate taps with no all/none shortcut.

## Minor Observations

- Three independently-authored "agent unreachable" strings now exist in the codebase (`AGENT_UNAVAILABLE_BANNER_COPY`, `OFFLINE_COPY`, backend's `UNAVAILABLE_MESSAGE`) — flagged as deliberate in a code comment, but a real drift risk over time.
- The six BP categories render in three different visual vocabularies on one screen (solid pill chips in FilterBar, dot+text chips in StatsStrip, translucent bands in BPTimeline) — likely intentional redundancy, unaudited as "the same six things" across styles.
- ChartDeck's mini-chart previews show zero legend/axis context — the "BP Categories" mini is six unlabeled colored bars, decodable only after scrolling past the FilterBar chips above.
- `ReadingsTable`'s card-layout threshold (640px, JS-measured container width) can disagree with `StatsStrip`'s Tailwind viewport-media-query breakpoints in the ~640-768px real-viewport band, since one measures post-gutter content width and the other measures raw viewport.

## Questions to Consider

1. Given the agent is at $0 credits in production and every real `/agent` call resolves to failure, is presenting a fully "live" voice affordance still the right default, or does honesty require a visibly different mode for "voice parsing is off indefinitely"?
2. Chris cannot reliably re-navigate by hand, and the entire filter/chart/overlay session lives in an unpersisted in-memory store — has the actual recovery path been tested with a real caregiver on real iOS Safari?
3. The six clinical categories are now expressed in three different chip/band visual languages — was that layered redundancy a deliberate legibility decision, or has the pattern simply forked three times with no single audit of whether it still reads as "the same six things"?
