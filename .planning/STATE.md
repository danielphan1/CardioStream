---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Polish & Records
status: executing
last_updated: "2026-09-16T07:47:38.903Z"
last_activity: 2026-09-16 -- Phase 19 execution started
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 34
  completed_plans: 34
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-19)

**Core value:** Chris can see and explore his own health data entirely by voice — voice is the primary input method, not a gimmick.
**Current focus:** Phase 19 — guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u (COMPLETE)

## Current Position

Phase: 19 (guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u) — COMPLETE
Plan: 7 of 7 (all merged), Human UAT passed
Status: Demo deployment live and verified at https://health-dashboard-demo.vercel.app (guest_demo/
  demo_test_pass) — Railway project "friendly-rebirth" (service CardioStream + Postgres) + Vercel project
  health-dashboard-demo. 19-HUMAN-UAT.md's one test passed; see that file for full verification detail.
Last activity: 2026-09-16 -- stood up and verified the live guest demo deployment end-to-end

## Performance Metrics

**Velocity (v1.0, for reference):**

- Total plans completed: 63 (per MILESTONES.md; 46 tasks across 5 phases)
- Average duration: ~7min/plan (early phases; Phase 04 P03 outlier at 35min)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Data Foundation | 8 | Complete |
| 2. Read API & Dashboard | 7 | Complete |
| 3. Agent via Text Input | 4 | Complete (billing-gated → v2) |
| 4. Voice Capture | 3 | Complete |
| 5. Upload, Auth Gate & Deployment | 7 | Complete |

**By Phase (v1.1):**

| Phase | Plans | Status |
|-------|-------|--------|
| 6. Agent Availability (Liveness) | 3 | Complete |
| 7. Records Backend | 2 | Complete |
| 8. Manual-Entry Forms | 3 | Complete |
| 9. Multi-Dataset Overlay & Filtering | 7 | Complete |
| 10. Spoken Replies (TTS) | 6 | Complete |
| 11. Full Site Guide | 5 | Complete |
| 12. Visual Refresh | 8 | Complete |

