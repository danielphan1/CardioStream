# Phase 6: Agent Availability (Liveness Detection) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 6-Agent Availability (Liveness Detection)
**Areas discussed:** Liveness signal design, Check cadence & recovery, Unavailable-state presentation, Failure-flip sensitivity

---

## Liveness Signal Design

| Option | Description | Selected |
|--------|-------------|----------|
| Passive-only | Zero cost/risk, matches LIVE-04, and is the only approach that reflects Chris's real (billing) failure mode, since `count_tokens()` is billing-gate-exempt | ✓ |
| Passive + active probe now | Adds `count_tokens()` on top, closing the cold-start gap for key/network failures only (not billing) | |
| You decide | | |

**User's choice:** Passive-only (recommended)
**Notes:** The billing-gate-exemption finding from STACK.md was decisive — an active probe would give false "available" confidence for exactly Chris's known real outage (a $0-credit billing failure).

| Option | Description | Selected |
|--------|-------------|----------|
| Skip real calls during cooldown | Faster/calmer response, avoids hammering a struggling/billing-blocked API; recovery checked by the next real call after cooldown | ✓ |
| Always attempt the real call | Every command still round-trips to Claude even during a known outage | |
| You decide | | |

**User's choice:** Skip real calls during cooldown (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Same message for both | Matches LIVE-05's explicit deferral of the "not configured" vs "temporarily failing" distinction | ✓ |
| Subtly different copy | Same UI kind, hint-differentiated sentence | |

**User's choice:** Same message for both (recommended)

---

## Check Cadence & Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Check at load + recurring poll | One-shot at mount plus a cheap periodic poll (~60s) while the tab is open | ✓ |
| Check at load only | Reactive-only after the initial check | |
| You decide | | |

**User's choice:** Check at load + recurring poll (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Clear instantly on a successful command | Flips the local flag off the moment any real `/agent` call succeeds | ✓ |
| Clear only on the next /health poll | Simpler, but can leave a stale banner up to the poll interval | |

**User's choice:** Clear instantly on a successful command (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Pause while tab hidden | Mirrors the existing `useVoiceCommand` visibilitychange convention (T-04-05) | ✓ |
| Poll regardless of visibility | Simpler timer, no visibility listener | |
| You decide | | |

**User's choice:** Pause while tab hidden (recommended)

---

## Unavailable-State Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Separate persistent element | A calm, dedicated status indicator that stays visible independent of the transient message line | ✓ |
| Fold into the existing message line | Reuses CommandBar's message region, but gets overwritten by the next interaction — the exact anti-pattern Pitfalls research flags | |

**User's choice:** Separate persistent element (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| One shared indicator, same for both | Single element for voice and text paths, simplest, one copy source | ✓ |
| Voice gets a distinct spoken-adjacent treatment | More tailored to Chris's primary path, but TTS (Phase 10) doesn't exist yet to give it meaning | |

**User's choice:** One shared indicator, same for both (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No dismiss — stays until resolved | Calm/non-blocking by construction, nothing intrusive to dismiss | ✓ |
| Dismissible for the session | More controls to place accessibly for a low-drama case | |

**User's choice:** No dismiss — stays until resolved (recommended)

---

## Failure-Flip Sensitivity

| Option | Description | Selected |
|--------|-------------|----------|
| One failure flips it | Matches standard circuit-breaker pattern, simpler state, self-corrects at the next cooldown-expiry retry | ✓ |
| Two consecutive failures required | Fewer false alarms from a blip, at the cost of a delay before an honest outage shows and more state to build | |
| You decide | | |

**User's choice:** One failure flips it (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| ~60 seconds | Lines up with the poll interval; short wait for a caregiver retrying after a real fix | ✓ |
| Longer (e.g. 5 minutes) | More conservative re-testing, but a fixed issue could still show "unavailable" for minutes | |
| You decide | | |

**User's choice:** ~60 seconds (recommended)

---

## Claude's Discretion

- Exact cooldown/poll interval fine-tuning around the ~60s anchor.
- Exact shape of the new `AgentReply.kind` value and the corresponding `/health` field name.
- Exact visual design (placement, color tokens, icon, copy wording) of the persistent indicator — deferred to the UI-SPEC phase (ROADMAP.md flags "UI hint: yes" for Phase 6).
- Whether the circuit-breaker module state lives directly in `agent/service.py` or a small sibling module.

## Deferred Ideas

- Active `count_tokens()` liveness probe — considered and rejected for this phase; revisit only if a future failure mode emerges that passive-only detection can't catch.
- Distinguishing "not configured" from "temporarily failing" in user-facing copy — already tracked as REQUIREMENTS.md LIVE-05, deferred to v2.
