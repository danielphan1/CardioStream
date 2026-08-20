# Phase 6: Agent Availability (Liveness Detection) - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Chris and caregivers always know — before speaking — whether the voice assistant will actually respond, replacing today's silent mislabeling of real outages as "didn't catch that."

In scope: a passive backend circuit breaker fed by real `/agent` traffic; a distinct `AgentReply.kind` (and `/health` field) for "assistant unavailable" vs. "didn't understand you"; a proactive check on page load plus a recurring poll while the tab is open; a calm, persistent, non-dismissible frontend indicator distinct from the existing transient message line, shared identically across voice and text paths.

Out of scope (explicitly deferred per REQUIREMENTS.md → v2 LIVE-05): distinguishing "not configured" (no key) from "temporarily failing" (network/billing) in the user-facing message — both collapse to the same "unavailable" copy this phase. Also out of scope: any active/self-pinging probe of Claude (rejected in discussion — see Decisions).

</domain>

<decisions>
## Implementation Decisions

### Liveness signal design (backend)
- **D-01:** Passive-only circuit breaker, fed exclusively by real `/agent` traffic outcomes — no active probe (no `count_tokens()` call) in this phase. Rationale locked in by the user: `count_tokens()` is exempt from Anthropic's billing gate, so it would report "reachable" during Chris's actual known failure mode (the $0-credit billing error) — an active probe would give false confidence for exactly the case that matters. This also satisfies LIVE-04's "never spend tokens" mandate by construction, not just by discipline.
- **D-02:** While the circuit is open (cooldown window active), `/agent` skips the real Claude network call entirely and replies "unavailable" immediately — it does not attempt-and-fail every single command during a known outage. Recovery is checked by letting the next real call through once cooldown expires (standard circuit-breaker pattern).
- **D-03:** Cooldown window ≈ 60 seconds. Chosen to line up with the frontend poll interval (D-05) and to balance "don't hammer a broken/billing-blocked service" against "a caregiver who retries right after a real fix shouldn't wait long."
- **D-04:** One failed real `/agent` call is sufficient to flip the circuit to "unavailable" — no streak/counter of consecutive failures required. Simpler state (a single `_last_outcome`, no counter), matches the standard circuit-breaker pattern from research, and self-corrects quickly since the next real call after the ~60s cooldown re-tests and can immediately flip it back. Accepted tradeoff: a single transient blip can trigger one cooldown window of "unavailable" — judged an acceptable, self-correcting cost for a low-traffic single-user site.
- **D-06 (copy):** The "no API key configured" case (known instantly, zero traffic needed — already surfaced via `/health`'s existing `agent_configured` field) and the "configured but every real call failing" case (only known after a real failure) surface as the **exact same** "assistant unavailable" message and the same reply `kind`. No copy branching between them — this mirrors LIVE-05's explicit deferral of that finer distinction to v2/whenever the paid API is active.

### Check cadence & recovery (frontend)
- **D-05:** Check liveness at page load (LIVE-03, required) AND poll `/health` on a recurring basis afterward (~60s interval, matching D-03's cooldown) while the tab stays open — not a one-shot check. So a caregiver who leaves the dashboard open finds out if the assistant recovers (or newly degrades) without needing to speak/type a command first.
- **D-07:** The "unavailable" indicator clears **instantly** the moment any real `/agent` command succeeds (reactive, from that command's own success) — it does not wait for the next scheduled poll. Reuses the signal the caregiver/Chris just personally experienced (a command that worked).
- **D-08:** The `/health` poll pauses while the tab is hidden and resumes on return, mirroring the existing `useVoiceCommand` visibilitychange convention (T-04-05) already established in this codebase — consistent pattern, and avoids polling a tab nobody is looking at.
- **Mechanical note (not asked, follows from D-01/D-02/D-05):** because the signal is passive-only and `/agent` skips real calls during cooldown, the `/health` poll during an active cooldown will keep reading the same cached "unavailable" state — actual recovery detection only happens once cooldown expires and the next real command is attempted. This is expected and correct, not a bug to fix.

### Unavailable-state presentation (frontend UI)
- **D-09:** The "assistant unavailable" indicator is a **separate, persistent UI element** near the CommandBar/mic — NOT folded into CommandBar's existing transient message line (which gets overwritten by typing, a new voice transcript, or the next command's result). This was flagged explicitly by Pitfalls research as the anti-pattern to avoid ("looks identical to a generic loading/error state... give it its own distinct, persistent UI treatment"). Detailed visual design (exact placement, styling, copy) is deferred to the UI-SPEC pass (`gsd-ui-phase`, flagged "UI hint: yes" in ROADMAP.md) — this decision locks the *architectural* choice (separate persistent element, not reusing the transient line), not the pixels.
- **D-10:** One shared indicator, visually and textually identical for both the voice path and the text path — no voice-specific extra treatment in this phase. Simpler, avoids a second copy source to keep in sync, and TTS (which would give "spoken-adjacent" treatment real meaning) doesn't land until Phase 10.
- **D-11:** The indicator has **no dismiss control** — it stays visible for exactly as long as the assistant is actually unreachable, then disappears on its own (via D-07's instant-clear-on-success or the next poll). It is calm/non-blocking by construction (REQUIREMENTS.md already bans alarming banners/sirens/modals for this), so there is nothing intrusive to dismiss, and a dismiss control would add stateful UI surface for a low-drama case.
- **Locked constraint carried from REQUIREMENTS.md/PROJECT.md (not re-discussed, already decided):** the indicator must never be an alarming "OFFLINE" banner, siren icon, or modal interrupt — calm, neutral, non-color-only messaging (word/icon, not color alone), always paired with "manual controls still work" (LIVE-02).

### Claude's Discretion
- Exact cooldown/poll interval fine-tuning around the ~60s anchor (D-03/D-05) — the user endorsed "~60 seconds" as a target, not a hard-coded exact value; small variation (e.g. 45–90s) is fine if it simplifies implementation.
- Exact shape of the new `AgentReply.kind` value (e.g. `"unavailable"`) and the corresponding `/health` field name — schema-level naming is Claude's call during planning, informed by the existing `kind: Literal["applied","clarify","refuse","unclear"]` pattern in `backend/app/agent/schemas.py`.
- Exact visual design (placement, color tokens, icon, copy wording) of the persistent unavailable indicator — architecturally locked (D-09/D-10/D-11), pixel-level design deferred to the UI-SPEC phase per ROADMAP.md's "UI hint: yes" flag on Phase 6.
- Whether the circuit-breaker module state lives directly in `agent/service.py` (mirroring the existing lazy-singleton `_client` pattern) or a small sibling module — implementation-location detail, not a product decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level requirements & state
- `.planning/PROJECT.md` — Core Value, v1.1 milestone goal, Out-of-Scope table (alarming-banner ban, "OVERLAY store field" separation convention referenced by analogy)
- `.planning/REQUIREMENTS.md` §Agent Liveness (LIVE) — LIVE-01..04 (in scope) and LIVE-05 (explicitly deferred — do not build the "not configured" vs "temporarily failing" distinction into user-facing copy)
- `.planning/ROADMAP.md` §Phase 6 — Goal, Depends on, Success Criteria (4), "UI hint: yes"
- `.planning/STATE.md` — records the exact blocker this discussion resolved ("Liveness-probe design has two candidate shapes... confirm before adding any active probe" → resolved as D-01, passive-only)

### Research (all four files scoped this phase; read before researching/planning further)
- `.planning/research/SUMMARY.md` §"Phase 1: Agent Availability Made Visible (Liveness Detection)" and §Gaps (the passive-vs-active tradeoff writeup this discussion resolved)
- `.planning/research/ARCHITECTURE.md` — Pattern 1 "Circuit breaker for agent liveness (NOT a live health-ping)", Anti-Pattern 1 "Live-pinging Claude from /health", proposed file layout (`agent/service.py` circuit breaker, `frontend/src/store/agentStatus.ts` new store, `frontend/src/hooks/useHealth.ts` new hook)
- `.planning/research/PITFALLS.md` — Pitfall 8 "A 'real' liveness check either burns paid API credits per check or gives the exact same false-positive it exists to fix" (own route, own/no rate limit, server-side TTL cache); the "looks identical to a generic loading/error state" warning behind D-09
- `.planning/research/STACK.md` §"Deep Dive 4 — Real Agent-Liveness Detection" — the `count_tokens()` billing-gate-exemption finding that directly informed D-01; the existing `billing_error` `ErrorType` already in the installed anthropic SDK

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/main.py` `/health` route — already ungated, already returns `agent_configured: bool`. Extend this response with a new field (e.g. `agent_reachable`) rather than replacing it; `agent_configured` still answers the "no key at all" case for free.
- `backend/app/agent/service.py` — has the exact guard-order structure (no key → None; `except (APIError, ValidationError)` around `messages.parse`; refusal/max_tokens check) that a circuit breaker slots into. `_get_client()`'s lazy module-level singleton (`_client`) is the established pattern to mirror for new module-level circuit-breaker state.
- `backend/app/agent/copy.py` — already has `UNAVAILABLE_MESSAGE` (currently used for the keyless case, mapped to `kind: "unclear"`). Phase 6's job is to give this its own `kind` rather than continuing to fold it into `"unclear"`.
- `backend/app/routers/agent.py` — existing `slowapi` `Limiter`/`20/minute` pattern to explicitly NOT reuse for any new liveness route (LIVE-04): give a new endpoint (or the existing `/health`) its own, separate (or absent) rate limit.
- `frontend/src/hooks/useVoiceCommand.ts` — the `visibilitychange`/`focus` listener pattern (pause on hidden, resume on foreground, cleanup on unmount) to mirror for the new `/health` poll (D-08).
- `frontend/src/lib/agent.ts` / `frontend/src/store/filters.ts` — the "one store per concern" convention (filters store stays pure command schema) that a new `store/agentStatus.ts` should follow, per ARCHITECTURE.md's proposal — a new sibling store, not a bolt-on to `useFilters`.
- `frontend/src/api/types.ts` `AgentReply` — the `kind: Literal["applied","clarify","refuse","unclear"]` union to extend with the new value; `frontend/src/components/CommandBar.tsx`'s `onSuccess` switch and `frontend/src/hooks/useVoiceCommand.ts`'s `handleSuccess` switch both need the new case added (currently exhaustive over 4 kinds).

### Established Patterns
- Fixed, server-composed copy only — never raw error text or model prose reaches the frontend (VOICE-07). The new "unavailable" copy follows `agent/copy.py`'s existing template-constant pattern (`UNAVAILABLE_MESSAGE` already exists and can likely be reused verbatim for D-06's single shared message).
- Non-color-only state signaling (word/icon + `aria-pressed`/`aria-live`, never color alone) — already the convention in `CommandBar.tsx`'s `MARKER` map; the new persistent indicator (D-09) should follow the same discipline.
- Dependency-injection-for-testability pattern (`get_interpreter`, `get_db` overridden via `app.dependency_overrides` in tests) — a new circuit-breaker read/write surface should stay test-friendly the same way.

### Integration Points
- `backend/app/main.py` — `/health` route extension point (ungated, already exists).
- `backend/app/agent/service.py` — where `interpret()` currently maps `_get_client() is None` → `unclear`/`UNAVAILABLE_MESSAGE`; this is the exact call site to redirect to the new `kind` and to record real-traffic outcomes for the circuit breaker.
- `frontend/src/App.tsx` — top-level `Dashboard` component assembly point where a new persistent indicator (D-09) and a new `useHealth()`-style poll hook (D-05/D-08) would mount, alongside the existing `Header`/`CommandBar`/`FilterBar` composition.

</code_context>

<specifics>
## Specific Ideas

No particular visual/copy references beyond what's captured in Decisions — the user deferred exact wording/visual design to planning + the UI-SPEC pass, while locking the architectural shape (separate persistent element, shared across voice/text, no dismiss, same message for both failure sources).

</specifics>

<deferred>
## Deferred Ideas

- Active `count_tokens()` liveness probe — considered and explicitly rejected for this phase (D-01). Revisit only if a future failure mode emerges that passive-only traffic-based detection can't catch (unlikely to be worth it while the known failure mode is billing, which `count_tokens()` doesn't even detect).
- Distinguishing "not configured" from "temporarily failing" in user-facing copy — already tracked in REQUIREMENTS.md as LIVE-05, v2, deferred until the paid API is active and transient failures are actually observable in production.

### Reviewed Todos (not folded)
None — no todos in the project matched Phase 6's scope (`todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 6-Agent Availability (Liveness Detection)*
*Context gathered: 2026-08-20*
