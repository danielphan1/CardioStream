# Phase 9: Multi-Dataset Overlay & Filtering - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Chris and caregivers can turn labs, incidents, and procedures on/off as overlay layers — by voice or click — independent of which chart is active, and see them plotted directly on the BP Timeline and Pulse Trend charts instead of living in separate silos. Every overlaid event is also available in an accessible list/table so keyboard and screen-reader users get full access regardless of chart-marker limits (OVERLAY-06). On the two non-timeline charts (BP Categories, AM/PM), overlay controls visibly indicate they don't apply there rather than silently doing nothing (OVERLAY-05).

In scope: a new multi-select overlay toggle control (3 items: labs, incidents, procedures), voice support for it via a new agent schema action, marker rendering on the two timeline charts' hero view, and the accessible list/table equivalent.

Out of scope (confirmed during this discussion, locked by REQUIREMENTS.md/PROJECT.md, not re-discussed): edit/delete on labs/incidents/procedures records (Phase 7/8 boundary, unchanged); cross-dataset statistical correlation — visual co-location only, never implying correlation; click/focus a marker for a full non-hover detail panel (OVERLAY-07, deferred to v2 — this phase's marker interaction stops at what's visually shown plus the accessible list, not a detail drill-down); a single combined store field conflating "which chart is active" with "which datasets are overlaid" (`activeChart` stays single-select; overlay visibility is a separate, independent multi-select field).

</domain>

<decisions>
## Implementation Decisions

### Overlay chart architecture
- **D-01:** The multi-select overlay toggle set is the 3 event types only — labs, incidents, procedures. REQUIREMENTS.md's OVERLAY-03 wording ("BP, pulse, labs, incidents, procedures") is reinterpreted: BP Timeline and Pulse Trend stay exactly as they are today, two separate hero charts switched via the existing `activeChart` picker — no new combined-metric chart, no dual-axis merge. Event-type markers plot onto whichever of those two charts is currently the hero. Matches ROADMAP.md's own success-criterion example ("a hospital-stay marker plotted directly on the BP timeline").
- **Locked directly from OVERLAY-03 text (not re-discussed):** overlay toggle state is independent of which chart is active — it's a global multi-select, not scoped per-chart. Switching from BP Timeline to Pulse Trend does not reset or hide which overlay layers are on.
- **D-02:** Overlay markers render on the hero chart only, never on `ChartDeck`'s small preview cards (those stay decorative/`pointer-events-none`, no tooltip, per their existing Pitfall-8 contract — adding markers there would just be uninspectable clutter at that size).

### Voice toggle grammar
- **D-03:** One dataset per voice command (incremental), not a combined multi-dataset utterance. "Add incidents", "show labs", "turn off procedures" — each command toggles exactly one dataset. Resolves the research-flagged toggle_dataset agent-schema shape question: the new action's dataset field is single-valued (a `Literal` token), matching every existing `DashboardCommand` field (`chart`, `bp_category`, `am_pm` are all single-valued) — no list-typed field, no exposure to the unverified structured-outputs list-constraint question research flagged.
- **D-04:** Each command sets an explicit ON/OFF state, never a flip/toggle. "Show incidents" / "add incidents" always turns it ON; "hide incidents" / "remove incidents" always turns it OFF. Idempotent and predictable — Chris doesn't need to track current overlay state to avoid a repeated command silently undoing itself.

