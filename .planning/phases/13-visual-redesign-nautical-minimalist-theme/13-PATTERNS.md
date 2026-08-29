# Phase 13: Visual Redesign — Nautical Minimalist Theme - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 31 (1 token file, 1 entry file, 1 package manifest, ~28 components/subcomponents)
**Analogs found:** 30 / 31 (1 net-new sub-component has no direct analog — see "No Analog Found")

**How to read this map:** Because this phase is a full-palette/token replacement applied through an *already-established* mechanism (CSS custom properties in `index.css`, consumed via Tailwind arbitrary-value classes like `bg-[var(--color-sky)]`), almost every file's closest analog is **itself** — the structural JSX, ARIA contract, and class-composition pattern do not change; only the token names/values and a handful of new radius/shadow/font decisions change. Where a file's *role* is shared by a cleaner sibling example (e.g. all four `records/*Fields.tsx` follow the exact shape of `LabFields.tsx`), that sibling is cited instead of a self-reference.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/index.css` | config (design tokens) | transform | itself (Phase 12's token layer being replaced in place) | exact — mechanism unchanged, values replaced |
| `frontend/package.json` | config (deps) | — | itself (`@fontsource/atkinson-hyperlegible` entry) | exact — same self-hosted-font pattern, new packages |
| `frontend/src/main.tsx` | config (font bootstrap) | — | itself (lines 5-6, current font CSS imports) | exact |
| `frontend/src/components/Header.tsx` | component (nav/header) + dialog | event-driven | itself | exact |
| `frontend/src/components/CommandBar.tsx` | component (feature panel, voice input) | request-response | itself; borrows `customOpen`-style local state from `FilterBar.tsx` (comment at line 27) | exact |
| `frontend/src/components/FilterBar.tsx` | component (filter controls) | event-driven / CRUD-filter | itself; shares `inactiveClass`/pulse pattern with `OverlayToggle.tsx` | exact |
| `frontend/src/components/OverlayToggle.tsx` | component (toggle group) | event-driven | `frontend/src/components/FilterBar.tsx` (explicitly mirrors its `inactiveClass`, pulse effect) | exact |
| `frontend/src/components/GuideOverlay.tsx` | component (non-modal overlay) | event-driven | itself; contrasts with `Header.tsx`'s `LogoutConfirmDialog` (true modal) for the modal-vs-non-modal distinction | exact |
| `frontend/src/components/StatsStrip.tsx` | component (stat cards) | CRUD-read / transform | itself for card shell; new sparkline sub-part has no analog (see below) | role-match (partial — new sub-part) |
| `frontend/src/components/ReadingsTable.tsx` | component (data table/list) | CRUD-read | itself | exact |
| `frontend/src/components/OverlayEventsList.tsx` | component (data table/list) | CRUD-read | `frontend/src/components/ReadingsTable.tsx` (explicitly "directly templated on ReadingsTable.tsx's accessible-table contract," comment line 3-5) | exact |
| `frontend/src/components/UploadPage.tsx` | component (page, file upload) | file-I/O | itself | exact |
| `frontend/src/components/AddRecordPage.tsx` | component (page, form) | CRUD-create | `frontend/src/components/UploadPage.tsx` (page shell: `max-w` container, `bg-[var(--color-foam)]`, `h2` heading) + `records/LabFields.tsx` (field styling) | role-match |
| `frontend/src/components/records/LabFields.tsx` | component (form fieldset) | CRUD-create | itself | exact |
| `frontend/src/components/records/IncidentFields.tsx` | component (form fieldset) | CRUD-create | `frontend/src/components/records/LabFields.tsx` (same `inputClass`/`labelClass` constants, same shape) | exact |
| `frontend/src/components/records/ProcedureFields.tsx` | component (form fieldset) | CRUD-create | `frontend/src/components/records/LabFields.tsx` | exact |
| `frontend/src/components/records/SingleDateField.tsx` | component (form field) | CRUD-create | `frontend/src/components/records/LabFields.tsx` (consumes its `labelClass`/`inputClass` conventions) | exact |
| `frontend/src/components/EmptyState.tsx` | component (empty state / CTA) | transform | itself; also the cited source for `LoginGate.tsx`'s card+button styling (see that file's own header comment) | exact |
| `frontend/src/components/LoginGate.tsx` | component (auth gate) | request-response | itself (comment: "Nautical card + accent button styling copied from EmptyState.tsx") | exact |
| `frontend/src/components/AgentStatusBanner.tsx` | component (status banner) | event-driven | itself; conditional-mount convention reused by `OverlayEventsList.tsx` | exact |
| `frontend/src/components/DateRangePicker.tsx` | component (date input) | CRUD-filter | itself | exact |
| `frontend/src/components/ChartDeck.tsx` | component (chart container/layout) | transform | itself | exact |
| `frontend/src/components/charts/BPTimeline.tsx` | component (chart) | transform | itself | exact |
| `frontend/src/components/charts/PulseTrend.tsx` | component (chart) | transform | `frontend/src/components/charts/BPTimeline.tsx` (comment: "Same time x-axis, click-persistent hero tooltip... as BPTimeline") | exact |
| `frontend/src/components/charts/AmPmComparison.tsx` | component (chart, bar) | transform | `frontend/src/components/charts/CategoryBars.tsx` (both `BarChart`-based) | role-match |
| `frontend/src/components/charts/CategoryBars.tsx` | component (chart, bar) | transform | `frontend/src/components/charts/AmPmComparison.tsx` | role-match |
| `frontend/src/components/charts/ChartTooltip.tsx` | component (tooltip) | transform | itself | exact |
| **NEW:** stat-card sparkline sub-component (UI-SPEC §Component Language item 2 — "new sub-component, not present in the current StatsStrip.tsx") | component (chart, decorative) | transform | `frontend/src/components/charts/PulseTrend.tsx` `mini` variant (closest existing "small, axis-less, decorative-adjacent" Recharts usage) + `BPTimeline.tsx`'s `chart-band`/`aria-hidden` decorative-exemption precedent | role-match — new file, no exact analog |
| `frontend/src/lib/palette.ts` | utility (color lookup) | transform | itself — mechanism (`var(--cat-*)` lookup table) unchanged; category token *names* are not renamed by the UI-SPEC map, only their hex values | exact (values only, no structural change) |
| `frontend/src/App.tsx` | component (layout shell) | transform | itself — the full-width-band + `mx-auto max-w-[1280px]` column structure is explicitly NOT changing this phase (D-05); only surface classes on the bands change | exact |

**Not in scope for restyle (verify only, no analog needed):** `frontend/src/store/theme.ts` (toggle mechanism, unchanged — see Shared Patterns), `frontend/src/lib/copy.ts`, all `*.test.tsx`/`*.test.ts` files (assert ARIA/behavior, not classnames — should not need edits unless a test asserts a literal Tailwind class).

---

## Pattern Assignments

### `frontend/src/index.css` (config, transform)

**Analog:** itself — full in-place replacement of the token layer (mechanism proven in Phase 12, per `13-CONTEXT.md` "Reusable mechanism").

**Current full file** (`frontend/src/index.css`, all 119 lines) — the executor edits this file directly; there is no separate analog to copy from. Key structural pieces to preserve while swapping values:

**`@theme` block** (lines 14-32) — body-floor + named type-scale tokens. UI-SPEC's Typography section requires this shape to gain two new `--font-*` tokens (Inter body, Space Grotesk display) and updated `--text-*` sizes (18/20/24/36 vs. current 18/20/24/32):
```css
@theme {
  --text-base: 1.125rem;
  --font-sans: "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif;
  --text-control: 1.25rem;
  --text-control--font-weight: 700;
  --text-control--line-height: 1.25;
  ...
}
```

**`:root` / `.dark` custom-property pairs** (lines 34-94) — every token the UI-SPEC's "Old token → new token map" table renumbers stays in this exact two-block shape (light in `:root`, dark in `.dark`), same property names for the ones that don't get renamed (`--line-*`, `--cat-*`, `--overlay-*`, `--band-opacity`, `--cat-chip-text`, `--overlay-chip-text`) and new names for the ones the UI-SPEC does rename (`--color-foam`→`--color-deck`, `--color-sky`→`--color-mist`, `--color-ink`→`--color-depth`, `--color-accent`→`--color-brass` (+`-text`), `--color-focus`→`--color-signal`, plus new `--color-hazard` (+`-text`)).

**Focus-visible + band-opacity mechanism** (lines 105-118) — unchanged mechanism, reused verbatim:
```css
:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.chart-band {
  fill-opacity: var(--band-opacity);
}
```
Rename `var(--color-focus)` → `var(--color-signal)` here to match the token map; `.chart-band` rule itself does not change (still resolves the theme-dependent `--band-opacity` var).

**IMPORTANT for the executor:** every component below consumes these tokens via `bg-[var(--color-sky)]`-style Tailwind arbitrary-value classes — a global find/replace of the *token names* (not a rewrite of the class-composition pattern) is the correct-sized change everywhere except `CommandBar.tsx` (gets a genuinely new surface identity per UI-SPEC item 3) and `StatsStrip.tsx` (gets the new sparkline sub-part).

---

### `frontend/src/components/StatsStrip.tsx` (component, CRUD-read/transform)

**Analog:** itself for the card shell; `frontend/src/components/charts/PulseTrend.tsx` (`mini` variant) for the new sparkline sub-part.

**Current card shell** (lines 25-47) — this exact div structure (rounded surface, `shadow-elevation`, `Label`/`Display` type roles) is what UI-SPEC item 2 says to keep, just re-skinned + reordered (icon top-left, then label, then value, then sparkline, then status pill):
```tsx
function VitalTile({ label, vital }: { label: string; vital: VitalStats | null }) {
  return (
    <div className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
      <p className="text-control leading-tight font-bold">{label}</p>
      <p className="text-h1 leading-tight font-bold">
        {vital !== null ? vital.avg : "—"}
      </p>
      <p className="text-lg">
        {vital !== null ? `min ${vital.min} · max ${vital.max}` : "min — · max —"}
      </p>
    </div>
  );
}
```
New shell values per UI-SPEC: `bg-[var(--color-mist)]`, `rounded-[14px]` (the `xl` token), value in `text-display`/Space Grotesk (new token), label in `text-label`/Inter 600 (new token), plus a 24px lucide icon top-left and the sparkline + status pill described below.

**Category chip row** (lines 99-113) — the existing "word + swatch, not color alone" chip pattern to reuse verbatim as the new stat-card's "status pill" (UI-SPEC item 2, 4th bullet: "reuse the existing category-chip mechanism verbatim"):
```tsx
<li className="flex items-center gap-2 rounded-lg bg-[var(--color-sky)] px-4 py-2 text-lg">
  <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor(c.category) }} />
  {c.category} {c.percent}%
