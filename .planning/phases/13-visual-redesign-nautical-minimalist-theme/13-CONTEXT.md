# Phase 13: Visual Redesign — Nautical Minimalist Theme - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Every screen (dashboard, command bar/filters, manual-entry forms, upload, guide overlay, auth gate) gets an **entirely new visual identity** — not an evolution of the Phase 12 token system, a full replacement of it — while every existing feature, interaction, and the accessibility floor (≥48px targets, ≥18px body text, high contrast, keyboard nav, no drag/hover-only/precision interactions) carries over unchanged.

In scope: the whole visual system (palette, type, spacing, elevation, component language, layout/composition) across every screen and the ~20 components that consume it. This supersedes Phase 12's D-01 ("evolution, not a replacement") — the user explicitly asked to "completely revamp the look" this time, discarding Phase 12's "airy nautical / night sea" token system as the *baseline to build on* while keeping its **motif** (see D-01 below — this is the one thing carried forward, and it's a continuation, not a coincidence).

Out of scope: any change to derived medical-categorization *logic* (BP category boundaries, MAP calculation, AM/PM logic) or its test coverage; any change to backend/API behavior; any change to the tech stack (React/Vite/Recharts/frontend-only phase).

</domain>

<decisions>
## Implementation Decisions

### This is a replacement, not an evolution
- **D-01:** Unlike Phase 12 (which explicitly evolved the existing token system and explicitly rejected "a full palette/identity replacement," see `12-CONTEXT.md` D-01), this phase **replaces** the visual system outright. Treat the current `frontend/src/index.css` token system, DESIGN.md, and every current component's visual treatment as evidence of what the product is (voice-first, accessible, calm) — not as authority over what it becomes. Nothing about the current implementation is precedent to preserve visually; only its *behavior* is.

### The nautical motif carries forward — it's not a new theme, it's a continuation
- **D-02:** The current system already has a nautical undercurrent: color tokens named `--color-foam` and `--color-sky`, a decorative wave-curve SVG divider under the header, and DESIGN.md's own language ("airy nautical" light theme, "night sea" dark theme). The user's ask to "keep the sail boat, ocean, nautical theme" is a request to **carry this motif forward and execute it with far more craft and commitment**, not to introduce an unrelated theme onto a blank product. Read `frontend/src/index.css` and `DESIGN.md` before designing — they're the motif's prior, tentative expression, now being taken seriously.
- **D-03:** The user was explicit: "clean and minimalistic," "not literal or cartoonish" — restrained and premium. No skeuomorphic boats, anchors-as-clip-art, or nautical-themed icon set played for cuteness. The ocean/sailing world should read the way a premium sailing brand or marine-instrument panel reads (materials, palette, composition, precision), not the way a beach-themed children's app reads. If a candidate reads as decorative or twee, it failed this constraint.

### Structural reference the user pointed to
- **D-04:** The user shared a screenshot of a nickelfox.com health-dashboard mockup as a structural reference (not a literal template to copy) and dribbble.com/tags/minimal-dashboard as a genre reference. Notable structural traits worth carrying into direction-generation (not mandates — the assigned/challenger direction process still applies): icon-only sidebar nav rail; small stat cards combining icon + label + a large value + an inline sparkline + a status pill (e.g. "Normal"); one contrasting dark/accent feature panel set against lighter surrounding cards; soft rounded corners (~12–16px); soft diffuse shadows on cards only, flat elsewhere; generous whitespace; clean geometric sans-serif type; muted, restrained accent colors distinguishing data series (not saturated/loud).
- **D-05:** This dashboard's current layout is NOT a sidebar-nav app shell — it's a single-column, full-width-band layout (header → command bar → filter bar → content) with no left rail, because there's no multi-page navigation (one screen, tabs/toggles for guide and upload). A sidebar-rail structure from the reference should not be copied literally if it fights that reality; extract the *materials and card language* (icon+value+sparkline+status-pill stat cards, contrasting feature panel, soft depth) rather than forcing in navigation chrome the product doesn't need. This is exactly the kind of judgment call the direction-generation process (impeccable's new-work flow) should make, not a locked decision — flagged here so planning doesn't treat the reference as a literal wireframe.

### What must not regress
- **D-06 (locked):** Voice-first interaction, all 48px+ targets, all 18px+ body text, high contrast, keyboard navigability, and "no drag/hover-only/precision interactions" are non-negotiable regardless of new visual world — these come from PROJECT.md/CLAUDE.md, not from Phase 12's specific implementation of them, and must be re-verified against whatever new component language this phase produces.
- **D-07 (locked):** State must never be signaled by color alone — every state change pairs with a word and/or icon. This rule must carry into whatever new palette/component system this phase produces.
- **D-08:** The six clinical BP-category colors and the three overlay-dataset colors carry medical/data meaning (AHA classification, dataset identity), not aesthetic choice. Their *specific hex values* are NOT locked by this phase (Phase 12's D-04 lock is about not touching them *during an evolution* — this phase is a full replacement, so they get new values in the new palette), but their **semantic distinctiveness and accessibility** (colorblind-safe separation, ≥4.5:1 contrast on their surfaces, never color-alone) must be preserved or improved, and the *category-to-severity ordering convention* (calmer colors for normal/lower-risk, more alarming for crisis-level) should be respected — this is a UI-SPEC-level decision, not something to improvise per-component.

### Creative freedom
- **D-09:** The user pinned the world (D-01 through D-05 above) and explicitly declined to name further anti-goals ("trust your judgment"). Within that pinned world, full creative latitude on palette specifics, type choice, exact component forms, and composition — this is the intended scope for impeccable's own "Commit the world" step (color strategy, faces, material choices), not something to re-litigate with the user first.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & product context
- `.planning/PROJECT.md` — Core Value (voice-first), Constraints (non-negotiable accessibility floor) — every visual change in this phase must be checked against this list, not just "looks fine."
- `.planning/ROADMAP.md` §Phase 13 — Goal, "UI hint: yes." No REQUIREMENTS.md exists yet this cycle (between milestones) — this CONTEXT.md is the locked-scope source of truth until/unless one is created.
- `CLAUDE.md` §"impeccable + GSD pairing (frontend design work)" — names `/gsd-ui-phase` (producing UI-SPEC.md) as the entry point for "formal design contract for a phase," held to `impeccable`'s bar given the accessibility constraints. Given this phase is an explicit full visual-world replacement, run `/gsd-ui-phase 13` before `/gsd-plan-phase 13` — do not skip straight to planning.
- `.planning/phases/12-visual-refresh/12-CONTEXT.md` and `12-RESEARCH.md` — the immediately prior visual phase; read for what it evolved (and explicitly declined to replace) so this phase's replacement is understood as a deliberate escalation, not duplicate work.

### The current visual system (evidence, not authority — being replaced)
- `frontend/src/index.css` — the full current token system (`@theme`, `:root`/`.dark` custom properties for surfaces/ink/accent/focus/chart-series/clinical-category/overlay colors). Read this first: it's both the thing being replaced and the source of the nautical motif (D-02) to carry forward.
- `DESIGN.md` (repo root, generated by Phase 12's documenter) — full prose description of the current "airy nautical" / "night sea" system: palette, Atkinson Hyperlegible typography, spacing scale, elevation, shapes/radii, component language, do's/don'ts. This becomes the redesign's anti-reference per impeccable's `new-work.md`: everything it documents is a candidate for replacement except the accessibility floor it encodes and the nautical motif it names.
- `frontend/src/store/theme.ts` — the light/dark toggle mechanism (`.dark` class on `<html>`, localStorage-persisted); the mechanism stays, both themes' new token values are designed fresh.

### Precedent to preserve behaviorally (not visually)
- `frontend/src/components/charts/BPTimeline.tsx` (~line 46) — documented accessibility carve-out precedent ("bands are ambient decorative tint, explicitly EXEMPT from the contrast floor") — the pattern to follow if this phase needs to justify a similar exemption in the new design.
- `.planning/phases/09-multi-dataset-overlay-filtering/09-CONTEXT.md`, `10-CONTEXT.md`, `11-CONTEXT.md` — established non-color-only state-encoding convention (word/icon + `aria-pressed`) and the ≥48px/`aria-pressed` pattern; must be preserved in the new component language, not just visually re-skinned.

### Integration surface (read before implementing)
- `frontend/src/components/` (~20 files: `Header.tsx`, `FilterBar.tsx`, `CommandBar.tsx`, `GuideOverlay.tsx`, `StatsStrip.tsx`, `ReadingsTable.tsx`, `UploadPage.tsx`, `OverlayToggle.tsx`, `OverlayEventsList.tsx`, `AddRecordPage.tsx`, plus `components/charts/*` and `components/records/*`) — every one needs its visual treatment fully redone under the new system; none should be skipped as "not worth restyling."
- `frontend/src/hooks/useAgentPulse` — the existing `animate-pulse` agent-driven motion pattern; carry the *function* (visually flagging an agent-driven filter change) into the new system's own motion language, not necessarily the literal `animate-pulse` class.

No external specs/ADRs beyond the above — this project has no dedicated ADR directory; PROJECT.md is the canonical product doc, and this CONTEXT.md is the canonical scope doc for this phase until a v2 REQUIREMENTS.md exists.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable mechanism (not reusable visuals)
- All color values are centralized in `frontend/src/index.css` as CSS custom properties; components consume them via Tailwind utility classes / `var(--...)`, never hardcoded hex (confirmed during Phase 12). This means the *mechanism* for a sitewide visual replacement — edit the token layer, every component picks it up — is already in place and should be reused; only the token *values* and the component-level class usage need to change.
- The light/dark theme toggle (`frontend/src/store/theme.ts`, `.dark` class) is a working, tested mechanism — reuse it; design both themes' full new token sets against it.

### Integration Points
- `frontend/src/index.css` is the single integration point for the new palette/type/spacing/elevation tokens — light + dark values for the whole new system land here once and apply sitewide.
- Every component under `frontend/src/components/` (and `components/charts/`, `components/records/`) is a verification point after the new tokens land — each needs a pass to confirm the new component language holds at every breakpoint and that ≥48px targets / contrast ratios still pass under the new palette.

</code_context>

<specifics>
## Specific Ideas

- Visual reference: a nickelfox.com health-dashboard mockup the user shared (screenshotted during this discussion — see D-04/D-05 for what to take from it and what not to copy literally).
- Genre reference: dribbble.com/tags/minimal-dashboard (browsed during this discussion) — general "minimal dashboard" genre calibration: light neutral grounds, restrained accent color, spacious card composition, small inline charts.
- World: nautical / ocean / sailing, clean and minimalist, premium/restrained rather than literal or playful (D-02, D-03).

</specifics>

<deferred>
## Deferred Ideas

- A sidebar-rail navigation shell copied literally from the structural reference — explicitly flagged as likely wrong for this product's actual single-screen-with-tabs structure (D-05); extract materials/card language instead, not navigation chrome.
- Locking exact palette hex values, specific type family, or exact component forms in this discussion — explicitly left to the direction-generation and "commit the world" steps of the design process (D-09), not decided here.

### Reviewed Todos (not folded)
None reviewed this session — this phase was created directly from a live design discussion, not from `/gsd-progress` todo triage.

</deferred>

---

*Phase: 13-Visual Redesign — Nautical Minimalist Theme*
*Context gathered: 2026-08-29*
