# Phase 12: Visual Refresh - Research

**Researched:** 2026-08-26
**Domain:** CSS design-token evolution (color, type scale, elevation) in a Tailwind v4 + React 19 + Vite app with a locked accessibility floor
**Confidence:** HIGH (token mechanics, contrast math, Tailwind v4 API) / MEDIUM (exact accent hex — flagged as draft, not locked)

## Summary

This phase has no dedicated stack to "adopt" — it is a values-only evolution of a design-token system that already exists and is already well-factored (`frontend/src/index.css`, `@theme` + `:root`/`.dark` custom properties, zero hardcoded hex in components, only `var(--...)` and Tailwind utility classes). The engineering risk is low: a scan of all 20 `components/*.tsx` files and their `.test.tsx` siblings confirms no test asserts on `className`, `style`, or color values — every test queries by role/text/label (RTL convention), and the full 323-test frontend suite was run live during this research and passes in ~7s. A token-only or Tailwind-utility-only refresh (no markup restructuring) is therefore very low risk to the existing test baseline, which resolves one of CONTEXT.md's open discretion questions in `index.css`'s favor.

The actual work has three token-mechanical parts, all expressible through Tailwind v4's CSS-first `@theme` directive (confirmed against official docs, not assumed from training): (1) replace `--color-accent`/`--color-accent-text` in both `:root` and `.dark` with a new warm hue, contrast-recomputed against `--color-foam` and `--color-sky` in both themes; (2) add a theme-aware `--shadow-elevation` custom property (mirroring the codebase's own existing `--band-opacity` per-theme-var pattern) plus a corner-radius bump from `rounded-lg` (8px) to `rounded-xl` (12px, both are built-in Tailwind v4 scale steps — no custom radius token needed); (3) formalize today's ad-hoc arbitrary-pixel type scale (`text-[18px]`, `text-[20px]`, `text-[32px]`, mixed with named `text-lg`/`text-xl`/`text-2xl`) into named `--text-*` theme tokens, without changing any existing rendered size (the 18px body floor is non-negotiable per `--text-base` and PROJECT.md).

The one genuinely important finding this research surfaces — not visible from CONTEXT.md alone — is a **hue-crowding collision risk**: this app's six clinical BP-category colors (`--cat-hypotension` through `--cat-crisis`) already occupy nearly the entire warm hue range (0°–45°, amber → orange → red) that a "coral/amber/terracotta" accent must also live in, and the overlay dataset colors occupy magenta/violet/olive on either side. A candidate accent computed during this research landed almost exactly on top of `--cat-stage1`'s dark-mode value by pure coincidence, which is documented below with the actual hex comparison as evidence this is a real risk, not a theoretical one, plus a mitigation approach that doesn't require abandoning the "warm" constraint.

**Primary recommendation:** Do the D-02/D-03/D-05/D-06 work entirely in `frontend/src/index.css` plus Tailwind utility class edits in the ~20 consuming components (no markup restructuring), verify contrast with the small, well-established `wcag-contrast` npm package rather than hand-rolling the WCAG luminance formula, and explicitly cross-check the final accent hex against all six `--cat-*` and three `--overlay-*` values (light AND dark) for hue/lightness proximity before locking it — this last check has no existing automated equivalent in the codebase and must be a manual or scripted step in the plan.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** This is an evolution, not a replacement, of the existing token system. The "airy nautical" (light) / "night sea" (dark) identity in `index.css` stays the base — this phase refines it (spacing, type scale, elevation/depth, one accent-color change below), it does not redo the palette from scratch.
- **D-02:** Warmth comes from a new accent color, not from typographic personality. Heading weights/type scale/editorial-style callouts are explicitly NOT part of this phase's scope.
- **D-03:** The new warm accent replaces `--color-accent` (currently navy `#14213D` light / `#8FC1D4` dark) everywhere that token is consumed today — primary buttons, active/pressed toggle fills, active filter chips, and anywhere else `var(--color-accent)`/`var(--color-accent-text)` currently renders. This is a sitewide, one-story accent change, contrast-recomputed for both themes — not a second sparingly-used token layered alongside navy.
- **D-04 (locked, not re-discussed):** The clinical BP/pulse category colors (`--cat-hypotension` through `--cat-crisis`, and the overlay dataset colors `--overlay-labs`/`--overlay-incidents`/`--overlay-procedures`) are untouched by this phase. Those carry medical/data significance (AHA classification, overlay dataset identity), not aesthetic choice.
- **D-05:** Surfaces (cards, panels, chart containers, filter bar) gain more visual depth as part of the refresh — soft shadows/elevation, slightly larger corner radius than today's `rounded-lg` baseline, more breathing room between sections. Reinforces the "evolved, modern" read without touching layout structure, component boundaries, or any accessibility target size.
- **D-06:** Atkinson Hyperlegible stays the only font, body and headings — no second display font. Type-scale/weight refinement within the single font is fine but no new font family.
- **D-07:** No new general hover/transition/micro-interaction layer. Today's only animation — `animate-pulse` for agent-driven filter changes (`useAgentPulse`) and the `StatsStrip` loading skeleton — stays exactly as-is.

### Claude's Discretion