</li>
```
For the stat-card status pill this becomes `rounded-full` (the `full` radius token, "reserved for data-bearing chips only" per UI-SPEC), solid category fill + `CHIP_TEXT`, per the existing `categoryColor()`/`CHIP_TEXT` exports in `frontend/src/lib/palette.ts`.

**Sparkline sub-part — no direct analog, build from `PulseTrend.tsx`'s `mini` pattern** (`frontend/src/components/charts/PulseTrend.tsx` lines 41-150): a small (~32-40px tall per UI-SPEC), axis-less, tooltip-less Recharts primitive is exactly what the `variant === "mini"` branch of `PulseTrend` already does — `accessibilityLayer={hero}` (false for mini), `hide={!hero}` on both axes, no `<Tooltip>` mounted when `!hero`. Mirror that gating logic in the new component, but it needs no `hero` branch at all (always the "mini" shape) and must add `aria-hidden="true"` on its wrapping element (UI-SPEC: "ambient, not a second source of truth," matching the `BPTimeline.tsx` decorative-band exemption precedent below).

**Skeleton-loading pattern** (lines 50-58) — unchanged mechanism, just re-themed:
```tsx
function SkeletonTile() {
  return (
    <div className="animate-pulse rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]">
      <div className="h-6 w-24 rounded bg-[var(--color-foam)]" />
      ...
    </div>
  );
}
```

---

### `frontend/src/components/CommandBar.tsx` (component, request-response) — the "contrasting feature panel"

**Analog:** itself, structurally unchanged; UI-SPEC item 3 requires a **new surface identity** here specifically (Depth-toned/dark surface + Brass accent details), unlike every other component which is a straight token find-replace.

**Current outer band** (lines 287-294) — this is the element that gets the contrasting treatment; currently it deliberately has NO background (`bg-transparent`, comment explains why: the sky band comes from `App.tsx`'s wrapper). Per UI-SPEC item 3, this component (or its `App.tsx` wrapper band) should carry the Depth-toned surface instead of inheriting Mist like every other band:
```tsx
<section
  aria-label="Command bar"
  className={`py-4 ${ringClass}`}
