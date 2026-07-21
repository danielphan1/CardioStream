---
status: partial
phase: 03-agent-via-text-input
source: [03-VERIFICATION.md]
started: 2026-07-20T20:10:00Z
updated: 2026-07-20T20:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live fixture suite against real Claude
command: `cd backend && ANTHROPIC_API_KEY=<key> .venv/bin/python -m pytest -m live tests/test_agent_fixtures.py -v`
expected: ≥30 of 35 utterances (charts, presets, AM/PM combos, categories, symbolic dates, 4 garbled transcripts, 4 medical refusals, data questions, clarify follow-up, gibberish, relative-adjustment rejection) return the expected kind/filter fields — proves real Claude interpretation accuracy behind the validated pipeline (SC1, SC4, SC5).
result: [pending]

### 2. End-to-end UI command in the browser
setup: start backend with a real `ANTHROPIC_API_KEY`, then `cd frontend && npm run dev`
action: type "show my blood pressure for the last 30 days, mornings only" into the command bar and press Enter
expected: chart switches to BP timeline, date preset becomes last 30 days, AM/PM filter becomes mornings, the affected FilterBar groups pulse, and the bar shows "Showing blood pressure, last 30 days, mornings" in the aria-live region (SC1, SC2).
result: [pending]

### 3. Medical + ambiguous UI utterances
action: in the running UI, type a medical-interpretation request ("is my blood pressure dangerous?") and, separately, an ambiguous phrase ("show me that one")
expected: the medical request returns the fixed care-team refusal copy (no diagnosis/alarm) while still switching to the BP chart; the ambiguous phrase returns a short clarification question — neither produces a raw error or a 500 (SC3, SC5, VOICE-09).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
