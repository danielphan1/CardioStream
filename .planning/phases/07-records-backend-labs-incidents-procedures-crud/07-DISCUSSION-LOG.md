# Phase 7: Records Backend (Labs / Incidents / Procedures CRUD) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 7-Records Backend (Labs / Incidents / Procedures CRUD)
**Areas discussed:** API shape, POST response contract, Field strictness on create, GET filter scope

---

## API shape

| Option | Description | Selected |
|--------|-------------|----------|
| Three separate endpoints (recommended) | /labs, /incidents, /procedures — each its own router file, exact mirror of readings.py (1 table = 1 router = 1 filter class = 1 response schema). Matches OVERLAY-01's wording; keeps each resource's fields/filters independently typed. | ✓ |
| One combined /records endpoint | Single route with a `type: lab\|incident\|procedure` discriminator field, one combined response schema (mostly-null fields per type). Fewer routes, messier schema, bigger departure from established pattern. | |
| You decide | Let Claude pick based on codebase conventions during planning. | |

**User's choice:** Three separate endpoints (recommended)
**Notes:** None.

---

## POST response contract

| Option | Description | Selected |
|--------|-------------|----------|
| Full created record (recommended) | Returns the same shape as GET's list items (id + all fields), mirroring how upload.py returns the full IngestSummary. Lets Phase 8's forms do an optimistic cache update, matching Phase 8's "shows up immediately, without a page reload" criterion. | ✓ |
| Minimal ack ({id}) | Just the new row's id. Phase 8 would need to re-fetch the list or construct the display record itself — more roundtrips or duplicated logic. | |
| You decide | Let Claude pick during planning. | |

**User's choice:** Full created record (recommended)
**Notes:** None.

---

## Field strictness on create

| Option | Description | Selected |
|--------|-------------|----------|
| Bare minimum per type (recommended) | Only date + one identifying field required per resource; everything else optional, matching the nullable columns already in models.py. Lets a caregiver log something fast and fill details later. | ✓ |
| Require more upfront | E.g. require result+unit for labs, duration for incidents, outcome for procedures. Guarantees richer data but makes quick logging harder; no edit route exists this milestone to fix an incomplete record later. | |
| You decide | Let Claude pick the exact required-field set per resource during planning. | |

**User's choice:** Bare minimum per type (recommended)
**Notes:** None.

---

## GET filter scope

| Option | Description | Selected |
|--------|-------------|----------|
| Date-range only (recommended) | Exact mirror of ReadingFilters — start_date/end_date, nothing else. Matches OVERLAY-01's literal wording; Phase 9's overlay only needs date-range filtering to plot records alongside readings. | ✓ |
| Date-range + resource-specific filter | Adds e.g. incident_type/test_name/procedure_name as an optional filter per resource. More flexible, but nothing in Phase 7-9's stated requirements calls for it yet. | |
| You decide | Let Claude pick during planning. | |

**User's choice:** Date-range only (recommended)
**Notes:** None.

---

## Claude's Discretion

- Exact Pydantic schema/field naming conventions for the three new response models (following `ReadingOut`'s `from_attributes` + `AliasChoices` pattern where a column needs aliasing).
- Whether the three new `Filters` dependency classes each get their own class or share one generic date-range-filter base.
- Exact request-body Pydantic model shape for POST (e.g. a `*Create` input model per resource).
- Whether new POST routes get any rate limiting (default: no, matching `/readings`/`/upload` precedent).

## Deferred Ideas

- Resource-specific GET filters (filter incidents by type, labs by test name, procedures by name) — not needed by anything currently scoped; revisit if a future phase needs more than date-range filtering.
- Edit/delete routes for labs, incidents, procedures — already tracked in REQUIREMENTS.md's Out of Scope table as a future consideration.