>
```
Flag for planner: the dark-panel treatment likely needs to move to `App.tsx`'s CommandBar wrapper div (`bg-[var(--color-sky)]` at App.tsx line ~214, sibling of `<CommandBar>`), not into this component in isolation — check both files together during planning.

**Mic button state-color pattern** (lines 296-316) — the existing "armed vs. off" two-class swap is the template for how any new Depth-surface variant should still express state without color alone (icon + `aria-label` swap already present):
```tsx
className={
  micArmed
    ? "flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-[var(--cat-normal)] bg-[var(--cat-normal)] text-[var(--cat-chip-text)]"
    : "flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] text-[var(--color-ink)]"
}
```

**Working/Cancel + aria-live confirmation region** (lines 335-402) — unchanged mechanism, only token names change; this is the "one announced region, word+icon+color triad, never color alone" pattern (D-07) that must survive the new dark-panel surface with re-verified contrast.

---

### `frontend/src/components/FilterBar.tsx` / `frontend/src/components/OverlayToggle.tsx` (component, event-driven) — shared toggle/aria-pressed pattern

**Analog:** each other (their own code comments cross-reference this).

**Inactive/active class-pair pattern** (`FilterBar.tsx` lines 25-28, `OverlayToggle.tsx` lines 27-30) — the pattern every new toggle-style control in this phase should keep:
```tsx
const inactiveClass =
  "min-h-12 rounded-xl px-4 text-control font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-xl px-4 text-control font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";
