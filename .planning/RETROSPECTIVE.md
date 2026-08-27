# Retrospective — Health Visualizer

## Milestone: v1.0 — MVP

**Shipped:** 2026-08-05
**Phases:** 5 | **Plans:** 29 | **Tasks:** 46 | **Timeline:** ~29 days (2026-07-07 → 2026-08-05, 227 commits)

### What Was Built
- Privacy-safe, TDD'd OMRON ETL foundation (verified AHA derivations, idempotent merge, hygiene-safe row rejection) seeded with 132 synthetic-but-representative readings.
- Four-chart accessible dashboard (Recharts) with a fully keyboard-operable filter bar; the manual filter state doubles as the agent command schema.
- Claude `/agent` pipeline (structured outputs, server-side symbolic date resolution, triple never-500 backstop) + CommandBar five-state machine — built and code-verified.
- Continuous-listening voice capture (Chrome/Edge + Safari/iOS restart loop) verified on a real iPhone.
- Caregiver upload flow, shared-password Bearer gate on every route, Vercel + Railway deploy, live curl smoke test, SEC-03 privacy audit.

### What Worked
- **TDD on the data layer** (ETL / derivations / merge) — boundary-heavy medical logic shipped with high confidence and essentially zero rework.
- **"Dashboard → text agent → voice" sequencing** — debugging the Claude pipeline with zero voice complexity, then adding voice as a pure transcript source, kept each phase observable.
- **Manual filter store as the single mutation surface** — voice/agent became pure consumers; no re-architecture when voice landed.
- **Day-one privacy discipline** (gitignore + synthetic sample committed first) — full-history audit stayed clean; SEC-03 passed on the live deploy.

### What Was Inefficient
- **The core feature was gated on an unfunded paid API — and it hid.** `agent_configured:true` only checks the key is *present*; the account had **$0 credits**, so the deployed agent silently degraded every command to `unclear`. This wasn't caught until the milestone-close live UAT (**4/35**), *after* the DEPL-02 walk had been informally signed off. A single real end-to-end command check on the live deploy would have surfaced it much earlier.
- **False-green health check.** `/health` reported success on key-presence alone, and the never-500 backstop masks billing/auth failures as ordinary "didn't understand" — no visible signal that the agent was down.

### Patterns Established
- Live smoke test that curls every route with its **real HTTP method** (router-level auth dependency 405s a method mismatch *before* the gate, so only the real method exercises the 401).
- **Hygiene-safe rejection reasons** (field + problem, never the value) so logs and upload summaries never leak health data.
- **Fixture-driven live-model eval runnable against production `/agent`** (not just the local pytest suite) — this is what caught the billing outage.

### Key Lessons
- **"Configured" ≠ "working."** For any paid external dependency, verify a real *successful* call end-to-end before declaring a feature shipped — and make the failure mode *visible*, not silent.
- **A voice-first MVP whose voice depends on funded credits should treat billing activation as a launch gate**, not an afterthought. (Deferred here to v2 by choice — documented, not hidden.)

### Cost Observations
- Agent model: `claude-haiku-4-5` (cheapest tier); per-command cost ~a fraction of a cent. The blocker was a **$0 balance**, not per-call cost.
- Milestone spanned ~29 days / 227 commits across 5 phases.

## Milestone: v1.1 — Polish & Records

**Shipped:** 2026-08-27
**Phases:** 7 | **Plans:** 34 | **Tasks:** 76 | **Timeline:** ~22 days (2026-08-05 → 2026-08-27, 316 commits)

### What Was Built
- Agent-liveness detection: a passive circuit breaker (zero added token cost) feeds a real "assistant unavailable" state, replacing v1.0's silent mislabeling of outages as "didn't catch that."
- Labs/incidents/procedures CRUD API + accessible manual-entry forms — the schema's long-empty future tables became reachable and populatable for the first time.
- Multi-dataset overlay & filtering: any combination of labs/incidents/procedures toggled by voice or click, overlaid on the BP Timeline/Pulse Trend, with a full accessible list twin.
- Spoken replies (TTS) closing the hands-free loop, verified on real Chrome/Edge, Safari desktop, and iOS Safari hardware.
- A full-screen site guide centralizing every control's explanation and the app's entire voice-command vocabulary in one source.
- A sitewide visual refresh (new accent, elevation token, formalized type scale) with every accessibility floor confirmed byte-identical pre/post via git-diff.

