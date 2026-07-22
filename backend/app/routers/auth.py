"""POST /auth — ungated, rate-limited password check that issues the token (SEC-01).

Pinned invariants:
  - UNGATED: wired in ``app.main`` WITHOUT ``Depends(verify_token)`` — it must
    be reachable to issue the token every other route requires (chicken-and-egg).
  - Reuses the SINGLE ``limiter`` instance from the agent router so
    ``app.state.limiter`` stays one object (never a second Limiter).
  - slowapi ordering (RESEARCH Pitfall 5): ``@router.post`` sits ABOVE
    ``@limiter.limit`` and the signature declares ``request: Request`` first —
    miss either and rate limiting silently no-ops.
  - Constant-time password compare via ``hmac.compare_digest`` (never ``==``,
    threat T-05-03) and NOTHING about the candidate password is ever logged
    (RESEARCH Pitfall 8 / D-14).
"""

import hmac

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.auth import _serializer
from app.config import get_settings
from app.routers.agent import limiter  # reuse the single limiter instance

router = APIRouter()


class AuthRequest(BaseModel):
    password: str


class AuthResponse(BaseModel):
    token: str


@router.post("/auth", response_model=AuthResponse)
@limiter.limit("5/minute")  # brute-force guard (Pitfall 5 order rules apply)
def auth(request: Request, body: AuthRequest) -> AuthResponse:  # noqa: ARG001
    """Check the shared password in constant time; issue a signed token on match."""
    if not hmac.compare_digest(body.password, get_settings().site_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return AuthResponse(token=_serializer().dumps("authorized"))
