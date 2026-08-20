"""FastAPI app assembly for the read API (API-01/API-02).

Pinned decisions:
  - The ``verify_token`` auth stub attaches at ROUTER level via
    ``dependencies=[Depends(verify_token)]`` — never per-route — so Phase 5
    enforcement flips one function body without touching any route
    (roadmap decision; threat T-02-03 accepted this phase).
  - CORS: explicit origins from ``get_settings().cors_origins`` (Vite dev
    origin), GET + POST (POST for /agent — the preflight requests it and
    Content-Type, Pitfall 1), NO ``allow_credentials``, NO wildcard — the
    deployed site uses Bearer tokens (CLAUDE.md CORS model, T-02-02).
  - slowapi: the shared ``limiter`` (from the agent router) is registered on
    ``app.state`` with the default 429 handler so ``@limiter.limit`` fires and
    over-limit requests get a clean 429 (T-03-13; the frontend maps any non-200
    to friendly copy).
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.agent.service import agent_reachable
from app.auth import verify_token
from app.config import get_settings
from app.routers import agent, auth, incidents, labs, procedures, readings, stats, upload
from app.routers.agent import limiter

app = FastAPI(title="Chris's Health Dashboard API")

# slowapi wiring — must be registered before requests hit @limiter.limit routes.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.get("/health")
def health() -> dict[str, str | bool | None]:
    """Ungated liveness + agent-config/reachability probe (deploy diagnostic).

    ``agent_configured`` mirrors the agent's own key gate
    (``service._get_client`` returns ``None`` when the key is empty): it is
    ``True`` iff the RUNNING container read a non-empty ``ANTHROPIC_API_KEY`` at
    boot. config.py caches settings at import, so this reflects exactly what the
    live process sees — letting a deploy be checked for the keyless "assistant
    isn't connected" degradation without shell access.

    ``agent_reachable`` is the passive circuit breaker's raw tri-state read
    (LIVE-01/LIVE-04): ``None`` (untested this boot), ``True``/``False`` (the
    outcome of the most recent real ``/agent`` call). Fed only by real traffic —
    no active probe, no token cost, and this route carries no ``@limiter.limit``
    decorator so it never shares ``/agent``'s 20/minute budget.

    Both fields are BOOLEAN-OR-NULL only, never a reason string or enum — an
    unauthenticated caller can learn "up/down", never "why" (SEC-02, T-06-01).
    """
    return {
        "status": "ok",
        "agent_configured": bool(get_settings().anthropic_api_key),
        "agent_reachable": agent_reachable(),
    }


# /auth is the ONE ungated route — it issues the token every gated router
# requires (chicken-and-egg), so it MUST NOT carry Depends(verify_token).
app.include_router(auth.router)
app.include_router(readings.router, dependencies=[Depends(verify_token)])
app.include_router(stats.router, dependencies=[Depends(verify_token)])
app.include_router(agent.router, dependencies=[Depends(verify_token)])
app.include_router(upload.router, dependencies=[Depends(verify_token)])
app.include_router(labs.router, dependencies=[Depends(verify_token)])
app.include_router(incidents.router, dependencies=[Depends(verify_token)])
app.include_router(procedures.router, dependencies=[Depends(verify_token)])
