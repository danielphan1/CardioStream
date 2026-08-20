---
phase: 6
slug: agent-availability-liveness-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 9.* (`backend/pyproject.toml`), `TestClient` (httpx-backed) via `conftest.py`'s `client` fixture |
| **Framework (frontend)** | Vitest 4.1.10 (`frontend/package.json`), `@testing-library/react` |
| **Config file (backend)** | `backend/pyproject.toml` `[tool.pytest.ini_options]` (`testpaths = ["tests"]`, `addopts = "-m 'not live'"`) |
| **Config file (frontend)** | `frontend/vite.config.ts` (Vitest config colocated with Vite config — no separate `vitest.config.ts`) |
| **Quick run command (backend)** | `cd backend && python -m pytest tests/test_health.py tests/test_agent_route.py -x` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run src/hooks/useHealth.test.ts src/components/AgentStatusBanner.test.tsx src/components/CommandBar.test.tsx src/hooks/useVoiceCommand.test.ts` |
| **Full suite command (backend)** | `cd backend && python -m pytest` (live-marked tests excluded by default `addopts`) |
| **Full suite command (frontend)** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~15-30 seconds combined (existing suite is small, single-user app) |

---

## Sampling Rate

- **After every task commit:** Run the relevant single quick-run command (backend or frontend) above, scoped to the file(s) that task touched
- **After every plan wave:** Run both full suite commands (`pytest`, `vitest run`)
- **Before `/gsd-verify-work`:** Both full suites must be green
- **Max feedback latency:** ~30 seconds (no live/network-marked tests run by default; circuit-breaker tests use `monkeypatch`, not real Claude calls, per RESEARCH.md's Code Examples)

---

## Per-Requirement Verification Map

*(Task IDs are assigned by the planner in Step 8 and are not yet known at validation-strategy time — each plan's task list MUST reference these rows by Requirement ID so Wave 0 coverage stays traceable. The planner should copy this table into the phase's plans with Task ID/Plan/Wave columns filled in.)*

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|--------------------|-------------|--------|
| LIVE-01 | `AgentReply.kind` distinguishes "unavailable" (no key, or `APIError`/breaker-open) from "unclear" (`ValidationError`/refusal) | unit (backend) | `pytest backend/tests/test_agent_route.py -k unavailable -x` (+ new circuit-breaker unit tests, see Wave 0) | ❌ W0 | ⬜ pending |
| LIVE-02 | `AgentStatusBanner` shows calm, non-alarming copy paired with "manual controls still work", distinct from CommandBar's transient line | component (frontend) | `npx vitest run src/components/AgentStatusBanner.test.tsx` | ❌ W0 | ⬜ pending |
| LIVE-03 | Dashboard checks liveness on page load, before any command is issued | hook (frontend) | `npx vitest run src/hooks/useHealth.test.ts` | ❌ W0 | ⬜ pending |
| LIVE-04 | Liveness checks never share `/agent`'s rate limiter and never spend Claude API tokens | integration (backend) | `pytest backend/tests/test_health.py -k reachable -x` (assert `/health` carries no `@limiter.limit` decorator) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_agent_route.py` (or new `backend/tests/test_agent_service.py`) — circuit-breaker unit tests: `APIError` flips breaker, `ValidationError` does not, breaker-open skips the network call, cooldown expiry re-opens the path (stubs per RESEARCH.md Code Examples)
- [ ] `backend/tests/test_health.py` — extend for `agent_reachable` field presence/tri-state values, plus a regression test asserting `/health` carries no rate-limit decorator (LIVE-04)
- [ ] `frontend/src/hooks/useHealth.test.ts` — new file (poll behavior; mock only `getHealth`, mirrors `useVoiceCommand.test.ts` convention)
- [ ] `frontend/src/store/agentStatus.test.ts` — new file, or folded into hook/component tests (`reportOutcome` + `syncFromHealth` last-write-wins behavior)
- [ ] `frontend/src/components/AgentStatusBanner.test.tsx` — new file (renders null/card, `role="status"`, no dismiss control per D-11)
- [ ] Extend `frontend/src/components/CommandBar.test.tsx` and `frontend/src/hooks/useVoiceCommand.test.ts` with a `kind: "unavailable"` case each (closes the switch-exhaustiveness gap — RESEARCH.md Pitfall 1)

---

## Manual-Only Verifications

*All phase behaviors have automated verification per the map above. The one exception is genuinely visual/subjective, not mechanically re-derivable from source:*

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|-------------|--------------------|
| Indicator reads as calm/non-alarming (no color-only signal, no siren/warning iconography, motion is a single fade not a pulse) | LIVE-02 | "Calm, non-alarming" is a subjective visual judgment `06-UI-SPEC.md` locks in markup/tokens but can't be asserted by a DOM test alone | Load the dashboard with the backend's API key unset (or force `_last_outcome=False`), confirm the banner appears with `BotOff` icon + regular-weight body text + a single 200ms fade-in, no pulsing/blinking, no red/`--cat-*` color |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌) references above
- [ ] No watch-mode flags (`vitest run`, not `vitest`; no `pytest --watch`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once the planner's task list satisfies all rows above

**Approval:** pending
