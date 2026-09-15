---
phase: 19
slug: guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
artifact: UI-SPEC
status: draft
shadcn_initialized: false
preset: none
source: 19-CONTEXT.md D-01..D-11 (locked) + existing 13-UI-SPEC.md "Slack Water"/"Night Watch" tokens (index.css, live source of truth — DESIGN.md predates the Phase 13 rename and is stale on token names)
created: 2026-09-15
---

# Phase 19 — UI Design Contract: Guest Demo Mode

> Scope is intentionally small: one conditional form field, one persistent badge, and hiding two
> existing header buttons. No new page, no new chart, no new design tokens. Everything here reuses
> the existing "Slack Water"/"Night Watch" component language verbatim.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — plain Tailwind v4 (`@theme`) + CSS custom properties in `frontend/src/index.css`. No `components.json`/shadcn anywhere in this codebase (13 prior phases, zero shadcn usage); introducing a component library for a 3-item phase would fragment the established design language. Shadcn gate deliberately skipped — see rationale above. |
| Component library | none (hand-rolled components, Tailwind utility classes, `lucide-react` icons) |
| Icon library | `lucide-react` (already a dependency) |
| Font | `Inter` (body/UI) + `Space Grotesk` (`--font-display`) — unchanged, no new font need |

This phase adds **zero new design tokens**. Every class/color/spacing value below is an existing
token pulled from `frontend/src/index.css` and the Phase 13/14 component conventions.

---

## Spacing Scale

