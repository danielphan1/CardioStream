# Phase 12: Visual Refresh - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Every screen (dashboard, upload, guide overlay, records forms) gets a modernized, cohesive visual treatment — typography, spacing, color, and surface depth — building on the design-token system already shipped in `frontend/src/index.css`, with every existing accessibility floor (≥48px targets, ≥18px body text, high contrast, keyboard nav) verified intact or improved afterward (VISUAL-01, VISUAL-02).

In scope: token-level and component-level visual polish across the existing token system (color, type, spacing, shadow/elevation) and the ~20 components that consume it.

Out of scope (confirmed during this discussion): replacing the "airy nautical"/"night sea" palette identity with a new one; a second display font; a general hover/transition micro-interaction layer; any change to the clinical BP/pulse category colors (medical semantics, not aesthetic — untouched regardless of the accent-color change below).

</domain>

<decisions>
## Implementation Decisions

### Refresh intensity
- **D-01:** This is an **evolution, not a replacement**, of the existing token system. The "airy nautical" (light) / "night sea" (dark) identity in `index.css` stays the base — this phase refines it (spacing, type scale, elevation/depth, one accent-color change below), it does not redo the palette from scratch. Keeps the WCAG-contrast-computed token pairs mostly intact and keeps verification cost bounded, versus a full re-derivation across every existing screen.

### Aesthetic direction — where "warm & editorial" shows up
- **D-02:** Warmth comes from **a new accent color**, not from typographic personality. Heading weights/type scale/editorial-style callouts are explicitly NOT part of this phase's scope — see Typography below (single font, unchanged hierarchy approach).
- **D-03:** The new warm accent **replaces** `--color-accent` (currently navy `#14213D` light / `#8FC1D4` dark) everywhere that token is consumed today — primary buttons, active/pressed toggle fills, active filter chips, and anywhere else `var(--color-accent)`/`var(--color-accent-text)` currently renders. This is a sitewide, one-story accent change, contrast-recomputed for both themes — not a second sparingly-used token layered alongside navy.
- **D-04 (locked, not re-discussed):** The clinical BP/pulse category colors (`--cat-hypotension` through `--cat-crisis`, and the overlay dataset colors `--overlay-labs`/`--overlay-incidents`/`--overlay-procedures`) are **untouched** by this phase. Those carry medical/data significance (AHA classification, overlay dataset identity), not aesthetic choice — the "evolve, don't reinterpret meaning" boundary applies here even under D-01's broader license to refine.
- **D-05:** Surfaces (cards, panels, chart containers, filter bar) gain **more visual depth** as part of the refresh — soft shadows/elevation, slightly larger corner radius than today's `rounded-lg` baseline, more breathing room between sections. Reinforces the "evolved, modern" read without touching layout structure, component boundaries, or any accessibility target size.

### Typography
- **D-06:** Atkinson Hyperlegible stays the **only** font, body and headings — no second display font. It was chosen specifically for legibility/dyslexia-friendliness for a low-vision-adjacent audience; introducing a second font-pairing decision and an extra web-font load isn't worth the risk to that rationale. Type-scale/weight refinement within the single font is fine (implied by D-01's "evolve" license) but no new font family.

### Motion
- **D-07:** No new general hover/transition/micro-interaction layer. Today's only animation — `animate-pulse` for agent-driven filter changes (`useAgentPulse`) and the `StatsStrip` loading skeleton — stays exactly as-is; this phase doesn't add a `prefers-reduced-motion`-gated transition system on top. Keeps the refresh's risk surface to color/spacing/depth only, and avoids any distraction/motion-sensitivity risk for a user with limited mobility.