```
Per UI-SPEC, `rounded-xl` (currently the "everything" radius) maps to the new `xl` (14px) token unchanged in role; `bg-[var(--color-accent)]` → `bg-[var(--color-brass)]`.

**`aria-pressed` button usage** (`FilterBar.tsx` lines 102-124):
```tsx
<button
  type="button"
  aria-pressed={datePreset === key}
  onClick={() => { setDatePreset(key); setCustomOpen(false); }}
  className={datePreset === key ? activeClass : inactiveClass}
>
  {label}
</button>
```

**Agent-pulse (voice-driven change) visual flag** (`FilterBar.tsx` lines 57-78, `OverlayToggle.tsx` lines 39-50) — the `useAgentPulse` motion pattern named in `13-CONTEXT.md`'s Integration Points as needing to carry its *function* forward:
```tsx
const pulseClass = (field: PulseField) =>
  pulsing.includes(field)
    ? " rounded-lg ring-2 ring-[var(--color-accent)] motion-safe:animate-pulse"
    : "";
```
Re-point `ring-[var(--color-accent)]` → `ring-[var(--color-brass)]`; the `motion-safe:`/static-ring-fallback duality (already handles `prefers-reduced-motion`) is the mechanism to preserve, per CONTEXT's "carry the function... not necessarily the literal class."

**Category chip active-state ring** (`FilterBar.tsx` lines 153-181) — inline-style + `boxShadow` pattern (kept separate from `:focus-visible` so both rings can coexist):
```tsx
style={{
  backgroundColor: categoryColor(cat),
  color: CHIP_TEXT,
  boxShadow: isActive ? "0 0 0 3px var(--color-ink)" : undefined,
}}
```
`var(--color-ink)` → `var(--color-depth)`.

---

### `frontend/src/components/Header.tsx` / `frontend/src/components/GuideOverlay.tsx` (component, event-driven) — dialog patterns

**Analog:** each other, representing the codebase's two dialog archetypes — a true modal (`LogoutConfirmDialog`) vs. a non-modal always-mounted overlay region (`GuideOverlay`). Pick whichever archetype a given new/modified dialog matches.

**True-modal focus trap** (`Header.tsx` lines 39-122) — full pattern: focus the least-destructive control on mount, `Escape` cancels, `Tab`/`Shift+Tab` wrap inside the dialog, backdrop-click-outside-content cancels:
```tsx
function handleKeyDown(event: React.KeyboardEvent) {
  if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
  if (event.key !== "Tab") return;
  const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
  ...
}
```
Dialog surface classes (line 91) to re-skin: `rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-sky)] p-6 text-[var(--color-ink)] shadow-[var(--shadow-elevation)]` → `rounded-[14px] border-2 border-[var(--color-depth)] bg-[var(--color-mist)] ... shadow-[var(--shadow-elevation)]`.

**Header-right utility button styling** (`Header.tsx` lines 174-186, repeated per control) — per UI-SPEC's radius table, these move to `lg` (8px, "Secondary header-chrome controls only"), the one place the new radius scale diverges from the `xl` default:
```tsx
className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]"
```
Note: UI-SPEC explicitly removes the old "exempt from 48px" language for these controls (Spacing Scale section: "no sub-floor carve-out for any header/utility control") — verify `min-h-12` stays on every one, including the previously-exempt view-toggle/log-out buttons at lines 238-277 which currently use `py-2` without `min-h-12`.

**Wave-divider decorative motif** (`Header.tsx` lines 283-293) — the literal nautical carry-forward element named in CONTEXT D-02:
```tsx
<svg aria-hidden="true" className="block h-6 w-full" viewBox="0 0 1440 24" preserveAspectRatio="none">
  <path d="M0 12 C 120 0, 240 24, 360 12 ..." fill="var(--color-sky)" />
