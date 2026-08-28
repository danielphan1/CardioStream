# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: Chris** — a C4 quadriplegic individual (wheelchair user since 1997, limited/no hand mobility) who has been tracking blood pressure, pulse, and other health metrics since early 2025. He cannot reliably use a mouse or keyboard, so voice is his primary way of interacting with the dashboard, not an accessibility add-on.

**Secondary users: Chris's wife and caregivers.** They start each dashboard session for him (tap the mic to begin continuous listening) and are the ones who enter new data — uploading OMRON blood-pressure exports and filling in labs/incidents/procedures through manual-entry forms. They use mouse/keyboard normally.

This is a single-patient, single-family tool — not a multi-tenant or general-audience product.

## Product Purpose

CardioStream lets Chris see and explore his own health data entirely by voice: he asks for views of his data hands-free ("show me my blood pressure for the last 30 days, mornings only") and the dashboard responds — switching charts, applying filters, and speaking a confirmation back. It replaces an earlier Tableau Public prototype that required someone else to drive the interface for him.

It is also a portfolio project for the builder, demonstrating data engineering, software engineering, and applied AI on a consistent Python + React stack. Product and portfolio goals are meant to reinforce each other, not trade off — the voice-first constraint is a genuine accessibility requirement for Chris, and satisfying it well is also the point being demonstrated.

## Positioning

Voice is the primary input method, not a bolted-on convenience feature: every primary action must be reachable by voice, with mouse/keyboard as the fallback rather than the default. This is the thing a neighboring health-dashboard or BI tool couldn't truthfully claim — most "add voice search" to an existing mouse-first UI; CardioStream is designed the other way around, because its actual user has no reliable alternative.

## Operating Context

- A caregiver starts each session (a single tap begins continuous listening); the recognizer must then keep listening across multiple commands without anyone re-tapping, on both Chrome/Edge and Safari/iOS.
- The dashboard shows itself as unavailable (not silently failing) when the voice assistant can't respond, so Chris knows before he speaks whether a command will work.
- Caregivers upload periodic OMRON blood-pressure exports and use manual-entry forms to log lab results, incidents (e.g. passing out, hospitalizations), and procedures — the data Chris's voice commands then explore.
- The deployed site sits behind a single shared password; there is no per-user account system, because there is exactly one patient and one care circle.
- Chris's primary device (which browser/OS he'll actually use day to day) is still undecided — recorded as an open fact, not assumed.

## Capabilities and Constraints

- **Fixed tech stack** (do not substitute): PostgreSQL (SQLite for local dev), Python + Pandas ETL, FastAPI backend, React (Vite) frontend, Recharts, Web Speech API for voice input, a Claude API agent, Vercel + Railway hosting. Single consistent Python/React stack is itself a portfolio requirement, not just an implementation detail.
- **The Claude agent returns structured JSON only**, Pydantic-validated on the backend — raw model output is untrusted input and is never executed directly.
- **API keys are backend-only**, never present in frontend code; all Claude calls are proxied through the backend.
- **Known limitation, deferred to a future milestone:** the natural-language agent is built and verified in code, but the production Anthropic account currently has $0 credits, so every live `/agent` call degrades to "didn't understand" in production. Voice/text data entry via the agent (e.g. "log a reading of 120 over 80") is also not yet built — today's manual-entry forms are the only way to add labs/incidents/procedures.
- **Privacy is load-bearing, not optional**, because this is real personal health data: no analytics trackers, no third-party data sharing, the database is never publicly exposed, and the deployed site sits behind the shared-password gate.
- **Terminology:** "readings" = blood pressure + pulse entries derived from OMRON exports; "records" = labs, incidents, and procedures entered manually; AM/PM, BP category (AHA classification), pulse category, MAP, and pulse pressure are all derived fields computed once in the ETL pipeline, never recomputed ad hoc in the UI.
- **Compatibility:** voice must work acceptably on both Chrome/Edge (standard Web Speech API) and Safari/iOS (webkit-prefixed, with auto-stop-on-silence and gesture-unlock quirks) — since Chris's primary device isn't decided, neither can be treated as secondary.

