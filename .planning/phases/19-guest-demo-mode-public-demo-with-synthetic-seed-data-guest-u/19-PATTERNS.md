# Phase 19: Guest Demo Mode - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 24 (new + modified, backend + frontend + docs)
**Analogs found:** 21 / 24 (3 have no direct precedent in this repo — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/config.py` | config | request-response (settings read) | itself (add field next to `site_password`) | exact — extend existing pattern |
| `backend/app/auth.py` | middleware | request-response | itself (add `reject_if_demo` beside `verify_token`) | exact |
| `backend/app/routers/auth.py` | controller/route | request-response | itself (extend `AuthRequest`/compare) | exact |
| `backend/app/main.py` | controller (app assembly) | request-response | itself (extend `health()`, add per-route deps) | exact |
| `backend/app/seed.py` | service (CLI) | batch | itself (add `seed_records()` beside `main()`) | exact |
| `backend/scripts/generate_demo_records.py` | utility/script | transform/batch | `backend/scripts/generate_sample.py` | role-match (discipline transfers, output shape differs — JSON not xlsx) |
| `backend/sample_data/demo_records.json` | fixture/config | file-I/O | `backend/sample_data/omron_sample.xlsx` (committed synthetic fixture) | role-match (same purpose, different format) |
| `backend/start.sh` | config (deploy script) | batch | itself (add gated auto-seed step) | exact |
| `backend/.env.example` | config | n/a | itself (add `SITE_USERNAME` block) | exact |
| `backend/app/routers/labs.py` | controller/route | CRUD | itself (`create_lab`, add `dependencies=[Depends(reject_if_demo)]`) | exact |
| `backend/app/routers/incidents.py` | controller/route | CRUD | itself (`create_incident`, same guard) | exact |
| `backend/app/routers/procedures.py` | controller/route | CRUD | itself (`create_procedure`, same guard) | exact |
| `backend/app/routers/upload.py` | controller/route | file-I/O | itself (`upload`, same guard) | exact |
| `backend/tests/test_demo_guard.py` | test | request-response | `backend/tests/test_auth_upload.py` (real-gate test style) | role-match — new file |
| `backend/tests/test_auth_upload.py` | test | request-response | itself (extend `auth_password` fixture pattern) | exact |
| `backend/tests/test_health.py` | test | request-response | itself (extend `SimpleNamespace` mocks) | exact |
| `backend/tests/test_demo_records_sample.py` | test | file-I/O | `backend/tests/test_sample.py` (character-pinning) | exact pattern, new file |
| `backend/tests/test_seed.py` | test | batch | `backend/app/seed.py` + `backend/tests/conftest.py` `session` fixture | role-match — new file, no prior seed test exists |
| `frontend/src/api/types.ts` | model/type | request-response | itself (`HealthStatus`) | exact |
| `frontend/src/api/client.ts` | service (API client) | request-response | itself (`postAuth`) | exact |
| `frontend/src/components/LoginGate.tsx` | component | request-response | itself | exact |
| `frontend/src/components/LoginGate.test.tsx` | test | request-response | itself | exact |
| `frontend/src/components/Header.tsx` | component | request-response | itself | exact |
| `frontend/src/components/Header.test.tsx` | test | request-response | `frontend/src/components/AgentStatusBanner.test.tsx` (health-mock component test) | role-match — new file |
| `frontend/src/hooks/useHealth.test.ts` | test | request-response | itself (`health()` helper) | exact |
| `frontend/src/components/AgentStatusBanner.test.tsx` | test | request-response | itself (`health()` helper) | exact |
| `DEPLOY.md` (repo root) | doc/config | n/a | `README.md` (Setup/Seeding sections — style precedent only) | no direct analog — greenfield doc |

## Pattern Assignments

### `backend/app/config.py` (config)

**Analog:** itself — `backend/app/config.py:50-57` (the `site_password`/`token_secret` field pair)

**Pattern to copy** — every security-weight `Settings` field documents its own rationale inline, empty-string default keeps local/test boot keyless:
```python
# Shared-password gate (SEC-01). Empty default keeps local/test boot
# KEYLESS, exactly like anthropic_api_key; prod sets SITE_PASSWORD via env.
site_password: str = ""
```
Add `site_username: str = ""` with the same comment density, directly below `site_password`. Per RESEARCH.md, empty = today's behavior byte-for-byte (Chris's real deployment never sets it); non-empty = demo mode, single source of truth for the write-guard, `/health` field, and frontend detection.

**Boot-time guard precedent** (lines 74-93) — `_reject_dev_token_secret_in_deployment` — a `model_validator(mode="after")` that fails loudly at construction when a dangerous pairing is detected. RESEARCH.md concluded `site_username` does NOT need an analogous guard (it drives a 403, not a forged-token risk), but if the planner disagrees, this is the pattern to mirror — same fail-loud-at-construction philosophy, not fail-open-at-request-time.

**Security note carried forward (D-10):** `hide_input_in_errors=True` (line 29) already covers any new `Settings` field automatically — no code change needed there, just don't remove it.

---

### `backend/app/auth.py` (middleware)

**Analog:** itself — co-locate the new dependency beside `verify_token`

**Imports** (lines 11-14) — nothing new needed; `reject_if_demo` only needs `HTTPException`, `status` (already imported style) and `get_settings` (already imported).

**Core pattern — exact dependency shape from RESEARCH.md's Code Examples**, mirroring `verify_token`'s docstring density and the "same opaque failure, deliberately different status code" discipline:
```python
def reject_if_demo() -> None:
    """403 on the 4 mutating routes when SITE_USERNAME is configured (D-03).

    Deliberately 403, not 401 — verify_token already proved this caller has a
    VALID token (401 territory); this deployment simply forbids writes to
    anyone, regardless of token validity, because it issues no other kind.
    Never inspects the token itself.
    """
    if get_settings().site_username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest accounts can't make changes to this demo.",
        )