</svg>
```
Re-point fill to `var(--color-mist)`; per D-03 keep it as abstract line art (no literalizing into a boat/anchor glyph).

---

### `frontend/src/components/charts/BPTimeline.tsx` (component, transform) — decorative-tint contrast exemption + chart pattern

**Analog:** itself; cited directly by `13-CONTEXT.md` as "the pattern to follow if this phase needs to justify a similar exemption in the new design" (for the new sparkline).

**Decorative band exemption** (comment block, lines 1-24, reinforced by `index.css`'s `.chart-band` rule) — the precedent: category-colored `ReferenceArea` bands render at reduced `fill-opacity` via `--band-opacity` and are explicitly declared exempt from the text-contrast floor because they are ambient/decorative, not a second source of truth:
```tsx
<ReferenceArea
  y1={40} y2={90}
  fill={categoryColor("Hypotension")}
  className="chart-band"
  label={undefined}
/>
```
UI-SPEC directly reuses this exemption for the new sparkline sub-component (StatsStrip item 2) and re-affirms it for the bands themselves ("keep the existing starting values... eyeball-verify legibility against the new palette").

**Hero/mini variant gating** (`BPTimeline.tsx` shared with `PulseTrend.tsx`) — `accessibilityLayer={hero}`, axes `hide={!hero}`, `<Tooltip>` mounted only when `hero` — the shape every chart component in `charts/` already follows and keeps unchanged this phase (only stroke/fill token values change, e.g. `stroke="var(--line-systolic)"` stays the same call site, new hex behind the var).

---

### `frontend/src/components/records/LabFields.tsx` (component, CRUD-create) — form fieldset pattern

**Analog:** itself; `IncidentFields.tsx`, `ProcedureFields.tsx`, `SingleDateField.tsx` all mirror this shape exactly.

**Shared input/label class constants** (lines 21-23):
```tsx
const inputClass =
  "min-h-12 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-foam)] px-3 text-[18px] text-[var(--color-ink)]";
