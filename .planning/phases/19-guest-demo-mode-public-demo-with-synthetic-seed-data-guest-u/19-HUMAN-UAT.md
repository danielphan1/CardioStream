---
status: complete
phase: 19-guest-demo-mode-public-demo-with-synthetic-seed-data-guest-u
source: [19-VERIFICATION.md]
started: 2026-09-16T18:53:47Z
updated: 2026-09-16T20:15:00Z
---

## Current Test

[all tests complete]

## Tests

### 1. Stand up and confirm the actual second (demo) deployment
expected: Following `DEPLOY.md`'s Railway/Vercel steps produces a live, separately-provisioned guest deployment. Logging in with the guest username+password shows the demo badge, a fully populated dashboard (readings + labs + incidents + procedures synthetic data), and the 4 mutating routes (upload, labs, incidents, procedures) return friendly 403s for guest tokens while all GET routes and the /agent voice-command endpoint stay fully usable. Chris's real deployment is unaffected (separate database, separate SITE_USERNAME-gated auto-seed never fires against it).
result: pass — stood up via Railway (new project "friendly-rebirth", service "CardioStream", Root Directory
  `/backend`, matching the real deployment's setting verified beforehand) + a new Postgres plugin, and Vercel
  (new project `health-dashboard-demo`, Root Directory `frontend`). Env vars: `SITE_USERNAME=demo_guest`,
  `SITE_PASSWORD=demo_test_pass`, a freshly generated `TOKEN_SECRET` (never reused from the real deployment),
  `DATABASE_URL` referencing the new Postgres plugin, `CORS_ORIGINS` pointed at the real Vercel production
  domain (`https://health-dashboard-demo.vercel.app`) after discovering it. `VITE_API_URL` set to the Railway
  backend's generated domain (`https://cardiostream-production.up.railway.app`).
  Verified live at `https://health-dashboard-demo.vercel.app`: login screen shows the Username field (demo
  mode detected via `/health`), guest credentials authenticate successfully, "Guest Demo · Synthetic Data"
  badge renders in the header, dashboard populates with synthetic data (132 readings, Labs/Incidents/Procedures
  toggles available), Upload and Add Record buttons are absent from the header (D-04). Directly exercised
  `POST /labs` with the guest's Bearer token via the browser console — confirmed `403 {"detail":"Guest
  accounts can't make changes to this demo."}`. Cross-checked Chris's real deployment
  (`https://health-dashboard-nine-omega.vercel.app`) immediately after — unaffected: no demo badge, Upload/Add
  Record buttons present, existing real reading data intact, separate database confirmed by differing reading
  counts (132 demo vs 96 real).
  One deviation from a literal DEPLOY.md read: Railway's Root Directory field did not persist on the first
  save attempt (silently reverted to unset, causing two build failures where Railpack read the repo root
  instead of `backend/`) — re-entering the value and explicitly confirming via the inline checkmark (rather
  than relying on the top-level "Apply changes" banner alone) fixed it. Not a DEPLOY.md defect, but worth
  knowing if this is repeated for a future redeploy.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None.
