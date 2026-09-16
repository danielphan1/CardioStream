---
status: partial
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
source: [19-VERIFICATION.md]
started: 2026-09-16T18:53:47Z
updated: 2026-09-16T18:53:47Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Stand up and confirm the actual second (demo) deployment
expected: Following `DEPLOY.md`'s Railway/Vercel steps produces a live, separately-provisioned guest deployment. Logging in with the guest username+password shows the demo badge, a fully populated dashboard (readings + labs + incidents + procedures synthetic data), and the 4 mutating routes (upload, labs, incidents, procedures) return friendly 403s for guest tokens while all GET routes and the /agent voice-command endpoint stay fully usable. Chris's real deployment is unaffected (separate database, separate SITE_USERNAME-gated auto-seed never fires against it).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