### Claude's Discretion
- Exact new warm accent hue (e.g. coral/amber/terracotta family) and its precise hex values for both light and dark themes — cosmetic detail; must be contrast-recomputed against both `--color-foam`/`--color-sky` (light) and `--color-foam`/`--color-sky` dark equivalents to the same rigor as the existing token pairs, but the specific hue choice is planning's call.
- Exact spacing-scale and shadow/elevation values (D-05) — e.g. a specific shadow recipe, exact corner-radius bump from `rounded-lg` — technical/visual implementation detail, not a locked product decision.
- Exact type-scale refinement within the single-font constraint (D-06) — e.g. heading size/weight steps — implementation detail within the "evolve" envelope.
- Whether the refresh touches component markup/structure or only Tailwind utility classes/CSS custom properties — technical implementation choice; note the codebase has meaningful test coverage (323 frontend / 260+ backend tests per STATE.md) that a structural refactor risks breaking test selectors against, which the researcher/planner should weigh.
- Whether to run an `impeccable` critique pass and/or `/gsd-ui-phase 12` (UI-SPEC.md design contract) before planning — per CLAUDE.md's "impeccable + GSD pairing" convention table, this phase (ROADMAP.md "UI hint: yes") is exactly the kind of formal design-contract case that table recommends `/gsd-ui-phase`, held to `impeccable`'s critique bar. Not re-litigated here since CLAUDE.md already establishes the workflow; the operator picks the next command.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & product context
- `.planning/REQUIREMENTS.md` §Visual Refresh (VISUAL) — VISUAL-01, VISUAL-02 (this phase's locked requirements)
- `.planning/PROJECT.md` — Core Value (voice-first), Constraints (non-negotiable accessibility floor: ≥48px targets, ≥18px body text, high contrast, keyboard nav, no drag/hover-only/precision interactions) — every visual change in this phase must be checked against this list, not just "looks fine"
- `.planning/ROADMAP.md` §Phase 12 — Goal, 2 Success Criteria, "UI hint: yes", and the explicit **research flag**: this phase has zero grounding in any of the four v1.1 research files (unlike Phases 6–11) — run a lightweight, targeted research/planning pass before executing, checked specifically against this codebase's existing accessibility-floor conventions
- `CLAUDE.md` §"impeccable + GSD pairing (frontend design work)" — the convention table for how design judgment (impeccable) and GSD planning/execution should combine for this kind of phase; directly relevant given "UI hint: yes"

### The existing design-token system (the thing being evolved)
- `frontend/src/index.css` — the FULL current token system: `@theme` (font, 18px body floor), `:root`/`.dark` custom properties for surfaces/ink/accent/focus/chart-series/clinical-category/overlay colors, `.chart-band` opacity rule. Every color this phase touches or must leave alone is defined here. The file's own header comment references a "02-UI-SPEC.md locked palette" that predates the current phase-numbering scheme and no longer exists on disk — `index.css` itself is now the source of truth, not that missing doc.
- `frontend/src/store/theme.ts` — the manual light/dark toggle mechanism (`.dark` class on `<html>`, localStorage-persisted) that both themes' tokens key off of; unaffected by this phase but must keep working identically.

### Precedent to mirror
- `frontend/src/components/charts/BPTimeline.tsx` (~line 46) — the one existing documented accessibility-carve-out precedent ("bands are ambient decorative tint, explicitly EXEMPT from the contrast floor") — the pattern to follow if this phase needs to justify any new exemption, and the explicit codebase example ROADMAP.md's research flag names as the check to run against.
- `.planning/phases/09-multi-dataset-overlay-filtering/09-CONTEXT.md`, `.planning/phases/10-spoken-replies-tts/10-CONTEXT.md`, `.planning/phases/11-full-site-guide-instructions-tab/11-CONTEXT.md` — established non-color-only state-encoding convention (word/icon + `aria-pressed`), ≥48px/aria-pressed pattern on every interactive control; this phase must preserve these, not just the color contrast numbers.

### Integration surface (read before implementing)
- `frontend/src/components/` (~20 files: `Header.tsx`, `FilterBar.tsx`, `CommandBar.tsx`, `GuideOverlay.tsx`, `StatsStrip.tsx`, `ReadingsTable.tsx`, `UploadPage.tsx`, `OverlayToggle.tsx`, `OverlayEventsList.tsx`, `AddRecordPage.tsx`, plus `components/charts/*` and `components/records/*`) — every one of these consumes today's tokens via Tailwind utility classes and needs to be checked against the D-02/D-03/D-05 changes (accent replacement, added depth) for visual consistency.
- `frontend/src/hooks/useAgentPulse` (referenced from `FilterBar.tsx`/`OverlayToggle.tsx`) — the existing `animate-pulse` motion pattern that D-07 explicitly preserves as-is (the one motion exception, not a precedent to extend).

No external specs/ADRs beyond the above — this project has no dedicated ADR directory; REQUIREMENTS.md and PROJECT.md are the canonical product docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/index.css`'s `@theme`/`:root`/`.dark` block — the direct edit target for D-03 (accent replacement) and D-05 (depth/spacing tokens); every downstream component already consumes `var(--color-accent)` etc., so token-level edits propagate without per-component color literals to hunt down (confirmed: a scan of `components/*.tsx` found no hardcoded hex colors, only Tailwind utility classes and `var(--...)` references).
- `.chart-band` CSS class and the `--band-opacity` token — existing mechanism for a themed opacity value that isn't achievable via a static Tailwind class; template if D-05's depth work needs a similar theme-aware value (e.g. a themed shadow color/opacity).

### Established Patterns
- All color values are centralized in `index.css`; components never hardcode hex — confirmed by codebase scan (`rounded-*`/`shadow-*`/`transition-*`/`animate-*` grep across `components/*.tsx` and `components/charts/*.tsx` turned up only Tailwind utility classes, no inline color literals). This makes D-01's "evolve via tokens" approach directly executable without a component-by-component color hunt.
- `rounded-lg` is the current de facto corner-radius baseline (used consistently across `StatsStrip.tsx`, `UploadPage.tsx`, `ReadingsTable.tsx`, `OverlayToggle.tsx`, `ChartTooltip.tsx`); `shadow-lg` currently appears in exactly one place (`ChartTooltip.tsx`) — D-05's "add depth" decision is a genuine expansion of an underused pattern, not a reversal of an existing one.
- `animate-pulse` is used in exactly two places today (`StatsStrip.tsx` loading skeleton, `OverlayToggle.tsx`/`FilterBar.tsx` agent-pulse-flash via `useAgentPulse`) — confirms D-07's premise that there's no existing hover/transition layer to build on or worry about breaking.

### Integration Points
- `frontend/src/index.css` is the single integration point for D-02/D-03/D-05's token changes — light + dark values for a new accent hue, plus any new depth/spacing tokens, get added/changed here once and apply sitewide.
- Every component under `frontend/src/components/` (and `components/charts/`, `components/records/`) is a verification point for D-01/D-05 — after the token/spacing changes land, each needs a pass to confirm layout still holds at the new spacing/radius/shadow values and that ≥48px targets and contrast ratios still pass.

</code_context>

<specifics>
## Specific Ideas

No specific visual reference (mood board, competitor site) was named — the direction is fully specified by the decisions above: evolve the existing airy-nautical/night-sea system, add one new warm accent color that replaces navy sitewide, add surface depth (shadows/elevation/larger radius), keep the single accessible font, keep motion as-is.

</specifics>

<deferred>
## Deferred Ideas

- A second display font for headings — considered and explicitly rejected during this discussion (D-06) in favor of keeping Atkinson Hyperlegible as the only font.
- A general hover/transition micro-interaction layer — considered and explicitly rejected during this discussion (D-07); today's `animate-pulse`-only motion stays as the ceiling for this phase.
- A full palette/identity replacement (new color scheme beyond the one accent swap) — considered and explicitly rejected during this discussion (D-01) in favor of evolving the existing token system.
- Editorial-style typographic hierarchy (bigger/bolder heading treatment, magazine-style stat callouts) — considered as an alternate way to express "warm & editorial" and explicitly not chosen (D-02); warmth comes from the new accent color instead.

### Reviewed Todos (not folded)
None — no todos in the project matched Phase 12's scope (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 12-Visual Refresh*
*Context gathered: 2026-08-26*
