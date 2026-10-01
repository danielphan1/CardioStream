---
phase: quick-260930-n7i
plan: 01
subsystem: ui
tags: [design-system, typography, accessibility, wcag, atkinson-hyperlegible, tailwind, copywriting]

# Dependency graph
requires:
  - phase: 13 (visual redesign)
    provides: the token system and type scale this restores compliance with
  - phase: 16
    provides: chartData's label-clipping fix, whose hardcoded test expectations constrained T-N7I-05
provides:
  - Single-typeface type system (Atkinson Hyperlegible 400/700), no synthesized weight anywhere
  - DESIGN.md-compliant dashed disabled states; the LoginGate WCAG contrast failure is closed
  - One canonical 18px utility (text-base) across the whole frontend
  - User-facing status/empty/error copy that does not use an em dash as its clause joiner
affects: [any future frontend work, DESIGN.md/PRODUCT.md staleness sync, future UI review passes]

# Tech tracking
tech-stack:
  added: ["@fontsource/atkinson-hyperlegible ^5.2.8 (resolves 5.3.0)"]
  removed: ["@fontsource/inter ^5.3.0", "@fontsource/space-grotesk ^5.3.0"]
  patterns:
    - "Disabled state = 2px dashed Ink border + mist fill + cursor-not-allowed, never lowered opacity"
    - "Accent-filled buttons carry a matching solid accent border in their base classes so a state flip does not resize the box"
    - "Off-scale spacing is permitted only with a comment naming its optical role"

key-files:
  created: []
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/main.tsx
    - frontend/src/index.css
    - frontend/src/components/LoginGate.tsx
    - frontend/src/components/CommandBar.tsx
    - frontend/src/components/ShowPanel.tsx
    - frontend/src/lib/copy.ts
    - frontend/src/lib/showSentence.ts
    - frontend/src/lib/chartData.ts

key-decisions:
  - "Deleted --font-display rather than aliasing it to --font-sans: under one family the token would have lied about what it resolves to"
  - "Set the disabled border colour to Ink, beyond the plan's string, because DESIGN.md:244 specifies a dashed *Ink* border and border-dashed alone would have left a dashed brass border"
  - "Left CHIP_CHAR_WIDTH_FACTOR at 0.62 and documented the lost safety margin instead of guessing a new value"
  - "Left the backend-owned UNAVAILABLE_MESSAGE em dash alone: editing only the frontend test mocks would desync them from production"
  - "Kept all five mt-0.5 icon nudges, documented as optical alignment rather than snapped to the 4px scale"

patterns-established:
  - "Two-Weight Rule enforced at the root cause: the font package ships only 400/700, so every 600 request anywhere in source is a browser fake-bold"
  - "Copy rewrites land with their test-assertion updates in the same commit, so no commit is ever red"

requirements-completed: [DESIGN-TWO-WEIGHT, DESIGN-18PX-FLOOR, DESIGN-DASHED-BORDER, DESIGN-SINGLE-SOURCE, DESIGN-SPACING-SCALE, ACC-CONTRAST, COPY-EM-DASH]

# Metrics
duration: 19min
completed: 2026-09-30
---

# Quick Task 260930-n7i: Design-Audit Fixes Summary

**Restored frontend compliance with DESIGN.md on three axes that all read as AI-slop design cliché, closing a real WCAG failure on the login screen along the way: the disabled Enter button went from roughly 2.6:1 to 14.11:1.**

## Performance

- **Duration:** 19 min (16:53 plan commit → 17:12 final commit)
- **Started:** 2026-09-30T23:53:34Z
- **Completed:** 2026-10-01T00:12:07Z (local 2026-09-30 17:12:07 -0700)
- **Tasks:** 3/3 complete
- **Files modified:** 43 unique (213 insertions, 181 deletions)

## Commits

| Commit | Task | Scope |
|---|---|---|
| `26f08e7` | Task 1 | Single-family Atkinson Hyperlegible at 400/700 only (16 files) |
| `b4d9fb7` | Task 2 | Dashed disabled states, one 18px utility, on-scale spacing (20 files) |
| `e99a236` | Task 3 | Rewrite em-dash-joined user-facing copy (25 files) |

## Accomplishments

### Task 1 — one typeface, two weights (Group A)

