---
phase: 09-multi-dataset-overlay-filtering
verified: 2026-08-22T09:30:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Toggling any of the 3 overlay buttons by click shows/hides matching markers on whichever of BP Timeline / Pulse Trend is the current hero chart (Plan 09-06 must-have; underlies ROADMAP SC1/SC3/SC5)"
    status: failed
    reason: "App.tsx computes labsEvents/incidentsEvents/proceduresEvents from labs.data/incidents.data/procedures.data without gating on overlayDatasets.{type}, and OverlayEventsList's merged useMemo filters only on isError, never on the enabled prop. TanStack Query's enabled:false stops refetching but does NOT clear previously-cached data. Result: once a dataset has been toggled ON and fetched, toggling it back OFF while any other dataset remains ON leaves its stale ReferenceLine markers on the chart and its stale rows in the accessible table, even though its button now reads aria-pressed=\"false\". Confirmed independently by reading the code (not just trusting 09-REVIEW.md's CR-1) — this is a deterministic, code-provable bug, not a matter of visual judgment."
    artifacts:
      - path: frontend/src/App.tsx
        issue: "Lines 76-79: labsEvents/incidentsEvents/proceduresEvents/overlayEvents are derived from labs.data/incidents.data/procedures.data with no overlayDatasets.{type} gate"
      - path: frontend/src/components/OverlayEventsList.tsx
        issue: "Lines 61-76: the merged useMemo filters each dataset's contribution only on isError, never on enabled — a disabled-but-previously-fetched dataset's events still flow into the merged/sorted array and the chart-marker array"
      - path: frontend/src/hooks/useLabs.ts
        issue: "enabled:false (TanStack Query) stops future fetches but does not clear the query's cached data — the documented behavior this bug depends on"
    missing:
      - "Gate labsEvents/incidentsEvents/proceduresEvents in App.tsx on overlayDatasets.labs/.incidents/.procedures (e.g. overlayDatasets.labs ? labsToEvents(labs.data ?? []) : [])"
      - "Additionally require labs.enabled/incidents.enabled/procedures.enabled inside OverlayEventsList's merged useMemo (defense in depth, since the component is the reusable/testable unit)"
      - "Add a regression test simulating 'toggle on, fetch succeeds, toggle off while a second dataset stays on' to prevent this class of bug recurring (not covered by any existing test — all OverlayEventsList.test.tsx OFF fixtures use events: [] paired with enabled: false, which is the initial-state case, not the stale-cache case)"
deferred: []
human_verification: []
---

# Phase 9: Multi-Dataset Overlay & Filtering Verification Report