Unchanged, reused as-is (project's existing 8-pt-adjacent scale, multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon gaps |
| sm | 8px | badge internal padding (`py-1`), compact gaps |
| md | 16px | default element spacing, form field gaps |
| lg | 24px | card/form internal padding |
| xl | 32px | layout gaps |
| 2xl | 48px | major section breaks — **also the accessibility click-target floor** |
| 3xl | 64px | page-level gutters |

Exceptions: none. The demo badge is a non-interactive `<span role="status">`, so it is explicitly
**not** subject to the 48px floor (that floor applies to interactive targets only — same carve-out
already documented for the app's other status pills, e.g. `StatsStrip`'s category chip).

---

## Typography

Unchanged, reused as-is from `index.css` `@theme` + established body-text convention:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (badge text, field label, error copy) | 18px (`text-[18px]` / `text-base`) | 400 | 1.5 |
| Label (form field labels, "Username"/"Password") | 20px (`text-label`) | 600 | 1.25 |
| Heading (login form's two-line intro) | 24px (`text-heading`) | 600 | 1.2 |

No Display-size text is introduced by this phase. **18px floor rule applies unchanged** — the demo
badge text renders at 18px, not a smaller "chip" size, even though it's compact.

---

## Color

Unchanged, reused as-is from `index.css` (light theme values shown; dark-theme "Night Watch"
pairs already exist token-for-token and need no new work):

| Role | Token / Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-deck` `#F5F7F6` | Page background — LoginGate's full-screen surface, Header background |
| Secondary (30%) | `--color-mist` `#E3EBE9` | LoginGate card, the demo badge's own fill, header-chrome button fill |
| Accent (10%) | `--color-brass` `#8A5A1E` | **NOT used by anything new in this phase.** Reserved for the existing "Enter" submit button only (unchanged, already accent-filled). |
| Destructive | `--color-hazard` `#9C2B22` | **Not used this phase** — no destructive action is introduced. Existing "Log out" confirm dialog stays unchanged (it is accent-filled per the One Signal Rule's stated exception, not hazard-filled). |
| Ink / borders | `--color-depth` `#101C2E` | All new text, icons, 2px borders (badge border, username-field border) |
| Focus ring | `--color-signal` `#0F6E86` | Unchanged `:focus-visible` ring — applies to the new username `<input>` automatically, no override needed |

**Accent reserved for (this phase changes nothing about this list):** the "Enter" login submit
button only. The demo badge, the new username field, and the (now-conditionally-hidden) Upload/Add
Record buttons are **never** brass-filled — the badge is informational chrome (Ink-on-Mist, same
family as `Header`'s theme/voice/guide toggle buttons), matching the One Signal Rule.

---

## Component Inventory

| Component | Fate |
|-----------|------|
| `LoginGate.tsx` | **Modified.** Gains a conditional username field above the password field, driven by a `demoMode` boolean. Rejection copy and one heading line change when `demoMode` is true. |
| `Header.tsx` | **Modified.** Gains the persistent demo badge next to the title; the existing "Upload" and "Add Record" buttons stop rendering when `demoMode` is true. Everything else in Header (theme/voice/guide toggles, "Back to dashboard," Log out) is untouched. |
| `api/types.ts` (`HealthStatus`) | **Modified.** Gains one new field: `demo: boolean`. |
| `hooks/useHealth.ts` | **Unchanged** implementation; gains a new call site (LoginGate calls it pre-auth — see Integration Notes, this is a behavior change to an existing locked test, flagged for planning). |
| `UploadPage.tsx` / `AddRecordPage.tsx` | **Unchanged.** No demo-mode logic needed inside them — D-04 is satisfied entirely by removing their only entry points (the two Header buttons), so a guest can never mount either screen. Do not add redundant guards inside these components; that would be defense-in-depth the phase doesn't need (no other route/URL reaches them — `store/view.ts` is plain in-memory state with no persistence and no router). |

No component is deleted. No new component file is created — everything is a conditional branch
inside two existing files.

---

## Component Contract

### 1. `LoginGate.tsx` — conditional username field

**Trigger:** a `demoMode: boolean`. **Recommended source** (flagged for planner to confirm, not
mandated — see Integration Notes): the same runtime flag surfaced by `/health`'s new `demo` field,
fetched via the existing `useHealth()` hook — called from `LoginGate` itself, pre-auth, for the
first time. This keeps ONE source of truth (the backend's optional guest-credential setting) driving
the login field, the header badge, and the write-route guard alike, per `19-CONTEXT.md`'s own
proposed shape.

**Layout — when `demoMode` is `true`:** insert a username field as a new first field, directly above
the existing password field, inside the same `<div className="flex flex-col gap-2">` field-group
pattern already used for password:

```tsx
<div className="flex flex-col gap-2">
  <label htmlFor="login-username" className="text-label text-[var(--color-depth)]">
    Username
  </label>
  <input
    id="login-username"
    name="username"
    type="text"
    autoFocus
    autoComplete="username"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    className="min-h-12 w-full rounded-xl border-2 border-[var(--color-depth)] bg-[var(--color-deck)] px-4 text-lg text-[var(--color-depth)]"
  />
</div>
```

Byte-for-byte the same field styling as the existing password input (same classes, same
48px-min-height, same border/radius/focus treatment) — no new visual pattern. `autoFocus` moves to
the username field (it becomes the first field); the password field loses `autoFocus` when
`demoMode` is true, keeps it when `demoMode` is false (today's unchanged behavior).

**Submit gating:** the existing disabled condition (`password.trim() === "" || submitting`)
extends to `(demoMode && username.trim() === "") || password.trim() === "" || submitting` — both
fields required in demo mode, matching the existing all-or-nothing pattern (no partial-fill submit
today, none introduced).

**Heading copy — when `demoMode` is `true`:** the second heading line changes from
`Enter the password to continue` to `Enter your guest credentials to continue`. The first heading
line (`Chris's Health Dashboard`) is **unchanged** — no new title/branding element on this screen;
the badge (see below) only appears post-auth in `Header`, so a demo-mode login page is otherwise
visually identical to the real one except for the extra field and this one clause.

**Rejection copy — when `demoMode` is `true`:** replace `That password didn't work.` with
`That username or password didn't work.` — deliberately does not say which field was wrong (avoids
turning the login form into a username-enumeration oracle; same fail-closed spirit as D-10's
constant-time-compare requirement). Structure, icon (`TriangleAlert`), `role="alert"`, and styling
are unchanged.

**When `demoMode` is `false` (Chris's real deployment):** byte-for-byte unchanged from today —
no username field, no copy change, no new fetch call executes any differently than it does today
(see Integration Notes for the one behavior caveat).

### 2. `Header.tsx` — persistent demo badge

**Copy (locked):** `Guest Demo · Synthetic Data` — reuses the app's existing " · " separator
convention (already used in `StatsStrip`'s `min {x} · max {y}`), so it reads as house style, not a
one-off.

**Placement:** inside the existing left-hand flex group (`<div className="flex items-center gap-2">`
that currently holds the `Sailboat` icon + `h1`), as a third item immediately after the `h1`. Add
`flex-wrap` to that same `div` so on a narrow phone width the badge drops to its own line under the
title rather than clipping (the site's own "No-Off-Screen Rule").

**Markup — renders only when `demoMode` is `true`:**

```tsx
<span
  role="status"
  className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--color-depth)] bg-[var(--color-mist)] px-3 py-1 text-[18px] text-[var(--color-depth)]"
>
  <Info aria-hidden="true" size={18} />
  Guest Demo · Synthetic Data
</span>
```

- Reuses the app's existing "status pill" shape (`rounded-full px-3 py-1 text-[18px]`, the exact
  classes already used by `StatsStrip`'s category chip, `ReadingsTable`'s category cell, and
  `OverlayEventsList`'s chip) but with **neutral Ink-on-Mist fill**, not a category color — this
  badge carries no clinical/data meaning, so it must not borrow a color that does.
- Icon + text together (never color alone) — `Info` from `lucide-react` (already the project's
  icon library; no new dependency).
- `role="status"`, not `role="alert"` — it's calm ambient chrome, not a notification needing
  interruption; it does not need `aria-live` since it's static for the life of the page (it never
  appears/disappears while the app is running — `demoMode` is fixed per deployment).
- **Not** a button: no hover state, no focus ring, no `onClick`. Purely informational, exempt from
  the 48px interactive-target floor for the same reason `StatsStrip`'s status pill is exempt.

**When `demoMode` is `false`:** badge renders nothing (`{demoMode && <span>...}`) — zero visual or
DOM footprint on Chris's real deployment.

### 3. `Header.tsx` — hiding write-oriented entry points (D-04)

Wrap only the two write-capable buttons inside the existing `onDashboard` branch:

```tsx
{onDashboard ? (
  <>
    {!demoMode && (
      <button /* Upload — unchanged markup */>...</button>
    )}
    {!demoMode && (
      <button /* Add Record — unchanged markup */>...</button>
    )}
  </>
) : (
  <button /* Back to dashboard — unchanged, untouched by demoMode */>...</button>
)}
```

No copy change, no visual change to the buttons themselves when they DO render (Chris's real
deployment is unaffected). In demo mode they simply do not mount — satisfying D-04's "never shown
then rejected" requirement with a two-line diff, no new component, no guard inside
`UploadPage`/`AddRecordPage` (see Component Inventory — those stay untouched; there is no other path
that reaches them for a guest to trip over).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Enter` — existing login submit button, unchanged. No new primary CTA is introduced by this phase. |
| New form field label | `Username` |
| Demo-mode login heading (2nd line) | `Enter your guest credentials to continue` |
| Demo badge | `Guest Demo · Synthetic Data` |
| Empty state | Not applicable — this phase introduces no new empty state. The seeded demo dataset (D-05/D-06, covering readings/labs/incidents/procedures) always populates the dashboard for a guest; no data-type renders empty by design. |
| Error state — login rejection (demo mode) | `That username or password didn't work.` Please try again. — same structure/icon as the existing single-field message, deliberately not naming which field failed. |
| Error state — guest write-blocked (API 403 body; safety net only, not normally user-visible since the triggering controls are hidden per D-04) | e.g. `"Guest accounts can't make changes to this demo."` — friendly, no status code, no raw exception text, matching the site's existing error-copy discipline (`UploadPage`/`AddRecordPage`'s "never a status code" rule). Exact string is the executor's call; must read as calm and explanatory, never technical. |
| Destructive confirmation | None new this phase. The existing "Log out?" confirm dialog is unchanged and unaffected by demo mode (a guest can log out exactly like a caregiver). |

---

## Accessibility Floor (unchanged, restated because this phase touches auth + header chrome)

- New username `<input>`: real `<label htmlFor>`, ≥48px height, ≥18px text, inherits the sitewide
  3px `:focus-visible` ring — no new pattern, mirrors the password field exactly.
- Demo badge: text + icon together, never color-alone; `role="status"` for screen-reader
  discoverability; exempt from the 48px floor because it is non-interactive (matches the existing
  carve-out already documented for `StatsStrip`'s status pill).
- Hiding the Upload/Add Record buttons must not leave a focus trap or an `aria-hidden` orphan —
  they simply don't render (conditional JSX), so there's nothing left in the tab order to skip.
- No drag, hover-only, or precise-pointing interaction is introduced anywhere in this phase.
- `LoginGate` remains explicitly exempt from the voice-operable rule (unchanged from
  `05-UI-SPEC`'s "Accessibility Scope" carve-out) — the guest credential, like Chris's password,
  never travels the voice path.

---

## Registry Safety

Not applicable — no shadcn, no component registry, no third-party UI blocks. `Tool: none`.

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| n/a | n/a | not applicable — no registry in use |

---

## Integration Notes (for the planner — not a UI decision, flagged so it isn't missed)

**Pre-auth `/health` fetch vs. the existing "no fetch before login" lock.** `LoginGate.test.tsx`
currently asserts `expect(fetchMock).not.toHaveBeenCalled()` for the entire pre-auth render (D-01,
T-05-10, "no pre-auth data leak"). The `demoMode` mechanism sketched above and in `19-CONTEXT.md`
(a boolean surfaced off the already-ungated, already-PHI-free `/health` endpoint) requires
`LoginGate` to call `useHealth()` before login succeeds — one new fetch, zero health *readings*,
zero PHI. This is consistent with T-05-10's underlying intent (no patient data leaves the server
pre-auth) but not with its current literal assertion (zero fetches, period). The planner should
either:
1. Update `LoginGate.test.tsx`'s assertion to permit exactly one `/health` call and add a
   regression test for the new `demoMode`-conditional field (still fail-first per D-11's convention), or
2. Choose a different mechanism entirely (e.g., a Vite build-time `import.meta.env` flag set
   per-Vercel-project, avoiding any pre-auth fetch) if that is judged cleaner once in the code.

Either way, whatever mechanism is chosen MUST be the single source of truth for all three surfaces
in this spec (login field, badge, write-route guard) — `19-CONTEXT.md` is explicit that a second,
independently-set `DEMO_MODE`-style flag that could drift out of sync is exactly what to avoid.
This UI-SPEC's component contracts (Section "Component Contract" above) are written against a
plain `demoMode: boolean`, so they hold regardless of which mechanism the planner picks.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