```
**Contrast with `verify_token`** (lines 28-46) — same file, same "pure function reading one input, one opaque exception" shape, but `verify_token` returns 401 and inspects the Bearer header; `reject_if_demo` returns 403 and inspects nothing but `Settings`. Keep both functions in this file so a future reader sees them side by side and doesn't conflate the two status codes.

---

### `backend/app/routers/auth.py` (controller/route)

**Analog:** itself — extend `AuthRequest` and the compare block

**Imports** (lines 26-33) — unchanged, no new imports needed (`hmac` already imported).

**Current compare pattern** (lines 38-57) to extend:
```python
class AuthRequest(BaseModel):
    password: str


@router.post("/auth", response_model=AuthResponse)
@limiter.limit("5/minute")  # brute-force guard (Pitfall 5 order rules apply)
def auth(request: Request, body: AuthRequest) -> AuthResponse:  # noqa: ARG001
    configured = get_settings().site_password
    if not configured or not hmac.compare_digest(
        body.password.encode("utf-8"), configured.encode("utf-8")
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return AuthResponse(token=_serializer().dumps("authorized"))
```
**Target shape (from RESEARCH.md's validated design)** — add `username: str | None = None` to `AuthRequest`, fold both checks into one boolean so the SAME opaque 401 covers every failure mode (D-10's "never a distinct message" rule, already the pattern here):
```python
configured_user = get_settings().site_username
configured_pass = get_settings().site_password
user_ok = (
    not configured_user
    or hmac.compare_digest((body.username or "").encode("utf-8"), configured_user.encode("utf-8"))
)
pass_ok = bool(configured_pass) and hmac.compare_digest(
    body.password.encode("utf-8"), configured_pass.encode("utf-8")
)
if not (user_ok and pass_ok):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
```
**Rate-limit ordering pitfall (already documented in this file's own docstring, lines 8-10):** `@router.post` sits ABOVE `@limiter.limit`, and the handler signature declares `request: Request` first — miss either and rate limiting silently no-ops. Preserve exactly.

---

### `backend/app/main.py` (controller / app assembly)

**Analog:** itself

**`/health` extension** (lines 42-66) — current shape:
```python
@app.get("/health")
def health() -> dict[str, str | bool | None]:
    return {
        "status": "ok",
        "agent_configured": bool(get_settings().anthropic_api_key),
        "agent_reachable": agent_reachable(),
    }
```
Add `"demo": bool(get_settings().site_username)` as a third field — same "boolean-or-null only, never a reason string" discipline the docstring already states for the other two fields (lines 59-61). Not a secret per RESEARCH.md — it's exactly the flag the frontend already needs pre-auth.

**Router wiring** (lines 69-78) — router-level `Depends(verify_token)` stays completely untouched:
```python
app.include_router(auth.router)
app.include_router(readings.router, dependencies=[Depends(verify_token)])
...
app.include_router(labs.router, dependencies=[Depends(verify_token)])
app.include_router(incidents.router, dependencies=[Depends(verify_token)])
app.include_router(procedures.router, dependencies=[Depends(verify_token)])
```
`reject_if_demo` is NOT added here (per RESEARCH.md's confirmed design) — it attaches per-route inside `labs.py`/`incidents.py`/`procedures.py`/`upload.py` instead, because those routers mix `GET` and `POST` and a router-level guard would incorrectly block reads too. See the docstring's own pinned-decision comment (lines 4-6) for why router-level stays reserved for `verify_token` only.

---

### `backend/app/routers/{labs,incidents,procedures,upload}.py` (controller/route, CRUD)

**Analog:** each file, itself — `backend/app/routers/labs.py:41-51` shown, `incidents.py`/`procedures.py`/`upload.py` follow the identical shape

**Current POST pattern** (labs.py):
```python
@router.post("/labs", response_model=LabResultOut)
def create_lab(
    body: LabResultCreate,
    db: Annotated[Session, Depends(get_db)],
) -> LabResult:
    row = LabResult(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
```
**Change:** add `dependencies=[Depends(reject_if_demo)]` to the `@router.post(...)` decorator only — the `@router.get(...)` decorator on the same file's list route is untouched (RESEARCH.md's explicit reasoning: GET+POST share one router, so router-level guarding would wrongly 403 reads):
```python
@router.post("/labs", response_model=LabResultOut, dependencies=[Depends(reject_if_demo)])
def create_lab(...):
```
Import `reject_if_demo` from `app.auth` alongside the existing `get_db` import. Apply the identical one-line decorator change to `incidents.py` (`create_incident`), `procedures.py` (`create_procedure`), and `upload.py` (`upload`) — `upload.py`'s router only has the one POST route, but RESEARCH.md is explicit: use the same per-operation attachment there too, no special case.

**`incidents.py`'s field-mapping caveat (lines 47-62)** — irrelevant to the guard change but worth noting while touching this file: `create_incident` does NOT use `**body.model_dump()` because `IncidentCreate.datetime` doesn't match the ORM's `Incident.datetime_` attribute name; it's built field-by-field. This is unrelated to the demo-guard change but the synthetic-data generator (below) must account for the same mismatch when producing fixture rows for `Incident`.

---

### `backend/app/seed.py` (service, CLI, batch)

**Analog:** itself

**Existing thin-wrapper discipline** (lines 50-76):
```python
def main() -> int:
    source, kind = resolve_source()
    print(f"source ({kind}): {source}")
    raw = parse_omron(source)
    clean, rejected = transform(raw)
    with SessionLocal() as session:
        summary = merge_readings(session, clean, rejected)
    print(f"added:     {summary.added}")
    ...
    if summary.total == 0:
        print("ERROR: seed produced an empty readings table", file=sys.stderr)
        return 1
    return 0
```
**Pattern to add** (RESEARCH.md's Code Examples, `seed_records()`) — idempotent, skip-if-populated, no ETL involved (these 3 tables are POST-body-shaped, never spreadsheet-shaped):
```python
def seed_records(session: Session) -> dict[str, int]:
    """Idempotently seed labs/incidents/procedures from the committed fixture.

    Skips any table that already has rows — safe on every boot and every
    local `python -m app.seed` run alike (D-07: no reset needed).
    """
    import json
    fixture = json.loads((_BACKEND_DIR / "sample_data" / "demo_records.json").read_text())
    counts = {}
    for model, key in [(LabResult, "labs"), (Incident, "incidents"), (Procedure, "procedures")]:
        if session.query(model).count() > 0:
            counts[key] = 0
            continue
        rows = [model(**row) for row in fixture[key]]
        session.add_all(rows)
        counts[key] = len(rows)
    session.commit()
    return counts
```
**Critical field-mapping note** (carried from `incidents.py`'s own comment, see above): `Incident`'s constructor needs `datetime_`, not `datetime` — `model(**row)` will fail for `Incident` unless the fixture's JSON keys are pre-mapped to match, or `Incident` rows are constructed explicitly field-by-field like `create_incident` does. Do not blindly `**row` for that one model.

**Idempotency style matches existing precedent:** `resolve_source()` (lines 39-47) already does a "pick source, no state mutation, deterministic" pattern; `merge_readings`'s own idempotency (via the `UniqueConstraint` on `datetime`, see `models.py` line 55) is the spirit `seed_records()`'s `count() > 0` check mirrors for tables that have no unique constraint to lean on.

---

### `backend/scripts/generate_demo_records.py` (new — utility/script, transform)

**Analog:** `backend/scripts/generate_sample.py` (full file read — 221 lines)

**Discipline to mirror exactly** (module docstring, lines 1-25):
```python
"""Generate the committed SYNTHETIC OMRON-format sample workbook.

THIS FILE PRODUCES SYNTHETIC DEMO DATA ONLY (T-1-08). Every value is drawn
from a seeded pseudo-random generator or is a hand-picked textbook AHA
boundary value. The script never reads Chris's real readings...
"""
```
Adapt this framing verbatim for the new script's own docstring (labs/incidents/procedures instead of readings), including the "no dependency on the gitignored real data/ directory" claim.

**Determinism knobs pattern** (lines 39-44):
```python
SEED = 20250222
```
Reuse a fixed integer seed and `random.Random(SEED)` — **never** the global `random` module state (line 136 comment: `# NEVER the global random state (D-09)`).

**Generator structure** (lines 96-158) — small, composable `_draw_*`/`_build_*` helper functions feeding one `generate_rows()` entry point that returns a structured collection (here a `pd.DataFrame`; for the new script, since output is JSON not xlsx, `generate_rows()` should return plain `list[dict]` per table — no `pandas`/`openpyxl` needed at all, matching RESEARCH.md's "Standard Stack" conclusion that this is a `json`+`random` stdlib job, not an ETL-shaped one).

**Character-coverage self-check pattern** (lines 160-184, `assert_character`) — fail loudly if the generated data misses required variety:
```python
def assert_character(df: pd.DataFrame) -> Counter:
    """Fail loudly if the generated sample misses the D-10 character."""
    ...
    missing = required_bp - set(bp_hist)
    assert not missing, f"BP categories missing from sample: {sorted(missing)}"
```
Adapt: assert the labs fixture covers a spread of `test_name` values with both in-range and out-of-range `result`s relative to `range_low`/`range_high`; assert incidents cover more than one `incident_type`; assert procedures cover more than one `outcome`. Field shapes come directly from `backend/app/schemas.py`'s `LabResultCreate`/`IncidentCreate`/`ProcedureCreate` (read in full this session — see excerpt below).

**Output-writing pattern** (lines 187-220, `main()`) — generate, self-check, write, then print a human-readable summary to stdout. For the new script: `generate_rows()` → `assert_character()` → `json.dump(..., indent=2, default=str)` to `backend/sample_data/demo_records.json` → print row counts per table. No byte-identical-zip-entry concern here (that machinery in `_write_deterministic_xlsx`, lines 187-202, is xlsx-specific and does not apply to JSON — skip it entirely, plain `json.dump` with a fixed seed is already deterministic).

**Field shapes to generate against** (`backend/app/schemas.py`, read in full):
```python
class LabResultCreate(BaseModel):
    date: DateType
    test_name: str
    result: float | None = None
    unit: str | None = None
    range_low: float | None = None
    range_high: float | None = None
    notes: str | None = None

class IncidentCreate(BaseModel):
    datetime: DateTimeType
    incident_type: str
    duration: str | None = None
    notes: str | None = None

class ProcedureCreate(BaseModel):
    date: DateType
    procedure_name: str
    location: str | None = None
    outcome: str | None = None
    notes: str | None = None
```
Run from `backend/`: `python scripts/generate_demo_records.py`, mirroring `generate_sample.py`'s own run instruction (line 24).

---

### `backend/sample_data/demo_records.json` (new — fixture, file-I/O)

**Analog:** `backend/sample_data/omron_sample.xlsx` (the committed synthetic output `generate_sample.py` produces; not read directly — it's binary — but its role and the discipline pinning it in place via `test_sample.py` is the pattern)

Shape: a single JSON object with three top-level keys (`labs`, `incidents`, `procedures`), each a list of dicts matching the `*Create` schema field names above (for `incidents`, use the wire key `datetime` — the JSON fixture should match the Pydantic/wire shape, not the ORM attribute name; `seed_records()` is responsible for the `datetime` → `datetime_` translation when constructing `Incident` rows, exactly like `create_incident` does).

---

### `backend/start.sh` (config, deploy script)

**Analog:** itself — current file (full file read, 47 lines)

**Current end-of-script pattern** (lines 43-47):
```bash
echo "start.sh: running database migrations (alembic upgrade head)..."
"$PYTHON" -m alembic upgrade head

echo "start.sh: starting uvicorn on port ${PORT:-8000}..."
exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
```
**Insert between migrations and uvicorn** (RESEARCH.md's Code Examples, verified against this exact file structure):
```bash
if [ -n "${SITE_USERNAME:-}" ]; then
  echo "start.sh: SITE_USERNAME is set (demo deployment) — seeding demo data..."
  "$PYTHON" -m app.seed || echo "start.sh: WARNING seed step failed (continuing boot)"
fi
```
Keep the file's existing `echo "start.sh: ..."` prefix convention for every new log line (every existing line does this — lines 41, 43, 46). **Critical:** gate strictly on `SITE_USERNAME`, never a second flag — see "Pitfall 1" in RESEARCH.md (ungated auto-seed would silently inject synthetic readings into Chris's real production DB the moment `data/` is absent there too, which it always is in a fresh container).

---

### `backend/.env.example` (config)

**Analog:** itself — the `SITE_PASSWORD` block (lines 25-28)

**Pattern to copy exactly:**
```
# --- SITE_PASSWORD ----------------------------------------------------------
# Shared-password gate (SEC-01). Set the chosen shared password ONLY in Railway
# variables — never in git or the frontend.
SITE_PASSWORD=choose-a-shared-password
```
Add a matching `--- SITE_USERNAME ---` block immediately after it with the same "comment explains purpose + placeholder value only, real value set in Railway dashboard" structure (D-09: no literal guest credential value committed anywhere).

---

### `backend/tests/test_demo_guard.py` (new — test, request-response)

**Analog:** `backend/tests/test_auth_upload.py` (full file read, 389 lines) — specifically its `real_gate_client` fixture (lines 36-51) and the gating-test block (lines 346-389)

**Fixture to reuse verbatim (don't reinvent):**
```python
@pytest.fixture
def real_gate_client(session):
    """A TestClient that exercises the REAL verify_token dependency."""
    from app.deps import get_db
    from app.main import app
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```
**Test-shape pattern to extend** (the existing gating block, lines 355-389) already covers `GET`/`POST` 401-without-token for labs/incidents/procedures. `test_demo_guard.py` adds the SITE_USERNAME-configured case: valid token + `SITE_USERNAME` set → 403 on all 4 write routes, 200 unaffected on GET + `/agent`. Use a `monkeypatch.setenv("SITE_USERNAME", ...)` + `get_settings.cache_clear()` fixture mirroring `auth_password` (lines 157-174) exactly:
```python
@pytest.fixture
def demo_mode(monkeypatch):
    monkeypatch.setenv("SITE_USERNAME", "guest")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
```
**Ordering test (A1 in RESEARCH.md) — write explicitly, don't trust silently:** assert a write route with NO token still returns 401 (not 403) even when `SITE_USERNAME` is set — proves `verify_token` fires before `reject_if_demo`. Name it `test_missing_token_still_401_on_demo` per RESEARCH.md's own test-map naming.

**Fail-first convention (D-11):** per this codebase's established discipline (see `.planning/quick/260913-gcv-.../SUMMARY.md`), write this test, observe it FAIL against the pre-fix code (no `reject_if_demo` wired yet → currently 200, not 403), THEN implement the guard.

---

### `backend/tests/test_auth_upload.py` (extend)

**Analog:** itself — the `auth_password` fixture (lines 157-174) is the exact template for a new `demo_credentials` fixture that sets BOTH `SITE_USERNAME` and `SITE_PASSWORD` and clears the settings cache before/after, to extend the `/auth` route tests (lines 176-241) with username-required-when-configured cases (correct user+pass → 200; correct pass wrong user → same opaque 401; correct pass missing user when configured → same opaque 401).

**Existing fail-closed precedent to mirror for the new username field** (lines 210-227, `test_auth_unconfigured_site_password_issues_no_token`) — the exact "deliberately does NOT use the fixture — the whole point is the unconfigured state" pattern applies equally to `site_username` unconfigured (today's behavior must stay byte-for-byte unchanged when `SITE_USERNAME=""`).

---

### `backend/tests/test_health.py` (extend)

**Analog:** itself (full file read, 68 lines)

**Existing mock pattern that WILL break (Pitfall 3, confirmed by direct read)** — three `SimpleNamespace` constructions with only `anthropic_api_key` set:
```python
monkeypatch.setattr(
    main, "get_settings", lambda: SimpleNamespace(anthropic_api_key="sk-ant-test")
)
```
This appears at lines 31-33, 42-44, and implicitly wherever `health()` is called under a patched `get_settings`. The moment `health()` reads `get_settings().site_username`, these raise `AttributeError` at test-run time. **Every one of these three call sites must gain `site_username=""` in the same commit** that adds the field to `health()`'s response:
```python
SimpleNamespace(anthropic_api_key="sk-ant-test", site_username="")
```
**New test to add** (mirrors `test_health_ok_and_keyless_in_test_env`, lines 18-24): assert `body["demo"] is False` in the keyless test-env case, and a second test setting `SITE_USERNAME` via the real `client` fixture's env asserting `body["demo"] is True`.

---

### `backend/tests/test_demo_records_sample.py` (new — test, file-I/O)

**Analog:** `backend/tests/test_sample.py` (full file read, 92 lines) — character-pinning pattern

**Pattern to mirror exactly** (module-scoped fixture + one assertion per test):
```python
@pytest.fixture(scope="module")
def sample_df() -> pd.DataFrame:
    assert SAMPLE_PATH.is_file(), f"committed sample missing: {SAMPLE_PATH}"
    return pd.read_excel(SAMPLE_PATH, engine="openpyxl")

def test_columns_match_omron_export_shape(sample_df):
    assert list(sample_df.columns) == OMRON_COLUMNS
```
For the new fixture, replace the `pandas`+`openpyxl` read with a plain `json.loads(Path(...).read_text())` (the fixture is JSON, not xlsx), and replace category-histogram assertions with field-coverage assertions (multiple `test_name`s in labs, multiple `incident_type`s in incidents, multiple `outcome`s in procedures, no table empty). Keep the "assert the file exists first, fail loudly" precondition (`test_sample.py` line 44) and the one-assertion-per-test granularity (lines 48-92, 6 separate small tests rather than one giant test).

---

### `backend/tests/test_seed.py` (new — test, batch)

**Analog:** `backend/tests/conftest.py`'s `session` fixture (lines 120-124) + `backend/app/seed.py`'s own structure (no existing seed test file to mirror directly — this is Wave 0 per RESEARCH.md)

**Fixture to reuse:**
```python
@pytest.fixture
def session(engine):
    """A Session bound to the function-scoped in-memory engine."""
    with Session(engine) as s:
        yield s
```
**Test shape:** call `seed_records(session)` twice in a row inside a test using this fixture; assert the first call inserts rows (`counts["labs"] > 0` etc.) and the second call returns all-zero counts (idempotent, D-07's "no reset in scope" — a populated table is a terminal state). This is a plain unit test, no `TestClient`/`client` fixture needed since `seed_records()` takes a raw `Session`.

---

### `frontend/src/api/types.ts` (model/type)

**Analog:** itself — `HealthStatus` (lines 208-217)

**Current shape:**
```typescript
export type HealthStatus = {
  status: string;
  agent_configured: boolean;
  agent_reachable: boolean | null;
};
```
Add `demo: boolean;` as a fourth field, matching the file's own comment convention ("byte-for-byte mirror of backend Plan 06-01's extended `/health` handler" — update this comment to reference the new field's backend counterpart too).

**Pitfall (confirmed by direct grep/read of both test files):** this is a REQUIRED field addition, which breaks `tsc -b` at both `frontend/src/hooks/useHealth.test.ts:21-23` and `frontend/src/components/AgentStatusBanner.test.tsx:24-26`'s `health()` helper — see those files' pattern assignments below.

---

### `frontend/src/api/client.ts` (service, API client)

**Analog:** itself — `postAuth` (lines 145-149)

**Current shape:**
```typescript
export function postAuth(password: string): Promise<{ token: string }> {
  return postJson<{ password: string }, { token: string }>("/auth", {
    password,
  });
}
```
Extend the signature to `postAuth(password: string, username?: string)` and include `username` in the body object only when provided (or always include it as `username ?? undefined` — match whatever `AuthRequest` on the backend accepts as optional). No change needed to `postJson`, `authHeaders`, or the `ApiError`/401-logout discipline (lines 22-47) — those are all generic and already correct.

**`getHealth` (line 163-165)** — already exists and already returns the (soon-widened) `HealthStatus` type; no client.ts change needed for the `demo` field itself, only for `postAuth`'s signature.

---

### `frontend/src/components/LoginGate.tsx` (component)

**Analog:** itself (full file read, 118 lines)

**Structure to extend, not replace** — the existing field-group pattern (lines 68-86, password field) is byte-for-byte what the new username field should copy (per `19-UI-SPEC.md`'s own literal markup, which mirrors this exactly):
```tsx
<div className="flex flex-col gap-2">
  <label htmlFor="login-password" className="text-label text-[var(--color-depth)]">
    Password
  </label>
  <input
    ref={inputRef}
    id="login-password"
    name="password"
    type="password"
    autoFocus
    autoComplete="current-password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="min-h-12 w-full rounded-xl border-2 border-[var(--color-depth)] bg-[var(--color-deck)] px-4 text-lg text-[var(--color-depth)]"
  />
</div>
```
**Submit-handler pattern to extend** (lines 27-45) — `postAuth(password)` becomes `postAuth(password, demoMode ? username : undefined)`; the `rejected`/friendly-copy/refocus discipline (lines 36-44, 91-106) is unchanged, just the copy string becomes conditional per `19-UI-SPEC.md`'s locked copy table (`That password didn't work.` → `That username or password didn't work.` when `demoMode`).

**Demo-mode detection — RESEARCH.md's specific recommendation, NOT the UI-SPEC's literal `useHealth()` suggestion:**
```tsx
const [demoMode, setDemoMode] = useState(false);
useEffect(() => {
  getHealth()
    .then((h) => setDemoMode(h.demo))
    .catch(() => {
      /* ungated route; a failure here just means "assume real deployment" */
    });
}, []);
```
Use the raw `getHealth()` client function via a plain `useEffect`, not the `useHealth()` TanStack Query hook — see Pitfall 4 in RESEARCH.md: `LoginGate.test.tsx` has 5 bare `render(<LoginGate />)` calls (no `QueryClientProvider` ancestor) that would throw "No QueryClient set" if `LoginGate` called `useHealth()` directly. This is a deliberate deviation from `19-UI-SPEC.md`'s "Recommended source" wording (which flags itself as "not mandated" and defers to the planner) — smaller test blast radius, same single-source-of-truth outcome.

**Disabled-submit condition to extend** (line 110): `password.trim() === "" || submitting` → `(demoMode && username.trim() === "") || password.trim() === "" || submitting`.

---

### `frontend/src/components/LoginGate.test.tsx` (extend)

**Analog:** itself (full file read, 153 lines)

**The test that WILL need updating (Pitfall 5, confirmed by direct read), lines 67-78:**
```tsx
it("renders ONLY the LoginGate and fires NO data fetch when no token exists", () => {
  renderApp();
  expect(passwordInput()).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "Type a dashboard command" }),
  ).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
```
The final assertion (`not.toHaveBeenCalled()`) breaks the moment `LoginGate` calls `getHealth()` pre-auth. Per RESEARCH.md's recommendation (and the UI-SPEC's own flagged Integration Note), change this to assert the fetch count AND that it only ever hits `/health`, never a PHI-bearing path:
```tsx
expect(fetchMock).toHaveBeenCalledTimes(1);
expect(fetchMock.mock.calls[0][0]).toContain("/health");
```
**Fail-first regression requirement (D-11):** per this repo's established convention, add a NEW test proving the assertion still catches a real leak — e.g. temporarily make `LoginGate` also fetch `/readings` pre-auth in a throwaway local diff, observe THIS test fail, then revert — document that this was done, or structure the new test to assert `fetchMock.mock.calls.every(c => c[0].includes("/health"))` so any second pre-auth fetch to a different path fails it going forward.

**`fetchMock` setup already exists** (lines 27-38) as a `beforeEach` `vi.fn()` stub returning `{ok: true, json: () => Promise.resolve([])}` — for the new `demoMode` tests, this needs a `.mockImplementation` variant that resolves `{ demo: true, status: "ok", agent_configured: ..., agent_reachable: ... }` shaped JSON when the URL contains `/health`, matching `fetch`'s real per-URL branching (the current stub is URL-agnostic since nothing pre-auth calls it today).

**New tests to add** (mirroring the existing "keyboard ritual" describe block style, lines 92-152): username field renders only when `demoMode` resolves true; submit calls `postAuth(password, username)` with both values in demo mode; rejection copy differs per the UI-SPEC's locked string.

---

### `frontend/src/components/Header.tsx` (component)

**Analog:** itself (full file read, 301 lines)

**Left-hand title group to extend** (lines 156-166):
```tsx
<div className="flex items-center gap-2">
  <Sailboat aria-hidden="true" size={32} className="shrink-0 text-[var(--color-depth)]" />
  <h1 className="text-heading leading-tight text-[var(--color-depth)]">
    Chris's Health Dashboard
  </h1>
</div>
```
Add `flex-wrap` to this div's className, then the badge as a third child, per `19-UI-SPEC.md`'s locked markup:
```tsx
{demoMode && (
  <span
    role="status"
    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--color-depth)] bg-[var(--color-mist)] px-3 py-1 text-[18px] text-[var(--color-depth)]"
  >
    <Info aria-hidden="true" size={18} />
    Guest Demo · Synthetic Data
  </span>
)}
```
`Info` needs a new import from `lucide-react` alongside the existing icon imports (lines 15-25) — already an installed dependency, no new package.

**Status-pill precedent this badge reuses (per UI-SPEC, not this file)** — the `rounded-full px-3 py-1 text-[18px]` shape already exists elsewhere in the codebase (`StatsStrip`'s category chip) as the established "status pill" pattern; this phase's badge is a new use of an existing shape, not a new visual pattern.

**Write-button hiding — the exact block to wrap** (lines 236-254):
```tsx
{onDashboard ? (
  <>
    <button type="button" onClick={() => go("upload")} ...>
      <Upload aria-hidden="true" size={24} />
      Upload
    </button>
    <button type="button" onClick={() => go("records")} ...>
      <ClipboardPlus aria-hidden="true" size={24} />
      Add Record
    </button>
  </>
) : (
  <button type="button" onClick={() => go("dashboard")} ...>
    ...Back to dashboard
  </button>
)}
```
Wrap each of the two buttons individually in `{!demoMode && (...)}` — per `19-UI-SPEC.md` section 3, NOT the whole `<>` fragment, so future non-write buttons added to this same block wouldn't accidentally get swept up by a coarser guard. The "Back to dashboard" branch is untouched by `demoMode` (read-only navigation, not a write action).

**`demoMode` source in Header:** same `useHealth()`/`getHealth()` question as `LoginGate` — but `Header` is ALREADY always mounted deep inside the `QueryClientProvider`-wrapped authed tree (unlike `LoginGate`, which renders standalone in tests), so `Header` CAN safely use the real `useHealth()` hook (`frontend/src/hooks/useHealth.ts`, already polls `/health` every 60s) without the QueryClientProvider pitfall that blocks `LoginGate`. Read `demo` off the same hook already used for `AgentStatusBanner`; no new fetch call, no new hook.

---

### `frontend/src/components/Header.test.tsx` (new — test)

**Analog:** `frontend/src/components/AgentStatusBanner.test.tsx` (partial read, first 60 lines) — the "real store, only `getHealth` mocked at the api/client boundary" pattern

**Pattern to mirror:**
```tsx
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, getHealth: vi.fn() };
});
const mockGetHealth = getHealth as unknown as Mock;

function health(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return { status: "ok", agent_configured: true, agent_reachable: true, demo: false, ...overrides };
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
```
Tests to write (new file, none exist today for `Header`): badge renders with `role="status"` and the exact copy when `health({ demo: true })`; badge absent when `demo: false`; Upload/Add Record buttons absent when `demo: true`; Upload/Add Record buttons present (unchanged) when `demo: false`.

---

### `frontend/src/hooks/useHealth.test.ts` (extend)

**Analog:** itself (partial read, first 60 lines)

**The helper that needs the new field (Pitfall 2, confirmed by direct read), lines 21-23:**
```typescript
function health(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return { status: "ok", agent_configured: true, agent_reachable: true, ...overrides };
}
```
Add `demo: false` to the base object: `{ status: "ok", agent_configured: true, agent_reachable: true, demo: false, ...overrides }`. This is a type-check-time failure (`tsc -b`), not a runtime test failure — will not show up in `vitest run` alone, only in a full build/typecheck step.

---

### `frontend/src/components/AgentStatusBanner.test.tsx` (extend)

**Analog:** itself (partial read, first 60 lines)

**Identical helper, identical fix, lines 24-26:**
```typescript
function health(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return { status: "ok", agent_configured: true, agent_reachable: true, ...overrides };
}
```
Same one-line fix as `useHealth.test.ts` above: add `demo: false` to the base object. Do both in the same commit that widens `HealthStatus` in `api/types.ts` — grepping `"agent_configured"` across `frontend/src` (per RESEARCH.md's own stated mitigation) surfaces exactly these two call sites and no others.

---

### `DEPLOY.md` (new, repo root)

**Analog:** `README.md`'s "Setup"/"Seeding" sections (partial read, first 40 lines) — style precedent only, no deploy content exists anywhere in git today (confirmed by RESEARCH.md's own repo-wide search)

**Style to mirror** — plain markdown, fenced code blocks for every literal command, a one-line explanation above each block, no prose padding:
```markdown
## Setup

Backend requires Python 3.12+:

​```bash
cd backend
python3.12 -m venv .venv
...
​```
```
**Content structure (from RESEARCH.md's "Second-Deployment Mechanics" section, already fully drafted there as a 7-step literal sequence)** — copy that sequence directly into `DEPLOY.md`, plus the env-var inventory table (RESEARCH.md's "Env var inventory for the second deployment") reformatted as a markdown table. Reference `backend/.env.example` for the authoritative var-name list rather than duplicating values. Flag explicitly (per RESEARCH.md's Validation Architecture) that this document's own steps are `human_needed` — no CLI access exists in this environment to verify them end-to-end.

---

## Shared Patterns

### Fail-closed, constant-time, utf-8-bytes credential compare (D-10)
**Source:** `backend/app/routers/auth.py:50-57` (current password-only version, read in full)
**Apply to:** `routers/auth.py`'s extended compare (new username check specifically)
```python
if not configured or not hmac.compare_digest(
    body.password.encode("utf-8"), configured.encode("utf-8")
):
```
Never `==`, never bare `str` comparison (raises `TypeError` on non-ASCII), never a default that matches an empty candidate.

### Opaque error responses, never a distinguishing hint (D-10, carried through this whole phase)
**Source:** `backend/app/routers/auth.py:56` (`detail="unauthorized"`, both failure modes) and `backend/app/auth.py:38,43-45` (`verify_token`'s single 401 message for missing/malformed/tampered)
**Apply to:** the new username check (same 401, no "wrong username" vs "wrong password" distinction) and `reject_if_demo`'s 403 (a single friendly message, not per-route variants).

### `get_settings()` + `get_settings.cache_clear()` test-override idiom
**Source:** `backend/tests/test_auth_upload.py:157-174` (`auth_password` fixture)
**Apply to:** every new backend test that needs `SITE_USERNAME` configured — `monkeypatch.setenv(...)` then `get_settings.cache_clear()` before, and `cache_clear()` again after, to avoid `lru_cache` bleed between tests.

### Module-level ambient-`.env` isolation (D-11)
**Source:** `backend/tests/conftest.py:30-55` (full block read)
**Apply to:** N/A as a per-file action — this is ALREADY module-level in `conftest.py` and automatically covers every new test file in `backend/tests/`. Do not move any part of it into an autouse fixture (the file's own comment explains exactly why: `app/db.py` reads settings at import time, which happens before any fixture body runs).

### `Settings` field inline-rationale density
**Source:** `backend/app/config.py:50-57` (`site_password` block)
**Apply to:** the new `site_username` field — match the comment-per-field density already established, not a bare one-liner.

### Nautical "Slack Water"/"Night Watch" status-pill shape
**Source:** `19-UI-SPEC.md`'s Component Contract section 2 (locked markup), which itself reuses `StatsStrip`'s existing category-chip classes
**Apply to:** the demo badge in `Header.tsx` — `rounded-full border-2 border-[var(--color-depth)] bg-[var(--color-mist)] px-3 py-1 text-[18px]`, icon + text together, `role="status"` not `role="alert"`, exempt from the 48px floor (non-interactive).

### "mock only the api/client boundary" test discipline
**Source:** `frontend/src/hooks/useHealth.test.ts:14-17` and `frontend/src/components/AgentStatusBanner.test.tsx:17-20` — both `vi.mock("../api/client", ...)` keeping every other real module (`importOriginal` spread, only `getHealth`/`postAuth` replaced)
**Apply to:** `LoginGate.test.tsx`'s existing `postAuth` mock (already follows this) and the new `Header.test.tsx` (`getHealth` mock, real `useHealth`/`useAuth`/etc.)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `DEPLOY.md` | doc/config | n/a | No Railway/Vercel deployment documentation exists anywhere in this repo today (confirmed by RESEARCH.md's repo-wide search); `README.md`'s Setup/Seeding sections are style precedent only, not a structural analog — this is genuinely greenfield for this codebase. RESEARCH.md's own "Second-Deployment Mechanics" section already contains a fully drafted 7-step sequence + env-var table ready to be copied in near-verbatim. |
| `backend/tests/test_seed.py` | test | batch | No prior test file exercises `app/seed.py` at all (RESEARCH.md's Wave 0 gap list confirms this explicitly) — build from `conftest.py`'s `session` fixture + plain function calls, no existing seed-test structure to copy. |
| `backend/scripts/generate_demo_records.py` | utility/script | transform | `generate_sample.py` is a role-match (same discipline: seeded RNG, character-assertion self-check, synthetic-only framing) but NOT a structural analog for output format — it builds a `pandas` DataFrame and writes byte-identical `.xlsx` via `openpyxl`, machinery that doesn't apply to a plain JSON fixture. Use the discipline, not the xlsx-writing code. |

## Metadata

**Analog search scope:** `backend/app/` (all routers, `config.py`, `auth.py`, `main.py`, `seed.py`, `models.py`, `schemas.py`), `backend/scripts/`, `backend/tests/` (`conftest.py`, `test_auth_upload.py`, `test_health.py`, `test_sample.py`), `backend/start.sh`, `backend/.env.example`, `backend/railway.json`, `frontend/src/api/` (`client.ts`, `types.ts`), `frontend/src/components/` (`LoginGate.tsx` + test, `Header.tsx`), `frontend/src/hooks/useHealth.ts` + test, `frontend/src/components/AgentStatusBanner.test.tsx`, `frontend/src/store/auth.ts`, `README.md`, `19-UI-SPEC.md`.
**Files scanned (full or targeted read):** 24
**Pattern extraction date:** 2026-09-15
