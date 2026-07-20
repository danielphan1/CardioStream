# Phase 3: Agent via Text Input - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 22 new/modified files
**Analogs found:** 17 / 22 (5 have no close analog — genuinely new territory, RESEARCH.md code examples apply)

## File Classification

### Backend — new

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/routers/agent.py` | route | request-response | `backend/app/routers/stats.py` | exact (router + DB anchor query) |
| `backend/app/agent/schemas.py` | model | transform | `backend/app/schemas.py` + `backend/app/deps.py` | role-match (conventions; wire-schema constraints are new) |
| `backend/app/agent/resolver.py` | utility | transform | `frontend/src/lib/dates.ts` (`resolveFilters`) | exact (parity source — must mirror its arithmetic) |
| `backend/app/agent/service.py` | service | request-response (external API) | `backend/app/config.py` (lazy cached singleton) | partial (no external-API service exists; RESEARCH Code Example 1 governs) |
| `backend/app/agent/prompt.py` | config | transform | — | none (RESEARCH Code Example 6 governs) |
| `backend/app/agent/copy.py` | config | — | `backend/app/routers/stats.py` (`CLINICAL_ORDER` module constant style) | partial |
| `backend/app/agent/__init__.py` | config | — | `backend/app/routers/__init__.py` | exact |

### Backend — modified

| File | Role | Data Flow | Pattern Source | Match Quality |
|------|------|-----------|----------------|---------------|
| `backend/app/main.py` | config | — | itself (extend existing structure) | exact |
| `backend/app/config.py` | config | — | itself (add one field) | exact |
| `backend/pyproject.toml` | config | — | itself (deps + pytest markers) | exact |

### Backend — tests

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `backend/tests/test_agent_route.py` | test | request-response | `backend/tests/test_api_readings.py` + `conftest.py` `client` fixture | exact (dependency-override lineage) |
| `backend/tests/test_agent_resolver.py` | test | transform | `frontend/src/lib/dates.test.ts` | exact (port the parity expectations) |
| `backend/tests/test_agent_schemas.py` | test | transform | `backend/tests/test_api_readings.py` (style) | role-match |
| `backend/tests/test_agent_fixtures.py` | test | request-response (live) | — | none (live-marked eval is new; RESEARCH Code Example 4 governs) |
| `backend/tests/fixtures/agent_utterances.json` | config | — | — | none (shape defined in RESEARCH) |

### Frontend — new

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `frontend/src/components/CommandBar.tsx` | component | request-response | `frontend/src/components/FilterBar.tsx` | exact (control styling, aria patterns, store wiring) |
| `frontend/src/hooks/useAgent.ts` | hook | request-response (mutation) | `frontend/src/hooks/useStats.ts` | role-match (query → mutation adaptation) |
| `frontend/src/lib/agent.ts` | utility | transform | `frontend/src/lib/dates.ts` + `frontend/src/store/filters.ts` | exact |
| `frontend/src/components/CommandBar.test.tsx` | test | — | `frontend/src/components/ReadingsTable.test.tsx` | exact |
| `frontend/src/lib/agent.test.ts` | test | — | `frontend/src/lib/dates.test.ts` | exact |

### Frontend — modified

| File | Role | Data Flow | Pattern Source | Match Quality |
|------|------|-----------|----------------|---------------|
| `frontend/src/api/client.ts` | utility | request-response | itself (`getJson` → add `postJson`) | exact |
| `frontend/src/api/types.ts` | model | — | itself (TS mirrors of backend schemas) | exact |
| `frontend/src/App.tsx` | component | — | itself (slot CommandBar between Header and FilterBar) | exact |
| `frontend/src/components/FilterBar.tsx` | component | — | itself (add D-08 pulse, `motion-safe:` gated) | exact |

---

## Pattern Assignments

### `backend/app/routers/agent.py` (route, request-response)

**Analog:** `backend/app/routers/stats.py` (router shape + the exact anchor query) and `backend/app/routers/readings.py` (minimal router shape).

**Module docstring convention** — every backend module opens with a "Pinned invariants" docstring (`routers/readings.py` lines 1-12):
```python
"""GET /readings — filterable reading list (API-01).

Pinned invariants:
  - Filters come exclusively from the shared ``ReadingFilters`` dependency
    (one filter semantics with /stats/summary; Phase 3's agent reuses it).
  ...
  - DB access via ``get_db`` only — never import ``SessionLocal`` here
    (RESEARCH Pitfall 10).
"""
```

**Imports pattern** (`routers/stats.py` lines 16-24):
```python
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import ReadingFilters, get_db
from app.models import Reading
from app.schemas import CategoryStat, StatsSummary, VitalStats
```
Stdlib → third-party → `app.*` groups, blank-line separated; absolute `app.` imports.

**Route signature pattern** (`routers/stats.py` lines 31-38) — module-level `router = APIRouter()`, `response_model=` on the decorator, `Annotated[..., Depends(...)]` params, sync `def`:
```python
router = APIRouter()


