# Phase 12: Visual Refresh - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 27 (1 token file, 1 new test, 1 manifest, 24 components)
**Analogs found:** 27 / 27 (this phase is a values-only evolution of an already-consistent codebase — every touched file has a strong same-repo analog; several files literally are their own best analog since D-01 forbids restructuring them)

This phase is unusual for pattern-mapping: there is no "new feature" shape to borrow — it's a token/utility-class edit applied uniformly across an already-internally-consistent component set. Accordingly this map is organized around **4 pattern groups** (token source-of-truth, card/panel depth, accent-consuming controls, third-party widget bridging) plus one **type-scale formalization** pattern, each with one canonical analog to copy from. The File Classification table maps every touched file to its group.

## File Classification

| New/Modified File | Role | Data Flow | Pattern Group | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `frontend/src/index.css` | config (design tokens) | transform (CSS custom properties → Tailwind utilities at build time) | Token source-of-truth | itself — `--band-opacity` block (lines 42, 72) | exact (self-precedent) |
| `frontend/package.json` | config (manifest) | — | devDependency addition | `devDependencies` block (existing) | exact |
| `frontend/src/tests/contrast.test.ts` (NEW) | test | pure-math (no DOM) | Contrast regression test | `frontend/src/lib/palette.test.ts` | exact |
| `frontend/src/components/StatsStrip.tsx` | component (presentational tile) | display | Card/panel depth | itself (RESEARCH.md's own before/after example, line 35) | exact |
| `frontend/src/components/charts/ChartTooltip.tsx` | component (presentational overlay) | display | Card/panel depth | itself — only existing `shadow-lg` precedent (line 71) | exact |
| `frontend/src/components/EmptyState.tsx` | component (presentational) | display | Card/panel depth + type-scale (h2) | `StatsStrip.tsx` (depth) / itself line 49 (`text-2xl` → `text-h2`) | role-match |
| `frontend/src/components/ReadingsTable.tsx` | component (presentational + CTA) | display | Card/panel depth + accent button | `StatsStrip.tsx` (card) / `EmptyState.tsx` (button) | role-match |
| `frontend/src/components/OverlayEventsList.tsx` | component (presentational + CTA) | display | Card/panel depth + accent button | `StatsStrip.tsx` / `EmptyState.tsx` | role-match |
| `frontend/src/components/ChartDeck.tsx` | component (page-section container) | display | Card/panel depth + type-scale (h2) | `StatsStrip.tsx` / `EmptyState.tsx` line 49 | role-match |
| `frontend/src/components/FilterBar.tsx` | component (interactive control group) | event-driven (aria-pressed toggle group) | Accent-consuming controls | itself — `activeClass`/`inactiveClass` (lines 25-28) | exact |
| `frontend/src/components/OverlayToggle.tsx` | component (interactive control group) | event-driven | Accent-consuming controls | `FilterBar.tsx` (same author pattern, line 27-30) | exact |
| `frontend/src/components/Header.tsx` | component (page chrome, toggles + h1) | event-driven + display | Accent-consuming controls + type-scale (h1) | `FilterBar.tsx` (buttons, lines 107/114) / itself line 163 (`text-[32px]` → `text-h1`) | exact |
| `frontend/src/components/CommandBar.tsx` | component (interactive input + submit) | event-driven | Accent-consuming controls | `FilterBar.tsx` / `LoginGate.tsx` submit button | role-match |
| `frontend/src/components/GuideOverlay.tsx` | component (modal-like panel) | display + event-driven | Card/panel depth + accent-consuming controls | `Header.tsx` popover pattern (lines 91-114) | role-match |
| `frontend/src/components/UploadPage.tsx` | component (page, form + CTA) | event-driven | Accent-consuming controls + card depth | `AddRecordPage.tsx` (CTA) / `StatsStrip.tsx` (card) | role-match |
| `frontend/src/components/AddRecordPage.tsx` | component (page, form + CTA) | event-driven | Accent-consuming controls | itself — `activeClass`/`SUBMIT_LABEL` button (lines 55-57, 189-190) | exact |
| `frontend/src/components/LoginGate.tsx` | component (page, form + CTA) | event-driven | Accent-consuming controls | `AddRecordPage.tsx` submit button pattern | role-match |
| `frontend/src/components/AgentStatusBanner.tsx` | component (presentational banner) | display | Card/panel depth (light touch — border-only today) | `UploadPage.tsx` info-box (line 174) | role-match |
| `frontend/src/components/DateRangePicker.tsx` | component (third-party wrapper) | event-driven | Third-party widget bridging | itself — `rdpSizing` bridge object (lines 21-28) | exact |
| `frontend/src/components/records/SingleDateField.tsx` | component (form field, likely wraps DayPicker) | event-driven | Third-party widget bridging + form input | `DateRangePicker.tsx` | role-match |
| `frontend/src/components/records/LabFields.tsx` | component (form fields) | event-driven | Form input styling | `DateRangePicker.tsx` `inputClass` (line 57-58) | exact |
| `frontend/src/components/records/IncidentFields.tsx` | component (form fields) | event-driven | Form input styling | `DateRangePicker.tsx` `inputClass` | exact |
| `frontend/src/components/records/ProcedureFields.tsx` | component (form fields) | event-driven | Form input styling | `DateRangePicker.tsx` `inputClass` | exact |
| `frontend/src/components/charts/BPTimeline.tsx` | component (chart, SVG) | display | Untouched-token precedent (bands EXEMPT) | itself — `bandLabel` comment (lines 45-47) | exact (precedent to preserve, not a depth target) |
| `frontend/src/components/charts/AmPmComparison.tsx` | component (chart, SVG) | display | No card wrapper found — chart body only | `BPTimeline.tsx` (band-exemption precedent applies if it shares bands) | partial |
| `frontend/src/components/charts/CategoryBars.tsx` | component (chart, SVG) | display | No card wrapper found — chart body only | `BPTimeline.tsx` | partial |
| `frontend/src/components/charts/PulseTrend.tsx` | component (chart, SVG) | display | No card wrapper found — chart body only | `BPTimeline.tsx` / `ChartTooltip.tsx` | partial |

## Pattern Assignments

### Group 1 — Token source-of-truth: `frontend/src/index.css`

**Analog:** itself (the file being edited) — the existing `--band-opacity` per-theme custom property is the established mechanism for "a themed value with no static Tailwind equivalent," which is exactly what `--shadow-elevation` needs.

**Existing theme-aware custom-property pattern to mirror** (`frontend/src/index.css` lines 21-79, `--band-opacity` at 42/72, plus the `.chart-band` consumer at 101-103):
```css
:root {
  --band-opacity: 0.10;
}
.dark {
  --band-opacity: 0.14;
}
/* ... */
.chart-band {
  fill-opacity: var(--band-opacity);
}
```

**Exact new values to add, per UI-SPEC.md §Elevation and §Color (these supersede RESEARCH.md's draft hex — UI-SPEC is the locked contract):**
```css
@theme {
  --text-base: 1.125rem;              /* existing — DO NOT touch, ACC-01 floor */
  --text-control: 1.25rem;             /* NEW — 20px */
  --text-control--font-weight: 700;
  --text-control--line-height: 1.25;
  --text-h2: 1.5rem;                   /* NEW — 24px */
  --text-h2--font-weight: 700;
  --text-h2--line-height: 1.25;
  --text-h1: 2rem;                     /* NEW — 32px */
  --text-h1--font-weight: 700;
  --text-h1--line-height: 1.25;
}

:root {
  --color-accent: #B94927;        /* was #14213D */
  --color-accent-text: #FFFFFF;    /* unchanged */
  --shadow-elevation: 0 4px 10px -2px rgba(20, 33, 61, 0.12),
                       0 2px 4px -2px rgba(20, 33, 61, 0.08);
}
.dark {
  --color-accent: #DA6F4E;        /* was #8FC1D4 */
  --color-accent-text: #0B1626;    /* unchanged */
  --shadow-elevation: 0 4px 10px -2px rgba(0, 0, 0, 0.5),
                       0 0 0 1px rgba(232, 241, 239, 0.06);
}
```

**Hard exclusion list (verify diff does NOT touch these — D-04/Pitfall 2):** `--color-focus`, `--cat-hypotension` through `--cat-crisis`, `--band-opacity`, `--cat-chip-text`, `--overlay-labs`/`--overlay-incidents`/`--overlay-procedures`, `--overlay-chip-text`, `--line-systolic`/`--line-diastolic`, `--ref-bradycardia`.

---

### Group 2 — Card/panel depth (rounded-lg → rounded-xl + shadow)

**Analog A:** `frontend/src/components/StatsStrip.tsx` (lines 35, 52, 90, 103) — the exact "flat `rounded-lg` card, no shadow" shape that D-05 targets, cited verbatim in RESEARCH.md's own before/after.

**Current pattern** (`StatsStrip.tsx` line 35):
```tsx
<div className="rounded-lg bg-[var(--color-sky)] p-6">
```

**Target pattern (D-05 applied):**
```tsx
<div className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
```
Apply the same `rounded-lg`→`rounded-xl` + `shadow-[var(--shadow-elevation)]` addition to every card/panel/list-container surface: `StatsStrip.tsx` (4 occurrences: tile, skeleton tile, readings tile, category chip row uses `rounded-lg` too but is a chip not a panel — see Group 3 note), `EmptyState.tsx` (line 45), `ReadingsTable.tsx` (line 59), `OverlayEventsList.tsx` (line 121), `ChartDeck.tsx` chart-selector cards (line 158), `UploadPage.tsx` panels (lines 126, 145, 174), `AddRecordPage.tsx` info/error boxes (lines 200, 213), `LoginGate.tsx` card (line 52), `Header.tsx` guide popover (line 91), `GuideOverlay.tsx` panels (lines 126, 175), `AgentStatusBanner.tsx` banner (line 39).

**Analog B (existing shadow precedent):** `frontend/src/components/charts/ChartTooltip.tsx` line 71 — the ONLY place `shadow-lg` exists today:
```tsx
className="flex flex-col gap-2 rounded-lg p-4 shadow-lg"
```
Replace the static `shadow-lg` with the new theme-aware token so this component joins the same mechanism as everything else rather than keeping a one-off static shadow: `rounded-xl p-4 shadow-[var(--shadow-elevation)]`.

**What NOT to touch in this group:** buttons/pills/toggle controls sized by `min-h-12`/`min-w-12` — those get accent-color changes (Group 3) and MAY also get the `rounded-xl` radius bump per D-05's "slightly larger corner radius" language, but their `min-h-12`/`min-w-12` height/width classes are a hard floor (Pitfall 4) — never remove or shrink them when bumping radius.

---

### Group 3 — Accent-consuming interactive controls (buttons, toggles, chips)

**Analog:** `frontend/src/components/FilterBar.tsx` lines 25-28 — the canonical `inactiveClass`/`activeClass` string-constant pattern used by nearly every toggle group in the app; `OverlayToggle.tsx` lines 27-30 is the same author pattern applied to a second control group, confirming this is the established convention, not a one-off.

**Core pattern to copy** (`FilterBar.tsx` lines 25-28, consumed at lines 111, 121, 139):
```tsx
const inactiveClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";
```
```tsx
<button
  type="button"
  aria-pressed={datePreset === key}
  onClick={() => setDatePreset(key)}
  className={datePreset === key ? activeClass : inactiveClass}
>
  {label}
</button>
```
No className string literal changes are needed here beyond the optional `rounded-lg`→`rounded-xl` swap (Group 2) — `var(--color-accent)` already resolves to the new hex automatically once `index.css` changes (Group 1). **This is the key mechanical insight for this whole pattern group: zero per-component color-literal edits required**, confirmed by RESEARCH.md's codebase scan (no hardcoded hex in any component).

**Non-color-only encoding to preserve (canonical_refs, phases 09-11 convention):** every active-state control pairs the accent fill with `aria-pressed` (boolean) AND a text label or icon — never color alone. Confirmed present in `FilterBar.tsx` (aria-pressed + label), `OverlayToggle.tsx` (aria-pressed + Icon + label, lines 75, 88-89). Do not remove these when editing className strings.

**Same pattern, single-instance form:** `AddRecordPage.tsx` lines 55-57 (`activeClass`/`inactiveClass` for record-type selector), `EmptyState.tsx` line 58 (single accent CTA, no toggle state), `ReadingsTable.tsx` line 99, `OverlayEventsList.tsx` line 155, `Header.tsx` lines 107/114 (toggle pair), `LoginGate.tsx` line 111, `UploadPage.tsx` line 101, `CommandBar.tsx` line 277 — all consume `var(--color-accent)`/`var(--color-accent-text)` via className string literals and need no color-value edits, only the optional radius bump.

---

### Group 4 — Third-party widget bridging (react-day-picker)

**Analog:** `frontend/src/components/DateRangePicker.tsx` lines 21-28 — the only existing example of bridging this app's tokens into a third-party stylesheet's own CSS custom-property surface.

**Pattern to preserve as-is (accent bridge already auto-updates):**
```tsx
const rdpSizing = {
  "--rdp-day-width": "48px",
  "--rdp-day-height": "48px",
  "--rdp-day_button-width": "48px",
  "--rdp-day_button-height": "48px",
  "--rdp-accent-color": "var(--color-accent)",
  "--rdp-accent-background-color": "var(--color-sky)",
} as React.CSSProperties;
```
**Per UI-SPEC.md's explicit scope decision:** do NOT add new `--rdp-*` radius/shadow bridge variables this phase — the calendar's day-cell/month-nav chrome stays visually distinct (intentional, documented exception, not an oversight). Only the accent color updates automatically through the existing bridge above. If `components/records/SingleDateField.tsx` uses the same `DayPicker`/`rdpSizing`-style bridge, apply the identical "leave radius/shadow alone" rule there.

**Plain text-input styling in the same file** (`DateRangePicker.tsx` line 57-58) — analog for all four `components/records/*Fields.tsx` input styling:
```tsx
const inputClass =
  "min-h-12 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";
```
Confirmed byte-identical in `IncidentFields.tsx` line 27, `LabFields.tsx` line 22, `ProcedureFields.tsx` line 19, `SingleDateField.tsx` line 30 — apply the same optional `rounded-lg`→`rounded-xl` swap uniformly across all four.

---

### Group 5 — Type-scale formalization (no rendered-size change)

**Analog:** `frontend/src/components/Header.tsx` line 163 (`text-[32px]` app title → `--text-h1`), `frontend/src/components/EmptyState.tsx` line 49 and `ChartDeck.tsx` line 140 (`text-2xl` section heading → `--text-h2`), `frontend/src/components/FilterBar.tsx`/`OverlayToggle.tsx` (`text-[20px]` control/label → `--text-control`).

**Current (arbitrary/named mix):**
```tsx
// Header.tsx:163
<h1 className="text-[32px] font-bold leading-tight text-[var(--color-ink)]">
// EmptyState.tsx:49
<h2 className="text-2xl leading-tight font-bold">
// FilterBar.tsx:26 (embedded in activeClass/inactiveClass string)
"... text-[20px] font-bold ..."
```
**After (named token, same rendered size — verify no visual diff):**
```tsx
<h1 className="text-h1 leading-tight text-[var(--color-ink)]">
<h2 className="text-h2 leading-tight">
"... text-control ..."
```
This is purely a find-and-replace of class-name spelling once the `--text-h1`/`--text-h2`/`--text-control` tokens exist in `index.css` (Group 1) — Tailwind v4's `@theme` directive auto-generates the matching utility classes (`text-h1`, `text-h2`, `text-control`) from the `--text-*` custom properties [confirmed: RESEARCH.md, tailwindcss.com/docs/font-size]. Do not touch `text-[18px]`/`text-lg`/`text-base` occurrences that map to the existing, unchanged `--text-base` (18px body floor) — only the three NEW named sizes are in scope, and CONTEXT.md's discretion note leaves it acceptable to do this formalization gradually or skip it component-by-component if time-constrained, since it changes no rendered size either way.

---

### `frontend/src/tests/contrast.test.ts` (NEW)

**Analog:** `frontend/src/lib/palette.test.ts` (full file, 35 lines) — the established "pure token-math, no DOM/render" test pattern in this codebase; confirms the project's convention of `describe`/`it` blocks asserting directly on exported string/hex values with no `render()`/`screen` calls for this class of test.

**Pattern to mirror** (`palette.test.ts` lines 1-4, 19-29):
```ts
import { describe, expect, it } from "vitest";

import { CHIP_TEXT, CLINICAL_ORDER, categoryColor } from "./palette";

describe("categoryColor", () => {
  it("returns a var(--cat-...) string for every canonical label", () => {
    for (const cat of CLINICAL_ORDER) {
      expect(categoryColor(cat)).toMatch(/^var\(--cat-[a-z0-9]+\)$/);
    }
  });
});
```
**Applied to the new file** (values from UI-SPEC.md §Color, the locked hex — not RESEARCH.md's superseded draft):
```ts
import { hex } from "wcag-contrast";
import { describe, expect, it } from "vitest";

const LIGHT = { foam: "#F2F7F5", sky: "#E2EDF2", accent: "#B94927", accentText: "#FFFFFF" };
const DARK  = { foam: "#0B1626", sky: "#13233A", accent: "#DA6F4E", accentText: "#0B1626" };

describe("light theme — accent contrast floors", () => {
  it("accent-text on accent bg meets 4.5:1 (AA normal text)", () => {
    expect(hex(LIGHT.accentText, LIGHT.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it("accent as border/ring meets 3:1 against foam (non-text UI, 1.4.11)", () => {
    expect(hex(LIGHT.accent, LIGHT.foam)).toBeGreaterThanOrEqual(3);
  });
});
// mirror describe("dark theme — accent contrast floors", ...) with DARK
```
Confirmed no such package exists yet: `grep wcag-contrast frontend/package.json` → no match. Add via `cd frontend && npm install --save-dev wcag-contrast` before writing the test (RESEARCH.md Standard Stack, Wave 0 gap).

---

### `frontend/package.json`

**Analog:** the file's own existing `devDependencies` block (lines 17-29) — `wcag-contrast` slots in alphabetically alongside `@testing-library/jest-dom`, `jsdom`, `vitest`, etc. No structural pattern change needed, just one new line: `"wcag-contrast": "^3.0.0"`.

---

## Shared Patterns

### Accent token consumption (applies to nearly all 24 components)
**Source:** `frontend/src/index.css` `:root`/`.dark` blocks + `var(--color-accent)`/`var(--color-accent-text)` references already present in every consuming component.
**Apply to:** every file in Groups 2-4 above.
```css
/* index.css — the ONE place the hex values change */
:root { --color-accent: #B94927; --color-accent-text: #FFFFFF; }
.dark { --color-accent: #DA6F4E; --color-accent-text: #0B1626; }
```
No component-level edits are needed for the color change itself — only for the radius/shadow/type-scale utility-class edits layered on top (Groups 2, 5).

### `min-h-12`/`min-w-12` accessibility floor (67 + 5 occurrences codebase-wide)
**Source:** ubiquitous across all interactive elements — e.g. `FilterBar.tsx` line 26, `OverlayToggle.tsx` line 28, `ChartTooltip.tsx` line 101, `DateRangePicker.tsx` line 58/114.
**Apply to:** every interactive-control edit in Groups 2-4 — never remove, shrink, or replace these classes when adjusting `rounded-*`/`shadow-*` in the same className string (RESEARCH.md Pitfall 4, UI-SPEC.md Verification Checklist item 4).

### `--band-opacity`-style theme-aware custom property
**Source:** `frontend/src/index.css` lines 42/72 (`--band-opacity`) + lines 101-103 (`.chart-band` consumer rule).
**Apply to:** the new `--shadow-elevation` token (Group 1) — same mechanism, different value, because Tailwind has no built-in per-theme shadow/opacity utility.

### Non-color-only state encoding (aria-pressed + label/icon)
**Source:** `FilterBar.tsx` (every toggle button), `OverlayToggle.tsx` line 75/88-89 (aria-pressed + lucide `Icon` + text label).
**Apply to:** verify every accent-consuming toggle in Group 3 keeps its `aria-pressed` attribute and text/icon pairing untouched — the accent color swap must not become the only signal of active state (it already isn't, per this existing convention; just don't regress it while editing className strings).

## No Analog Found

None. Every touched file has at least a role-match analog in the same repo, per the "no re-derivation from scratch" boundary D-01 establishes — this is expected for a phase whose entire premise is evolving (not replacing) an already-cohesive system.

The one item with residual uncertainty is not a missing analog but an open verification question already flagged in RESEARCH.md/UI-SPEC.md: whether `frontend/src/components/charts/AmPmComparison.tsx`, `CategoryBars.tsx`, and `PulseTrend.tsx` wrap their chart bodies in a `rounded-lg`/card container elsewhere (e.g. via a shared parent in `ChartDeck.tsx`) or render edge-to-edge with no card chrome of their own — a `grep rounded-lg` inside each returned no hits, meaning either they truly have no card wrapper (nothing to bump in Group 2 for these three files specifically) or their container lives in `ChartDeck.tsx` (already covered). Planner should do a quick `Read` of these three files at plan time to confirm before writing per-file tasks; treat them as **chart-body-only, no card-depth changes needed**, pending that check.

## Metadata

**Analog search scope:** `frontend/src/index.css`, `frontend/src/lib/palette.ts`+`.test.ts`, `frontend/src/tests/setup.ts`, all 20 files under `frontend/src/components/` (+ `charts/`, `records/` subdirs), `frontend/package.json`.
**Files scanned:** 27 target files + 6 additional analog-only reads (`palette.ts`, `palette.test.ts`, `tests/setup.ts`) = 33 files read or grepped this session.
**Pattern extraction date:** 2026-08-26