**Phase Goal:** Chris and caregivers can mix and match which data types they're looking at — by voice or click — and see them overlaid together on one timeline instead of living in separate silos.
**Verified:** 2026-08-22T09:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chris can toggle any combination of BP, pulse, labs, incidents, and procedures on or off by voice command. | ✗ FAILED | Voice infrastructure is fully built and tested (backend `ToggleDataset` schema/dispatch/prompt vocabulary, frontend `applyAgentFilters` bridge, `agent-parity.test.ts` structural gate) — see Requirements Coverage. BP/pulse voice chart-switching is a pre-existing Phase 3/4 feature reused here, per a documented, user-approved reinterpretation in `09-DISCUSSION-LOG.md` ("BP/pulse aren't real toggle items" — BP Timeline/Pulse Trend stay the two hero charts; the 3 event types are the real toggle set). However, the combination-toggle behavior itself is broken: turning a dataset OFF while another stays ON does not remove its stale markers/rows (see Gap below). This fails Plan 09-06's own declared must-have and undermines the "mix and match" core value proposition. |
| 2 | A caregiver can toggle the same combinations by click, with pressed/not-pressed state shown by word or icon, never color alone. | ✓ VERIFIED | `OverlayToggle.tsx`'s 3 buttons always render an `Icon` + text `label` regardless of pressed state (never color-only), `aria-pressed={on}` correctly mirrors `overlayDatasets[key]` — confirmed via code (`frontend/src/components/OverlayToggle.tsx:68-84`) and 12 passing behavior tests in `OverlayToggle.test.tsx`. **Note:** a related but distinct accessibility defect exists — see CR-2 under Anti-Patterns (dark-mode contrast failure) — flagged separately because it does not violate this truth's literal "never color alone" wording, but is a real, independently-recomputed WCAG violation. |
| 3 | Selected dataset types appear overlaid together on the BP Timeline and Pulse Trend charts (e.g. a hospital-stay marker plotted directly on the BP timeline). | ✓ VERIFIED (with caveat) | `BPTimeline.tsx`/`PulseTrend.tsx` both accept `overlayEvents` and render one shape+color-distinguishable `ReferenceLine` per event, hero-gated (`hero &&`), positioned after the existing `<Line>` elements (correct z-order); `ChartDeck.tsx` threads `overlayEvents` into exactly the `bp_timeline`/`pulse_trend` registry entries, leaving `bp_categories`/`am_pm_comparison` untouched. Human-verified in Plan 09-06's manual checkpoint (11-step script, user responded "approved"). **Caveat:** subject to the same stale-data gap as Truth 1 — a toggled-OFF dataset's markers can persist when mixed with an ON dataset. |
| 4 | On the BP Categories and AM/PM charts, overlay controls visibly indicate they don't apply there, instead of silently doing nothing. | ✓ VERIFIED | `OverlayToggle.tsx` computes `overlayApplies = activeChart === "bp_timeline" \|\| activeChart === "pulse_trend"`; when false, the button row dims (`opacity-60`) and an `aria-live="polite"` note renders ("Overlays aren't shown on this chart — switch to Blood Pressure or Pulse to see them."), while all 3 buttons remain fully clickable (no `disabled` attribute in either state) — confirmed via code and passing `OverlayToggle.test.tsx` cases for both note-visibility and non-disabled states. |
| 5 | Every overlaid event is also available in an accessible list/table, so keyboard and screen-reader users get full access regardless of chart-marker limits. | ✓ VERIFIED (with caveat) | `OverlayEventsList.tsx` renders a 4-column (`Date`/`Type`/`What happened`/`Notes`) `<table>` with `scope="col"` headers, `sr-only` caption, plain React text-node rendering (never `dangerouslySetInnerHTML`), 20-row pagination ("Show 20 more"/"Showing all N"), and per-type error isolation (`role="alert"` for one failed fetch never suppresses another dataset's rows) — confirmed via code and 9 passing `OverlayEventsList.test.tsx` cases. **Caveat:** same stale-data gap as Truth 1 — a toggled-off dataset's rows can persist in the table when mixed with an ON dataset, which is inaccurate/misleading even though the table mechanism itself is architecturally sound. |

**Score:** 4/5 truths verified (Truth 1 FAILED; Truths 3 and 5 carry the same root-cause caveat as Truth 1 but their own literal wording — "types appear overlaid," "every overlaid event is available" — is satisfied for the toggle-ON case, so they are not separately failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/agent/schemas.py` | `DatasetToken`, `ToggleDataset`, `AppliedFilters.overlayDataset/overlayState` | ✓ VERIFIED | All present exactly as specified; confirmed via grep (lines 49, 134, 216-217) |
| `backend/app/agent/service.py` | `_apply_toggle_dataset()` + `interpret()` dispatch branch | ✓ VERIFIED | Present and wired (lines 209, 245-246) |
| `backend/app/agent/prompt.py` | Overlay vocabulary paragraph before "Routing rules:" | ✓ VERIFIED | Present (lines 41-47, before line 61 "Routing rules:") |
| `frontend/src/api/types.ts` | `OverlayDataset` union + `AppliedFilters` fields | ✓ VERIFIED | Byte-identical field names to backend (lines 155, 165-166) |
| `frontend/src/api/client.ts` | `getLabs`/`getIncidents`/`getProcedures` | ✓ VERIFIED | Present |
| `frontend/src/lib/overlayMeta.ts` | `OVERLAY_META`/`OVERLAY_ORDER` | ✓ VERIFIED | Present, imported by both OverlayToggle and OverlayEventsList (no duplicated maps) |
| `frontend/src/store/filters.ts` | `overlayDatasets` + `setOverlayDataset` + `showAllData` reset | ✓ VERIFIED | Present (lines 29-30, 40, 48-49, 56) |
| `frontend/src/lib/agent.ts` | `"overlay"` `PulseField` + `applyAgentFilters` bridge | ✓ VERIFIED | Present (lines 79-80) |
| `frontend/src/lib/overlayEvents.ts` | `OverlayEvent` shaping + copy builders | ✓ VERIFIED | Present, 23 passing unit tests |
| `frontend/src/hooks/useLabs.ts`/`useIncidents.ts`/`useProcedures.ts` | Lazy, narrowly-keyed TanStack Query hooks | ✓ VERIFIED | Present, `enabled` gate + `DateWindow`-only key |
| `frontend/src/hooks/useCreateRecord.ts` | Cache invalidation on create | ✓ VERIFIED | `onSuccess: () => qc.invalidateQueries(...)` present for all 3 mutations |
| `frontend/src/components/OverlayToggle.tsx` | 3-button multi-select + doesn't-apply note + pulse parity | ✓ VERIFIED | All behaviors present and test-covered |
| `frontend/src/components/OverlayEventsList.tsx` | Accessible paginated table, conditional mount, error isolation | ⚠️ WIRED but data-flow HOLLOW for the toggle-off case | Component logic is correct in isolation (its own tests only exercise `enabled:false` paired with `events:[]`, the initial-state case); the real defect is upstream in how `App.tsx` supplies stale `events` for a disabled type — see Gap |
| `frontend/src/components/charts/BPTimeline.tsx`/`PulseTrend.tsx` | `overlayEvents` prop + hero-gated `ReferenceLine` | ✓ VERIFIED | Present, correct z-order, `hero &&` gate |
| `frontend/src/components/ChartDeck.tsx` | `overlayEvents` threaded to `bp_timeline`/`pulse_trend` only | ✓ VERIFIED | `bp_categories`/`am_pm_comparison` entries untouched |
| `frontend/src/App.tsx` | Full Dashboard() wiring | ⚠️ WIRED but data-flow HOLLOW | All components mounted at correct positions; the overlay-off gate is missing (Gap) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `service.py` | `schemas.py` | `isinstance(result, ToggleDataset)` dispatch | ✓ WIRED | Confirmed, lines 245-246 |
| `lib/agent.ts` | `store/filters.ts` | `s.setOverlayDataset(f.overlayDataset, f.overlayState === "on")` | ✓ WIRED | Confirmed, lines 79-80 |
| `lib/agent-parity.test.ts` | `store/filters.ts` | `STORE_ACTIONS` includes `setOverlayDataset` | ✓ WIRED | Confirmed, structural gate passes |
| `components/OverlayToggle.tsx` | `store/filters.ts` | `onClick={() => setOverlayDataset(key, !overlayDatasets[key])}` | ✓ WIRED | Confirmed |
| `components/OverlayEventsList.tsx` | `lib/overlayEvents.ts` | `mergeOverlayEvents`/`buildEmptyMessage`/`buildErrorMessage` | ✓ WIRED (logic) / ⚠️ HOLLOW (data) | The link itself is correctly wired, but the data flowing through it from `App.tsx` is not correctly gated on toggle state (Gap) |
| `ChartDeck.tsx` | `charts/BPTimeline.tsx` | `hero: ({ readings, overlayEvents }) => <BPTimeline ... overlayEvents={overlayEvents} />` | ✓ WIRED | Confirmed |
| `App.tsx` | `ChartDeck.tsx` | `<ChartDeck ... overlayEvents={overlayEvents} />` | ✓ WIRED (logic) / ⚠️ HOLLOW (data) | Same root cause as above |
| `App.tsx` | `components/OverlayEventsList.tsx` | `<OverlayEventsList labs=... incidents=... procedures=... />` | ✓ WIRED (logic) / ⚠️ HOLLOW (data) | Same root cause as above |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ChartDeck` hero markers | `overlayEvents` | `App.tsx`'s `mergeOverlayEvents(labsEvents, incidentsEvents, proceduresEvents)` | Yes, but not correctly gated on `overlayDatasets` — includes stale data for toggled-off types | ⚠️ HOLLOW (stale, not empty) |
| `OverlayEventsList` table rows | `labs`/`incidents`/`procedures` props | Same `App.tsx` computation | Yes, same gating defect | ⚠️ HOLLOW (stale, not empty) |
| `OverlayToggle` button `aria-pressed` | `overlayDatasets[key]` | `store/filters.ts` `useFilters` | Yes, correctly reflects click/voice state | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend test suite green | `cd backend && pytest -q` | `253 passed, 7 skipped, 35 deselected` | ✓ PASS |
| Frontend type-check clean | `cd frontend && npx tsc --noEmit` | No output (clean) | ✓ PASS |
| Frontend test suite green | `cd frontend && npx vitest run` | `24 files, 263 tests passed` | ✓ PASS |
| WCAG contrast of dark-mode overlay colors vs. hardcoded white text | Independently recomputed (relative-luminance formula) for `#C9A6EA`/`#F0A8D0`/`#C9D48A` vs `#FFFFFF` | 2.07:1 / 1.87:1 / 1.58:1 — all fail the 3:1 large-text/UI-component floor and the 4.5:1 normal-text floor | ✗ FAIL (confirms CR-2, see Anti-Patterns) |
| Toggle-off stale-data bug | Static code trace: `App.tsx:76-79` + `OverlayEventsList.tsx:61-76` vs. TanStack Query's documented `enabled:false` cache-retention behavior | No gate on `overlayDatasets.{type}`/`enabled` anywhere in the merge path | ✗ FAIL (confirms CR-1, see Gap) |

Marker shape/color/position on-chart rendering itself was not re-spot-checked live (Recharts renders 0×0 in jsdom, a documented project constraint) — this was already human-verified in Plan 09-06's checkpoint and is not re-litigated here.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| OVERLAY-03 | 09-01, 09-02, 09-04, 09-06 | Multi-select toggle controls, voice or click, independent of active chart | ⚠️ PARTIALLY SATISFIED | Voice/click toggle mechanisms are fully built and test-covered; the underlying "show any combination" promise is broken for toggle-off-while-mixed scenarios (Gap) |
| OVERLAY-04 | 09-02, 09-03, 09-05, 09-06 | Selected dataset types overlay together on BP Timeline/Pulse Trend; non-color-only toggle encoding | ⚠️ PARTIALLY SATISFIED | Chart marker rendering is correctly built for the toggle-ON case (human-verified); toggle-OFF combination case is broken (Gap). Non-color-only encoding (word/icon + aria-pressed) is satisfied. |
| OVERLAY-05 | 09-04, 09-05 | Overlay controls on BP Categories/AM-PM visibly indicate non-applicability | ✓ SATISFIED | Confirmed via code + tests |
| OVERLAY-06 | 09-03, 09-04, 09-06 | Accessible list/table of every overlaid event | ⚠️ PARTIALLY SATISFIED | Table mechanism (columns, pagination, plain-text rendering, error isolation) is correctly built; content can include stale rows for a toggled-off dataset (Gap) |

No orphaned requirements — REQUIREMENTS.md maps exactly OVERLAY-03/04/05/06 to Phase 9, and all four appear in plan frontmatter (09-01 through 09-06).

### Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| `frontend/src/App.tsx` | 76-79 | Stale TanStack Query cache flows through un-gated on `overlayDatasets` | 🛑 BLOCKER | Toggling a dataset OFF while another remains ON does not remove its markers/rows — directly contradicts Plan 09-06's own must-have and the phase's core "mix and match" promise (see Gap in frontmatter) |
| `frontend/src/components/OverlayEventsList.tsx` | 61-76 | `merged` useMemo filters only on `isError`, never on `enabled`/toggle state | 🛑 BLOCKER | Same defect, second half of the data path — confirms this isn't a one-line typo but a missing gate at both the caller and the reusable component |
| `frontend/src/components/OverlayToggle.tsx` | 29-30, 77-78 | Hardcoded `text-white` on a per-dataset inline `backgroundColor` fill | 🛑 BLOCKER | Dark-mode active-button fill (`#C9A6EA`/`#F0A8D0`/`#C9D48A`) against white text yields 1.58:1–2.07:1 contrast — independently recomputed, fails WCAG's 3:1 UI-component floor. Violates CLAUDE.md's explicit non-negotiable "high contrast" accessibility constraint. |
| `frontend/src/components/OverlayEventsList.tsx` | 163-168 | Same hardcoded `color: "white"` pattern on the Type-column badge | 🛑 BLOCKER | Same contrast failure, second surface (18px non-bold table text — 4.5:1 floor applies, even further from compliant) |
| `frontend/src/lib/agent.ts` (composeConfirmation, not directly modified this phase but consumed by `toggle_dataset` replies) | ~89-145 | Voice/text confirmation template has no overlay clause | ⚠️ WARNING | A caregiver saying "show my labs" gets no spoken/on-screen acknowledgment that labs were toggled on beyond the separate `aria-live` sentence in `OverlayToggle` — degrades voice-first UX but does not block the toggle itself functioning |
| `frontend/src/App.tsx` | 76-79 | `labsEvents`/`incidentsEvents`/`proceduresEvents`/`overlayEvents` recomputed unmemoized on every `Dashboard` render | ⚠️ WARNING | Defeats `OverlayEventsList`'s own documented pagination-reset guard on unrelated re-renders (e.g. background refetch) — "Show 20 more" can silently reset; a UX papercut, not a functional break |
| `frontend/src/lib/agent-parity.test.ts` | — | No `DATASETS` `it.each` reachability block or `DatasetToken`⇄`OverlayDataset` read-file parity test | ⚠️ WARNING | Test-coverage gap in the file whose stated purpose is catching exactly this class of drift; values match today but future drift wouldn't be caught |
| `frontend/src/App.tsx` | 71 | `const window = {...}` shadows the global `Window` | ℹ️ INFO | No live bug today; footgun for a future `window.*` call inside `Dashboard` |
| `backend/app/agent/schemas.py` | 168 | Docstring understates `_lower_value`'s actual recursion depth | ℹ️ INFO | Cosmetic; implementation is more correct than documented |

No `TBD`/`FIXME`/`XXX` debt markers found in any file modified by this phase.

### Human Verification Required

None. All findings in this report are deterministically code-provable (data-flow tracing, independently recomputed WCAG contrast ratios) and do not require subjective human judgment to confirm. The one behavior class that genuinely has no automated test path in this codebase — chart marker shape/color/position rendering (Recharts renders 0×0 in jsdom) — was already human-verified and approved in Plan 09-06's manual checkpoint, and no evidence in this verification contradicts that sign-off for the toggle-ON case.

### Gaps Summary

Six of six plans executed, both automated suites (253 backend / 263 frontend tests) are green, and the phase's voice/click toggle infrastructure, chart-marker rendering, "doesn't apply here" indicator, and accessible table are all genuinely built — this is a substantial, mostly-correct implementation, not a stub. However, two BLOCKER-class defects, both already caught by this phase's own code review (`09-REVIEW.md`) and independently re-confirmed here by direct code inspection rather than trusting that document, remain unfixed in the codebase as submitted:

1. **Stale overlay data survives toggle-off when mixed with another active dataset** (CR-1): `App.tsx` and `OverlayEventsList.tsx` never gate a dataset's contribution to the merged chart-marker array / table rows on its `overlayDatasets`/`enabled` flag — only on TanStack Query's `isError`. Because disabling a query does not clear its cache, a caregiver who turns "Labs" off while "Incidents" stays on will see stale lab markers/rows persist despite the Labs button correctly reading `aria-pressed="false"`. This is exactly the failure mode Plan 09-06's own must-have ("Toggling any of the 3 overlay buttons by click shows/hides matching markers...") was meant to prevent, and it directly undermines the phase's stated goal of letting Chris "mix and match" reliably. The fix is a small, well-scoped, two-file change (add the missing gate in both `App.tsx` and `OverlayEventsList.tsx`), not a redesign.

2. **Dark-mode WCAG contrast failure on overlay buttons/badges** (CR-2): the three `--overlay-*` dark-theme color tokens were chosen as light pastels (correct for chart-line/marker legibility against a dark background) but are reused as a solid fill behind hardcoded white text in `OverlayToggle.tsx`'s active-button state and `OverlayEventsList.tsx`'s Type badge. Independently recomputed contrast ratios (1.58:1–2.07:1) confirm all three fail even the relaxed 3:1 UI-component floor, let alone the 4.5:1 body-text floor — a direct violation of CLAUDE.md's non-negotiable "high contrast" constraint. Light mode is unaffected. The fix is likely a theme-aware ink token (mirroring the existing `--cat-chip-text` pattern, which already solves this exact problem for category chips) swapped in for the hardcoded `text-white`/`color: "white"`.

Both are narrowly scoped, mechanically fixable defects in already-working code, not missing features — a follow-up plan closing these two gaps (plus, optionally, the three WARNING-level items) should be short.

---

*Verified: 2026-08-22T09:30:00Z*
*Verifier: Claude (gsd-verifier)*