## Brand Commitments

- **Product name: CardioStream** (the GitHub repository was renamed to this and it is the confirmed primary name going forward). "Chris's Health Dashboard" is retained as the in-app subtitle/description — the two are not competing names, one is the product, the other describes what it is for the person using it. In-app surfaces (e.g. the `<title>` tag, which still reads only "Chris's Health Dashboard") have not yet been updated to reflect the CardioStream name; that is implementation work for a later command, not a fact to invent here.
- **The current favicon (`frontend/public/favicon.svg`, a purple/violet abstract mark) is explicitly NOT a binding brand asset.** It was confirmed as a placeholder with no real design intent behind it — safe to replace without it counting as an identity change.
- An existing, coherent in-app visual system (color tokens, type scale, elevation) already exists in `frontend/src/index.css` following a recent "visual refresh" phase, but its specific palette/typography choices belong in DESIGN.md, not here — `/impeccable document` is the right next step to capture it formally.

## Evidence on Hand

- **OMRON blood-pressure export format** (Excel): Date, Time, Systolic, Diastolic, Pulse, Symptoms, Consumed, Notes (last three typically empty). A cleaned reference CSV exists with derived fields (AM/PM, BP category, pulse category, MAP, pulse pressure).
- **A committed synthetic sample dataset** (132 rows, deterministically generated, no real health data) matches the real data's documented statistical character — ~88% bradycardic pulse readings, BP ranging from hypotension to hypertensive crisis (systolic 60–211), all six BP categories represented. This is what dev/CI/demo environments seed from; real exports live only in a gitignored local `data/` directory and are never committed.
- **Prior work / design reference:** an earlier Tableau Public prototype with four charts CardioStream replicates — BP Timeline (dual-line systolic/diastolic), Pulse Trend (with a 60 bpm bradycardia threshold line), BP Categories (AHA-color-coded bars), and an AM vs PM comparison (grouped bars).
- **Absence to preserve:** no real testimonials, customer logos, press, or case studies exist or should be fabricated — this is a personal/portfolio project with exactly one real patient-user, not a marketed product.

## Product Principles

1. **Voice is the primary input, not a fallback.** Every primary action must be operable hands-free by voice; mouse/keyboard exists for caregivers and as a fallback, never as the default assumed path.
2. **Never execute raw AI output.** The agent's role is strictly to translate natural language into a validated, closed-schema command — it never runs arbitrary output, and it never gives medical advice or diagnosis.
3. **Privacy is a hard constraint, not a feature.** Real health data never leaves the gitignored boundary uncommitted, the deployed site is password-gated, and no third-party trackers or data sharing are ever added.
4. **This is a tool for one patient and his care circle, not a general product.** Design and engineering decisions should optimize for Chris and his caregivers specifically, not for hypothetical other users or multi-tenant extensibility.
5. **Product and portfolio goals reinforce each other.** Solving Chris's real accessibility need well is also the demonstration of engineering craft the project exists to show — neither goal should be sacrificed for the other.

## Accessibility & Inclusion

Chris is a C4 quadriplegic (wheelchair user since 1997) with limited/no hand mobility and cannot reliably use a mouse or keyboard — this is the project's central, non-negotiable design constraint, not a general best-practice checklist item.

Confirmed floor: all primary actions reachable by voice; ≥48px click targets; high contrast; ≥18px body text; full keyboard navigability as the fallback path; no drag, hover-only, or precise-pointing interactions anywhere in the product.

---
*Written 2026-08-27 by `/impeccable init`, drawing on the project's existing `.planning/PROJECT.md` and `CLAUDE.md` (both remain the authoritative GSD planning record; this file exists so Impeccable's design commands share the same durable product facts).*