const labelClass = "flex flex-col gap-1 text-control font-bold text-[var(--color-ink)]";
```
Every field in every `records/*Fields.tsx` file composes from these two constants — re-declare with new token names (`--color-depth`, `--color-deck`) once per file (no shared constants file currently exists; the planner should decide whether Phase 13 introduces one, but it is not required — each file already duplicates these two lines independently).

**Fieldset heading pattern** (lines 71-74):
```tsx
<h3 className="flex items-center gap-2 text-[20px] font-bold text-[var(--color-ink)]">
  <FlaskConical aria-hidden="true" size={24} />
  Lab result details
</h3>
```

---

### `frontend/src/components/LoginGate.tsx` / `frontend/src/components/EmptyState.tsx` (component, request-response / transform) — card + accent-CTA pattern

**Analog:** each other (`LoginGate.tsx`'s own header comment: "Nautical card + accent button styling copied from EmptyState.tsx").

**Card shell + accent CTA button** (`EmptyState.tsx` lines 42-62):
```tsx
<section className="flex flex-col items-center gap-4 rounded-xl bg-[var(--color-sky)] p-8 text-center shadow-[var(--shadow-elevation)]">
  <Sailboat aria-hidden="true" className="h-10 w-10" />
  <h2 className="text-h2 leading-tight font-bold">No readings match these filters</h2>
  <p className="text-lg">{...}</p>
  <button
    type="button"
    onClick={showAllData}
    className="min-h-12 rounded-xl bg-[var(--color-accent)] px-6 text-control font-bold text-[var(--color-accent-text)]"
  >
    Show all data
  </button>
</section>
```
This exact card+CTA shell is also `LoginGate.tsx`'s form-card treatment (lines 47-118) and should be the template for any other single-card page-level state this phase touches. Copy strings in this button/heading are locked verbatim by the UI-SPEC Copywriting Contract — do not alter.

---

## Shared Patterns

### CSS-custom-property token consumption (the core mechanism this phase reuses)
**Source:** `frontend/src/index.css` (definitions) + every component file (consumption via `bg-[var(--color-sky)]`-style Tailwind arbitrary-value classes, never hardcoded hex)
**Apply to:** every single file in `frontend/src/components/` and `frontend/src/components/charts/` and `frontend/src/components/records/`
```tsx
className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]"
style={{ backgroundColor: categoryColor(cat), color: CHIP_TEXT }}
```
The executor's job across ~28 component files is mechanically the same: swap `--color-foam`→`--color-deck`, `--color-sky`→`--color-mist`, `--color-ink`→`--color-depth`, `--color-accent`→`--color-brass` (+`-text`), `--color-focus`→`--color-signal`; `--cat-*`/`--overlay-*`/`--line-*`/`--ref-*` keep their names (new hex only, defined once in `index.css`). `--shadow-elevation` keeps its name (new value). Never re-derive a hex value inline — always reference the var.

### Never-color-alone state encoding (D-07, locked — must survive the redesign)
**Source:** `frontend/src/components/CommandBar.tsx` lines 62-71, 235-262 (word/icon/color triad); `frontend/src/components/FilterBar.tsx`/`OverlayToggle.tsx` (`aria-pressed` + visually distinct fill, never fill-alone)
```tsx
const MARKER: Record<Status, string> = { idle: "", working: "", confirmed: "✓", clarify: "?", error: "!" };
```
Every new component this phase touches that signals state (armed/off, pressed/unpressed, success/error) must keep this triad — verify during planning, not just visually re-skin.

### `aria-pressed` toggle-group pattern
**Source:** `frontend/src/components/FilterBar.tsx` lines 102-124, `frontend/src/components/OverlayToggle.tsx` lines 72-92, `frontend/src/components/Header.tsx` lines 174-186 (theme/voice/guide toggles)
**Apply to:** any control with a binary on/off or single-select state
```tsx
<button type="button" aria-pressed={isActive} onClick={...} className={isActive ? activeClass : inactiveClass}>
```

### Card/panel shell (Mist surface + `xl` radius + one elevation shadow)
**Source:** `frontend/src/components/StatsStrip.tsx` lines 35, `frontend/src/components/ReadingsTable.tsx` line 79, `frontend/src/components/EmptyState.tsx` line 45, `frontend/src/components/LoginGate.tsx` line 52
```tsx
className="rounded-xl bg-[var(--color-sky)] p-6 shadow-[var(--shadow-elevation)]"
```
Per UI-SPEC §Elevation & Shape, this becomes `rounded-[14px] bg-[var(--color-mist)] shadow-[var(--shadow-elevation)]` (new shadow value) everywhere this shell appears — the single most repeated class-string in the codebase, appearing (with minor padding variance) in at least 6 files.

### Focus-visible ring (unchanged mechanism, re-pointed token)
**Source:** `frontend/src/index.css` lines 106-109
```css
:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
```
Rename to `var(--color-signal)`. No component-level change needed — this is a global rule.

### Decorative-element contrast exemption
**Source:** `frontend/src/components/charts/BPTimeline.tsx` lines 1-24 comment + `.chart-band` rule in `index.css`
**Apply to:** the new StatsStrip sparkline sub-component (explicitly directed by `13-CONTEXT.md`)
```tsx
<ReferenceArea fill={categoryColor(cat)} className="chart-band" aria-hidden="true" />
```

### Theme toggle mechanism (unchanged, not modified this phase)
**Source:** `frontend/src/store/theme.ts` (full file)
**Apply to:** nothing new — this file is explicitly NOT touched; both themes' new token *values* are designed against this existing `.dark`-class mechanism.

### Self-hosted font import
**Source:** `frontend/src/main.tsx` lines 5-6
```tsx
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
```
Replace with `@fontsource/inter` 400+600 and `@fontsource/space-grotesk` 600 imports (UI-SPEC: "New dependencies to add... `@fontsource/atkinson-hyperlegible` may be removed once migration is complete — flag as a planning-time cleanup task, not a same-commit deletion").

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| StatsStrip inline sparkline (new sub-component, no filename locked yet) | component (chart, decorative) | transform | Genuinely new: UI-SPEC explicitly calls it out as "a new sub-component, not present in the current StatsStrip.tsx — flag for gsd-planner as new build work, not a re-skin." Closest available building blocks are `PulseTrend.tsx`'s `mini`-variant Recharts gating and `BPTimeline.tsx`'s decorative-band `aria-hidden`/contrast-exemption precedent (both cited above under Pattern Assignments) — combine, don't copy either verbatim. |

---

## Metadata

**Analog search scope:** `frontend/src/` (components, components/charts, components/records, lib, store, index.css, main.tsx, App.tsx), `frontend/package.json`
**Files scanned:** ~31 source files read or grepped directly; full directory listing of `frontend/src` enumerated via `find`
**Pattern extraction date:** 2026-08-29
