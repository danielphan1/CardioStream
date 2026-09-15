# Phase 19: Guest Demo Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 19-guest-demo-mode
**Areas discussed:** Demo isolation model, Guest write access, Blocked-write UX, Demo indicator

---

## Demo isolation model

*(Asked before phase creation, while scoping the request — carried into this phase's CONTEXT.md as
D-01/D-02.)*

| Option | Description | Selected |
|--------|-------------|----------|
| Separate deployment | Second Railway service + second Vercel project, own demo Postgres DB, zero schema changes, code/config + instructions only (no CLI deploy access available) | ✓ |
| Same deployment, shared DB, demo-flagged rows | One backend/DB, guest sees rows tagged "demo" | |

**User's choice:** Separate deployment.
**Notes:** Chosen specifically to avoid the shared-DB approach's extra schema/query-filtering surface
area, where a missed filter could leak real data into a guest's view.

---

## Guest write access

*(Asked before phase creation — carried into this phase's CONTEXT.md as D-03.)*

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only demo | Guests get all GET routes + `/agent`; the 4 mutating POST routes (upload/labs/incidents/procedures) return a friendly 403 | ✓ |
| Allow writes | Guests can freely add/edit demo entries; data drifts over time with no reset mechanism | |

**User's choice:** Read-only demo.

---

## Blocked-write UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the write paths entirely | Upload button and add-record forms don't render at all in demo mode | (defaulted — see notes) |
| Show them, reject on submit | Forms stay visible/usable up to submit; 403 surfaces as a calm inline message | |

**User's choice:** Neither directly — free-text response redirected to a related but distinct
concern (see below).
**Notes:** User's actual answer: "Lets provide demo lab, incidents, and procedures in the github
repo for people to install and test." This didn't address the blocked-write UX question but raised
a real, in-scope gap: the existing synthetic-data pipeline only covers `readings`, not
labs/incidents/procedures — captured as new decisions D-05/D-06 in CONTEXT.md. Since the "hide write
paths" option was the recommended default and nothing in the response contradicted it, it was kept as
D-04 (defaulted, not re-asked) per the project's lazy-default convention rather than looping back with
another question.

---

## Demo indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, a persistent small badge | e.g. "Guest Demo · Synthetic Data" in the header, always visible in demo mode | ✓ |
| No indicator needed | Separate login screen/credentials are signal enough | |

**User's choice:** Yes, persistent small badge.

---

## Claude's Discretion

- Exact badge wording/placement/styling.
- Exact env var name(s) and whether the single-env-var-drives-everything mechanism sketched during
  investigation is the final shape, or something the researcher/planner judges cleaner in the code.
- Exact shape of the new labs/incidents/procedures synthetic-data generator.
- Where the deploy/install instructions live (README section vs new doc vs `.env.example` comments).

## Deferred Ideas

None. The data-drift/reset question considered during scoping resolved itself once read-only access
was locked (D-03) — no deferred item needed.
