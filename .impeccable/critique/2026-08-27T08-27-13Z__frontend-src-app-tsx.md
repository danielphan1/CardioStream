---
target: the main dashboard (frontend/src/App.tsx)
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-27T08-27-13Z
slug: frontend-src-app-tsx
---
# CardioStream Dashboard — Design Critique

**Method: dual-agent (A: design-review agent · B: detector+browser-evidence agent)**

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Mic button glyph doesn't change between "off" and "listening" — only "paused" gets a distinct icon |
| 2 | Match System / Real World | 4 | Solid — real AHA names, natural voice phrasing |
| 3 | User Control and Freedom | 3 | No cancel affordance during "Working…" — mic + text input both lock for the full round-trip |
| 4 | Consistency and Standards | 4 | Verified: every component reads var(--color-*) exclusively, zero hardcoded hex found |
| 5 | Error Prevention | 3 | Tapping an already-active BP-category chip silently clears it to "All" with no visual cue |
| 6 | Recognition Rather Than Recall | 4 | Solid — persistent filter-state sentence removes memory burden |
| 7 | Flexibility and Efficiency | 3 | No saved/default view — a daily user re-speaks the same filter chain every session |
| 8 | Aesthetic and Minimalist Design | 2 | BP Timeline's 6 band labels overlap at the left edge; mobile width overplots ~130 points into a smear |
| 9 | Error Recovery | 4 | Solid — fixed friendly copy, retry button, text preserved on "unclear" |
| 10 | Help and Documentation | 4 | Solid — Guide's "What Can I Say" gives literal example phrasing per feature |
| **Total** | | **34/40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** The voice layer is genuinely specific — the wake word, rotating example placeholders that teach the vocabulary, the locked six-category clinical palette, and the Guide's "What Can I Say" section couldn't drop into another dashboard unchanged. But the page's compositional shape (four stat tiles -> hero chart with rotating mini-previews -> paginated table) is standard BI-dashboard furniture. The specificity lives entirely in the voice/copy/color layer, not the layout skeleton.

**Deterministic scan:** Clean — 0 findings across 88 source files (.tsx/.ts/.css), confirming Assessment A's "zero hardcoded hex" observation at scale, not just in the files A happened to read. This also explains why Issue #1 below survived undetected until a human/visual pass: the detector's rule set targets markup anti-patterns (inline colors, tiny targets), not data-driven SVG label collisions from Recharts — that class of defect is structurally invisible to static analysis.

**Visual overlays:** No user-visible [Human]-tab overlay was presented (no tool in this session exposes that capability) — treat the findings below as console-evidence, not an in-browser highlight. Console signal: dashboard (light) and the login gate both came back clean (No anti-patterns found). Dark mode reported 2 text-occlusion hits, but these are **false positives**: grepping all of frontend/src for the flagged strings found zero matches, and a live DOM query on a fresh reload also found zero matching elements. The flagged text ("Claude is active in this session…") reads as the Claude-in-Chrome extension's own injected status badge, not app markup — the finding count even changed between two identical reloads, which a real static occlusion wouldn't do.

## Overall Impression

A well-engineered "Good" (34/40): the token discipline, focus-ring separation, and voice-state machine are executed with real rigor — DESIGN.md's rules visibly hold up in the live app, not just on paper. But the single biggest opportunity is that the two most consequential defects both land on the app's highest-stakes moment: reading your own BP trend. The hero chart's label collision and the table's mobile column clipping undercut the "calm, legible" identity at exactly the point a user is checking whether a reading was dangerous.

## What's Working

1. **The CommandBar's single-live-region state machine** — exactly one of (armed hint / transcript / Working / paused / confirmation) is ever visible, verified live. Rarer in production dashboards than it sounds.
2. **Token discipline, confirmed at scale** — Assessment B's clean 88-file scan backs up what Assessment A saw component-by-component: no hardcoded hex anywhere, DESIGN.md's contract is real, not aspirational.
3. **The chart tooltip's click-persistent + explicit Close + Escape pattern** — a correctly-implemented accommodation for users who can't hover, exactly matching the project's no-hover-only constraint.

## Priority Issues