- Swapped `@fontsource/inter` + `@fontsource/space-grotesk` for `@fontsource/atkinson-hyperlegible` at `^5.2.8`, the exact range removed in `6322bc5`.
- `main.tsx`: restored the two-line 400/700 import form and rewrote the comment block, which had been narrating Atkinson as removable dead weight — now actively false.
- `index.css`: `--font-sans` → Atkinson; **deleted `--font-display`**; label/heading/display weights `600` → `700`; `body` now consumes `var(--font-sans)` instead of duplicating the literal stack.
- **Root-caused the weight rather than only the tokens:** 15 `font-semibold` → `font-bold` and 8 inline `fontWeight: 600` → `700`. Empirically confirmed the premise — `node_modules/@fontsource/atkinson-hyperlegible/` ships exactly `400.css` and `700.css`, so every surviving 600 was a browser-synthesized fake weight.
- Build output is the proof that exactly one family loads: the only font assets emitted are `atkinson-hyperlegible-latin{,-ext}-{400,700}-normal.woff{,2}`. No Inter, no Space Grotesk.

### Task 2 — token, spacing, disabled-state and hierarchy drift (Group B)

**The disabled-state work was the highest-value item and is complete at all four sites.**

- `LoginGate` submit button: this was the real defect. A 50%-opacity fade on a brass fill took the button from 5.90:1 to roughly 2.6:1, under the WCAG 4.5:1 floor — on the app's front door, in its most common state (empty password field). Replaced with a real state swap to mist fill + depth text, **measured at 14.11:1 light / 14.44:1 dark**.
- `CommandBar` input + Send button, `AddRecordPage` type toggles: same dashed treatment. `AddRecordPage` keeps `aria-disabled` rather than the `disabled` attribute, so the control stays in the tab order for a switch-access user; no redundant `aria-disabled` was added to the three sites that use the native attribute.
- Both brass buttons gained a solid brass border in their base classes so the box does not resize when the state flips.
- **One canonical 18px utility:** 46 `text-lg` + 23 `text-[18px]` → `text-base`. Verified the premise first against `node_modules/tailwindcss/theme.css`: both already rendered 18px; `text-lg` carried line-height `calc(1.75/1.125)` ≈ 1.5556, so 46 sites also moved *toward* DESIGN.md's documented body line-height of 1.5. The `text-[18px]` conversions are pixel-identical.
- **Spacing snapped to the 4px scale** per-site, not blind find/replace: `px-3`→`px-4` (8 sites), `gap-3`→`gap-2` (3) or `gap-4` (2), `mt-3`→`mt-4` (4), `py-3`→`py-4`, `px-5`→`px-6`, and `pl-3.5 pr-4`→`px-4`. The two CommandBar gaps between adjacent 48px targets took the deliberately wider step to reduce mis-taps.
- `ShowPanel` no longer dims its legend marks, making its own "No opacity dimming under ANY state" comment true again.
- `LoginGate`'s `<h2>` carried the `<h1>`'s exact classes — no hierarchy at all, plus a phantom section announced to a screen reader. It is an instruction sentence, so it is now `<p className="text-base">`, leaving one heading on the screen.

### Task 3 — em dash is no longer the default clause joiner (Group C)

- Rewrote 20 user-facing strings across the status/empty/error family, including all eleven confirmed findings.
- The three duplicate `"Nothing selected — pick a dataset to see it"` declarations (`EventTimelineList`, `lib/showSentence`, `lib/agent`) converged on one sentence; `agent.ts` keeps its existing no-trailing-period shape.
- Where a dash was doing real work, the correct mark replaced it rather than a blanket period: a **colon** before the Guide's filter list, a **comma** before ChartDeck's "or" clause.
- Every affected test assertion moved in the same commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Disabled border colour set to Ink, not left as brass**
- **Found during:** Task 2c
- **Issue:** The plan's class string was `disabled:border-dashed` with no border-colour override. On the two brass buttons that would have produced a dashed **brass** border, satisfying the border *style* but not the rule as written. DESIGN.md:244 is explicit: "2px *dashed* Ink border, Sky fill, `cursor-not-allowed`".
- **Fix:** Added `disabled:border-[var(--color-depth)]` at the two brass sites. Deliberately **not** applied to `AddRecordPage`'s type toggles, where the brass fill is information-bearing (it marks the selected record type) and must stay readable; there the dash alone carries "not ready".
- **Files modified:** `LoginGate.tsx`, `CommandBar.tsx`
- **Commit:** `b4d9fb7`

