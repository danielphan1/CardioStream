---
phase: 12
slug: visual-refresh
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-26
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `frontend/vite.config.ts` (`test:` block: `environment: 'jsdom'`, `setupFiles: './src/tests/setup.ts'`, `globals: true`) |
| **Quick run command** | `cd frontend && npx vitest run --reporter=dot` |
| **Full suite command** | `cd frontend && npx vitest run` (same suite — 323 tests, ~7s; no split needed at this scale) |
| **Estimated runtime** | ~7 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=dot` (full suite — cheap enough at ~7s to run every commit, no sampling needed)
- **After every plan wave:** Run `cd frontend && npx vitest run` (same full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, PLUS a manual pass confirming VISUAL-01 (visual consistency across dashboard/upload/guide/forms, both themes) and VISUAL-02b (target size / body text floor unchanged)
- **Max feedback latency:** 7 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-W0-01 | 01 | 0 | VISUAL-02a | — | N/A (test infra) | unit | `npx vitest run src/tests/contrast.test.ts` (imports only) | ❌ W0 | ⬜ pending |
| 12-0N-xx | TBD | 1 | VISUAL-02a | — | New accent token pair (`--color-accent` light/dark) passes WCAG contrast against `--color-foam`/`--color-sky` in both themes; stays clear of the locked `--cat-*` clinical hue range | unit | `cd frontend && npx vitest run src/tests/contrast.test.ts` | ❌ W0 | ⬜ pending |
| 12-0N-xx | TBD | 1 | VISUAL-02c | — | No regression to the 323 existing frontend tests after token/spacing/depth changes | regression | `cd frontend && npx vitest run` | ✅ (existing suite, confirmed green pre-phase) | ⬜ pending |
| 12-0N-manual | TBD | — | VISUAL-01 | — | All screens (dashboard, upload, guide, forms) render the new accent/depth/type consistently in both light and dark themes, no layout breakage | manual | N/A — no automated visual-regression tooling in this repo; introducing one (e.g. Playwright screenshot diffing) is out of scope for this phase | N/A |
| 12-0N-manual | TBD | — | VISUAL-02b | — | `min-h-12`/`min-w-12` (≥48px targets) and `--text-base` (≥18px body floor) unchanged after the refresh | static/manual | No automated command — jsdom cannot measure real layout; verify via diff review (`git diff` on token/class changes) confirming no target-size or body-text class/value was removed | N/A — no test file |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs (12-0N-0M) are assigned by the planner; this table maps requirements to test surfaces, not final task numbering.*

---

## Wave 0 Requirements

- [ ] `frontend/src/tests/contrast.test.ts` — new file; covers VISUAL-02a (new accent token contrast checks, both themes, computed via `wcag-contrast`)
- [ ] `wcag-contrast` devDependency install — `cd frontend && npm install --save-dev wcag-contrast`
- [ ] No fixture/conftest changes needed — the contrast test is pure token-math, no DOM/render setup required

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sitewide visual consistency of the refreshed theme | VISUAL-01 | Subjective/visual; no automated visual-regression tooling exists in this repo, and introducing one is out of scope for this phase's bounded token-evolution framing | Load dashboard, upload, guide overlay, and forms screens in both light and dark theme; confirm the new accent color, added surface depth (shadow/radius), and type-scale refinement render consistently with no layout breakage |
| Accessibility floor preserved (target size / body text) | VISUAL-02b | jsdom cannot measure real rendered layout; a diff review is the only reliable check within this phase's scope | Diff-review all changed CSS/class values, confirming no `min-h-12`/`min-w-12` (≥48px target) or `--text-base` (≥18px body floor) rule was altered or removed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 7s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — all 8 concrete plans (12-01 through 12-08) satisfy Nyquist checks 8a-8d; every task has an `<automated>` verify command or is covered by Wave 0.
