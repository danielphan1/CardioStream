"""FastAPI app assembly for the read API (API-01/API-02).

Pinned decisions:
  - The ``verify_token`` auth stub attaches at ROUTER level via
    ``dependencies=[Depends(verify_token)]`` — never per-route — so Phase 5
    enforcement flips one function body without touching any route
    (roadmap decision; threat T-02-03 accepted this phase).
  - CORS: explicit origins from ``get_settings().cors_origins`` (Vite dev
    origin), GET only for now, NO ``allow_credentials``, NO wildcard —
    the deployed site uses Bearer tokens (CLAUDE.md CORS model, T-02-02).
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import verify_token
from app.config import get_settings
from app.routers import readings

app = FastAPI(title="Chris's Health Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)

app.include_router(readings.router, dependencies=[Depends(verify_token)])
