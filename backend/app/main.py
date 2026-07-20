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

from app.auth import verify_token
from app.config import get_settings
from app.routers import agent, readings, stats
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

app.include_router(readings.router, dependencies=[Depends(verify_token)])
app.include_router(stats.router, dependencies=[Depends(verify_token)])
app.include_router(agent.router, dependencies=[Depends(verify_token)])
