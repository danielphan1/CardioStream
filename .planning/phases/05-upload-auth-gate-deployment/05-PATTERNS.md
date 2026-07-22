# Phase 5: Upload, Auth Gate & Deployment - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 15 (backend + frontend + config/deploy)
**Analogs found:** 13 / 15 (2 no-analog: deployment config, smoke script)

> Every hard piece already exists in-repo. This map points each new/modified file at the exact existing file, function, and line range to copy from. Prefer these real analogs over RESEARCH.md's illustrative snippets — the code below is verbatim from the current tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/auth.py` (MODIFY) | middleware/guard | request-response | self (stub) + `config.py` `get_settings()` | exact (replace body) |
| `backend/app/routers/auth.py` (CREATE) | router | request-response | `backend/app/routers/agent.py` | exact (slowapi POST shape) |
| `backend/app/routers/upload.py` (CREATE) | router | file-I/O → CRUD | `backend/app/routers/agent.py` + `backend/app/seed.py` (ETL call site) | exact (route shape) + exact (ETL sequence) |
| `backend/app/main.py` (MODIFY) | config/assembly | request-response | self (existing router wiring) | exact (extend in place) |
| `backend/app/config.py` (MODIFY) | config | — | self (`Settings`/`get_settings`) | exact (extend in place) |
| `backend/app/deps.py` (REUSE, no change expected) | utility | — | self (`get_db`) | exact (import only) |
| `backend/tests/conftest.py` (MODIFY) | test fixture | — | self (`client` fixture, `get_db` override) | exact (add one override) |
| `backend/tests/test_auth_upload.py` (CREATE) | test | request-response | `backend/tests/test_agent_route.py` | exact (TestClient + limiter.reset) |
| `frontend/src/store/auth.ts` (CREATE) | store | event-driven | `frontend/src/store/theme.ts` | exact (localStorage zustand) |
| `frontend/src/store/view.ts` (CREATE) | store | event-driven | `frontend/src/store/theme.ts` / `filters.ts` | exact (tiny zustand) |
| `frontend/src/components/LoginGate.tsx` (CREATE) | component | request-response | `frontend/src/components/EmptyState.tsx` (card + button) | role-match |
| `frontend/src/components/UploadPage.tsx` (CREATE) | component | file-I/O | `frontend/src/components/EmptyState.tsx` + `App.tsx` (error/summary render) | role-match |
| `frontend/src/components/Header.tsx` (MODIFY) | component | event-driven | self (theme-toggle button) | exact (add sibling buttons) |
| `frontend/src/api/client.ts` (MODIFY) | utility | request-response + file-I/O | self (`postJson`) | exact (extend) |
| `frontend/src/App.tsx` (MODIFY) | component | — | self (assembly) | exact (wrap + switch) |
| `backend/pyproject.toml` (MODIFY) | config | — | self (`dependencies` list, line 6) | exact (add 3 entries) |
| Deploy config (`railway.json` / Vercel dashboard / `scripts/smoke.sh`) | config/test | — | — | **no analog** |

---

## Pattern Assignments

### `backend/app/auth.py` (MODIFY — middleware/guard, request-response)

**Analog:** self (the no-op stub, `backend/app/auth.py:12-18`) + config access pattern from `backend/app/config.py:30-33`.

The function name and signature intent stay; only the body is replaced. It attaches at router level in `main.py` — no route changes (this is the whole point of the Phase 2 seam, documented in the existing docstring lines 1-9).

**Current stub to replace** (`backend/app/auth.py:12-18`):
```python
def verify_token() -> None:
    """No-op auth dependency (Phase 2 design stub)."""
    return None
```

**Config access pattern to reuse** (`backend/app/config.py:30-33`):
```python
@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
```

**Replacement shape** (RESEARCH Code Example 1 — keep the module docstring, add `Header`-based manual parse returning **401 not 403**, and a `_serializer()` helper `/auth` also imports):
- signature becomes `def verify_token(authorization: str | None = Header(default=None)) -> None:`
- `URLSafeTimedSerializer(get_settings().token_secret, salt="auth-gate")`, `.loads(token)` with **no `max_age`** (D-02 non-expiring)
- raise `HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, ...)` on missing/malformed/`BadData`

---

### `backend/app/routers/auth.py` (CREATE — router, request-response, UNGATED)

**Analog:** `backend/app/routers/agent.py` (the slowapi POST route shape) — this is the exact template.