- Exact new warm accent hue (e.g. coral/amber/terracotta family) and its precise hex values for both light and dark themes — must be contrast-recomputed against both `--color-foam`/`--color-sky` (light) and dark equivalents to the same rigor as the existing token pairs, but the specific hue choice is planning's call.
- Exact spacing-scale and shadow/elevation values (D-05) — e.g. a specific shadow recipe, exact corner-radius bump from `rounded-lg` — technical/visual implementation detail, not a locked product decision.
- Exact type-scale refinement within the single-font constraint (D-06) — e.g. heading size/weight steps — implementation detail within the "evolve" envelope.
- Whether the refresh touches component markup/structure or only Tailwind utility classes/CSS custom properties — technical implementation choice; note the codebase has meaningful test coverage (323 frontend / 260+ backend tests per STATE.md) that a structural refactor risks breaking test selectors against.
- Whether to run an `impeccable` critique pass and/or `/gsd-ui-phase 12` (UI-SPEC.md design contract) before planning — not re-litigated here; the operator picks the next command.

### Deferred Ideas (OUT OF SCOPE)

- A second display font for headings (D-06).
- A general hover/transition micro-interaction layer (D-07).
- A full palette/identity replacement beyond the one accent swap (D-01).
- Editorial-style typographic hierarchy (bigger/bolder heading treatment, magazine-style stat callouts) — explicitly not chosen (D-02); warmth comes from the accent color instead.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VISUAL-01 | Modernized theme, typography, spacing, and color applied consistently across all screens | Architecture Patterns section gives the token-level mechanism (`@theme --text-*`/`--shadow-*`/`--radius-*`, `:root`/`.dark` accent replacement) that propagates to all ~20 consuming components without per-component color literals to hunt down (confirmed zero hardcoded hex in components). |
| VISUAL-02 | Existing accessibility floors (≥48px targets, ≥18px body text, high contrast, keyboard nav) preserved or improved, never regressed | Code Examples section gives contrast-verified candidate token values with the exact WCAG math shown; Don't Hand-Roll section recommends `wcag-contrast` for an automated regression test; Common Pitfalls documents the hue-collision risk with clinical colors that a contrast-ratio check alone would miss. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Color tokens (`--color-accent`, `--color-accent-text`) | Browser / Client | — | Pure CSS custom properties compiled by Vite/Tailwind, resolved at paint time by the browser; no server or API involvement. |
| Type scale (`--text-*`) | Browser / Client | — | Same — CSS-only, `@theme` directive resolved at build time into utility classes. |
| Elevation / shadow / radius (`--shadow-elevation`, `rounded-xl`) | Browser / Client | — | Same. |
| Third-party widget theming (`react-day-picker` `--rdp-*` bridge) | Browser / Client | — | Library ships its own base stylesheet (`react-day-picker/style.css`); this app already bridges a subset of its CSS custom properties to the app's own tokens in `DateRangePicker.tsx`/`SingleDateField.tsx` — any new depth/radius token that should extend into the calendar widget needs the same bridging pattern, not a markup change. |
| Contrast/accessibility verification | Dev tooling / Test | Browser / Client (manual visual QA) | Automatable as a pure-math unit test (no DOM/layout needed) using the app's own token hex values; ≥48px target size and ≥18px body floor are structural (Tailwind class presence / `--text-base`), not independently re-derivable from a token change, so they need a lighter-weight verification pass than color contrast. |

**No backend, API, or database involvement in this phase** — confirmed by CONTEXT.md scope (frontend token/CSS/component work only) and by the codebase scan (all touched files are under `frontend/src/`).

## Standard Stack

### Core

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.3.2 [VERIFIED: package.json] | Utility classes + CSS-first `@theme` token system | Already the project's fixed styling approach; v4's `@theme` directive is the mechanism for every token this phase touches (`--color-*`, `--text-*`, `--shadow-*`, `--radius-*` all auto-generate matching utility classes) [CITED: tailwindcss.com/docs/theme, tailwindcss.com/docs/box-shadow, tailwindcss.com/docs/border-radius, tailwindcss.com/docs/font-size — fetched live during this research]. |
| @fontsource/atkinson-hyperlegible | 5.2.8 [VERIFIED: package.json] | Only font family (D-06) | Already locked; no change needed this phase beyond possible weight-step additions within the same family if the font ships multiple static weights (verify at plan time — current `@theme` only references `"Atkinson Hyperlegible"` by name, weight availability depends on which font files the fontsource package loads). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `wcag-contrast` | 3.0.0 [ASSUMED: package name recalled from training knowledge, not sourced from Context7/official docs — see Assumptions Log] | Programmatic WCAG contrast-ratio computation for a token-regression test | Add as a frontend devDependency for a new `src/tests/contrast.test.ts` (or similar) that asserts every accent/ink/focus token pair against its background(s) meets its applicable WCAG threshold — replaces hand-rolling the relative-luminance formula in test code, which this research had to do manually (shown in Code Examples) precisely because no such check exists yet. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `wcag-contrast` (pure JS, no deps beyond itself) | `colorjs.io` or `culori` | Both are larger, more general color-manipulation libraries; overkill for "compute a contrast ratio between two known hex pairs." `wcag-contrast` is a ~single-purpose, long-stable (v3.0.0 since 2019, 128k dl/week, MIT, by a known OSS maintainer) implementation of exactly the WCAG 2.x formula. |
| Automated jsdom/RTL pixel-measurement for ≥48px targets | Playwright + `@axe-core/playwright` in a real browser | Real, but heavier infra (no Playwright currently in this repo) than this phase's scope justifies; jsdom has no layout engine so DOM-measured `getBoundingClientRect()` checks would be meaningless anyway. Recommend a static/manual check instead (see Validation Architecture) — introducing an E2E framework is a separate, larger decision outside VISUAL-01/02's scope. |
| New `--radius-card`/custom radius token | Built-in Tailwind v4 `rounded-xl` (0.75rem/12px) utility | Tailwind v4 already ships a `rounded-lg`→`rounded-xl` step at exactly the "slightly larger" increment D-05 asks for (8px→12px) — no custom token needed, just a utility-class swap [CITED: tailwindcss.com/docs/border-radius]. |

