---
phase: 11-full-site-guide-instructions-tab
verified: 2026-08-26T01:10:00Z
status: passed
score: 4/4 roadmap success criteria verified (17/17 plan-level must-have truths verified)
overrides_applied: 0
---

# Phase 11: Full Site Guide / Instructions Tab Verification Report

**Phase Goal:** Chris and his caregivers can learn how to use every part of the site — including what to say by voice — from a built-in guide, without interrupting a live voice session to do it.
**Verified:** 2026-08-26T01:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A static guide screen explains every control, filter, chart, and upload flow on the site | ✓ VERIFIED | `frontend/src/components/GuideOverlay.tsx` renders 9 `<section id=...>` blocks (Command Bar, Filters, Charts, Overlay, Voice Replies, Upload, Add a Record, What Can I Say, About This Guide), each with a heading + description + "By click:" line (Upload/Add a Record correctly omit "By voice:" per D-13). `GuideOverlay.test.tsx` asserts all 9 headings render, `npx vitest run` green. |
| 2 | Guide includes a "what can I say" voice-command reference that stays in sync with the app's real command vocabulary (one source, not a second divergent list) | ✓ VERIFIED | `frontend/src/lib/voiceCommands.ts` exports `VOICE_COMMAND_CATEGORIES` (8 categories) as the single authored source; `EXAMPLES = VOICE_COMMAND_CATEGORIES.map((c) => c.example)` is derived, not re-authored. `GuideOverlay.tsx:296` maps `VOICE_COMMAND_CATEGORIES` directly; `CommandBar.tsx:31` imports the same `EXAMPLES` for its placeholder rotation — one shared module, two consumers, cannot drift. |
| 3 | Opening the guide never interrupts or unmounts an active voice session — Chris can reach and navigate the guide by voice mid-session | ✓ VERIFIED | `App.tsx`'s CommandBar `<section>` (wrapping `CommandBar`/`AgentStatusBanner`) is unconditionally rendered in `Dashboard()`, never wrapped in a conditional and never marked `inert` — only `Header` and `main` are `inert={guideOpen}`. `GuideOverlay` itself is an always-mounted sibling that returns `null` when closed (never a `useView` swap). Backend voice path (`toggle_guide`) is wired end-to-end (schema/service/prompt) — see Key Link table — inert only due to the project-wide, pre-existing Anthropic billing gap (same accepted condition as Phase 9/10, not invented by this phase). |
| 4 | The guide meets the same accessibility bar as the rest of the site (≥48px targets, ≥18px text, high contrast, keyboard + voice navigable) | ✓ VERIFIED | All interactive controls use `min-h-12` (48px) and `text-[20px]`/`text-lg` (≥18px); colors use the existing `--color-ink`/`--color-sky`/`--color-foam` tokens (no new palette, same contrast as rest of site). Keyboard: code review (11-REVIEW.md) caught a real focus-loss bug (CR-01) and a Tab-order leak into hidden content — both fixed in commit `156d752`/`ffc58c8` and confirmed present in the current `GuideOverlay.tsx`/`Header.tsx`/`App.tsx` (see below). |

**Score:** 4/4 roadmap success criteria verified

### Plan-Level Must-Haves (all 5 plans)