**2. [Rule 1 — Bug] Two stale test assertions the plan's 3d inventory missed**
- **Found during:** Task 3 (caught by the suite — 2 failures, 556/558)
- **Issue:** `AddRecordPage.test.tsx:187` asserts the *composed* two-sentence error (`"Something went wrong saving that lab result. Nothing was added — please try again."`), so it did not match the bare `Nothing was added — please try again.` fragment the plan's grep inventory was built from. `CombinedTimeline.test.tsx:359` asserts `toContain("you have 4 here")` — no em dash at all, so no em-dash grep could have found it, but the rewrite capitalised that clause.
- **Fix:** Both assertions updated in the same commit as the copy. `CombinedTimeline.test.tsx` was not in the plan's `files_modified` list and was added.
- **Commit:** `e99a236`

**3. [Rule 3 — Blocking] Fresh worktree had no `node_modules`**
- **Found during:** setup
- **Fix:** `npm ci` from the committed lockfile to establish a true pre-change baseline (39 files / 558 tests / 0 failures, independently reproduced) before touching `package.json`. Not a scope change.

### Plan corrections (no code impact)

- **`mt-0.5` is 5 sites across 3 files, not 4.** The plan's gate asserted `= "4"` files. Actual distribution: `UploadPage.tsx` ×2, `AddRecordPage.tsx` ×2, `LoginGate.tsx` ×1. All 5 sites are preserved and all 5 now carry the optical-alignment comment; only the plan's file count was wrong.
- The plan's cross-cutting verification block suggested `git stash && … && git stash pop` to compare the `min-h-12` count against the pre-change tree. **Not used** — the stash stack is shared across worktrees and popping it can apply a sibling session's WIP. Used `git grep -o 'min-h-12' 7f0c1ec -- frontend/src` instead, which is read-only and exact.

## Verification

Run after each of the three commits, and again at the end:

| Gate | Result |
|---|---|
| `npx vitest run` | 39 files / **558 passed** / 0 failed |
| `npx vitest run src/tests/contrast.test.ts` | **38 passed** |
| `npx tsc -b --noEmit` | exit 0 |
| `npm run lint` (oxlint) | exit 0 |
| `npm run build` | succeeds; only Atkinson 400/700 font assets emitted |
| 48px floor (`min-h-12` count vs base `7f0c1ec`) | **48 → 48**, no regression |
| `min-h-12` diff balance within Task 2 | 10 removed / 10 re-added |
| No CDN font request (`index.html` + `src/`) | PASS (SEC-03 intact) |
| `font-semibold` / `font-medium` / `font-display` in source | 0 |
| Any 600-weight request in source | 0 |
| `text-lg` / `text-[18px]` in source | 0 |
| Opacity-based disabled state in source | 0 |
| `<h[1-6]` in `LoginGate.tsx` | 1 |
| Off-scale spacing (`px-3`/`gap-3`/`mt-3`/`py-3`/`px-5`/`pl-3.5`) | 0 |
| `"Nothing selected. Pick a dataset"` source declarations | 3 (all converged) |
| Non-comment em dashes in source | exactly the 7 allowlisted sites |

### T-N7I-SC supply-chain record

The regenerated `package-lock.json` diff is **4 insertions, 14 deletions** — `npm install` reported "added 1 package, removed 2 packages". It adds exactly one entry, `@fontsource/atkinson-hyperlegible@5.3.0`, resolved from the official registry path under the official `@fontsource` scope, same `OFL-1.1` license and same `sponsors/ayuhito` funding URL as the two packages it replaces. It removes exactly `@fontsource/inter@5.3.0` and `@fontsource/space-grotesk@5.3.0`. **Zero transitive additions** (Fontsource packages ship CSS + font binaries with no runtime deps). Nothing else appears in the diff, so the commit was not blocked.

## Known Stubs

None. No placeholder values, empty-data paths, or unwired components were introduced — every change is to an existing, live code path.

## Threat Flags

None. No network endpoint, auth path, file-access pattern, or schema at a trust boundary was touched. Frontend styling and copy only (T-N7I-06, accepted in the plan).

## Human Verification Still Outstanding

I cannot run a browser, so none of the three `human-check` blocks were performed. They are all still open, and one of them is load-bearing:

### 1. T-N7I-05 — chart-label clipping from Atkinson's wider glyphs (REQUIRED, carries forward)

`CHIP_CHAR_WIDTH_FACTOR = 0.62` in `frontend/src/lib/chartData.ts` is **unchanged**, as instructed. The stale "bold 14px Inter" comment is corrected and the ceiling is recorded in a `ponytail:` comment naming the upgrade path. The factor is now only roughly exact for Atkinson's wider letterforms, so the estimate has lost its safety margin.

**I did not guess a new number**, because `chartData.test.ts` hardcodes this function's outputs (`toBe(383)`, `toBe(295)`, `toBe(40)`) as the regression test for the 16-VERIFICATION.md label-clipping BLOCKER. A speculative bump would break a verified test to chase a hypothetical.

**Exact observation needed:** at a **375px viewport**, open the **BP Category** summary view and check whether the CategoryBars label `"Hypertensive Crisis — NN readings (NN%)"` clips at the right edge; then open **BP Timeline** and check whether the band-label chips still fully cover their own text. If either clips, report the observed overflow — the factor should be bumped against that measurement, and `chartData.test.ts`'s three expectations updated in the same commit.

### 2. Font rendering (Task 1)

Confirm all text renders in Atkinson Hyperlegible (the StatsStrip hero numbers are the clearest tell, and must no longer use a second display face) and that nothing looks faux-bolded at heading/label sizes.

### 3. Disabled states and spacing (Task 2)

Login screen: title and instruction line should now read as two different levels, and Enter with an empty password should show a dashed outline on a mist fill with legible dark text, never washed-out brass. Command bar: during "Working…" the input and Send should go dashed/mist, not faded. Show panel: unticking a dataset must leave the legend mark at full strength. Sweep Upload / Add Record for any control that now looks cramped, and confirm the five icon+text notices still have their icon optically level with the first text line.

### 4. Rewritten copy read in place (Task 3)

Read the new strings in the running app rather than in the diff. If Voice Replies is on, the LISTENING hint and the Cancelled message go through TTS and should sound right spoken aloud.

## Follow-ups

1. **T-N7I-05** — `CHIP_CHAR_WIDTH_FACTOR` calibration, pending the 375px observation above.
2. **Backend-owned em dash (new, found during Task 3).** `backend/app/agent/copy.py:28` holds `"The assistant isn't connected right now. The buttons below still work — use them to change the view."` — the same anti-pattern Group C exists to remove, in the same copy family. It is **out of this task's scope** (the plan's `files_modified` lists no backend file and the objective is scoped to the React frontend). The frontend only mocks it, at `CommandBar.test.tsx:226,235` and `useVoiceCommand.test.ts:168,180`; editing those mocks alone would desync them from production. Fixing it needs a backend change plus its own test pass.
3. **D-02 items remain untouched as instructed:** DESIGN.md/PRODUCT.md staleness (documented 12px `xl` radius vs shipped 14px; Foam/Sky/Ink/Terracotta names vs shipped Deck/Mist/Depth/Brass; PRODUCT.md's purple/violet favicon claim), lucide-react icon reduction, and the StatsStrip decorative-icon treatment. Note that DESIGN.md's palette naming is now the *only* place the old names survive, which made Task 2c's "dashed Ink border on a Sky fill" need a mental translation to `--color-depth` / `--color-mist`; a future naming sync would remove that friction.
4. **Pre-existing, not introduced:** `npm run build` warns that the main JS chunk is 777kB (>500kB). Untouched by this task, logged for visibility.

## Self-Check: PASSED

- `frontend/src/main.tsx` — FOUND, contains both `@fontsource/atkinson-hyperlegible/{400,700}.css` imports
- `frontend/src/index.css` — FOUND, contains `Atkinson Hyperlegible`, `font-family: var(--font-sans)`, no `--font-display`
- `frontend/package.json` — FOUND, contains `atkinson-hyperlegible`, no `inter` / `space-grotesk`
- `node_modules/@fontsource/atkinson-hyperlegible/{400,700}.css` — both present
- Commit `26f08e7` — FOUND
- Commit `b4d9fb7` — FOUND
- Commit `e99a236` — FOUND
- Working tree clean after the third commit; no file deletions in any of the three commits; no untracked files left behind