**Router + limiter pattern to copy** (`backend/app/routers/agent.py:35-47`):
```python
# Per-IP limiter; app.main wires app.state.limiter + the 429 exception handler.
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

def get_interpreter() -> Interpreter:
    """Return the interpretation callable; override-able in tests (Pattern 3)."""
    return interpret

@router.post("/agent", response_model=AgentReply)
@limiter.limit("20/minute")
def agent(
    request: Request,  # REQUIRED by slowapi — do not remove (Pitfall 6)
    ...
```

**Critical slowapi ordering rule** (documented `backend/app/routers/agent.py:16-18`): the `@router.post` decorator sits ABOVE `@limiter.limit`, and the signature MUST declare `request: Request` first — miss either and rate limiting silently no-ops.

**For `/auth`:** reuse the **single** `limiter` instance — import it (`from app.routers.agent import limiter`) rather than creating a second, so `app.state.limiter` stays one object (RESEARCH Open Question 3). Use `@limiter.limit("5/minute")`. Body is a Pydantic `AuthRequest{password}` → `AuthResponse{token}`; compare with `hmac.compare_digest(body.password, get_settings().site_password)`; issue via the shared `_serializer().dumps("authorized")`. Never log the candidate password (Pitfall 8).

**Pydantic response_model pattern** (mirrors every existing router, e.g. `stats.py:34`): `@router.post("/auth", response_model=AuthResponse)`.

---

### `backend/app/routers/upload.py` (CREATE — router, file-I/O → CRUD, GATED)

**Analog A (route shape):** `backend/app/routers/agent.py` — `get_db` injection + `response_model`.
**Analog B (ETL call sequence):** `backend/app/seed.py:54-58` — the exact `parse_omron → transform → merge_readings` sequence the upload route reuses verbatim.

**ETL call site to copy** (`backend/app/seed.py:54-58`):
```python
raw = parse_omron(source)
clean, rejected = transform(raw)

with SessionLocal() as session:
    summary = merge_readings(session, clean, rejected)
```
In the route, `source` becomes `file.file` (the `SpooledTemporaryFile` — `parse_omron` accepts a buffer by design, see its docstring `etl.py:117-118`), and the session comes from `Depends(get_db)` NOT `SessionLocal` (deps invariant).

**DB dependency injection to copy** (`backend/app/routers/agent.py:32,51`):
```python
from app.deps import get_db
...
db: Annotated[Session, Depends(get_db)],
```

**Locked response model — do NOT wrap or rename** (`backend/app/etl.py:336-350`):
```python
class IngestSummary(BaseModel):
    added: int
    updated: int
    unchanged: int
    rejected: list[RejectedRow]
    total: int
    latest: datetime | None
```
`@router.post("/upload", response_model=IngestSummary)` — return `merge_readings(...)` directly (Phase 1 D-06 lock).

**Error discipline (D-10, never-500):** extension guard `.xlsx` → `HTTPException(400, "not-omron")`; wrap the ETL in try/except so `ValueError` (max_rows DoS guard, `etl.py:143-146`) or any parse failure collapses to `HTTPException(400, "not-omron")` — never a raw 500/traceback. Mirrors the never-500 backstop philosophy in `agent.py:63-64` (though agent returns friendly 200; upload returns friendly 400 the frontend maps to copy). `RejectedRow.reason` is already value-free (`etl.py:200-208`) — safe to return.

---

### `backend/app/main.py` (MODIFY — assembly, request-response)

**Analog:** self — the existing router wiring is the exact template (`backend/app/main.py:41-43`):
```python
app.include_router(readings.router, dependencies=[Depends(verify_token)])
app.include_router(stats.router, dependencies=[Depends(verify_token)])
app.include_router(agent.router, dependencies=[Depends(verify_token)])
```

**Add** (RESEARCH Code Example 2): `from app.routers import auth, upload` then:
```python
app.include_router(auth.router)                                          # UNGATED — issues the token
app.include_router(upload.router, dependencies=[Depends(verify_token)])  # gated like the rest
```
The `/auth` router MUST be outside `dependencies=[Depends(verify_token)]` (it issues the token; chicken-and-egg).

**CORS is already correctly wired** (`backend/app/main.py:34-39`) — reads `get_settings().cors_origins`, `["GET","POST"]`, `["Authorization","Content-Type"]`, no `allow_credentials`, no wildcard. **Nothing to change in code** — only the `CORS_ORIGINS` env value changes for prod (set to the Vercel origin).

---

### `backend/app/config.py` (MODIFY — config)

**Analog:** self — extend the `Settings` class in place following the existing keyless-boot pattern (`backend/app/config.py:13-27`):
```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
    database_url: str = "sqlite:///./dev.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    anthropic_api_key: str = ""   # empty default = keyless boot (the template to copy)
```