| Plan | Must-Have Truth | Status |
|---|---|---|
| 11-01 | `ToggleGuide` parses via `AgentOutput` structured-output schema | ✓ VERIFIED (`backend/app/agent/schemas.py:152`) |
| 11-01 | `interpret()` maps `ToggleGuide` → `AppliedFilters(guideOpen=...)` without touching circuit breaker | ✓ VERIFIED (`service.py:248-257,296-297`) |
| 11-01 | Case normalization via existing generic validator, zero new validator code | ✓ VERIFIED (no new validator added; existing `_lower_tokens` reused) |
| 11-01 | `SYSTEM_PROMPT` teaches open/close only, no section-jump vocabulary | ✓ VERIFIED (`prompt.py:55-58`; no "what can i say" string present) |
| 11-02 | `useGuide` defaults `open: false`, no persistence | ✓ VERIFIED (`store/guide.ts`, zero `localStorage` references) |
| 11-02 | `setOpen`/`toggleOpen` mutate synchronously, no side effects | ✓ VERIFIED |
| 11-02 | Server `guideOpen` delta reaches `useGuide.setOpen` via `applyAgentFilters` | ✓ VERIFIED (`lib/agent.ts:111-112`) |
| 11-02 | D-07 auto-close: other commands close an open guide; guideOpen-only delta doesn't self-trigger | ✓ VERIFIED (`lib/agent.ts:55-67`, 4 dedicated tests in `agent.test.ts:148-179`) |
| 11-03 | `VOICE_COMMAND_CATEGORIES` exposes exactly 8 categories in locked order | ✓ VERIFIED (`voiceCommands.ts:15-40`) |
| 11-03 | `EXAMPLES` derived from categories, not independently authored | ✓ VERIFIED (`voiceCommands.ts:47`) |
| 11-03 | `CommandBar` placeholder rotation unchanged, now sourced from shared module | ✓ VERIFIED (`CommandBar.tsx:31,97,186`) |
| 11-04 | `GuideOverlay` returns `null` closed / full content open, single-page ToC, text-only | ✓ VERIFIED |
| 11-04 | All 7 fixed-format sections present; Upload/Add-a-Record omit "By voice:" | ✓ VERIFIED (test + manual source read) |
| 11-04 | "What Can I Say" renders all 8 categories from `voiceCommands.ts`, never re-authored | ✓ VERIFIED (`GuideOverlay.tsx:294-307`) |
| 11-04 | Escape/Close → `setOpen(false)`; `role="region"`, no `aria-modal`, no focus trap | ✓ VERIFIED (`GuideOverlay.tsx:63-70,115-130`; test asserts no dialog role/`aria-modal`) |
| 11-04 | Header "Guide" button styled identically to Theme/Voice Replies, `aria-pressed` | ✓ VERIFIED (`Header.tsx:206-230`) |
| 11-05 | Opening the guide never unmounts `CommandBar`; `GuideOverlay` mounted as always-present sibling on all 3 views | ✓ VERIFIED (`App.tsx`: `grep -c "<GuideOverlay"` = 3; CommandBar `<section>` unconditional, never `inert`) |
| 11-05 | CommandBar band raised to `sticky top-0 z-[60]` only while guide is open | ✓ VERIFIED (`App.tsx:214`) |
| 11-05 | Human visual/stacking/Tab-order confirmation end-to-end | ✓ VERIFIED — checkpoint gate (`autonomous: false`) completed per SUMMARY, with two real bugs found and fixed (clearance overlap, Tab-order leak), commits `ffc58c8`/`156d752` present in git log and code matches described fixes |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/app/agent/schemas.py` | `ToggleGuide` model, `AppliedFilters.guideOpen` | ✓ VERIFIED | Both present, correct shape (`Literal["open","closed"]`) |
| `backend/app/agent/copy.py` | `toggle_guide_message(state)` | ✓ VERIFIED | Present, matches spec exactly |
| `backend/app/agent/service.py` | `_apply_toggle_guide` + `interpret()` dispatch | ✓ VERIFIED | Present, correctly ordered after `ToggleSpeech` branch |
| `backend/app/agent/prompt.py` | Guide vocabulary paragraph (open/close only) | ✓ VERIFIED | Present, no section-jump vocabulary |
| `frontend/src/store/guide.ts` | `useGuide` ephemeral store | ✓ VERIFIED | 22 lines, no persistence |
| `frontend/src/api/types.ts` | `AppliedFilters.guideOpen` mirror | ✓ VERIFIED | `guideOpen?: "open" \| "closed" \| null;` present |
| `frontend/src/lib/agent.ts` | `guideOpen` branch + D-07 auto-close | ✓ VERIFIED | Both present |
| `frontend/src/lib/voiceCommands.ts` | Shared categorized reference + derived `EXAMPLES` | ✓ VERIFIED | Exports match spec exactly |
| `frontend/src/components/GuideOverlay.tsx` | Full guide UI | ✓ VERIFIED | 321 lines, all sections present, focus mgmt added post-review |
| `frontend/src/components/GuideOverlay.test.tsx` | Behavior coverage | ✓ VERIFIED | 8 tests, all pass |
| `frontend/src/components/Header.tsx` | Guide button | ✓ VERIFIED | Present, `id="guide-toggle-button"`, `aria-pressed={guideOpen}` |
| `frontend/src/App.tsx` | GuideOverlay mounted x3, CommandBar band promotion, `inert` wiring, `useClearanceHeight` | ✓ VERIFIED | All present and match SUMMARY's description |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `service.py` | `schemas.py` | `isinstance(result, ToggleGuide)` dispatch | ✓ WIRED | `service.py:296-297` |
| `lib/agent.ts` | `store/guide.ts` | `useGuide.getState().setOpen(f.guideOpen === "open")` | ✓ WIRED | `lib/agent.ts:111-112` |
| `lib/agent.ts` | `store/guide.ts` | D-07 auto-close `setOpen(false)` | ✓ WIRED | `lib/agent.ts:66-67` |
| `components/CommandBar.tsx` | `lib/voiceCommands.ts` | `import { EXAMPLES }` | ✓ WIRED | `CommandBar.tsx:31` |
| `components/GuideOverlay.tsx` | `store/guide.ts` | `useGuide((s) => s.open)` / `setOpen` | ✓ WIRED | `GuideOverlay.tsx:56-57` |
| `components/GuideOverlay.tsx` | `lib/voiceCommands.ts` | `VOICE_COMMAND_CATEGORIES.map(...)` | ✓ WIRED | `GuideOverlay.tsx:296` |
| `components/Header.tsx` | `store/guide.ts` | `useGuide((s) => s.toggleOpen)` | ✓ WIRED | `Header.tsx:130-131,224` |
| `App.tsx` | `components/GuideOverlay.tsx` | `<GuideOverlay />` mounted unconditionally x3 | ✓ WIRED | `App.tsx:221,271,293` (Dashboard/UploadView/RecordsView) |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — `GuideOverlay` renders 100% static, build-time-authored content (its own JSX literals + `voiceCommands.ts`'s hardcoded constants), by design (D-12: text-only, no data-driven list). The one "data flow" worth tracing is `clearanceAbove`: `App.tsx`'s `useClearanceHeight` hook uses a live `ResizeObserver` on `headerRef`/`commandBarRef` (real DOM measurement, not a hardcoded guess) and passes the measured value into `GuideOverlay`'s `clearanceAbove` prop, which drives both `paddingTop` and each section's `scrollMarginTop`. This was verified as ✓ FLOWING — replaced a guessed fixed padding specifically because it produced measured negative-overlap bugs, per the SUMMARY's documented bug-fix cycle.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend agent test suite green (toggle_guide included) | `cd backend && python -m pytest` | 260 passed, 1 failed (unrelated env var — `.env`'s `SITE_PASSWORD=dev-local-test` collides with a pre-existing, phase-11-unrelated test in `test_auth_upload.py`, confirmed via `git blame` predates this phase), 7 skipped | ✓ PASS (phase-relevant tests) |
| Frontend full test suite green | `cd frontend && npm test -- --run` | 323 passed (28 files) | ✓ PASS |
| TypeScript clean | `cd frontend && npx tsc --noEmit` | 0 errors | ✓ PASS |
| No debt markers in phase files | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK"` across all 12 phase-touched files | 0 matches | ✓ PASS |
| `EXAMPLES` truly derived (no duplicate authoring) | `grep VOICE_COMMAND_CATEGORIES.map` in `voiceCommands.ts` | 1 match, referential derivation confirmed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| GUIDE-01 | 11-04, 11-05 | Static guide explains every control/filter/chart/upload flow | ✓ SATISFIED | 9-section `GuideOverlay`, mounted on all 3 authenticated views |
| GUIDE-02 | 11-03, 11-04, 11-05 | "What can I say" reference reuses one shared source | ✓ SATISFIED | `voiceCommands.ts` single source, two consumers |
| GUIDE-03 | 11-01, 11-02, 11-05 | Reachable/usable without unmounting the live voice session | ✓ SATISFIED | `CommandBar` never wrapped in `inert`/conditional; `GuideOverlay` is a sibling, not a view-swap |
| GUIDE-04 | 11-04, 11-05 | Same accessibility bar (48px/18px/contrast/keyboard+voice nav) | ✓ SATISFIED | Token/spacing reuse + code-review-driven focus-management and Tab-order fixes present in final code |

