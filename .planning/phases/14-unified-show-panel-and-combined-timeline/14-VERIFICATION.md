---
phase: 14
status: passed
date: 2026-09-12
method: automated suites + live browser walkthrough (localhost:5173 against a real backend)
---

# Phase 14 Verification — Unified Show Panel and Combined Timeline

## Goal

> Chris can turn any dataset on or off independently — by voice or by checkbox — and see any
> combination on one chart, including blood pressure and pulse together and events on their own.

**Verdict: achieved.**

## The three client asks

| Ask (Chris's words) | Before | Now | Evidence |
|---|---|---|---|
| "mix the hospital stays and only the pulses" | worked | works | Pulse + Incidents renders markers over the bpm axis |
| "only see the blood pressures **and** pulses" | **impossible** | **works** | Live: both lines on one chart, mmHg left + bpm right |
| "versus the hospital stays" (events alone) | **impossible** | **works** | Live: chart replaced by dated list, heading flips to "Events" |

## Automated

| Suite | Before | After |
|-------|--------|-------|
| Frontend (vitest) | 383 passed | **468 passed**, 36 files |
| Backend (pytest) | 252 passed | **278 passed** |
| `tsc -b --noEmit` | clean | clean |
| `oxlint` | clean | clean |
| `vite build` | — | succeeds |

One backend failure, `test_config_new_fields_default_keyless`, is **pre-existing and unrelated**:
it asserts `site_password == ""` while the local `backend/.env` sets `SITE_PASSWORD=dev-local-test`,
which `pydantic-settings` reads. Confirmed identical on stashed pre-change code. Not caused by,
and not in scope for, this phase.

## Live browser walkthrough

Dev server + real backend, 132 seeded readings.

- **Both vitals on one chart** — mmHg axis left (220/180/140/120/90), bpm axis right (120/90/60),
  navy systolic, teal diastolic, rust **dashed** pulse, AHA bands with chips, 60 bpm bradycardia
  line. The pulse dash is visibly distinct from systolic at a glance.
- **Events-only** — unticking both vitals swapped the chart for the dated list and the heading
  from "Timeline" to "Events". Empty-range copy rendered correctly (dev DB has no incidents).
- **Nothing selected** — "Nothing selected" heading plus a working "Show everything" button.
  Never a blank panel.
- **Not-applicable note** — on BP Categories the note renders AND all five checkboxes report
  `disabled: false`. The D-01 lock (indicator, never a gate) holds live, not just in tests.
- **Live sentence** — updated correctly through every transition, including the events-only
  variant: "Showing incidents — no vitals selected, so these are listed by date."
- **v1 → v2 migration ran for real.** The browser held a genuine pre-Phase-14 blob with
  `activeChart: "bp_timeline"`; on first load it came back as Blood Pressure on / Pulse off with
  the date range preserved. The migration was exercised against real persisted data, not a fixture.

## Two findings worth recording

**1. A hidden tab makes the chart look broken.** The first live screenshot showed an empty chart
area. It was not a bug: Recharts' entrance animation is rAF-driven, the automation tab reported
`document.visibilityState === "hidden"`, so rAF never ticked and every line sat at
`stroke-dasharray: "0px <total>px"` — zero visible length. Path `d` coordinates were correct
throughout. Forcing `prefers-reduced-motion` (skipping the animation) rendered the chart
immediately and correctly, with pulse at exactly `"9 5"`. Anyone screenshotting this app from a
background tab will see the same thing; it is not a defect.

**2. Marker-axis binding was a real bug, caught by test.** The first implementation pinned event
markers to the mmHg axis, on the reasoning that a mounted-but-hidden axis would still anchor them.
It does not — a `ReferenceLine` on a `hide`-den axis renders nothing, silently. That dropped every
event marker whenever Blood Pressure was unchecked, i.e. exactly the "pulse and hospital stays"
combination the client asked for. Fixed by binding markers to whichever axis is visible; the
regression is locked by a parameterised test across all three vital combinations.

## Accessibility floor

- Five real `<input type="checkbox">` in ≥48px `min-h-12` labels (asserted in tests, confirmed live).
- Checkboxes never disable in any state (live-confirmed on a summary view).
- Every distinction encoded twice: solid vs **dashed** stroke, ◆ ▲ ■ glyphs, plus label text.
  Glyph spans are `aria-hidden`, so the accessible name is the label text alone.
- `--line-pulse` contrast-verified at 5.64:1 / 5.01:1 light and 8.56:1 / 7.73:1 dark, all clear of
  the 3:1 non-text UI floor; systolic and diastolic brought under the same test for the first time.
- `aria-live="polite"` on the selection sentence and the not-applicable note.

## Not verified — and why

**Voice.** Every `show_only` / `toggle_dataset` / `datasetsOn` path is covered by unit tests on both
sides of the wire, and the ACC-03 parity suite proves each of the five datasets is reachable through
the single `applyAgentFilters` surface. But the agent remains inert in production and locally: the
Anthropic key has no credits (AGENT-01), so `/health` reports `agent_configured: false` and the
command bar shows the unavailable banner. **No live voice command was issued against a real model.**
That gap is pre-existing and billing-only; it is not closed by this phase.

## Follow-ups

- Marker density with all three event types over a long range on a phone (noted as a risk in
  `14-CONTEXT.md`; not exercised because the dev DB has no event records).
- Labs as a trend line rather than a marker (D-09, deferred) — the likely next client request.
- `Incidents` label vs Chris's "hospital stays" (D-07) — one-word change if he wants his phrase.
