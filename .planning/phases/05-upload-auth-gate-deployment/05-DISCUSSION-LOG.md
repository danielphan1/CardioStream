# Phase 5: Upload, Auth Gate & Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 5-upload-auth-gate-deployment
**Areas discussed:** Login gate UX, Upload surface & access, Upload flow & errors, Deploy & smoke test

---

## Login gate UX

### How should the password gate present?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen login page | Nothing renders until password entered; centered nautical card | ✓ |
| Inline unlock / blur overlay | Dashboard shell visible but blurred behind an overlay | |

### How long should a device stay logged in?

| Option | Description | Selected |
|--------|-------------|----------|
| Long-lived "remember this device" (~30 days) | Token expires eventually; re-locks a lost/old device | |
| Never expires until manual logout | No expiry; never strands Chris; weaker if device stolen | ✓ |
| Short session (hours) | Safest but strands Chris (can't re-auth) | |

### Who is the login for — voice-operable or caregiver action?

| Option | Description | Selected |
|--------|-------------|----------|
| Caregiver-only, keyboard entry | Caregiver types the shared password; secret off the voice path | ✓ |
| Must be voice-operable too | Chris unlocks by voice; speaks secret aloud, weaker security | |

**User's choice:** Full-screen login page; token never expires until manual logout; caregiver-only keyboard entry.
**Notes:** No-expiry token is a deliberate accessibility tradeoff (Chris can't re-enter the password). Claude flagged that this requires a manual logout control to exist (captured as D-03).

---

## Upload surface & access

### Where should the caregiver upload live?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated upload route/page | Adds lightweight routing (none exists); keeps dashboard clean | ✓ |
| Modal/overlay over the dashboard | 'Upload data' button opens a dialog; no routing | |
| Inline panel on the dashboard | Collapsible section on main page; risks accidental triggers | |

### How do people reach upload, and where does logout live?

| Option | Description | Selected |
|--------|-------------|----------|
| Small caregiver controls in the header (Upload + Log out) | Discreet, always reachable, out of Chris's UI | ✓ |
| Everything on the upload page | Header has one link; logout on the upload page itself | |

### Relax strict accessibility for this caregiver-only screen?

| Option | Description | Selected |
|--------|-------------|----------|
| Relax — standard file picker | Normal OS file picker OK; a11y rules are for Chris's dashboard | ✓ |
| Keep full accessibility everywhere | ≥48px, keyboard-only, no precision pointing on upload too | |

**User's choice:** Dedicated `/upload` route; header Upload + Log out controls; relaxed accessibility on the upload screen.
**Notes:** Accessibility relaxation scoped explicitly to the caregiver-only upload screen; Chris never operates upload. Screen still kept large/high-contrast/readable.

---

## Upload flow & errors

### Immediate ingest or preview-before-commit?

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate ingest, then show summary | Idempotent merge makes re-upload a safe no-op | ✓ |
| Preview first, then confirm | Extra step; duplicates safety the idempotent merge provides | |

### How should the result summary read?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain-language sentences | "Added 12 new readings. 3 already on file…"; friendly, big text | ✓ |
| Stat tiles / mini table | Numeric tiles (Added/Updated/Skipped/Latest) | |

### How to surface bad rows and wrong files?

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly count + optional details, clear reject for bad files | Expandable per-row reasons; plain "not an OMRON export" reject | ✓ |
| Just a count, no per-row detail | "3 rows skipped" only; caregiver can't tell what to fix | |

**User's choice:** Immediate idempotent ingest; plain-language summary; friendly per-row detail + clear bad-file rejection.
**Notes:** Response is the locked `IngestSummary` shape; ETL already returns per-row `RejectedRow` reasons. Never a raw traceback.

---

## Deploy & smoke test

### Backend host: Railway or Render?

| Option | Description | Selected |
|--------|-------------|----------|
| Railway | Stays warm, bundles Postgres, ~$5/mo; CLAUDE.md's pick | ✓ |
| Render (paid tier) | Equivalent fallback; avoid free tier (cold-start spin-down) | |

### Custom domain or platform URLs for MVP?

| Option | Description | Selected |
|--------|-------------|----------|
| Platform URLs for now | *.vercel.app + *.railway.app; custom domain addable later | ✓ |
| Custom domain now | DNS + cert setup before the app is proven live | |

### How to run the DEPL-02 smoke test?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: automated auth checks + manual flow checklist | curl-verifies 401 on every route; human runs login/charts/command/upload | ✓ |
| Fully manual checklist | One human runs everything; 401-per-route easy to do incompletely | |
| Fully automated E2E (Playwright) | Repeatable but voice can't be driven headlessly; heavy for MVP | |

**User's choice:** Railway; platform URLs for now; hybrid smoke test.
**Notes:** curl auth checks match roadmap SC2 ("curl-verified"); voice/mic verification stays human/real-device, consistent with Phase 4.

---

## Claude's Discretion

- Login-card copy/styling and the `/auth` password-check endpoint shape; itsdangerous signing details (no expiry).
- Routing mechanism for the upload page (react-router vs minimal view-state swap).
- Header placement/styling of Upload + Log out controls.
- Upload file-size limit / accepted extensions and the expandable rejected-rows UI.
- Exact wording of the plain-language summary and error copy.
- Railway/Vercel project config, build/start commands, and Alembic `upgrade head` on first prod deploy.

## Deferred Ideas

- Custom domain — deferred; platform URLs for MVP.
- Password rotation / reset flow — out of scope; rotate env vars if the secret leaks.
- Token expiry / session hardening — declined (no-expiry for Chris's accessibility).
- Full auth (accounts, roles, magic links) — permanently out of scope (single-patient site).
- Fully automated E2E (Playwright) — declined for the smoke test.