[P1] BP Timeline band-label collision & mobile overplotting
- Why it matters: This is the default hero chart on first load — the primary glanceable read of Chris's own blood pressure trend — and it's illegible at the left edge in both themes and both screen widths tested; mobile also overplots ~130 raw points into an unreadable smear.
- Fix: Suppress in-chart band labels below a width threshold (or move to a compact corner legend); aggregate/throttle points at mobile widths instead of rendering every raw reading.
- Suggested command: /impeccable clarify

[P1] ReadingsTable "Category" column clipped off-screen on mobile, no scroll path
- Why it matters: PRODUCT.md records Chris's device as undecided, so a caregiver on a phone is a live scenario. Category is clinically the most important column, and there's no horizontal scroll — a swipe selects text instead.
- Fix: Wrap the table in overflow-x: auto (matching the "No-Off-Screen Rule" already established for FilterBar) or collapse to a card layout below md.
- Suggested command: /impeccable layout

[P2] Mic button doesn't visually distinguish "listening" from "off"
- Why it matters: For a hands-free user, knowing the mic is live is a basic trust signal; today that only lives in the surrounding bar, not the control itself.
- Fix: Give the mic button its own distinct fill/ring when sessionOpen is true.
- Suggested command: /impeccable polish

[P2] No cancel path during "Working…"
- Why it matters: Given the agent is at $0 production credits, every real command today locks the input for a full round-trip before resolving to "didn't understand" — this is happening on every single command right now, not a rare edge case.
- Fix: Add a visible, always-enabled Cancel control during the working state.
- Suggested command: /impeccable harden

[P3] BP-category chip's tap-to-clear is a hidden toggle
- Why it matters: Minor for voice users, but a real "wait, what happened" moment for a mouse-using caregiver.
- Fix: Disable re-tapping the active chip, or give clearing a distinct affordance.
- Suggested command: /impeccable polish

## Persona Red Flags

**Chris (C4 quadriplegic, voice-only, no reliable hand mobility):** Walking "Dashboard, show me my blood pressure for the last 30 days, mornings only" through the real production state surfaces the review's most consequential finding: with the agent backend at $0 credits, this command degrades to "didn't understand" every time, and the frontend's own recovery path — "edit the text box and retry" — isn't operable for someone with no reliable hand mobility. Compounding it: Voice Replies defaults to Off on load, muting the one confirmation channel that doesn't require looking at a screen, for the one user who may not reliably look at the screen either. If a command does succeed, Issue P1 (chart label collision) then lands on someone with no ability to pinch-zoom or drag to compensate.

**Alex (impatient power user):** The very first big visual element — the hero chart — carries the band-label collision, an immediate "unpolished" read. He'd hit the mobile table clipping and likely conclude data is missing rather than hunt for a nonexistent scroll affordance. He'd also want a saved default view; none exists.

**Sam (screen-reader/keyboard-dependent):** A genuine win, confirmed live via Tab-through: the focus ring is a clearly distinct light-blue from the terracotta accent, exactly matching DESIGN.md's "Focus and accent must never collapse" rule, with correct role="group"/aria-pressed/aria-live usage throughout. One gap for a low-vision (magnified-view) variant of this persona: the mobile table clipping affects a zoomed-in view the same way it affects a narrow phone — the column is still there for a screen reader, but not for someone visually scanning.

## Minor Observations

- The Guide toggle showed a lingering focus ring in one screenshot with no intentional focus action — worth a quick sanity check that focus-restoration logic isn't firing on unrelated renders.
- StatsStrip's category-percent chips intentionally sit below 48px — this is a documented UI-SPEC exemption for display-only chips, not a violation.
- Evidence-quality note: Assessment A's browser session showed signs of a concurrent, unrelated automation session (an unexpected tab, viewport resets); every browser-dependent finding above was reproduced at least twice to control for that. Assessment B independently lost and recreated a tab mid-run for unrelated tooling reasons — no findings were lost, but treat both as "environment was a little noisy today," not as a reason to doubt the specific, cross-checked findings reported.

## Questions to Consider

- Given the agent is at $0 production credits today, is a fully-voice-branded command bar that currently always fails worse than temporarily muting voice affordances until the backend is funded?
- Why does Voice Replies default to Off in a product whose entire premise is that the user may not reliably look at a screen?
- Are 6 clinical categories and 5 date presets better served as a single flat row, or as two tiers (common presets + disclosed "more") to ease the moderate cognitive-load hit without losing clinical completeness?
- The nautical motif is the most emotionally distinctive thing in the product — is there room to extend that warmth into empty/error states without touching the locked data colors?