No orphaned requirements — all 4 GUIDE IDs declared across the 5 plans' frontmatter and all 4 appear in `REQUIREMENTS.md`'s Phase 11 mapping as `Complete`.

### Anti-Patterns Found

None blocking. Two Info-level cosmetic findings from `11-REVIEW.md` remain deliberately unfixed (correctly triaged as non-blocking):

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `GuideOverlay.tsx:259` | "Voice Replies" section text | Copy says `Tap the "Voice Replies" button` but the real label is `"Voice Replies: On"`/`"Voice Replies: Off"` (IN-02) | ℹ️ Info | Minor copy imprecision — button is still findable by a sighted/keyboard user scanning the header; does not block GUIDE-01's "explains every control" |
| `Header.tsx:227-229` | Guide button JSX | Icon+label on one line vs. sibling buttons' multi-line style (IN-01) | ℹ️ Info | Purely cosmetic, `gap-2` still renders correctly |
| `backend/app/agent/service.py:148-151` | `call_claude()` no-client branch (IN-04) | Returns `(None, True)` for an unreachable defensive branch | ℹ️ Info | Pre-existing, not part of this phase's diff, unreachable given current single call site |
| `backend/app/agent/schemas.py:187-195` | `_lower_value` docstring (IN-03) | Says "one level," implementation is fully recursive | ℹ️ Info | Documentation-only nit |
| `backend/app/agent/service.py:303-319` | `Clarification` branch (WR-01) | Stores raw `result.question` in `ClarifyContext` instead of the sanitized local var | ⚠️ Warning (pre-existing) | Confirmed via `git blame` to predate Phase 11 (introduced 2026-07-20, commit `4290773`) — correctly out of this phase's scope, left as tracked debt per the reviewer's own note |

