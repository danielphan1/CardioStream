---
status: complete
phase: 06-agent-availability-liveness-detection
source: [06-VERIFICATION.md]
started: 2026-08-20T20:00:00Z
updated: 2026-08-25T21:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Banner reads as calm/non-alarming (visual judgment)
expected: Load the dashboard with the backend's API key unset (or force `_last_outcome=False` on the backend, e.g. by monkeypatching or triggering a real APIError) and observe the AgentStatusBanner. Banner appears with the BotOff icon, regular-weight 18px body text, a single ~200ms fade-in — no pulsing/blinking, no red or `--cat-*` clinical color anywhere. Reads as calm/non-alarming, not a warning/siren.
result: pass

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
