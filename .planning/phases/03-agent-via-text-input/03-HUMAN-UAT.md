---
status: blocked
phase: 03-agent-via-text-input
source: [03-VERIFICATION.md]
started: 2026-07-20T20:10:00Z
updated: 2026-08-05T00:00:00Z
blocker: "Anthropic account has $0 credits — no payment method. Every /agent Claude call returns a billing 400; the never-500 backstop degrades each to `unclear`. Not a pipeline defect. Deferred to v2 (activate paid API)."
---

## Current Test

[BLOCKED — deferred to v2; see blocker in frontmatter]

## Tests

### 1. Live fixture suite against real Claude
command: `cd backend && ANTHROPIC_API_KEY=<key> .venv/bin/python -m pytest -m live tests/test_agent_fixtures.py -v`
expected: ≥30 of 35 utterances (charts, presets, AM/PM combos, categories, symbolic dates, 4 garbled transcripts, 4 medical refusals, data questions, clarify follow-up, gibberish, relative-adjustment rejection) return the expected kind/filter fields — proves real Claude interpretation accuracy behind the validated pipeline (SC1, SC4, SC5).
result: [BLOCKED] Ran the full 35-fixture set against the LIVE deployed /agent on 2026-08-05 (production Railway, real deployed prompt/pipeline). **4/35** — and all 4 "passes" are the gibberish cases that are *supposed* to return `unclear`. Every genuine command degraded to `unclear`. Root cause is NOT the model or the pipeline: the Anthropic account has **$0 credits / no payment method**, so every `claude-haiku-4-5` call returns a billing 400, and `_call_claude`'s `except (APIError, ValidationError)` backstop turns each into `unclear`. The pipeline is otherwise proven wired end-to-end (code + deterministic tests green in 03-VERIFICATION). **Deferred to v2** — activating a paid API account flips this to PASS with no code change.

### 2. End-to-end UI command in the browser
setup: start backend with a real `ANTHROPIC_API_KEY`, then `cd frontend && npm run dev`
action: type "show my blood pressure for the last 30 days, mornings only" into the command bar and press Enter
expected: chart switches to BP timeline, date preset becomes last 30 days, AM/PM filter becomes mornings, the affected FilterBar groups pulse, and the bar shows "Showing blood pressure, last 30 days, mornings" in the aria-live region (SC1, SC2).
result: [BLOCKED] Same root cause — the deployed agent returns `unclear` for this exact utterance (verified in the live eval above). Front-end wiring (CommandBar → useAgent → applyAgentFilters → store, aria-live) is built and unit-tested; it cannot be behaviorally confirmed until the API account is funded. Deferred to v2.

### 3. Medical + ambiguous UI utterances
action: in the running UI, type a medical-interpretation request ("is my blood pressure dangerous?") and, separately, an ambiguous phrase ("show me that one")
expected: the medical request returns the fixed care-team refusal copy (no diagnosis/alarm) while still switching to the BP chart; the ambiguous phrase returns a short clarification question — neither produces a raw error or a 500 (SC3, SC5, VOICE-09).
result: [BLOCKED] Same root cause — the 4 medical-refusal fixtures and the clarify fixtures all degraded to `unclear` in the live eval (no credits). The server-side handling of each variant is code-verified (03-VERIFICATION), but real-Claude classification cannot run without a funded key. Deferred to v2.

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 3

## Gaps

**KNOWN LIMITATION (v1.0) — agent inert in production, deferred to v2.**
- The natural-language command layer (`/agent`) is non-functional in production because the Anthropic account has $0 credits and no payment method.
- Evidence: live 35-fixture eval against production on 2026-08-05 → 4/35 (all valid commands → `unclear`; only gibberish "passes").
- This is a **billing/ops gap, not a code defect** — the pipeline is verified wired (03-VERIFICATION 5/5 at code + deterministic-test level); `/health` reports `agent_configured:true` (key present) but calls fail on billing.
- **Fix (v2):** add a payment method / buy credits in the Anthropic Console (~$5 covers thousands of haiku commands). No redeploy needed — the key is unchanged; calls succeed the moment the balance is positive.
- **Hardening idea for v2:** make this failure visible instead of silent — have `/health` actually ping Claude, or surface a distinct "assistant temporarily unavailable" state rather than degrading to `unclear`.