@router.get("/stats/summary", response_model=StatsSummary)
def stats_summary(
    filters: Annotated[ReadingFilters, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> StatsSummary:
```
For `/agent`: `@router.post("/agent", response_model=AgentReply)` plus slowapi additions — `request: Request` MUST be in the signature and `@limiter.limit(...)` sits BELOW the route decorator (RESEARCH Pitfall 6, Code Example 3). Add a `get_interpreter` dependency (mirroring `get_db`'s override-ability) so tests swap in fakes.

**Anchor query** — the resolver anchor is exactly the `latest_reading` query already in `routers/stats.py` lines 72-74:
```python
    # UNFILTERED on purpose: D-11 empty state + preset anchoring need the
    # newest reading that exists, regardless of the current filter set.
    latest = db.scalar(select(func.max(Reading.datetime_)))
```
Note the ORM attribute is `Reading.datetime_` (trailing underscore), never `Reading.datetime`.

---

### `backend/app/agent/schemas.py` (model, transform)

**Analog:** `backend/app/schemas.py` (Pydantic conventions) + `backend/app/deps.py` (Literal enum vocabulary). Two distinct model families live here — follow different rules for each:

1. **Claude-facing models** (`AgentOutput` union): constraint-free, lowercase snake tokens, plain `Literal`-tagged unions — RESEARCH Code Example 2 governs (no codebase analog exists for wire-schema restrictions).
2. **API-facing models** (`AgentRequest`, `AgentReply`, `AppliedFilters`): ordinary Pydantic v2 following `app/schemas.py` conventions.

**Pydantic conventions** (`app/schemas.py` lines 21-40) — `BaseModel` + `ConfigDict` when needed, one-line class docstrings citing requirement IDs, `X | None = None` optionals:
```python
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ReadingOut(BaseModel):
    """One reading as served by GET /readings (API-01)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ...
    notes: str | None = None
```

**Canonical label vocabulary** (`app/deps.py` lines 31-34) — the server-side token→label map in `AppliedFilters` must emit these verbatim (spaces included):
```python
# MUST match derivations.py verbatim — spaces are fine in query params.
BPCategory = Literal[
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis"
]
```
Claude-facing tokens are the lowercase forms (`"stage_1"`, `"hypertensive_crisis"`) mapped server-side to these canonical labels (RESEARCH Pitfall 2). `am_pm` canonical values are `"AM"`/`"PM"` (`deps.py` line 54); Claude-facing tokens `"am"`/`"pm"`.

---

### `backend/app/agent/resolver.py` (utility, transform)

**Analog:** `frontend/src/lib/dates.ts` `resolveFilters` — this is a PARITY requirement (API-05), not just a style analog. The Python resolver must reproduce this arithmetic exactly.

**The arithmetic to mirror** (`frontend/src/lib/dates.ts` lines 106-126):
```typescript
export function resolveFilters(
  state: FilterDateState,
  latestReading: string | null,
): ResolvedFilters {
  const resolved: ResolvedFilters = {};

  const days = PRESET_DAYS[state.datePreset];
  if (days !== undefined && latestReading !== null) {
    const anchor = parseDateOnly(latestReading.slice(0, 10));
    const start = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - (days - 1),
    );
    resolved.start_date = formatDateParam(start);
    resolved.end_date = formatDateParam(anchor);
  } else if (state.datePreset === "custom") {
    if (state.customRange.from !== null) resolved.start_date = state.customRange.from;
    if (state.customRange.to !== null) resolved.end_date = state.customRange.to;
  }
  // "all" (and day presets without an anchor): no date keys.
```
Key invariants: anchor = latest reading's DATE part; N-day range = `anchor − (N−1)` through `anchor`, INCLUSIVE end; anchor missing → behave as "all". Naive local dates, stdlib `datetime` + `calendar.monthrange` for month tokens; **never `datetime.now()`/`date.today()`** (data ends 2025-06-13 — today-anchoring renders an empty dashboard forever).

**Inclusive-end semantics documented at** `backend/app/deps.py` lines 10-14 (docstring) and 68-71 — the resolver emits date strings that feed this exact filter, so "through June" means the last day of June as an inclusive `end_date`.

**Output shape:** store-shaped — `datePreset` token for n ∈ {7, 30, 90} and "all"; `customRange {from, to}` as `"YYYY-MM-DD"` strings otherwise (RESEARCH Open Question 3 recommendation).

---

### `backend/app/agent/service.py` (service, external request-response)

**Analog:** partial — no external-API service exists in the codebase. RESEARCH Code Example 1 governs the Claude call. Copy these two codebase patterns:

**Lazy cached singleton** (`backend/app/config.py` lines 8-24) — the settings-access pattern the client wrapper follows:
```python
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    ...


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
```
The `Anthropic` client is constructed lazily via `get_settings().anthropic_api_key`; empty key → return `None` → friendly "unavailable" reply (Pitfall 9 — keyless dev/test stays bootable).

**Guard order** (RESEARCH Pitfall 5): catch `(APIError, ValidationError)` → check `stop_reason in ("refusal", "max_tokens")` → check `parsed_output is None` → business-validate/clamp — every failure branch collapses to the `unclear` `AgentReply` (200, never 500).

---

### `backend/app/agent/prompt.py` and `backend/app/agent/copy.py` (config)

**No codebase analog.** RESEARCH Code Example 6 governs `build_messages` (D-12 one-turn memory: `[original, clarify-question, answer]`). For `copy.py`, follow the module-constant style of `routers/stats.py` lines 26-29:
```python
# Verbatim canonical labels from app.derivations, least -> most severe.
CLINICAL_ORDER = [
    "Hypotension", "Normal", "Elevated", "Stage 1", "Stage 2", "Hypertensive Crisis",
]
```
i.e., module-level UPPER_CASE constants with a provenance comment. Copy strings must follow the friendly non-technical register established in the codebase (e.g., `App.tsx` line 66-72: "Couldn't load the readings … It will keep retrying — or press Try again.") and CONTEXT's fixed formats ("Try: 'show my pulse' or 'last 30 days'").

---

### `backend/app/main.py` (modified — config)

**Pattern source:** the file itself (31 lines, read in full). Current state that MUST change:

**CORS is GET-only** (lines 22-27) — RESEARCH Pitfall 1, the POST preflight will fail without this edit:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET"],                      # → ["GET", "POST"]
    allow_headers=["Authorization"],            # → ["Authorization", "Content-Type"]
)
```

**Router inclusion with router-level auth** (lines 29-30) — `/agent` joins identically; NEVER per-route auth:
```python
app.include_router(readings.router, dependencies=[Depends(verify_token)])
app.include_router(stats.router, dependencies=[Depends(verify_token)])
# add: app.include_router(agent.router, dependencies=[Depends(verify_token)])
```
`verify_token` (`backend/app/auth.py` lines 12-18) is a deliberate no-op stub; Phase 5 flips the body — attach it now, don't skip it.

Also add here: `app.state.limiter = limiter` + `app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)` (RESEARCH Code Example 3).

---

### `backend/app/config.py` (modified — config)

Add one field to `Settings` following the existing commented-field style (lines 13-18):
```python
class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    # add: anthropic_api_key: str = ""   # empty default — Pitfall 9, keyless boot
```

---

### `backend/pyproject.toml` (modified — config)

Current deps block (lines 6-16) uses `pkg==X.Y.*` pins — add `"anthropic==0.117.*"` and `"slowapi==0.1.*"` in that style. Current `[tool.pytest.ini_options]` (lines 31-32) is only `testpaths = ["tests"]` — add:
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = ["live: hits the real Anthropic API (needs ANTHROPIC_API_KEY)"]
addopts = "-m 'not live'"
```

---

### `backend/tests/test_agent_route.py` (test, request-response)

**Analog:** `backend/tests/test_api_readings.py` (test style) + `backend/tests/conftest.py` (`client` fixture).

**The dependency-override client fixture** (`conftest.py` lines 103-114) — reuse as-is; add `get_interpreter` override the same way:
```python
@pytest.fixture
def client(session):
    """TestClient wired to the in-memory session via dependency override."""
    from fastapi.testclient import TestClient

    from app.deps import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```
Note `app.dependency_overrides.clear()` handles all overrides — agent tests can add `app.dependency_overrides[get_interpreter] = ...` inside the test body and the fixture cleans up.

**Test style** (`test_api_readings.py`): module docstring listing the behavior contract; fixture factory helper (`_reading(...)` lines 23-37) building minimal valid rows; a `seeded` fixture (lines 40-52) adding rows via `session.add_all` + `commit`; flat `test_*` functions with `client.get/post` + status/body asserts; `pytest.mark.parametrize` for enum/error tables (lines 106-116, 145-157). The 422-never-500 test pattern (lines 145-157) maps directly to the agent's "never a raw error" tests.

---

### `backend/tests/test_agent_resolver.py` (test, transform)

**Analog:** `frontend/src/lib/dates.test.ts` — port these exact parity expectations to pytest (same anchor, same expected strings):
```typescript
const ANCHOR = "2025-06-13T09:21:00"; // newest seeded reading

it("resolves 30d anchored to the newest reading: anchor − 29 days through anchor, inclusive", () => {
  const resolved = resolveFilters(state({ datePreset: "30d" }), ANCHOR);
  expect(resolved).toEqual({ start_date: "2025-05-15", end_date: "2025-06-13" });
});

it("resolves 7d anchored to the newest reading", () => {
  expect(resolveFilters(state({ datePreset: "7d" }), ANCHOR))
    .toEqual({ start_date: "2025-06-07", end_date: "2025-06-13" });
});

it("resolves 90d anchored to the newest reading (month rollover)", () => {
  expect(resolveFilters(state({ datePreset: "90d" }), ANCHOR))
    .toEqual({ start_date: "2025-03-16", end_date: "2025-06-13" });
});
```
If the Python resolver produces different strings for these inputs, it has drifted (Pitfall 4).

---

### `frontend/src/components/CommandBar.tsx` (component, request-response)

**Analog:** `frontend/src/components/FilterBar.tsx` — the richest interactive component; copy its styling contract, aria patterns, and store/props discipline.

**File-header comment convention** (`FilterBar.tsx` lines 1-8) — decision-ID-citing block comment:
```typescript
// Filter bar (DASH-07 UI half; D-17/D-19/D-20) — the exact interactive
// surface Phase 3 voice commands will mirror. Every control is a ≥48px,
// 20px-labeled, single-select button with aria-pressed state; ...
```

**Control styling contract** (`FilterBar.tsx` lines 21-26) — the Send button and input reuse these exact class recipes (≥48px via `min-h-12`, 20px bold text, CSS-variable palette):
```typescript
const inactiveClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-sky)] text-[var(--color-ink)] border-2 border-[var(--color-ink)]";
const activeClass =
  "min-h-12 rounded-lg px-4 text-[20px] font-bold bg-[var(--color-accent)] text-[var(--color-accent-text)] border-2 border-[var(--color-accent)]";
```
Primary-action button variant in `App.tsx` lines 73-80: `"min-h-12 rounded-lg bg-[var(--color-accent)] px-6 text-xl font-bold text-[var(--color-accent-text)]"` ("Try again") — the Send button's closest sibling.

**aria-live announcement region** (`FilterBar.tsx` lines 160-163) — the confirmation/message area copies this:
```tsx
{/* Filter-state sentence (D-20) — announced politely on change */}
<p aria-live="polite" className="mt-4 text-[18px] text-[var(--color-ink)]">
  {sentence}
</p>
```

**Section wrapper** (`FilterBar.tsx` line 69): `<section className="bg-[var(--color-sky)] p-4">` — CommandBar sits in the same visual family. Local UI state via `useState` (line 53, `customOpen`) — the CommandBar state machine (`idle | working | confirmed | clarify | error`) and clarify-context live in local `useState` the same way, NOT in the zustand store.

---

### `frontend/src/hooks/useAgent.ts` (hook, mutation)

**Analog:** `frontend/src/hooks/useStats.ts` — v5 TanStack idioms and file shape:
```typescript
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getStatsSummary } from "../api/client";
...

export function useStats(resolved: ResolvedFilters) {
  return useQuery({
    queryKey: ["stats", resolved],
    queryFn: () => getStatsSummary(resolved),
    ...
  });
}
```
Adapt to `useMutation({ mutationFn: postAgent })` — no query cache for agent replies (RESEARCH anti-pattern); reply handling lives in `onSuccess` at the call site.

---

### `frontend/src/lib/agent.ts` (utility, transform)

**Analogs:** `frontend/src/store/filters.ts` (the actions `applyAgentFilters` calls) + `frontend/src/lib/dates.ts` (the formatters `composeConfirmation` reuses).

**The store actions to call — the complete mutation surface** (`store/filters.ts` lines 32-52):
```typescript
export const useFilters = create<FilterState>((set) => ({
  activeChart: "bp_timeline",
  datePreset: "all",
  customRange: { from: null, to: null },
  amPm: "all",
  bpCategory: "all",
  setActiveChart: (activeChart) => set({ activeChart }),
  setDatePreset: (datePreset) =>
    set({ datePreset, customRange: { from: null, to: null } }),
  setCustomRange: (from, to) =>
    set({ datePreset: "custom", customRange: { from, to } }),
  setAmPm: (amPm) => set({ amPm }),
  setBpCategory: (bpCategory) => set({ bpCategory }),
  showAllData: () =>
    set({
      datePreset: "all",
      customRange: { from: null, to: null },
      amPm: "all",
      bpCategory: "all",
    }),
}));
```
Outside-React access: `useFilters.getState().setActiveChart(...)` etc. (zustand v5 documented pattern; the store file's header comment lines 1-4 says the agent handler "mutates exactly this shape"). Note `setCustomRange` sets `datePreset: "custom"` itself, and `setDatePreset` clears `customRange` — `applyAgentFilters` relies on these built-in semantics, don't duplicate them. `reset` → `showAllData()`, applied FIRST, then per-field deltas (D-13 carry-over).

**Formatters for `composeConfirmation`** (`lib/dates.ts`): `presetLabel(preset)` (lines 83-96: "All data" / "Last 30 days" / "Custom range"), `fmtLongDate(iso)` (lines 52-58: "June 13, 2025"), `parseDateOnly(s)` (lines 38-41 — MANDATORY for `customRange` strings; `new Date("YYYY-MM-DD")` is the known off-by-one pitfall). The FilterBar sentence builder (`FilterBar.tsx` lines 60-66) is the in-codebase precedent for a full-state sentence:
```typescript
const sentenceParts = [presetLabel(datePreset)];
if (isDayPreset && latestReading !== null) {
  sentenceParts.push(`to ${fmtLongDate(latestReading)}`);
}
sentenceParts.push(amPm === "all" ? "All times" : amPm);
sentenceParts.push(bpCategory === "all" ? "All categories" : bpCategory);
const sentence = sentenceParts.join(" · ");
```
`composeConfirmation` follows the same shape with the D-07 wording ("Showing blood pressure, last 30 days, mornings").

---

### `frontend/src/api/client.ts` (modified — utility)

**Pattern source:** the existing `getJson` (lines 18-39) — `postJson` mirrors its exact error discipline:
```typescript
export async function getJson<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  ...
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`);
  } catch {
    throw new ApiError(0, path); // network / CORS failure — status 0
  }
  if (!res.ok) throw new ApiError(res.status, path);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, path); // 2xx with unparseable body
  }
}
```
`postJson` adds `method: "POST"`, `headers: { "Content-Type": "application/json" }`, `body: JSON.stringify(...)` and keeps all three failure branches (`ApiError(0)` for network, status for non-ok, status for bad body). The frontend maps `ApiError` status 429 and 0 to friendly copy — never renders `error.message` (file header lines 1-3 pins this).

---

### `frontend/src/api/types.ts` (modified — model)

**Pattern source:** the file itself — hand-written TS mirrors of backend Pydantic models with contract comments (e.g., lines 41-48 `StatsSummary`). Add `AgentRequest` / `AgentReply` / `AppliedFilters` mirrors the same way. `ChartId` (lines 51-55) already exists and is the chart vocabulary — reuse, don't redefine. `AppliedFilters` uses canonical types already here: `BPCategory` (spaces), `"AM" | "PM"`.

---

### `frontend/src/App.tsx` (modified — component)

**Pattern source:** itself. CommandBar slots into the existing layout (lines 100-107) between `Header` and `FilterBar`:
```tsx
<div className="min-h-screen">
  <Header />
  <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 md:px-8 xl:px-16">
    <FilterBar latestReading={latestReading} />
    ...
```
D-01 says the bar is full-width under the header — decide in planning whether it sits inside `<main>`'s first slot or between `<Header />` and `<main>` (FilterBar's `bg-[var(--color-sky)]` section styling supports either). `latestReading` (line 51: `stats.data?.latest_reading ?? null`) is already computed here — pass it to CommandBar for `composeConfirmation`.

---

### `frontend/src/components/FilterBar.tsx` (modified — D-08 pulse)

**Pattern source:** itself + the codebase's reduced-motion precedent. `App.tsx` uses Tailwind `animate-pulse` (line 30) for skeletons; ChartDeck's keyed mount-fade is the established reduced-motion-aware animation precedent (per CONTEXT). Gate the D-08 highlight behind Tailwind's `motion-safe:` variant on the affected control groups; trigger from a prop or store-adjacent signal when `applyAgentFilters` runs.

---

### `frontend/src/components/CommandBar.test.tsx` and `frontend/src/lib/agent.test.ts` (tests)

**Analogs:** `frontend/src/components/ReadingsTable.test.tsx` and `frontend/src/lib/dates.test.ts`.

**Component test style** (`ReadingsTable.test.tsx` lines 1-62): header comment naming the contracts locked; testing-library `render` + `screen` + `fireEvent`; fixture factories with `Partial<T>` overrides (lines 19-34); role-based queries (`screen.getByRole("button", { name: "Show 20 more" })`). CommandBar tests mock the mutation (or `postAgent`) and assert state transitions + `aria-live` content + store effects.

**Lib test style** (`dates.test.ts` lines 1-30): `describe`/`it` from vitest, a `state(overrides)` factory building `FilterDateState`, exact-string expectations. `agent.test.ts` copies this shape for `applyAgentFilters` (assert `useFilters.getState()` after calls — the store is real, reset it between tests) and `composeConfirmation` (exact confirmation strings).

---

## Shared Patterns

### Router-level auth (apply to `routers/agent.py` via `main.py`)
**Source:** `backend/app/main.py` lines 29-30 + `backend/app/auth.py` lines 12-18
```python
app.include_router(agent.router, dependencies=[Depends(verify_token)])
```
Never per-route. `verify_token` is a no-op stub until Phase 5; the route never changes when enforcement flips.

### DB access + test override (apply to route and all route tests)
**Source:** `backend/app/deps.py` lines 37-40 + `backend/tests/conftest.py` lines 103-114
```python
def get_db() -> Iterator[Session]:
    """Yield a request-scoped Session; tests override this dependency."""
    with SessionLocal() as session:
        yield session
```
Never import `SessionLocal` in a route module (Pitfall 10 lineage). `get_interpreter` follows the identical dependency shape so `app.dependency_overrides` works on it.

### Friendly error copy centralization (apply to CommandBar and all agent replies)
**Source:** `frontend/src/App.tsx` lines 59-84 (T-02-11) and `frontend/src/api/client.ts` lines 1-3
Raw errors, status codes, and stack traces never render. CommandBar maps `ApiError` (429, 0, anything) to fixed friendly copy; backend maps every model/SDK failure to the templated `unclear` reply (200).

### Store selector discipline (apply to CommandBar and any component reading filters)
**Source:** `frontend/src/components/FilterBar.tsx` lines 42-49
```typescript
const datePreset = useFilters((s) => s.datePreset);
const setDatePreset = useFilters((s) => s.setDatePreset);
```
Per-field selectors inside components; `useFilters.getState()` only outside the React tree (`lib/agent.ts`).

### Accessibility control contract (apply to all CommandBar controls)
**Source:** `frontend/src/components/FilterBar.tsx` lines 21-26 (class recipes), 72/99/115 (`role="group"` + `aria-label`), 161 (`aria-live="polite"`)
`min-h-12` (48px), `text-[20px] font-bold` on controls, ≥18px body text, CSS-variable palette only, visible label or `aria-label` on the input (placeholder alone is not a name — Pitfall 8).

### Canonical labels vs. wire tokens (apply to agent/schemas.py, resolver.py, api/types.ts)
**Source:** `backend/app/deps.py` lines 31-34 (canonical, spaces) vs. RESEARCH Code Example 2 (lowercase snake tokens)
One mapping, server-side, in `agent/schemas.py` or `service.py`: Claude sees `"hypertensive_crisis"`/`"am"`; the store and API see `"Hypertensive Crisis"`/`"AM"`. Nothing else ever translates.

### Module documentation convention (apply to every new file)
**Source:** every backend module (e.g., `deps.py` lines 1-18) and frontend module (e.g., `store/filters.ts` lines 1-10)
Opening docstring/comment stating purpose, requirement IDs (API-04 etc.), decision IDs (D-07 etc.), and pinned invariants with RESEARCH pitfall references.

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md code examples instead):

| File | Role | Data Flow | Reason | RESEARCH Fallback |
|------|------|-----------|--------|-------------------|
| `backend/app/agent/service.py` (Claude call core) | service | external request-response | No external-API integration exists yet | Code Example 1 |
| `backend/app/agent/prompt.py` | config | transform | First LLM prompt in the project | Code Example 6 |
| `backend/app/agent/schemas.py` (wire-schema restrictions) | model | transform | No structured-outputs schema exists | Code Example 2 + Pitfalls 2/3 |
| `backend/tests/test_agent_fixtures.py` | test | live eval | No live/marked test tier exists | Code Example 4 notes |
| `backend/tests/fixtures/agent_utterances.json` | config | — | First eval fixture file | Code Example 4 entry shape |

## Metadata

**Analog search scope:** `backend/app/`, `backend/app/routers/`, `backend/tests/`, `frontend/src/{components,hooks,lib,store,api}`
**Files scanned:** 60 listed; 16 read in full (readings.py, stats.py, schemas.py, main.py, config.py, auth.py, deps.py, conftest.py, test_api_readings.py, pyproject.toml, filters.ts, dates.ts, client.ts, useStats.ts, FilterBar.tsx, App.tsx, types.ts) + 2 partial (ReadingsTable.test.tsx, dates.test.ts)
**Pattern extraction date:** 2026-07-18
