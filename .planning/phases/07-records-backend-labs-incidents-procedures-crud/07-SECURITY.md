---
phase: 07
slug: records-backend-labs-incidents-procedures-crud
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-20
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Plans covered:** 07-01 (implementation), 07-02 (test coverage)
**Block-on policy:** `high` (no high-severity open threats)

---

## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| Caregiver/Chris browser → `POST /labs`, `/incidents`, `/procedures` | Bearer-token-authenticated client submits untrusted JSON bodies (free-text `notes`, `test_name`, `incident_type`, `duration`, `procedure_name`, `location`, `outcome`) that cross into the backend and are persisted to the DB |
| FastAPI route handler → SQLAlchemy ORM → DB | Validated Pydantic model crosses into a parameterized ORM insert (`session.add(Model(...))`) |
| Unauthenticated caller → any of the 6 new routes | Router-level `Depends(verify_token)` gate must reject before any body validation or DB access |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-07-01 | Spoofing (auth bypass) | labs/incidents/procedures routers | mitigate | `backend/app/main.py:76-78` — `app.include_router(labs.router, dependencies=[Depends(verify_token)])` (and incidents/procedures identically), never per-route. Grep of the three router files found zero executable `Depends(verify_token)` calls (docstring prose only). 6/6 `test_{labs,incidents,procedures}_{get,post}_without_token_401` tests in `test_auth_upload.py` pass against the real, un-overridden `verify_token` dependency, asserting 401 (not 422) — proving the gate runs before body validation. | closed |
| T-07-02 | Tampering (mass-assignment / over-posting) | `LabResultCreate`/`IncidentCreate`/`ProcedureCreate` | mitigate | `backend/app/schemas.py:59-68,85-91,107-114` — none of the three `*Create` models declares an `id` field. `labs.py:47`/`procedures.py:47` use `Model(**body.model_dump())`; `incidents.py:53-58` constructs `Incident` field-by-field (`datetime_=body.datetime, ...`). In both cases only Pydantic-declared fields can reach the ORM constructor. Response key-set/id-assignment tests pass. | closed |
| T-07-03 | Tampering (injection) | Free-text fields (`notes`, `test_name`, `incident_type`, `duration`, `procedure_name`, `location`, `outcome`) | mitigate | Zero raw-SQL/string-interpolation matches (`text(`, `execute(`, f-string SQL, `.format(`) across the three new router files. All persistence via `session.add(Model(...))` — parameterized SQLAlchemy 2.0 typed declarative. Round-trip POST tests assert free-text values survive unmodified through insert + select. | closed |
| T-07-04 | Denial of Service | Unbounded `Text` columns (`notes` etc.) accept arbitrarily large payloads | accept | See Accepted Risks Log below. | closed |
| T-07-05 | Information Disclosure | Pydantic 422 validation errors on malformed POST bodies | accept | See Accepted Risks Log below. | closed |

*Status: open · closed*

---

## Accepted Risks Log

**T-07-04 — Unbounded text payload size (DoS)**
- **Scope:** `notes`, `test_name`, `incident_type`, `duration`, `procedure_name`, `location`, `outcome` — none of the six new Pydantic Create models declares a `max_length` constraint, and the underlying DB columns are unbounded `Text`.
- **Rationale for acceptance:** Verified during audit that no existing data route (`/readings`, `/upload`) enforces a request-size limit either — this is pre-existing, codebase-wide precedent, not a new exposure introduced by Phase 7. The app is single-user, sits behind the shared-password gate + signed Bearer token (SEC-01), and is not intended for public/multi-tenant traffic.
- **Residual risk:** A caregiver (or anyone holding a valid session token) could submit an oversized `notes` field and bloat the DB or degrade response times. Low likelihood given the trust boundary (authenticated caregiver/Chris only), low blast radius (single-user app, not internet-facing to anonymous traffic).
- **Owner / revisit trigger:** Revisit if the app ever moves to multi-tenant or exposes any route to unauthenticated traffic, or before Phase 8 (Manual-Entry Forms) ships a UI that could make oversized submissions easy to trigger accidentally.

**T-07-05 — Pydantic 422 error detail disclosure**
- **Scope:** Malformed GET/POST request bodies/params on all 6 new routes surface FastAPI's default 422 response body.
- **Rationale for acceptance:** Verified during audit that `backend/app/main.py` registers no custom validation-exception handler (only a `RateLimitExceeded` handler exists) — the default FastAPI 422 body contains only field names/expected types, never stack traces, file paths, or DB schema/internal details. Identical, framework-level behavior already accepted for `GET /readings` and every other existing route; Phase 7 introduces no new disclosure surface.
- **Residual risk:** Negligible — field/type names for these three resources are already fully described in the (Bearer-gated) OpenAPI schema at `/openapi.json`, so a 422 body discloses nothing an authenticated caller couldn't already see.
- **Owner / revisit trigger:** Revisit only if a future phase adds a custom exception handler that might leak more detail, or if `/openapi.json` itself becomes a disclosure concern.

---

## Unregistered Flags

None. Neither `07-01-SUMMARY.md` nor `07-02-SUMMARY.md` contains a `## Threat Flags` section (no new attack surface flagged by the executor during implementation). Independent review of the implementation for unmapped attack surface (log hygiene, pagination/response-size behavior, numeric field bounds) found nothing beyond what T-07-04 already covers as accepted risk.

---

## Verification Commands Run

```
cd backend && .venv/bin/python -m pytest tests/test_api_labs.py tests/test_api_incidents.py tests/test_api_procedures.py tests/test_auth_upload.py -q
# 51 passed, 1 warning

cd backend && .venv/bin/python -m pytest tests -q
# 249 passed, 7 skipped, 35 deselected

grep -n "Depends(verify_token)" backend/app/routers/labs.py backend/app/routers/incidents.py backend/app/routers/procedures.py
# no executable matches (docstring prose only)

grep -rn "text(\|execute(\|f\"SELECT\|f'SELECT\|%s\" %\|.format(" backend/app/routers/labs.py backend/app/routers/incidents.py backend/app/routers/procedures.py
# no matches
```

---

## Audit Trail

### Security Audit 2026-08-20
| Metric | Count |
|--------|-------|
| Threats found | 5 |
| Closed | 5 |
| Open | 0 |
