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

## Cross-Milestone Trends

_(First milestone — trends accrue from v2 onward.)_

| Milestone | Phases | Plans | Tasks | Shipped |
|-----------|--------|-------|-------|---------|
| v1.0 MVP | 5 | 29 | 46 | 2026-08-05 |