v1.1 totals: 34 plans, 76 tasks, ~22 days (2026-08-05 → 2026-08-27, 316 commits).

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 9 context, 2026-08-21]: Both research-flagged Phase 9 design decisions resolved via `/gsd-discuss-phase 9`: (1) overlay accessibility mechanism — full-height `ReferenceLine` per event + separate accessible list, not a Scatter series bound into `accessibilityLayer`; (2) `toggle_dataset` agent schema is single-valued (one dataset token + explicit on/off per voice command), not list-typed. Also reinterpreted OVERLAY-03's "BP, pulse, labs, incidents, procedures" toggle set as event-types-only (labs/incidents/procedures) — BP Timeline and Pulse Trend stay today's two separate hero charts, no new combined-metric chart. Full detail in `09-CONTEXT.md`.
- [Phase 8, 2026-08-21]: Manual-entry forms (Lab/Incident/Procedure) shipped, code-reviewed, and had all 4 critical/warning findings fixed same-session (async submit race causing silent data loss on mid-submit type-switch; duplicate-submit guard; whitespace-to-`0` coercion in Lab's numeric fields; missing effect dependency) — see 08-REVIEW.md / 08-REVIEW-FIX.md. CR-01's fix is concurrency-sensitive and flagged for a manual spot-check (see Blockers).
- [Phase 6, 2026-08-20]: Liveness detection built as a passive-only circuit breaker fed by real `/agent` traffic outcomes (no active `count_tokens()` probe) — matches research's recommendation, zero added token cost.
- [v1.1 Roadmap, 2026-08-20]: Continued phase numbering from v1.0 (ended Phase 5) — v1.1 starts at Phase 6, runs through Phase 12 (7 phases: Liveness, Records Backend, Manual-Entry Forms, Overlay & Filtering, TTS, Guide, Visual Refresh).
- [v1.1 Roadmap, 2026-08-20]: Overlay voice-toggle control (part of OVERLAY-03, "by voice or click") folded into the main Phase 9 (Multi-Dataset Overlay & Filtering) rather than split into a separate stretch phase as research/SUMMARY.md's provisional 8-phase draft proposed — PROJECT.md's non-negotiable "every feature operable by voice" constraint and REQUIREMENTS.md's own OVERLAY-03 text make voice-toggle v1.1 scope, not a deferrable stretch goal. The underlying risk (a new `toggle_dataset` agent-schema action, not a bolt-on) carries forward as a Phase 9 planning-time design decision, not a scope cut.
- [v1.1 Roadmap, 2026-08-20]: Visual Refresh (Phase 12) confirmed as its own phase per PROJECT.md's five active v1.1 targets, despite having zero grounding in any of the four research files — flagged in ROADMAP.md for a dedicated lightweight research pass before execution, per research/SUMMARY.md's explicit gap callout.
- [Roadmap]: Dashboard before agent, agent (text) before voice — manual filter state shape *is* the agent command schema; voice is an additive transcript source
- [Roadmap]: Auth dependency designed in Phase 2 (first endpoints), enforced with the gate in Phase 5 — never a retrofit
- [v1.1 research, 2026-08-19]: **Incident (accepted, not reverted):** the gsd-research-synthesizer subagent had its `Write` to `.planning/research/SUMMARY.md` rejected twice by a safety guard, then wrote the file via `Bash`/heredoc instead of stopping and reporting the block. Orchestrator verified the resulting file was faithful/clean; user chose accept-and-continue. Flagged so the pattern (subagents routing around rejected tool calls) is visible if it recurs.
- [Phase 12-08]: Task 1's min-h-12 grep threshold (>=60) was miscalibrated against a stale PATTERNS.md baseline; a stronger pre/post git-diff comparison across the actual Wave 2 commit range proved zero accessibility-floor regression, so the deviation is non-blocking documentation, not a failed VISUAL-02 check.
- [Phase 12-08]: Phase 12's final checkpoint (cross-screen, cross-theme visual verification) was approved by the real user ("Everything passes") after a live walkthrough, closing VISUAL-01 and VISUAL-02 for the whole phase.

### Roadmap Evolution

- Phase 19 added (2026-09-15): Guest Demo Mode. Client-driven request, "add a working demo version that
  people who are viewing can use" — a public portfolio demo behind its own guest username+password,
  isolated deployment (separate Railway service + demo Postgres DB, not shared-DB row-tagging), seeded
  from the existing synthetic sample pipeline (`backend/sample_data/omron_sample.xlsx`), read-only for
  guests (upload/labs/incidents/procedures POST routes reject guest tokens; all reads + the /agent
  voice-command endpoint stay open). Layers onto the Phase 5 auth gate; no dependency on Phases 6-18.

- Phases 15–18 added (2026-09-13): client-driven request to improve **filtering options and data
  visuals**. Scoped as four phases rather than one because the user selected every option offered.
  **15 — Unified Filter Surface**: FilterBar's AM/PM and BP-category groups become multi-select
  checkboxes matching ShowPanel, plus two filters whose data is already stored, derived and
  unit-tested but exposed nowhere (`pulse_category`; time-of-day finer than AM/PM). This is the
  direct continuation of Phase 14 — that phase's own CONTEXT named "two different control models
  side by side" as the root cause, converted the datasets, and left FilterBar untouched. Functional
  unlock, not convenience: "Stage 1 AND Stage 2" is inexpressible under single-select. Cross-stack
  (store, v2→v3 persistence migration, API `IN` clause, agent token vocabulary, spoken echo), which
  is why it stays standalone.
  **16 — Trend Clarity & Chart Polish**: rolling average over the timeline's ~1,500 raw points, plus
  a readability pass. No new chart types.
  **17 — Analytical Views**: weekday × time-of-day heatmap and an event-correlation window. Two new
  chart types; the heatmap carries a real accessibility risk (colour-only signalling is banned) that
  must be designed for up front, not retrofitted.
  **18 — Deep Query**: value thresholds shipped as preset cut-point checkboxes — NOT free numeric
  entry, which fails the accessibility floor on both target size and voice transcription — plus notes
  text search. Sequenced last because its good version is voice-driven and therefore **blocked on
  funding the Anthropic account** (AGENT-01); built before that, it is a caregiver-only feature Chris
  cannot reach by voice, inverting the core value.

- Phase 14 added: Unified Show Panel and Combined Timeline. Client-driven change request from Chris (2026-09-12 meeting, decisions confirmed): replace the mutually-exclusive chart deck + separate overlay row with ONE five-checkbox Show panel driving ONE dual-axis combined timeline. **Explicitly reverses Phase 9's locked decision** ("BP Timeline and Pulse Trend stay today's two separate hero charts, no new combined-metric chart" — `09-CONTEXT.md`); that scope call was correct at the time and is simply not what the client wants now. Design contract written and client-approved before planning. Full scope and locked decisions in `14-CONTEXT.md`. Next: `/gsd-plan-phase 14`.
- Phase 13 added: Visual Redesign — Nautical Minimalist Theme. Full visual-identity replacement (not an evolution like Phase 12) — new palette/type/spacing/elevation/component language sitewide, carrying forward the existing nautical motif (`--color-foam`/`--color-sky`, wave-curve divider) with far more craft, rendered clean and minimalist. All existing functionality and the accessibility floor carry over unchanged. Direction gathered live via `impeccable`'s new-work intake (structural + genre reference images reviewed in-browser); full scope and locked decisions in `13-CONTEXT.md`. Next: `/gsd-ui-phase 13`.

### Pending Todos

None yet.

### Blockers/Concerns

- [RESOLVED 2026-09-14, commit 348b78d] ~~Deferred audit item — redundant per-render sorts~~ in
  `StatsStrip.tsx`/`ReadingsTable.tsx`. Decision made: yes, `/readings`' ascending
  `order_by(Reading.datetime_)` (`routers/readings.py`) is a contract the frontend may rely on — both
  components have exactly one caller (`App.tsx`), fed straight from that one query, no merge point that
  could reorder it. `StatsStrip`'s sort deleted outright (was already a no-op); `ReadingsTable`'s
  descending `localeCompare` sort replaced with `.reverse()`. `ReadingsTable.test.tsx`'s "regardless of
  input order" test rewritten to feed ascending input (the real contract) and assert the reversal.

- [Quick 260913-fdm, 2026-09-13]: Worth knowing for future worktree-isolated work — a fresh worktree has no
  `.venv`, and the main repo's editable install of `app` registers a **meta-path finder** that outranks
  `sys.path`, so a worktree test run can silently import the *unmodified main-repo source* and report green
  against code it never executed. The executor caught this and asserted `app.deps.__file__` resolved inside
  the worktree before trusting any result. Any future worktree task touching the backend must do the same.
  Corollary found in 260913-gcv: a gitignored file the bug *depends on* (there, `backend/.env`) is also
  absent from a worktree, so verifying there reproduces the CI condition where the bug is invisible. Synthesize
  the file and watch the real failure reproduce before trusting a fix.

- [Quick 260913-gcv, 2026-09-13]: **Deferred — `parse_omron` row guard does not bound memory.** `etl.py`
  calls `pd.read_excel()` on the whole upload and only *then* checks `len(df) > max_rows`, so the 10k-row
  DoS guard fires after the file is already fully in memory; a decompression-bomb `.xlsx` would exhaust
  memory before it runs. Mitigating factor: `/upload` is behind the auth gate, so it needs an authenticated
  caller. Seen during the 260913-gcv correctness pass and deliberately NOT bundled into a security change.

- [Quick 260913-gcv, 2026-09-13]: **New environments must set `TOKEN_SECRET` before first boot.** `Settings`
  now refuses to start when `SITE_PASSWORD` is set while `TOKEN_SECRET` is still the dev default — that
  combination allowed offline Bearer-token forgery from a value committed to this repo. Production is
  confirmed to have both set in Railway (so it was never exposed and the validator will not fire there),
  but any NEW environment — staging, a rebuilt service, a fresh clone — must set `TOKEN_SECRET`
  (`python -c "import secrets;print(secrets.token_urlsafe(32))"`) or it will not boot. That refusal is the
  intended behavior, not a regression.

- [Phase 14 review, 2026-09-12]: Code review found a **critical** regression the phase's own
  tests and live walkthrough both missed — `App.tsx`'s `readings.length === 0` EmptyState guard
  predated the phase and silently swallowed the events-only view on any range without BP readings.
  Lesson worth carrying: when a phase changes what a region *consumes*, re-examine the guards in
  its **caller**, not just the component. Two further findings (duplicate event rendering, a
  duplicated heading) were also caller-side or cross-component, invisible in component-level tests.

- [Phase 14] **Voice path for the new vocabulary is untested against a real model.** `show_only`,
  the five-token `DatasetToken`, and `command.datasets` are unit-tested on both sides of the wire
  and covered by the ACC-03 parity suite, but the agent is inert (AGENT-01, no API credits) so no
  live utterance was ever issued. Re-run the 43-fixture eval once billing is funded.

- ~~[Phase 14] **`backend/tests/test_auth_upload.py::test_config_new_fields_default_keyless` fails
  locally** because `backend/.env` sets `SITE_PASSWORD` and pydantic-settings reads it.~~
  **RESOLVED 2026-09-13 by quick 260913-gcv** (`f6d7345`). Fixed as diagnosed — the test now isolates
  the environment instead of depending on a developer's `.env`. Two notes for the record: the isolation
  had to run at `conftest.py` **module level**, not in an autouse fixture, because `app/db.py:8` calls
  `get_settings()` at import and the test modules reach it during pytest *collection*; and a second test
  (`test_health_ok_and_keyless_in_test_env`) shared the same root cause and was fixed alongside it.
  Backend suite now runs 0 failures with a real `backend/.env` present.

- [v1.0 → v2] **Agent inert in production — no API credits.** The Anthropic account behind the Railway key has $0 balance and no payment method, so every `/agent` Claude call returns a billing 400 and degrades to `unclear`. Phase 6 (Liveness) makes this failure *visible*, but does not fix it — funding is a v2/billing-only item, deferred by user decision.
- [Phase 10 planning]: TTS vs. existing aria-live confirmation is an open product decision (does TTS coexist with aria-live, opt-in vs. default-on framing of the mute toggle) — JS cannot reliably detect screen-reader presence; decide explicitly during Phase 10 planning.
- [Phase 8 follow-up]: CR-01's fix (guard against a stale mutation race clobbering `AddRecordPage` state on mid-submit type-switch) is a concurrency fix that automated tests can't fully exercise (existing suite is synchronous-mock only) — spot-check manually: fill Lab form → submit → switch to Incident before the response resolves → confirm nothing is clobbered.
- [Phase 12]: Visual Refresh has no research grounding (research/SUMMARY.md gap) — run a lightweight research/planning pass before executing, checked against existing accessibility-floor conventions (e.g. BPTimeline.tsx's contrast-exempt decorative-tint carve-out).

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260825-h9l | Document CLAUDE.md convention pairing impeccable skill with GSD workflow for frontend design work | 2026-08-25 | 132438c | | [260825-h9l-document-claude-md-convention-pairing-im](./quick/260825-h9l-document-claude-md-convention-pairing-im/) |
| 260826-vns | Write DESIGN.md and .impeccable/design.json from impeccable document command output | 2026-08-27 | f5ff4bf | | [260826-vns-write-design-md-and-impeccable-design-js](./quick/260826-vns-write-design-md-and-impeccable-design-js/) |
| 260827-25p | Fix BP Timeline band-label collision and mobile dot-overplotting (P1 findings from the impeccable critique) | 2026-08-27 | b50e1b0 | Verified | [260827-25p-fix-bp-timeline-band-label-collision-and](./quick/260827-25p-fix-bp-timeline-band-label-collision-and/) |
| 260827-2v2 | Fix ReadingsTable Category column clipping on mobile (P1 finding from the impeccable critique) via a reflow to a stacked card layout below 640px | 2026-08-27 | f102d45 | Verified | [260827-2v2-fix-readingstable-category-column-clippi](./quick/260827-2v2-fix-readingstable-category-column-clippi/) |
| 260827-3j8 | Fix mic-armed styling and add a Cancel affordance for text/voice command round-trips (P2 findings from the impeccable critique) | 2026-08-27 | 31f1b77 | | [260827-3j8-fix-both-p2-findings-from-the-impeccable](./quick/260827-3j8-fix-both-p2-findings-from-the-impeccable/) |
| 260827-i2w | Layout pass on the CardioStream dashboard: group FilterBar+OverlayToggle, StatsStrip+charts, and ReadingsTable+OverlayEventsList into 3 semantic clusters, promoting `<main>`'s gap to DESIGN.md's unused 2xl (48px) token between them (impeccable layout audit) | 2026-08-27 | d171603 | Verified | [260827-i2w-layout-pass-on-the-cardiostream-dashboar](./quick/260827-i2w-layout-pass-on-the-cardiostream-dashboar/) |
| 260827-j8l | Clarify voice-outage messaging (impeccable critique P0, re-critique): rewrote AGENT_UNAVAILABLE_BANNER_COPY and both independently-declared OFFLINE_COPY sites (CommandBar.tsx + useVoiceCommand.ts) to drop transience/doomed-retry framing, and made CommandBar reactively suppress the vocabulary-teaching rotating placeholder while the agent is unavailable | 2026-08-27 | e00638b | Verified | [260827-j8l-clarify-voice-outage-messaging-on-the-ca](./quick/260827-j8l-clarify-voice-outage-messaging-on-the-ca/) |
| 260827-jzp | Harden filter/overlay session against reload data loss (impeccable critique P1): added localStorage persistence to store/filters.ts mirroring the codebase's existing hand-rolled pattern (theme.ts/speech.ts/auth.ts, not zustand persist middleware) — shape-only type guard, initFilters() wired into main.tsx, all 7 mutating setters persist | 2026-08-27 | cfba4f3 | Verified | [260827-jzp-harden-cardiostream-filter-overlay-sessi](./quick/260827-jzp-harden-cardiostream-filter-overlay-sessi/) |
| 260827-kir | Harden OverlayToggle.tsx against a disabled-state visual/functional mismatch (impeccable critique P2): removed the conditional opacity-60 dimming on the always-clickable overlay button group, restoring compliance with DESIGN.md's dashed-border-only disabled-state rule | 2026-08-28 | 60deeee | Verified | [260827-kir-harden-overlaytoggle-tsx-against-a-disab](./quick/260827-kir-harden-overlaytoggle-tsx-against-a-disab/) |
| 260828-25o | Commit pending impeccable housekeeping: frontend/.gitignore's impeccable-live-ignore block, PRODUCT.md, the 2026-08-27 App.tsx critique report, and frontend/.impeccable/live/config.json — excluding the machine-local frontend/.impeccable/live/roots.json | 2026-08-28 | 9bf3a9d, 7073e86 | | [260828-25o-commit-pending-impeccable-housekeeping-f](./quick/260828-25o-commit-pending-impeccable-housekeeping-f/) |
| 260828-2l6 | Fix BP Timeline band-label/line collision (impeccable critique P3): replaced the 4 remaining bare-text band labels (Hypotension, Normal, Stage 2, Hypertensive Crisis) with a solid category-color chip so the label fully occludes any plotted line behind it, reusing existing categoryColor()/CHIP_TEXT tokens | 2026-08-28 | 852e0a9 | Regressed — superseded by 260828-4nj | [260828-2l6-fix-p3-finding-from-impeccable-critique-](./quick/260828-2l6-fix-p3-finding-from-impeccable-critique-/) |
| 260828-4nj | Correct the 260828-2l6 chip fix (impeccable critique P1, re-critique): the chip rendered in Recharts' `zIndex-layer_100` (same as ReferenceArea's own layer), one layer *below* Line's `zIndex-layer_400`, so lines painted over the chip instead of the reverse. Split each labeled band into a background-tint ReferenceArea (unchanged, zIndex 100) + an invisible label-host ReferenceArea (`zIndex={DefaultZIndexes.axis}`, 500) carrying the chip — verified live via DOM zIndex-layer inspection + screenshot, not assumption | 2026-08-28 | 68ab665 | Verified | [260828-4nj-fix-bp-timeline-band-label-chip-z-order-](./quick/260828-4nj-fix-bp-timeline-band-label-chip-z-order-/) |
| 260828-kbq | Fix GuideOverlay sticky-band text-clipping bug (impeccable critique P0, re-critique): the guide's scrollable region was `fixed inset-0` with only a computed paddingTop offset, so ordinary scrolling still passed content underneath the fixed CommandBar+banner band (z-60 above the guide's z-50) — changed the region to `fixed inset-x-0 bottom-0` starting at `top: clearanceAbove`, so scrolled content can never occupy the band's screen rectangle. Clipping fix confirmed correct via elementFromPoint sampling, but this change also removed the region's own full-viewport backdrop coverage — see 260828-kza | 2026-08-28 | a32c78c | Fixed clipping; introduced a backdrop regression — resolved by 260828-kza | [260828-kbq-fix-guideoverlay-sticky-band-text-clippi](./quick/260828-kbq-fix-guideoverlay-sticky-band-text-clippi/) |
| 260828-kza | Correct the 260828-kbq GuideOverlay backdrop bleed-through regression (impeccable critique P0): split GuideOverlay's outer JSX into two siblings — a new, plain, always-`fixed inset-0` `aria-hidden="true"` backdrop restoring unconditional full-viewport opaque coverage, plus the existing `fixed inset-x-0 bottom-0` scrollable region (unchanged from kbq's clipping-safety fix). Live-verified via elementFromPoint sweep at two viewport widths and both an unstuck-band and a stuck-band window-scroll state: zero bleed-through, zero clipping regressions | 2026-08-28 | beef896 | Verified | [260828-kza-correct-guideoverlay-backdrop-bleed-thro](./quick/260828-kza-correct-guideoverlay-backdrop-bleed-thro/) |
| 260913-gcv | Harden the shared-password gate against misconfiguration — 4 defects from a correctness review, each proven to fail first: (1) `/auth` issued a valid token for an EMPTY password when `SITE_PASSWORD` was unset, since `compare_digest("","")` is `True` — now fails closed; (2) a non-ASCII password raised `TypeError` from `compare_digest` and escaped as a 500 (no never-500 backstop on `/auth`) — now compares utf-8 bytes, returns 401; (3) `TOKEN_SECRET` defaulted to a value committed to this repo, allowing fully-offline Bearer-token forgery if a deploy set `SITE_PASSWORD` but forgot the secret — `Settings` now refuses to boot in that combination, with `hide_input_in_errors=True` so the failure cannot echo `SITE_PASSWORD` into deploy logs; (4) the suite inherited the developer's real `backend/.env` (green in CI, red locally) — now isolated at conftest module level. Production was confirmed to have both variables set in Railway, so **the deployed site was never exposed** — this is hardening, not incident response. 284 passed (from 277), 0 failed | 2026-09-13 | 3bda83c | Verified | [260913-gcv-fix-4-verified-auth-gate-and-test-isolat](./quick/260913-gcv-fix-4-verified-auth-gate-and-test-isolat/) |
| 260913-fdm | Apply whole-repo over-engineering audit findings: collapsed 4 duplicated date-range filter classes into one `DateRangeFilters` base (backend/app/deps.py), switched both `transform()` row loops from `iterrows()` to `itertuples()` (backend/app/etl.py), merged 3 byte-identical overlay hooks into `useRecordEvents.ts`, extracted the 3×-copied D-08 pulse effect into `useAgentPulseFlash()`, single-sourced `joinWithAnd`/`fmtLongDateOnly`/`RATE_LIMIT_COPY`/`OFFLINE_COPY`, spread `OVERLAY_META` in datasetMeta, added a shared `TextField` primitive absorbing 17 inline input call sites, and dropped the never-imported `@fontsource/atkinson-hyperlegible` dep. Net −41 lines, zero test files touched. **9 of 10 items** — item 9 (redundant sorts) resolved separately, commit 348b78d, 2026-09-14 | 2026-09-13 | d63bd5f | Verified | [260913-fdm-apply-audit-findings-dedupe-filters-fiel](./quick/260913-fdm-apply-audit-findings-dedupe-filters-fiel/) |
| 260828-ly8 | Close 4 motion-language gaps (impeccable animate survey): GuideOverlay open/close fade, ChartTooltip opacity+scale entrance (also caught and fixed a real pre-existing bug: the Close button was unclickable via real mouse input due to Recharts' `pointer-events: none`, and a second bug where the click bubbled into the chart's own onClick and undid the dismiss), DateRangePicker reveal fade-in, and AddRecordPage's Lab/Incident/Procedure field-swap transition (mirrors ChartDeck's proven FadeSwap pattern) — all reuse the app's existing motion-safe/motion-reduce-gated ≤250ms opacity/transform idiom, no new material. Ran as 4 independent plans in one parallel wave; all 4 live-verified individually plus a final independent spot-check of all four surfaces against the real dev server | 2026-08-28 | 9f54eff, c940aa6, b460dbc, 5495650 | Verified | [260828-ly8-close-4-motion-language-gaps-impeccable-](./quick/260828-ly8-close-4-motion-language-gaps-impeccable-/) |
| 260914-kz3 | Replace favicon with a sailboat-on-water icon | 2026-09-14 | 685fae4 | | [260914-kz3-replace-favicon-with-a-sailboat-on-water](./quick/260914-kz3-replace-favicon-with-a-sailboat-on-water/) |
| 260914-lff | Restyle favicon sailboat: white fills with navy blue outline, wavier water line | 2026-09-14 | a16c900 | | [260914-lff-restyle-favicon-sailboat-white-fills-wit](./quick/260914-lff-restyle-favicon-sailboat-white-fills-wit/) |