### What Worked
- **One structural precedent, reused three times with zero deviation.** Each new voice/text command (`ToggleDataset` Phase 9, `ToggleSpeech` Phase 10, `ToggleGuide` Phase 11) was added as its own closed-union `AgentOutput` member, mirroring the prior phase's shape exactly. No phase had to invent a new dispatch pattern.
- **Open design questions resolved explicitly during planning, not defaulted.** Phase 9's two research-flagged risks (overlay accessibility mechanism, `toggle_dataset` schema shape) were both settled in `/gsd-discuss-phase 9` before implementation started, avoiding rework.
- **Manual-verification checkpoints catching real bugs before code review.** Phase 11's mandatory checkpoint was run via Claude-in-Chrome browser automation instead of deferred to the user, and caught two real bugs (a viewport-width content overlap, a Tab-order gap) that would otherwise have shipped.
- **Git-diff reconstruction over static thresholds.** Phase 12 caught its own grep-threshold miscalibration by falling back to a direct pre/post git-diff comparison — a more trustworthy check than a static count against a baseline that can silently go stale.

### What Was Inefficient
- **Phase 12 had zero research grounding.** Visual Refresh was the one v1.1 phase not scoped by any of the four milestone research files — a real planning gap that had to be caught and backfilled with a dedicated lightweight research pass before planning could proceed safely.
- **Phase 9 shipped with 2 BLOCKER gaps found only at verification**, not before: stale toggle-off overlay data surviving in chart markers/table, and a dark-mode WCAG contrast failure. Both were real regressions a tighter pre-verification pass could plausibly have caught earlier.
- **A completed human-verification pass didn't close its own paper trail.** `06-VERIFICATION.md` sat at `status: human_needed` for 5 days after the human check actually passed (`06-HUMAN-UAT.md`, 2026-08-25) — nobody flipped the frontmatter, and it surfaced as a false "open item" at this milestone's close audit.
- **Non-critical code-review findings tend to just persist.** Phase 6's fetch-timeout gap (WR-03/WR-04) and Phase 10's 6 warning + 2 info findings were all "tracked for follow-up" and none were revisited before milestone close — the same unresolved-follow-up pattern v1.0 left behind.

### Patterns Established
- **Closed-union `AgentOutput` member per new command** — the load-bearing extension pattern for this milestone; any future voice/text command should follow it by default rather than reconsidering the dispatch shape from scratch.
- **Claude-in-Chrome browser automation as a first-class manual-verification tool**, not just a fallback when a human isn't available — it found bugs a human click-through might have missed.
- **Pre/post git-diff reconstruction as the trust mechanism** for "did we regress X" claims on tokens/accessibility floors, preferred over static grep-count assertions that can drift from a stale baseline.

### Key Lessons
- **A "no research grounding" flag on the roadmap is a signal to act on, not a note to read past.** Phase 12 was flagged this way from the moment the v1.1 roadmap was created; treating it as a real gap (backfilling research before planning) rather than executing on vibes prevented a much costlier failure mode.
- **Human-judgment verification needs an explicit closing step.** When the human pass happens days after the automated verification, something must revisit and flip the original VERIFICATION.md status — otherwise stale bookkeeping surfaces as a false "open item" later (as it did here, at milestone close).
- **Decide up front what happens to "tracked, not critical" review findings.** If a milestone accumulates them (this one did, in Phases 6 and 10) with no deliberate accept-or-schedule decision, they silently become permanent tech debt by default.

### Cost Observations
- Zero live Claude API calls this milestone — the agent has remained billing-gated (inert in prod) since v1.0, so every new agent-schema addition (`ToggleDataset`/`ToggleSpeech`/`ToggleGuide`) was verified at the code + deterministic-test level only, same constraint as v1.0.
- Milestone spanned ~22 days / 316 commits across 7 phases — faster pace than v1.0's ~29 days / 227 commits despite more plans (34 vs. 29), likely reflecting an established codebase with existing patterns to extend rather than invent.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Tasks | Shipped |
|-----------|--------|-------|-------|---------|
| v1.0 MVP | 5 | 29 | 46 | 2026-08-05 |
| v1.1 Polish & Records | 7 | 34 | 76 | 2026-08-27 |

**Recurring pattern across both milestones:** each milestone has closed with a batch of code-review findings explicitly "tracked for follow-up" rather than fixed or formally accepted as debt (v1.0: WR items on upload/auth; v1.1: Phase 6 WR-03/04, Phase 10's 6 warnings). Consider a lightweight debt-burn-down step at the start of the next milestone, or an explicit accept-as-debt decision at each phase's close, so these stop silently accumulating.
