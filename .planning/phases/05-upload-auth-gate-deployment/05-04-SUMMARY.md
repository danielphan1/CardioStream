---
phase: 05-upload-auth-gate-deployment
plan: 04
subsystem: frontend-auth
tags: [auth, zustand, localStorage, bearer-token, login-gate, vitest, tdd]
requires:
  - "frontend/src/store/theme.ts (localStorage-guarded zustand pattern)"
  - "frontend/src/api/client.ts (three-branch ApiError discipline)"
  - "frontend/src/components/EmptyState.tsx (nautical card + accent button tokens)"
provides:
  - "useAuth zustand token store (login/logout, localStorage key hv-token)"
  - "Bearer-attaching client (getJson/postJson/postFile) with 401 auto-logout"
  - "postFile multipart helper (no Content-Type) + postAuth wrapper"
  - "full-screen LoginGate wrapping App — nothing renders/fetches pre-auth"
affects:
  - "frontend/src/App.tsx (now gated; dashboard extracted to Dashboard component)"
  - "backend /auth + /upload endpoints (plan 05-02/05-03) — the client callers"
tech-stack:
  added: []
  patterns:
    - "out-of-tree useAuth.getState() seam for token read + logout from client.ts"
    - "component extraction to keep data hooks behind the auth gate (no pre-auth fetch)"
key-files:
  created:
    - frontend/src/store/auth.ts
    - frontend/src/components/LoginGate.tsx
    - frontend/src/api/client.test.ts
    - frontend/src/components/LoginGate.test.tsx
  modified:
    - frontend/src/api/client.ts
    - frontend/src/App.tsx
    - frontend/src/tests/smoke.test.tsx
decisions:
  - "App gates by extracting the dashboard into a Dashboard component so data hooks never mount pre-auth (React hooks cannot sit after a conditional return)"
  - "401 auto-logout centralized in one handleUnauthorized() helper shared by getJson/postJson/postFile"
metrics:
  duration: ~15m
  completed: 2026-07-22
  tasks: 2
  files: 7
---

# Phase 5 Plan 04: Frontend Auth Gate Summary

Shared-password Bearer auth gate for the React frontend: a localStorage-guarded `useAuth` zustand store holds the token, `client.ts` attaches `Authorization: Bearer <token>` on every request and auto-logs-out on any 401, and a full-screen nautical `LoginGate` wraps `App` so nothing renders — and no data fetch fires — until a token exists (D-01). Built TDD (RED→GREEN per task); full suite 163/163 green.

## What Was Built

### Task 1 — auth store + client Bearer/401/postFile/postAuth
- **`store/auth.ts`**: zustand store `{ token, login, logout }` keyed on localStorage `"hv-token"`, copying the `theme.ts` try/catch guards verbatim. `token` initializes from a guarded `readStoredToken()` so a returning caregiver stays logged in (D-02, no expiry); `login` persists + sets, `logout` clears both (D-03).
- **`api/client.ts`**: added `authHeaders()` (spreads `Authorization: Bearer <token>` when set, `{}` when null) into `getJson`/`postJson`/`postFile`; a shared `handleUnauthorized(status)` calls `useAuth.getState().logout()` on 401 before throwing `ApiError` (raw text still never renders — T-05-11). Added `postFile<TRes>(path, file)` multipart helper (FormData body, **no Content-Type** so the browser sets the boundary — Pitfall 6) and a `postAuth(password)` wrapper POSTing `{ password }` to `/auth`.

### Task 2 — full-screen LoginGate + App gate-wrap
- **`components/LoginGate.tsx`**: full-screen (`min-h-screen`, `--color-foam`) sky card (`max-w-[28rem]`, 2px ink border) with the `Sailboat` brand, "Enter the password to continue" sub-heading, a labeled native `<input type="password">` (autofocus, ≥48px, keyboard-only — D-04, NOT voice-operable), and an accent "Enter" button disabled until non-empty. Submit calls `postAuth` → `useAuth.login`; any rejection renders the calm `TriangleAlert` notice ("That password didn't work. Please try again." — bold first sentence, no status code, D-10) and refocuses the input.
- **`App.tsx`**: existing dashboard body extracted into a `Dashboard` component; `App` reads `useAuth((s) => s.token)` and returns `<LoginGate />` when null so the `Dashboard` tree — and all its data hooks — never mount pre-auth (D-01, T-05-10, no pre-auth data leak).

## Verification

- `npx vitest run src/api/client.test.ts` — 12/12 pass.
- `npx vitest run src/components/LoginGate.test.tsx` — 7/7 pass.
- `npx vitest run` full suite — **163/163 pass** (no regression).
- `npx tsc --noEmit` — clean.
- `npx oxlint src` — clean.

TDD gate compliance: each task has a `test(05-04)` RED commit followed by a `feat(05-04)` GREEN commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gated App broke the existing dashboard smoke test**
- **Found during:** Task 2 (full-suite regression run)
- **Issue:** `src/tests/smoke.test.tsx` renders `<App />` and asserts dashboard content, but App is now gated — with no token it correctly renders the LoginGate, so the dashboard heading never appeared.
- **Fix:** Seed `useAuth.setState({ token: 'test-token' })` in the smoke test's `beforeEach` (reset in `afterEach`). The gate itself is covered by `LoginGate.test.tsx`.
- **Files modified:** frontend/src/tests/smoke.test.tsx
- **Commit:** 4e86962

**2. [Test refinement] Wrong-password assertion matched split copy**
- **Found during:** Task 2 GREEN
- **Issue:** UI-SPEC mandates the notice's first sentence be bold, so the copy renders across a `<span>` + text node; the initial `findByText` of the whole sentence failed.
- **Fix:** Assert on the alert's combined `textContent` instead of a single text node — still proves the exact friendly copy and the absence of any status code.
- **Files modified:** frontend/src/components/LoginGate.test.tsx
- **Commit:** 4e86962

## Environment Note

The worktree had no `frontend/node_modules`; symlinked it to the main checkout's `node_modules` (gitignored, not committed) so vitest/tsc/oxlint could run. No dependency was installed or changed.

## Requirements Satisfied

- **SEC-01** (frontend half): shared-password gate + Bearer attachment on every request; 401 auto-logout. Backend enforcement is plans 05-02/05-03.

## Known Stubs

None — the gate is fully wired: `postAuth` hits the real `/auth` endpoint, the token persists, and every client request carries the Bearer header.

## Self-Check: PASSED

- Files created exist: store/auth.ts, components/LoginGate.tsx, api/client.test.ts, components/LoginGate.test.tsx — all present.
- Commits exist: 99e6e23, 41764aa, cf45359, 4e86962 — all in git log.