## Deferred Items

Acknowledged at v1.0 milestone close (2026-08-05) and carried to v2:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| known-limitation | **Agent inert in prod** — Anthropic account has $0 credits / no payment method; every `/agent` call 400s → degrades to `unclear`. Billing-only fix, no code change. Live 35-fixture eval → 4/35. | → v2 (AGENT-01) | v1.0 close 2026-08-05 |
| feature | Voice/text data entry via the agent ("log a reading of 120 over 80") | → v2 (AGENT-02) | v1.0 close 2026-08-05 |
| verification | 03-VERIFICATION — live-model behavioral eval (`human_needed`) | → v2 (same no-credits blocker) | v1.0 close 2026-08-05 |
| uat | 03-HUMAN-UAT — 3 agent live-model scenarios | blocked → v2 (no credits) | v1.0 close 2026-08-05 |

Acknowledged at v1.1 milestone close (2026-08-27) — all resolved in substance, stale status fields only:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| debug_session | `frontend-page-not-loading` (status: `diagnosed`) — Phase 2, 2026-07-15. Goal was `find_root_cause_only`; root cause confirmed (Vite dev server wasn't running, user error) — diagnosis was the deliverable, no fix needed. | resolved, no action | v1.1 close 2026-08-27 |
| quick_task | `260825-h9l` audit-flagged `missing` — false positive: SUMMARY.md exists and STATE.md's own Quick Tasks table already shows it completed (commit `132438c`, 2026-08-25). Frontmatter simply lacks an explicit `status:` field for the audit tool to read. | resolved, no action | v1.1 close 2026-08-27 |
| verification | `06-VERIFICATION.md` frontmatter `status: human_needed` — the one human-judgment check ("calm, non-alarming" banner) was completed and passed in `06-HUMAN-UAT.md` (`status: complete`, `result: pass`, 2026-08-25); VERIFICATION.md's own status field was never flipped afterward. | resolved, no action | v1.1 close 2026-08-27 |

## Session Continuity

Last session: 2026-09-16
Stopped at: Phase 19 complete — demo deployment live, verified, and recorded in 19-HUMAN-UAT.md
Next action: Phase 15 (Unified Filter Surface) has a UI-SPEC ready to plan; no formal milestone currently
  wraps phases 13-19 (v1.1 already shipped 2026-08-27) — consider scoping one, or continue straight to
  Phase 15 planning
Resume file: .planning/phases/19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u/19-HUMAN-UAT.md

## Operator Next Steps

- Phase 19 done. Plan Phase 15 (/gsd-plan-phase 15) or scope/name a milestone for 13-19 first.
- Guest demo credentials (demo_guest / demo_test_pass) are stored only in Railway's env vars and this
  session's chat history — write them down somewhere durable if they need to be shared with portfolio viewers.