### Overlay marker look & feel
- **D-05:** The 3 marker types are visually distinguishable by shape AND color, not color alone (OVERLAY-04's non-color-only requirement) — shape carries the meaning, color reinforces it, colorblind-safe.
- **D-06:** Each event renders as a full-height vertical reference line at its date/time (a Recharts `ReferenceLine`, not a `Scatter` series), with a small icon+label at the top. This resolves the research-flagged "overlay accessibility mechanism" open question (ReferenceLine+accessible-list vs. Scatter+`accessibilityLayer`) in favor of the ReferenceLine approach — full detail/accessibility for these markers comes from the separate accessible list/table (OVERLAY-06), not from `accessibilityLayer` keyboard navigation of a Scatter series.

### Default state & reset behavior
- **D-07:** No overlay layers are on at first load — matches every other filter's neutral-default convention (`datePreset: "all"`, `amPm: "all"`, `bpCategory: "all"` in `store/filters.ts`).
- **D-08:** The existing "show all data"/reset voice command and button also clears overlay toggles (all 3 off), alongside its existing date/AM-PM/category reset — one predictable "start over" command returns the whole dashboard to its neutral state.

### Claude's Discretion
- Exact visual treatment of the "doesn't apply here" indication on BP Categories and AM/PM charts (OVERLAY-05 requires *some* visible indication, not silent no-op) — e.g. disabled+dimmed toggle buttons with explanatory text vs. a different visible-but-inert styling. Planning's call.
- Exact icon/glyph choice per event type (e.g. a flask for labs, an alert/hospital icon for incidents, a clipboard icon for procedures) — visual polish within D-05's shape+color contract, not a locked product decision.
- Whether the new overlay toggle row lives inside `FilterBar` itself or as an adjacent control group — mirrors `FilterBar`'s segmented `aria-pressed` button styling contract, but this is genuinely the codebase's first true multi-select group (existing `FilterBar` groups are all single-select/radio-style); exact component boundary is implementation detail.
- Data-fetching shape for overlay data — separate `useLabs`/`useIncidents`/`useProcedures` hooks (mirroring `useReadings.ts`'s per-filter `queryKey`/`staleTime` convention) vs. one combined hook — standard TanStack Query pattern, no user preference expressed.
- Whether toggling a layer on triggers an immediate fetch vs. relying on a prefetch — technical/performance decision for research/planning, not a product decision. Flagged in Phase 8's CONTEXT.md: `useReadings.ts`'s 5-minute `staleTime` is currently justified only by "data changes on Phase-5 uploads" — this phase adds new mutation sources (Phase 8's record-creation forms) that the overlay's own fetch hooks need to account for, so planning should not inherit that stale justification unexamined.
- Whether a lightweight hover/focus tooltip on a marker (e.g. just showing type + date) is added on top of the accessible list — reasonable UX nicety, but must stop well short of OVERLAY-07's deferred "full detail in a non-hover panel."

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level requirements & state
- `.planning/PROJECT.md` — Core Value, v1.1 milestone goal, accessibility constraints (≥48px targets, ≥18px body text, high contrast, keyboard nav, no drag/hover-only/precision interactions), Out-of-Scope: "one combined store field conflating 'which chart is active' with 'which datasets are overlaid'" (D-01/activeChart boundary)
- `.planning/REQUIREMENTS.md` §Multi-Dataset Filtering & Overlay (OVERLAY) — OVERLAY-03..06 (this phase's requirements, verbatim text drove D-01's reinterpretation and the "independent of active chart" lock); OVERLAY-01/02 (Phase 7/8, already shipped — the API and forms this phase's overlay reads from); Out-of-Scope table (edit/delete deferred, no cross-dataset correlation, OVERLAY-07 click-detail-panel deferred to v2)
- `.planning/ROADMAP.md` §Phase 9 — Goal, Depends on (Phase 7 GET endpoints; Phase 8 recommended complete first), 5 Success Criteria, "UI hint: yes", and the "folded from research" note flagging the two design decisions this discussion resolved (D-01/D-06)

### Phase 7 (API this phase reads from)
- `.planning/phases/07-records-backend-labs-incidents-procedures-crud/07-CONTEXT.md` — D-04: GET filter scope is date-range only (no resource-specific filters exist server-side) — overlay data fetching must filter labs/incidents/procedures by the same date range as the active dashboard filters, nothing more granular is available
- `backend/app/deps.py` — `ReadingFilters`/`LabFilters`/`IncidentFilters`/`ProcedureFilters` date-range-filter pattern (Phase 7) to reuse for fetching overlay data

### Phase 8 (forms that populate the data this phase displays)
- `.planning/phases/08-manual-entry-forms/08-CONTEXT.md` — the `useReadings.ts` staleTime caveat (see Claude's Discretion above); established accessible-forms conventions (≥48px, `aria-pressed`, non-color-only) this phase's new overlay controls must also meet

### Agent schema (new toggle_dataset action)
- `backend/app/agent/schemas.py` — `DashboardCommand`/`AgentOutput` closed-union pattern (structured-outputs-safe: lowercase snake_case `Literal` tokens, no numeric bounds, no list constraints); the new toggle action must follow this file's existing single-valued-field convention (D-03) and its "unmentioned fields stay None → carry over" semantics
- `frontend/src/api/types.ts` — `AppliedFilters`/`AgentReply` TS mirror of the above; a new field for the overlay toggle delta needs to be added here in the same byte-identical-mirror discipline already established

### Existing code this phase extends (read before implementing)
- `frontend/src/store/filters.ts` — `activeChart` single-select field stays untouched; the new overlay toggle state is an independent field per the locked Out-of-Scope rule
- `frontend/src/components/FilterBar.tsx` — segmented `aria-pressed`/`role="group"` button styling contract (`inactiveClass`/`activeClass`) to mirror for the new overlay toggle row; also the agent-pulse-flash pattern (`useAgentPulse`) that should extend to the new toggle group so agent-driven overlay changes read as one system with manual clicks
- `frontend/src/components/ChartDeck.tsx` — hero/mini registry; markers render in the hero slot only (D-02), never in the `pointer-events-none` mini previews
- `frontend/src/components/charts/BPTimeline.tsx` — `ReferenceArea` band pattern and its documented JSX-z-order pitfall (bands/lines render in JSX order) — the new `ReferenceLine` markers need the same ordering discipline; `ChartTooltip.tsx`'s click-persistent tooltip pattern is a possible template if a lightweight marker tooltip is added
- `frontend/src/components/charts/PulseTrend.tsx` — needs the identical marker treatment as BPTimeline (OVERLAY-04 names both charts explicitly)
- `frontend/src/components/charts/CategoryBars.tsx`, `frontend/src/components/charts/AmPmComparison.tsx` — where OVERLAY-05's "visibly indicate overlay doesn't apply here" treatment needs to render
- `frontend/src/hooks/useReadings.ts` — the `useQuery`/`queryKey`/`staleTime` TanStack Query convention to mirror for new `useLabs`/`useIncidents`/`useProcedures` read hooks (none exist yet — Phase 8 only added create hooks)
- `frontend/src/api/types.ts` — `LabResult`/`Incident`/`Procedure` response types already defined (Phase 7/8); no new backend types needed, only new frontend read hooks/query wiring

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/FilterBar.tsx` — direct template for the new overlay toggle row's button styling and `aria-pressed`/`role="group"` structure, though it will be the first genuinely multi-select control group in the codebase (existing groups are all single-select/radio-style).
- `frontend/src/components/charts/BPTimeline.tsx` / `PulseTrend.tsx` — direct extension points for `ReferenceLine` markers; both already use Recharts' `ReferenceArea` so the rendering mechanics (JSX z-order, numeric time x-axis) are established.
- `frontend/src/hooks/useReadings.ts` — direct template for the 3 new read hooks this phase needs (`useLabs`, `useIncidents`, `useProcedures`).
- `backend/app/agent/schemas.py` — direct template for the new toggle_dataset action: add a new closed-union member (or field) following the existing `Literal`-token, lowercase-snake-case, no-list-constraint discipline.

### Established Patterns
- `≥48px` / `aria-pressed` / non-color-only state signaling on every interactive control (established across `FilterBar`, `AddRecordPage`'s type switcher, reiterated as a hard constraint by OVERLAY-04/05 for this phase's new controls).
- Agent-pulse-flash (`useAgentPulse`) — voice/agent-driven filter changes visually pulse the matching manual control group; the new overlay toggle row should participate in this system per D-01's "voice or click" parity requirement.
- Naive local date/datetime handling (DATA-05) — overlay markers' dates come from `LabResult.date`/`Incident.datetime`/`Procedure.date`, all naive-local per Phase 7's schema; no timezone conversion needed when positioning `ReferenceLine`s.

### Integration Points
- `frontend/src/store/filters.ts` — add a new independent overlay-toggle field (shape TBD by planning: e.g. a `Set`/`Record` of the 3 dataset keys) alongside the existing single-select fields.
- `backend/app/agent/schemas.py` `AgentOutput.result` union — new action member for toggle_dataset, single-valued per D-03/D-04 (a dataset token + explicit on/off).
- `frontend/src/components/charts/BPTimeline.tsx` and `PulseTrend.tsx` — both need the same new `overlayEvents`-shaped prop and `ReferenceLine` rendering block.
- `frontend/src/components/charts/CategoryBars.tsx` / `AmPmComparison.tsx` — need the OVERLAY-05 "doesn't apply" indicator wired to the same overlay-toggle store state.

</code_context>

<specifics>
## Specific Ideas

No particular visual/copy references beyond what's captured in Decisions — the locked decisions (event-types-only overlay set, one-dataset-per-command explicit ON/OFF voice grammar, shape+color ReferenceLine markers, neutral defaults) fully specify the shape. Exact copy wording, icon choices, and pixel-level spacing are deferred to planning / the UI-SPEC pass (ROADMAP.md flags "UI hint: yes" for this phase).

</specifics>

<deferred>
## Deferred Ideas

- Click/focus a marker to see full incident/lab/procedure detail in a non-hover panel (OVERLAY-07) — already tracked in REQUIREMENTS.md's v2 Deferred section; this phase's marker interaction stops at the accessible list/table (OVERLAY-06).
- A combined multi-metric chart merging BP and pulse onto one shared timeline — considered and explicitly rejected during this discussion (D-01) in favor of keeping BP Timeline/Pulse Trend as today's two separate hero charts.
- Cross-dataset statistical correlation (e.g. auto-detecting "BP spikes near incidents") — already out of scope per REQUIREMENTS.md, clinically risky to imply without care-team review.

### Reviewed Todos (not folded)
None — no todos in the project matched Phase 9's scope (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 9-Multi-Dataset Overlay & Filtering*
*Context gathered: 2026-08-21*