Both findings that WERE Phase-11-caused and Warning/Critical severity (CR-01 focus loss, WR-02 jump-link scroll clearance, WR-03 no focus restoration) were fixed in commit `156d752` and independently confirmed present in the current code:
- `GuideOverlay.tsx:88-94` — focuses Close button on open, restores focus to `#guide-toggle-button` on close
- `GuideOverlay.tsx:98-113,184+` — `scrollMarginTop` (`sectionScrollStyle`) applied to every jump-target section

### Human Verification Required

None outstanding. The phase's own mandatory manual-verification checkpoint (Plan 11-05, Task 2, `type="checkpoint:human-verify" gate="blocking"`, `autonomous: false`) was executed as part of this phase's own workflow — not deferred to this verification pass. Concrete evidence this actually happened (not just narrated): two real bugs were found and fixed with dedicated commits (`ffc58c8` — clearance/inert fixes; `156d752` — code-review-driven focus/scroll fixes), both independently confirmed present in the current `App.tsx`/`GuideOverlay.tsx`/`Header.tsx` by direct source reading during this verification. The subsequent `/gsd-code-review` pass provided an independent second check that caught additional real issues (CR-01, WR-02, WR-03), which were also fixed and confirmed present.

## Gaps Summary

No blocking gaps. All 4 roadmap success criteria and all 17 plan-level must-have truths across the phase's 5 plans are verified present and correctly wired in the current, final codebase state — including the two rounds of bug-fixing (Plan 11-05's own checkpoint, then the subsequent code review pass) that are reflected in the code, not just claimed in prose. The one pre-existing backend test failure (`test_config_new_fields_default_keyless`) is a local `.env` environment artifact unrelated to this phase's diff (confirmed via `git blame` — the affected code predates Phase 11 by over a month). Two Info-level cosmetic findings (IN-01, IN-02) and one pre-existing Warning (WR-01, backend clarification-context bug, unrelated to the guide feature) remain open by deliberate, documented triage — none of them affect GUIDE-01 through GUIDE-04's observable truth.

---

_Verified: 2026-08-26T01:10:00Z_
_Verifier: Claude (gsd-verifier)_