**Add** (RESEARCH Code Example 4 + Pitfalls 2 & 3):
- `site_password: str = ""` (empty default keeps local/test boot keyless, exactly like `anthropic_api_key`)
- `token_secret: str = "dev-insecure-secret"` (dev default keeps tests deterministic; prod overrides)
- `cors_origins` already exists — for prod env parsing, either set `CORS_ORIGINS` as a JSON array **or** re-type as `str` + comma-split validator (Pitfall 3; pydantic-settings JSON-parses `list[str]` from env)
- `database_url` normalizer via `@field_validator("database_url")`: `postgresql://` → `postgresql+psycopg://` (Pitfall 2; one point fixes both app engine and Alembic since both read `get_settings().database_url`)

---

### `backend/tests/conftest.py` (MODIFY — test fixture)

**Analog:** self — the `client` fixture already overrides `get_db` (`backend/tests/conftest.py:103-114`):
```python
@pytest.fixture
def client(session):
    from fastapi.testclient import TestClient
    from app.deps import get_db
    from app.main import app
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

**Add ONE line** (Pitfall 1 — mirrors the existing `get_db` override discipline). Without it, the 3 existing API test files (`test_api_readings.py`, `test_api_stats.py`, `test_agent_route.py`) all 401 the instant `verify_token` enforces — verified they call gated routes with no token, e.g. `client.get("/readings")` at `test_api_readings.py:56`:
```python
from app.auth import verify_token
app.dependency_overrides[verify_token] = lambda: None
```

---

### `backend/tests/test_auth_upload.py` (CREATE — test, request-response)

**Analog:** `backend/tests/test_agent_route.py` — the limiter-reset + TestClient + fake-dependency discipline.

**limiter reset fixture to copy** (`backend/tests/test_agent_route.py:28-33`):
```python
@pytest.fixture(autouse=True)
def _reset_limiter():
    """Clear the budget before each test so it never bleeds across tests."""
    limiter.reset()
    yield
    limiter.reset()
```
Import the SAME `limiter` (`from app.routers.agent import limiter`) so the reset targets the one instance `/auth` uses (rate-limit test = 6th request/min → 429).

**Key difference from the other API tests:** this module must exercise the **real** `verify_token` (prove 401 without token, 200 with a valid token, 401 on wrong password). Use a plain `TestClient(app)` and do NOT install the `verify_token` no-op override here (the `conftest` `client` fixture disables the gate — this file needs it live). Reuse `get_db` override for the DB. Upload tests reuse the existing `omron_xlsx`/`omron_df` fixtures (`conftest.py:39-64`) and assert idempotent re-upload → all `unchanged`.

---

### `frontend/src/store/auth.ts` (CREATE — store, event-driven)

**Analog:** `frontend/src/store/theme.ts` — the localStorage-backed zustand store with guarded access (`frontend/src/store/theme.ts:18-53`). Copy the `readStored`/`store` try/catch guards verbatim (localStorage throws on blocked-site-data / private mode):
```python
function readStoredTheme(): Theme {
  try { return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
export const useTheme = create<ThemeState>((set, get) => ({ theme: "light", ... }));
```
For `auth.ts`: state `{ token: string | null; login: (t) => void; logout: () => void }`, key e.g. `"hv-token"`, same try/catch localStorage guards. `logout()` clears the key and sets `token: null` (D-03). Expose `useAuth.getState()` for non-React access from `client.ts` (mirrors `useTheme.getState().initTheme()` in `main.tsx:14`).

**Out-of-tree getState() precedent** (`frontend/src/main.tsx:14`): `useTheme.getState().initTheme()` — same mechanism `client.ts` uses to read the token and call `logout()`.

---

### `frontend/src/store/view.ts` (CREATE — store, event-driven)

**Analog:** `frontend/src/store/filters.ts` (a tiny action-per-command zustand store) / `theme.ts`. RESEARCH Pattern 4:
```typescript
import { create } from "zustand";
type View = "dashboard" | "upload";
export const useView = create<{ view: View; go: (v: View) => void }>((set) => ({
  view: "dashboard",
  go: (view) => set({ view }),
}));
```
No localStorage needed (ephemeral). May be folded into `auth.ts` at the planner's discretion.

---

### `frontend/src/components/LoginGate.tsx` (CREATE — component, request-response)

**Analog:** `frontend/src/components/EmptyState.tsx` — the centered nautical card + single accent button + token-styling conventions (`EmptyState.tsx:42-63`):
```typescript
<section aria-label="No matching readings"
  className="flex flex-col items-center gap-4 rounded-lg bg-[var(--color-sky)] p-8 text-center">
  <Sailboat aria-hidden="true" className="h-10 w-10" />
  <h2 className="text-2xl leading-tight font-bold">...</h2>
  <button type="button" onClick={showAllData}
    className="min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)]">
    Show all data
  </button>
</section>
```
Copy the token palette (`--color-sky`, `--color-accent`, `--color-accent-text`), `min-h-12` (48px) button, `lucide-react` `Sailboat` mark, and `aria-label` discipline. For LoginGate: full-screen wrapper (`min-h-screen flex items-center justify-center`), a password `<input type="password">` (D-04 keyboard entry — normal input is fine, NOT voice-operable), and an "Enter" button that calls `postAuth(password)` → `useAuth.login(token)`. Nothing renders until token present (D-01).

---

### `frontend/src/components/UploadPage.tsx` (CREATE — component, file-I/O)

**Analog A (summary/error card):** `frontend/src/components/EmptyState.tsx` (plain-language sentence rendering + button).
**Analog B (error-copy-only discipline):** `frontend/src/App.tsx:60-85` — the centralized "never render raw error text" pattern with the friendly heading + retry button.

**Error/friendly-copy pattern to mirror** (`App.tsx:61-84`): UI-SPEC copy only, never raw status/traceback. UploadPage maps a rejected upload to "This doesn't look like an OMRON export" (D-10) and renders the `IngestSummary` as plain sentences (D-09: "Added 12 new readings. 3 were already on file..."). The expandable `RejectedRow` list is optional (`<details>`); reasons are already value-free from the backend.

**File picker:** standard `<input type="file" accept=".xlsx">` + button (D-07 relaxed a11y — this screen is caregiver-only, exempt from the voice/48px rules). On select, call the new `postFile("/upload", file)` helper.

---

### `frontend/src/components/Header.tsx` (MODIFY — component, event-driven)

**Analog:** self — the existing theme-toggle button is the exact button template (`frontend/src/components/Header.tsx:31-43`):
```typescript
<button type="button" onClick={toggleTheme} aria-pressed={isDark}
  className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-sky)] px-4 text-[20px] font-bold text-[var(--color-ink)]">
  {isDark ? <Moon .../> : <Sun .../>}
  {isDark ? "Dark" : "Light"}
