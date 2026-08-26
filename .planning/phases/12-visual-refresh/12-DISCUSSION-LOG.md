# Phase 12: Visual Refresh - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 12-Visual Refresh
**Areas discussed:** Refresh intensity, Aesthetic direction (warmth/accent role/depth), Typography, Motion

---

## Refresh Intensity

| Option | Description | Selected |
|--------|-------------|----------|
| Evolve existing system | Keep the airy-nautical/night-sea palette identity; refine spacing, type scale, depth, and polish. Lower risk to existing WCAG-contrast-computed tokens. | ✓ |
| New visual identity | Replace the palette/theme with a different look; every contrast-computed token pair redone from scratch. | |
| You decide | Claude picks based on what "modern" typically means for a legibility-first health dashboard. | |

**User's choice:** Evolve existing system
**Notes:** None beyond the selection.

---

## Aesthetic Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Soft & elevated | Generous whitespace, soft shadows/depth, rounded surfaces, calm "modern SaaS dashboard" look. | |
| Crisp & high-contrast | Flatter surfaces, bolder borders, minimal shadow, more geometric/clinical. | |
| Warm & editorial | Softer typographic hierarchy, more color/personality, less "dashboard-y." | ✓ |
| You decide | Claude proposes a direction with rationale. | |

**User's choice:** Warm & editorial
**Notes:** This selection was in tension with "Evolve existing system" (which implies keeping the palette identity), so a follow-up question resolved where the warmth actually shows up.

---

## Where Warmth Shows Up

| Option | Description | Selected |
|--------|-------------|----------|
| New warm accent color | A new accent hue (coral/amber-family) layered on today's navy/teal tokens; clinical category colors untouched. | ✓ |
| Typographic personality | Bigger/bolder heading weights, editorial-style stat callouts; palette unchanged. | |
| Both | New accent color + stronger typographic hierarchy. | |
| You decide | Claude proposes a specific direction inside the evolve-not-replace envelope. | |

**User's choice:** New warm accent color
**Notes:** Typographic-personality route was explicitly not chosen — see Typography below.

---

## Accent Role

| Option | Description | Selected |
|--------|-------------|----------|
| Replace --color-accent | The warm hue becomes the one reserved-fill color everywhere navy is today (primary buttons, active toggle fills, active filter chips). | ✓ |
| Add as a second, sparing token | Navy stays primary; new warm token used only for a few specific emphasis moments. | |
| You decide | Claude proposes based on what gives the clearest "modernized" result. | |

**User's choice:** Replace --color-accent
**Notes:** None beyond the selection.

---

## Depth (spacing/shadows/corner-radius)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add depth | Cards/panels get soft shadows/elevation, more breathing room, slightly larger corner radius than today's rounded-lg. | ✓ |
| Keep flat, just tune spacing | No new shadows/elevation; only spacing rhythm changes. | |
| You decide | Claude proposes specific values during planning. | |

**User's choice:** Yes, add depth
**Notes:** None beyond the selection.

---

## Typography

| Option | Description | Selected |
|--------|-------------|----------|
| Single font everywhere (Recommended) | Atkinson Hyperlegible stays the only font, body and headings. | ✓ |
| Add a second display font | Headings/titles get a distinct display font; body stays Atkinson Hyperlegible. | |
| You decide | Claude picks based on what best serves a low-vision, legibility-critical audience. | |

**User's choice:** Single font everywhere (Recommended)
**Notes:** None beyond the selection.

---

## Motion

| Option | Description | Selected |
|--------|-------------|----------|
| Stay mostly static (Recommended) | Keep today's animate-pulse-only motion; no general hover-transition layer. | ✓ |
| Add tasteful micro-interactions | Subtle, bounded hover/focus transitions gated behind prefers-reduced-motion. | |
| You decide | Claude picks based on what fits an accessibility-first product. | |

**User's choice:** Stay mostly static (Recommended)
**Notes:** None beyond the selection.

---

## Claude's Discretion

- Exact new warm accent hue and its precise light/dark hex values (must be contrast-recomputed against `--color-foam`/`--color-sky` in both themes)
- Exact spacing-scale and shadow/elevation values, and the precise corner-radius bump from `rounded-lg`
- Exact type-scale refinement within the single-font constraint (heading size/weight steps)
- Whether the refresh touches component markup/structure or stays at the Tailwind-utility/CSS-custom-property level (weighed against existing test-selector coverage: 323 frontend / 260+ backend tests)
- Whether to run an `impeccable` critique pass and/or `/gsd-ui-phase 12` before planning — CLAUDE.md's existing "impeccable + GSD pairing" convention already answers this; not re-litigated in discussion

## Deferred Ideas

- A second display font for headings — explicitly rejected in favor of single-font (Typography decision).
- A general hover/transition micro-interaction layer — explicitly rejected in favor of staying static (Motion decision).
- A full palette/identity replacement beyond the one accent swap — explicitly rejected in favor of evolving the existing system (Refresh Intensity decision).
- Editorial-style typographic hierarchy (bigger/bolder headings, magazine-style stat callouts) as the vehicle for "warm & editorial" — explicitly not chosen in favor of a new accent color (Where Warmth Shows Up decision).