**Installation:**
```bash
cd frontend
npm install --save-dev wcag-contrast
```

**Version verification:** Confirmed live via `npm view wcag-contrast version` → `3.0.0` (published 2019-11-05, last major/only stable release since; the WCAG relative-luminance formula it implements is a fixed W3C spec, so staleness is not a correctness concern) and `npm view wcag-contrast repository.url` → `github.com/tmcw/wcag-contrast`. Weekly downloads: 128,721 (`api.npmjs.org/downloads/point/last-week/wcag-contrast`, checked 2026-08-26).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `wcag-contrast` | npm | 7 yrs (v3.0.0, 2019-11-05) | 128,721/wk | github.com/tmcw/wcag-contrast | OK | Approved (tag `[ASSUMED]` per package-name provenance rule — see Assumptions Log) |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

`slopcheck` was available and ran successfully in this environment (`/Library/Frameworks/Python.framework/Versions/3.13/bin/slopcheck scan wcag-contrast --pkg npm --json` → `"status": "OK", "flags": []`). Despite the clean slopcheck verdict and confirmed registry existence, the package-name recommendation itself originated from training knowledge rather than Context7/official docs, so per the provenance rule it is tagged `[ASSUMED]` and listed in the Assumptions Log — the planner should still let this ride without a `checkpoint:human-verify` gate given the corroborating evidence (age, downloads, known maintainer, single-purpose scope), but should not treat the name as blindly authoritative.

## Architecture Patterns

### System Architecture Diagram

```
frontend/src/index.css  (single source of truth — @theme + :root/.dark)
│
│  @theme { --text-base, --font-sans, [NEW] --text-control/--text-h2/--text-h1, [NEW] --shadow-elevation-*, ... }
│  :root  { --color-accent [CHANGED], --color-accent-text [CHANGED], --cat-*, --overlay-* [UNCHANGED] }
│  .dark  { --color-accent [CHANGED], --color-accent-text [CHANGED], --cat-*, --overlay-* [UNCHANGED] }
│
▼ (Vite build-time: Tailwind v4 generates matching utility classes: text-control, shadow-elevation, rounded-xl, etc.)
▼ (Runtime: browser resolves var(--color-accent) etc. per .dark class on <html>, toggled by store/theme.ts)
│
├─→ Tailwind utility classes in ~20 components/*.tsx (bg-[var(--color-accent)], rounded-lg→rounded-xl, add shadow util)
│     e.g. Header.tsx, FilterBar.tsx, CommandBar.tsx, StatsStrip.tsx, ReadingsTable.tsx, UploadPage.tsx, ...
│
├─→ Inline style={{...}} objects that already reference var(--color-accent) directly (no class change needed)
│     ChartTooltip.tsx (background/color), DateRangePicker.tsx + SingleDateField.tsx (--rdp-accent-color bridge)
│
└─→ Third-party widget base CSS (react-day-picker/style.css) — only reads the --rdp-* custom props this app
      already maps; a NEW --rdp-day_button-border-radius-style bridge (or equivalent) would be needed if the
      calendar's corner radius should also visually match the D-05 bump — verify at plan time, not assumed.
```

A reader can trace VISUAL-01 end to end by following the arrows: one CSS file changes, Tailwind's build step turns the new `@theme` values into utility classes, and every consuming component picks up the new values automatically through `var(--...)` references it already has — no component needs new color/size literals invented.

### Recommended Project Structure

No new files or folders required for VISUAL-01/VISUAL-02 beyond the CSS token edits themselves. If the `wcag-contrast` verification test is added:

```
frontend/src/
├── index.css              # all @theme / :root / .dark token edits happen here
├── tests/
│   ├── setup.ts            # existing — unchanged
│   ├── smoke.test.tsx       # existing — unchanged
│   └── contrast.test.ts     # NEW — pure-math token-pair contrast regression test
└── components/...           # ~20 files get className edits only (accent references
                              # already exist; add/adjust rounded-*/shadow-*/gap-*/p-*)
```

### Pattern 1: Theme-aware CSS custom property for a value that can't be a static Tailwind class

**What:** `--band-opacity` already does this — a value that differs between `:root` and `.dark` (0.10 vs 0.14), consumed via a hand-written `.chart-band { fill-opacity: var(--band-opacity); }` CSS rule rather than a Tailwind utility, because Tailwind has no opacity-per-theme utility mechanism.