</button>
```
Add two sibling controls in the same header-right flex row (`Header.tsx:16` container): a modest "Upload" link (`useView.go("upload")`) and a "Log out" button (`useAuth.logout()`) — D-06 discreet, styled as inactive controls like the toggle (border, not accent fill). Reuse `lucide-react` icons + text-label convention (never icon-only).

---

### `frontend/src/api/client.ts` (MODIFY — utility, request-response + file-I/O)

**Analog:** self — extend `postJson` (`frontend/src/api/client.ts:52-72`). Keep the three-branch `ApiError` discipline verbatim (network→`ApiError(0)`, `!res.ok`→`ApiError(status)`, unparseable 2xx→`ApiError(status)`):
```typescript
export async function postJson<TBody, TRes>(path: string, body: TBody): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { throw new ApiError(0, path); }
  if (!res.ok) throw new ApiError(res.status, path);
  try { return (await res.json()) as TRes; }
  catch { throw new ApiError(res.status, path); }
}
```

**Add** (RESEARCH Pattern 5):
- `authHeaders()` helper reading `useAuth.getState().token` → `{ Authorization: \`Bearer ${t}\` }`; spread `...authHeaders()` into `getJson` and `postJson` headers.
- After every `if (!res.ok)`: `if (res.status === 401) useAuth.getState().logout();` then throw `ApiError` (raw text still never renders — matches the `client.ts:1-3` contract).
- `postFile<TRes>(path, file)` multipart helper: `FormData().append("file", file)`, `headers: { ...authHeaders() }` and **NO `Content-Type`** (browser sets the boundary — Pitfall 6). Same three-branch `ApiError`.
- `postAuth(password)` typed wrapper mirroring `postAgent` (`client.ts:75-77`).

---

### `frontend/src/App.tsx` (MODIFY — component)

**Analog:** self. Wrap the existing return (`App.tsx:101-127`) so `LoginGate` renders when `useAuth().token` is null (D-01, nothing renders pre-auth), and switch `useView().view` between the current dashboard tree and `<UploadPage />`. The existing assembly (`Header` → content) stays intact inside the "dashboard" branch. `QueryClientProvider` in `main.tsx:16-22` is unchanged.

---

## Shared Patterns

### Router-level auth (the single enforcement point)
**Source:** `backend/app/main.py:41-43` (wiring) + `backend/app/auth.py` (`verify_token`).
**Apply to:** `/upload` (gated), and NOT `/auth` (ungated). Never add per-route auth decorators — this is an established invariant (documented `main.py:4-8`, `auth.py:1-9`).
```python
app.include_router(upload.router, dependencies=[Depends(verify_token)])  # gated
app.include_router(auth.router)                                          # the ONE exception
```

### slowapi rate-limit route shape
**Source:** `backend/app/routers/agent.py:36,46-49` + the ordering warning at `agent.py:16-18`.
**Apply to:** `/auth` (`5/minute`). Reuse the single `limiter` instance (import from `agent.py`); `@router.post` above `@limiter.limit`; `request: Request` in the signature.

### DB session dependency (never import SessionLocal in routers)
**Source:** `backend/app/deps.py:37-40` (`get_db`) + usage at `agent.py:32,51`.
**Apply to:** `/upload`. `db: Annotated[Session, Depends(get_db)]`. (`seed.py` uses `SessionLocal` directly because it is a CLI, not a route — do NOT copy that part into the router.)

### Never-500 / friendly-error discipline
**Source (backend):** `backend/app/routers/agent.py:63-64` (broad-except backstop).
**Source (frontend):** `frontend/src/App.tsx:60-85` + `frontend/src/api/client.ts:1-3,39-44` (three-branch `ApiError`, raw text never renders).
**Apply to:** `/upload` (→ 400 "not-omron", never 500), UploadPage + client.ts (map 400/401 to friendly copy, never surface status).

### Log hygiene (no secrets, no health values)
**Source:** `backend/app/etl.py:200-208` (`RejectedRow.reason` is field+problem only, never a value) + `seed.py:19-21` docstring contract.
**Apply to:** `/auth` (log nothing about the password), `/upload` (rely on value-free `RejectedRow`). D-14 audit: grep new code for `print(`/`logger.`.

### localStorage-guarded zustand store
**Source:** `frontend/src/store/theme.ts:18-53` (try/catch on every localStorage read/write) + out-of-tree `getState()` at `main.tsx:14`.
**Apply to:** `store/auth.ts` (token persistence + `getState()` access from `client.ts`).

### Nautical card + accent-button styling (design tokens)
**Source:** `frontend/src/components/EmptyState.tsx:42-63` + `Header.tsx:31-43`.
**Apply to:** LoginGate, UploadPage, Header's new controls. Tokens: `--color-sky`, `--color-foam`, `--color-accent`, `--color-accent-text`, `--color-ink`. `min-h-12` (48px) buttons, `lucide-react` icons with text labels, `aria-label` on sections. No hex values.

### Pydantic response_model on every route
**Source:** `backend/app/routers/stats.py:34`, `agent.py:46`, `readings.py:27`.
**Apply to:** `/auth` (`response_model=AuthResponse`), `/upload` (`response_model=IngestSummary`, returned verbatim).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `railway.json` / Railway dashboard config | config | — | No deployment config exists in-repo yet (first deploy). Use RESEARCH "Deployment" section: Railpack builder, start command `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`, root dir `backend`, env vars `ANTHROPIC_API_KEY`/`SITE_PASSWORD`/`TOKEN_SECRET`/`CORS_ORIGINS` (+ injected `DATABASE_URL`). |
| Vercel config (`VITE_API_URL`, root dir) | config | — | No frontend deploy config exists. Root dir `frontend`, build `npm run build`, output `dist`, env `VITE_API_URL`. No `vercel.json` needed (view-swap routing, not react-router). |
| `scripts/smoke.sh` | test (smoke) | — | No shell smoke test exists in the repo. Use RESEARCH Code Example 5: curl every route asserting **401** without a Bearer token, wrong-password→401, correct-password→token→gated 200. |

**Note:** `backend/pyproject.toml` (MODIFY) has a trivial analog — its own `dependencies` list at line 6 (currently includes `fastapi==0.139.*`, `slowapi==0.1.*`). Add `itsdangerous==2.2.*`, `python-multipart==0.0.*`, `psycopg[binary]==3.3.*`. Not a "pattern" file, listed here for completeness.

## Metadata

**Analog search scope:** `backend/app/` (auth, config, main, deps, etl, seed, routers/), `backend/tests/`, `frontend/src/` (api/, store/, components/, App.tsx, main.tsx).
**Files scanned:** ~20 read directly; all reuse-contract analogs named in CONTEXT.md confirmed present and read.
**Pattern extraction date:** 2026-07-22
