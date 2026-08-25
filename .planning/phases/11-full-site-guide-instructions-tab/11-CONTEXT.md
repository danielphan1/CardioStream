# Phase 11: Full Site Guide / Instructions Tab - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Chris and his caregivers can learn how to use every part of the site — including what to say by voice — from a built-in guide, without interrupting a live voice session to do it.

In scope: a full-screen guide overlay reachable by click and voice, explaining every control/filter/chart/upload flow; a "what can I say" voice-command reference reusing one shared source (not a second, divergent list); guide is reachable and navigable without unmounting the live voice session; same accessibility bar as the rest of the site.

Out of scope (locked by REQUIREMENTS.md, not re-discussed): voice-triggered contextual help reachable mid-task without opening the guide (GUIDE-05, deferred to v2 — this phase's voice command stops at open/close, no section-deep-linking); staged/contextual onboarding hints beyond the static guide (GUIDE-06, deferred to v2).

</domain>

<decisions>
## Implementation Decisions

### Guide overlay mechanism
- **D-01:** The guide renders as a full-screen overlay, not a `useView` swap, not a centered modal, not a slide-in drawer. The dashboard component tree stays mounted underneath — this is the load-bearing decision that satisfies GUIDE-03 (existing `useView` hard-swaps the whole tree via early `return`s in `App.tsx`, which would unmount `CommandBar` and kill the live recognizer; a full-screen overlay avoids that by rendering alongside, not replacing).
- **D-02:** Opened via a new Header-right button (mirrors the Theme/Voice Replies toggle's existing styling contract — icon + text label, `aria-pressed`, bordered not accent-fill). Closed via a visible X/Close button (large target) plus the Escape key. No backdrop-click-to-close — a full-screen overlay has no backdrop to click.
- **D-03:** The `CommandBar`/mic status stays visible while the guide is open — NOT hidden behind it. Chris can always see mic state (listening/speaking/paused) and issue a voice command while reading, consistent with voice being the primary input method, not a background afterthought.
- **D-04:** The pinned `CommandBar` sits at the TOP of the guide overlay, matching its existing top-anchored position on the dashboard ("top billing for the primary control" per `App.tsx`'s comment) — Chris finds the mic in the same place regardless of what's on screen.

### Voice open/close for the guide
- **D-05:** Opening/closing the guide by voice is a NEW Claude agent action, mirroring Phase 9's `toggle_dataset` / Phase 10's `toggle_speech` precedent exactly: explicit `Literal["open","closed"]` state, never a flip/toggle. NOT a client-side keyword bypass — Phase 10 D-01 explicitly warned that a local shortcut "would be the first command in the app to break the 'server is sole authority' invariant," and no client-side-only voice command exists anywhere in this codebase today to build on instead.
- **D-06:** The new action's scope stops at open/close only — no section-jumping or deep-linking (e.g. "show me what I can say" does NOT jump straight to the voice-command reference). Section-jump-style behavior reads as the more sophisticated "contextual help" REQUIREMENTS.md already reserves for GUIDE-05 (v2-deferred); this phase does not build toward it.
- **D-07:** If Chris issues any other dashboard command (e.g. "show my pulse") while the guide is open, the command applies normally AND the guide auto-closes, so Chris sees the result immediately without a separate close command.

### Voice-command reference source
- **D-08:** `CommandBar.tsx`'s `EXAMPLES` array (currently 4 short placeholder-rotation items — incomplete vocabulary, missing overlay toggles/TTS mute/category filters/guide open-close) is extracted into a new shared, exported module (e.g. `frontend/src/lib/voiceCommands.ts`) covering every command category in the app. Both `CommandBar`'s placeholder rotation AND the guide's reference section import from this ONE source. This is what makes GUIDE-02's "reuse the existing centralized command-copy source, not a second divergent list" literally satisfiable — today's `EXAMPLES` isn't actually complete/reusable as-is.
- **D-09:** The guide's voice-command reference is grouped by category (e.g. "Switching charts", "Filtering by date", "Blood pressure category", "Showing labs/incidents/procedures", "Voice replies", "Opening this guide") — not a flat list.
- **D-10:** Each category shows ONE canonical example phrase, paired with a short "similar phrasings work too" note — matches the existing project philosophy (Phase 9 D-01: exact phrasing is Claude's job via the system prompt, no fixed keyword list to lock) rather than implying only that exact wording is accepted.

### Content structure & depth
- **D-11:** Guide content is one scrollable page with a jump-to-section table-of-contents at the top — not an accordion, not tabs. Fewest interactive states to build/test, simplest keyboard/voice navigation (link + scroll only), nothing hidden behind an extra expand/collapse click.
- **D-12:** Text-only — no screenshots or diagrams. Avoids a screenshot-maintenance burden that Phase 12 (Visual Refresh, the very next phase) would otherwise instantly invalidate, and keeps content parity between sighted and screen-reader users (no alt-text burden either).
- **D-13:** Every section follows the same fixed format: what it does → how to use it by click → how to use it by voice (when applicable — e.g. Upload has no voice equivalent and that section simply omits the voice line).

### Claude's Discretion
- Exact section copy/wording for each guide topic — content-writing detail, not a locked product decision.
- Exact icon choice for the new Header guide-open button and exact table-of-contents visual styling — cosmetic, mirrors existing Header/Theme-toggle conventions.
- Exact shape/naming of the new agent action's schema field (e.g. a dedicated `GuideVisibility` action vs. folding into an existing field) — technical implementation, planner's call, following the `ToggleDataset`/`ToggleSpeech` closed-union template.
- Whether the guide overlay is reachable from every `view` (`dashboard`/`upload`/`records`) or only from `dashboard` — see the code_context note below: the live mic session only exists on the dashboard view today, so the "don't unmount the voice session" constraint is dashboard-specific in practice. Planning's call whether to scope the guide-open button/action to dashboard only or make it universally reachable for consistency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & product context
- `.planning/REQUIREMENTS.md` §Full Site Guide (GUIDE) — GUIDE-01 through GUIDE-04 (this phase's locked requirements); GUIDE-05 (contextual mid-task help, v2-deferred — directly informs D-06's scope boundary); GUIDE-06 (staged onboarding hints, v2-deferred)
- `.planning/PROJECT.md` — Core Value (voice interaction is primary, not a gimmick — informs D-03's "mic stays visible" decision), Constraints (accessibility floor: ≥48px targets, ≥18px body text, high contrast, keyboard nav, no drag/hover-only/precision interactions)
- `.planning/ROADMAP.md` §Phase 11 — Goal, Depends on (Phase 9 overlay controls, Phase 10 mute toggle — both must be documented in the guide's content), 4 Success Criteria, "UI hint: yes"

### Precedent to mirror
- `.planning/phases/09-multi-dataset-overlay-filtering/09-CONTEXT.md` — D-03/D-04 (explicit on/off voice-toggle grammar, single-valued closed-enum schema field) — the direct precedent for D-05
- `.planning/phases/10-spoken-replies-tts/10-CONTEXT.md` — D-01 (explicit warning against client-side keyword bypasses, "server is sole authority" invariant) — the direct precedent/constraint for D-05; D-02/D-03 (Header toggle button styling/persistence pattern) — precedent for D-02
- `backend/app/agent/schemas.py` — `ToggleDataset` and `ToggleSpeech` (and their registration in the `AgentOutput` union) — the exact shape the new guide open/close action should follow (D-05)

### Integration surface (read before implementing)
- `frontend/src/store/view.ts` and `frontend/src/App.tsx` (~lines 240-241) — the `useView` hard-swap pattern that D-01 deliberately does NOT use for the guide; shows exactly why a view-swap would kill the mic (early `return`s replace the whole tree)
- `frontend/src/components/Header.tsx` — `LogoutConfirmDialog` (the codebase's one existing "modal mounted alongside the dashboard, doesn't unmount it" precedent — closest existing analog to the guide overlay, even though sized differently); the Theme/Voice Replies toggle buttons (styling template for D-02's new guide-open button)
- `frontend/src/components/CommandBar.tsx` — the `EXAMPLES` array (~line 43) to be extracted per D-08; the CommandBar component itself, which needs to render inside the guide overlay per D-03/D-04
- `backend/app/agent/prompt.py` — `SYSTEM_PROMPT`, where the new guide open/close action's vocabulary teaching is added (mirrors how `toggle_dataset`/`toggle_speech` were taught)
- `frontend/src/lib/agent.ts` — `applyAgentFilters`, where the new action's fan-out branch is added (mirrors the `speechEnabled`/dataset-toggle branches from Phases 9/10)
- `frontend/src/lib/voice.ts` — documented trust boundary ("the server /agent ... stays the sole authority") that D-05 explicitly preserves

No external specs/ADRs beyond the above — this project has no dedicated ADR directory; REQUIREMENTS.md and PROJECT.md are the canonical product docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Header.tsx`'s `LogoutConfirmDialog` — the closest existing precedent for "an overlay mounted alongside the dashboard that doesn't unmount it" (Escape-to-close, focus-trapped) — direct template for D-01/D-02's close behavior, even though the guide itself is full-screen rather than a small centered box.
- `CommandBar.tsx`'s `EXAMPLES` array — direct extraction target for D-08's shared voice-command module.
- `backend/app/agent/schemas.py`'s `ToggleDataset`/`ToggleSpeech` — direct template for the new guide open/close agent action (D-05).
- `Header.tsx`'s Theme/Voice Replies toggle buttons — direct template for the new guide-open button's markup/styling (D-02).

### Established Patterns
- Explicit on/off, never toggle/flip, for every voice-driven state change (Phase 9 D-04, Phase 10 D-01) — applies directly to D-05's new action.
- `≥48px` / `aria-pressed` / non-color-only state signaling on every interactive control.
- Fixed friendly copy discipline (VOICE-07) — any new guide/action copy follows this; raw errors are never rendered or spoken.
- `useView`'s hard-swap pattern is the established convention for OTHER new screens (Upload in Phase 5, Records in Phase 8) but this phase deliberately does NOT extend that pattern (D-01) — the guide is architecturally different from every prior new-screen phase.

### Integration Points
- **Important finding for planning:** `CommandBar` (and therefore the live mic session) only renders inside `App.tsx`'s default return branch, which is only reached when `view === "dashboard"` — the `if (view === "upload") return ...` / `if (view === "records") return ...` early returns mean no live voice session exists on those two views today. This means GUIDE-03's "don't unmount the voice session" constraint is, in practice, dashboard-specific — informs the open discretion item above about whether the guide needs to be reachable from Upload/Records at all.
- `frontend/src/App.tsx` — where the guide overlay's conditional render is added; likely needs to sit outside/above the existing `view === ...` branching so it can render on top of the dashboard specifically (see finding above).
- `frontend/src/lib/agent.ts`'s `applyAgentFilters` fan-out — where the new guide-visibility branch is added, following the exact `!= null` present-value-delta discipline already used for `speechEnabled`/dataset toggles.

</code_context>

<specifics>
## Specific Ideas

No particular visual/copy references beyond what's captured in Decisions — every question asked was answered with the recommended, precedent-consistent option. The guide's shape is fully specified by D-01 through D-13: full-screen overlay with a persistent top-pinned mic, opened/closed by a new closed-enum agent action, a single shared voice-command reference grouped by category, and one scrollable text-only page with a fixed per-section format.

</specifics>

<deferred>
## Deferred Ideas

- Voice-triggered contextual help reachable mid-task without opening the guide tab — already tracked in REQUIREMENTS.md as GUIDE-05 (v2); this phase's voice action stops at plain open/close (D-06).
- Staged/contextual onboarding hints beyond the static guide — already tracked in REQUIREMENTS.md as GUIDE-06 (v2); not re-raised here.
- Section-jump/deep-link voice commands within the guide (e.g. "show me what I can say") — considered and explicitly deferred during this discussion (D-06) as reading too close to GUIDE-05's territory.

### Reviewed Todos (not folded)
None — no todos in the project matched Phase 11's scope (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 11-Full Site Guide / Instructions Tab*
*Context gathered: 2026-08-25*