**When to use for D-05:** The same problem exists for shadows — a single static `shadow-lg` (Tailwind's default fixed black-based shadow) looks fine on the light theme's pale backgrounds but is close to imperceptible on the dark theme's near-black backgrounds (`--color-foam: #0B1626`), per Material Design's documented dark-theme guidance that flat black shadows don't read against dark surfaces and elevation must instead (or additionally) be communicated by making the surface itself lighter/more prominent [CITED: Google Material Design dark theme guide, m2.material.io/design/color/dark-theme.html and codelabs.developers.google.com/codelabs/design-material-darktheme — "a black shadow on a dark background is visually not perceptible... elevated surfaces are colored using overlays, and the more elevated, the stronger and brighter the overlay"]. This app already does half of this by convention — `--color-sky` (card surface) is lighter than `--color-foam` (page bg) in dark mode (`#13233A` vs `#0B1626`) — so the "lighter surface = more elevated" cue already exists; D-05 layers a subtle themed shadow on top of that existing cue rather than relying on shadow alone.

**Example:**
```css
/* Source: pattern mirrors index.css's existing --band-opacity (line 42/72) */
:root {
  --shadow-elevation: 0 4px 10px -2px rgba(20, 33, 61, 0.12),
                       0 2px 4px -2px rgba(20, 33, 61, 0.08);
}
.dark {
  /* Pure black at low opacity still reads faintly against #0B1626/#13233A;
     paired with a 1px lighter hairline to fake a "light catching the edge"
     highlight, which is visible where a black shadow alone would not be. */
  --shadow-elevation: 0 4px 10px -2px rgba(0, 0, 0, 0.5),
                       0 0 0 1px rgba(232, 241, 239, 0.06);
}
```
```tsx
// consuming component — Tailwind v4 arbitrary-value-from-custom-property syntax
<div className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
```

### Pattern 2: Formalize an ad-hoc type scale into named `@theme` tokens without changing rendered sizes

**What:** Today's headings/buttons/labels mix arbitrary bracket values (`text-[18px]`, `text-[20px]`, `text-[32px]`, `text-[2rem]`) with named Tailwind classes (`text-lg`, `text-xl`, `text-2xl`) inconsistently across the same component tree (confirmed by grep: 39× `text-[20px]`, 31× `text-lg`, 19× `text-[18px]`, 17× `text-xl`, 10× `text-2xl`, 3× `text-[32px]`). D-06 permits "type-scale refinement within the single font" but not a redesign of the hierarchy.

**When to use:** Define the de facto sizes already in use as named `--text-*` tokens in `@theme` (Tailwind v4 supports paired `--text-*--line-height`/`--text-*--font-weight` companion variables [CITED: tailwindcss.com/docs/font-size]) so future edits reference `text-control`/`text-h2`/`text-h1` instead of a fifth slightly-different arbitrary pixel value, without changing any currently-rendered size.

**Example:**
```css
@theme {
  --text-base: 1.125rem;              /* existing — 18px body floor, ACC-01 */
  --text-control: 1.25rem;             /* NEW — 20px, today's de facto button/label size */
  --text-control--font-weight: 700;
  --text-h2: 1.5rem;                   /* NEW — 24px, today's text-2xl headings */
  --text-h2--font-weight: 700;
  --text-h1: 2rem;                     /* NEW — 32px, today's Header.tsx h1 */
  --text-h1--font-weight: 700;
}
```

### Anti-Patterns to Avoid

- **Re-deriving the whole palette from a mood board:** D-01 explicitly forbids this — every non-accent, non-depth token stays as-is; changing more than the accent + depth + type-scale-formalization risks silently drifting outside the locked decisions.
- **Touching component markup to "clean up" structure while in the file anyway:** Out of scope per CONTEXT.md's discretion note and the 323-test baseline risk; this phase's low-risk profile depends on staying className/CSS-value-only.
- **Choosing the accent hue by eyeballing it against `--color-foam`/`--color-sky` alone:** Must also be checked against all six `--cat-*` and three `--overlay-*` tokens (see Common Pitfalls) — a contrast-ratio pass against the background is necessary but not sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG relative-luminance / contrast-ratio computation | A hand-written luminance formula inside a test file | `wcag-contrast` npm package (`hex(fg, bg)` or `ratio(rgb1, rgb2)`) | The formula (this research had to apply it manually to produce the candidate values below, shown for transparency) is easy to get subtly wrong (linearization threshold, gamma exponent, rounding) — a maintained single-purpose implementation removes that risk from a test that will gate future token edits too, not just this phase's. |
| Dark-mode elevation via shadow alone | A single non-theme-aware `shadow-lg` applied unconditionally via `dark:` variant tuning per-component | The `--shadow-elevation` custom-property pattern (Pattern 1 above), same mechanism as the existing `--band-opacity` token | Keeps the theme-dependent value in one place (`index.css`) instead of re-deriving `dark:shadow-[...]` overrides in every one of the ~20 components that need depth. |
| Pixel-measuring click targets in tests | A jsdom `getBoundingClientRect()`-based unit test asserting computed size ≥48px | Either a static source-scan (regex/AST for `min-h-12`/`min-w-12` presence on interactive elements) or manual/visual QA | jsdom has no real layout engine; `getBoundingClientRect()` always returns zeros in jsdom, so a size-assertion test would silently always pass regardless of the actual CSS — worse than no test, because it looks like coverage that isn't real. |

**Key insight:** Every "don't hand-roll" item above is really the same lesson — this phase's actual engineering surface is small (one CSS file, one dependency), so the temptation is to write ad-hoc verification code instead of reaching for an existing, focused tool; for a phase whose entire purpose is "prove nothing regressed," that verification code is the part most worth not hand-rolling.

## Common Pitfalls

### Pitfall 1: The "warm accent" hue range collides with the clinical BP-category color ramp

**What goes wrong:** A coral/amber/terracotta accent, chosen only against `--color-foam`/`--color-sky` contrast, can end up visually near-identical to one of the six locked `--cat-*` clinical severity colors, because those colors already span almost the entire warm hue range this phase is asked to add an accent within.

**Why it happens:** Computing the hue (via standard HSL conversion) of the existing clinical ramp shows it already covers 0°–45°: `--cat-elevated` (light `#8F6A00`) ≈ 44.5°, `--cat-stage1` (light `#B34700`) ≈ 23.8°, `--cat-stage2` (light `#B3261E`) ≈ 3.2°, `--cat-crisis` (light `#7F1D1D`) ≈ 0° (desaturated). "Coral" classically sits at ~16°, "terracotta" at ~20–25°, "amber" at ~40–45° — i.e., squarely inside that already-occupied range in both themes. During this research, an initial draft accent candidate (`#B3541E` light) landed at hue ~11° — visually almost the same swatch as `--cat-stage1` light (`#B34700`, hue ~24°, but sharing the same R=179/0xB3 red channel exactly, since both were picked in the same "burnt orange" family). The dark-mode draft candidate was worse: `#E8935A` (hue ~24°) is nearly a duplicate of `--cat-stage1` dark (`#EE9B57`, hue ~27°) — R232/G147/B90 vs R238/G155/B87, a difference most users would not perceive as two different colors side by side.

**How to avoid:** Don't pick the accent hue in isolation. After computing WCAG contrast against `--color-foam`/`--color-sky`, explicitly render (or manually compare hex swatches for) the candidate accent next to all six `--cat-*` and three `--overlay-*` values in both themes, and require a visible difference in lightness and/or saturation, not just a different-sounding color-family name. This codebase's own established convention — every category/overlay indicator already pairs its color with a text label or icon (cited in CONTEXT.md's canonical refs: "non-color-only state-encoding convention") — is the real mitigation for end-user confusion (a large accent-colored *button* with English label text and a small clinical *chip* with a category name are contextually distinguishable even with a similar hue), but that convention does not excuse picking a near-duplicate swatch; it only limits the blast radius if one slips through. Revised candidates that keep meaningfully more lightness/saturation distance from `--cat-stage1` are given in Code Examples below (light `#A3402A`, dark `#D9633F`) — still draft/`[ASSUMED]`, not locked.

**Warning signs:** If the final chosen accent hex, converted to HSL, has a hue within ~10° AND a lightness within ~10 percentage points of any `--cat-*`/`--overlay-*` value in the same theme, treat it as a likely collision and pick a different hue/lightness/saturation combination before locking.

### Pitfall 2: `--color-focus` is a separate, unaffected token — don't accidentally fold it into the accent swap

**What goes wrong:** Because dark mode's *current* `--color-accent` (`#8FC1D4`) happens to equal dark mode's `--color-focus` (`#8FC1D4`) today, it would be easy to assume they're the same token or that changing one should change the other.

**Why it happens:** They're coincidentally identical today, which reads as "the accent IS the focus color" if you're not reading `index.css` closely — but they are two independent custom properties, and D-03 only lists accent-related tokens as in scope.

**How to avoid:** Leave `--color-focus` (`#1D4E89` light / `#8FC1D4` dark) untouched. After the accent swap, focus rings and the new warm accent will visibly diverge for the first time (a blue/cyan focus ring vs. a coral/terracotta accent) — this is a net accessibility improvement, not a regression: it means focus indicators will no longer blend into accent-colored buttons, which was a latent (if minor) risk in the old scheme.

**Warning signs:** A diff to `index.css` that touches `--color-focus` alongside `--color-accent` in the same commit should be treated as scope creep unless explicitly justified.

### Pitfall 3: Third-party widget theming (`react-day-picker`) doesn't inherit new depth tokens automatically

**What goes wrong:** `DateRangePicker.tsx` and `SingleDateField.tsx` import `react-day-picker/style.css` (the library's own base styles) and override only a specific subset of its `--rdp-*` custom properties (`--rdp-day-width/height`, `--rdp-day_button-width/height`, `--rdp-accent-color`, `--rdp-accent-background-color`) — sizing and the accent color, not radius or shadow. A new `--shadow-elevation`/`rounded-xl` sitewide bump will visually skip the calendar widget's own internal chrome (day-cell corners, month-nav buttons) unless the library exposes and this app bridges the equivalent `--rdp-*` variables.

**Why it happens:** The DayPicker's internal styling lives in its own stylesheet, only reachable through its documented custom-property surface, not through this app's Tailwind classes.

**How to avoid:** Either explicitly scope D-05 as "app-owned surfaces only" (cards/panels/chart containers/filter bar, as CONTEXT.md's D-05 text literally lists — the calendar isn't named) and leave the DayPicker's internal chrome as-is, or check react-day-picker v9's documented `--rdp-*` custom-property list for radius/shadow equivalents at plan time and bridge them the same way accent-color already is. This is a scope judgment call for the planner, not something this research locks.

**Warning signs:** A visual QA pass that shows the calendar's day cells with sharp/old corners next to newly-rounded cards elsewhere on the same screen.

### Pitfall 4: Applying the corner-radius bump changes visual size perception, not the actual ≥48px hit target

**What goes wrong:** Increasing `rounded-lg`→`rounded-xl` (8px→12px) on a `min-h-12` (48px) button changes how large the button *looks* at the corners but does not change `min-h-12`'s actual 48px computed height — this is safe, but it's worth stating explicitly so nobody "helpfully" shrinks a button's padding to compensate for a perceived size increase from the larger radius.

**Why it happens:** Rounder corners can make a rectangular button feel visually "softer/smaller" even though the bounding box is unchanged — an easy target for well-intentioned but wrong "let's tighten this up" edits during the pass.

**How to avoid:** Treat `min-h-12`/`min-w-12` (and any numeric height/width utility on interactive elements) as a hard floor untouched by this phase, verified independently of the radius/shadow changes (see Validation Architecture).

**Warning signs:** Any diff that removes or shrinks a `min-h-12`/`min-w-12` class alongside a `rounded-*` change in the same component.

## Code Examples

### Draft accent-token replacement (contrast math shown, hex values NOT locked — see Assumptions Log)

```css
/* Source: WCAG 2.1 relative-luminance formula (§1.4.3/§1.4.11), applied
   manually against this codebase's existing index.css values during
   research — NOT sourced from Context7/an online contrast checker tool.
   Re-verify with `wcag-contrast` (or webaim.org/resources/contrastchecker)
   before locking. */
:root {
  /* was: --color-accent: #14213D; --color-accent-text: #FFFFFF; */
  --color-accent: #A3402A;       /* draft terracotta-red — computed 6.32:1 vs white,
                                     5.84:1 vs --color-foam, 5.30:1 vs --color-sky */
  --color-accent-text: #FFFFFF;   /* unchanged */
}
.dark {
  /* was: --color-accent: #8FC1D4; --color-accent-text: #0B1626; */
  --color-accent: #D9633F;       /* draft — computed 5.02:1 vs --color-accent-text,
                                     4.37:1 vs --color-sky (dark) */
  --color-accent-text: #0B1626;   /* unchanged */
}
```

### `wcag-contrast`-based regression test (Wave 0 gap — file does not exist yet)

```ts
// Source: pattern combining wcag-contrast's documented API (hex(fg,bg) -> ratio)
// with this codebase's own token values from index.css. Illustrative — exact
// import path/API surface should be confirmed against the installed package's
// README once added as a devDependency (v3.0.0 API: exported `hex` and `ratio`
// functions per its GitHub README).
import { hex } from "wcag-contrast";
import { describe, expect, test } from "vitest";

const LIGHT = {
  foam: "#F2F7F5",
  sky: "#E2EDF2",
  accent: "#A3402A",       // update once locked
  accentText: "#FFFFFF",
};

describe("light theme — accent contrast floors", () => {
  test("accent-text on accent bg meets 4.5:1 (AA normal text)", () => {
    expect(hex(LIGHT.accentText, LIGHT.accent)).toBeGreaterThanOrEqual(4.5);
  });
  test("accent as border/ring meets 3:1 against foam (non-text UI, 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.foam)).toBeGreaterThanOrEqual(3);
  });
  test("accent as border/ring meets 3:1 against sky (non-text UI, 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.sky)).toBeGreaterThanOrEqual(3);
  });
});
// mirror for .dark values
```

### Elevation + radius bump on an existing "flat card" component (StatsStrip.tsx pattern)

```tsx
// Before (src/components/StatsStrip.tsx:35 today):
<div className="rounded-lg bg-[var(--color-sky)] p-6">

// After (D-05):
<div className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tailwind `tailwind.config.js` JS-based theme extension | Tailwind v4 CSS-first `@theme` directive in the stylesheet itself | Tailwind v4 (this project is already on 4.3.2) | Already adopted in this codebase — no migration needed, but worth noting explicitly since a lot of pre-2025 Tailwind tutorial content (and possibly training-data intuition) still shows the old `tailwind.config.js` `theme.extend.boxShadow`/`borderRadius` pattern, which does not apply here. All new tokens for this phase go directly into `index.css`'s existing `@theme` block. |

**Deprecated/outdated:** N/A for this phase — no library upgrades, deprecated APIs, or migrations are in scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `wcag-contrast` is the right/standard npm package for this verification need | Standard Stack, Don't Hand-Roll, Code Examples | Low — package name recalled from training data, not Context7/official docs, per the strict provenance rule this must be tagged `[ASSUMED]` even though `npm view` and `slopcheck` both confirm it's a real, clean, long-stable (7yr), well-downloaded (128k/wk) package by a known maintainer (tmcw/Tom MacWright). If the exact export shape (`hex()`/`ratio()`) differs from what's shown in Code Examples, the planner should check the package's actual README/`index.d.ts` after installing rather than trust the illustrative snippet's exact API calls. |
| A2 | Draft accent hex values (`#A3402A` light / `#D9633F` dark) are good final choices | Common Pitfalls (Pitfall 1), Code Examples | Medium — the WCAG contrast math behind them is sound (computed by hand against the documented W3C formula), but the specific hue/saturation/lightness was chosen by this researcher, not validated against a live rendered swatch comparison or with the user. CONTEXT.md explicitly delegates "exact hue" to planning/execution, so these are offered as a starting point that already clears the contrast bar and avoids the worst of the Pitfall-1 collision, not as a locked decision. |
| A3 | Atkinson Hyperlegible's fontsource package ships enough weight variants to support D-06's "weight refinement within the single font" | Standard Stack (Core table) | Low-Medium — if `@fontsource/atkinson-hyperlegible` 5.2.8 only ships regular + bold (not e.g. a semi-bold 600), any type-scale refinement plan that wants an intermediate weight step would need to fall back to browser-synthesized bold (undesirable) or stay at existing weight steps. Not verified in this research session — quick to check via `ls frontend/node_modules/@fontsource/atkinson-hyperlegible/files` at plan time. |

## Open Questions

1. **Should this phase run `/gsd-ui-phase 12` (UI-SPEC.md design contract) and/or an `impeccable` critique pass before `/gsd-plan-phase` proceeds?**
   - What we know: CLAUDE.md's "impeccable + GSD pairing" convention table names exactly this situation ("Formal design contract for a phase" → `/gsd-ui-phase`) as the fit given ROADMAP.md's "UI hint: yes" for Phase 12.
   - What's unclear: Whether the operator wants that extra formal-spec step for what CONTEXT.md frames as a bounded, mostly-mechanical token evolution (not a from-scratch design), or whether this RESEARCH.md's candidate values + pitfalls are sufficient grounding to go straight to `/gsd-plan-phase`.
   - Recommendation: CONTEXT.md explicitly defers this to the operator ("not re-litigated here... the operator picks the next command") — surfacing it here per the phase brief's instruction, not resolving it.

2. **Does the final accent hue need a live rendered side-by-side comparison against the `--cat-*`/`--overlay-*` swatches, beyond the hex/HSL math in this document?**
   - What we know: The math-based collision check (Pitfall 1) is a reliable first filter, and this research already ran it against two draft candidates, rejecting the first pair and refining to a second.
   - What's unclear: Whether hex/HSL proximity alone is a sufficient proxy for "will a real user visually confuse these," or whether an actual rendered-in-browser comparison (e.g., a throwaway HTML swatch page, or the `/gsd-sketch` disposable-mockup path CLAUDE.md describes) is warranted before locking, given Chris is a low-vision-adjacent user per PROJECT.md.
   - Recommendation: Include a lightweight visual swatch-comparison step (even a simple static HTML page with all ~11 color tokens rendered as swatches side by side, in both themes) as a plan task before the accent is locked into `index.css` — cheap insurance given how close the math-based near-miss was.

3. **Does react-day-picker v9 expose `--rdp-*` custom properties for corner-radius/shadow that this app should bridge for D-05 consistency?**
   - What we know: The library's documented pattern (already used here for `--rdp-accent-color`/`--rdp-day-width`) is CSS custom properties, and v9's stylesheet almost certainly has *some* radius-related variable given its day-cell/button chrome.
   - What's unclear: The exact variable name(s) and whether bridging them is worth the extra surface area versus leaving the calendar's internal chrome as an intentionally distinct "third-party widget" visual, which is a defensible and common pattern.
   - Recommendation: Not researched further given low priority relative to VISUAL-01/02's core ask (which names "cards/panels/chart containers/filter bar," not third-party widget internals) — flag for a 5-minute check-in at plan time, not a blocking unknown.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test toolchain | ✓ | v24.14.0 (local; CLAUDE.md targets Node 22 LTS for prod/CI — unaffected by this phase) | — |
| npm | Package install | ✓ | 11.9.0 | — |
| Tailwind CSS / `@tailwindcss/vite` | Token compilation | ✓ | 4.3.2 (already a project dependency) | — |
| Vitest | Test runner | ✓ | 4.1.10 (already a project devDependency); 323 existing tests confirmed passing in ~7s during this research | — |
| `wcag-contrast` | Optional contrast-regression test | ✗ (not yet installed) | — | No fallback needed to *ship* the phase — VISUAL-02 can be verified by the manual WCAG-formula math shown in this document if the package isn't added; but installing it (single, well-vetted, zero-transitive-risk devDependency) is cheap and removes hand-rolled-formula risk from future token edits too. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `wcag-contrast` — install recommended, not required to complete the phase.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `frontend/vite.config.ts` (`test:` block: `environment: 'jsdom'`, `setupFiles: './src/tests/setup.ts'`, `globals: true`) |
| Quick run command | `cd frontend && npx vitest run --reporter=dot` |
| Full suite command | `cd frontend && npx vitest run` (same suite — 323 tests, ~7s; no split needed at this scale) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VISUAL-01 | Modernized theme/type/spacing/color applied consistently across all screens | manual-only (visual/subjective; no existing automated visual-regression tooling in this repo — introducing one, e.g. Playwright screenshot diffing, is out of scope for this phase per its bounded token-evolution framing) | — (manual pass: load each of dashboard/upload/guide/forms in both light and dark theme, confirm new accent/depth/type render and no layout breakage) | N/A |
| VISUAL-02a (contrast) | New accent token pairs meet WCAG thresholds in both themes | unit | `cd frontend && npx vitest run src/tests/contrast.test.ts` | ❌ Wave 0 (file + `wcag-contrast` devDependency both need to be added) |
| VISUAL-02b (target size / body text floor) | `min-h-12`/`min-w-12` and `--text-base` remain untouched | static/manual | No automated command — jsdom cannot measure real layout (see Don't Hand-Roll); recommend a manual diff review confirming no `min-h-12`/`min-w-12`/`--text-base` class or value was removed, OR a lightweight `grep`-based CI/plan-verification step | N/A — no test file; verify via diff review |
| VISUAL-02c (existing test baseline) | No regressions to the 323 existing frontend tests | regression | `cd frontend && npx vitest run` | ✅ (existing suite, confirmed green pre-phase during this research) |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run --reporter=dot` (full suite — cheap enough at ~7s to run every commit, no sampling needed)
- **Per wave merge:** same full-suite command
- **Phase gate:** Full suite green + manual VISUAL-01/VISUAL-02b passes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/tests/contrast.test.ts` — covers VISUAL-02a (new file)
- [ ] `wcag-contrast` devDependency install — `cd frontend && npm install --save-dev wcag-contrast`
- [ ] No fixture/conftest changes needed — the contrast test is pure token-math, no DOM/render setup required

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — `LoginGate.tsx` gets only className/token edits (color/radius/shadow), no logic change. |
| V3 Session Management | No | Unaffected. |
| V4 Access Control | No | Unaffected. |
| V5 Input Validation | No | This phase introduces no new user input handling paths — it is a CSS/design-token change to already-existing form inputs (`AddRecordPage.tsx`, records fields), not a change to what those inputs accept or how they're validated. |
| V6 Cryptography | No | Unaffected. |

### Known Threat Patterns for this stack

No new threat surface is introduced by this phase. It adds exactly one new dependency (`wcag-contrast`, a `devDependency` — not shipped in the production bundle, has no runtime network/filesystem access, and passed both `slopcheck` and registry verification above) and otherwise only changes CSS custom-property values and Tailwind utility class strings in existing, already-reviewed components. No `postinstall` script check was needed since `wcag-contrast` is a devDependency with zero build-time script hooks (verify at install time: `npm view wcag-contrast scripts.postinstall` returns nothing).

## Sources

### Primary (HIGH confidence)
- `frontend/src/index.css` (read in full) — the complete current token system, both themes.
- `frontend/src/store/theme.ts` (read in full) — dark/light toggle mechanism, confirmed unaffected.
- `frontend/src/components/charts/BPTimeline.tsx` (~line 46) — read the documented contrast-exemption precedent in full.
- `frontend/src/components/charts/ChartTooltip.tsx` (read in full) — confirmed the existing `shadow-lg` precedent and inline `style={{ background: "var(--color-accent)" }}` pattern.
- `frontend/src/components/DateRangePicker.tsx` (read in full) — confirmed the `--rdp-*` custom-property bridging pattern for react-day-picker.
- `frontend/package.json`, `frontend/vite.config.ts` — confirmed installed versions and test config, live in this session.
- Live command: `cd frontend && npx vitest run --reporter=dot` — 323/323 tests passed, ~7s, run during this research session (2026-08-26).
- Live command: `npm view wcag-contrast version / repository.url / scripts.postinstall`, `curl api.npmjs.org/downloads/point/last-week/wcag-contrast` — all run during this research session.
- Live command: `/Library/Frameworks/Python.framework/Versions/3.13/bin/slopcheck scan wcag-contrast --pkg npm --json` → `{"status": "OK", "flags": []}`.
- https://tailwindcss.com/docs/box-shadow — fetched live, `--shadow-*` theme-variable convention and default scale.
- https://tailwindcss.com/docs/border-radius — fetched live, `--radius-*` theme-variable convention and default scale (confirmed `rounded-lg`=0.5rem/8px, `rounded-xl`=0.75rem/12px).
- https://tailwindcss.com/docs/font-size — fetched live, `--text-*` theme-variable convention with `--text-*--line-height`/`--font-weight` companion syntax.

### Secondary (MEDIUM confidence)
- Google Material Design dark-theme guidance — https://m2.material.io/design/color/dark-theme.html and https://codelabs.developers.google.com/codelabs/design-material-darktheme (via WebSearch, cross-referenced across multiple result summaries agreeing on "shadows imperceptible on dark backgrounds, elevation via lighter surface overlay instead") — used to justify the theme-aware `--shadow-elevation` pattern, not a Health-Visualizer-specific source but a well-established, widely-cited design-systems principle.
- WCAG 2.1 relative-luminance/contrast-ratio formula — applied by hand against this codebase's actual hex values (shown fully in Code Examples/Common Pitfalls); this is a deterministic application of a fixed public spec, but was not cross-checked against an independent contrast-checker tool in this session (recommended as a follow-up before locking).

### Tertiary (LOW confidence)
- `wcag-contrast` as "the" package to use — recalled from training knowledge, then corroborated (not originated) by registry/slopcheck checks. See Assumptions Log A1.
- Exact draft accent hex values (`#A3402A`/`#D9633F`) — this researcher's own computed candidates, not validated against a live rendered comparison or the user. See Assumptions Log A2.

## Metadata

**Confidence breakdown:**
- Standard stack (Tailwind v4 token mechanics): HIGH — confirmed against official tailwindcss.com docs fetched live in this session, cross-checked against the installed 4.3.2 version in `package.json`.
- Architecture (token-flow diagram, `--band-opacity` precedent extension): HIGH — based on direct reading of `index.css` and all consuming components, not inference.
- Pitfalls (hue-collision finding): HIGH confidence that the collision risk is real (computed directly from the codebase's own locked hex values); MEDIUM confidence that the specific mitigation hex values proposed are the *best* resolution (flagged `[ASSUMED]`, delegated to planning per CONTEXT.md).
- Contrast math: HIGH confidence in the formula's correctness (standard WCAG 2.1 spec, applied consistently); MEDIUM confidence in the absence of a hand-verification error, since no independent tool cross-checked the arithmetic in this session — recommend the `wcag-contrast` test (Wave 0) as the actual gate, not this document's numbers.

**Research date:** 2026-08-26
**Valid until:** ~60 days (stable domain — CSS token mechanics and WCAG formulas don't move fast; re-verify Tailwind version pin if `package.json` changes before this phase executes)
